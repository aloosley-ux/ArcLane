//! User-triggered GitHub collaboration via the installed gh CLI.
//! Does not read, persist or transmit GitHub tokens itself. No background network requests.
use serde_json::{json,Value};
use std::{path::Path,process::{Command,Stdio}};
#[cfg(windows)]use std::os::windows::process::CommandExt;
const MAX_OUTPUT:usize=3_000_000;
fn gh(repo:&Path,args:Vec<String>)->Result<String,String>{
 let mut p=Command::new("gh");
 p.args(args).current_dir(repo).stdin(Stdio::null()).stdout(Stdio::piped())
  .stderr(Stdio::piped()).env("GH_PROMPT_DISABLED","1").env("GIT_TERMINAL_PROMPT","0");
 #[cfg(windows)]p.creation_flags(0x08000000);
 let r=p.output().map_err(|_|"GitHub CLI (gh) is unavailable. Install gh and sign in with gh auth login.".to_string())?;
 if r.stdout.len()>MAX_OUTPUT{return Err("GitHub returned too much data; narrow the selection".into());}
 if r.status.success(){Ok(String::from_utf8_lossy(&r.stdout).trim().to_string())}
 else{
  let msg=String::from_utf8_lossy(&r.stderr).trim().to_string();
  Err(if msg.is_empty(){format!("GitHub CLI failed ({})",r.status)}else{msg.chars().take(1300).collect()})
 }
}
fn a(parts:&[&str])->Vec<String>{parts.iter().map(|s|s.to_string()).collect()}
fn number(id:&str)->Result<(),String>{
 let n=id.parse::<u32>().map_err(|_|"Expected an issue/PR number")?;
 if n==0||n>100_000_000{return Err("Invalid GitHub issue/PR number".into());}
 Ok(())
}
fn message(s:&str,min:usize,max:usize)->Result<(),String>{
 if s.trim().len()<min||s.len()>max||s.contains('\0'){return Err(format!("Content must contain {min}–{max} characters").into());}
 Ok(())
}
fn param<'a>(data:&'a Value,key:&str)->Result<&'a str,String>{
 data.get(key).and_then(Value::as_str).ok_or_else(||format!("Missing GitHub {key}"))
}
fn parse_json(repo:&Path,argv:Vec<String>)->Result<Value,String>{
 let value=gh(repo,argv)?;
 serde_json::from_str(&value).map_err(|e|format!("GitHub returned invalid JSON: {e}"))
}
pub fn query(repo:&Path,kind:&str,id:Option<&str>)->Result<Value,String>{
 match kind{
  "prs"=>parse_json(repo,a(&["pr","list","--state","all","--limit","75","--json","number,title,headRefName,baseRefName,updatedAt,isDraft,url,reviewDecision,statusCheckRollup,state,mergeable,author,labels,body"])),
  "issues"=>parse_json(repo,a(&["issue","list","--state","all","--limit","75","--json","number,title,author,labels,assignees,state,url,updatedAt,body"])),
  "runs"=>parse_json(repo,a(&["run","list","--limit","50","--json","databaseId,displayTitle,workflowName,status,conclusion,headBranch,updatedAt,url"])),
  "pr"=>{let selected=id.ok_or("PR number required")?;number(selected)?;
    parse_json(repo,a(&["pr","view",selected,"--json","number,title,body,headRefName,baseRefName,isDraft,url,reviewDecision,state,mergeable,mergeStateStatus,comments,reviews,files,commits,statusCheckRollup,author,labels"]))},
  "issue"=>{let selected=id.ok_or("Issue number required")?;number(selected)?;
    parse_json(repo,a(&["issue","view",selected,"--json","number,title,body,state,url,author,labels,assignees,comments"]))},
  "status"=>{let value=gh(repo,a(&["auth","status"]))?;Ok(json!({"authenticated":true,"status":value.chars().take(500).collect::<String>()}))},
  _=>Err("Unsupported GitHub query".into())
 }
}
pub fn mutate(repo:&Path,operation:&str,target:&str,detail:&Value)->Result<Value,String>{
 let cmd=match operation{
  "pr_create"=>{
    let title=param(detail,"title")?;message(title,3,250)?;
    let body=detail["body"].as_str().unwrap_or("");message(body,0,30_000)?;
    let base=param(detail,"base")?;
    if base.is_empty()||base.starts_with('-')||base.len()>250||base.chars().any(char::is_whitespace){return Err("Invalid PR base branch".into());}
    let mut x=a(&["pr","create"]);
    x.extend([format!("--title={title}"),format!("--body={body}"),format!("--base={base}")]);
    if detail["draft"].as_bool().unwrap_or(false){x.push("--draft".into());}x
  },
  "pr_review"=>{
    number(target)?;let action=param(detail,"action")?;
    let mut x=a(&["pr","review",target]);
    match action{
      "approve"=>{x.push("--approve".into());},
      "comment"=>{x.push("--comment".into());},
      "request_changes"=>{x.push("--request-changes".into());},
      _=>return Err("Unsupported review decision".into())
    };
    let body=detail["body"].as_str().unwrap_or("");
    if action!="approve"||!body.is_empty(){message(body,2,30_000)?;x.push(format!("--body={body}"));}
    x
  },
  "pr_merge"=>{
    number(target)?;let method=param(detail,"method")?;
    let flag=match method{"squash"=>"--squash","merge"=>"--merge","rebase"=>"--rebase",_=>return Err("Invalid PR merge strategy".into())};
    a(&["pr","merge",target,flag])
  },
  "pr_comment"=>{
    number(target)?;let body=param(detail,"body")?;message(body,2,30_000)?;
    vec!["pr".into(),"comment".into(),target.into(),format!("--body={body}")]
  },
  "issue_create"=>{
    let title=param(detail,"title")?;message(title,3,250)?;
    let body=detail["body"].as_str().unwrap_or("");message(body,0,30_000)?;
    vec!["issue".into(),"create".into(),format!("--title={title}"),format!("--body={body}")]
  },
  "issue_comment"=>{
    number(target)?;let body=param(detail,"body")?;message(body,2,30_000)?;
    vec!["issue".into(),"comment".into(),target.into(),format!("--body={body}")]
  },
  "issue_close"=>{number(target)?;a(&["issue","close",target])},
  "issue_reopen"=>{number(target)?;a(&["issue","reopen",target])},
  "issue_assign"=>{
    number(target)?;let user=param(detail,"assignee")?;
    if user.is_empty()||user.starts_with('-')||user.len()>140||user.chars().any(char::is_whitespace){return Err("Invalid assignee handle".into());}
    vec!["issue".into(),"edit".into(),target.into(),format!("--add-assignee={user}")]
  },
  _=>return Err("Unsupported GitHub mutation".into())
 };
 let result=gh(repo,cmd)?;
 Ok(json!({"ok":true,"operation":operation,"output":result}))
}
