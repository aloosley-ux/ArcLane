#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// Arclane Windows desktop: re-embed the current frontend resources on release builds.
mod git;
mod advanced;
mod hunks;
mod terminal;
mod agents;
mod repository;
mod conflicts;
mod comparison;
mod media;
mod recovery;
mod file_inspection;
mod toolbox;
mod provider;
mod provider_process;
mod workspace;
mod commit_workflows;
mod revision_review;
mod rebase_workflows;
mod git_runtime;
use tauri::Manager;
use serde_json::Value;
use tauri::async_runtime::spawn_blocking;

#[tauri::command]
async fn load_workspace()->Result<workspace::Workspace,String>{spawn_blocking(workspace::load).await.map_err(|e|e.to_string())?}
#[tauri::command]
async fn save_workspace(state:workspace::Workspace)->Result<workspace::Workspace,String>{spawn_blocking(move||workspace::save(state)).await.map_err(|e|e.to_string())?}

#[tauri::command]
async fn commit_context(path:String,sha:Option<String>)->Result<Value,String>{
 spawn_blocking(move||{let root=git::root(&path)?;match sha {Some(s)=>commit_workflows::details(&root,&s),None=>commit_workflows::defaults(&root)}}).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn review_revisions(path:String,from:Option<String>,to:String,file:Option<String>)->Result<Value,String>{
 spawn_blocking(move||revision_review::view(&git::root(&path)?,from.as_deref(),&to,file.as_deref())).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn inspect_stash(path:String,id:String)->Result<Value,String>{
 spawn_blocking(move||advanced::inspect_stash(&git::root(&path)?,&id)).await.map_err(|e|e.to_string())?
}

#[tauri::command]
async fn rebase_preview(path:String,base:String)->Result<Value,String>{
 spawn_blocking(move||rebase_workflows::preview(&git::root(&path)?,&base)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn snapshot(path:String)->Result<Value,String>{
    spawn_blocking(move||git::inspect(&path)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn ignored_files(path:String,scope:Option<String>,offset:Option<usize>,limit:Option<usize>)->Result<Value,String>{
    spawn_blocking(move||git::ignored_files(&path,scope.as_deref(),offset.unwrap_or(0),limit.unwrap_or(100))).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn commits(path:String,limit:usize,reference:Option<String>,skip:Option<usize>)->Result<Value,String>{
    spawn_blocking(move||git::history(&path,limit,reference.as_deref(),skip.unwrap_or(0))).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn collaboration_query(path:String,kind:String,id:Option<String>,request_id:Option<String>)->Result<Value,String>{
 spawn_blocking(move||provider::query_request(&git::root(&path)?,&kind,id.as_deref(),request_id.as_deref())).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn cancel_provider_read(path:String,request_id:String)->Result<bool,String>{
 spawn_blocking(move||provider_process::cancel(&git::root(&path)?,&request_id)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn collaboration_action(path:String,operation:String,target:String,detail:Value)->Result<Value,String>{
 spawn_blocking(move||provider::mutate(&git::root(&path)?,&operation,&target,&detail)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn toolbox_view(path:String,section:String)->Result<Value,String>{
 spawn_blocking(move||toolbox::inspect(&git::root(&path)?,&section)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn toolbox_action(path:String,op:String,file:String,input:String)->Result<Value,String>{
 spawn_blocking(move||{let root=git::root(&path)?;git::with_write_guard(&root,||toolbox::perform(&root,&op,&file,&input))}).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn inspect_file_history(path:String,file:String)->Result<Value,String>{
 spawn_blocking(move||file_inspection::history(&git::root(&path)?,&file)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn inspect_file_blame(path:String,file:String)->Result<Value,String>{
 spawn_blocking(move||file_inspection::blame(&git::root(&path)?,&file)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn compare_file(path:String,file:String,staged:bool,commit:Option<String>)->Result<Value,String>{
 spawn_blocking(move||comparison::compare(&git::root(&path)?,&file,staged,commit.as_deref())).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn compare_media(path:String,file:String,staged:bool,commit:Option<String>)->Result<Value,String>{
 spawn_blocking(move||media::compare(&git::root(&path)?,&file,staged,commit.as_deref())).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn file_recoveries(path:String)->Result<Value,String>{spawn_blocking(move||recovery::list(&git::root(&path)?)).await.map_err(|e|e.to_string())?}
#[tauri::command]
async fn list_conflicts(path:String)->Result<Value,String>{
 spawn_blocking(move||conflicts::list(&git::root(&path)?)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn inspect_conflict(path:String,file:String)->Result<Value,String>{
 spawn_blocking(move||conflicts::inspect(&git::root(&path)?,&file)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn resolve_conflict(path:String,file:String,choice:String,manual:Option<String>)->Result<Value,String>{
 spawn_blocking(move||{let root=git::root(&path)?;git::with_write_guard(&root,||conflicts::resolve(&root,&file,&choice,manual.as_deref()))}).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn get_hunks(path:String,file:String,staged:bool)->Result<Value,String>{
 spawn_blocking(move||hunks::list(&git::root(&path)?,&file,staged)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn apply_hunk(path:String,file:String,staged:bool,index:usize)->Result<Value,String>{
 spawn_blocking(move||{let root=git::root(&path)?;git::with_write_guard(&root,||hunks::apply(&root,&file,staged,index))}).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn file_diff(path:String,file:String,staged:bool,commit:Option<String>)->Result<Value,String>{
    spawn_blocking(move||git::diff(&path,&file,staged,commit.as_deref())).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn git_action(path:String,op:String,file:Option<String>,input:Option<String>,request_id:Option<String>)->Result<Value,String>{
    spawn_blocking(move||git::action_with_request(&path,&op,file.as_deref(),input.as_deref(),request_id.as_deref())).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn cancel_git_action(path:String,request_id:String)->Result<bool,String>{
    spawn_blocking(move||git_runtime::cancel(&git::root(&path)?,&request_id)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn github_query(path:String,kind:String)->Result<Value,String>{
    spawn_blocking(move||git::github(&path,&kind)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn create_repository(folder:String)->Result<Value,String>{
    spawn_blocking(move||repository::initialize(&folder)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn clone_repository(url:String,parent:String)->Result<Value,String>{
    spawn_blocking(move||repository::clone(&url,&parent)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
fn repositories()->Result<Vec<String>,String>{git::get_repos()}
#[tauri::command]
fn set_repositories(paths:Vec<String>)->Result<Vec<String>,String>{git::save_repos(paths)}
#[tauri::command]
async fn pick_repository()->Result<Option<String>,String>{
    spawn_blocking(||Ok(rfd::FileDialog::new().set_title("Open a Git repository").pick_folder().map(|p|p.to_string_lossy().into_owned())))
        .await.map_err(|e|e.to_string())?
}
#[tauri::command]
fn open_external(url:String)->Result<(),String>{
    if !url.starts_with("https://github.com/") { return Err("Only GitHub HTTPS links may be opened".into()); }
    std::process::Command::new("explorer.exe").arg(url).spawn().map_err(|e|e.to_string())?;
    Ok(())
}
#[tauri::command]
fn open_path(path:String,kind:String)->Result<(),String>{
    let repo=git::root(&path)?;
    let mut command=match kind.as_str(){
        "explorer"=>{let mut c=std::process::Command::new("explorer.exe");c.arg(repo);c},
        "terminal"=>{let mut c=std::process::Command::new("powershell.exe");c.arg("-NoExit").arg("-Command").arg("Set-Location -LiteralPath $args[0]").arg(repo);c},
        "editor"=>{let exe=[
            std::env::var("LOCALAPPDATA").unwrap_or_default()+"\\Programs\\Microsoft VS Code\\Code.exe",
            "C:\\Program Files\\Microsoft VS Code\\Code.exe".into()
        ].into_iter().find(|s|std::path::Path::new(s).is_file()).ok_or("VS Code not found")?;
        let mut c=std::process::Command::new(exe);c.arg(repo);c},
        _=>return Err("Unknown destination".into())
    };
    command.spawn().map_err(|e|e.to_string())?;
    Ok(())
}
fn main(){
    if let Some(mode)=std::env::args().nth(1){
        if mode=="--arclane-rebase-editor"||mode=="--arclane-message-editor"{
            let file=std::env::args().nth(2).unwrap_or_default();
            if let Err(error)=rebase_workflows::edit_helper(&mode,&file){
                eprintln!("{error}");std::process::exit(1);
            }
            return;
        }
    }
    tauri::Builder::default()
    .manage(terminal::TerminalManager::default())
    .on_window_event(|window,event|{if let tauri::WindowEvent::Destroyed=event {window.app_handle().state::<terminal::TerminalManager>().shutdown();}})
    .invoke_handler(tauri::generate_handler![compare_media,file_recoveries,cancel_git_action,rebase_preview,load_workspace,save_workspace,cancel_provider_read,inspect_stash,review_revisions,commit_context,snapshot,ignored_files,commits,collaboration_query,collaboration_action,toolbox_view,toolbox_action,inspect_file_history,inspect_file_blame,compare_file,list_conflicts,inspect_conflict,resolve_conflict,get_hunks,apply_hunk,file_diff,git_action,github_query,repositories,set_repositories,pick_repository,create_repository,clone_repository,open_path,open_external,agents::agent_discover,agents::agent_validate,terminal::terminal_launch,terminal::terminal_open,terminal::terminal_send,terminal::terminal_resize,terminal::terminal_close,terminal::terminal_sessions])
    .run(tauri::generate_context!()).expect("Unable to run Forge");
}
