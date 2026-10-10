//! Guarded interactive rebase using Git's own sequencer and ArcLane as its editors.
//! The plan remains in the worktree-specific Git directory during conflict recovery.
use serde_json::{json,Value};
use std::{fs,path::{Path,PathBuf},process::{Command,Stdio}};
#[cfg(windows)] use std::os::windows::process::CommandExt;

const PLAN_FILE:&str="arclane-rebase-plan.json";

fn run(path:&Path,command:&[&str],plan:Option<&Path>)->Result<String,String>{
    let mut child=Command::new("git");
    child.arg("-C").arg(path).args(command)
        .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped())
        .env("GIT_TERMINAL_PROMPT","0").env("GCM_INTERACTIVE","never")
        .env("GIT_OPTIONAL_LOCKS","0");
    if let Some(plan)=plan{
        let exe=std::env::current_exe().map_err(|e|format!("Cannot locate ArcLane executable: {e}"))?;
        // Git's editor syntax is a shell command. Only our executable path is
        // interpolated; quote apostrophes so arbitrary Windows profile paths are safe.
        let quoted=format!("'{}'",exe.to_string_lossy().replace('\\',"/").replace('\'',"'\"'\"'"));
        child.env("GIT_SEQUENCE_EDITOR",format!("{quoted} --arclane-rebase-editor"))
            .env("GIT_EDITOR",format!("{quoted} --arclane-message-editor"))
            .env("ARCLANE_REBASE_PLAN_PATH",plan);
    }else{
        child.env("GIT_EDITOR","true");
    }
    #[cfg(windows)]child.creation_flags(0x08000000);
    let result=child.output().map_err(|e|format!("Unable to run Git rebase: {e}"))?;
    let output=String::from_utf8_lossy(&result.stdout).trim().to_string();
    if result.status.success(){Ok(output)}
    else{
        let error=String::from_utf8_lossy(&result.stderr).trim().to_string();
        Err(if error.is_empty(){format!("Git rebase failed: {}",result.status)}else{error})
    }
}
fn state_dir(path:&Path)->Result<PathBuf,String>{
    let folder=PathBuf::from(run(path,&["rev-parse","--absolute-git-dir"],None)?);
    folder.canonicalize().map_err(|e|format!("Cannot locate worktree Git metadata: {e}"))
}
fn plan_path(path:&Path)->Result<PathBuf,String>{Ok(state_dir(path)?.join(PLAN_FILE))}
fn commit(path:&Path,sha:&str)->Result<String,String>{
    if sha.len()<7||sha.len()>64||!sha.chars().all(|c|c.is_ascii_hexdigit()){
        return Err("Commit reference must be 7–64 hexadecimal characters".into());
    }
    run(path,&["rev-parse","--verify",&format!("{sha}^{{commit}}")],None)
        .map_err(|_|"Commit reference was not found".into())
}
fn rebase_active(folder:&Path)->bool{
    folder.join("rebase-merge").exists()||folder.join("rebase-apply").exists()
}
pub fn preview(path:&Path,base:&str)->Result<Value,String>{
    let base=commit(path,base)?;
    let head=run(path,&["rev-parse","HEAD"],None)?;
    run(path,&["merge-base","--is-ancestor",&base,&head],None)
        .map_err(|_|"Base must be an ancestor of the current HEAD".to_string())?;
    let range=format!("{base}..HEAD");
    let all=run(path,&["rev-list","--reverse",&range],None)?;
    let linear=run(path,&["rev-list","--reverse","--first-parent",&range],None)?;
    if all!=linear{return Err("Interactive rebase currently requires a linear, merge-free commit range".into());}
    let commits:Vec<&str>=all.lines().filter(|line|!line.is_empty()).collect();
    if commits.is_empty()||commits.len()>32 {
        return Err("Choose a base with between 1 and 32 local commits to replay".into());
    }
    let mut records=vec![];
    for sha in commits {
        if run(path,&["rev-list","--parents","-n","1",sha],None)?.split_whitespace().count()!=2{
            return Err("Interactive rebase of merge/root commits is not supported".into());
        }
        let subject=run(path,&["show","-s","--format=%s",sha],None)?;
        records.push(json!({"sha":sha,"subject":subject}));
    }
    let branch=run(path,&["symbolic-ref","-q","--short","HEAD"],None)
        .map_err(|_|"Switch to a local branch before interactive rebase".to_string())?;
    Ok(json!({"base":base,"head":head,"branch":branch,"commits":records}))
}
pub fn execute(path:&Path,input:&str)->Result<Value,String>{
    let payload:Value=serde_json::from_str(input).map_err(|_|"Invalid interactive rebase plan JSON".to_string())?;
    let base=payload["base"].as_str().ok_or("Missing base commit")?;
    let expected=payload["expectedHead"].as_str().ok_or("Missing expected HEAD")?;
    let reviewed=preview(path,base)?;
    if reviewed["head"].as_str()!=Some(expected){
        return Err("HEAD moved since opening the rebase plan. Review it again.".into());
    }
    if crate::advanced::sequencer_status(path)["active"]==true{
        return Err("Continue or abort the existing Git operation first".into());
    }
    if !run(path,&["status","--porcelain","--untracked-files=normal"],None)?.is_empty(){
        return Err("Commit or stash changes before interactive rebase".into());
    }
    let original=reviewed["commits"].as_array().ok_or("Cannot read commits")?;
    let steps=payload["steps"].as_array().ok_or("Missing ordered steps")?;
    if steps.len()!=original.len(){return Err("Every commit in the range must appear exactly once".into());}
    let mut expected_set=std::collections::HashSet::new();
    for row in original{expected_set.insert(row["sha"].as_str().ok_or("Invalid source revision")?.to_string());}
    let mut seen=std::collections::HashSet::new();
    let mut has_commit=false;
    let mut valid=vec![];
    for entry in steps{
        let sha=entry["sha"].as_str().ok_or("Missing step commit SHA")?;
        if !expected_set.contains(sha)||!seen.insert(sha.to_string()){
            return Err("Plan contains an unknown or repeated commit".into());
        }
        let action=entry["action"].as_str().ok_or("Missing rebase action")?;
        if !["pick","reword","squash","drop"].contains(&action){
            return Err("Unsupported interactive rebase action".into());
        }
        if action=="squash"&&!has_commit{return Err("Squash must follow an earlier retained commit".into());}
        let message=entry["message"].as_str().unwrap_or("");
        if ["reword","squash"].contains(&action)&&(message.trim().is_empty()||message.len()>10000){
            return Err("Reword and squash require a message (max 10KB)".into());
        }
        if action!="drop"{has_commit=true;}
        valid.push(json!({"sha":sha,"action":action,"message":message}));
    }
    if !has_commit{return Err("The plan cannot drop every commit. Use a guarded reset for that.".into());}
    let file=plan_path(path)?;
    if file.exists(){return Err("ArcLane already has a rebase plan in this worktree. Complete or abort it first.".into());}
    let plan=json!({"base":reviewed["base"],"head":expected,"branch":reviewed["branch"],"steps":valid});
    fs::write(&file,serde_json::to_vec(&plan).map_err(|e|e.to_string())?)
        .map_err(|e|format!("Unable to save recoverable rebase plan: {e}"))?;
    let base=reviewed["base"].as_str().ok_or("Invalid base")?;
    let outcome=run(path,&["rebase","--interactive","--no-autosquash",base],Some(&file));
    let active=rebase_active(&state_dir(path)?);
    if !active{let _=fs::remove_file(&file);}
    match outcome{
        Ok(output)=>Ok(json!({"ok":true,"command":"git rebase --interactive","output":output})),
        Err(error)=>Err(if active{format!("Interactive rebase paused: {error}. Resolve conflicts and use Continue or Abort; ArcLane retained the plan for recovery.")}
            else{format!("Interactive rebase failed without an active sequencer: {error}")})
    }
}
pub fn resume(path:&Path,abort:bool)->Result<Value,String>{
    let file=plan_path(path)?;
    let state=state_dir(path)?;
    if !rebase_active(&state){return Err("No rebase is in progress".into());}
    let outcome=run(path,if abort{&["rebase","--abort"]}else{&["rebase","--continue"]},
        if !abort&&file.exists(){Some(file.as_path())}else{None});
    if outcome.is_ok()&&!rebase_active(&state){
        if file.exists(){fs::remove_file(&file).map_err(|e|format!("Rebase finished but plan cleanup failed: {e}"))?;}
    }
    let output=outcome?;
    Ok(json!({"ok":true,"command":if abort{"git rebase --abort"}else{"git rebase --continue"},"output":output}))
}
/// Invoked as a short-lived child process by Git, before starting the Tauri UI.
pub fn edit_helper(mode:&str,filename:&str)->Result<(),String>{
    let file=std::env::var_os("ARCLANE_REBASE_PLAN_PATH")
        .ok_or("ArcLane rebase plan environment is missing")?;
    let path=PathBuf::from(file);
    let plan:Value=serde_json::from_slice(&fs::read(&path).map_err(|e|e.to_string())?)
        .map_err(|e|format!("Rebase plan is invalid: {e}"))?;
    let steps=plan["steps"].as_array().ok_or("Invalid rebase steps")?;
    if mode=="--arclane-rebase-editor"{
        let mut todo=String::new();
        for step in steps {
            let action=step["action"].as_str().ok_or("Invalid rebase action")?;
            let sha=step["sha"].as_str().ok_or("Invalid rebase SHA")?;
            if !["pick","reword","squash","drop"].contains(&action)||sha.len()!=40||
                !sha.chars().all(|c|c.is_ascii_hexdigit()){return Err("Unsafe rebase todo".into());}
            todo.push_str(&format!("{action} {sha} ArcLane commit\n"));
        }
        fs::write(filename,todo).map_err(|e|format!("Unable to write Git rebase todo: {e}"))?;
    }else if mode=="--arclane-message-editor"{
        let done=path.parent().ok_or("Invalid worktree metadata")?
            .join("rebase-merge").join("done");
        let text=fs::read_to_string(done).map_err(|e|format!("Cannot inspect current rebase step: {e}"))?;
        let last=text.lines().rev().find(|l|!l.is_empty()&&!l.starts_with('#'))
            .ok_or("No completed rebase instruction found")?;
        let sha=last.split_whitespace().nth(1).ok_or("Cannot identify rebase commit")?;
        let step=steps.iter().find(|s|s["sha"].as_str().is_some_and(|v|v==sha))
            .ok_or("Rebase instruction is not in the approved plan")?;
        let message=step["message"].as_str().ok_or("Expected reword/squash message")?;
        if message.trim().is_empty(){return Err("Approved commit message is empty".into());}
        fs::write(filename,format!("{message}\n"))
            .map_err(|e|format!("Unable to edit Git commit message: {e}"))?;
    }else{return Err("Unknown ArcLane editor mode".into());}
    Ok(())
}
