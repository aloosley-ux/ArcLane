"""Hunk-level staging acceptance using an isolated repository and Git's own index."""
import pathlib,tempfile,subprocess,json
testbed=pathlib.Path(r"C:\AI\REA\Experiments\Forge-Testbed")
repo=pathlib.Path(tempfile.mkdtemp(prefix="arclane-hunks-",dir=testbed))
exe=pathlib.Path(r"C:\AI\REA\Experiments\Forge\src-tauri\target\release\arclane-cli.exe")
def git(*v):
 r=subprocess.run(["git","-C",str(repo),*v],capture_output=True,text=True,encoding="utf-8")
 if r.returncode:raise AssertionError((v,r.stderr))
 return r.stdout
def cli(op,opts,good=True):
 r=subprocess.run([str(exe),op,str(repo),json.dumps(opts)],capture_output=True,text=True,encoding="utf-8")
 assert (r.returncode==0)==good,(op,opts,r.stderr,r.stdout)
 return json.loads(r.stdout if good else r.stderr)
git("init","-b","main")
git("config","user.name","Arclane Test")
git("config","user.email","test@local.invalid")
p=repo/"hunk testing.txt"
data=[f"line {i:03d}\n" for i in range(1,91)]
p.write_text("".join(data),encoding="utf-8")
git("add","--all");git("commit","-m","base")
for i in (5,45,85):data[i-1]=f"UPDATED {i:03d}\n"
p.write_text("".join(data),encoding="utf-8")
h=cli("hunks",{"file":p.name,"staged":False})["result"]["hunks"]
assert len(h)==3,("Expected three context-separated hunks",len(h))
cli("apply_hunk",{"file":p.name,"staged":False,"index":1})
cached=git("diff","--cached","--",p.name)
assert "+UPDATED 045" in cached and "+UPDATED 005" not in cached and "+UPDATED 085" not in cached
assert p.read_text(encoding="utf-8")=="".join(data)
remaining=cli("hunks",{"file":p.name,"staged":False})["result"]["hunks"]
assert len(remaining)==2,len(remaining)
staged=cli("hunks",{"file":p.name,"staged":True})["result"]["hunks"]
assert len(staged)==1
cli("apply_hunk",{"file":p.name,"staged":True,"index":0})
assert git("diff","--cached","--",p.name)==""
assert len(cli("hunks",{"file":p.name,"staged":False})["result"]["hunks"])==3
cli("apply_hunk",{"file":p.name,"staged":False,"index":20},good=False)
cli("hunks",{"file":"../important.txt","staged":False},good=False)
cli("hunks",{"file":"--upload-pack=attacker","staged":False},good=False)
unicode_name="årlig plan's $eta.txt"
q=repo/unicode_name
q.write_text("a\n"*25,encoding="utf-8");git("add","--",unicode_name);git("commit","-m","unicode filename")
q.write_text("changed\n"+"a\n"*24,encoding="utf-8")
uh=cli("hunks",{"file":unicode_name,"staged":False})["result"]["hunks"]
assert len(uh)==1
cli("apply_hunk",{"file":unicode_name,"staged":False,"index":0})
assert unicode_name in git("-c","core.quotepath=false","diff","--cached","--name-only")
print("PASS 3 independent tracked-file hunks")
print("PASS middle hunk exclusively staged; worktree unchanged")
print("PASS remaining hunks accurate after partial stage")
print("PASS reverse selected staged hunk; exact index restored")
print("PASS out-of-range, traversal and flag paths refused")
print("PASS Unicode/space/apostrophe/dollar filenames")
result={"passed":6,"repo":str(repo),"first_fixture_hunks":3,"tests":["separate hunks","selected staged index","unselected hunks","reverse staging","invalid argument rejection","Unicode paths"]}
a=pathlib.Path(r"C:\AI\REA\Experiments\Arclane\artifacts\hunk-acceptance.json");a.parent.mkdir(exist_ok=True);a.write_text(json.dumps(result,indent=2))
