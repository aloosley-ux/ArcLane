"""Agent workspace Git and executable guards against a disposable fixture."""
import hashlib
import json
import os
import pathlib
import subprocess
import tempfile

CLI=pathlib.Path(os.environ.get("ARCLANE_CLI", ""))
if not CLI.is_file():
    raise SystemExit("Set ARCLANE_CLI to the compiled arclane-cli.exe")
FIXTURE_ROOT=pathlib.Path(r"C:\AI\REA\Experiments\Forge-Testbed")
FIXTURE_ROOT.mkdir(parents=True,exist_ok=True)

def run(args,cwd=None,ok=True):
    p=subprocess.run(args,cwd=cwd,text=True,encoding="utf-8",errors="replace",capture_output=True)
    assert (p.returncode==0)==ok,(args,p.stdout,p.stderr)
    return p.stdout.strip()

def git(repo,*args,ok=True):
    return run(["git","--literal-pathspecs","-C",str(repo),*args],ok=ok)

def cli(mode,repo,payload=None,ok=True):
    args=[str(CLI),mode,str(repo)]
    if payload is not None: args.append(json.dumps(payload,ensure_ascii=False))
    result=run(args,ok=ok)
    return json.loads(result if ok else run(args,ok=False) or "{}") if ok else result

with tempfile.TemporaryDirectory(prefix="arclane-agent-workspaces-",dir=FIXTURE_ROOT) as temp:
    root=pathlib.Path(temp)
    repo=root/"primary repo [東京]"
    repo.mkdir()
    git(repo,"init","-q","-b","main")
    git(repo,"config","user.name","ArcLane fixture")
    git(repo,"config","user.email","agent-fixture@invalid.local")
    git(repo,"config","core.autocrlf","false")
    tracked=repo/"tracked.txt"
    tracked.write_bytes(b"base\n")
    git(repo,"add","tracked.txt")
    git(repo,"commit","-qm","Base")
    head=git(repo,"rev-parse","HEAD")
    git(repo,"branch","feature/exists")
    tracked.write_bytes(b"staged bytes\n")
    git(repo,"add","tracked.txt")
    tracked.write_bytes("worktree bytes [東京]\n".encode("utf-8"))
    (repo/"untracked [space].txt").write_bytes(b"untracked bytes\n")
    refs_before=git(repo,"show-ref")
    index_path=pathlib.Path(git(repo,"rev-parse","--git-path","index"))
    if not index_path.is_absolute(): index_path=repo/index_path
    index_before=hashlib.sha256(index_path.read_bytes()).hexdigest()
    status_before=git(repo,"status","--porcelain=v1","-z")
    worktree=pathlib.Path(temp)/"linked checkout [東京]"

    for branch,path in [("bad branch",worktree),("-option",worktree),("feature/bad?name",worktree)]:
        cli("action",repo,{"op":"worktree_add","file":str(path),"input":branch},ok=False)
        assert not path.exists(),(branch,path)
    cli("action",repo,{"op":"worktree_add","file":"relative checkout","input":"feature/relative"},ok=False)
    cli("action",repo,{"op":"worktree_add","file":str(pathlib.Path(temp)/".."/"escape"),"input":"feature/traversal"},ok=False)
    assert not (root/"escape").exists()
    print("PASS invalid branch, relative path and traversal refused without a checkout")

    cli("action",repo,{"op":"worktree_add","file":str(worktree),"input":"feature/agent-東京"})
    assert git(worktree,"branch","--show-current")=="feature/agent-東京"
    assert git(worktree,"rev-parse","HEAD")==head
    assert git(worktree,"status","--porcelain")==""
    assert (worktree/"tracked.txt").read_bytes()==b"base\n"
    assert git(repo,"rev-parse","HEAD")==head
    assert git(repo,"status","--porcelain=v1","-z")==status_before
    assert hashlib.sha256(index_path.read_bytes()).hexdigest()==index_before
    refs_after=git(repo,"show-ref")
    assert set(refs_after.splitlines())-set(refs_before.splitlines())=={head+" refs/heads/feature/agent-東京"}
    listed=json.loads(run([str(CLI),"inspect",str(worktree)]))["result"]["worktrees"]
    assert len({w["commonDir"] for w in listed})==1
    assert pathlib.Path(next(w["path"] for w in listed if w["main"]))==repo
    print("PASS new branch checkout keeps shared identity and leaves primary HEAD, staged index and WIP bytes unchanged")

    literal_branch="feature/agent-$(whoami);&"
    literal_path=pathlib.Path(temp)/"checkout [literal]"
    cli("action",repo,{"op":"worktree_add","file":str(literal_path),"input":literal_branch})
    assert git(literal_path,"branch","--show-current")==literal_branch
    assert not (repo/"whoami").exists()
    print("PASS shell-shaped branch text remains a literal Git argv value; no shell command is evaluated")

    duplicate=pathlib.Path(temp)/"duplicate"
    cli("action",repo,{"op":"worktree_add","file":str(duplicate),"input":"feature/agent-東京"},ok=False)
    assert not duplicate.exists()
    existing=pathlib.Path(temp)/"existing branch"
    cli("action",repo,{"op":"worktree_add_existing","file":str(existing),"input":"feature/exists"})
    assert git(existing,"branch","--show-current")=="feature/exists"
    conflict=pathlib.Path(temp)/"primary repo [東京]"
    cli("action",repo,{"op":"worktree_add","file":str(conflict),"input":"feature/conflict"},ok=False)
    print("PASS checked-out branches and occupied destinations refuse safely; existing branch attaches")

    binary=root/"codex.exe"
    binary.write_bytes(b"MZ fixture executable bytes; validation never runs this file")
    validated=cli("agent_validate",repo,{"agent":"codex","path":str(binary)})
    validated_path=validated["result"]["path"].removeprefix("\\\\?\\")
    assert os.path.normcase(validated_path)==os.path.normcase(str(binary.resolve())),validated
    for agent,path in [("codex",str(root/"unknown.exe")),("codex",str(root/"other.exe")),("kilo",str(binary)),("other",str(binary))]:
        cli("agent_validate",repo,{"agent":agent,"path":path},ok=False)
    cli("agent_validate",repo,{"agent":"codex","path":"relative/codex.exe"},ok=False)
    invalid_binary=root/"invalid-codex.exe"
    invalid_binary.write_bytes(b"not a Windows executable")
    cli("agent_validate",repo,{"agent":"codex","path":str(invalid_binary)},ok=False)
    print("PASS executable path validation accepts a Windows executable signature and rejects missing, invalid, wrong-agent and relative paths")

    # CLI discovery is metadata-only and does not start the installed agent.
    before=git(repo,"status","--porcelain=v1","-z")
    discovery=cli("agent_discover",repo)
    assert {a["agent"] for a in discovery["result"]}=={"codex","kilo"}
    assert all("available" in a and "path" in a for a in discovery["result"])
    assert git(repo,"status","--porcelain=v1","-z")==before
    print("PASS on-demand Codex/Kilo discovery reports availability without mutating repository state")
print("PASS agent workspace backend acceptance: 5 grouped checks")
