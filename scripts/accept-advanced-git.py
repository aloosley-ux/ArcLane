"""Verify Arclane advanced Git commands only against newly created disposable repositories."""
import json,subprocess,tempfile,pathlib,os
root=pathlib.Path(r"C:\AI\REA\Experiments\Forge-Testbed")
cli=pathlib.Path(r"C:\AI\REA\Experiments\Forge\src-tauri\target\release\arclane-cli.exe")
repo=pathlib.Path(tempfile.mkdtemp(prefix="arclane-advanced-",dir=root))
wt=repo.parent/(repo.name+"-linked")
passes=[]
def git(*args,check=True):
    r=subprocess.run(["git","-C",str(repo),*args],capture_output=True,text=True)
    if check and r.returncode:raise AssertionError(f"git {args}: {r.stderr}")
    return r.stdout.strip()
def cmd(op,input=None,file=None,expect=True):
    opts={"op":op}
    if input is not None:opts["input"]=input
    if file is not None:opts["file"]=str(file)
    p=subprocess.run([str(cli),"action",str(repo),json.dumps(opts)],text=True,capture_output=True)
    if bool(p.returncode==0)!=expect: raise AssertionError(f"arclane {op} {opts} exit {p.returncode}: {p.stdout} {p.stderr}")
    return json.loads(p.stdout if expect else p.stderr)
def test(name,fn):
    fn();passes.append(name);print("PASS",name,flush=True)
def write(path,text):
    p=repo/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text,encoding="utf-8")
def commit(message):
    git("add","--all");git("commit","-m",message,"--quiet")
git("init","-q","-b","main")
git("config","user.name","Arclane Test")
git("config","user.email","test@local.invalid")
write("README.md","one\n");commit("initial")
base=git("rev-parse","HEAD")
test("Create tag",lambda:(cmd("tag_create","v0.1"),git("show-ref","--verify","refs/tags/v0.1")))
test("Delete tag",lambda:(cmd("tag_delete","v0.1"),assert_not_ref("v0.1") if False else None))
assert git("tag","--list","v0.1")==""
test("Reject suspicious tag",lambda:cmd("tag_create","--upload-pack=evil",expect=False))
git("switch","-c","feature")
write("feature.txt","feature\n");commit("feature addition")
git("switch","main")
test("Merge clean branch",lambda:cmd("merge","feature"))
assert (repo/"feature.txt").read_text()=="feature\n"
test("Create and rename branch",lambda:(git("branch","temporary"),cmd("branch_rename","refined",file="temporary"),git("show-ref","--verify","refs/heads/refined")))
test("Safely delete unmerged/no-longer-needed branch",lambda:cmd("branch_delete","refined"))
assert git("branch","--list","refined")==""
test("Reject arbitrary branch flag",lambda:cmd("branch_delete","--force",expect=False))
git("switch","-c","conflict")
write("README.md","conflict-branch\n");commit("conflicting change")
git("switch","main")
write("README.md","main-edit\n");commit("main change")
def merge_conflict():
    cmd("merge","conflict",expect=False)
    p=subprocess.run([str(cli),"inspect",str(repo)],capture_output=True,text=True,check=True)
    assert json.loads(p.stdout)["result"]["sequencer"]["merge"] is True
    cmd("merge_abort")
    assert git("status","--porcelain")==""
    assert (repo/"README.md").read_text()=="main-edit\n"
test("Detect and safely abort merge conflict",merge_conflict)
git("switch","-c","topic")
write("review.md","check change\n");commit("reviewed change")
topic=git("rev-parse","HEAD")
git("switch","main")
def cherry():
    cmd("cherry_pick",topic)
    assert (repo/"review.md").read_text()=="check change\n"
test("Cherry-pick existing commit",cherry)
test("Revert a picked commit",lambda:(cmd("revert",git("rev-parse","HEAD")),assert_no_file("review.md") if False else None))
assert not (repo/"review.md").exists()
test("Reject invalid or unknown commit",lambda:(cmd("cherry_pick","bad;rm -rf /",expect=False),cmd("revert","deadbeef",expect=False)))
def stash():
    write("new.txt","working\n")
    cmd("stash", "my draft")
    assert not (repo/"new.txt").exists()
    cmd("stash_apply","stash@{0}")
    assert (repo/"new.txt").read_text()=="working\n"
    cmd("stash_drop","stash@{0}")
    assert git("stash","list")==""; (repo/"new.txt").unlink()
test("Stash apply and drop without silent data loss",stash)
test("Reject stash argument injection",lambda:cmd("stash_drop","stash@{0};exploit",expect=False))
def worktree():
    cmd("worktree_add","wt-branch",file=str(wt))
    assert wt.exists()
    cmd("worktree_lock",file=str(wt))
    assert "locked" in git("worktree","list","--porcelain")
    cmd("worktree_unlock",file=str(wt))
    cmd("worktree_remove",file=str(wt))
    assert not wt.exists()
test("Create, lock, unlock, remove registered worktree",worktree)
test("Refuse removing main or arbitrary worktree",lambda:(cmd("worktree_remove",file=str(repo),expect=False),cmd("worktree_remove",file=str(root),expect=False)))
def rebasing():
    git("switch","-c","topic-rebase")
    write("b.txt","branch\n");commit("topic commit")
    git("switch","main")
    write("m.txt","main\n");commit("main movement")
    git("switch","topic-rebase")
    cmd("rebase","main")
    assert git("merge-base","HEAD","main")==git("rev-parse","main")
    git("switch","main")
test("Rebase branch and preserve changes",rebasing)
def reset():
    git("switch","-c","reset-sandbox")
    write("temp.txt","temp\n");commit("temporary")
    before=git("rev-parse","HEAD~1")
    cmd("reset_soft",before)
    assert "temp.txt" in git("diff","--cached","--name-only")
    cmd("reset_mixed",before)
    assert "temp.txt" in git("status","--short")
    (repo/"temp.txt").unlink();git("switch","main")
test("Soft and mixed reset in isolated branch",reset)
def discard():
    write("README.md","unsaved\n")
    cmd("discard_file",file="README.md")
    assert (repo/"README.md").read_text()=="main-edit\n"
    write("untracked.txt","important")
    cmd("discard_file",file="untracked.txt",expect=False)
    assert (repo/"untracked.txt").exists()
    (repo/"untracked.txt").unlink()
test("Tracked file discard and untracked protection",discard)
test("No-operation abort guarded",lambda:(cmd("merge_abort",expect=False),cmd("rebase_abort",expect=False),cmd("cherry_pick_abort",expect=False)))
test("Submodule inventory",lambda:cmd("submodule_status"))
out={"passed":len(passes),"checks":passes,"repository":str(repo),"linked_removed":not wt.exists()}
dest=pathlib.Path(__file__).resolve().parents[1]/"artifacts"/"advanced-git-acceptance.json"
dest.parent.mkdir(exist_ok=True)
dest.write_text(json.dumps(out,indent=2))
print("ACCEPTED",len(passes),"grouped checks",str(dest),flush=True)
