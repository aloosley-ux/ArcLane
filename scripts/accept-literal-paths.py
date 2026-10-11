from fixture_support import cli_path
"""Single-file operations must treat selected filenames literally, not as Git patterns."""
import json
import pathlib
import subprocess
import tempfile

base = pathlib.Path(__file__).resolve().parents[1]
repo = pathlib.Path(tempfile.mkdtemp(prefix="arclane-literal-paths-", dir=r"C:\AI\REA\Experiments\Forge-Testbed"))
cli = cli_path()
checks = []
selected, neighbour = "notes[1].txt", "notes1.txt"

def git(*args):
    return subprocess.run(["git", "--literal-pathspecs", "-C", str(repo), *args], check=True,
                          capture_output=True, encoding="utf-8").stdout.rstrip("\r\n")

def call(command, params, success=True):
    result = subprocess.run([str(cli), command, str(repo), json.dumps(params)],
                            capture_output=True, encoding="utf-8", timeout=20)
    assert (result.returncode == 0) == success, (command, params, result.stdout, result.stderr)
    return json.loads(result.stdout if success else result.stderr).get("result", {})

def action(op, file):
    return call("action", {"op": op, "file": file})

def passed(label):
    checks.append(label)
    print("PASS", label, flush=True)

def edit():
    (repo / selected).write_bytes(b"selected changed\n")
    (repo / neighbour).write_bytes(b"neighbour changed\n")

def index_names():
    return git("diff", "--cached", "--name-only", "-z").strip("\0").split("\0")

git("init", "-q", "-b", "main")
git("config", "user.name", "Arclane literal path test")
git("config", "user.email", "test@invalid.local")
git("config", "core.autocrlf", "false")
for file in (selected, neighbour):
    (repo / file).write_bytes((file + " original\n").encode())
git("add", "--all")
git("commit", "-q", "-m", "Initial files")
initial = git("rev-parse", "HEAD")
edit()

action("stage", selected)
assert index_names() == [selected], ("Single-file stage affected other paths", index_names())
assert (repo / neighbour).read_bytes() == b"neighbour changed\n"
passed("Stage bracket filename only; neighbouring match remains unstaged")

action("stage", neighbour)
action("unstage", selected)
assert index_names() == [neighbour], index_names()
assert git("show", ":" + selected) == selected + " original"
passed("Unstage bracket filename only; neighbouring index entry preserved")
action("unstage", neighbour)

patch = call("diff", {"file": selected})["text"]
assert "selected changed" in patch and "neighbour changed" not in patch
hunks = call("hunks", {"file": selected})["hunks"]
assert len(hunks) == 1 and "neighbour changed" not in hunks[0]["text"]
passed("Patch and hunk inspection contain only selected file")
call("apply_hunk", {"file": selected, "index": 0})
assert index_names() == [selected]
call("apply_hunk", {"file": selected, "index": 0, "staged": True})
assert git("diff", "--cached") == ""
passed("Stage and reverse a bracket-named hunk without touching other index entries")

action("discard_file", selected)
assert (repo / selected).read_bytes() == (selected + " original\n").encode()
assert (repo / neighbour).read_bytes() == b"neighbour changed\n"
passed("Discard selected file preserves neighbouring worktree bytes")

edit()
action("stage", selected)
git("commit", "-q", "-m", "Selected file revision")
selected_commit = git("rev-parse", "HEAD")
action("stage", neighbour)
git("commit", "-q", "-m", "Neighbour-only revision")
history = call("file_history", {"file": selected})["commits"]
assert [entry["sha"] for entry in history] == [selected_commit, initial]
patch = call("diff", {"file": selected, "commit": selected_commit})["text"]
assert "selected changed" in patch and "neighbour changed" not in patch
passed("File history and committed diff follow selected literal path")

call("tool_action", {"op": "restore_commit_file", "file": initial, "input": selected})
assert (repo / selected).read_bytes() == (selected + " original\n").encode()
assert (repo / neighbour).read_bytes() == b"neighbour changed\n"
assert git("show", ":" + selected) == "selected changed"
passed("Historical restore preserves neighbouring worktree and selected index")

for selector in ("notes*.txt", ":(glob)*", ":(top)**", ":(exclude)notes1.txt"):
    index, worktree = git("write-tree"), {p.name: p.read_bytes() for p in repo.glob("*.txt")}
    call("action", {"op": "stage", "file": selector}, False)
    call("action", {"op": "discard_file", "file": selector}, False)
    assert git("write-tree") == index
    assert {p.name: p.read_bytes() for p in repo.glob("*.txt")} == worktree
passed("Wildcard and pathspec-magic inputs cannot expand single-file mutations")

draft = "draft[1].txt"
(repo / draft).write_bytes(b"untracked draft\n")
saved = {p.name: p.read_bytes() for p in repo.glob("*.txt")}
call("action", {"op": "stash", "input": "Literal filename regression"})
assert not (repo / draft).exists() and git("status", "--porcelain") == ""
call("action", {"op": "stash_pop", "input": "stash@{0}"})
assert {p.name: p.read_bytes() for p in repo.glob("*.txt")} == saved
assert git("stash", "list") == ""
passed("Stash still removes and restores tracked and untracked bracket filenames")

call("action", {"op": "stage_all"})
git("commit", "-q", "-m", "Prepare conflict fixture")
git("switch", "-q", "-c", "literal-conflict")
for file in (selected, neighbour):
    (repo / file).write_bytes(b"theirs\n")
git("add", "--all")
git("commit", "-q", "-m", "Incoming changes")
git("switch", "-q", "main")
for file in (selected, neighbour):
    (repo / file).write_bytes(b"ours\n")
git("add", "--all")
git("commit", "-q", "-m", "Current changes")
call("action", {"op": "merge", "input": "literal-conflict"}, False)
unmerged = git("ls-files", "-u", "-z", "--", neighbour)
call("resolve_conflict", {"file": selected, "choice": "theirs"})
assert (repo / selected).read_bytes() == b"theirs\n"
assert git("show", ":" + selected) == "theirs"
assert git("ls-files", "-u", "-z", "--", neighbour) == unmerged
assert git("ls-files", "-u", "--", selected) == ""
passed("Resolving bracket filename stages only selected conflict; neighbour remains unmerged")

output = base / "artifacts" / "literal-paths-acceptance.json"
output.write_text(json.dumps({"repo": str(repo), "checks": checks, "passed": len(checks)}, indent=2), encoding="utf-8")
print("ACCEPTED", len(checks), "literal-path groups")
