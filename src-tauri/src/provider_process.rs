//! Bounded, cancellable provider subprocesses. No worker exists while the app is idle.
use std::{collections::HashMap,io::Read,path::Path,process::{Command,Stdio},sync::{Arc,Mutex,OnceLock,atomic::{AtomicBool,AtomicUsize,Ordering}},thread,time::{Duration,Instant}};
#[cfg(windows)] use std::os::windows::{process::CommandExt,io::AsRawHandle};
const MAX_OUTPUT:usize=3_000_000;
struct Request{cancelled:Arc<AtomicBool>,started:bool,created:Instant}
static REQUESTS:OnceLock<Mutex<HashMap<String,Request>>>=OnceLock::new();
fn key(repo:&Path,id:&str)->String{format!("{}|{id}",repo.to_string_lossy().replace('\\',"/").to_lowercase())}
fn valid_id(id:&str)->Result<(),String>{if id.is_empty()||id.len()>100||!id.chars().all(|c|c.is_ascii_alphanumeric()||c=='-'||c=='_'){Err("Invalid provider request identifier".into())}else{Ok(())}}
struct Registration(Option<String>);
impl Drop for Registration{fn drop(&mut self){if let Some(ref key)=self.0{if let Ok(mut requests)=REQUESTS.get_or_init(Default::default).lock(){requests.remove(key);}}}}
pub fn cancel(repo:&Path,id:&str)->Result<bool,String>{
 valid_id(id)?;
 let mut requests=REQUESTS.get_or_init(Default::default).lock().map_err(|_|"Provider request state unavailable")?;
 requests.retain(|_,r|r.started||r.created.elapsed()<Duration::from_secs(60));
 let key=key(repo,id);
 if let Some(r)=requests.get(&key){r.cancelled.store(true,Ordering::Relaxed);return Ok(true)}
 // Preserve cancellation that arrives before a blocking worker starts.
 if requests.len()>=512{return Err("Too many pending provider requests".into());}
 requests.insert(key,Request{cancelled:Arc::new(AtomicBool::new(true)),started:false,created:Instant::now()});Ok(true)
}
#[cfg(windows)] struct Job(windows_sys::Win32::Foundation::HANDLE);
#[cfg(windows)] impl Job{
 fn assign(child:&std::process::Child)->Result<Self,String>{
  use windows_sys::Win32::System::JobObjects::*;
  unsafe{
   let handle=CreateJobObjectW(std::ptr::null(),std::ptr::null());
   if handle.is_null(){return Err("Cannot create provider process job".into());}
   let job=Self(handle);
   let mut limits:JOBOBJECT_EXTENDED_LIMIT_INFORMATION=std::mem::zeroed();
   limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
   if SetInformationJobObject(handle,JobObjectExtendedLimitInformation,&limits as *const _ as _,std::mem::size_of_val(&limits) as u32)==0||AssignProcessToJobObject(handle,child.as_raw_handle() as _)==0{
    return Err(format!("Cannot contain provider process: {}",std::io::Error::last_os_error()));
   }
   Ok(job)
  }
 }
 fn stop(&self){unsafe{windows_sys::Win32::System::JobObjects::TerminateJobObject(self.0,1);}}
}
#[cfg(windows)] impl Drop for Job{fn drop(&mut self){unsafe{windows_sys::Win32::Foundation::CloseHandle(self.0);}}}
fn reader(mut stream:impl Read+Send+'static,overflow:Arc<AtomicBool>,total:Arc<AtomicUsize>)->thread::JoinHandle<Vec<u8>>{
 thread::spawn(move||{let mut data=Vec::new();let mut chunk=[0;8192];loop{match stream.read(&mut chunk){Ok(0)|Err(_)=>break,Ok(n)=>{let used=total.fetch_add(n,Ordering::Relaxed);let remaining=MAX_OUTPUT.saturating_sub(used);data.extend_from_slice(&chunk[..n.min(remaining)]);if n>remaining{overflow.store(true,Ordering::Relaxed);}}}}data})
}
pub fn run(repo:&Path,args:Vec<String>,request:Option<&str>)->Result<String,String>{
 let mut cancelled=Arc::new(AtomicBool::new(false));
 let registration=if let Some(id)=request{
  valid_id(id)?;
  let key=key(repo,id);let mut requests=REQUESTS.get_or_init(Default::default).lock().map_err(|_|"Provider request state unavailable")?;
  requests.retain(|_,r|r.started||r.created.elapsed()<Duration::from_secs(60));
  if let Some(r)=requests.get_mut(&key){if r.started{return Err("Provider request is already running".into());}r.started=true;cancelled=r.cancelled.clone();}
  else{if requests.len()>=512{return Err("Too many pending provider requests".into());}requests.insert(key.clone(),Request{cancelled:cancelled.clone(),started:true,created:Instant::now()});}
  Registration(Some(key))
 }else{Registration(None)};
 if cancelled.load(Ordering::Relaxed){return Err("GitHub read cancelled before launch".into());}
 let mut command=Command::new("gh");
 command.args(args).current_dir(repo).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped())
  .env("GH_PROMPT_DISABLED","1").env("GIT_TERMINAL_PROMPT","0").env("GCM_INTERACTIVE","never").env("GH_PAGER","cat");
 #[cfg(windows)]command.creation_flags(0x08000000);
 let mut child=command.spawn().map_err(|_|"GitHub CLI (gh) is unavailable. Install gh and sign in with gh auth login.".to_string())?;
 #[cfg(windows)]let job=match Job::assign(&child){Ok(job)=>job,Err(e)=>{let _=child.kill();let _=child.wait();return Err(e)}};
 let overflow=Arc::new(AtomicBool::new(false));
 let total=Arc::new(AtomicUsize::new(0));
 let stdout=reader(child.stdout.take().ok_or("Missing provider stdout")?,overflow.clone(),total.clone());
 let stderr=reader(child.stderr.take().ok_or("Missing provider stderr")?,overflow.clone(),total);
 // Only the hermetic mock accepts a shortened timeout for acceptance tests.
 let timeout=if std::env::var_os("ARCLANE_GH_MOCK_DATA").is_some(){std::env::var("ARCLANE_GH_TIMEOUT_MS").ok().and_then(|v|v.parse::<u64>().ok()).unwrap_or(45000).clamp(100,45000)}else{45000};
 let start=Instant::now();let mut reason=None;
 let status=loop{
  if cancelled.load(Ordering::Relaxed){reason=Some("GitHub read cancelled; no local Git changes were requested".to_string());}
  else if overflow.load(Ordering::Relaxed){reason=Some("GitHub output exceeded 3 MB; narrow the selection and retry".into());}
  else if start.elapsed()>=Duration::from_millis(timeout){reason=Some("GitHub request timed out. Check connectivity. For remote actions, inspect GitHub before retrying; completion may be unknown.".into());}
  if reason.is_some(){#[cfg(windows)]job.stop();let _=child.kill();break child.wait().map_err(|e|e.to_string())?;}
  match child.try_wait().map_err(|e|e.to_string())?{Some(status)=>break status,None=>thread::sleep(Duration::from_millis(20))}
 };
 // Kill leftover provider helpers before joining pipe readers, including successful exits.
 #[cfg(windows)]job.stop();
 let output=stdout.join().map_err(|_|"Provider stdout reader failed")?;
 let error=stderr.join().map_err(|_|"Provider stderr reader failed")?;
 drop(registration);
 if let Some(reason)=reason{return Err(reason);}
 if overflow.load(Ordering::Relaxed){return Err("GitHub output exceeded 3 MB; narrow the selection and retry".into());}
 if status.success(){return Ok(String::from_utf8_lossy(&output).trim().into());}
 let raw=String::from_utf8_lossy(&error);
 let diagnostic=raw.split_whitespace().map(|word|if ["ghp_","gho_","ghu_","ghs_","ghr_","github_pat_"].iter().any(|prefix|word.contains(prefix)){"[redacted]"}else{word}).collect::<Vec<_>>().join(" ");
 let diagnostic:String=diagnostic.chars().take(1300).collect();
 let lower=diagnostic.to_lowercase();
 let advice=if lower.contains("auth")||lower.contains("login")||lower.contains("401"){"Sign in with gh auth login, then retry."}
  else if lower.contains("rate limit")||lower.contains("429"){"GitHub rate limit reached; wait before retrying."}
  else if lower.contains("resolve host")||lower.contains("network")||lower.contains("connection"){"Check your connection; local Git workflows remain available."}
  else if lower.contains("403")||lower.contains("404")||lower.contains("not found"){"Check repository access and the configured GitHub remote."}else{"Review the CLI diagnostic and retry manually."};
 Err(format!("GitHub CLI failed ({status}). {advice} {diagnostic}"))
}
