//! On-demand file history and line attribution backed by Git's own output.
use serde_json::{json,Value};
use std::{path::{Path,Component},process::{Command,Stdio}};
#[cfg(windows)]use std::os::windows::process::CommandExt;
const MAX:usize=2_000_000;
fn git(path:&Path,argv:&[String])->Result<String,String>{
 let mut cmd=Command::new("git");
 if argv.iter().any(|arg|arg=="--") { cmd.arg("--literal-pathspecs"); }
 cmd.arg("-C").arg(path).arg("-c").arg("core.quotepath=false").args(argv)
   .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped())
   .env("GIT_TERMINAL_PROMPT","0").env("GCM_INTERACTIVE","never")
   .env("GIT_OPTIONAL_LOCKS","0");
 #[cfg(windows)]cmd.creation_flags(0x08000000);
 let out=cmd.output().map_err(|e|e.to_string())?;
 if !out.status.success(){return Err(String::from_utf8_lossy(&out.stderr).trim().into());}
 if out.stdout.len()>MAX{return Err("Output exceeds safe read limit. Try a smaller file".into());}
 String::from_utf8(out.stdout).map_err(|_|"File metadata is not valid UTF-8".into())
}
fn validate(file:&str)->Result<(),String>{
 let p=Path::new(file);
 if file.is_empty()||file.starts_with('-')||file.contains('\0')||p.is_absolute()||
  p.components().any(|c|matches!(c,Component::ParentDir|Component::Prefix(_)|Component::RootDir)){
  return Err("Invalid repository-relative file path".into())
 }
 Ok(())
}
pub fn history(root:&Path,file:&str)->Result<Value,String>{
 validate(file)?;
 let args=vec!["log".into(),"--follow".into(),"--date=short".into(),"-n150".into(),
 "--format=%H%x1f%P%x1f%an%x1f%ad%x1f%s%x1e".into(),"--".into(),file.into()];
 let out=git(root,&args)?;
 let commits=out.split('\x1e').filter_map(|entry|{
   let cols:Vec<_>=entry.trim().split('\x1f').collect();
   if cols.len()!=5{return None;}
   Some(json!({"sha":cols[0],"parents":cols[1].split_whitespace().collect::<Vec<_>>(),
    "author":cols[2],"date":cols[3],"subject":cols[4]}))
 }).collect::<Vec<_>>();
 Ok(json!({"file":file,"commits":commits,"limit":150}))
}
pub fn blame(root:&Path,file:&str)->Result<Value,String>{
 validate(file)?;
 let path=root.join(file);
 let metadata=std::fs::symlink_metadata(&path).map_err(|e|e.to_string())?;
 if !metadata.is_file()||metadata.file_type().is_symlink(){return Err("Only regular text files support blame".into());}
 if metadata.len()>250_000{return Err("File too large for inline blame; use an external editor".into());}
 let args=vec!["blame".into(),"--line-porcelain".into(),"--".into(),file.into()];
 let data=git(root,&args)?;
 let mut sha=String::new();
 let mut final_line=0u32;
 let mut author=String::new();
 let mut time=0i64;
 let mut summary=String::new();
 let mut lines:Vec<Value>=vec![];
 for line in data.lines(){
   if line.starts_with('\t'){
     lines.push(json!({"number":final_line,"sha":sha,"author":author,"authorTime":time,
         "summary":summary,"text":&line[1..]}));
     if lines.len()>=5000{break;}
   }else if line.starts_with("author "){author=line[7..].to_owned();}
   else if line.starts_with("author-time "){time=line[12..].trim().parse().unwrap_or(0);}
   else if line.starts_with("summary "){summary=line[8..].to_owned();}
   else {
     let mut words=line.split_whitespace();
     let hash=words.next().unwrap_or("").trim_start_matches('^');
     if (hash.len()==40||hash.len()==64)&&hash.chars().all(|c|c.is_ascii_hexdigit()){
       let _orig=words.next();
       if let Some(num)=words.next().and_then(|v|v.parse().ok()){
         sha=hash.to_owned();final_line=num;
       }
     }
   }
 }
 Ok(json!({"file":file,"lines":lines,"total":lines.len(),"truncated":lines.len()==5000}))
}
