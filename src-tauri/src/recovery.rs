//! Persistent exact-byte recovery. Snapshots live outside Git; never evict unrecovered data.
use crate::media::{safe_path,read_file,text,hash};
use serde::{Serialize,Deserialize};
use serde_json::{json,Value};
use std::{fs,path::{Path,PathBuf},io::Write,time::{SystemTime,UNIX_EPOCH}};
const LIMIT:u64=4_000_000;
#[derive(Serialize,Deserialize)]
struct Record{id:String,root:String,git_dir:String,file:String,head:String,index:String,refs:String,before:Option<String>,after:Option<String>,created:u64,state:String}
fn identity(root:&Path)->Result<(String,String,String,String,String),String>{
 let r=root.canonicalize().map_err(|e|e.to_string())?.to_string_lossy().into_owned();let g=text(root,&["rev-parse","--absolute-git-dir"])?;let g=Path::new(&g).canonicalize().map_err(|e|e.to_string())?.to_string_lossy().into_owned();
 Ok((r,g,text(root,&["rev-parse","HEAD"])?,hash(&index_bytes(root)?),text(root,&["show-ref"])?))
}
fn storage(root:&Path)->Result<PathBuf,String>{
 let dir=crate::git::settings_path().with_file_name("file-recovery");fs::create_dir_all(&dir).map_err(|e|format!("Recovery storage unavailable: {e}"))?;
 let real=dir.canonicalize().map_err(|e|e.to_string())?;if real.starts_with(root.canonicalize().map_err(|e|e.to_string())?){return Err("Recovery storage must be outside the repository".into());}Ok(real)
}
fn save(dir:&Path,r:&Record)->Result<(),String>{
 let data=serde_json::to_vec(r).map_err(|e|e.to_string())?;let tmp=dir.join("record.tmp");let mut f=fs::File::create(&tmp).map_err(|e|e.to_string())?;f.write_all(&data).and_then(|_|f.sync_all()).map_err(|e|e.to_string())?;drop(f);
 if fs::read(&tmp).map_err(|e|e.to_string())?!=data{return Err("Recovery record verification failed".into());}fs::rename(tmp,dir.join("record.json")).map_err(|e|e.to_string())
}
fn load(dir:&Path)->Result<Record,String>{let p=dir.join("record.json");if fs::metadata(&p).map_err(|e|e.to_string())?.len()>32000{return Err("Invalid recovery record size".into());}serde_json::from_slice(&fs::read(p).map_err(|e|e.to_string())?).map_err(|e|e.to_string())}
fn bytes_hash(b:&Option<Vec<u8>>)->Option<String>{b.as_ref().map(|b|hash(b))}
fn index_bytes(root:&Path)->Result<Vec<u8>,String>{let index=text(root,&["rev-parse","--git-path","index"])?;let p=PathBuf::from(index);let p=if p.is_absolute(){p}else{root.join(p)};if fs::metadata(&p).map_err(|e|e.to_string())?.len()>32_000_000{return Err("Index exceeds safe recovery limit".into());}fs::read(p).map_err(|e|e.to_string())}
struct PrivateIndex(PathBuf);
impl Drop for PrivateIndex{fn drop(&mut self){let _=fs::remove_file(&self.0);}}
fn private_index(store:&Path,bytes:&[u8])->Result<PrivateIndex,String>{
 let path=store.join(format!("preflight-index-{}-{}",std::process::id(),SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e|e.to_string())?.as_nanos()));
 let mut f=fs::OpenOptions::new().write(true).create_new(true).open(&path).map_err(|e|e.to_string())?;
 f.write_all(bytes).and_then(|_|f.sync_all()).map_err(|e|e.to_string())?;drop(f);
 if fs::read(&path).map_err(|e|e.to_string())?!=bytes{return Err("Private preflight index verification failed".into());}Ok(PrivateIndex(path))
}
fn validate_index(root:&Path,file:&str)->Result<(),String>{
 let mode=text(root,&["ls-files","--stage","--",file])?;let mut fields=mode.split_whitespace();let m=fields.next().unwrap_or("");fields.next();let stage=fields.next().unwrap_or("");if !matches!(m,"100644"|"100755")||stage!="0"{return Err("Discard supports tracked regular files without conflicts only; untracked/symlink targets refused".into());}
 if let Ok(meta)=fs::metadata(root.join(file)){if meta.permissions().readonly(){return Err("Read-only files are unsupported for discard and undo; clear the read-only attribute and retry".into());}}
 if crate::advanced::sequencer_status(root)["active"]==true{return Err("Finish the active Git operation before discard or undo".into());}
 let attr=text(root,&["check-attr","filter","--",file])?;if !attr.ends_with(": unspecified")&& !attr.ends_with(": unset"){return Err("Custom Git filters are unsupported for safe discard".into());}Ok(())
}
pub fn list(root:&Path)->Result<Value,String>{
 let storage=storage(root)?;let (identity,_,_,_,_)=identity(root)?;let mut records=vec![];
 for entry in fs::read_dir(storage).map_err(|e|e.to_string())?{let p=entry.map_err(|e|e.to_string())?.path();if let Ok(r)=load(&p){if r.root==identity&&r.state!="undone"{records.push(json!({"id":r.id,"file":r.file,"created":r.created,"state":r.state}));}}}records.sort_by_key(|r|std::cmp::Reverse(r["created"].as_u64().unwrap_or(0)));Ok(json!(records))
}
pub fn discard(root:&Path,file:&str)->Result<Value,String>{
 safe_path(root,file)?;validate_index(root,file)?;let before=read_file(root,file,LIMIT)?;let state=identity(root)?;let store=storage(root)?;
 // `git diff` may refresh index stat data even with optional locks disabled.
 // Run the preflight against a verified copy so a refusal is byte-for-byte read-only.
 let live_index=index_bytes(root)?;if hash(&live_index)!=state.3{return Err("Index changed before discard; refused".into());}
 let preflight=private_index(&store,&live_index)?;
 if crate::media::git_index(root,&["diff","--no-ext-diff","--no-textconv","--name-only","--",file],Some(&preflight.0))?.is_empty(){return Err("No unstaged changes remain; duplicate discard refused".into());}
 drop(preflight);
 let blob_size=text(root,&["cat-file","-s",&format!(":{file}")])?.parse::<u64>().map_err(|e|e.to_string())?;
 if blob_size>LIMIT/2{return Err("Staged source exceeds safe restore limit (2 MB, allowing CRLF expansion); discard refused".into());}
 let entries=fs::read_dir(&store).map_err(|e|e.to_string())?.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?;
 if entries.len()>=32{return Err("Recovery storage is full (32 snapshots). Export or remove old recovery folders before retrying; discard refused.".into());}
 let created=SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e|e.to_string())?.as_secs();let id=format!("{}-{}",SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos(),std::process::id());let dir=store.join(&id);fs::create_dir(&dir).map_err(|e|e.to_string())?;
 if let Some(b)=&before{let mut f=fs::OpenOptions::new().write(true).create_new(true).open(dir.join("before.bin")).map_err(|e|e.to_string())?;f.write_all(b).and_then(|_|f.sync_all()).map_err(|e|e.to_string())?;drop(f);if fs::read(dir.join("before.bin")).map_err(|e|e.to_string())?!=*b{return Err("Recovery snapshot verification failed; discard refused".into());}}
 let mut r=Record{id:id.clone(),root:state.0.clone(),git_dir:state.1.clone(),head:state.2.clone(),index:state.3.clone(),refs:state.4.clone(),file:file.into(),before:bytes_hash(&before),after:None,created,state:"prepared".into()};save(&dir,&r)?;let verified=load(&dir)?;if verified.before!=r.before{return Err("Recovery verification failed; discard refused".into());}
 if identity(root)?!=state||read_file(root,file,LIMIT)?!=before{return Err("Repository or file changed during snapshot; discard refused".into());}
 // Git restore updates stat data in its index. Use a verified private index so
 // even those incidental writes cannot alter the user's exact index bytes.
 let index=index_bytes(root)?;if hash(&index)!=state.3{return Err("Index changed before discard; refused".into());}
 let private_index=dir.join("restore-index");fs::write(&private_index,&index).map_err(|e|e.to_string())?;
 if fs::read(&private_index).map_err(|e|e.to_string())?!=index{return Err("Private index verification failed; discard refused".into());}
 if identity(root)?!=state||read_file(root,file,LIMIT)?!=before{return Err("File changed before restore; discard refused".into());}
 crate::media::git_index(root,&["restore","--worktree","--",file],Some(&private_index))?;
 fs::remove_file(&private_index).map_err(|e|e.to_string())?;
 let after=read_file(root,file,LIMIT)?;r.after=bytes_hash(&after);r.state="available".into();save(&dir,&r).map_err(|e|format!("Discard saved bytes but recovery finalization failed: {e}. Preserve recovery folder {id}."))?;
 if identity(root)?!=state{return Err("Git state changed during discard; recovery snapshot retained".into());}
 Ok(json!({"ok":true,"command":"git restore --worktree -- <file>","output":"Discarded unstaged changes; exact recovery snapshot saved","recoveryId":id}))
}
pub fn undo(root:&Path,id:&str)->Result<Value,String>{
 if id.is_empty()||!id.chars().all(|c|c.is_ascii_digit()||c=='-'){return Err("Invalid recovery ID".into());}
 let dir=storage(root)?.join(id);let mut r=load(&dir)?;if r.id!=id||r.state!="available"{return Err("Recovery is not available or was already undone".into());}
 let expected=(r.root.clone(),r.git_dir.clone(),r.head.clone(),r.index.clone(),r.refs.clone());if identity(root)?!=expected{return Err("Undo refused: checkout, HEAD, index or refs changed. Preserve your current work and review the saved recovery folder.".into());}
 safe_path(root,&r.file)?;validate_index(root,&r.file)?;let current=read_file(root,&r.file,LIMIT)?;if bytes_hash(&current)!=r.after{return Err("Undo refused: newer edits found. Preserve those edits before retrying.".into());}
 let before=if let Some(ref expected)=r.before{let b=read_file(&dir,"before.bin",LIMIT)?.ok_or("Recovery bytes missing")?;if hash(&b)!=*expected{return Err("Recovery bytes failed integrity verification; undo refused".into());}Some(b)}else{None};
 let target=root.join(&r.file);
 if let Some(b)=&before{
  let tmp=target.with_file_name(format!(".arclane-undo-{id}.tmp"));let mut f=fs::OpenOptions::new().create_new(true).write(true).open(&tmp).map_err(|e|e.to_string())?;f.write_all(b).and_then(|_|f.sync_all()).map_err(|e|e.to_string())?;drop(f);
  if fs::read(&tmp).map_err(|e|e.to_string())?!=*b{return Err("Undo temporary verification failed".into());}
  if identity(root)?!=expected||read_file(root,&r.file,LIMIT)?!=current{fs::remove_file(&tmp).map_err(|e|e.to_string())?;return Err("Undo refused: file changed during recovery".into());}safe_path(root,&r.file)?;fs::rename(&tmp,&target).map_err(|e|e.to_string())?;
 }else{if identity(root)?!=expected||read_file(root,&r.file,LIMIT)?!=current{return Err("Undo refused: file changed during recovery".into());}if target.exists(){fs::remove_file(&target).map_err(|e|e.to_string())?;}}
 if read_file(root,&r.file,LIMIT)?!=before||identity(root)?!=expected{return Err("Undo verification failed; recovery snapshot retained".into());}
 r.state="undone".into();save(&dir,&r)?;Ok(json!({"ok":true,"command":"restore exact recovery bytes","output":"Undo restored exact pre-discard bytes and existence; index and HEAD preserved"}))
}
