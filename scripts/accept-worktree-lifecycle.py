"""Disposable worktree lifecycle acceptance against ArcLane's real Rust CLI."""
import json
import os
import pathlib
import subprocess
import tempfile

CLI=os.environ.get("ARCLANE_CLI")
if not CLI or not pathlib.Path(CLI).is_file():
    raise SystemExit("Set ARCLANE_CLI to compiled arclane-cli")

def git(repo,*args):
    return subprocess.run(["git","-C",str(repo),*args],text=True,capture_output=True,check=True).stdout.strip()

def action(repo,op,file="",value="",ok=True):
    p=subprocess.run([CLI,"action",str(repo),json.dumps({"op":op,"file":str(file),"input":value})],text=True,capture_output=True)
    assert (p.returncode==0)==ok,(p.stdout,p.stderr)
    return json.loads(p.stdout if ok else p.stderr)

with tempfile.TemporaryDirectory(prefix="arclane-worktrees-") as tmp:
    root=pathlib.Path(tmp)
    repo=root/"main"
    repo.mkdir()
    git(repo,"init","-q","-b","main")
    git(repo,"config","user.name","Worktree Fixture")
    git(repo,"config","user.email","worktree@invalid.local")
    git(repo,"config","core.autocrlf","false")
    (repo/"base.txt").write_bytes(b"baseline\n")
    git(repo,"add",".")
    git(repo,"commit","-qm","Base")
    start=git(repo,"rev-parse","HEAD")
    tree=git(repo,"write-tree")
    git(repo,"branch","feature/shared")
    branch_path=root/"attached"
    action(repo,"worktree_add_existing",branch_path,"feature/shared")
    assert git(branch_path,"symbolic-ref","--short","HEAD")=="feature/shared"
    assert git(branch_path,"rev-parse","HEAD")==start
    assert (branch_path/"base.txt").read_bytes()==b"baseline\n"
    assert git(repo,"write-tree")==tree
    print("PASS attach existing branch, exact branch HEAD/index/file and source preservation")

    def inspect(checkout):
        p=subprocess.run([CLI,"inspect",str(checkout)],text=True,capture_output=True,check=True)
        return json.loads(p.stdout)["result"]
    primary=inspect(repo)["worktrees"]
    linked=inspect(branch_path)["worktrees"]
    assert [pathlib.Path(w["path"]) for w in primary if w["main"]]==[repo],primary
    assert [pathlib.Path(w["path"]) for w in linked if w["main"]]==[repo]
    assert len({w["commonDir"] for w in linked})==1
    print("PASS primary-worktree identity and shared Git common directory stay correct from linked checkout")

    duplicate=root/"duplicate"
    action(repo,"worktree_add_existing",duplicate,"feature/shared",ok=False)
    assert not duplicate.exists()
    action(repo,"worktree_add_existing",duplicate,"missing/branch",ok=False)
    assert git(repo,"rev-parse","HEAD")==start
    print("PASS already-checked-out and nonexistent branches refused")

    detached=root/"inspection"
    action(repo,"worktree_add_detached",detached,start)
    assert git(detached,"rev-parse","HEAD")==start
    assert git(detached,"status","--porcelain")==""
    assert git(repo,"symbolic-ref","--short","HEAD")=="main"
    print("PASS detached inspection worktree leaves source branch unchanged")
    (branch_path/"dirty.txt").write_bytes(b"unsaved\n")
    action(repo,"worktree_remove",branch_path,ok=False)
    assert (branch_path/"dirty.txt").read_bytes()==b"unsaved\n"
    (branch_path/"dirty.txt").unlink()
    action(repo,"worktree_lock",branch_path)
    action(repo,"worktree_remove",branch_path,ok=False)
    assert branch_path.exists()
    action(repo,"worktree_unlock",branch_path)
    action(branch_path,"worktree_remove",branch_path)
    action(detached,"worktree_remove",detached)
    action(repo,"worktree_prune")
    assert git(repo,"rev-parse","refs/heads/feature/shared")==start
    assert git(repo,"write-tree")==tree
    assert not branch_path.exists() and not detached.exists()
    print("PASS dirty/locked removal refused; unlock/remove/prune preserve refs/index")
print("PASS 4 grouped worktree lifecycle checks")
