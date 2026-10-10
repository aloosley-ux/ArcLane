//! On-demand, bounded Git writes. No idle service or polling.
//! A cancellation/timeout is an *unknown Git outcome*: never silently reset HEAD,
//! remove Git lock files or claim that the repository was unchanged.
use std::{cell::RefCell,collections::HashMap,io::Read,path::Path,process::{Command,Output},
    sync::{Arc,Mutex,OnceLock,atomic::{AtomicBool,AtomicUsize,Ordering}},
    thread,time::{Duration,Instant}};

#[cfg(windows)]use std::os::windows::io::AsRawHandle;
const OUTPUT_CAP:usize=1_500_000;
const PENDING_TTL:Duration=Duration::from_secs(90);
struct Request {flag:Arc<AtomicBool>,started:bool,created:Instant}
struct Context {cancelled:Arc<AtomicBool>,deadline:Instant}
static REQUESTS:OnceLock<Mutex<HashMap<String,Request>>>=OnceLock::new();
thread_local!{static CONTEXT:RefCell<Option<Context>>=const{RefCell::new(None)};}
fn key(repo:&Path,id:&str)->Result<String,String>{
    validate(id)?;
    let path=repo.canonicalize().map_err(|e|format!("Cannot locate Git operation repository: {e}"))?;
    Ok(format!("{}|{id}",path.to_string_lossy().replace('\\',"/").to_lowercase()))
}
fn validate(id:&str)->Result<(),String>{
    if id.is_empty()||id.len()>100||!id.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'-'||b==b'_'){
        return Err("Invalid Git operation request ID".into());
    }
    Ok(())
}
fn registry()->&'static Mutex<HashMap<String,Request>>{REQUESTS.get_or_init(Default::default)}
struct Registration(Option<String>);
impl Drop for Registration{
    fn drop(&mut self){
        if let Some(ref key)=self.0{
            if let Ok(mut active)=registry().lock(){active.remove(key);}
        }
    }
}
struct ScopeRestore(Option<Context>);
impl Drop for ScopeRestore{
    fn drop(&mut self){
        let previous=self.0.take();
        CONTEXT.with(|cell|{cell.replace(previous);});
    }
}
pub fn cancel(repo:&Path,id:&str)->Result<bool,String>{
    let key=key(repo,id)?;
    let mut active=registry().lock().map_err(|_|"Git operation registry unavailable")?;
    active.retain(|_,v|v.started||v.created.elapsed()<PENDING_TTL);
    if let Some(request)=active.get(&key){
        request.flag.store(true,Ordering::Release);
        return Ok(true);
    }
    // A cancellation can precede the async blocking worker's registration.
    if active.len()>=256{return Err("Too many Git operation requests".into());}
    active.insert(key,Request{flag:Arc::new(AtomicBool::new(true)),started:false,created:Instant::now()});
    Ok(true)
}
pub fn scope<T>(repo:&Path,request_id:Option<&str>,remote:bool,work:impl FnOnce()->Result<T,String>)->Result<T,String>{
    let token=Arc::new(AtomicBool::new(false));
    let registration=if let Some(id)=request_id{
        let k=key(repo,id)?;
        let mut active=registry().lock().map_err(|_|"Git operation registry unavailable")?;
        active.retain(|_,v|v.started||v.created.elapsed()<PENDING_TTL);
        if let Some(existing)=active.get_mut(&k){
            if existing.started{return Err("Git operation request ID is already running".into());}
            existing.started=true;
            // A request cancelled before the worker started cannot run a Git write.
            if existing.flag.load(Ordering::Acquire){return Err("Git operation cancelled before launch; inspect repository state before retrying".into());}
            let flag=existing.flag.clone();
            drop(active);
            return run_scope(k,flag,remote,work);
        }
        if active.len()>=256{return Err("Too many Git operation requests".into());}
        active.insert(k.clone(),Request{flag:token.clone(),started:true,created:Instant::now()});
        Registration(Some(k))
    }else{Registration(None)};
    let _registration=registration;
    set_scope(token,remote,work)
}
fn run_scope<T>(key:String,flag:Arc<AtomicBool>,remote:bool,work:impl FnOnce()->Result<T,String>)->Result<T,String>{
    let _registration=Registration(Some(key));
    set_scope(flag,remote,work)
}
fn set_scope<T>(flag:Arc<AtomicBool>,remote:bool,work:impl FnOnce()->Result<T,String>)->Result<T,String>{
    if flag.load(Ordering::Acquire){return Err("Git operation cancelled before launch; inspect repository state before retrying".into());}
    let default=if remote{180000}else{120000};
    // Only isolated acceptance fixtures can shorten real operation deadlines.
    let timeout=if std::env::var_os("ARCLANE_TEST_GIT_OPERATIONS").as_deref()==Some(std::ffi::OsStr::new("1")){
        std::env::var("ARCLANE_GIT_ACCEPT_TIMEOUT_MS").ok().and_then(|s|s.parse::<u64>().ok()).unwrap_or(default).clamp(100,default)
    }else{default};
    let previous=CONTEXT.with(|cell|cell.replace(Some(Context{cancelled:flag,deadline:Instant::now()+Duration::from_millis(timeout)})));
    let _restore=ScopeRestore(previous);
    work()
}
#[cfg(windows)]
struct Job(windows_sys::Win32::Foundation::HANDLE);
#[cfg(windows)]
impl Job{
    fn assign(child:&std::process::Child)->Result<Self,String>{
        use windows_sys::Win32::System::JobObjects::*;
        unsafe {
            let handle=CreateJobObjectW(std::ptr::null(),std::ptr::null());
            if handle.is_null(){return Err("Unable to create Git subprocess job".into());}
            let job=Self(handle);
            let mut limits:JOBOBJECT_EXTENDED_LIMIT_INFORMATION=std::mem::zeroed();
            limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(handle,JobObjectExtendedLimitInformation,&limits as *const _ as _,
                std::mem::size_of_val(&limits) as u32)==0||AssignProcessToJobObject(handle,child.as_raw_handle() as _)==0{
                return Err(format!("Cannot contain Git subprocess: {}",std::io::Error::last_os_error()));
            }
            Ok(job)
        }
    }
    fn stop(&self){unsafe{windows_sys::Win32::System::JobObjects::TerminateJobObject(self.0,1);}}
}
#[cfg(windows)]
impl Drop for Job{fn drop(&mut self){unsafe{windows_sys::Win32::Foundation::CloseHandle(self.0);}}}
fn drain(mut pipe:impl Read+Send+'static,total:Arc<AtomicUsize>,overflow:Arc<AtomicBool>)->thread::JoinHandle<Vec<u8>>{
    thread::spawn(move||{
        let mut bytes=Vec::new();let mut chunk=[0;8192];
        loop{match pipe.read(&mut chunk){
            Ok(0)|Err(_)=>break,
            Ok(n)=>{
                let before=total.fetch_add(n,Ordering::Relaxed);
                let keep=n.min(OUTPUT_CAP.saturating_sub(before));
                bytes.extend_from_slice(&chunk[..keep]);
                if n>keep{overflow.store(true,Ordering::Release);}
            }
        }}
        bytes
    })
}
pub fn output(mut command:Command)->Result<Output,String>{
    let context=CONTEXT.with(|c|c.borrow().as_ref().map(|v|(v.cancelled.clone(),v.deadline)));
    let Some((flag,deadline))=context else{return command.output().map_err(|e|e.to_string())};
    if flag.load(Ordering::Acquire){return Err("Git operation cancelled before launch; inspect repository state before retrying".into());}
    // std::process::Command::output() supplies these pipes implicitly; spawn() does not.
    command.stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::piped());
    let mut child=command.spawn().map_err(|e|format!("Unable to launch Git: {e}"))?;
    #[cfg(windows)]let job=match Job::assign(&child){Ok(job)=>job,Err(e)=>{let _=child.kill();let _=child.wait();return Err(e);}};
    let total=Arc::new(AtomicUsize::new(0));
    let overflow=Arc::new(AtomicBool::new(false));
    let stdout=drain(child.stdout.take().ok_or("Git stdout unavailable")?,total.clone(),overflow.clone());
    let stderr=drain(child.stderr.take().ok_or("Git stderr unavailable")?,total,overflow.clone());
    let mut reason=None;
    let status=loop {
        if flag.load(Ordering::Acquire){reason=Some("Git operation cancelled. Its completion may be unknown; refresh and inspect HEAD, index, working tree and any paused operation before retrying.".to_string());}
        else if Instant::now()>=deadline{reason=Some("Git operation timed out. Completion may be unknown; inspect HEAD, index, working tree and any paused operation before retrying.".to_string());}
        else if overflow.load(Ordering::Acquire){reason=Some("Git operation output exceeded 1.5 MB; completion may be unknown. Inspect repository state before retrying.".to_string());}
        if reason.is_some(){
            #[cfg(windows)]job.stop();
            let _=child.kill();
            break child.wait().map_err(|e|e.to_string())?;
        }
        match child.try_wait().map_err(|e|e.to_string())?{
            Some(exit)=>break exit,
            None=>thread::sleep(Duration::from_millis(20))
        }
    };
    // Ensure no launched credential helpers, Git hooks or other descendants linger.
    #[cfg(windows)]job.stop();
    let stdout=stdout.join().map_err(|_|"Git stdout reader failed")?;
    let stderr=stderr.join().map_err(|_|"Git stderr reader failed")?;
    if let Some(reason)=reason{return Err(reason);}
    if overflow.load(Ordering::Acquire){return Err("Git output exceeded the bounded limit. Inspect repository state.".into());}
    Ok(Output{status,stdout,stderr})
}
