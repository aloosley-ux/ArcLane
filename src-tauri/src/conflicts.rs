//! Safe, text-only merge conflict inspection and resolution.
//! Only paths currently recorded as unmerged in Git's index can be resolved.
use serde_json::{json,Value};
use std::{collections::BTreeMap,fs,path::{Component,Path},process::{Command,Stdio}};
#[cfg(windows)]use std::os::windows::process::CommandExt;

fn git_bytes(root:&Path,argv:&[String])->Result<Vec<u8>,String>{
 let mut command=Command::new("git");
 command.arg("-C").arg(root).arg("-c").arg("core.quotepath=false").args(argv)
    .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped())
    .env("GIT_TERMINAL_PROMPT","0").env("GCM_INTERACTIVE","never")
    .env("GIT_OPTIONAL_LOCKS","0");
 #[cfg(windows)]command.creation_flags(0x08000000);
 let out=command.output().map_err(|e|e.to_string())?;
 if out.status.success(){Ok(out.stdout)}else{Err(String::from_utf8_lossy(&out.stderr).trim().into())}
}
fn argv(x:&[&str])->Vec<String>{x.iter().map(|s|s.to_string()).collect()}
fn validate_file(file:&str)->Result<(),String>{
 let path=Path::new(file);
 if file.trim().is_empty()||path.is_absolute()||file.starts_with('-')||
   file.contains('\0')||path.components().any(|c|matches!(c,Component::ParentDir|Component::Prefix(_)|Component::RootDir)){
     return Err("Conflict file path is invalid".into())
 }
 Ok(())
}
fn index_stages(root:&Path)->Result<BTreeMap<String,BTreeMap<u8,String>>,String>{
 let raw=git_bytes(root,&argv(&["ls-files","-u","-z"]))?;
 let mut all:BTreeMap<String,BTreeMap<u8,String>>=BTreeMap::new();
 for part in raw.split(|b|*b==0).filter(|v|!v.is_empty()){
   let text=std::str::from_utf8(part).map_err(|_|"Conflict index contains non-UTF8 paths")?;
   let (info,path)=text.split_once('\t').ok_or("Invalid unmerged index record")?;
   let cols:Vec<_>=info.split_whitespace().collect();
   if cols.len()!=3{continue}
   let mode=cols[0];
   // Symlink and gitlink conflicts are intentionally not handled as editable text.
   if mode!="100644"&&mode!="100755"{continue}
   let stage=cols[2].parse::<u8>().map_err(|_|"Unrecognised conflict stage")?;
   if (1..=3).contains(&stage)&&cols[1].len()==40&&cols[1].chars().all(|c|c.is_ascii_hexdigit()){
     all.entry(path.to_string()).or_default().insert(stage,cols[1].to_string());
   }
 }
 Ok(all)
}
fn safe_blob(root:&Path,sha:&str)->Result<String,String>{
 let raw=git_bytes(root,&argv(&["cat-file","blob",sha]))?;
 if raw.len()>1_000_000{return Err("Conflict file exceeds 1MB text editor limit; use an external merge tool".into());}
 if raw.contains(&0){return Err("Binary conflict cannot be edited as text".into());}
 String::from_utf8(raw).map_err(|_|"Conflict file is not UTF-8 text".into())
}
pub fn list(root:&Path)->Result<Value,String>{
 let stages=index_stages(root)?;
 Ok(json!({"count":stages.len(),"files":stages.into_iter().map(|(path,stages)|json!({
  "path":path,"base":stages.contains_key(&1),"ours":stages.contains_key(&2),
  "theirs":stages.contains_key(&3)
 })).collect::<Vec<_>>()}))
}
pub fn inspect(root:&Path,file:&str)->Result<Value,String>{
 validate_file(file)?;
 let stages=index_stages(root)?;
 let entry=stages.get(file).ok_or("File is no longer unmerged; refresh conflicts")?;
 let read=|n:u8|->Result<Option<String>,String>{
   match entry.get(&n){Some(sha)=>safe_blob(root,sha).map(Some),None=>Ok(None)}
 };
 Ok(json!({"path":file,"base":read(1)?,"ours":read(2)?,"theirs":read(3)?}))
}
pub fn resolve(root:&Path,file:&str,choice:&str,manual:Option<&str>)->Result<Value,String>{
 validate_file(file)?;
 let stages=index_stages(root)?;
 let entry=stages.get(file).ok_or("File is no longer unmerged. Refresh before resolving")?;
 let target=root.join(file);
 // Reject symlinks or directories: no path traversal through junctions or symlink parents.
 let parent=target.parent().ok_or("Invalid file parent")?;
 let real_parent=parent.canonicalize().map_err(|e|e.to_string())?;
 let real_root=root.canonicalize().map_err(|e|e.to_string())?;
 if !real_parent.starts_with(&real_root){return Err("Conflict file resolves outside this repository".into());}
 if let Ok(meta)=fs::symlink_metadata(&target){
   if meta.file_type().is_symlink(){return Err("Conflict file is a symlink".into());}
   if meta.is_dir(){return Err("Conflict path points to a directory".into());}
 }
 let text=match choice{
   "ours"=>entry.get(&2).map(|oid|safe_blob(root,oid)).transpose()?
      .ok_or("The ours version does not exist (deleted on our side)")?,
   "theirs"=>entry.get(&3).map(|oid|safe_blob(root,oid)).transpose()?
      .ok_or("The theirs version does not exist (deleted on their side)")?,
   "manual"=>{
      let val=manual.ok_or("Manual resolution content is required")?;
      if val.len()>1_000_000||val.contains('\0'){return Err("Manual content is too large or contains binary bytes".into());}
      val.to_string()
   },
   _=>return Err("Use ours, theirs or manual resolution".into())
 };
 // Always write exactly the bytes being staged. No shell and no arbitrary path writes.
 fs::write(&target,text.as_bytes()).map_err(|e|format!("Could not write resolved file: {e}"))?;
 let stage=git_bytes(root,&vec!["add".into(),"--".into(),file.to_string()]);
 stage?;
 Ok(json!({"ok":true,"path":file,"resolution":choice,"bytes":text.len()}))
}
