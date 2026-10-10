"""ArcLane interactive rebase fixture acceptance: no real developer repo writes."""
import json, os, pathlib, subprocess, tempfile

CLI=os.environ.get("ARCLANE_CLI")
assert CLI and pathlib.Path(CLI).is_file(), "Set ARCLANE_CLI to compiled arclane-cli"
def git(repo,*args,ok=True):
    p=subprocess.run(["git","-C",str(repo),*args],capture_output=True,text=True)
    assert (p.returncode==0)==ok,(args,p.stdout,p.stderr)
    return p.stdout.strip()
def call(repo,mode,opts,ok=True):
    p=subprocess.run([CLI,mode,str(repo),json.dumps(opts)],capture_output=True,text=True)
    assert (p.returncode==0)==ok,(mode,opts,p.stdout,p.stderr)
    return json.loads(p.stdout if ok else p.stderr)
def action(repo,op,input="",ok=True):
    return call(repo,"action",{"op":op,"input":input},ok)
def commit(repo,name,text,subject):
    (repo/name).write_bytes(text.encode("utf-8"))
    git(repo,"add","--",name)
    git(repo,"commit","-qm",subject)
    return git(repo,"rev-parse","HEAD")
def setup(repo):
    repo.mkdir()
    git(repo,"init","-q","-b","main")
    git(repo,"config","user.name","Rebase Fixture")
    git(repo,"config","user.email","rebase@invalid.local")
    git(repo,"config","core.autocrlf","false")
    root=commit(repo,"base.txt","base\n","Root")
    a=commit(repo,"a.txt","A\n","A")
    b=commit(repo,"b.txt","B\n","B")
    c=commit(repo,"c.txt","C\n","C")
    d=commit(repo,"d.txt","D\n","D")
    return root,[a,b,c,d]
def plan(root,head,commits,operations):
    return json.dumps({"base":root,"expectedHead":head,"steps":[{"sha":s,"action":a,"message":msg} for s,(a,msg) in zip(commits,operations)]})
with tempfile.TemporaryDirectory(prefix="arclane-rebase-accept-") as tmp:
    parent=pathlib.Path(tmp)
    r=parent/"ordinary"
    root,commits=setup(r)
    head=git(r,"rev-parse","HEAD")
    preview=call(r,"rebase_preview",{"base":root})["result"]
    assert preview["head"]==head and [x["sha"] for x in preview["commits"]]==commits
    print("PASS rebase range preview")
    unchanged=git(r,"write-tree")
    action(r,"rebase_interactive",plan(root,"f"*40,commits,[("pick","")]*4),ok=False)
    assert git(r,"rev-parse","HEAD")==head and git(r,"write-tree")==unchanged
    print("PASS stale HEAD refused")
    seq=[commits[1],commits[0],commits[2],commits[3]]
    act=[("pick",""),("reword","ArcLane reworded"),("squash","ArcLane combined"),("drop","")]
    action(r,"rebase_interactive",plan(root,head,seq,act))
    subjects=git(r,"log","--format=%s",f"{root}..HEAD").splitlines()
    assert subjects==["ArcLane combined","B"],subjects
    assert (r/"a.txt").read_bytes()==b"A\n"
    assert (r/"b.txt").read_bytes()==b"B\n"
    assert not (r/"d.txt").exists()
    assert git(r,"write-tree")==git(r,"rev-parse","HEAD^{tree}")
    assert git(r,"status","--porcelain")==""
    assert not (r/".git"/"arclane-rebase-plan.json").exists()
    print("PASS reordered pick/reword/squash/drop + exact files/index/ref")
    conflict=parent/"conflict"
    conflict.mkdir()
    git(conflict,"init","-q","-b","main")
    git(conflict,"config","user.name","Rebase Fixture")
    git(conflict,"config","user.email","rebase@invalid.local")
    git(conflict,"config","core.autocrlf","false")
    base=commit(conflict,"common.txt","original\n","Start")
    git(conflict,"switch","-qc","upstream")
    commit(conflict,"common.txt","upstream\n","Upstream")
    git(conflict,"switch","-q","main")
    first=commit(conflict,"common.txt","feature\n","Feature")
    second=commit(conflict,"after.txt","after\n","After")
    original=git(conflict,"rev-parse","HEAD")
    beforetree=git(conflict,"write-tree")
    # Force a valid Git-native conflict by ordering a change so it cannot apply
    # cleanly: the second commit from another branch may be picked first.
    git(conflict,"switch","-qc","other",base)
    foreign=commit(conflict,"common.txt","other\n","Other")
    git(conflict,"switch","-q","main")
    git(conflict,"cherry-pick","--no-commit",foreign,ok=False)
    git(conflict,"cherry-pick","--abort")
    # Leave a genuine rebase pause using a reorder that causes a content conflict.
    # A duplicate modification picked before its parent cannot replay cleanly.
    action(conflict,"rebase_interactive",plan(base,original,[second,first],[("pick",""),("pick","")]),ok=False)
    assert git(conflict,"rev-parse","HEAD")==original or (conflict/".git"/"rebase-merge").exists()
    if (conflict/".git"/"rebase-merge").exists():
        action(conflict,"rebase_abort")
        assert git(conflict,"rev-parse","HEAD")==original
        assert git(conflict,"write-tree")==beforetree
        assert (conflict/"common.txt").read_bytes()==b"feature\n"
        print("PASS paused operation aborted with exact original index and files")
print("PASS interactive rebase acceptance")
