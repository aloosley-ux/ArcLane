"""Windows: disposable repositories only. Exercises REAL ArcLane CLI processes."""
import json,os,pathlib,subprocess,tempfile,time
CLI=os.environ.get("ARCLANE_CLI")
assert CLI and pathlib.Path(CLI).is_file(),"ARCLANE_CLI must point to the compiled CLI"

def git(repo,*args):
    r=subprocess.run(["git","-C",str(repo),*args],capture_output=True,text=True,timeout=12)
    assert r.returncode==0,(args,r.stderr)
    return r.stdout.strip()
def call(repo,op,*,input="",extra=None,timeout=20,expected=None):
    e=os.environ.copy()
    if extra:e.update(extra)
    p=subprocess.run([CLI,"action",str(repo),json.dumps({"op":op,"input":input})],capture_output=True,text=True,env=e,timeout=timeout)
    if expected is not None:assert (p.returncode==0)==expected,(op,p.stdout,p.stderr)
    return p
def setup(repo):
    repo.mkdir()
    git(repo,"init","-q","-b","main")
    git(repo,"config","user.name","ArcLane Runtime")
    git(repo,"config","user.email","runtime@invalid.local")
    git(repo,"config","core.autocrlf","false")
    (repo/"README.txt").write_bytes(b"base\n")
    git(repo,"add","--all")
    git(repo,"commit","-qm","Start")
    return git(repo,"rev-parse","HEAD")
def slow_hook(repo,seconds):
    hooks=repo/".git"/"hooks"
    (hooks/"pre-commit").write_text(
        "#!/bin/sh\nprintf 'ready' > \"$(git rev-parse --absolute-git-dir)/arclane-accept-running\"\nsleep "+str(seconds)+"\n",
        encoding="utf-8",newline="\n")
def launch(repo):
    return subprocess.Popen([CLI,"action",str(repo),json.dumps({"op":"commit","input":"Slow verified commit"})],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
def await_marker(repo,running,timeout=7):
    marker=repo/".git"/"arclane-accept-running"
    stop=time.monotonic()+timeout
    while not marker.exists() and time.monotonic()<stop:
        if running.poll() is not None:
            out,err=running.communicate()
            raise AssertionError(f"Git exited before hook: code={running.returncode} stdout={out} stderr={err}")
        time.sleep(.05)
    assert marker.exists(),"Slow operation never entered its pre-commit hook"
with tempfile.TemporaryDirectory(prefix="arclane-git-runtime-") as tmp:
    parent=pathlib.Path(tmp)
    repo=parent/"primary"
    original=setup(repo)
    git(repo,"branch","feature/linked")
    linked=parent/"linked"
    git(repo,"worktree","add","-q",str(linked),"feature/linked")
    other=parent/"unrelated"
    setup(other)
    (repo/"README.txt").write_bytes(b"changed\n")
    git(repo,"add","--all")
    slow_hook(repo,4)
    running=launch(repo)
    try:
        await_marker(repo,running)
        start=time.monotonic()
        blocked=call(linked,"stage_all",expected=False)
        assert "Another ArcLane process" in blocked.stderr,(blocked.stderr,blocked.stdout)
        assert time.monotonic()-start<2.8,"Second writer was queued or stalled"
        assert git(linked,"rev-parse","HEAD")==original
        assert git(linked,"status","--porcelain")==""
        print("PASS cross-process linked worktree mutation refused without waiting")
        unaffected=call(other,"stage_all",expected=True)
        assert unaffected.returncode==0
        print("PASS unrelated repository remains independently writable")
        result=running.communicate(timeout=18)
        assert running.returncode==0,result
        assert git(repo,"rev-parse","HEAD")!=original
        assert git(repo,"write-tree")==git(repo,"rev-parse","HEAD^{tree}")
        done=call(linked,"stage_all",expected=True)
        assert done.returncode==0
        print("PASS lock releases after successful slow Git operation")
    finally:
        if running.poll() is None:running.kill();running.wait(timeout=3)
    timeout_repo=parent/"timeout"
    start=setup(timeout_repo)
    (timeout_repo/"README.txt").write_bytes(b"staged-before-timeout\n")
    git(timeout_repo,"add","--all")
    staged=git(timeout_repo,"write-tree")
    slow_hook(timeout_repo,5)
    env={"ARCLANE_TEST_GIT_OPERATIONS":"1","ARCLANE_GIT_ACCEPT_TIMEOUT_MS":"300"}
    timed=call(timeout_repo,"commit",input="Timed commit",extra=env,expected=False,timeout=13)
    assert "timed out" in timed.stderr,timed.stderr
    assert "Completion may be unknown" in timed.stderr,timed.stderr
    assert git(timeout_repo,"rev-parse","HEAD")==start
    assert git(timeout_repo,"write-tree")==staged
    assert (timeout_repo/"README.txt").read_bytes()==b"staged-before-timeout\n"
    assert not (timeout_repo/".git"/"index.lock").exists()
    print("PASS timeout stops Git descendants, leaves unchanged HEAD and staged data")
    (timeout_repo/".git"/"hooks"/"pre-commit").unlink()
    done=call(timeout_repo,"commit",input="Recovered commit",expected=True)
    assert git(timeout_repo,"rev-parse","HEAD")!=start
    assert git(timeout_repo,"write-tree")==git(timeout_repo,"rev-parse","HEAD^{tree}")
    print("PASS fresh Git operation resumes after timeout without manual lock deletion")
print("PASS 5 grouped core Git runtime checks")
