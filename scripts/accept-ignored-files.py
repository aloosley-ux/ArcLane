#!/usr/bin/env python3
"""Disposable Git fixture acceptance for ArcLane's on-demand ignored paths."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = Path(r"C:\AI\REA\Experiments\Forge-Testbed")
CLI = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "src-tauri" / "target" / "release" / "arclane-cli.exe"


def run(args: list[str], cwd: Path | None = None, *, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(args, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode:
        raise AssertionError(
            f"Command failed ({result.returncode}): {args!r}\n"
            f"stdout={result.stdout!r}\nstderr={result.stderr!r}"
        )
    return result


def git(repo: Path, *args: str, check: bool = True, literal: bool = False) -> bytes:
    prefix = ["git", "--literal-pathspecs"] if literal else ["git"]
    return run([*prefix, "-C", str(repo), *args], check=check).stdout


def decode_paths(raw: bytes) -> list[str]:
    return [item.decode("utf-8") for item in raw.split(b"\0") if item]


def porcelain_ignored(repo: Path) -> list[str]:
    rows = git(repo, "status", "--porcelain=v1", "-z", "--ignored", "--untracked-files=normal").split(b"\0")
    return [row[3:].decode("utf-8") for row in rows if row.startswith(b"!! ")]


def file_bytes(repo: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for current, dirs, files in os.walk(repo):
        dirs[:] = [name for name in dirs if name != ".git"]
        for name in files:
            path = Path(current, name)
            if path.is_file():
                result[path.relative_to(repo).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def git_state(repo: Path) -> dict[str, object]:
    index = repo / ".git" / "index"
    return {
        "head": git(repo, "rev-parse", "HEAD").decode().strip(),
        "refs": git(repo, "for-each-ref", "--format=%(refname) %(objectname)").decode(),
        "tree": git(repo, "write-tree").decode().strip(),
        "status": git(repo, "status", "--porcelain=v1", "-z", "--ignored", "--untracked-files=all"),
        "index": hashlib.sha256(index.read_bytes()).hexdigest(),
        "files": file_bytes(repo),
    }


def cli(repo: Path, options: dict[str, object]) -> tuple[subprocess.CompletedProcess[bytes], dict[str, object] | None]:
    result = run([str(CLI), "ignored", str(repo), json.dumps(options, ensure_ascii=False)], check=False)
    if result.returncode:
        return result, None
    envelope = json.loads(result.stdout.decode("utf-8"))
    assert envelope["ok"] is True, envelope
    return result, envelope["result"]


def require_names(entries: list[dict[str, object]], expected: list[str]) -> None:
    actual = [str(item["path"]) for item in entries]
    assert actual == expected, f"paths differ\nexpected={expected!r}\nactual={actual!r}"


def main() -> None:
    if not CLI.is_file():
        raise SystemExit(f"ArcLane CLI not found: {CLI}")
    FIXTURES.mkdir(parents=True, exist_ok=True)
    repo = Path(tempfile.mkdtemp(prefix="arclane-ignored-035-", dir=FIXTURES))

    def write(name: str, value: str) -> None:
        target = repo / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(value, encoding="utf-8", newline="")

    git(repo, "init", "-q", "-b", "main")
    git(repo, "config", "user.name", "ArcLane ignored fixture")
    git(repo, "config", "user.email", "ignored-fixture@invalid.local")
    git(repo, "config", "core.autocrlf", "false")

    write(".gitignore", "*.tmp\nignored-dir/\nodd name \\[square\\] ü folder/\nshell $(literal) folder/\n")
    write("tracked.txt", "baseline\n")
    write("rename-old.txt", "rename baseline\n")
    write("nested/.gitignore", "*.secret\n")
    write("nested/visible.txt", "nested untracked\n")
    write("nested/private secret.secret", "nested ignored\n")
    git(repo, "add", "--", ".gitignore", "tracked.txt", "rename-old.txt", "nested/.gitignore")
    git(repo, "commit", "-qm", "ignored fixture baseline")

    exclude = repo / ".git" / "info" / "exclude"
    exclude.write_text("excluded \\[private\\].cfg\n", encoding="utf-8", newline="")
    write("space and [bracket] ü.tmp", "root ignored\n")
    write("shell $(literal).tmp", "shell safe\n")
    write("excluded [private].cfg", "local exclude\n")
    write("ignored-dir/first.dat", "first ignored\n")
    write("ignored-dir/deeper/second.dat", "second ignored\n")
    write("ignored-dir/deeper/third [β].dat", "unicode ignored\n")
    write("odd name [square] ü folder/child file.dat", "pathspec literal\n")
    write("shell $(literal) folder/child.dat", "argument array literal\n")
    write("untracked file.txt", "untracked\n")
    write("staged addition.txt", "staged addition\n")
    git(repo, "add", "--", "staged addition.txt")
    git(repo, "mv", "rename-old.txt", "rename-new.txt")
    write("tracked.txt", "modified\n")
    (repo / "nested" / "visible.txt").unlink()
    expected_porcelain = git(repo, "status", "--porcelain=v1", "-z", "--ignored", "--untracked-files=normal")
    root_expected = porcelain_ignored(repo)
    leaf_expected = decode_paths(git(repo, "ls-files", "--others", "--ignored", "--exclude-standard", "-z"))
    assert root_expected and leaf_expected

    # The new UI endpoint must keep ignored status outside the regular stageable file list.
    before = git_state(repo)
    result, first = cli(repo, {"offset": 0, "limit": 2})
    if result.returncode:
        raise AssertionError(
            "The baseline CLI does not yet provide the ignored-path endpoint (expected initial failure).\n"
            f"stderr={result.stderr.decode('utf-8', 'replace')}"
        )
    assert first is not None
    assert first["total"] == len(root_expected), first
    assert first["offset"] == 0 and first["limit"] == 2 and first["has_more"] is True, first
    require_names(first["entries"], root_expected[:2])

    second_result, second = cli(repo, {"offset": 2, "limit": 2})
    assert second_result.returncode == 0 and second is not None
    require_names(second["entries"], root_expected[2:4])
    assert second["total"] == len(root_expected) and second["has_more"] == (len(root_expected) > 4), second
    loaded = [item["path"] for item in first["entries"] + second["entries"]]
    assert loaded == root_expected[:4]

    # Expanding a collapsed ignored directory lists real Git paths on demand and pages large results.
    bulk = [name for name in leaf_expected if name.startswith("ignored-dir/")]
    assert len(bulk) == 3, bulk
    expanded_result, expanded = cli(repo, {"scope": "ignored-dir", "offset": 0, "limit": 2})
    assert expanded_result.returncode == 0 and expanded is not None
    assert expanded["total"] == len(bulk) and expanded["has_more"] is True, expanded
    require_names(expanded["entries"], bulk[:2])
    expanded_next_result, expanded_next = cli(repo, {"scope": "ignored-dir", "offset": 2, "limit": 2})
    assert expanded_next_result.returncode == 0 and expanded_next is not None
    require_names(expanded_next["entries"], bulk[2:])
    assert expanded_next["has_more"] is False, expanded_next

    special_scope_result, special_scope = cli(repo, {"scope": "odd name [square] ü folder", "offset": 0, "limit": 10})
    assert special_scope_result.returncode == 0 and special_scope is not None
    require_names(special_scope["entries"], ["odd name [square] ü folder/child file.dat"])
    shell_scope_result, shell_scope = cli(repo, {"scope": "shell $(literal) folder", "offset": 0, "limit": 10})
    assert shell_scope_result.returncode == 0 and shell_scope is not None
    require_names(shell_scope["entries"], ["shell $(literal) folder/child.dat"])

    clamped_result, clamped = cli(repo, {"offset": 0, "limit": 999})
    assert clamped_result.returncode == 0 and clamped is not None
    assert clamped["limit"] == 200 and len(clamped["entries"]) == len(root_expected), clamped

    # Independent Git interfaces agree about source rules and path identity.
    for name in leaf_expected:
        assert git(repo, "check-ignore", "-v", "--", name).strip(), f"check-ignore did not confirm {name!r}"
    all_root = set(root_expected)
    for name in ["ignored-dir/", "nested/private secret.secret", "excluded [private].cfg", "space and [bracket] ü.tmp"]:
        assert name in all_root, f"missing ignored status path {name!r}: {root_expected!r}"
    assert "ignored-dir/first.dat" in leaf_expected and "ignored-dir/deeper/third [β].dat" in leaf_expected

    inspect_result = run([str(CLI), "inspect", str(repo)])
    snapshot = json.loads(inspect_result.stdout.decode("utf-8"))["result"]
    regular = {item["path"]: item for item in snapshot["files"]}
    assert "untracked file.txt" in regular and regular["untracked file.txt"]["untracked"] is True
    assert "staged addition.txt" in regular and regular["staged addition.txt"]["staged"] is True
    assert "rename-new.txt" in regular and regular["rename-new.txt"]["staged"] is True
    assert "tracked.txt" in regular and regular["tracked.txt"]["unstaged"] is True
    assert "ignored-dir/" not in regular and "space and [bracket] ü.tmp" not in regular

    traversal_result, _ = cli(repo, {"scope": "../.git/config", "offset": 0, "limit": 5})
    assert traversal_result.returncode != 0, "Path traversal scope was accepted"
    assert "Invalid Git file path" in traversal_result.stderr.decode("utf-8", "replace")
    offset_result, _ = cli(repo, {"offset": 100001, "limit": 1})
    assert offset_result.returncode != 0 and "offset exceeds supported limit" in offset_result.stderr.decode("utf-8", "replace")
    after = git_state(repo)
    assert after == before, "Read-only ignored listing changed HEAD/refs/index/status/file bytes"
    assert expected_porcelain == git(repo, "status", "--porcelain=v1", "-z", "--ignored", "--untracked-files=normal")

    print(json.dumps({
        "result": "PASS",
        "fixture": str(repo),
        "cli": str(CLI),
        "root_ignored_paths": len(root_expected),
        "ignored_leaf_files": len(leaf_expected),
        "paged_directory_files": len(bulk),
        "checks": [
            "Git porcelain !! paths, check-ignore rules, and ls-files leaf paths agree",
            "Nested .gitignore and .git/info/exclude honoured",
            "Unicode, spaces, brackets and shell metacharacters remain literal",
            "Ignored state remains separate from stageable mixed-status files",
            "Pagination totals and has_more are truthful",
            "Path traversal refused; HEAD, refs, index, status and all file bytes unchanged",
        ],
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
