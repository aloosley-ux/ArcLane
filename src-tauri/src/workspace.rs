//! Local repository tab state, separate from the recent-repository list.
use serde::{Deserialize,Serialize};
use std::sync::Mutex;
static WRITE_LOCK:Mutex<()>=Mutex::new(());
#[derive(Clone,Default,Deserialize,Serialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct Tab{pub path:String,#[serde(default)] pub alias:String,#[serde(default)] pub common_dir:String}
#[derive(Clone,Default,Deserialize,Serialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct Workspace{pub tabs:Vec<Tab>,pub active:Option<String>,#[serde(default)] pub closed:Vec<Tab>,#[serde(default)] pub favourites:Vec<String>}
fn normalize_favourites(paths:Vec<String>,strict:bool)->Result<Vec<String>,String>{
 if paths.len()>30 {return Err("A workspace supports up to 30 favourite repositories".into());}
 let mut result:Vec<String>=vec![];
 for path in paths{
  let root=match crate::git::root(&path){Ok(p)=>p,Err(e)=>{if strict{return Err(e)}else{continue}}};
  let normalized=root.to_string_lossy().to_string();
  if !result.iter().any(|saved|saved.eq_ignore_ascii_case(&normalized)){result.push(normalized);}
 }
 Ok(result)
}
fn normalize(tabs:Vec<Tab>,strict:bool)->Result<Vec<Tab>,String>{
 if tabs.len()>30{return Err("A workspace supports up to 30 repository tabs".into());}
 let mut result:Vec<Tab>=vec![];
 for tab in tabs{
  if tab.alias.len()>160||tab.alias.contains(['\r','\n','\0']){return Err("Tab alias must be at most 160 bytes without line breaks".into());}
  let root=match crate::git::root(&tab.path){Ok(p)=>p,Err(e)=>{if strict{return Err(e)}else{continue}}};
  let path=root.to_string_lossy().to_string();
  if !result.iter().any(|t|t.path.eq_ignore_ascii_case(&path)){
   let common_dir=match crate::git::common_dir(&root){Ok(p)=>p.to_string_lossy().replace('\\',"/"),Err(e)=>{if strict{return Err(e)}else{continue}}};
   result.push(Tab{path,alias:tab.alias.trim().to_string(),common_dir});
  }
 }
 Ok(result)
}
pub fn load()->Result<Workspace,String>{
 let file=crate::git::settings_path().with_file_name("workspace.json");
 let state:Workspace=if file.exists(){serde_json::from_str(&std::fs::read_to_string(file).map_err(|e|e.to_string())?).map_err(|e|format!("Cannot read workspace: {e}"))?}
  else{let tabs=crate::git::get_repos()?.into_iter().take(5).map(|path|Tab{path,alias:String::new(),common_dir:String::new()}).collect();Workspace{tabs,..Default::default()}};
 let migrate_group_ids=state.tabs.iter().chain(state.closed.iter()).any(|tab|tab.common_dir.is_empty());
 let tabs=normalize(state.tabs,false)?;let closed=normalize(state.closed,false)?;let favourites=normalize_favourites(state.favourites,false)?;
 let active=state.active.and_then(|p|crate::git::root(&p).ok()).map(|p|p.to_string_lossy().to_string())
  .filter(|p|tabs.iter().any(|t|t.path.eq_ignore_ascii_case(p))).or_else(||tabs.first().map(|t|t.path.clone()));
 let loaded=Workspace{tabs,active,closed,favourites};
 if migrate_group_ids{save(loaded)}else{Ok(loaded)}
}
pub fn save(state:Workspace)->Result<Workspace,String>{
 let tabs=normalize(state.tabs,true)?;let closed=normalize(state.closed.into_iter().take(30).collect(),false)?;let favourites=normalize_favourites(state.favourites,true)?;
 let active=state.active.map(|p|crate::git::root(&p).map(|p|p.to_string_lossy().to_string())).transpose()?;
 if active.as_ref().is_some_and(|p|!tabs.iter().any(|t|t.path.eq_ignore_ascii_case(p))){return Err("Active repository must be an open tab".into());}
 let state=Workspace{tabs,active,closed,favourites};
 let _guard=WRITE_LOCK.lock().map_err(|_|"Workspace state unavailable")?;
 let file=crate::git::settings_path().with_file_name("workspace.json");std::fs::create_dir_all(file.parent().unwrap()).map_err(|e|e.to_string())?;
 let temporary=file.with_extension("tmp");std::fs::write(&temporary,serde_json::to_vec_pretty(&state).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
 std::fs::rename(&temporary,&file).map_err(|e|format!("Cannot save workspace: {e}"))?;
 Ok(state)
}
