"""Disposable Git acceptance for ordered cherry-pick and recovery.
Runs against the real Rust CLI; never mutates the ArcLane checkout.
ARCLANE_CLI must identify a compiled arclane-cli binary.
"""
import json
import os
import pathlib
import subprocess
import tempfile

CLI = os.environ.get("ARCLANE_CLI")
if not CLI or not pathlib.Path(CLI).is_file():
    raise SystemExit("Set ARCLANE_CLI to a compiled ArcLane CLI path")

def git(repo, *args):
    result = subprocess.run(["git", "-C", str(repo), *args], text=True, capture_output=True, check=True)
    return result.stdout.strip()

def invoke(repo, op, payload="", *, ok=True):
    options = json.dumps({"op": op, "input": payload})
    result = subprocess.run([CLI, "action", str(repo), options], text=True, capture_output=True)
    assert (result.returncode == 0) == ok, f"{op}: {result.stdout} {result.stderr}"
    return json.loads(result.stdout if ok else result.stderr)

def write(repo, name, contents):
    (repo / name).write_text(contents, encoding="utf-8", newline="\n")

def commit(repo, name, value, subject):
    write(repo, name, value)
    git(repo, "add", "--", name)
    git(repo, "commit", "-qm", subject)
    return git(repo, "rev-parse", "HEAD")

with tempfile.TemporaryDirectory(prefix="arclane-pick-series-") as temp:
    repo = pathlib.Path(temp) / "fixture"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "main")
    git(repo, "config", "user.name", "ArcLane Test")
    git(repo, "config", "user.email", "accept@invalid.local")
    git(repo, "config", "core.autocrlf", "false")
    commit(repo, "root.txt", "root\n", "Base")
    git(repo, "switch", "-qc", "source")
    one = commit(repo, "one.txt", "one\n", "One")
    two = commit(repo, "two.txt", "two\n", "Two")
    git(repo, "switch", "-q", "main")
    initial = git(repo, "rev-parse", "HEAD")
    def plan(commits, expected=initial):
        return json.dumps({"expectedHead": expected, "commits": commits})

    for payload in [plan([one, one]), plan(["f" * 40]), plan([])]:
        invoke(repo, "cherry_pick_series", payload, ok=False)
        assert git(repo, "rev-parse", "HEAD") == initial
    print("PASS duplicate/unresolved/empty plans refuse writes")
    write(repo, "untracked.txt", "untouched\n")
    invoke(repo, "cherry_pick_series", plan([one, two]), ok=False)
    assert git(repo, "rev-parse", "HEAD") == initial
    (repo / "untracked.txt").unlink()
    print("PASS dirty/untracked worktree refused")
    invoke(repo, "cherry_pick_series", plan([two, one]))
    assert git(repo, "log", "-2", "--format=%s").splitlines() == ["One", "Two"]
    assert (repo / "one.txt").read_bytes() == b"one\n"
    assert (repo / "two.txt").read_bytes() == b"two\n"
    assert git(repo, "write-tree") == git(repo, "rev-parse", "HEAD^{tree}")
    after = git(repo, "rev-parse", "HEAD")
    print("PASS exact user order, HEAD parents, worktree and index")
    invoke(repo, "cherry_pick_series", plan([one, two]), ok=False)
    assert git(repo, "rev-parse", "HEAD") == after
    print("PASS stale HEAD refuses write")

    git(repo, "switch", "-qc", "conflict-source", "main")
    source_conflict = commit(repo, "collision.txt", "incoming\n", "Incoming")
    trailing = commit(repo, "trailing.txt", "trailing\n", "Trailing")
    git(repo, "switch", "-q", "main")
    commit(repo, "collision.txt", "local\n", "Local")
    start = git(repo, "rev-parse", "HEAD")
    start_tree = git(repo, "write-tree")
    invoke(repo, "cherry_pick_series", plan([source_conflict, trailing], start), ok=False)
    assert git(repo, "rev-parse", "HEAD") == start
    assert "UU collision.txt" in git(repo, "status", "--porcelain")
    assert (repo / ".git" / "CHERRY_PICK_HEAD").exists()
    invoke(repo, "cherry_pick_abort")
    assert git(repo, "rev-parse", "HEAD") == start
    assert git(repo, "write-tree") == start_tree
    assert (repo / "collision.txt").read_bytes() == b"local\n"
    assert not (repo / "trailing.txt").exists()
    print("PASS conflict pauses, abort restores exact ref/index/files")

    invoke(repo, "cherry_pick_series", plan([source_conflict, trailing], start), ok=False)
    write(repo, "collision.txt", "resolved\n")
    git(repo, "add", "--", "collision.txt")
    invoke(repo, "cherry_pick_continue")
    assert git(repo, "log", "-2", "--format=%s").splitlines() == ["Trailing", "Incoming"]
    assert (repo / "collision.txt").read_bytes() == b"resolved\n"
    assert (repo / "trailing.txt").read_bytes() == b"trailing\n"
    assert git(repo, "write-tree") == git(repo, "rev-parse", "HEAD^{tree}")
    print("PASS resolved conflict resumes complete ordered sequence")
print("PASS 6 grouped cherry-pick-series checks")
