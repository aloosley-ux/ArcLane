//! Commit editing and inspection. All writes use the index, never implicitly stage files.
use serde::Deserialize;
use serde_json::{json, Value};
use std::{path::Path, process::{Command, Stdio}};
#[cfg(windows)] use std::os::windows::process::CommandExt;

pub fn git(root: &Path, args: &[String]) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.arg("--literal-pathspecs").arg("-C").arg(root).args(args)
        .stdin(Stdio::null()).env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "never").env("GIT_EDITOR", "true")
        .env("GIT_OPTIONAL_LOCKS", "0");
    #[cfg(windows)] cmd.creation_flags(0x08000000);
    let out = cmd.output().map_err(|e| format!("Unable to launch Git: {e}"))?;
    if !out.status.success() { return Err(String::from_utf8_lossy(&out.stderr).trim().into()); }
    Ok(String::from_utf8_lossy(&out.stdout).trim_end_matches(['\r','\n']).into())
}
fn a(args: &[&str]) -> Vec<String> { args.iter().map(|s| s.to_string()).collect() }
pub fn resolve(root: &Path, sha: &str) -> Result<String, String> {
    if sha.len() < 7 || sha.len() > 64 || !sha.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Choose a valid commit hash".into());
    }
    git(root, &a(&["rev-parse", "--verify", &format!("{sha}^{{commit}}")]))
}
pub fn details(root: &Path, sha: &str) -> Result<Value, String> {
    let oid = resolve(root, sha)?;
    let metadata = git(root, &a(&["show", "-s", "--format=%H%x00%P%x00%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%G?%x00%B", &oid]))?;
    let fields: Vec<_> = metadata.splitn(10, '\0').collect();
    if fields.len() != 10 { return Err("Invalid commit metadata".into()); }
    let changes = if let Some(parent)=fields[1].split_whitespace().next() {
        git(root,&a(&["diff","--name-status","-z","--no-renames",parent,&oid]))?
    } else {git(root, &a(&["diff-tree", "--root", "--no-commit-id", "--name-status", "-r", "-z", "--no-renames", &oid]))?};
    let mut files = vec![];
    let mut tokens = changes.split('\0').filter(|s| !s.is_empty());
    while let Some(status) = tokens.next() {
        if let Some(file) = tokens.next() { files.push(json!({"status":status,"path":file})); }
    }
    let remote_refs = git(root, &a(&["for-each-ref", "--contains", &oid, "--format=%(refname:short)", "refs/remotes"]))?;
    Ok(json!({"sha":fields[0], "parents":fields[1].split_whitespace().collect::<Vec<_>>(),
        "author":fields[2],"authorEmail":fields[3],"authorDate":fields[4],
        "committer":fields[5],"committerEmail":fields[6],"committerDate":fields[7],
        "signature":fields[8],"message":fields[9],"files":files,
        "remoteRefs":remote_refs.lines().collect::<Vec<_>>()}))
}
pub fn defaults(root: &Path) -> Result<Value, String> {
    let head = git(root, &a(&["rev-parse", "--verify", "HEAD"])).ok();
    let last = head.as_deref().map(|s| details(root, s)).transpose()?;
    Ok(json!({"head":head,"last":last,
        "name":git(root,&a(&["config","user.name"])).unwrap_or_default(),
        "email":git(root,&a(&["config","user.email"])).unwrap_or_default()}))
}
#[derive(Deserialize)]
#[serde(rename_all="camelCase", deny_unknown_fields)]
struct Options { message: String, expected_head: Option<String>, #[serde(default)] amend: bool,
    #[serde(default)] confirmed: bool, #[serde(default)] author_name: String,
    #[serde(default)] author_email: String, #[serde(default)] coauthors: Vec<String> }
fn identity(name: &str, email: &str) -> Result<(), String> {
    if name.trim().is_empty() || !email.contains('@') || [name,email].iter().any(|s|s.contains(['\n','\r','\0','<','>'])) {
        return Err("Author requires a name and email without line breaks or angle brackets".into());
    }
    Ok(())
}
pub fn write(root: &Path, input: &str) -> Result<Value, String> {
    let opts: Options = serde_json::from_str(input).map_err(|e| format!("Invalid commit options: {e}"))?;
    if opts.message.trim().is_empty() || opts.message.len() > 20000 || opts.message.contains('\0') {
        return Err("Commit message must contain 1–20000 bytes without NUL".into());
    }
    let head = git(root, &a(&["rev-parse","--verify","HEAD"])).ok();
    if head != opts.expected_head { return Err("HEAD changed since this editor opened. Reopen commit options before committing.".into()); }
    if crate::advanced::sequencer_status(root)["active"] == true {
        return Err("Finish or abort the current Git operation before using commit options".into());
    }
    if opts.amend && (head.is_none() || !opts.confirmed) { return Err("Amend requires an existing commit and explicit rewrite confirmation".into()); }
    let mut command = a(&["commit"]);
    if opts.amend { command.push("--amend".into()); }
    if !opts.author_name.is_empty() || !opts.author_email.is_empty() {
        identity(&opts.author_name, &opts.author_email)?;
        command.push(format!("--author={} <{}>",opts.author_name.trim(),opts.author_email.trim()));
    }
    if opts.coauthors.len() > 20 { return Err("Too many co-authors".into()); }
    let mut message = opts.message.trim().to_string();
    for author in &opts.coauthors {
        let (name,email) = author.rsplit_once(" <").ok_or("Co-author format: Name <email>")?;
        identity(name,email.strip_suffix('>').ok_or("Co-author email must end with >")?)?;
    }
    if !opts.coauthors.is_empty() {
        message.push_str("\n\n");
        message.push_str(&opts.coauthors.iter().map(|s|format!("Co-authored-by: {s}")).collect::<Vec<_>>().join("\n"));
    }
    command.extend(["-m".into(), message]);
    let output = git(root, &command)?;
    Ok(json!({"ok":true,"command":if opts.amend {"git commit --amend"} else {"git commit"},"output":output}))
}
