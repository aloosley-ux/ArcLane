"""Disposable Gitflow feature-finish acceptance against compiled ArcLane CLI."""
import json
import os
import pathlib
import subprocess
import tempfile

CLI = os.environ.get("ARCLANE_CLI")
if not CLI or not pathlib.Path(CLI).is_file():
    raise SystemExit("Set ARCLANE_CLI to the compiled ArcLane CLI path")

def git(p, *args):
    r = subprocess.run(["git", "-C", str(p), *args], capture_output=True, text=True, check=True)
    return r.stdout.strip()

def action(p, mode, op, file="", value="", ok=True):
    opts={"op":op, "file":file, "input":value}
    r=subprocess.run([CLI,mode,str(p),json.dumps(opts)],capture_output=True,text=True)
    assert (r.returncode==0)==ok,(r.stdout,r.stderr)
    return json.loads(r.stdout if ok else r.stderr)

def write(p, name, value):
    (p/name).write_text(value,encoding="utf-8",newline="\n")

def commit(p, name, value, message):
    write(p,name,value)
    git(p,"add","--",name)
    git(p,"commit","-qm",message)
    return git(p,"rev-parse","HEAD")

def setup(path):
    path.mkdir()
    git(path,"init","-q","-b","main")
    git(path,"config","user.name","Gitflow fixture")
    git(path,"config","user.email","gitflow@invalid.local")
    git(path,"config","core.autocrlf","false")
    return commit(path,"shared.txt","common\n","Initial")

with tempfile.TemporaryDirectory(prefix="arclane-gitflow-finish-") as tmp:
    p=pathlib.Path(tmp)/"happy"
    setup(p)
    git(p,"branch","develop")
    git(p,"switch","-q","develop")
    dev=commit(p,"dev.txt","develop\n","Develop")
    git(p,"switch","-qc","feature/ticket-42")
    feature=commit(p,"feature.txt","feature\n","Feature work")
    action(p,"tool_action","gitflow_finish_feature","feature/ticket-42","0"*40,ok=False)
    assert git(p,"rev-parse","HEAD")==feature
    print("PASS stale/invalid feature HEAD refused")
    write(p,"untracked.txt","preserve\n")
    action(p,"tool_action","gitflow_finish_feature","feature/ticket-42",feature,ok=False)
    assert git(p,"symbolic-ref","--short","HEAD")=="feature/ticket-42"
    assert (p/"untracked.txt").read_bytes()==b"preserve\n"
    (p/"untracked.txt").unlink()
    print("PASS dirty working tree refuses branch switch")
    action(p,"tool_action","gitflow_finish_feature","feature/ticket-42",feature)
    after=git(p,"rev-parse","HEAD")
    parents=git(p,"rev-list","--parents","-n","1","HEAD").split()
    assert parents==[after,dev,feature],parents
    assert git(p,"symbolic-ref","--short","HEAD")=="develop"
    assert git(p,"rev-parse","refs/heads/feature/ticket-42")==feature
    assert (p/"feature.txt").read_bytes()==b"feature\n"
    assert git(p,"write-tree")==git(p,"rev-parse","HEAD^{tree}")
    print("PASS no-ff feature finish retains branch, exact merge parents, index and files")

    q=pathlib.Path(tmp)/"conflicts"
    setup(q)
    git(q,"branch","develop")
    git(q,"switch","-qc","feature/conflict")
    source=commit(q,"shared.txt","feature\n","Feature change")
    git(q,"switch","-q","develop")
    dev=commit(q,"shared.txt","develop\n","Develop change")
    git(q,"switch","-q","feature/conflict")
    action(q,"tool_action","gitflow_finish_feature","feature/conflict",source,ok=False)
    assert git(q,"symbolic-ref","--short","HEAD")=="develop"
    assert git(q,"rev-parse","HEAD")==dev
    assert (q/".git"/"MERGE_HEAD").exists()
    action(q,"action","merge_abort")
    assert git(q,"rev-parse","HEAD")==dev
    assert (q/"shared.txt").read_bytes()==b"develop\n"
    assert git(q,"write-tree")==git(q,"rev-parse","HEAD^{tree}")
    assert git(q,"rev-parse","refs/heads/feature/conflict")==source
    print("PASS merge conflict pauses; abort recovers exact develop ref/index/files")
print("PASS 4 grouped Gitflow feature-finish checks")
