#[path="../git.rs"] mod git;
#[path="../advanced.rs"] mod advanced;
#[path="../hunks.rs"] mod hunks;
#[path="../repository.rs"] mod repository;
#[path="../conflicts.rs"] mod conflicts;
#[path="../comparison.rs"] mod comparison;
#[path="../file_inspection.rs"] mod file_inspection;
#[path="../toolbox.rs"] mod toolbox;
#[path="../provider.rs"] mod provider;
#[path="../provider_process.rs"] mod provider_process;
#[path="../workspace.rs"] mod workspace;
#[path="../commit_workflows.rs"] mod commit_workflows;
#[path="../revision_review.rs"] mod revision_review;
#[path="../rebase_workflows.rs"] mod rebase_workflows;
#[path="../git_runtime.rs"] mod git_runtime;
use serde_json::{json,Value};
fn main(){
 let input:Vec<String>=std::env::args().collect();
 if input.get(1).is_some_and(|mode|mode=="--arclane-rebase-editor"||mode=="--arclane-message-editor"){
   let mode=&input[1];let path=input.get(2).map(String::as_str).unwrap_or("");
   if let Err(e)=rebase_workflows::edit_helper(mode,path){eprintln!("{e}");std::process::exit(1);}
   return;
 }
 let run=||->Result<Value,String>{
   if input.len()<3{return Err("arclane-cli <inspect|history|diff|action> <repo> [JSON]".into());}
   let opts:Value=if input.len()>3{serde_json::from_str(&input[3]).map_err(|e|e.to_string())?}else{json!({})};
   let field=|k:&str|opts.get(k).and_then(|x|x.as_str());
   match input[1].as_str(){
    "inspect"=>git::inspect(&input[2]),
    "workspace"=>serde_json::to_value(workspace::load()?).map_err(|e|e.to_string()),
    "save_workspace"=>serde_json::to_value(workspace::save(serde_json::from_value(opts).map_err(|e|e.to_string())?)?).map_err(|e|e.to_string()),
    "rebase_preview"=>rebase_workflows::preview(&git::root(&input[2])?,field("base").ok_or("Missing base")?),
     "inspect_stash"=>advanced::inspect_stash(&git::root(&input[2])?,field("id").ok_or("Missing stash selector")?),
    "commit_context"=>{let root=git::root(&input[2])?;match field("sha"){Some(s)=>commit_workflows::details(&root,s),None=>commit_workflows::defaults(&root)}},
    "review_revisions"=>revision_review::view(&git::root(&input[2])?,field("from"),field("to").ok_or("Missing target")?,field("file")),
    "history"=>git::history(&input[2],opts["limit"].as_u64().unwrap_or(150) as usize,field("reference"),opts["skip"].as_u64().unwrap_or(0) as usize),
    "diff"=>git::diff(&input[2],field("file").unwrap_or(""),opts["staged"]==true,field("commit")),
    "hunks"=>hunks::list(&git::root(&input[2])?,field("file").ok_or("Missing file")?,opts["staged"]==true),
    "apply_hunk"=>{let root=git::root(&input[2])?;git::with_write_guard(&root,||hunks::apply(&root,field("file").ok_or("Missing file")?,opts["staged"]==true,opts["index"].as_u64().ok_or("Missing index")? as usize))},
    "action"=>git::action_with_request(&input[2],field("op").ok_or("Missing action op")?,field("file"),field("input"),field("requestId")),
    "cancel_git"=>{let repo=git::root(&input[2])?;Ok(json!({"cancelled":git_runtime::cancel(&repo,field("requestId").ok_or("Missing request ID")?)?}))},
    "collab"=>provider::query(&git::root(&input[2])?,field("kind").ok_or("Missing kind")?,field("id")),
    "collab_action"=>provider::mutate(&git::root(&input[2])?,field("operation").ok_or("Missing op")?,field("target").unwrap_or(""),&opts["detail"]),
    "tools"=>toolbox::inspect(&git::root(&input[2])?,field("section").ok_or("Missing section")?),
    "tool_action"=>{let root=git::root(&input[2])?;git::with_write_guard(&root,||toolbox::perform(&root,field("op").ok_or("Missing op")?,field("file").unwrap_or(""),field("input").unwrap_or("")))},
    "file_history"=>file_inspection::history(&git::root(&input[2])?,field("file").ok_or("Missing file")?),
    "file_blame"=>file_inspection::blame(&git::root(&input[2])?,field("file").ok_or("Missing file")?),
    "compare"=>comparison::compare(&git::root(&input[2])?,field("file").ok_or("Missing file")?,opts["staged"]==true,field("commit")),
    "conflicts"=>conflicts::list(&git::root(&input[2])?),
    "inspect_conflict"=>conflicts::inspect(&git::root(&input[2])?,field("file").ok_or("Missing file")?),
    "resolve_conflict"=>{let root=git::root(&input[2])?;git::with_write_guard(&root,||conflicts::resolve(&root,field("file").ok_or("Missing file")?,field("choice").ok_or("Missing choice")?,field("manual")))},
    "init"=>repository::initialize(&input[2]),
    "clone"=>repository::clone(&input[2],field("parent").ok_or("Missing parent")?),
    "github"=>git::github(&input[2],field("kind").unwrap_or("prs")),
    _=>Err("Unknown command".into())
   }
 };
 match run(){Ok(v)=>println!("{}",json!({"ok":true,"result":v})),Err(e)=>{eprintln!("{}",json!({"ok":false,"error":e}));std::process::exit(1);}}
}
