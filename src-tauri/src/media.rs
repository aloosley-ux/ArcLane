//! Bounded, read-only binary inspection. Never trusts filename extensions.
use std::{fs,io::{Cursor,Read},path::{Component,Path},process::{Command,Stdio}};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use base64::{Engine,engine::general_purpose::STANDARD};
#[cfg(windows)] use std::os::windows::{fs::MetadataExt,process::CommandExt};
pub const LIMIT:u64=2_000_000;
pub fn old_path(root:&Path,file:&str,from:Option<&str>,to:&str,staged:bool)->Result<String,String>{
 let Some(from)=from else{return Ok(file.into())};let mut args=vec!["diff","--name-status","-z","-M"];
 if staged{args.extend(["--cached",from]);}else{args.extend([from,to]);}
 let out=git(root,&args)?;let fields:Vec<_>=out.split(|b|*b==0).filter(|s|!s.is_empty()).collect();let mut i=0;
 while i<fields.len(){let status=fields[i];i+=1;if status.starts_with(b"R")||status.starts_with(b"C"){if i+1>=fields.len(){break;}let old=fields[i];let new=fields[i+1];i+=2;if new==file.as_bytes(){let old=String::from_utf8(old.to_vec()).map_err(|_|"Rename path is not UTF-8")?;safe_path(root,&old)?;return Ok(old);}}else{i+=1;}}Ok(file.into())
}
pub fn hash(bytes:&[u8])->String{format!("{:x}",Sha256::digest(bytes))}
pub fn git(root:&Path,args:&[&str])->Result<Vec<u8>,String>{
 git_index(root,args,None)
}
pub fn git_index(root:&Path,args:&[&str],index:Option<&Path>)->Result<Vec<u8>,String>{
 let mut c=Command::new("git");c.arg("--literal-pathspecs").arg("-C").arg(root).args(args).stdin(Stdio::null()).env("GIT_OPTIONAL_LOCKS","0").env("GIT_TERMINAL_PROMPT","0");
 if let Some(index)=index{let raw=index.to_string_lossy();c.env("GIT_INDEX_FILE",raw.strip_prefix("\\\\?\\").unwrap_or(&raw));}
 #[cfg(windows)] c.creation_flags(0x08000000);
 let o=c.output().map_err(|e|e.to_string())?;if o.status.success(){Ok(o.stdout)}else{Err(String::from_utf8_lossy(&o.stderr).trim().into())}
}
pub fn text(root:&Path,args:&[&str])->Result<String,String>{Ok(String::from_utf8_lossy(&git(root,args)?).trim().into())}
pub fn safe_path(root:&Path,file:&str)->Result<(),String>{
 let p=Path::new(file);if file.is_empty()||file.contains('\0')||file.contains(':')||file.starts_with('-')||p.components().any(|c|!matches!(c,Component::Normal(_))||c.as_os_str().to_string_lossy().eq_ignore_ascii_case(".git")){return Err("Choose a literal repository-relative file path outside Git metadata".into());}
 let root=root.canonicalize().map_err(|e|e.to_string())?;let mut current=root.clone();
 for part in p.components(){current.push(part);match fs::symlink_metadata(&current){Ok(m)=>{
  #[cfg(windows)] if m.file_attributes()&0x400!=0{return Err("Reparse points are unsupported".into());}
  if m.file_type().is_symlink(){return Err("Symlinks are unsupported".into());}
  if !current.canonicalize().map_err(|e|e.to_string())?.starts_with(&root){return Err("Path resolves outside repository".into());}
 },Err(e) if e.kind()==std::io::ErrorKind::NotFound=>{},Err(e)=>return Err(e.to_string())}}
 if current.is_dir(){return Err("Directories are unsupported".into());}Ok(())
}
pub fn read_file(root:&Path,file:&str,limit:u64)->Result<Option<Vec<u8>>,String>{
 safe_path(root,file)?;let p=root.join(file);let mut f=match fs::File::open(&p){Ok(f)=>f,Err(e) if e.kind()==std::io::ErrorKind::NotFound=>return Ok(None),Err(e)=>return Err(e.to_string())};
 if f.metadata().map_err(|e|e.to_string())?.len()>limit{return Err("File exceeds recovery/preview size limit".into());}
 let mut bytes=vec![];(&mut f).take(limit+1).read_to_end(&mut bytes).map_err(|e|e.to_string())?;if bytes.len() as u64>limit{return Err("File grew beyond size limit".into());}Ok(Some(bytes))
}
fn side(bytes:Option<Vec<u8>>,size:u64,oid:Option<String>,unsupported:Option<&str>)->Value{
 let Some(bytes)=bytes else{return json!({"exists":oid.is_some(),"size":size,"oid":oid,"kind":"binary","reason":unsupported.unwrap_or("Preview exceeds 2 MB limit")});};
 let mut v=json!({"exists":true,"size":size,"oid":oid,"sha256":hash(&bytes),"kind":"binary","reason":"Unsupported binary or non-UTF8 content"});
 let format=image::guess_format(&bytes).ok().filter(|f|matches!(f,image::ImageFormat::Png|image::ImageFormat::Jpeg|image::ImageFormat::WebP|image::ImageFormat::Gif));
 if let Some(format)=format{
  let mut reader=image::ImageReader::with_format(Cursor::new(&bytes),format);let mut limits=image::Limits::default();limits.max_image_width=Some(4096);limits.max_image_height=Some(4096);limits.max_alloc=Some(64*1024*1024);reader.limits(limits);
  match reader.decode(){Ok(img)=>{
   // Re-encode a decoded first frame: no original animation, metadata or active content enters WebView.
   let thumb=img.thumbnail(1024,1024);let mut png=Cursor::new(vec![]);
   if thumb.write_to(&mut png,image::ImageFormat::Png).is_ok()&&png.get_ref().len()<=LIMIT as usize{
    v["kind"]=json!("image");v["format"]=json!(format!("{format:?}"));v["width"]=json!(img.width());v["height"]=json!(img.height());v["preview"]=json!(format!("data:image/png;base64,{}",STANDARD.encode(png.into_inner())));v["reason"]=json!("Verified raster · first frame only · preview scaled to at most 1024 px");
   }else{v["reason"]=json!("Decoded image preview exceeds payload limit");}
  },Err(_)=>v["reason"]=json!("Corrupt image or decoding dimensions/memory limit exceeded")}
 }else if bytes.starts_with(b"%PDF"){v["reason"]=json!("PDF: metadata only");}else if bytes.starts_with(b"MZ"){v["reason"]=json!("Executable: metadata only");}else if std::str::from_utf8(&bytes).is_ok()&&!bytes.contains(&0){v["kind"]=json!("text");v["reason"]=json!("Text content; use textual review (1 MB limit)");}
 v
}
fn absent()->Value{json!({"exists":false,"size":0,"kind":"absent","reason":"File absent"})}
fn blob(root:&Path,rev:&str,file:&str)->Result<Value,String>{
 let entry=format!("{rev}:{file}");let oid=match text(root,&["rev-parse","--verify",&entry]){Ok(s)=>s,Err(_)=>return Ok(absent())};
 let mode=if rev.is_empty(){text(root,&["ls-files","--stage","--",file])?.split_whitespace().next().unwrap_or("").to_string()}else{text(root,&["ls-tree","--format=%(objectmode)",rev,"--",file])?};
 if mode!="100644"&&mode!="100755"{return Ok(side(None,0,Some(oid),Some("Non-regular Git entry: metadata only")));}
 let size=text(root,&["cat-file","-s",&oid])?.parse::<u64>().map_err(|e|e.to_string())?;
 let bytes=if size<=LIMIT{Some(git(root,&["cat-file","blob",&oid])?)}else{None};Ok(side(bytes,size,Some(oid),None))
}
fn working(root:&Path,file:&str)->Result<Value,String>{
 safe_path(root,file)?;let p=root.join(file);if !p.exists(){return Ok(absent());}
 let size=fs::metadata(&p).map_err(|e|e.to_string())?.len();let oid=text(root,&["hash-object","--no-filters","--",file])?;
 let bytes=if size<=LIMIT{read_file(root,file,LIMIT)?}else{None};Ok(side(bytes,size,Some(oid),None))
}
pub fn between(root:&Path,file:&str,from:Option<&str>,to:&str)->Result<Value,String>{safe_path(root,file)?;let old=old_path(root,file,from,to,false)?;response(file,from.unwrap_or("Empty tree"),to,from.map(|r|blob(root,r,&old)).transpose()?.unwrap_or_else(absent),blob(root,to,file)?)}
fn response(file:&str,left:&str,right:&str,before:Value,after:Value)->Result<Value,String>{
 if before["exists"]==false&&after["exists"]==false{return Err("File absent on both sides".into());}
 let identical=before["exists"]==after["exists"]&&before["oid"]==after["oid"];
 Ok(json!({"file":file,"leftLabel":left,"rightLabel":right,"before":before,"after":after,"identical":identical}))
}
pub fn compare(root:&Path,file:&str,staged:bool,commit:Option<&str>)->Result<Value,String>{
 safe_path(root,file)?;
 if let Some(sha)=commit{let sha=crate::commit_workflows::resolve(root,sha)?;let parent=text(root,&["rev-parse",&format!("{sha}^")]).ok();let old=old_path(root,file,parent.as_deref(),&sha,false)?;return response(file,"Parent commit","Selected commit",parent.map(|r|blob(root,&r,&old)).transpose()?.unwrap_or_else(absent),blob(root,&sha,file)?);}
 if staged{let old=old_path(root,file,Some("HEAD"),"",true)?;response(file,"HEAD","Staging area",blob(root,"HEAD",&old)?,blob(root,"",file)?)}else{response(file,"Staging area","Working tree",blob(root,"",file)?,working(root,file)?)}
}
