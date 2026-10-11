# ArcLane — Run 4 execution packet: Agent Workspaces (Luna High)

**Status:** COMPLETE — implementation accepted and pushed at `305c30411b87fb98c2c20478e3f6aaae5e62c57a` (082/083/084, full backend 24/24, packaged native 22/22). The later REA-first instructions merge is documentation-only and does not alter this executable's provenance.
**Date:** 11 October 2026.
**Model:** GPT-6 Luna, **High** reasoning. Single agent, single local run; no parallel builds or other agents.
**Repository:** https://github.com/aloosley-ux/ArcLane
**Checkout:** `C:\AI\ArcLane-Run4`
**Branch:** `feature/luna-high-agent-workspaces`
**Exact accepted Run 3 parent:** `3b39a7978b248cb3eb1e9a4aa0fcd475b19dcd4a` on `feature/sol-low-file-review`. Verify ancestry and current HEAD before changes.
**Target:** a coherent 30–60-minute engineering run *if implementation and tests permit*, not a deadline that excuses missing native acceptance.

### Run 4 execution record

- Source base: `590458e32ad46b4e0d6884493b195aa51632075b`; isolated checkout `C:\AI\ArcLane-Run4`; branch `feature/luna-high-agent-workspaces`; Run 3 parent ancestry verified before edits.
- **Historical execution record, not the policy for future runs:** Tool matrix before code: Git/GitHub REQUIRED (checkout/history now; branch-only push after acceptance); Penpot REQUIRED and completed before UI edits; REA SKIPPED (no unresolved UX ambiguity; **later identified as a planning error** — current `AGENTS.md` and `docs/REA_EVIDENCE_INDEX.md` now require targeted existing REA evidence review before all new feature runs); ReAgent SKIPPED (no differential experiment required); local Rust/TypeScript/Python REQUIRED; PowerShell REQUIRED; packaged WebView2/Playwright REQUIRED; Figma/Canva SKIPPED (Penpot is authority); Model Testing SKIPPED (out of scope); web research CONDITIONAL (no blocker yet).
- Penpot connected file: ArcLane Design Playground, page `Page 1` (`52a5041f-08a1-80f1-8008-c5171920d529`). Existing Review Bench frame `466dcfea-ddde-80ca-8008-c526d4a9ede8`; existing Worktrees light/dark frames `362e4773-7c31-8074-8008-c568ba6e5012` and `362e4773-7c31-8074-8008-c568bd564978` were inspected and exported.
- Run 4 frames created and exported for visual review: light `362e4773-7c31-8074-8008-c57f4f6548ef` (1440×900); dark `362e4773-7c31-8074-8008-c57f522bf735` (1440×900); compact `362e4773-7c31-8074-8008-c57f5576e261` (1080×680).
- Design-to-code checklist: preserve the ArcLane top tab/command/mode/status shell and shared theme tokens; use the same `repo.worktrees` paths and branch labels as Worktrees; make selected checkout and real Git dirty/lock status explicit; discover Codex/Kilo only on entering/refreshing Agent Sessions; show missing executable and configured path distinctly; require explicit branch+launch confirmation; surface pending/running/exited PID and exit code; provide retry after launch failure while retaining the checkout; embed the agent process in the existing ConPTY terminal; keep worktree list and actions usable at 1080×680, with light/dark semantic contrast.

The gate also exposed a compact-frame overlap between the selected-checkout controls and terminal. Resolve that layout constraint during implementation/packaged pixel review before claiming compact acceptance.

## Mission — finish three connected user journeys

| ID | Current baseline | Required Run 4 outcome |
| --- | --- | --- |
| **082** | Existing `agents` route renders worktree cards and an Open terminal button; no trustworthy agent session view. | A worktree-centred Agent Sessions screen using the **same actual worktree identities** as Worktrees, with selected worktree, real agent availability and locally launched session lifecycle/status; no invented AI progress. |
| **083** | No verified installed-agent CLI discovery/configuration. | Detect installed **Codex and Kilo** executable paths on demand without launching them, reading credentials or polling; surface unavailable/invalid executable clearly and permit explicit selection/configuration of a valid path when appropriate. |
| **084** | Worktree creation and PowerShell ConPTY tabs exist separately. | One explicitly confirmed create-branch + checkout + selected-agent launch flow. Run the selected executable with safe argv and the exact checkout cwd; show a dedicated interactive terminal, real PID/exit and obvious retry/failure path. Preserve the worktree if launch fails; never silently remove it. |

Do **not** roll 085 (issue context), 087 (agent progress/permissions), 088 (durable pause/resume/reopen), 089 (custom external tools) or 104 (persistent terminal restart) into this run. Some existing terminal tests exercise portions of 086/104; preserve them, but do not claim full acceptance outside the scoped 082/083/084 tests. Do not reopen Run 3's still-partial #049 recovery scope.

## Verified reuse points — don't rebuild existing systems

- `src/App.tsx`: route union includes `agents`; Agent Sessions currently maps `repo.worktrees` to simple agent cards with `showTerminal(w.path)`. Worktrees page already opens linked checkout and creates/attaches branches.
- `src/TerminalDock.tsx`: xterm.js, multiple live tab views, focus/resize, terminal output events, explicit close.
- `src-tauri/src/terminal.rs`: `TerminalManager`, `portable_pty`, `terminal_open/send/resize/close/sessions`; existing open spawns PowerShell and validates `git::root(path)`. No processes before explicit user action.
- `src/api.ts` + `src-tauri/src/main.rs`: Tauri IPC commands; extend narrowly, don't create a second terminal runtime.
- `src-tauri/src/workspace.rs`: repository/tab persistence. Reuse shared Git directory identity and existing tab migration; don't conflate branch, git-common-dir and checkout cwd.
- `src/design-tokens.css`, `src/workflow.css`, `src/app.css`: established Review Bench shell and styling; reuse without parallel design system.
- Relevant existing regressions: `scripts/native-worktree-workflows-accept.mjs`, `scripts/native-workspace-accept.mjs`, `scripts/native-ignored-files-accept.mjs`, `scripts/native-sprint-harness.mjs`, `scripts/verify-sprint.ps1`. Check for existing terminal assertions in the normal suites.

Check the actual code before changing a seam; details can move.

## Explicit tool matrix — specify USED or SKIPPED with evidence at handoff

| Tool | Status and specific job |
| --- | --- |
| Local Git + GitHub | **REQUIRED**. Verify exact checkout/base, read history/ledger, commit and push **only Run 4 branch** after acceptance. No main or Run 3 edits, no Actions. |
| Penpot MCP | **REQUIRED BEFORE UI EDITS**. Open ArcLane — Design Playground, inspect the established Review Bench + Worktrees boards, create Run 4 Agent Sessions frames: light, dark and compact 1080×680; available/unavailable agent, creating/launching/running/exited/failure views. Record real file/page/frame IDs and a design-to-code checklist. |
| Rust/Tauri, TypeScript/React, Git/Python fixtures | **REQUIRED**. Reuse terminal/worktree systems, implement exact cwd/argv guard, real IPC errors and deterministic disposable test processes. |
| PowerShell on Windows | **REQUIRED**. Keep ARCLANE_CLI within the same runner process; build/signature/source provenance, verify Windows process-tree and exit code correctly. |
| Packaged Tauri/WebView2 + Playwright | **REQUIRED**. Test real packaged controls, keyboard/focus/errors, light/dark/compact pixels and safe process lifecycle. |
| REA 6.2 | **CONDITIONAL**, default SKIP: only narrow read-only observation if existing ArcLane interaction/requirements leave a concrete UX ambiguity. |
| ReAgent 0.4 | **SKIP** unless a precise native-function differential experiment is necessary and documented first. |
| Figma/Canva | **SKIP**. Penpot is sole design authority. |
| Model Testing | **SKIP**. Optional after completion; not part of this app or this run. |
| Web/docs | **CONDITIONAL**. Official portable-pty/Tauri/Git API reference only if a concrete code blocker requires it; no broad research. |

## Required ordered gates

**G0 — Source & safety**: Confirm clean Run 4 checkout, exact Run 3 ancestry. Protect `C:\AI\ArcLane-Run3`, Run 2, `main`, the installed `C:\AI\ArcLane\Arclane.exe` and user repositories. Mutating tests only on fresh disposable repos rooted under the authorised Forge-Testbed. No repo test should launch a paid AI CLI.

**G1 — Penpot design**: Actual saved/reviewed frames, not just reading token names. Screen should prioritize dense, readable, compact native UI in the Review Bench style. Existing Worktrees remains authoritative for branch/checkout facts; no duplicate contradictory list. User starts or stops agents manually; no startup detection loop.

**G2 — Implementation & focused fixtures**: Prefer direct `CommandBuilder`/argv (or equivalent safe process builder), never interpolate an agent name, branch, path or prompt into a PowerShell command string. Discover exact executables only when requested or page entered; do not execute `--version` simply to discover. Do not infer login state from presence on disk. Bound configuration, selected path and child arguments. No automatic Codex/Kilo invocation on startup or during automated tests.

Create at least:
- `scripts/accept-agent-workspaces.py` — disposable repo, separate linked checkout/HEAD/index/WIP, valid + invalid branch/path and launch-precondition checks, no mutations on failures.
- `scripts/native-agent-workspaces-accept.mjs` — actual packaged UI, selected checkout and agent, create+launch, error/retry, interactive output/exit, explicit stop and no-orphan check.

**Use a harmless fixture executable** (e.g. local Node CLI fixture started with explicit argv and a known output/exit) for automated launch tests; do not consume real Codex, Kilo or account allowance. Native proof must record the executable, PID, exact cwd, exit and any children. Test Unicode, spaces, brackets and argument injection strings. If the real agent CLI isn't installed, show unavailable state without failing the whole page.

**Lifecycle and errors**: Existing ConPTY tab independence must survive navigation, close and app shutdown. A launched session must be associated with the correct worktree, with actual pending/running/exited status; make process-close failures visible, not swallowed. No global process kill. A failure to launch must not delete its newly created checkout. Before creating, validate branch and location, and refuse existing owned/dirty/locked conflicts. Worktree creation and child launch are separate recoverable steps, not a fake transaction that destroys a checkout when launch fails.

**G3 — Fresh package & pixels**: Run TypeScript/Vite build and relevant Rust/CLI checks; make a fresh Tauri production EXE **after final UI source edits**, copy only to this checkout's `Build\Arclane.exe` and record SHA-256, source freshness and exact binary. Inspect packaged light/dark 1440×900 and 1080×680; verify the browser/WebView fills the native window when resizing. Compare real pixels with Penpot; address substantive UI defects before wide regressions.

**G4 — Native focused**: Run new native Agent Workspaces acceptance sequentially against disposable repos; preserve Win32 process lifetime evidence and cancel/exit behavior. Include keyboard focus, disabled actions, failure labels, reopened UI view and tabs without background agents.

**G5 — Regression**: Run relevant existing Worktrees, Workspace, Terminal and Ignored Files acceptance (where present), then one complete backend and native pass via `scripts/verify-sprint.ps1`. Register new suites. Maintain existing assertions, don't fake green via weak selectors. Rebuild and rerun only affected tests if a late UI fix requires it; retain unchanged passing evidence.

**G6 — Handoff**: Individually mark 082/083/084 accepted only on independent backend + fresh packaged native evidence. If one is incomplete, mark PARTIAL with exact gap. Include Penpot references, actual tests, executable hash, resource/startup/idle changes if measured, CLI failure behavior, commit SHA, push and clean branch. No merge/install/provider writes/Actions. Stop.

## Run 4 final acceptance record

- Lifecycle contract: `TerminalManager` owns immutable session ID, exact checkout CWD, PID, running/exited state, real exit code and a bounded 64 KiB output history. Exit is recorded by the process waiter independently of React and PTY EOF. Snapshot revision plus output offsets let listeners attach before or after exit without losing or duplicating history. Closing a session removes its retained record and closes its Windows Job Object; child cleanup is verified.
- Focused lifecycle checks: 4 Rust tests passed (50 immediate start/exit processes with stdout and exit 7, bounded UTF-8 history, failed spawn/retry identity, and child cleanup); 4 TypeScript synchronization groups passed (subscribe/snapshot race, late UI attachment, tab selection identity, and retry/tombstone state).
- Full backend: 24 Python acceptance scripts passed; 0 failed. Focused Rust and frontend lifecycle checks also passed.
- Full packaged native regression: 22 suites passed; 0 failed. The six initially failing suites were grouped into two causes. Four history failures shared one App regression: the hidden Agent Sessions page matched `.work-main:has(.agent-sessions-page)` and hid History's shared title bar. The selector now applies only while the Agent Sessions route is visible; graph, Review Bench, commit options and operation workflows all pass. Two provenance failures came from the isolated Run 4 checkout lacking Run 3's ignored JSON record. Their contract checks the built EXE hash and inherited packaged UI behavior; the harness now selects the explicit Run 4 build record and still verifies the exact EXE SHA-256. Both suites pass without weakening assertions.
- Package: `Build/Arclane.exe`, 11,517,952 bytes, SHA-256 `6C0C4FF84E87F468BDC199EB07FF819716BED25B91A4F6BBF0AD98AA6E2255A`; built 2026-10-11 04:27:43 UTC by `rtk proxy npx tauri build --no-bundle`. Build provenance is in ignored local `artifacts/run4-provenance.json`.
- Packaged screenshots: Review Bench `artifacts/review-bench-native-light.png`, `review-bench-native-dark.png`, `review-bench-native-1080.png`; Agent Sessions `artifacts/native-agent-workspaces-light.png`, `native-agent-workspaces-dark.png`, `native-agent-workspaces-dark-1080x680.png`. Penpot frame IDs are recorded above.
- Requirements **082**, **083**, and **084** are accepted against backend and packaged native evidence. No claims are made for 085, 087, 088, 089 or full 104. No real agent CLI, provider mutation, Actions, or installed-app overwrite was used.

## Suggested concrete commands (verify installed paths and runner semantics)

```powershell
Set-Location -LiteralPath C:\AI\ArcLane-Run4
git status --short --branch
git log -1 --format=%H
npm ci                     # once, only if dependencies absent
npm run build
cargo build --release --bin arclane-cli --manifest-path src-tauri/Cargo.toml
$env:ARCLANE_CLI = (Resolve-Path '.\src-tauri\target\release\arclane-cli.exe').Path
python scripts/accept-agent-workspaces.py
npx tauri build --no-bundle
New-Item -ItemType Directory -Force .\Build | Out-Null
Copy-Item '.\src-tauri\target\release\arclane.exe' '.\Build\Arclane.exe' -Force
node scripts/native-agent-workspaces-accept.mjs
powershell -NoProfile -File scripts/verify-sprint.ps1 -Phase backend
powershell -NoProfile -File scripts/verify-sprint.ps1 -Phase native
git diff --check
```

Use `rtk proxy` or the existing run3-check runner where appropriate to preserve correct stdout/stderr behavior and fast local runs; the commands above are illustrative, not proof they were executed. Native UI suites must run sequentially if they share debugger ports. Avoid repeatedly building during development.

## Time/allowance policy

A meaningful 30–60 minute goal, with scope strictly limited to these three vertical workflows. Five-to-ten minutes initial orientation (including Penpot), then implement and test. Don't repeatedly narrate progress or call optional research tools. If a genuine safety/correctness blocker prevents acceptance in budget, provide a clean partial handoff rather than fabricate status or start a giant unrequested re-architecture. Never silently downgrade from Luna High.

## Final response contract

- Individually: **082**, **083**, **084** ACCEPTED/PARTIAL with evidence.
- Focused and full backend/native suite counts + actual failures.
- Real packaged executable hash and screenshot/frame refs.
- Branch, commit SHA, push status, clean tree.
- Real risks/remaining scope; no claims for 085/087/088/089/104.
- Confirm no remote provider mutations, installed app overwrite, Actions or inference startup.
