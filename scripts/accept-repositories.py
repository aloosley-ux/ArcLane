"""Repository cloning and initialization fixture acceptance."""
import pathlib,tempfile,subprocess,json
root=pathlib.Path(r"C:\AI\REA\Experiments\Forge-Testbed")
src=pathlib.Path(tempfile.mkdtemp(prefix="arclane-repo-source-",dir=root))
dst=pathlib.Path(tempfile.mkdtemp(prefix="arclane-clone-parent-",dir=root))
initial=pathlib.Path(tempfile.mkdtemp(prefix="arclane-init-",dir=root))
nested=src/"nested"
cli=pathlib.Path(r"C:\AI\REA\Experiments\Forge\src-tauri\target\release\arclane-cli.exe")
def git(*args):
 p=subprocess.run(["git",*args],capture_output=True,text=True,encoding="utf-8")
 if p.returncode:raise AssertionError(f"git {args}: {p.stderr}")
 return p.stdout.strip()
def call(cmd,arg,opt={},expect=True):
 p=subprocess.run([str(cli),cmd,str(arg),json.dumps(opt)],capture_output=True,text=True,encoding="utf-8")
 assert (p.returncode==0)==expect,(cmd,arg,opt,p.stdout,p.stderr)
 return json.loads(p.stdout if expect else p.stderr)
git("-C",str(src),"init","-b","main")
git("-C",str(src),"config","user.name","Arclane")
git("-C",str(src),"config","user.email","test@local.invalid")
(src/"my file.txt").write_text("clone verified\n")
git("-C",str(src),"add","--all")
git("-C",str(src),"commit","-m","initial commit")
result=call("clone",src,{"parent":str(dst)})["result"]
cloned=pathlib.Path(result["path"])
assert cloned.is_dir()
assert git("-C",str(cloned),"rev-parse","HEAD")==git("-C",str(src),"rev-parse","HEAD")
assert (cloned/"my file.txt").read_text()=="clone verified\n"
print("PASS Clone existing local repo; independently verify SHA and file bytes")
call("clone",src,{"parent":str(dst)},False)
assert (cloned/"my file.txt").read_text()=="clone verified\n"
print("PASS Refuse to overwrite clone destination")
call("clone","ext::evil",{"parent":str(dst)},False)
call("clone","--upload-pack=evil",{"parent":str(dst)},False)
call("clone","file:///etc/shadow",{"parent":str(dst)},False)
print("PASS Reject injection and disallowed Git transports")
new=call("init",initial)["result"]
assert pathlib.Path(new["path"]).samefile(initial)
assert (initial/".git").is_dir()
print("PASS Initialize existing folder")
nested.mkdir()
call("init",nested,expect=False)
call("init",initial,expect=False)
print("PASS Reject nested or duplicate repository initialization")
result={"passed":5,"source":str(src),"clone":str(cloned),"initialized":str(initial)}
out=pathlib.Path(__file__).resolve().parents[1]/"artifacts"/"repository-acceptance.json"
out.write_text(json.dumps(result,indent=2))
