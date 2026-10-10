"""Conflict editor tests: separate disposable repos; independent Git index verification."""
from pathlib import Path
import json,subprocess,tempfile
testbed=Path(r"C:\AI\REA\Experiments\Forge-Testbed")
cli=Path(r"C:\AI\REA\Experiments\Forge\src-tauri\target\release\arclane-cli.exe")
passed=[]
def repo_fixture(filename):
    root=Path(tempfile.mkdtemp(prefix="arclane-conflicts-",dir=testbed))
    def git(*args,expect=True):
        process=subprocess.run(["git","-C",str(root),*args],capture_output=True,text=True,encoding="utf-8")
        if expect and process.returncode:raise AssertionError((args,process.stderr))
        return process.stdout.strip()
    def cli_call(op,opt={},expect=True):
        process=subprocess.run([str(cli),op,str(root),json.dumps(opt,ensure_ascii=False)],capture_output=True,text=True,encoding="utf-8")
        if (process.returncode==0)!=expect:raise AssertionError((op,opt,process.stdout,process.stderr))
        return json.loads(process.stdout if expect else process.stderr)
    git("init","-q","-b","main")
    git("config","user.name","Arclane Tests")
    git("config","user.email","tests@localhost.invalid")
    f=root/filename
    initial="start\nshared\nend\n";f.write_text(initial,encoding="utf-8")
    git("add","--all");git("commit","-m","initial","--quiet")
    git("branch","feature")
    f.write_text("start\nMAIN CHANGE\nend\n",encoding="utf-8")
    git("add","--all");git("commit","-m","main edit","--quiet")
    git("switch","feature","-q")
    f.write_text("start\nFEATURE CHANGE\nend\n",encoding="utf-8")
    git("add","--all");git("commit","-m","feature edit","--quiet")
    git("switch","main","-q")
    git("merge","feature","--no-edit",expect=False)
    assert "UU" in git("status","--short")
    return root,git,cli_call,f
for choice,want in [("ours","start\nMAIN CHANGE\nend\n"),("theirs","start\nFEATURE CHANGE\nend\n"),("manual","start\nCOMBINED SOLUTION\nend\n")]:
    root,git,call,file=repo_fixture("merge notes.txt")
    conflicts=call("conflicts")["result"]
    assert conflicts["count"]==1 and conflicts["files"][0]["path"]==file.name
    assert conflicts["files"][0]["base"] and conflicts["files"][0]["ours"] and conflicts["files"][0]["theirs"]
    report=call("inspect_conflict",{"file":file.name})["result"]
    assert report["base"]=="start\nshared\nend\n"
    assert report["ours"]=="start\nMAIN CHANGE\nend\n"
    assert report["theirs"]=="start\nFEATURE CHANGE\nend\n"
    call("resolve_conflict",{"file":file.name,"choice":choice,**({"manual":want} if choice=="manual" else {})})
    assert file.read_text(encoding="utf-8")==want
    assert git("ls-files","-u")=="" # staged index has no unresolved entries
    assert git("show",":"+file.name)==want.strip("\n")
    assert call("conflicts")["result"]["count"]==0
    git("commit","-m","Merge resolved","--quiet")
    assert git("rev-list","--parents","-n","1","HEAD").count(" ")==2
    passed.append("inspect three-way then resolve "+choice)
    print("PASS",passed[-1],flush=True)
root,git,call,file=repo_fixture("Unicode åä note's.txt")
for invalid in ("../outside.txt","-c.uploadpack","C:\\Windows\\win.ini"):
    call("inspect_conflict",{"file":invalid},False)
    call("resolve_conflict",{"file":invalid,"choice":"manual","manual":"X"},False)
passed.append("refuse traversal/absolute/flag-injection paths")
call("resolve_conflict",{"file":file.name,"choice":"manual","manual":"line 1\nline 2\n"})
assert git("ls-files","-u")==""
assert file.read_text(encoding="utf-8")=="line 1\nline 2\n"
passed.append("Unicode filename + newline preservation")
call("resolve_conflict",{"file":file.name,"choice":"ours"},False)
passed.append("reject resolution when no conflict remains")
print(*("PASS "+v for v in passed[3:]),sep="\n")
result={"passed":len(passed),"checks":passed,"last_fixture":str(root)}
out=Path(r"C:\AI\REA\Experiments\Arclane\artifacts\conflicts-acceptance.json")
out.write_text(json.dumps(result,indent=2),encoding="utf-8")
print("ACCEPTED",len(passed),"conflict checks")
