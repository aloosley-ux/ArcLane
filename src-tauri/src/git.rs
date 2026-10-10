use serde_json::{json, Value};
use std::{path::{Path,PathBuf},process::{Command,Stdio}};
#[cfg(windows)]
use std::os::windows::process::CommandExt;

fn spawn(program: &str, args: &[String], cwd: Option<&Path>) -> Result<String,String> {
    let mut cmd = Command::new(program);
    cmd.args(args).stdin(Stdio::null()).env("GIT_TERMINAL_PROMPT","0")
        .env("GCM_INTERACTIVE","never").env("GIT_OPTIONAL_LOCKS","0");
    if let Some(p) = cwd { cmd.current_dir(p); }
    #[cfg(windows)] { cmd.creation_flags(0x08000000); }
    let out = cmd.output().map_err(|e| format!("Could not launch {program}: {e}"))?;
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
       "stats":{"staged":staged,"modified":modified,"untracked":untracked,"conflicts":conflicts,"total":files.len()}}))
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
    let p=root(path)?;
    let filename=file.unwrap_or("");
    let detail=input.unwrap_or("").trim();
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
        "pull"=>a(&["pull","--ff-only"]),
        "push"=>a(&["push"]),
        "worktree_add"=>{ // file=destination; input=new branch
            if filename.is_empty()||detail.is_empty(){return Err("Destination and new branch required".into());}
            git(&p,&["check-ref-format","--branch",detail])?;
            if Path::new(filename).exists(){return Err("Destination already exists".into());}
            vec!["worktree".into(),"add".into(),"-b".into(),detail.into(),filename.into()]},
        _=>return Err("Unsupported action. Forge only runs explicitly listed Git operations".into())
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
