//! Arclane's explicitly allowlisted advanced Git workflows.
 //! Never interpolates input into a shell; Git receives independent argv items.
 use serde_json::{json,Value};
 use std::{path::{Path,PathBuf},process::{Command,Stdio}};
 #[cfg(windows)]
 use std::os::windows::process::CommandExt;

 fn git(path:&Path,args:&[String])->Result<String,String>{
    let mut cmd=Command::new("git");
    if args.iter().any(|arg|arg=="--") { cmd.arg("--literal-pathspecs"); }
    cmd.arg("-C").arg(path).arg("-c").arg("core.quotepath=false")
       .args(args).stdin(Stdio::null()).env("GIT_TERMINAL_PROMPT","0").env("GCM_INTERACTIVE","never")
       .env("GIT_OPTIONAL_LOCKS","0").stdout(Stdio::piped()).stderr(Stdio::piped());
    cmd.env("GIT_EDITOR","true");
    #[cfg(windows)] cmd.creation_flags(0x08000000);
    let output=crate::git_runtime::output(cmd).map_err(|e|format!("Unable to launch Git: {e}"))?;
    if output.status.success(){Ok(String::from_utf8_lossy(&output.stdout).trim().into())}
    else{
        let error=String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if error.is_empty(){format!("Git failed with {}",output.status)}else{error})
    }
 }
 fn args(parts:&[&str])->Vec<String>{parts.iter().map(|p|p.to_string()).collect()}
 fn valid_branch(s:&str)->Result<(),String>{
    if s.is_empty()||s.starts_with('-')||s.len()>250||s.contains('\0'){return Err("Invalid Git branch".into());}
    Ok(())
 }
 fn existing_branch(path:&Path,s:&str)->Result<(),String>{
    valid_branch(s)?;
    if git(path,&args(&["show-ref","--verify","--quiet",&format!("refs/heads/{s}")])).is_err(){
        return Err("Choose an existing local branch".into());
    }
    Ok(())
 }
 fn valid_tag(path:&Path,s:&str)->Result<(),String>{
    if s.is_empty()||s.starts_with('-')||s.len()>250{return Err("Invalid Git tag name".into());}
    git(path,&args(&["check-ref-format",&format!("refs/tags/{s}")])).map(|_|())
 }
 fn existing_tag(path:&Path,s:&str)->Result<(),String>{
    valid_tag(path,s)?;
    git(path,&args(&["show-ref","--verify","--quiet",&format!("refs/tags/{s}")])).map(|_|())
        .map_err(|_|"Tag does not exist".into())
 }
 fn valid_commit(path:&Path,s:&str)->Result<(),String>{
    if s.len()<7||s.len()>64||!s.chars().all(|c|c.is_ascii_hexdigit()){return Err("Expected a commit hash (7–64 hex characters)".into());}
    git(path,&args(&["cat-file","-e",&format!("{s}^{{commit}}")])).map(|_|())
        .map_err(|_|"Commit does not exist in this repository".into())
 }
 fn stash_selector(s:&str)->Result<(),String>{
    let n=s.strip_prefix("stash@{").and_then(|v|v.strip_suffix('}'));
    if !n.is_some_and(|v|!v.is_empty()&&v.len()<9&&v.chars().all(|c|c.is_ascii_digit())) {
        return Err("Invalid stash selector".into());
    }
    Ok(())
 }
 fn worktree(path:&Path,target:&str)->Result<PathBuf,String>{
    if target.trim().is_empty(){return Err("Worktree path is required".into());}
    let selection=PathBuf::from(target);
    if !selection.is_absolute(){return Err("Worktree path must be absolute".into());}
    let normalized=selection.canonicalize().map_err(|_|"Worktree folder does not exist".to_string())?;
    let registered=git(path,&args(&["worktree","list","--porcelain"]))?.replace("\r\n","\n");
    let main=registered.lines().find_map(|line|line.strip_prefix("worktree "))
        .and_then(|p|PathBuf::from(p).canonicalize().ok())
        .ok_or_else(||"Cannot identify the primary worktree".to_string())?;
    if normalized==main{return Err("Refusing to modify the main worktree".into());}
    // Exact worktree path from 'git worktree list' rather than prefix or substring matching.
    let listed=registered.lines().filter_map(|line|line.strip_prefix("worktree "))
        .filter_map(|p|PathBuf::from(p).canonicalize().ok())
        .any(|p|p==normalized);
    if !listed{return Err("Folder is not a registered Git worktree".into());}
    Ok(normalized)
 }
 fn primary_worktree(path:&Path)->Result<PathBuf,String>{
    let listed=git(path,&args(&["worktree","list","--porcelain"]))?.replace("\r\n","\n");
    listed.lines().find_map(|line|line.strip_prefix("worktree "))
        .map(PathBuf::from).filter(|p|p.is_dir())
        .ok_or_else(||"Cannot identify the primary worktree".to_string())
 }
 fn repo_state_path(path:&Path,name:&str)->Result<PathBuf,String>{
    let s=git(path,&args(&["rev-parse","--git-path",name]))?;
    let p=PathBuf::from(s);
    Ok(if p.is_absolute(){p}else{path.join(p)})
 }
 fn require_in_progress(path:&Path,name:&str,alternate:Option<&str>)->Result<(),String>{
    let a=repo_state_path(path,name)?.exists();
    let b=alternate.and_then(|s|repo_state_path(path,s).ok()).is_some_and(|p|p.exists());
    if !a&&!b {return Err("No matching Git operation is in progress".into());}
    Ok(())
 }
 pub fn execute(path:&Path,op:&str,file:&str,input:&str)->Result<Value,String>{
    let val=input.trim();
    let mut execution_path=path.to_path_buf();
    let command:Vec<String>=match op{
       "branch_delete"=>{existing_branch(path,val)?;args(&["branch","-d",val])},
       "branch_from_commit"=>{valid_commit(path,file)?;valid_branch(val)?;git(path,&args(&["check-ref-format","--branch",val]))?;args(&["switch","-c",val,file])},
       "branch_track_remote"=>{
          valid_branch(val)?;git(path,&args(&["check-ref-format","--branch",val]))?;
          if !file.starts_with("refs/remotes/")||file.ends_with("/HEAD"){return Err("Choose a remote-tracking branch".into());}
          git(path,&args(&["show-ref","--verify",file]))?;args(&["switch","-c",val,"--track",file])
       },
       "branch_rename"=>{existing_branch(path,file)?;valid_branch(val)?;
          git(path,&args(&["check-ref-format","--branch",val]))?;
          args(&["branch","-m",file,val])
       },
       "tag_create"=>{valid_tag(path,val)?;args(&["tag",val])},
       "tag_delete"=>{existing_tag(path,val)?;args(&["tag","-d",val])},
       "merge"=>{existing_branch(path,val)?;args(&["merge","--no-edit",val])},
       "merge_abort"=>{require_in_progress(path,"MERGE_HEAD",None)?;args(&["merge","--abort"])},
       "merge_continue"=>{require_in_progress(path,"MERGE_HEAD",None)?;args(&["commit","--no-edit"])},
       "rebase"=>{existing_branch(path,val)?;args(&["rebase",val])},
       "rebase_abort"=>{require_in_progress(path,"rebase-merge",Some("rebase-apply"))?;args(&["rebase","--abort"])},
       "rebase_continue"=>{require_in_progress(path,"rebase-merge",Some("rebase-apply"))?;args(&["rebase","--continue"])},
       "rebase_skip"=>{require_in_progress(path,"rebase-merge",Some("rebase-apply"))?;args(&["rebase","--skip"])},
       "cherry_pick"=>{valid_commit(path,val)?;args(&["cherry-pick",val])},
       "cherry_pick_series"=>{
          // Full-series validation happens before Git can modify the index or HEAD.
          // Ordered JSON, rather than shell-parsed input, keeps hashes unambiguous.
          let plan:Value=serde_json::from_str(val).map_err(|_|"Invalid cherry-pick plan JSON".to_string())?;
          let expected=plan["expectedHead"].as_str().ok_or("Expected starting HEAD is required")?;
          valid_commit(path,expected)?;
          if git(path,&args(&["rev-parse","HEAD"]))?!=git(path,&args(&["rev-parse",expected]))?{
              return Err("HEAD changed since opening the sequence. Reopen and review before retrying.".into());
          }
          if git(path,&args(&["symbolic-ref","-q","--short","HEAD"])).is_err(){
              return Err("Switch to a local branch before cherry-picking a series".into());
          }
          if sequencer_status(path)["active"]==true {
              return Err("Continue or abort the current Git operation first".into());
          }
          if !git(path,&args(&["status","--porcelain","--untracked-files=normal"]))?.is_empty(){
              return Err("Commit or stash changes before starting a cherry-pick series".into());
          }
          let commits=plan["commits"].as_array().ok_or("A commit array is required")?;
          if commits.is_empty()||commits.len()>32 {return Err("Select between 1 and 32 commits".into());}
          let mut seen=std::collections::HashSet::new();
          let mut command=args(&["cherry-pick","--no-edit"]);
          for item in commits {
              let sha=item.as_str().ok_or("Each entry must be a commit SHA")?;
              valid_commit(path,sha)?;
              let full=git(path,&args(&["rev-parse",sha]))?;
              if !seen.insert(full.clone()){return Err("Duplicate commits in sequence".into());}
              let parents=git(path,&args(&["rev-list","--parents","-n","1",&full]))?;
              if parents.split_whitespace().count()>2 {
                  return Err("Merge commits require mainline selection and are not supported in multi-pick".into());
              }
              command.push(full);
          }
          command
       },
       "cherry_pick_abort"=>{require_in_progress(path,"CHERRY_PICK_HEAD",Some("sequencer"))?;args(&["cherry-pick","--abort"])},
       "cherry_pick_continue"=>{require_in_progress(path,"CHERRY_PICK_HEAD",Some("sequencer"))?;args(&["cherry-pick","--continue"])},
       "revert"=>{valid_commit(path,val)?;args(&["revert","--no-edit",val])},
       "revert_abort"=>{require_in_progress(path,"REVERT_HEAD",Some("sequencer"))?;args(&["revert","--abort"])},
       "revert_continue"=>{require_in_progress(path,"REVERT_HEAD",Some("sequencer"))?;args(&["revert","--continue"])},
       "stash_apply"=>{stash_selector(val)?;args(&["stash","apply",val])},
       "stash_apply_selected"|"stash_pop_selected"|"stash_apply_index"|"stash_pop_index"|"stash_drop_selected"=>{
          stash_selector(val)?;valid_commit(path,file)?;
          if git(path,&args(&["rev-parse","--verify",val]))?!=git(path,&args(&["rev-parse","--verify",file]))? {
              return Err("Stash list changed. Reopen the stash before applying or dropping it.".into());
          }
          let action=if op=="stash_drop_selected"{"drop"}else if op.starts_with("stash_pop"){"pop"}else{"apply"};
          let mut command=args(&["stash",action]);if op.ends_with("_index"){command.push("--index".into());}command.push(val.into());command
       },
       "stash_drop"=>{stash_selector(val)?;args(&["stash","drop",val])},
       "worktree_remove"=>{let w=worktree(path,file)?;execution_path=primary_worktree(path)?;args(&["worktree","remove",w.to_string_lossy().as_ref()])},
       "worktree_lock"=>{let w=worktree(path,file)?;args(&["worktree","lock",w.to_string_lossy().as_ref()])},
       "worktree_unlock"=>{let w=worktree(path,file)?;args(&["worktree","unlock",w.to_string_lossy().as_ref()])},
       "worktree_prune"=>args(&["worktree","prune"]),
       "submodule_update"=>args(&["submodule","update","--init","--recursive"]),
       "submodule_status"=>args(&["submodule","status"]),
       "lfs_status"=>args(&["lfs","status"]),
       "reset_soft"|"reset_mixed"=>{
           valid_commit(path,val)?;
           args(&["reset",if op=="reset_soft"{"--soft"}else{"--mixed"},val])
       },
       "discard_file"=>{
           if file.is_empty()||file.starts_with('-')||Path::new(file).is_absolute()||
              Path::new(file).components().any(|x|matches!(x,std::path::Component::ParentDir)){
                return Err("Invalid worktree file path".into());
           }
           let tracked=git(path,&args(&["ls-files","--error-unmatch","--",file])).is_ok();
           if !tracked{return Err("File is untracked; Arclane will not delete it".into());}
           args(&["restore","--worktree","--",file])
       },
       _=>return Err("Unsupported advanced operation".into())
    };
    let result=git(&execution_path,&command)?;
    Ok(json!({"ok":true,"command":format!("git {}",command.join(" ")),"output":result}))
 }
 pub fn sequencer_status(path:&Path)->Value{
   let has=|name:&str|repo_state_path(path,name).is_ok_and(|p|p.exists());
   let merge=has("MERGE_HEAD");let rebase=has("rebase-merge")||has("rebase-apply");
   let cherry_pick=has("CHERRY_PICK_HEAD");let revert=has("REVERT_HEAD");
   json!({"merge":merge,"rebase":rebase,"cherry_pick":cherry_pick,"revert":revert,
          "active":merge||rebase||cherry_pick||revert})
 }
 pub fn inspect_stash(path:&Path,id:&str)->Result<Value,String>{
   stash_selector(id)?;
   let sha=git(path,&args(&["rev-parse","--verify",id]))?;
   let mut patch=git(path,&args(&["stash","show","--include-untracked","--no-ext-diff","--no-textconv","--no-color","--patch",id]))?;
   if patch.len()>650000 {let mut end=650000;while !patch.is_char_boundary(end){end-=1;}patch.truncate(end);patch.push_str("\n[ArcLane: stash patch truncated at 650 KB]");}
   let files=git(path,&args(&["stash","show","--include-untracked","--no-renames","--name-status","-z",id]))?;
   let mut fields=files.split('\0').filter(|s|!s.is_empty());let mut changes=vec![];
   while let Some(status)=fields.next(){if let Some(file)=fields.next(){changes.push(json!({"status":status,"path":file}));}}
   let message=git(path,&args(&["show","-s","--format=%s",&sha]))?;
   Ok(json!({"id":id,"sha":sha,"message":message,"files":changes,"patch":patch}))
 }
