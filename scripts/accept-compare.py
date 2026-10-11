from fixture_support import cli_path
"""Read-only side-by-side Git content acceptance on a fresh isolated repository."""
import subprocess,tempfile,json,pathlib
root=pathlib.Path(r"C:\AI\REA\Experiments\Forge-Testbed")
repo=pathlib.Path(tempfile.mkdtemp(prefix="arclane-side-by-side-",dir=root))
cli=cli_path()
checks=[]
def git(*args):
 result=subprocess.run(["git","-C",str(repo),*args],encoding="utf-8",text=True,capture_output=True)
 assert result.returncode==0,(args,result.stderr)
 return result.stdout.strip()
def api(file,staged=False,commit=None,expect=True):
 opts={"file":file,"staged":staged}
 if commit:opts["commit"]=commit
 result=subprocess.run([str(cli),"compare",str(repo),json.dumps(opts,ensure_ascii=False)],encoding="utf-8",text=True,capture_output=True)
 assert (result.returncode==0)==expect,(opts,result.stderr,result.stdout)
 if expect:return json.loads(result.stdout)["result"]
 return json.loads(result.stderr)
def check(name,condition):
 assert condition,name
 checks.append(name);print("PASS",name,flush=True)
git("init","-b","main","-q")
git("config","user.name","Arclane Tests");git("config","user.email","test@localhost.invalid")
file="README notes.txt";p=repo/file
base="one\ntwo\nthree\n";stage="one\nINDEX CHANGE\nthree\n";work="one\nWORKTREE CHANGE\nthree\n"
p.write_bytes(base.encode("utf-8"))
git("add","--all");git("commit","-m","initial","--quiet")
p.write_bytes(stage.encode("utf-8"))
d=api(file)
check("Unstaged compares Git index vs worktree",d["before"]==base and d["after"]==stage and d["leftLabel"]=="Staging area")
git("add","--",file)
d=api(file,True)
check("Staged compares HEAD vs index",d["before"]==base and d["after"]==stage and d["rightLabel"]=="Staging area")
p.write_bytes(work.encode("utf-8"))
d=api(file)
check("Partially staged compares actual index vs current file",d["before"]==stage and d["after"]==work)
utf="år's € invoice.txt"
(repo/utf).write_bytes(b"hello\n")
d=api(utf)
check("Unicode untracked file uses empty old content",d["before"]=="" and d["after"]=="hello\n" and not d["beforeExists"])
git("add","--",utf)
d=api(utf,True)
check("Unicode added file staged snapshot",d["after"]=="hello\n" and not d["beforeExists"])
p.write_bytes(stage.encode("utf-8"))
git("commit","-m","Staged update","--quiet")
sha=git("rev-parse","HEAD")
d=api(file,commit=sha)
check("Commit SHA compares parent vs committed snapshot",d["before"]==base and d["after"]==stage and d["leftLabel"]=="Parent commit")
p.unlink()
d=api(file)
check("Deleted worktree file has missing after",d["before"]==stage and not d["afterExists"])
for unsafe in ("../secret","-c.evil","C:\\Windows\\system.ini"):
 api(unsafe,expect=False)
checks.append("Traversal, option and absolute paths rejected")
print("PASS",checks[-1])
(repo/"binary.dat").write_bytes(b"ok\x00unsafe")
api("binary.dat",expect=False)
checks.append("Binary text comparison rejected");print("PASS",checks[-1])
out=pathlib.Path(__file__).resolve().parents[1]/"artifacts"/"compare-acceptance.json"
out.write_text(json.dumps({"passed":len(checks),"tests":checks,"repo":str(repo)},indent=2),encoding="utf-8")
print("ACCEPTED",len(checks),"checks")
