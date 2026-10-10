//! Deliberate repository creation. No shell; restricted transports and destinations.
use serde_json::{json,Value};
use std::{path::{Path,PathBuf},process::{Command,Stdio}};
#[cfg(windows)] use std::os::windows::process::CommandExt;

fn git(args:&[String],cwd:Option<&Path>)->Result<String,String>{
 let mut cmd=Command::new("git");
 cmd.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped())
    .env("GIT_TERMINAL_PROMPT","0").env("GCM_INTERACTIVE","never")
    .env("GIT_CONFIG_NOSYSTEM","0")
    .env("GIT_ALLOW_PROTOCOL","https:ssh:file");
 if let Some(dir)=cwd{cmd.current_dir(dir);}
 #[cfg(windows)]cmd.creation_flags(0x08000000);
 let out=cmd.output().map_err(|e|format!("Could not start Git: {e}"))?;
 if out.status.success(){Ok(String::from_utf8_lossy(&out.stdout).trim().into())}
 else{Err(String::from_utf8_lossy(&out.stderr).trim().into())}
}
fn windows_git_path(path:PathBuf)->PathBuf{
  #[cfg(windows)]{
    let raw=path.to_string_lossy();
    if let Some(rest)=raw.strip_prefix("\\\\?\\"){return PathBuf::from(rest);}
  }
  path
}
fn allowed_remote(url:&str)->Result<(),String>{
 if url.is_empty()||url.len()>2048||url.chars().any(char::is_control)||url.starts_with('-'){return Err("Invalid repository URL".into());}
 if url.starts_with("https://")||url.starts_with("ssh://")||
    (url.starts_with("git@")&&url.contains(':')&&!url.contains(' ')){return Ok(());}
 let local=Path::new(url);
 if local.is_absolute()&&local.is_dir(){return Ok(());}
 Err("Use an HTTPS/SSH repository URL or an existing absolute local repository path".into())
}
fn dirname(url:&str)->Result<String,String>{
 let trimmed=url.trim_end_matches(['\\','/']).trim_end_matches(".git");
 let tail=trimmed.rsplit(['/', '\\', ':']).next().ok_or("Repository name missing")?;
 if tail.is_empty()||tail=="."||tail==".."||tail.starts_with('-')||
    tail.chars().any(|c|!c.is_ascii_alphanumeric()&&c!='-'&&c!='_'&&c!='.'){
    return Err("Repository URL has an unsafe directory name".into());
 }
 Ok(tail.into())
}
pub fn initialize(folder:&str)->Result<Value,String>{
 let directory=Path::new(folder);
 if !directory.is_absolute()||!directory.is_dir(){return Err("Choose an existing absolute folder".into());}
 let real=windows_git_path(directory.canonicalize().map_err(|e|e.to_string())?);
 // Forbid nested init within any existing repository or worktree.
 if git(&["-C".into(),real.to_string_lossy().into_owned(),"rev-parse".into(),"--show-toplevel".into()],None).is_ok(){
    return Err("Folder is already inside a Git repository; refusing to initialise nested repository".into());
 }
 let result=git(&["init".into(),"--".into(),real.to_string_lossy().into_owned()],None)?;
 Ok(json!({"path":real,"output":result}))
}
pub fn clone(url:&str,parent:&str)->Result<Value,String>{
 allowed_remote(url)?;
 let folder=Path::new(parent);
 if !folder.is_absolute()||!folder.is_dir(){return Err("Choose an existing absolute parent folder".into());}
 let destination=windows_git_path(folder.canonicalize().map_err(|e|e.to_string())?).join(dirname(url)?);
 if destination.exists(){return Err("Clone destination already exists. Choose a different parent folder".into());}
 let output=git(&["clone".into(),"--progress".into(),"--".into(),url.into(),destination.to_string_lossy().into_owned()],None)?;
 Ok(json!({"path":destination,"output":output}))
}
