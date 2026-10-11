//! On-demand ConPTY sessions with backend-owned lifecycle and bounded replay.
use portable_pty::{native_pty_system, Child, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Condvar, Mutex, atomic::{AtomicU64, Ordering}};
use tauri::{AppHandle, Emitter, State};

const OUTPUT_HISTORY_LIMIT: usize = 64 * 1024;
const TERMINAL_EVENT: &str = "arclane-terminal-output";

#[cfg(windows)]
struct ProcessJob(windows_sys::Win32::Foundation::HANDLE);
#[cfg(windows)]
unsafe impl Send for ProcessJob {}
#[cfg(windows)]
impl ProcessJob {
    fn assign(pid: u32) -> Result<Self, String> {
        use windows_sys::Win32::System::JobObjects::*;
        use windows_sys::Win32::System::Threading::*;
        unsafe {
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job.is_null() { return Err(format!("Cannot create terminal process job: {}", std::io::Error::last_os_error())); }
            let handle = Self(job);
            let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(job, JobObjectExtendedLimitInformation, &limits as *const _ as _, std::mem::size_of_val(&limits) as u32) == 0 {
                return Err(format!("Cannot configure terminal process cleanup: {}", std::io::Error::last_os_error()));
            }
            let process = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid);
            if process.is_null() { return Err(format!("Cannot open agent process for cleanup: {}", std::io::Error::last_os_error())); }
            let assigned = AssignProcessToJobObject(job, process) != 0;
            windows_sys::Win32::Foundation::CloseHandle(process);
            if !assigned { return Err(format!("Cannot contain agent child processes: {}", std::io::Error::last_os_error())); }
            Ok(handle)
        }
    }
    fn stop(&self) -> Result<(), String> {
        unsafe {
            if windows_sys::Win32::System::JobObjects::TerminateJobObject(self.0, 1) == 0 {
                return Err(format!("Cannot stop agent process tree: {}", std::io::Error::last_os_error()));
            }
        }
        Ok(())
    }
}
#[cfg(windows)]
impl Drop for ProcessJob { fn drop(&mut self) { unsafe { windows_sys::Win32::Foundation::CloseHandle(self.0); } } }

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSnapshot {
    id: String,
    path: String,
    pid: Option<u32>,
    agent_session: bool,
    running: bool,
    exit_code: Option<i32>,
    exit_error: Option<String>,
    output: String,
    output_truncated: bool,
    output_closed: bool,
    revision: u64,
    closed: bool,
}

struct SessionState { snapshot: Mutex<TerminalSnapshot>, changed: Condvar, event_order: Mutex<()> }
impl SessionState {
    fn new(id: String, path: String, pid: Option<u32>, agent_session: bool) -> Self {
        Self { snapshot: Mutex::new(TerminalSnapshot { id, path, pid, agent_session, running: true, exit_code: None, exit_error: None, output: String::new(), output_truncated: false, output_closed: false, revision: 0, closed: false }), changed: Condvar::new(), event_order: Mutex::new(()) }
    }
    fn snapshot(&self) -> Result<TerminalSnapshot, String> { self.snapshot.lock().map(|s| s.clone()).map_err(|_| "Terminal session state unavailable".into()) }
    fn update<F>(&self, emit: &SessionEmitter, change: F) -> Result<TerminalSnapshot, String>
    where F: FnOnce(&mut TerminalSnapshot) {
        // Keep revision assignment and notification ordered for this session.
        let _order = self.event_order.lock().map_err(|_| "Terminal session event state unavailable")?;
        let current = {
            let mut current = self.snapshot.lock().map_err(|_| "Terminal session state unavailable")?;
            if current.closed { return Ok(current.clone()); }
            change(&mut current);
            current.revision = current.revision.saturating_add(1);
            current.clone()
        };
        self.changed.notify_all();
        emit(current.clone());
        Ok(current)
    }
    fn append_output(&self, emit: &SessionEmitter, data: &str) -> Result<TerminalSnapshot, String> {
        self.update(emit, |snapshot| {
            snapshot.output.push_str(data);
            if snapshot.output.len() > OUTPUT_HISTORY_LIMIT {
                let mut remove = snapshot.output.len() - OUTPUT_HISTORY_LIMIT;
                while !snapshot.output.is_char_boundary(remove) { remove += 1; }
                snapshot.output.drain(..remove);
                snapshot.output_truncated = true;
            }
        })
    }
}

type SessionEmitter = Arc<dyn Fn(TerminalSnapshot) + Send + Sync>;
struct SessionResources {
    #[allow(dead_code)]
    killer: Box<dyn ChildKiller + Send + Sync>,
    #[cfg(windows)] job: ProcessJob,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}
struct Session { state: Arc<SessionState>, emit: SessionEmitter, resources: Option<SessionResources> }
#[derive(Default)]
pub struct TerminalManager { next: AtomicU64, sessions: Mutex<HashMap<String, Session>> }
impl TerminalManager {
    fn snapshots(&self) -> Result<Vec<TerminalSnapshot>, String> {
        let sessions = self.sessions.lock().map_err(|_| "Terminal registry unavailable")?;
        let mut result = sessions.values().map(|session| session.state.snapshot()).collect::<Result<Vec<_>, _>>()?;
        result.sort_by_key(|snapshot| snapshot.id.strip_prefix("pty-").and_then(|n|n.parse::<u64>().ok()).unwrap_or(u64::MAX));
        Ok(result)
    }
    pub fn shutdown(&self) {
        if let Ok(mut sessions) = self.sessions.lock() {
            for session in sessions.values_mut() {
                let running = session.state.snapshot().map(|s| s.running).unwrap_or(true);
                if running {
                    if let Some(resources) = session.resources.as_mut() {
                        #[cfg(windows)] { let _ = resources.job.stop(); }
                        #[cfg(not(windows))] { let _ = resources.killer.kill(); }
                    }
                }
                let _=session.state.update(&session.emit,|snapshot|{snapshot.running=false;snapshot.closed=true;});
            }
            sessions.clear();
        }
    }
    #[cfg(test)]
    fn state_for_test(&self, id: &str) -> Option<Arc<SessionState>> { self.sessions.lock().ok()?.get(id).map(|s| s.state.clone()) }
}

#[tauri::command]
pub fn terminal_open(app: AppHandle, manager: State<'_, TerminalManager>, path: String, rows: Option<u16>, cols: Option<u16>) -> Result<Value, String> {
    open_session(app, manager, path, rows, cols, None, Vec::new())
}
#[tauri::command]
pub fn terminal_launch(app: AppHandle, manager: State<'_, TerminalManager>, path: String, executable: String, args: Vec<String>) -> Result<Value, String> {
    open_session(app, manager, path, Some(28), Some(105), Some(executable), args)
}
fn open_session(app: AppHandle, manager: State<'_, TerminalManager>, path: String, rows: Option<u16>, cols: Option<u16>, executable: Option<String>, args: Vec<String>) -> Result<Value, String> {
    let cwd = crate::git::root(&path)?;
    let rows = rows.unwrap_or(26).clamp(4, 120);
    let cols = cols.unwrap_or(110).clamp(20, 360);
    let mut command = if let Some(exe) = executable.as_deref() {
        if exe.len() > 2048 || args.len() > 16 || args.iter().any(|arg| arg.len() > 2048 || arg.contains('\0')) || args.iter().map(String::len).sum::<usize>() > 8192 {
            return Err("Agent executable arguments exceed the supported limit".into());
        }
        let validated = crate::agents::agent_validate("codex".into(), exe.to_string()).or_else(|_| crate::agents::agent_validate("kilo".into(), exe.to_string()))?;
        CommandBuilder::new(validated)
    } else {
        let mut command = CommandBuilder::new("powershell.exe");
        command.arg("-NoLogo"); command.arg("-NoProfile"); command.arg("-NoExit");
        command
    };
    for arg in args { command.arg(arg); }
    command.cwd(&cwd);
    let pair = native_pty_system().openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 }).map_err(|e| format!("Could not create Windows pseudo-terminal: {e}"))?;
    let child = pair.slave.spawn_command(command).map_err(|e| if executable.is_some() { format!("Could not launch agent process: {e}") } else { format!("Could not launch PowerShell: {e}") })?;
    let reader = match pair.master.try_clone_reader() { Ok(reader) => reader, Err(e) => { let mut child = child; let _ = child.kill(); return Err(e.to_string()); } };
    let writer = match pair.master.take_writer() { Ok(writer) => writer, Err(e) => { let mut child = child; let _ = child.kill(); return Err(e.to_string()); } };
    let pid = child.process_id();
    #[cfg(windows)]
    let job = match pid { Some(pid) => match ProcessJob::assign(pid) { Ok(job) => job, Err(e) => { let mut child = child; let _ = child.kill(); return Err(e); } }, None => { let mut child = child; let _ = child.kill(); return Err("Agent process did not provide a Windows process ID".into()); } };
    let handle = app.clone();
    let emit: SessionEmitter = Arc::new(move |snapshot| { let _ = handle.emit(TERMINAL_EVENT, snapshot); });
    let session = attach_session(&manager, cwd.to_string_lossy().into_owned(), pid, executable.is_some(), child, reader, pair.master, writer, emit, #[cfg(windows)] job)?;
    serde_json::to_value(session).map_err(|e| e.to_string())
}

#[allow(clippy::too_many_arguments)]
fn attach_session(
    manager: &TerminalManager,
    path: String,
    pid: Option<u32>,
    agent_session: bool,
    mut child: Box<dyn Child + Send + Sync>,
    reader: Box<dyn Read + Send>,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    emit: SessionEmitter,
    #[cfg(windows)] job: ProcessJob,
) -> Result<TerminalSnapshot, String> {
    let id = format!("pty-{}", manager.next.fetch_add(1, Ordering::Relaxed) + 1);
    let state = Arc::new(SessionState::new(id.clone(), path, pid, agent_session));
    let killer = child.clone_killer();
    {
        let mut sessions = match manager.sessions.lock() { Ok(sessions) => sessions, Err(_) => { let _=child.kill(); return Err("Terminal registry unavailable".into()); } };
        sessions.insert(id.clone(), Session { state: state.clone(), emit: emit.clone(), resources: Some(SessionResources { killer, #[cfg(windows)] job, master, writer }) });
    }

    watch_output(state.clone(), reader, emit.clone());
    watch_exit(state.clone(), emit, move || child.wait().map(|status| status.exit_code() as i32).map_err(|error| error.to_string()));
    state.snapshot()
}

fn watch_output(state: Arc<SessionState>, mut reader: Box<dyn Read + Send>, emit: SessionEmitter) {
    std::thread::spawn(move || {
        let mut buffer = [0u8; 4096];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(count) => { let text = String::from_utf8_lossy(&buffer[..count]); let _ = state.append_output(&emit, &text); }
            }
        }
        let _ = state.update(&emit, |snapshot| snapshot.output_closed = true);
    });
}
fn watch_exit<F>(state: Arc<SessionState>, emit: SessionEmitter, wait: F)
where F: FnOnce() -> Result<i32, String> + Send + 'static {
    std::thread::spawn(move || {
        let outcome = wait();
        let _ = state.update(&emit, |snapshot| {
            snapshot.running = false;
            match outcome { Ok(code) => snapshot.exit_code = Some(code), Err(error) => snapshot.exit_error = Some(error) }
        });
    });
}

#[tauri::command]
pub fn terminal_send(manager: State<'_, TerminalManager>, id: String, data: String) -> Result<(), String> {
    if data.len() > 65536 { return Err("Terminal write too large".into()); }
    let mut sessions = manager.sessions.lock().map_err(|_| "Terminal registry unavailable")?;
    let session = sessions.get_mut(&id).ok_or("Terminal session not found")?;
    if !session.state.snapshot()?.running { return Err("Terminal process has exited".into()); }
    let resources=session.resources.as_mut().ok_or("Terminal process resources unavailable")?;
    resources.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    resources.writer.flush().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn terminal_resize(manager: State<'_, TerminalManager>, id: String, rows: u16, cols: u16) -> Result<(), String> {
    let sessions = manager.sessions.lock().map_err(|_| "Terminal registry unavailable")?;
    let session = sessions.get(&id).ok_or("Terminal session not found")?;
    if !session.state.snapshot()?.running { return Ok(()); }
    session.resources.as_ref().ok_or("Terminal process resources unavailable")?.master.resize(PtySize { rows: rows.clamp(4, 120), cols: cols.clamp(20, 360), pixel_width: 0, pixel_height: 0 }).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn terminal_close(manager: State<'_, TerminalManager>, id: String) -> Result<(), String> {
    close_session(&manager, &id)
}
fn close_session(manager: &TerminalManager, id: &str) -> Result<(), String> {
    let mut sessions = manager.sessions.lock().map_err(|_| "Terminal registry unavailable")?;
    let session = sessions.get_mut(id).ok_or("Terminal session not found")?;
    if session.state.snapshot()?.running {
        if let Some(resources)=session.resources.as_mut(){
            #[cfg(windows)] if let Err(error)=resources.job.stop(){if session.state.snapshot()?.running{return Err(error);}}
            #[cfg(not(windows))] resources.killer.kill().map_err(|e| e.to_string())?;
        }
    }
    let session = sessions.remove(id).ok_or("Terminal session not found")?;
    let _ = session.state.update(&session.emit, |snapshot| { snapshot.running = false; snapshot.closed = true; });
    // Dropping the Windows job handle applies KILL_ON_JOB_CLOSE, including after
    // the root process exits while descendants still remain in the job.
    drop(session);
    Ok(())
}
#[tauri::command]
pub fn terminal_sessions(manager: State<'_, TerminalManager>) -> Result<Vec<TerminalSnapshot>, String> { manager.snapshots() }

#[cfg(test)]
mod tests {
    use super::*;
    use std::{process::{Command, Stdio}, time::Duration};
    #[test]
    fn state_output_is_bounded_and_utf8_safe() {
        let state = SessionState::new("test".into(), "C:/fixture".into(), Some(4), false);
        let emit: SessionEmitter = Arc::new(|_| {});
        let unicode = "\u{6771}\u{4eac}";
        let payload = unicode.repeat(OUTPUT_HISTORY_LIMIT / unicode.len() + 8);
        state.append_output(&emit, &payload).unwrap();
        let snapshot = state.snapshot().unwrap();
        assert!(snapshot.output_truncated);
        assert!(snapshot.output.len() <= OUTPUT_HISTORY_LIMIT);
        assert!(snapshot.output.is_char_boundary(snapshot.output.len()));
        assert!(snapshot.output.ends_with(unicode));
    }

    fn fixture_command(mode: &str) -> Command {
        let test_binary = std::env::current_exe().unwrap();
        let fixture = test_binary.parent().unwrap().parent().unwrap().join(if cfg!(windows) { "terminal-lifecycle-fixture.exe" } else { "terminal-lifecycle-fixture" });
        assert!(fixture.exists(), "build the terminal-lifecycle-fixture binary before these tests");
        let mut command = Command::new(fixture);
        command.arg(mode).stdout(Stdio::piped()).stderr(Stdio::null());
        command
    }
    #[derive(Debug)] struct TestKiller;
    impl ChildKiller for TestKiller {
        fn kill(&mut self) -> std::io::Result<()> { Ok(()) }
        fn clone_killer(&self) -> Box<dyn ChildKiller + Send + Sync> { Box::new(Self) }
    }
    fn register_state(manager:&TerminalManager,state:Arc<SessionState>,emit:SessionEmitter,resources:Option<SessionResources>){
        manager.sessions.lock().unwrap().insert(state.snapshot().unwrap().id.clone(),Session{state,emit,resources});
    }
    fn start_fixture(manager: &TerminalManager, mode: &str, emit: SessionEmitter) -> Result<TerminalSnapshot, String> {
        let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
        let mut child = fixture_command(mode).current_dir(&cwd).stdin(Stdio::null()).spawn().map_err(|e|e.to_string())?;
        let pid = Some(child.id());
        let id=format!("pty-{}",manager.next.fetch_add(1,Ordering::Relaxed)+1);
        let state=Arc::new(SessionState::new(id,cwd.to_string_lossy().into_owned(),pid,true));
        let output:Box<dyn Read+Send>=Box::new(child.stdout.take().ok_or("fixture stdout missing")?);
        register_state(manager,state.clone(),emit.clone(),None);
        watch_output(state.clone(),output,emit.clone());
        watch_exit(state.clone(),emit,move||child.wait().map(|status|status.code().unwrap_or(-1)).map_err(|error|error.to_string()));
        state.snapshot()
    }
    fn wait_for(manager: &TerminalManager, id: &str, predicate: impl Fn(&TerminalSnapshot) -> bool) -> TerminalSnapshot {
        let state = manager.state_for_test(id).expect("registered session");
        let mut snapshot = state.snapshot.lock().unwrap();
        let deadline = std::time::Instant::now() + Duration::from_secs(10);
        while !predicate(&snapshot) {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            assert!(!remaining.is_zero(), "session lifecycle transition timed out: {snapshot:?}");
            let (next, timeout) = state.changed.wait_timeout(snapshot, remaining).unwrap();
            snapshot = next;
            assert!(!timeout.timed_out() || predicate(&snapshot), "session lifecycle transition timed out: {snapshot:?}");
        }
        snapshot.clone()
    }

    #[test]
    fn fifty_immediate_processes_keep_exit_and_output_in_authoritative_snapshots() {
        let manager = TerminalManager::default();
        let emit: SessionEmitter = Arc::new(|_| {}); // Deliberately attach no event listener.
        for index in 0..50 {
            let created = start_fixture(&manager, "exit7", emit.clone()).expect("fixture process starts");
            assert!(created.pid.is_some());
            let final_state = wait_for(&manager, &created.id, |state| !state.running && state.output_closed);
            assert_eq!(final_state.id, created.id);
            assert_eq!(final_state.path, std::env::current_dir().unwrap().to_string_lossy());
            assert_eq!(final_state.exit_code, Some(7), "immediate child {index}");
            assert!(final_state.output.contains("FIXTURE_RAPID_STDOUT"), "immediate child {index}: {:?}", final_state.output);
            assert!(final_state.output.len() <= OUTPUT_HISTORY_LIMIT);
            assert_eq!(manager.snapshots().unwrap().iter().find(|s| s.id == created.id), Some(&final_state));
        }
        manager.shutdown();
    }

    #[test]
    fn failed_spawn_leaves_no_identity_and_retry_registers_a_new_session() {
        let manager = TerminalManager::default();
        let failed = Command::new("Z:\\missing\\arclane-terminal-fixture.exe").spawn();
        assert!(failed.is_err());
        assert!(manager.snapshots().unwrap().is_empty());
        let emit: SessionEmitter = Arc::new(|_| {});
        let retry = start_fixture(&manager, "exit7", emit).unwrap();
        let final_state = wait_for(&manager, &retry.id, |state| !state.running && state.output_closed);
        assert_eq!(final_state.exit_code, Some(7));
        assert_eq!(manager.snapshots().unwrap().len(), 1);
        manager.shutdown();
    }

    #[cfg(windows)]
    #[test]
    fn closing_session_kills_job_children_even_after_root_exit() {
        use windows_sys::Win32::Foundation::{CloseHandle, WAIT_OBJECT_0};
        use windows_sys::Win32::System::Threading::{OpenProcess, WaitForSingleObject};
        let manager = TerminalManager::default();
        let emit: SessionEmitter = Arc::new(|_| {});
        let cwd=std::env::current_dir().unwrap();
        let mut parent=fixture_command("tree-parent").current_dir(&cwd).stdin(Stdio::piped()).spawn().unwrap();
        let mut input=parent.stdin.take().unwrap();
        let pid=parent.id();let job=ProcessJob::assign(pid).unwrap();
        let id=format!("pty-{}",manager.next.fetch_add(1,Ordering::Relaxed)+1);
        let state=Arc::new(SessionState::new(id.clone(),cwd.to_string_lossy().into_owned(),Some(pid),true));
        let output:Box<dyn Read+Send>=Box::new(parent.stdout.take().unwrap());
        let pair=native_pty_system().openpty(PtySize{rows:24,cols:80,pixel_width:0,pixel_height:0}).unwrap();
        let writer=pair.master.take_writer().unwrap();
        register_state(&manager,state.clone(),emit.clone(),Some(SessionResources{killer:Box::new(TestKiller),job,master:pair.master,writer}));
        watch_output(state.clone(),output,emit.clone());
        watch_exit(state.clone(),emit,move||parent.wait().map(|status|status.code().unwrap_or(-1)).map_err(|error|error.to_string()));
        let current=wait_for(&manager,&id,|snapshot|snapshot.output.contains("FIXTURE_PARENT_READY"));
        assert!(current.running);
        writeln!(input,"spawn-child").unwrap();input.flush().unwrap();
        let current=wait_for(&manager,&id,|snapshot|snapshot.output.contains("FIXTURE_CHILD_PID="));
        let child_pid: u32=current.output.split("FIXTURE_CHILD_PID=").nth(1).unwrap().split_whitespace().next().unwrap().parse().unwrap();
        let process=unsafe{OpenProcess(0x0010_0000,0,child_pid)};
        assert!(!process.is_null(),"fixture child did not stay alive in the job");
        drop(input);
        let root_exit=wait_for(&manager,&id,|snapshot|!snapshot.running);
        assert_eq!(root_exit.exit_code,Some(0));
        close_session(&manager,&id).unwrap();
        unsafe {
            let result=WaitForSingleObject(process,5_000);CloseHandle(process);
            assert_eq!(result,WAIT_OBJECT_0,"child process {child_pid} survived close");
        }
        assert!(manager.snapshots().unwrap().is_empty());
    }
}
