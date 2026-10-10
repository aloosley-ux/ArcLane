//! On-demand ConPTY-backed terminal sessions. No processes until a user opens a tab.
use portable_pty::{native_pty_system,CommandBuilder,MasterPty,Child,PtySize};
use serde::Serialize;
use serde_json::{json,Value};
use std::collections::HashMap;
use std::io::{Read,Write};
use std::sync::{Mutex,atomic::{AtomicU64,Ordering}};
use tauri::{AppHandle,Emitter,State};

#[derive(Debug,Clone,Serialize)]
struct TerminalOutput{id:String,data:String,exited:bool}
struct Session{
 id:String,
 path:String,
 child:Box<dyn Child+Send+Sync>,
 master:Box<dyn MasterPty+Send>,
 writer:Box<dyn Write+Send>
}
#[derive(Default)]
pub struct TerminalManager{
 next:AtomicU64,
 sessions:Mutex<HashMap<String,Session>>
}
impl TerminalManager{
 pub fn shutdown(&self){
    if let Ok(mut pool)=self.sessions.lock(){
      for (_,mut session) in pool.drain(){
        let _=session.child.kill();
      }
    }
 }
}
#[tauri::command]
pub fn terminal_open(app:AppHandle,manager:State<'_,TerminalManager>,path:String,rows:Option<u16>,cols:Option<u16>)->Result<Value,String>{
 let cwd=crate::git::root(&path)?;
 let rows=rows.unwrap_or(26).clamp(4,120);
 let cols=cols.unwrap_or(110).clamp(20,360);
 let id=format!("pty-{}",manager.next.fetch_add(1,Ordering::Relaxed)+1);
 let pair=native_pty_system().openpty(PtySize{rows,cols,pixel_width:0,pixel_height:0})
    .map_err(|e|format!("Could not create Windows pseudo-terminal: {e}"))?;
 let mut command=CommandBuilder::new("powershell.exe");
 command.arg("-NoLogo");command.arg("-NoProfile");command.arg("-NoExit");
 command.cwd(&cwd);
 let child=pair.slave.spawn_command(command).map_err(|e|format!("Could not launch PowerShell: {e}"))?;
 let mut reader=pair.master.try_clone_reader().map_err(|e|e.to_string())?;
 let writer=pair.master.take_writer().map_err(|e|e.to_string())?;
 let path_string=cwd.to_string_lossy().into_owned();
 let pid=child.process_id();
 {
   let mut sessions=manager.sessions.lock().map_err(|_|"Terminal registry unavailable")?;
   sessions.insert(id.clone(),Session{id:id.clone(),path:path_string.clone(),child,master:pair.master,writer});
 }
 let handle=app.clone();
 let thread_id=id.clone();
 std::thread::spawn(move||{
   let mut buffer=[0u8;4096];
   loop{
     match reader.read(&mut buffer){
       Ok(0)=>break,
       Ok(n)=>{
         let data=String::from_utf8_lossy(&buffer[..n]).into_owned();
         if handle.emit("arclane-terminal-output",TerminalOutput{id:thread_id.clone(),data,exited:false}).is_err(){break;}
       },
       Err(_)=>break
     }
   }
   let _=handle.emit("arclane-terminal-output",TerminalOutput{id:thread_id,data:String::new(),exited:true});
 });
 Ok(json!({"id":id,"path":path_string,"pid":pid}))
}
#[tauri::command]
pub fn terminal_send(manager:State<'_,TerminalManager>,id:String,data:String)->Result<(),String>{
 if data.len()>65536{return Err("Terminal write too large".into());}
 let mut pool=manager.sessions.lock().map_err(|_|"Terminal registry unavailable")?;
 let session=pool.get_mut(&id).ok_or("Terminal session not found")?;
 session.writer.write_all(data.as_bytes()).map_err(|e|e.to_string())?;
 session.writer.flush().map_err(|e|e.to_string())
}
#[tauri::command]
pub fn terminal_resize(manager:State<'_,TerminalManager>,id:String,rows:u16,cols:u16)->Result<(),String>{
 let pool=manager.sessions.lock().map_err(|_|"Terminal registry unavailable")?;
 let session=pool.get(&id).ok_or("Terminal session not found")?;
 session.master.resize(PtySize{rows:rows.clamp(4,120),cols:cols.clamp(20,360),pixel_width:0,pixel_height:0}).map_err(|e|e.to_string())
}
#[tauri::command]
pub fn terminal_close(manager:State<'_,TerminalManager>,id:String)->Result<(),String>{
 let mut pool=manager.sessions.lock().map_err(|_|"Terminal registry unavailable")?;
 let mut session=pool.remove(&id).ok_or("Terminal session not found")?;
 session.child.kill().map_err(|e|e.to_string())
}
#[tauri::command]
pub fn terminal_sessions(manager:State<'_,TerminalManager>)->Result<Value,String>{
 let pool=manager.sessions.lock().map_err(|_|"Terminal registry unavailable")?;
 Ok(json!(pool.values().map(|s|json!({"id":s.id,"path":s.path,"pid":s.child.process_id()})).collect::<Vec<_>>()))
}
