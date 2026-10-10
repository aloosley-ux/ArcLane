"""Arclane repository toolkit safety and behaviour suite. All writes stay in Forge-Testbed."""
import json,subprocess,tempfile,pathlib
home=pathlib.Path(r"C:\AI\REA\Experiments\Forge-Testbed")
root=pathlib.Path(tempfile.mkdtemp(prefix="arclane-tools-",dir=home))
repo=root/"workspace";repo.mkdir()
remote=root/"server.git";remote2=root/"server2.git"
cli=pathlib.Path(r"C:\AI\REA\Experiments\Forge\src-tauri\target\release\arclane-cli.exe")
checks=[]
def git(*params,where=repo,expect=True):
 r=subprocess.run(["git","-C",str(where),*params],capture_output=True,text=True,encoding="utf-8")
 if (r.returncode==0)!=expect:raise AssertionError((params,r.returncode,r.stderr))
 return r.stdout.strip()
def task(op,file="",input="",expect=True):
 return call("tool_action",{"op":op,"file":file,"input":str(input)},expect)
def call(op,args,expect=True):
 proc=subprocess.run([str(cli),op,str(repo),json.dumps(args,ensure_ascii=False)],capture_output=True,text=True,encoding="utf-8")
 if (proc.returncode==0)!=expect:raise AssertionError((op,args,proc.stdout,proc.stderr))
 return json.loads(proc.stdout if expect else proc.stderr).get("result",{}) if expect else json.loads(proc.stderr)
def view(section):return call("tools",{"section":section})
def passed(label):
 checks.append(label);print("PASS",label,flush=True)
git("init","-q","-b","main");git("config","user.name","Arclane test");git("config","user.email","test@invalid.local")
(repo/"seed.txt").write_bytes(b"base\n");git("add","--all");git("commit","-q","-m","Initial base")
base=git("rev-parse","HEAD")
git("init","--bare",str(remote),where=repo);git("init","--bare",str(remote2),where=repo)
task("remote_add","origin",remote);assert len(view("remotes")["remotes"])==1
passed("Add local bare Git remote and read exact fetch/push URLs")
task("remote_add","origin",remote,False)
for unsafe in ("--upload-pack=evil","ext::evil","file:///etc/forbidden"):
 task("remote_add","bogus",unsafe,False)
passed("Reject duplicate, injection and disallowed transport remote URLs")
task("push_upstream","origin");assert git("rev-parse","main")==git("rev-parse","refs/heads/main",where=remote)
passed("Push current branch upstream to isolated bare remote")
task("remote_rename","origin","backup");assert view("remotes")["remotes"][0]["name"]=="backup"
task("remote_url","backup",remote2);assert str(remote2) in view("remotes")["remotes"][0]["fetch"]
task("remote_remove","backup");assert not view("remotes")["remotes"]
passed("Rename, update URL and delete remote")
task("remote_add","origin",remote)
task("tag_annotated","v8.0.0","Release notes go here")
assert git("cat-file","-t","refs/tags/v8.0.0")=="tag"
assert "Release notes go here" in git("cat-file","-p","refs/tags/v8.0.0")
passed("Create annotated tag with exact message")
task("tag_push","origin","v8.0.0");assert git("show-ref","--verify","refs/tags/v8.0.0",where=remote)
task("tag_remote_delete","origin","v8.0.0")
git("show-ref","--verify","refs/tags/v8.0.0",where=remote,expect=False)
assert git("show-ref","--verify","refs/tags/v8.0.0")
passed("Explicitly push/delete remote tag while preserving local tag")
task("rescue_branch",base,"rescue/initial");assert git("rev-parse","refs/heads/rescue/initial")==base
task("rescue_branch",base,"rescue/initial",False)
task("rescue_branch","deadbeef","rescue/fake",False)
passed("Rescue from commit SHA without moving HEAD or overwriting branch")
log=view("reflog")["entries"]
assert len(log)>=1 and all(len(r["sha"])==40 for r in log[:5])
passed("Read bounded reflog with refs and commit hashes")
git("branch","develop")
task("gitflow_start","feature","dashboard")
assert git("branch","--show-current")=="feature/dashboard"
assert git("merge-base","develop","HEAD")==base
git("switch","main")
passed("Start Gitflow feature branch from develop")
task("gitflow_start","release","2.4")
assert git("branch","--show-current")=="release/2.4"
git("switch","main")
passed("Start Gitflow release branch from develop")
task("gitflow_start","hotfix","critical")
assert git("branch","--show-current")=="hotfix/critical"
git("switch","main")
passed("Start Gitflow hotfix branch from main")
(repo/"dirty.txt").write_text("unfinished",encoding="utf-8")
task("gitflow_start","feature","dirty",False)
(repo/"dirty.txt").unlink()
task("gitflow_start","not-a-kind","foo",False)
task("gitflow_start","feature","--evil",False)
passed("Block Gitflow start on dirty trees, bad kind, flag injection")
branches=view("gitflow")
assert len(branches["branches"])==3
passed("Read structured Gitflow branches and base presence")
task("submodule_sync")
assert view("submodules")["modules"]==[]
passed("Submodule sync on empty repository safe")
lf=view("lfs")
if lf["installed"]:
 task("lfs_track",input="*.psd")
 assert "*.psd" in (repo/".gitattributes").read_text(encoding="utf-8")
 task("lfs_untrack",input="*.psd")
 passed("LFS installed: track and untrack pattern in isolated repo")
else:
 task("lfs_track",input="*.psd",expect=False)
 passed("LFS unavailable: explicit detection and graceful refusal")
file="seed.txt"
git("switch","main")
(repo/file).write_bytes(b"changed\n")
git("add",file);git("commit","-q","-m","Change seed")
task("restore_commit_file",base,file)
assert (repo/file).read_bytes().replace(b"\r\n",b"\n")==b"base\n"  # Windows Git autocrlf checkout normalization
assert git("show",":"+file)=="changed"
passed("Restore selected tracked file from old commit, preserve staging index")
for path in ("../outside.txt","--upload-pack=evil",r"C:\Windows\win.ini"):
 task("restore_commit_file",base,path,False)
passed("Reject restore file path traversal/absolute/argument injection")
out=pathlib.Path(__file__).resolve().parents[1]/"artifacts"/"toolbox-acceptance.json"
out.write_text(json.dumps({"passed":len(checks),"checks":checks,"repo":str(repo),"remote":str(remote)},indent=2),encoding="utf-8")
print("ACCEPTED",len(checks),"toolbox groups")
