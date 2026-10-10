//! Exact tracked-file hunk operations. Applies Git-generated patch fragments to the index.
use serde_json::{json,Value};
use std::{path::Path,process::{Command,Stdio},io::Write};
#[cfg(windows)]use std::os::windows::process::CommandExt;

fn run(repo:&Path,args:&[String],stdin:Option<&[u8]>)->Result<Vec<u8>,String>{
 let mut cmd=Command::new("git");
 if args.iter().any(|arg|arg=="--") { cmd.arg("--literal-pathspecs"); }
 cmd.arg("-C").arg(repo).arg("-c").arg("core.quotepath=false")
    .args(args).stdin(if stdin.is_some(){Stdio::piped()}else{Stdio::null()})
    .stdout(Stdio::piped()).stderr(Stdio::piped())
    .env("GIT_TERMINAL_PROMPT","0").env("GCM_INTERACTIVE","never")
    .env("GIT_OPTIONAL_LOCKS","0");
 #[cfg(windows)]cmd.creation_flags(0x08000000);
 let mut child=cmd.spawn().map_err(|e|e.to_string())?;
 if let Some(data)=stdin {
   let mut pipe=child.stdin.take().ok_or("Unable to open Git standard input")?;
   pipe.write_all(data).map_err(|e|e.to_string())?;
 }
 let out=child.wait_with_output().map_err(|e|e.to_string())?;
 if out.status.success(){Ok(out.stdout)}else{Err(String::from_utf8_lossy(&out.stderr).trim().into())}
}
fn valid_filename(file:&str)->Result<(),String>{
 if file.is_empty()||file.starts_with('-')||Path::new(file).is_absolute()||
    Path::new(file).components().any(|p|matches!(p,std::path::Component::ParentDir)){
     return Err("Invalid file path".into());
 }
 Ok(())
}
fn diff(repo:&Path,file:&str,staged:bool)->Result<String,String>{
 let mut args=vec!["diff".into(),"--no-ext-diff".into(),"--no-color".into(),"--no-renames".into(),"-U3".into()];
 if staged{args.push("--cached".into());}
 args.extend(["--".into(),file.into()]);
 let text=String::from_utf8_lossy(&run(repo,&args,None)?).to_string();
 if text.contains("GIT binary patch")||text.contains("Binary files "){return Err("Binary files do not support text hunk staging".into());}
 Ok(text)
}
fn parts(text:&str)->Result<(String,Vec<String>),String>{
 let mut lines=text.split_inclusive('\n');
 let mut header=String::new();
 let mut chunks:Vec<String>=vec![];
 let mut saw_first=false;
 while let Some(line)=lines.next(){
   if line.starts_with("@@ "){
     chunks.push(line.into());saw_first=true;
   }else if !saw_first{header.push_str(line);}
   else if let Some(last)=chunks.last_mut(){last.push_str(line);}
 }
 if chunks.is_empty(){return Err("No text diff hunks found".into());}
 if !header.starts_with("diff --git ")||!header.contains("\n--- ")||!header.contains("\n+++ "){
     return Err("Unsupported Git patch format".into());
 }
 Ok((header,chunks))
}
pub fn list(repo:&Path,file:&str,staged:bool)->Result<Value,String>{
 valid_filename(file)?;
 let text=diff(repo,file,staged)?;
 let (_,hunks)=parts(&text)?;
 Ok(json!({"file":file,"staged":staged,"hunks":hunks.iter().enumerate().map(|(i,h)|{
    json!({"index":i,"header":h.lines().next().unwrap_or(""),
           "added":h.lines().filter(|l|l.starts_with('+')&&!l.starts_with("+++")).count(),
           "removed":h.lines().filter(|l|l.starts_with('-')&&!l.starts_with("---")).count(),
           "text":if h.len()>150000{format!("{}...[truncated for display]",&h[..h.floor_char_boundary(150000)])}else{h.clone()}})
 }).collect::<Vec<_>>()}))
}
pub fn apply(repo:&Path,file:&str,staged:bool,index:usize)->Result<Value,String>{
 valid_filename(file)?;
 let text=diff(repo,file,staged)?;
 let (header,hunks)=parts(&text)?;
 if index>=hunks.len(){return Err("Selected hunk is not present in the current Git diff".into());}
 let patch=format!("{}{}",header,hunks[index]);
 let mut args=vec!["apply".into(),"--cached".into(),"--recount".into(),"--whitespace=nowarn".into()];
 if staged{args.push("-R".into());}
 // Only Git-generated patch bytes are submitted; never accept raw caller-supplied patch text.
 let output=run(repo,&args,Some(patch.as_bytes()))?;
 Ok(json!({"file":file,"index":index,"operation":if staged{"unstage"}else{"stage"},
           "output":String::from_utf8_lossy(&output),"ok":true}))
}
