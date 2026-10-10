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
    base=commit(conflict,"common.txt","original\\n","Start")
    first=commit(conflict,"common.txt","first\\n","First")
    second=commit(conflict,"common.txt","second\\n","Second")
    original=git(conflict,"rev-parse","HEAD")
    beforetree=git(conflict,"write-tree")
    reversed_plan=plan(base,original,[second,first],[("pick",""),("pick","")])
    action(conflict,"rebase_interactive",reversed_plan,ok=False)
    assert (conflict/".git"/"rebase-merge").exists()
    assert (conflict/".git"/"arclane-rebase-plan.json").exists()
    action(conflict,"rebase_abort")
    assert git(conflict,"rev-parse","HEAD")==original
    assert git(conflict,"write-tree")==beforetree
    assert (conflict/"common.txt").read_bytes()==b"second\\n"
    assert not (conflict/".git"/"arclane-rebase-plan.json").exists()
    print("PASS paused rebase abort restores original index, refs, files")
    action(conflict,"rebase_interactive",reversed_plan,ok=False)
    (conflict/"common.txt").write_bytes(b"resolved\\n")
    git(conflict,"add","--","common.txt")
    action(conflict,"rebase_continue")
    assert (conflict/"common.txt").read_bytes()==b"first\\n" or (conflict/".git"/"rebase-merge").exists()
    if (conflict/".git"/"rebase-merge").exists():
        (conflict/"common.txt").write_bytes(b"first\\n")
        git(conflict,"add","--","common.txt")
        action(conflict,"rebase_continue")
    assert not (conflict/".git"/"rebase-merge").exists()
    assert git(conflict,"write-tree")==git(conflict,"rev-parse","HEAD^{tree}")
    print("PASS manual resolution and continuation of interrupted rebase")
print("PASS interactive rebase acceptance")
