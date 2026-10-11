use serde_json::{json, Value};
use crate::advanced;
use std::{path::{Path,PathBuf},process::{Command,Stdio},collections::HashSet,sync::{Mutex,OnceLock},io::{BufRead,Read}};
#[cfg(windows)]
use std::os::windows::process::CommandExt;

static ACTIVE_MUTATIONS: OnceLock<Mutex<HashSet<PathBuf>>> = OnceLock::new();
#[cfg(windows)]
struct ProcessWriteLease(windows_sys::Win32::Foundation::HANDLE);
#[cfg(windows)]
impl ProcessWriteLease {
    fn acquire(path:&Path)->Result<Self,String>{
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::System::Threading::{CreateMutexW,WaitForSingleObject};
        use windows_sys::Win32::Foundation::{WAIT_OBJECT_0,WAIT_ABANDONED,WAIT_TIMEOUT};
        use std::hash::Hasher;
        // Stable cross-binary name, keyed by the canonical Git common directory.
        let mut h=StableHasher(0xcbf29ce484222325);
        h.write(path.to_string_lossy().replace('\\',"/").to_lowercase().as_bytes());
        let name=format!("Local\\ArcLaneGitWrite-{:016x}",h.finish());
        let wide:Vec<u16>=std::ffi::OsStr::new(&name).encode_wide().chain(std::iter::once(0)).collect();
        unsafe{
            let handle=CreateMutexW(std::ptr::null(),0,wide.as_ptr());
            if handle.is_null(){return Err(format!("Unable to create Git writer mutex: {}",std::io::Error::last_os_error()));}
            match WaitForSingleObject(handle,0){
                WAIT_OBJECT_0|WAIT_ABANDONED=>Ok(Self(handle)),
                WAIT_TIMEOUT=>{windows_sys::Win32::Foundation::CloseHandle(handle);
                    Err("Another ArcLane process is changing this Git repository. Wait and retry.".into())},
                _=>{windows_sys::Win32::Foundation::CloseHandle(handle);
                    Err(format!("Unable to acquire Git writer mutex: {}",std::io::Error::last_os_error()))}
            }
        }
    }
}
#[cfg(windows)]
struct StableHasher(u64);
#[cfg(windows)]
impl std::hash::Hasher for StableHasher{
    fn finish(&self)->u64{self.0}
    fn write(&mut self,bytes:&[u8]){for b in bytes{self.0^=*b as u64;self.0=self.0.wrapping_mul(0x100000001b3);}}
}
#[cfg(windows)]
impl Drop for ProcessWriteLease{
    fn drop(&mut self){unsafe{
        windows_sys::Win32::System::Threading::ReleaseMutex(self.0);
        windows_sys::Win32::Foundation::CloseHandle(self.0);
    }}
}


/// One in-process writer per Git common directory, including linked worktrees.
/// A lease is released even when the Git operation fails or unwinds.
pub fn with_write_guard<T>(path:&Path, operation:impl FnOnce()->Result<T,String>)->Result<T,String>{
    let common=git(path,&["rev-parse","--git-common-dir"])?;
    let raw=PathBuf::from(common);
    let folder=if raw.is_absolute(){raw}else{path.join(raw)};
    let key=folder.canonicalize().map_err(|e|format!("Cannot identify shared Git directory: {e}"))?;
    let active=ACTIVE_MUTATIONS.get_or_init(||Mutex::new(HashSet::new()));
    {
        let mut writers=active.lock().map_err(|_|"Git operation lock is unavailable".to_string())?;
        if !writers.insert(key.clone()){
            return Err("Another Git change is running in this repository. Wait for it to finish before retrying.".into());
        }
    }
    struct Lease(PathBuf);
    impl Drop for Lease {
        fn drop(&mut self){
            if let Some(active)=ACTIVE_MUTATIONS.get(){
                if let Ok(mut writers)=active.lock(){writers.remove(&self.0);}
            }
        }
    }
    let _lease=Lease(key.clone());
    // Windows named mutexes are released by the OS on crash, unlike lock files.
    // Linked worktrees map to the same mutex; unrelated repositories do not.
    #[cfg(windows)]let _process_lease=ProcessWriteLease::acquire(&key)?;
    operation()
}

fn spawn(program: &str, args: &[String], cwd: Option<&Path>) -> Result<String,String> {
    let mut cmd = Command::new(program);
    // UI path selections follow `--`. Scope literal mode to these commands:
    // stash internally builds magic pathspecs and must retain normal Git semantics.
    if program == "git" && args.iter().any(|arg|arg=="--") { cmd.arg("--literal-pathspecs"); }
    cmd.args(args).stdin(Stdio::null()).env("GIT_TERMINAL_PROMPT","0")
        .env("GCM_INTERACTIVE","never").env("GIT_OPTIONAL_LOCKS","0");
    if let Some(p) = cwd { cmd.current_dir(p); }
    #[cfg(windows)] { cmd.creation_flags(0x08000000); }
    let out = crate::git_runtime::output(cmd).map_err(|e|format!("Could not launch {program}: {e}"))?;
    let stdout=String::from_utf8_lossy(&out.stdout).trim_end_matches(['\r','\n']).to_string();
    if out.status.success() { Ok(stdout) } else {
        let stderr=String::from_utf8_lossy(&out.stderr).trim().to_string();
        Err(if stderr.is_empty(){format!("{program} failed: {}",out.status)}else{stderr})
    }
}
fn a(list:&[&str])->Vec<String>{ list.iter().map(|x|(*x).into()).collect() }
pub fn root(path:&str)->Result<PathBuf,String>{
    let p=PathBuf::from(path);
    if !p.is_dir() { return Err("Repository folder does not exist".into()); }
    let git=spawn("git",&[a(&["-C"]),vec![p.to_string_lossy().to_string()],a(&["rev-parse","--show-toplevel"])].concat(),None)?;
    let root=PathBuf::from(git);
    if !root.is_dir(){return Err("Bare Git repositories are not supported".into());}
    Ok(root)
}
fn git(p:&Path,args:&[&str])->Result<String,String>{
    let mut aa=a(&["-C"]); aa.push(p.to_string_lossy().into_owned());
    aa.extend(a(&["-c","core.quotepath=false"]));aa.extend(a(args));
    spawn("git",&aa,None)
}
fn git_owned(p:&Path,args:Vec<String>)->Result<String,String>{
    let mut aa=a(&["-C"]); aa.push(p.to_string_lossy().into_owned());
    aa.extend(a(&["-c","core.quotepath=false"]));aa.extend(args);
    spawn("git",&aa,None)
}
fn clipped(mut s:String)->String {
    if s.len()>650_000 {let mut n=650_000;while !s.is_char_boundary(n){n-=1;}s.truncate(n);s.push_str("\n\n[Forge: output truncated at 650 KB]");}s
}
fn parse_status(p:&Path)->Result<(Vec<Value>,String),String>{
    let mut cmd=Command::new("git");
    cmd.args(["-C",&p.to_string_lossy(),"-c","core.quotepath=false","status","--porcelain=v1","-z","--branch","--untracked-files=all"])
       .stdin(Stdio::null()).env("GIT_OPTIONAL_LOCKS","0");
    #[cfg(windows)] {cmd.creation_flags(0x08000000);}
    let out=cmd.output().map_err(|e|e.to_string())?;
    if !out.status.success(){return Err(String::from_utf8_lossy(&out.stderr).into_owned());}
    let parts:Vec<&[u8]>=out.stdout.split(|b|*b==0).filter(|s|!s.is_empty()).collect();
    let mut files=vec![];let mut branch=String::new();let mut i=0;
    while i<parts.len(){
        let s=String::from_utf8_lossy(parts[i]).to_string();i+=1;
        if s.starts_with("## "){branch=s[3..].to_string();continue;}
        if s.len()<3 {continue;}
        let x=s.chars().next().unwrap_or(' ');
        let y=s.chars().nth(1).unwrap_or(' ');
        let path=s[3..].to_string();
        let renamed=x=='R'||y=='R'||x=='C'||y=='C';
        let origin=if renamed && i<parts.len(){let v=String::from_utf8_lossy(parts[i]).to_string();i+=1;Some(v)}else{None};
        let conflict = x=='U'||y=='U'||(x=='A'&&y=='A')||(x=='D'&&y=='D');
        files.push(json!({"path":path,"original":origin,"x":x.to_string(),"y":y.to_string(),"staged":x!=' '&&x!='?'&&x!='U',"unstaged":y!=' '&&y!='?'&&y!='U',"untracked":x=='?'&&y=='?', "conflict":conflict}));
    }
    Ok((files,branch))
}
const MAX_IGNORED_PAGE:usize=200;
const MAX_IGNORED_OFFSET:usize=100_000;
fn ignored_paths_page(p:&Path,args:&[String],offset:usize,limit:usize,status_rows:bool)->Result<(Vec<Value>,usize),String>{
    let mut cmd=Command::new("git");
    cmd.args(["-C",&p.to_string_lossy(),"-c","core.quotepath=false"]);
    if args.iter().any(|arg|arg=="--"){cmd.arg("--literal-pathspecs");}
    cmd.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).env("GIT_OPTIONAL_LOCKS","0");
    #[cfg(windows)] {cmd.creation_flags(0x08000000);}
    let mut child=cmd.spawn().map_err(|e|format!("Could not launch git: {e}"))?;
    let stdout=child.stdout.take().ok_or("Could not read Git output")?;
    let stderr=child.stderr.take().ok_or("Could not read Git error output")?;
    let stderr_reader=std::thread::spawn(move||{let mut stderr=stderr;let mut bytes=Vec::new();let _=stderr.read_to_end(&mut bytes);bytes});
    let mut reader=std::io::BufReader::new(stdout);
    let mut record=Vec::new();let mut total=0usize;let mut entries=Vec::new();let mut read_error=None;
    loop {
        record.clear();
        match reader.read_until(0,&mut record){
            Ok(0)=>break,
            Ok(_)=>{},
            Err(error)=>{read_error=Some(error);break;}
        }
        if record.last()==Some(&0){record.pop();}
        if status_rows {
            if record.len()>=3 && (record[0]==b'R'||record[0]==b'C'||record[1]==b'R'||record[1]==b'C'){
                let mut original=Vec::new();
                if let Err(error)=reader.read_until(0,&mut original){read_error=Some(error);break;}
            }
            if !record.starts_with(b"!! "){continue;}
            let path=&record[3..];
            let directory=path.last()==Some(&b'/');
            if total>=offset && total<offset.saturating_add(limit){
                entries.push(json!({"path":String::from_utf8_lossy(path),"directory":directory}));
            }
            total=total.saturating_add(1);
        } else {
            if record.is_empty(){continue;}
            if total>=offset && total<offset.saturating_add(limit){
                entries.push(json!({"path":String::from_utf8_lossy(&record),"directory":false}));
            }
            total=total.saturating_add(1);
        }
    }
    drop(reader);
    if read_error.is_some(){let _=child.kill();}
    let status=child.wait().map_err(|e|format!("Could not wait for Git: {e}"))?;
    let stderr=stderr_reader.join().unwrap_or_default();
    if let Some(error)=read_error{return Err(format!("Could not read Git output: {error}"));}
    if !status.success(){
        let message=String::from_utf8_lossy(&stderr).trim().to_string();
        return Err(if message.is_empty(){format!("git failed: {status}")}else{message});
    }
    Ok((entries,total))
}
pub fn ignored_files(path:&str,scope:Option<&str>,offset:usize,limit:usize)->Result<Value,String>{
    let p=root(path)?;
    if offset>MAX_IGNORED_OFFSET{return Err("Ignored path offset exceeds supported limit".into());}
    let limit=limit.clamp(1,MAX_IGNORED_PAGE);
    let status_rows=scope.is_none();
    let args=if let Some(scope)=scope{
        let clean=scope.trim_end_matches(['/', '\\']).replace('\\',"/");
        valid_file_path(&clean)?;
        if clean==".git"||clean.starts_with(".git/"){return Err("Git metadata cannot be expanded as ignored content".into());}
        let candidate=p.join(&clean);
        let metadata=std::fs::symlink_metadata(&candidate).map_err(|_|"Ignored directory is unavailable")?;
        if metadata.file_type().is_symlink()||!metadata.is_dir(){return Err("Ignored scope must be a repository directory".into());}
        let canonical_root=p.canonicalize().map_err(|e|e.to_string())?;
        let canonical_candidate=candidate.canonicalize().map_err(|e|e.to_string())?;
        if !canonical_candidate.starts_with(&canonical_root){return Err("Ignored scope escapes the repository".into());}
        vec!["ls-files".into(),"--others".into(),"--ignored".into(),"--exclude-standard".into(),"--full-name".into(),"-z".into(),"--".into(),clean]
    }else{
        // Git collapses fully ignored folders to one porcelain !! row here.
        // Expanding one is a separate user action, so large ignored trees are not
        // recursively returned as soon as the list is revealed.
        vec!["status".into(),"--porcelain=v1".into(),"-z".into(),"--ignored".into(),"--untracked-files=normal".into()]
    };
    let (entries,total)=ignored_paths_page(&p,&args,offset,limit,status_rows)?;
    let has_more=offset.saturating_add(entries.len())<total;
    Ok(json!({"entries":entries,"total":total,"offset":offset,"limit":limit,"has_more":has_more,"scope":scope}))
}
fn refs(p:&Path)->Vec<Value>{
    let s=git(p,&["for-each-ref","--sort=-committerdate","--format=%(refname)%09%(refname:short)%09%(objectname:short)%09%(HEAD)","refs/heads","refs/remotes","refs/tags"]).unwrap_or_default();
    s.lines().filter_map(|l|{let q:Vec<_>=l.split('\t').collect();if q.len()<4{return None;}
        Some(json!({"full":q[0],"name":q[1],"sha":q[2],"current":q[3]=="*","kind":if q[0].starts_with("refs/heads/"){"local"}else if q[0].starts_with("refs/remotes/"){"remote"}else{"tag"}}))
    }).collect()
}
fn worktrees(p:&Path)->Vec<Value>{
    let out=git(p,&["worktree","list","--porcelain"]).unwrap_or_default();
    out.split("\n\n").filter_map(|section|{
        let mut path="";let mut branch="";let mut head="";let mut locked=false;
        for line in section.lines(){if let Some(s)=line.strip_prefix("worktree "){path=s;}
            if let Some(s)=line.strip_prefix("branch refs/heads/"){branch=s;}
            if let Some(s)=line.strip_prefix("HEAD "){head=s;}
            if line.starts_with("locked"){locked=true;}
        }
        if path.is_empty(){None}else{Some(json!({"path":path,"branch":branch,"head":head,"locked":locked,"main":Path::new(path)==p}))}
    }).collect()
}
pub fn inspect(path:&str)->Result<Value,String>{
    let p=root(path)?;
    let (files,branchline)=parse_status(&p)?;
    let branch=git(&p,&["branch","--show-current"]).unwrap_or_default();
    let head=git(&p,&["rev-parse","--short","HEAD"]).unwrap_or_else(|_|"—".into());
    let upstream=git(&p,&["rev-parse","--abbrev-ref","--symbolic-full-name","@{upstream}"]).ok();
    let (ahead,behind)=match git(&p,&["rev-list","--left-right","--count","HEAD...@{upstream}"]){
        Ok(s)=>{let mut p=s.split_whitespace();(p.next().unwrap_or("0").parse::<u32>().unwrap_or(0),p.next().unwrap_or("0").parse::<u32>().unwrap_or(0))},Err(_)=>(0,0)
    };
    let conflicts=files.iter().filter(|f|f["conflict"]==true).count();
    let staged=files.iter().filter(|f|f["staged"]==true).count();
    let modified=files.iter().filter(|f|f["unstaged"]==true).count();
    let untracked=files.iter().filter(|f|f["untracked"]==true).count();
    let stashes=git(&p,&["stash","list","--format=%gd%x09%s"]).unwrap_or_default().lines().filter_map(|line|{
        let (id,title)=line.split_once('\t')?;Some(json!({"id":id,"title":title}))
    }).collect::<Vec<_>>();
    let origin=git(&p,&["remote","get-url","origin"]).ok();
    Ok(json!({"path":p.to_string_lossy(),"name":p.file_name().unwrap_or_default().to_string_lossy(),
       "branch":branch,"branchline":branchline,"head":head,"upstream":upstream,"ahead":ahead,"behind":behind,
       "origin":origin,"files":files,"stashes":stashes,"refs":refs(&p),"worktrees":worktrees(&p),
       "stats":{"staged":staged,"modified":modified,"untracked":untracked,"conflicts":conflicts,"total":files.len()},"sequencer":advanced::sequencer_status(&p)}))
}
pub fn history(path:&str,limit:usize,reference:Option<&str>,skip:usize)->Result<Value,String>{
    let p=root(path)?;
    let max=limit.clamp(1,500);
    // Cap deep skips to avoid unbounded scans from malformed automation requests.
    if skip>200_000{return Err("History skip exceeds supported limit".into());}
    let reference=reference.unwrap_or("all");
    let selected=if reference=="all"{"--all".to_string()}else {
       if !refs(&p).iter().any(|r|r["full"].as_str()==Some(reference)){return Err("Reference not present in repository".into());}
       reference.to_string()
    };
    let data=git_owned(&p,vec!["log".into(),"--topo-order".into(),selected,format!("-n{}",max+1),format!("--skip={skip}"),
        "--date=short".into(),"--format=%H%x1f%P%x1f%an%x1f%ad%x1f%s%x1e".into()])?;
    let mut commits:Vec<Value>=data.split('\x1e').filter_map(|line|{
        let items:Vec<_>=line.trim().split('\x1f').collect();
        if items.len()!=5{return None;}
        Some(json!({"sha":items[0],"parents":items[1].split_whitespace().collect::<Vec<_>>(),
          "author":items[2],"date":items[3],"subject":items[4]}))
    }).collect();
    let has_more=commits.len()>max;
    commits.truncate(max);
    Ok(json!({"commits":commits,"limit":max,"skip":skip,"has_more":has_more}))
}
fn valid_file_path(file:&str)->Result<(),String>{
    if file.is_empty()||file.starts_with('-')||Path::new(file).is_absolute()||
       Path::new(file).components().any(|c|matches!(c,std::path::Component::ParentDir)){return Err("Invalid Git file path".into())}
    Ok(())
}
pub fn diff(path:&str,file:&str,staged:bool,commit:Option<&str>)->Result<Value,String>{
    let p=root(path)?;
    let text=if let Some(sha)=commit {
        if !sha.chars().all(|c|c.is_ascii_hexdigit())||sha.len()<7||sha.len()>40{return Err("Invalid commit SHA".into());}
        if file.is_empty(){git_owned(&p,vec!["show".into(),"--no-ext-diff".into(),"--format=fuller".into(),"--stat".into(),"--patch".into(),sha.into()])?}
        else{valid_file_path(file)?;git_owned(&p,vec!["show".into(),"--format=".into(),"--no-ext-diff".into(),sha.into(),"--".into(),file.into()])?}
    } else {
        valid_file_path(file)?;
        let (files,_)=parse_status(&p)?;
        let untracked=files.iter().any(|f|f["path"]==file&&f["untracked"]==true);
        if untracked&&!staged {
            let candidate=p.join(file);
            if !candidate.is_file(){return Err("Untracked file unavailable".into());}
            let contents=std::fs::read(&candidate).map_err(|e|e.to_string())?;
            if contents.contains(&0){"[Binary untracked file]".into()}
            else{format!("+++ untracked/{}\n{}",file,String::from_utf8_lossy(&contents))}
        } else {
            let mut args=vec!["diff".into(),"--no-ext-diff".into(),"--no-color".into()];
            if staged {args.push("--cached".into());}
            args.extend(["--".into(),file.into()]);
            git_owned(&p,args)?
        }
    };
    Ok(json!({"file":file,"staged":staged,"text":clipped(text)}))
}
pub fn action(path:&str,op:&str,file:Option<&str>,input:Option<&str>)->Result<Value,String>{
    action_with_request(path,op,file,input,None)
}
pub fn action_with_request(path:&str,op:&str,file:Option<&str>,input:Option<&str>,request:Option<&str>)->Result<Value,String>{
    let p=root(path)?;
    with_write_guard(&p,||crate::git_runtime::scope(&p,request,matches!(op,"fetch"|"pull"|"pull_ff"|"pull_merge"|"pull_rebase"|"push"),||action_unlocked(&p,op,file,input)))
}
fn action_unlocked(p:&Path,op:&str,file:Option<&str>,input:Option<&str>)->Result<Value,String>{
    let filename=file.unwrap_or("");
    let detail=input.unwrap_or("").trim();
    if op=="rebase_interactive" { return crate::rebase_workflows::execute(p,detail); }
    if let Some(step)=op.strip_prefix("rebase_"){
        if ["continue","abort","skip"].contains(&step){
            return crate::rebase_workflows::resume(p,step);
        }
    }
    if op=="commit_options" { return crate::commit_workflows::write(&p,detail); }
    if op=="restore_revision_files" { return crate::revision_review::restore(&p,detail); }
    let mut args:Vec<String>=match op {
        "stage"=>{valid_file_path(filename)?;vec!["add".into(),"--".into(),filename.into()]},
        "unstage"=>{valid_file_path(filename)?;vec!["restore".into(),"--staged".into(),"--".into(),filename.into()]},
        "stage_all"=>a(&["add","--all"]),
        "unstage_all"=>a(&["reset","--mixed","--quiet"]),
        "commit"=>{if detail.is_empty(){return Err("Commit message is required".into());}
            if detail.len()>20000{return Err("Commit message too long".into());}
            vec!["commit".into(),"-m".into(),detail.into()]},
        "branch_create"=>{if detail.is_empty(){return Err("Branch name required".into());}
            git(&p,&["check-ref-format","--branch",detail])?;
            vec!["switch".into(),"-c".into(),detail.into()]},
        "branch_switch"=>{if detail.is_empty()||detail.starts_with('-'){return Err("Branch required".into());}
            let exists=refs(&p).iter().any(|r|r["kind"]=="local"&&r["name"]==detail);
            if !exists {return Err("Select an existing local branch".into());}
            vec!["switch".into(),detail.into()]},
        "stash"=>{let mut v=a(&["stash","push","--include-untracked"]);if !detail.is_empty(){v.extend(["-m".into(),detail.into()]);}v},
        "stash_pop"=>{if !detail.starts_with("stash@{")||!detail.ends_with('}')||!detail[7..detail.len()-1].chars().all(|c|c.is_ascii_digit()){return Err("Invalid stash selector".into());}
            vec!["stash".into(),"pop".into(),detail.into()]},
        "fetch"=>a(&["fetch","--prune","origin"]),
        "pull"|"pull_ff"|"pull_merge"|"pull_rebase"=>{
            if advanced::sequencer_status(&p)["active"]==true{return Err("Continue or abort the current Git operation before pulling".into());}
            if !parse_status(&p)?.0.is_empty(){return Err("Commit or stash working changes before pulling; automatic stash is disabled".into());}
            if git(&p,&["branch","--show-current"])?.is_empty(){return Err("Switch to a branch before pulling".into());}
            git(&p,&["rev-parse","--verify","@{upstream}"]).map_err(|_|"Configure an upstream branch before pulling".to_string())?;
            match op {"pull_merge"=>a(&["pull","--no-rebase","--no-edit","--no-autostash"]),"pull_rebase"=>a(&["pull","--rebase","--no-autostash"]),_=>a(&["pull","--ff-only","--no-autostash"])}
        },
        "push"=>a(&["push"]),
        "worktree_add"=>{ // file=destination; input=new branch
            if filename.is_empty()||detail.is_empty(){return Err("Destination and new branch required".into());}
            git(&p,&["check-ref-format","--branch",detail])?;
            let destination=Path::new(filename);
            if !destination.is_absolute()||destination.components().any(|x|matches!(x,std::path::Component::ParentDir)){
                return Err("Worktree destination must be an absolute path without parent traversal".into());
            }
            if destination.exists(){return Err("Worktree destination already exists".into());}
            if !destination.parent().is_some_and(|parent|parent.is_dir()){
                return Err("Worktree destination parent directory does not exist".into());
            }
            vec!["worktree".into(),"add".into(),"-b".into(),detail.into(),filename.into()]},
        "worktree_add_existing"=>{
            if detail.is_empty()||detail.starts_with('-')||detail.len()>250{
                return Err("Choose an existing local branch".into());
            }
            git(&p,&["show-ref","--verify","--quiet",&format!("refs/heads/{detail}")])
                .map_err(|_|"Choose an existing local branch".to_string())?;
            let destination=Path::new(filename);
            if !destination.is_absolute()||destination.components().any(|x|matches!(x,std::path::Component::ParentDir)){
                return Err("Worktree destination must be an absolute path without parent traversal".into());
            }
            if destination.exists(){return Err("Worktree destination already exists".into());}
            if !destination.parent().is_some_and(|parent|parent.is_dir()){
                return Err("Worktree destination parent directory does not exist".into());
            }
            vec!["worktree".into(),"add".into(),filename.into(),detail.into()]
        },
        "worktree_add_detached"=>{
            if detail.len()<7||detail.len()>64||!detail.chars().all(|c|c.is_ascii_hexdigit()){
                return Err("Choose an existing commit SHA".into());
            }
            git(&p,&["cat-file","-e",&format!("{detail}^{{commit}}")])
                .map_err(|_|"Commit not found".to_string())?;
            let destination=Path::new(filename);
            if !destination.is_absolute()||destination.components().any(|x|matches!(x,std::path::Component::ParentDir)){
                return Err("Worktree destination must be an absolute path without parent traversal".into());
            }
            if destination.exists(){return Err("Worktree destination already exists".into());}
            if !destination.parent().is_some_and(|parent|parent.is_dir()){
                return Err("Worktree destination parent directory does not exist".into());
            }
            vec!["worktree".into(),"add".into(),"--detach".into(),filename.into(),detail.into()]
        },
        _=>return advanced::execute(&p,op,filename,detail)
    };
    // No shell execution. All arguments are passed independently to git.exe.
    let description=format!("git {}",args.join(" "));
    let output=git_owned(&p,std::mem::take(&mut args))?;
    Ok(json!({"ok":true,"command":description,"output":clipped(output)}))
}
pub fn github(path:&str,kind:&str)->Result<Value,String>{
    let p=root(path)?;
    let args:Vec<String>=match kind{
        "prs"=>a(&["pr","list","--limit","25","--json","number,title,headRefName,baseRefName,updatedAt,isDraft,url,reviewDecision,statusCheckRollup"]),
        "runs"=>a(&["run","list","--limit","20","--json","databaseId,displayTitle,workflowName,status,conclusion,headBranch,updatedAt,url"]),
        _=>return Err("Unsupported GitHub query".into())
    };
    let output=spawn("gh",&args,Some(&p))?;
    serde_json::from_str(&output).map_err(|e|format!("GitHub returned invalid JSON: {e}"))
}
pub fn settings_path()->PathBuf{
    let dir=std::env::var("ARCLANE_DATA_DIR").ok().filter(|s|!s.trim().is_empty())
        .map(PathBuf::from).unwrap_or_else(||PathBuf::from(std::env::var("APPDATA").unwrap_or_else(|_|".".into())).join("Arclane"));
    dir.join("repos.json")
}
pub fn get_repos()->Result<Vec<String>,String>{
    let path=settings_path();
    if !path.exists(){return Ok(vec![]);}
    let data=std::fs::read_to_string(&path).map_err(|e|e.to_string())?;
    serde_json::from_str::<Vec<String>>(&data).map_err(|e|e.to_string())
}
pub fn save_repos(paths:Vec<String>)->Result<Vec<String>,String>{
    let mut unique:Vec<String>=vec![];
    for path in paths.into_iter().take(100){
        let canon=root(&path)?.to_string_lossy().to_string();
        if !unique.iter().any(|p|p.eq_ignore_ascii_case(&canon)){unique.push(canon);}
    }
    let file=settings_path();
    std::fs::create_dir_all(file.parent().unwrap()).map_err(|e|e.to_string())?;
    let bytes=serde_json::to_vec_pretty(&unique).map_err(|e|e.to_string())?;
    let temporary=file.with_extension("tmp");
    std::fs::write(&temporary,bytes).map_err(|e|e.to_string())?;
    std::fs::rename(&temporary,&file).or_else(|_|{
        std::fs::copy(&temporary,&file).map(|_|())?;
        std::fs::remove_file(&temporary)
    }).map_err(|e|e.to_string())?;
    Ok(unique)
}
