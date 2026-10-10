//! Read-only tree comparisons and explicit, index-preserving historical restores.
use crate::commit_workflows::{git, resolve};
use serde_json::{json, Value};
use std::path::{Component, Path};
fn a(args:&[&str])->Vec<String>{args.iter().map(|s|s.to_string()).collect()}
fn file_path(file:&str)->Result<(),String>{
 if file.is_empty()||file.contains('\0')||file.starts_with('-')||Path::new(file).components().any(|c|matches!(c,Component::ParentDir|Component::RootDir|Component::Prefix(_))) {
  return Err("Choose a repository-relative literal file path".into());
 }
 Ok(())
}
fn reference(root:&Path,selection:&str)->Result<String,String>{
 if selection.starts_with("refs/") {
  let refs=git(root,&a(&["for-each-ref","--format=%(refname)","refs/heads","refs/remotes","refs/tags"]))?;
  if !refs.lines().any(|r|r==selection){return Err("Reference no longer exists".into());}
  return git(root,&a(&["rev-parse","--verify",&format!("{selection}^{{commit}}")]))
 }
 resolve(root,selection)
}
fn changed(root:&Path,from:Option<&str>,to:&str)->Result<Vec<Value>,String>{
 let args=if let Some(from)=from {a(&["diff","--name-status","-z","--no-renames",from,to])}
  else {a(&["diff-tree","--root","--no-commit-id","--name-status","-r","-z","--no-renames",to])};
 let output=git(root,&args)?;
 let mut fields=output.split('\0').filter(|s|!s.is_empty());let mut files=vec![];
 while let Some(status)=fields.next(){if let Some(path)=fields.next(){files.push(json!({"status":status,"path":path}));}}
 Ok(files)
}
pub fn view(root:&Path,from:Option<&str>,to:&str,file:Option<&str>)->Result<Value,String>{
 let target=reference(root,to)?;
 let details=crate::commit_workflows::details(root,&target)?;
 let source=match from {Some(s)=>Some(reference(root,s)?),None=>details["parents"][0].as_str().map(|s|s.to_string())};
 let files=changed(root,source.as_deref(),&target)?;
 let mut args=if let Some(ref s)=source {a(&["diff","--no-ext-diff","--no-textconv","--no-color",s,&target])}
  else {a(&["show","--format=","--no-ext-diff","--no-textconv","--no-color","--root",&target])};
 if let Some(file)=file{file_path(file)?;args.extend(a(&["--",file]));}
 let mut patch=git(root,&args)?;
 if patch.len()>650000{let mut end=650000;while !patch.is_char_boundary(end){end-=1;}patch.truncate(end);patch.push_str("\n[ArcLane: patch truncated at 650 KB]");}
 let (comparison,comparison_error)=if let Some(file)=file{
  match crate::comparison::between(root,file,source.as_deref(),&target){Ok(c)=>(Some(c),None),Err(e)=>(None,Some(e))}
 }else{(None,None)};
 Ok(json!({"from":source,"to":target,"details":details,"files":files,"patch":patch,"comparison":comparison,"comparisonError":comparison_error}))
}
pub fn restore(root:&Path,input:&str)->Result<Value,String>{
 let opts:Value=serde_json::from_str(input).map_err(|e|e.to_string())?;
 if opts["confirmed"]!=true{return Err("Historical restore requires explicit confirmation".into());}
 let sha=resolve(root,opts["sha"].as_str().ok_or("Missing source commit")?)?;
 let expected=opts["expectedHead"].as_str().ok_or("Missing expected HEAD")?;
 if git(root,&a(&["rev-parse","HEAD"]))?!=expected{return Err("HEAD changed. Reopen the review before restoring files.".into());}
 if crate::advanced::sequencer_status(root)["active"]==true{return Err("Finish the current Git operation before restoring historical files".into());}
 let files=opts["files"].as_array().ok_or("Choose files to restore")?;
 if files.is_empty()||files.len()>500{return Err("Choose 1–500 files to restore".into());}
 let mut command=a(&["restore","--source",&sha,"--worktree","--"]);
 for file in files{
  let name=file.as_str().ok_or("Invalid file selection")?;file_path(name)?;
  // Only restore entries present at the source; do not offer deletion as historical restore.
  if git(root,&a(&["cat-file","-t",&format!("{sha}:{name}")]))?!="blob" {return Err("Historical restore requires a blob at the source revision".into());}
  let mode=git(root,&a(&["ls-tree","--format=%(objectmode)",&sha,"--",name]))?;
  if mode!="100644"&&mode!="100755"{return Err("Historical restore only supports regular files, not symbolic links".into());}
  let target=root.join(name);
  let mut ancestor=target.as_path();while !ancestor.exists(){ancestor=ancestor.parent().ok_or("Invalid restore path")?;}
  if !ancestor.canonicalize().map_err(|e|e.to_string())?.starts_with(root.canonicalize().map_err(|e|e.to_string())?){return Err("Restore path resolves outside repository".into());}
  if std::fs::symlink_metadata(&target).is_ok_and(|m|m.file_type().is_symlink()){return Err("Refusing to overwrite a symbolic link".into());}
  command.push(name.to_string());
 }
 let output=git(root,&command)?;
 Ok(json!({"ok":true,"command":"git restore --source <revision> --worktree -- <selected files>","output":if output.is_empty(){format!("Restored {} file(s); staging area preserved",files.len())}else{output}}))
}
