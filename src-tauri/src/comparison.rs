//! Paired file contents for safe side-by-side comparison. No writes.
use serde_json::{json,Value};
use std::{fs,path::{Component,Path},process::{Command,Stdio}};
#[cfg(windows)]use std::os::windows::process::CommandExt;
const LIMIT:usize=1_000_000;
fn git(root:&Path,args:&[String])->Result<Vec<u8>,String>{
 let mut cmd=Command::new("git");
 cmd.arg("-C").arg(root).arg("-c").arg("core.quotepath=false").args(args)
   .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped())
   .env("GIT_TERMINAL_PROMPT","0").env("GCM_INTERACTIVE","never")
   .env("GIT_OPTIONAL_LOCKS","0");
 #[cfg(windows)]cmd.creation_flags(0x08000000);
 let r=cmd.output().map_err(|e|e.to_string())?;
 if r.status.success(){Ok(r.stdout)}else{Err(String::from_utf8_lossy(&r.stderr).trim().into())}
}
fn utf8(bytes:Vec<u8>)->Result<String,String>{
 if bytes.len()>LIMIT{return Err("File exceeds 1MB side-by-side comparison limit".into());}
 if bytes.contains(&0){return Err("Binary file cannot be compared as UTF-8 text".into());}
 String::from_utf8(bytes).map_err(|_|"File is not UTF-8 text; use patch or an external diff tool".into())
}
fn oid_text(root:&Path,rev:&str,file:&str)->Result<Option<String>,String>{
 let entry=format!("{rev}:{file}");
 if git(root,&["cat-file".into(),"-e".into(),entry.clone()]).is_err(){return Ok(None);}
 let mode=git(root,&["cat-file".into(),"-t".into(),entry.clone()])?;
 if mode!=b"blob\n" {return Err("Selected entry is not a regular blob".into());}
 Ok(Some(utf8(git(root,&["show".into(),"--no-ext-diff".into(),entry])?)?))
}
fn validate_file(root:&Path,file:&str)->Result<(),String>{
 let path=Path::new(file);
 if file.is_empty()||file.starts_with('-')||path.is_absolute()||file.contains('\0')||
   path.components().any(|c|matches!(c,Component::ParentDir|Component::RootDir|Component::Prefix(_))){
      return Err("Invalid Git comparison path".into());
 }
 let candidate=root.join(file);
 if let Ok(metadata)=fs::symlink_metadata(&candidate){
   if metadata.file_type().is_symlink()||metadata.is_dir(){return Err("Symlinks and directories cannot be compared as ordinary text".into());}
   let parent=candidate.parent().ok_or("Invalid file parent")?
       .canonicalize().map_err(|e|e.to_string())?;
   if !parent.starts_with(root.canonicalize().map_err(|e|e.to_string())?){
      return Err("Git comparison path resolves outside repository".into());
   }
 }
 Ok(())
}
pub fn compare(root:&Path,file:&str,staged:bool,commit:Option<&str>)->Result<Value,String>{
 validate_file(root,file)?;
 let (before,after,left,right)=if let Some(sha)=commit{
   if sha.len()<7||sha.len()>64||!sha.chars().all(|c|c.is_ascii_hexdigit()){return Err("Commit ID must be a hexadecimal hash".into());}
   git(root,&["cat-file".into(),"-e".into(),format!("{sha}^{{commit}}")])?;
   let parent=git(root,&["rev-parse".into(),format!("{sha}^")]).ok()
      .map(|v|String::from_utf8_lossy(&v).trim().to_string());
   let old=if let Some(par)=parent{oid_text(root,&par,file)?}else{None};
   (old,oid_text(root,sha,file)?,"Parent commit","Selected commit")
 } else if staged{
   (oid_text(root,"HEAD",file)?,oid_text(root,"",file)?,"HEAD","Staging area")
 } else{
   let previous=oid_text(root,"",file)?;
   let current=match fs::read(root.join(file)){
     Ok(bytes)=>Some(utf8(bytes)?),
     Err(e) if e.kind()==std::io::ErrorKind::NotFound=>None,
     Err(e)=>return Err(e.to_string())
   };
   (previous,current,"Staging area","Working tree")
 };
 if before.is_none()&&after.is_none(){return Err("File does not exist in the selected comparison".into());}
 let before_exists=before.is_some();let after_exists=after.is_some();
 let before_text=before.unwrap_or_default();let after_text=after.unwrap_or_default();
 let lines_before=before_text.lines().count();let lines_after=after_text.lines().count();
 Ok(json!({"file":file,"staged":staged,"before":before_text,"after":after_text,
    "beforeExists":before_exists,"afterExists":after_exists,
    "leftLabel":left,"rightLabel":right,"linesBefore":lines_before,"linesAfter":lines_after}))
}
