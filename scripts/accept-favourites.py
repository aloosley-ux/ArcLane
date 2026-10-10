"""Backward-compatible favourites storage tests. All writes stay in disposable fixtures."""
import json,os,pathlib,subprocess,tempfile
CLI=os.getenv("ARCLANE_CLI")
assert CLI and pathlib.Path(CLI).is_file(),"Compile arclane-cli; set ARCLANE_CLI"
def cli(mode,root,payload=None,ok=True):
    env={**os.environ,"ARCLANE_DATA_DIR":str(root/"profile")}
    args=[CLI,mode,str(root/"r1")]
    if payload is not None:args.append(json.dumps(payload))
    p=subprocess.run(args,text=True,capture_output=True,env=env,timeout=15)
    assert (p.returncode==0)==ok,(mode,p.stdout,p.stderr)
    return json.loads(p.stdout if ok else p.stderr)
def git(path,*args):
    p=subprocess.run(["git","-C",str(path),*args],capture_output=True,text=True)
    assert p.returncode==0,(p.stderr,args)
    return p.stdout.strip()
with tempfile.TemporaryDirectory(prefix="arclane-favourites-") as temp:
    root=pathlib.Path(temp)
    repos=[]
    for i in (1,2):
        p=root/f"r{i}";p.mkdir();git(p,"init","-q","-b","main")
        git(p,"config","user.name","Fixture");git(p,"config","user.email","fixture@invalid.local")
        (p/"readme.txt").write_bytes(f"fixture {i}\n".encode())
        git(p,"add","--all");git(p,"commit","-qm","Start")
        repos.append(p)
    before=[(git(p,"rev-parse","HEAD"),git(p,"write-tree")) for p in repos]
    profile=root/"profile";profile.mkdir()
    (profile/"workspace.json").write_text(json.dumps({"tabs":[],"active":None,"closed":[]}),encoding="utf-8")
    state=cli("workspace",root)["result"]
    assert state["favourites"]==[]
    print("PASS old workspace files load with empty favourites")
    favourite=[str(repos[0]),str(repos[1]),str(repos[0]).upper()]
    saved=cli("save_workspace",root,{"tabs":[],"active":None,"closed":[],"favourites":favourite})["result"]
    assert len(saved["favourites"])==2,saved
    assert cli("workspace",root)["result"]["favourites"]==[str(p) for p in repos]
    print("PASS favourites persist without tabs; duplicates canonicalized")
    missing=str(root/"missing")
    result=cli("save_workspace",root,{"tabs":[],"active":None,"closed":[],"favourites":[missing]},ok=False)
    assert "error" in result
    assert len(cli("workspace",root)["result"]["favourites"])==2
    print("PASS invalid favourite rejected without clobbering saved settings")
    (profile/"workspace.json").write_text(json.dumps({"tabs":[],"active":None,"closed":[],"favourites":[missing,str(repos[1])]}),encoding="utf-8")
    assert cli("workspace",root)["result"]["favourites"]==[str(repos[1])]
    print("PASS moved or missing repository safely skipped on startup")
    after=[(git(p,"rev-parse","HEAD"),git(p,"write-tree")) for p in repos]
    assert before==after
    print("PASS exact HEAD and indexes unchanged")
print("PASS 5 favourite workspace groups")
