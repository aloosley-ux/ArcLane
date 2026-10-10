//! Repository management, local recovery and explicitly user-triggered Git tooling.
//! Read actions never mutate. Mutations are allowlisted and passed as argv, not shell strings.
use serde_json::{json,Value};
use std::{path::{Path,Component},process::{Command,Stdio}};
#[cfg(windows)]use std::os::windows::process::CommandExt;

fn git(path:&Path,parts:Vec<String>)->Result<String,String>{
 let mut proc=Command::new("git");
 if parts.iter().any(|arg|arg=="--") { proc.arg("--literal-pathspecs"); }
 proc.arg("-C").arg(path).arg("-c").arg("core.quotepath=false").args(parts)
     .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped())
     .env("GIT_TERMINAL_PROMPT","0").env("GCM_INTERACTIVE","never")
     .env("GIT_OPTIONAL_LOCKS","0").env("GIT_ALLOW_PROTOCOL","file:https:ssh");
 #[cfg(windows)] proc.creation_flags(0x08000000);
 let result=proc.output().map_err(|e|format!("Git not available: {e}"))?;
 let out=String::from_utf8_lossy(if result.status.success(){&result.stdout}else{&result.stderr}).trim().to_string();
 if result.status.success(){Ok(out)}else{Err(if out.is_empty(){format!("Git exited with {}",result.status)}else{out})}
}
fn args(p:&[&str])->Vec<String>{p.iter().map(|s|s.to_string()).collect()}
fn ref_part(s:&str)->Result<(),String>{
 if s.is_empty()||s.len()>140||s.starts_with('-')||s.contains('\0')||
    s.contains("..")||s.chars().any(|x|x.is_control()||x.is_whitespace()||x=='\\'||x=='~'||x=='^'||x==':'||x=='?'||x=='*'||x=='['){
    return Err("Invalid Git reference name".into());
 }
 Ok(())
}
fn branch(path:&Path,s:&str)->Result<(),String>{
 ref_part(s)?;
 git(path,args(&["show-ref","--verify","--quiet",&format!("refs/heads/{s}")]))
   .map(|_|()).map_err(|_|"Local branch does not exist".into())
}
fn remote(path:&Path,s:&str)->Result<(),String>{
 ref_part(s)?;
 if git(path,args(&["remote"]))?.lines().any(|name|name==s){Ok(())}else{Err("Git remote does not exist".into())}
}
fn remote_url(url:&str)->Result<(),String>{
 if url.is_empty()||url.len()>2048||url.starts_with('-')||url.chars().any(|c|c.is_control()||c==' '){
     return Err("Invalid remote URL".into());
 }
 if url.starts_with("https://")||url.starts_with("ssh://")||(url.starts_with("git@")&&url.contains(':')){
    return Ok(())
 }
 let p=Path::new(url);
 if p.is_absolute()&&p.exists()&&p.is_dir(){return Ok(())}
 Err("Remote must be a HTTPS/SSH URL or existing absolute local repository path".into())
}
fn git_tag(path:&Path,tag:&str)->Result<(),String>{
 ref_part(tag)?;
 git(path,args(&["check-ref-format",&format!("refs/tags/{tag}")])).map(|_|())
}
fn existing_tag(path:&Path,tag:&str)->Result<(),String>{
 git_tag(path,tag)?;
 git(path,args(&["show-ref","--verify","--quiet",&format!("refs/tags/{tag}")])).map(|_|())
}
fn sha_valid(path:&Path,sha:&str)->Result<(),String>{
 if sha.len()<7||sha.len()>64||!sha.chars().all(|c|c.is_ascii_hexdigit()){return Err("Expected an existing commit hash".into());}
 git(path,args(&["cat-file","-e",&format!("{sha}^{{commit}}")])).map(|_|())
}
fn clean(path:&Path)->Result<(),String>{
 if !git(path,args(&["status","--porcelain","--untracked-files=normal"]))?.is_empty(){return Err("Working tree has changes. Commit or stash before this operation".into());}
 Ok(())
}
fn lfs_available(path:&Path)->Result<(),String>{
 git(path,args(&["lfs","version"])).map(|_|()).map_err(|_|"Git LFS is not installed or is unavailable".into())
}
fn file_path(s:&str)->Result<(),String>{
 let path=Path::new(s);
 if s.is_empty()||s.starts_with('-')||s.contains('\0')||path.is_absolute()||path.components().any(|c|matches!(c,Component::ParentDir|Component::RootDir|Component::Prefix(_))){return Err("Invalid repository-relative file path".into());}
 Ok(())
}
fn pattern(s:&str)->Result<(),String>{
 if s.is_empty()||s.len()>150||s.starts_with('-')||s.contains('\0')||s.chars().any(|x|x.is_control()){
     return Err("Invalid LFS tracking pattern".into());
 }
 Ok(())
}
pub fn inspect(path:&Path,section:&str)->Result<Value,String>{
 match section{
  "remotes"=>{
    let mut rs=vec![];
    for name in git(path,args(&["remote"]))?.lines(){
      let fetch=git(path,args(&["remote","get-url",name])).unwrap_or_default();
      let push=git(path,args(&["remote","get-url","--push",name])).unwrap_or_default();
      rs.push(json!({"name":name,"fetch":fetch,"push":push}));
    }
    Ok(json!({"remotes":rs}))
  },
  "reflog"=>{
    let data=git(path,args(&["reflog","show","--all","--date=iso","-n","200","--format=%H%x1f%gD%x1f%gs%x1e"]))?;
    let entries=data.split('\x1e').filter_map(|r|{
      let fields:Vec<_>=r.trim().split('\x1f').collect();
      if fields.len()!=3{return None;}
      Some(json!({"sha":fields[0],"selector":fields[1],"message":fields[2]}))
    }).collect::<Vec<_>>();
    Ok(json!({"entries":entries}))
  },
  "submodules"=>{
    let raw=git(path,args(&["submodule","status","--recursive"]))?;
    let modules=raw.lines().filter_map(|line|{
      let s=line.trim_end();if s.len()<42{return None;}
      let status=s.chars().next().unwrap_or(' ');
      let part=&s[1..];let mut sections=part.split_whitespace();
      let sha=sections.next()?;let folder=sections.next()?;
      Some(json!({"sha":sha,"path":folder,"status":status.to_string(),"description":sections.collect::<Vec<_>>().join(" ")}))
    }).collect::<Vec<_>>();
    Ok(json!({"modules":modules}))
  },
  "lfs"=>{
    if lfs_available(path).is_err(){return Ok(json!({"installed":false,"files":[],"status":"Git LFS not installed"}))}
    let status=git(path,args(&["lfs","status"])).unwrap_or_default();
    let ls=git(path,args(&["lfs","ls-files","--name-only"])).unwrap_or_default();
    Ok(json!({"installed":true,"files":ls.lines().take(500).collect::<Vec<_>>(),"status":status}))
  },
  "gitflow"=>{
    let names=git(path,args(&["for-each-ref","--format=%(refname:short)","refs/heads/"]))?;
    let mut branches=vec![];
    for prefix in ["feature/","release/","hotfix/"]{
      for n in names.lines().filter(|b|b.starts_with(prefix)){
         let head=git(path,args(&["rev-parse",n]))?;
         branches.push(json!({"kind":prefix.trim_end_matches('/'),"name":n,"head":head}));
       }
    }
    Ok(json!({"branches":branches,"hasDevelop":names.lines().any(|l|l=="develop"),"hasMain":names.lines().any(|l|l=="main"),"hasMaster":names.lines().any(|l|l=="master")}))
  },
  _=>Err("Unsupported repository tool view".into())
 }
}
pub fn perform(path:&Path,op:&str,file:&str,input:&str)->Result<Value,String>{
 let value=input.trim();
 if op=="gitflow_finish_feature" {
     // Finish merges into develop but never deletes the source or pushes remotely.
     if !file.starts_with("feature/")||file.len()<=8 {
         return Err("Choose an existing feature/* branch".into());
     }
     branch(path,file)?;branch(path,"develop")?;sha_valid(path,value)?;
     let current=git(path,args(&["symbolic-ref","--quiet","--short","HEAD"]))?;
     if current!=file {return Err("Switch to the selected feature branch before finishing it".into());}
     if git(path,args(&["rev-parse","HEAD"]))?!=git(path,args(&["rev-parse",value]))? {
         return Err("Feature HEAD moved since review. Refresh before finishing.".into());
     }
     clean(path)?;
     let git_dir=git(path,args(&["rev-parse","--git-dir"]))?;
     let marker=std::path::PathBuf::from(git_dir);
     let folder=if marker.is_absolute(){marker}else{path.join(marker)};
     if ["MERGE_HEAD","CHERRY_PICK_HEAD","REVERT_HEAD","rebase-merge","rebase-apply","sequencer"].iter().any(|name|folder.join(name).exists()){
         return Err("Continue or abort the existing Git operation first".into());
     }
     git(path,args(&["switch","develop"]))?;
     match git(path,args(&["merge","--no-ff","--no-edit",file])) {
         Ok(output)=>return Ok(json!({"ok":true,"command":"git switch develop && git merge --no-ff --no-edit",
             "output":format!("Merged {file} into develop. The feature branch was retained. {output}")})),
         Err(error)=>return Err(format!("Feature merge did not complete on develop: {error}. If Git paused for conflicts, resolve and continue or abort. The feature branch was retained."))
     }
 }

 let line:Vec<String>=match op{
   "remote_add"=>{ref_part(file)?;if remote(path,file).is_ok(){return Err("Remote already exists".into());}remote_url(value)?;
       args(&["remote","add",file,value])},
   "remote_remove"=>{remote(path,file)?;args(&["remote","remove",file])},
   "remote_rename"=>{remote(path,file)?;ref_part(value)?;args(&["remote","rename",file,value])},
   "remote_url"=>{remote(path,file)?;remote_url(value)?;args(&["remote","set-url",file,value])},
   "fetch_remote"=>{remote(path,file)?;args(&["fetch","--prune",file])},
   "push_upstream"=>{remote(path,file)?;let name=git(path,args(&["branch","--show-current"]))?;
       branch(path,&name)?;args(&["push","-u",file,&name])},
   "tag_annotated"=>{git_tag(path,file)?;if value.is_empty()||value.len()>10000{return Err("Annotated tag message is required (max 10KB)".into());}
       args(&["tag","-a",file,"-m",value])},
   "tag_push"=>{remote(path,file)?;existing_tag(path,value)?;
       args(&["push",file,&format!("refs/tags/{value}:refs/tags/{value}")])},
   "tag_remote_delete"=>{remote(path,file)?;git_tag(path,value)?;
       args(&["push",file,&format!(":refs/tags/{value}")])},
   "submodule_sync"=>args(&["submodule","sync","--recursive"]),
   "submodule_update"=>args(&["submodule","update","--init","--recursive"]),
   "lfs_track"=>{lfs_available(path)?;pattern(value)?;args(&["lfs","track",value])},
   "lfs_untrack"=>{lfs_available(path)?;pattern(value)?;args(&["lfs","untrack",value])},
   "lfs_lock"=>{lfs_available(path)?;file_path(file)?;args(&["lfs","lock",file])},
   "lfs_unlock"=>{lfs_available(path)?;file_path(file)?;args(&["lfs","unlock",file])},
   "gitflow_start"=>{
     let base=match file{"feature"|"release"=>"develop","hotfix"=>{
         if branch(path,"main").is_ok(){"main"}else{"master"}
     },_=>return Err("Gitflow type must be feature, release or hotfix".into())};
     branch(path,base)?;ref_part(value)?;clean(path)?;
     let name=format!("{file}/{value}");
     git(path,args(&["check-ref-format","--branch",&name]))?;
     if branch(path,&name).is_ok(){return Err("Gitflow branch already exists".into());}
     args(&["switch","-c",&name,base])
   },
   "rescue_branch"=>{sha_valid(path,file)?;ref_part(value)?;
      git(path,args(&["check-ref-format","--branch",value]))?;
      if branch(path,value).is_ok(){return Err("Recovery branch already exists".into());}
      args(&["branch",value,file])
   },
   "restore_commit_file"=>{sha_valid(path,file)?;file_path(value)?;
      let found=git(path,args(&["ls-tree","-r","--name-only",file,"--",value]))?;
      if !found.lines().any(|s|s==value){return Err("File not present in selected historical commit".into());}
      args(&["restore","--source",file,"--worktree","--",value])
   },
   _=>return Err("Unsupported repository tool action".into())
 };
 let output=git(path,line.clone())?;
 Ok(json!({"ok":true,"command":format!("git {}",line.join(" ")),"output":output}))
}
