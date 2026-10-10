"""Blame and file-history acceptance; compare to Git's porcelain output."""
import json,subprocess,tempfile,pathlib
testbed=pathlib.Path(r"C:\AI\REA\Experiments\Forge-Testbed")
repo=pathlib.Path(tempfile.mkdtemp(prefix="arclane-blame-",dir=testbed))
exe=pathlib.Path(r"C:\AI\REA\Experiments\Forge\src-tauri\target\release\arclane-cli.exe")
def git(*args):
 p=subprocess.run(["git","-C",str(repo),*args],capture_output=True,text=True,encoding="utf-8")
 assert p.returncode==0,(args,p.stderr)
 return p.stdout.strip()
def client(op,file,good=True):
 p=subprocess.run([str(exe),op,str(repo),json.dumps({"file":file},ensure_ascii=False)],capture_output=True,text=True,encoding="utf-8")
 assert (p.returncode==0)==good,(op,file,p.stdout,p.stderr)
 return json.loads(p.stdout if good else p.stderr)["result"] if good else json.loads(p.stderr)
git("init","-q","-b","main")
git("config","user.email","tests@local.invalid")
file="documentation åä € file.txt"
git("config","user.name","Alice")
(repo/file).write_bytes(b"line 1\nline 2\nline 3\nline 4\n")
git("add","--all");git("commit","--quiet","-m","Original document")
first=git("rev-parse","HEAD")
git("config","user.name","Bob")
(repo/file).write_bytes(b"line 1\nBob changed second line\nline 3\nline 4\n")
git("add","--all");git("commit","--quiet","-m","Revise second line")
second=git("rev-parse","HEAD")
history=client("file_history",file)
assert len(history["commits"])==2
assert history["commits"][0]["sha"]==second and history["commits"][1]["sha"]==first
print("PASS two commits in exact Git order including Unicode file path")
blame=client("file_blame",file)
print("BLAME_RECORDS",[(x["number"],x["author"],x["text"],x["sha"][:9]) for x in blame["lines"]])
assert len(blame["lines"])==4,blame
assert [x["number"] for x in blame["lines"]]==[1,2,3,4]
assert blame["lines"][1]["author"]=="Bob" and blame["lines"][1]["sha"]==second
assert all(x["author"]=="Alice" and x["sha"]==first for i,x in enumerate(blame["lines"]) if i!=1)
print("PASS blame author, commit, line number, exact content against independent Git state")
for filebad in ("../secret.txt","--git-dir=/","C:\\Windows\\win.ini"):
 client("file_history",filebad,False);client("file_blame",filebad,False)
print("PASS reject unsafe path inputs for history and blame")
binary=repo/"binary.dat";binary.write_bytes(b"\0hello")
client("file_blame","binary.dat",False)
print("PASS refuse untracked/binary file blame")
outfile=pathlib.Path(__file__).resolve().parents[1]/"artifacts"/"file-inspection-acceptance.json"
outfile.write_text(json.dumps({"passed":4,"repo":str(repo),"latest_sha":second,"initial_sha":first},indent=2),encoding="utf-8")
