# ArcLane — Run 5 execution packet: Worktree Terminals & Tab Lifetime

**Status:** REVIEWED EXECUTION PLAN (planning-only branch; no feature implementation or tests claimed).
**Source baseline:** `c77f4c6a07ed2ef5359053a279a64ddab5e26618` (Run 4 accepted code plus integrated REA-first rules).
**Isolated checkout:** `C:\AI\ArcLane-Run5` · **branch:** `feature/high-terminal-worktree-sessions`.
**Target:** #086 as the must-finish vertical slice; advance #104's within-app multi-tab/worktree behaviour **only after #086's focused tests pass**. Retain #104 PARTIAL while live-process survival across full app restart is unsupported. Never redefine a ledger obligation to manufacture acceptance.
**Model:** GPT-6 Luna, High reasoning. One agent, no simultaneous file editors/builds. Commit/push only the feature branch; never install over `C:\AI\ArcLane\Arclane.exe` or alter `main`/Run 4.

## 0. Mandatory interpretation and stop boundary

For Run 5, a **terminal session** means a real ConPTY process owned by ArcLane while ArcLane is running; a **terminal tab/slot** is a UI layout identity, which may be persisted without retaining a process. Opening a tab is not permission to start a second process if one is already associated with it.

**Lifetime choice for this run:**
- Selecting another linked worktree, navigating to another route, hiding/minimizing the terminal panel, or remounting a UI view **must NOT stop or replace** running processes. Keep Xterm/PTY interaction alive while merely hidden wherever possible; a fully disposed terminal view may interrupt interactive ConPTY applications awaiting cursor responses. Reattachment must not silently spawn a new process and can promise only the **bounded captured output**, not full TUI screen reconstruction.
- An explicit Stop/Close acts on the exact immutable native session ID. Stopping an agent does not remove its worktree, nor stop an ordinary terminal in the same checkout.
- Closing ArcLane normally or terminating it unexpectedly must clean up its Windows Job Object child trees. **Do not add a daemon, service, startup watcher or background broker to survive full application exit.**
- If #104 layout persistence is implemented, persist only **ordinary terminal slot descriptors** (checkout, stable slot ID, order/title, selected slot), not agent lifecycle, PID, native session ID, output, command history, executable or credentials. At restart restore descriptors as **stopped**; start a new process only on explicit action. Do not create phantom agent cards or auto-run agents.
- This policy deliberately leaves **live ConPTY process survival across full application restart unsupported**. Current #104 ledger explicitly cites that as unaccepted. Preserve #104 as PARTIAL with a precise remaining gap unless the user separately authorizes a process-host design. Do not move #088 (agent pause/resume) into Run 5.

Preserve existing intentional actions: clicking **Open embedded terminal** may immediately create a new terminal (it is an explicit launch), and **+** explicitly creates a new terminal; simply selecting a worktree, switching a tab or restoring saved layout must not spawn one. Where an existing tab can be focused, avoid accidental duplicate launch. Stop and ask if implementing the planned slice requires a daemon, changes the agent lifecycle globally, or weakens existing acceptance.

## 1. REA-first evidence-to-requirement brief (checked before this plan)

| Reference | Supported finding | Decision / uncertainty |
| --- | --- | --- |
| `C:\AI\REA\Reports\GitKraken-focused.md`, repository navigation around line 49, module 12372 (12.5) | Tab data distinguishes repoPath, REPO type, isWorktree and grouping; evidence is static, not proof of terminal lifetime. | Use exact worktree path plus Git common-dir; never treat common-dir or path alone as terminal session ID. |
| `C:\AI\REA\Experiments\Forge\artifacts\gitkraken-translation-features.json` (12.5 UI label inventory) | `Repo-OpenEmbeddedTerminal`, `View-ToggleTerminalPanel`, `Option-BuiltInTerminal`, `ToolPreferences-CustomExternalTerminalPath`, `RefBar-GroupWorktrees`, `AgentsPreferences-ShowWorktreeWipNodes-Description`. | Evidence leads for panel controls and worktree context, **not** proof of enabled/runtime features. No archive expansion required by default. |
| GitKraken official [Terminal Guide](https://help.gitkraken.com/gitkraken-desktop/terminal/) (live page rechecked in Run 5 review; last updated September 2026) | Each repository/worktree has its own terminal tabs; commands continue when switching worktrees; agent uses a new tab if a worktree terminal already exists. Minimize keeps header accessible and trash ends sessions. | Test cwd/output/tab isolation and minimize. No documented claim of live process survival after complete application exit. Autocomplete, drag/drop and shell preferences exist but are outside this run. |
| GitKraken official [Worktrees](https://help.gitkraken.com/gitkraken-desktop/worktrees/) and [Agents](https://help.gitkraken.com/gitkraken-desktop/agents/) | List/Agents views refer to the same worktrees; each has independent working directory/index; agent sessions use worktrees. | Reuse Run 2/4 Git identity and Run 4 Rust terminal/session authority. Do not design a second worktree inventory. |
| `docs/FEATURE_COVERAGE.md` rows 003/032/062 and 082–084, 086, 104 | 003/032/062 and 082–084 ACCEPTED; 086/104 PARTIAL. Existing 104 gap includes process lifetime after app restart. | Protect previously accepted scopes and test before raising 086. Declare 104 PARTIAL if its remaining restart-process gap persists. |

Agent orientation: read **`AGENTS.md`**, **this packet**, then the cited small REA/official evidence entries and **only** target ledger rows/source seams. No full REA archive, whole-roadmap reread, new expensive REA analysis or design-document tour without a demonstrated evidence gap. Record 1–3 actual findings and any unresolved UX question before code. ReAgent not justified by this scoped work.

## 2. Actual code baseline and architectural hazard (inspected)

- `src-tauri/src/terminal.rs`: Rust `TerminalManager` owns revisioned session snapshots, immutable `pty-` IDs, exact validated checkout CWD, PID, exit status, purpose flag, bounded **64 KiB** output replay, Windows Job Object cleanup; `terminal_open`, `terminal_launch`, `terminal_sessions`, `terminal_close`. **Extend the same runtime, never create a parallel process tracker.**
- `src/TerminalDock.tsx`: a global React component holds Xterm handles, active tab, session snapshots; tab + uses active/request path, not canonical per-worktree slot ownership. Cleanup currently calls `terminalClose` for every attached handle when **the component unmounts**. That is the key distinction between UI detach and destructive process close. There is also an existing implicit `terminalSend("\\r")` after an explicit shell open; preserve native acceptance and do not confuse this with a background startup.
- `src/App.tsx` around 150–151, 302–303, 438–461: `terminalDockOpen` and `terminalRequest`; the dock is **mounted even when hidden** by CSS/display. Current `showTerminal(folder)` on explicit toolbar/command action requests a NEW shell. Preserve that contract. Git worktree remove via `runAction` currently has no session preflight; any new removal guard must use authoritative snapshots without claiming atomicity if it is not implemented below the UI.
- `src-tauri/src/workspace.rs` + `src/types.ts`: persisted repo tabs, selected path, aliases, closed tabs and favourites; `workspace.json` with `deny_unknown_fields` and backward migration. Terminal layout is NOT persisted. If #104 is attempted, Rust and TypeScript must agree on optional schema, preserve old profiles, validate bounded slot data and avoid overwriting user state.
- `src/AgentSessions.tsx`: consumes native `agentSession` snapshots and can reopen an exact native ID; an ordinary shell in the same path is NOT agent status. Don't persist fake agent sessions as restorable ordinary tabs.
- `src-tauri/src/main.rs` already calls `TerminalManager.shutdown()` on `WindowEvent::Destroyed`. Do not remove it or let a non-primary window destroy unrelated sessions if future multi-window support is added; test normal and forced main-window/app exit.
- `scripts/native-agent-workspaces-accept.mjs` checks two same-checkout terminal tabs, late attach, switching, child cleanup and hidden-route History. Baseline completed **24 backend/22 native suites** in Run 4.

**Critical ownership rule:** Rust owns process facts and shutdown. Git owns checkout/common-dir facts. Persisted workspace owns terminal slot layout only (if #104 phase is undertaken). React/Xterm owns view and focus only. Route visibility, session existence and view attachment are distinct. Existing `main.rs` already runs `TerminalManager.shutdown()` on window `Destroyed`; protect that shutdown path while removing destructive **UI unmount** cleanup.

## 3. Product user journeys (original ArcLane UX, Penpot before CSS)

1. User opens primary repo + two linked worktrees. Selecting a checkout via Worktrees or repository tabs shows that checkout's terminal tab group or a clear **Open terminal** state. Switches change visible context without spawn, kill or cross-checkout output mixing. Agent Sessions can attach its specific agent ID without replacing ordinary terminals. An explicit toolbar Open/+ remains permitted to start a shell, consistent with existing Run 4 acceptance.
2. For one checkout, create **two** distinct terminal slots, select either, run independent commands, name/reorder/close as existing UI conventions permit. A second checkout retains its own tabs. Show title, checkout/branch, running/exited, PID/exit code and clear association. Ordinary shell and agent processes in one worktree remain separate.
3. **Minimize/hide** the panel without stopping anything; restore the same checkout/slot. Prefer keeping the attached Xterm renderer alive (visually hidden) to answer ConPTY queries; if a view genuinely unmounts, reconstruct from bounded Rust output/exit state and state clearly that full-screen terminal state may not be reconstructable. Distinct **Stop and close** (confirmation when needed) targets exactly one process; **Stop all** must name its scope and never kill invisible unrelated sessions.
4. Closing a **repository tab** must not automatically stop its terminal processes; those remain discoverable from the worktree/terminal panel until explicitly stopped or the app exits. Removing a **linked worktree** with live processes must first be blocked in the UI with a clear list of affected sessions and an explicit stop-first path; existing #062 dirty/locked refusal still applies. Do not claim atomic cross-process protection unless the Git/backend removal boundary actually enforces it. Defer broader deletion/race hardening rather than invent a second Git lock system.
5. If #104 phase is undertaken, restart ArcLane and restore ordinary-terminal tab slots only, shown as stopped. An explicit Start creates a **new** process/new native ID in an existing valid checkout; deleted/moved paths show an unavailable state. Do not claim same PID, preserved TUI screen, or process persistence. This is not a prerequisite for #086 acceptance.
6. Full app exit, forced close or crash: no orphan child-tree processes; when returning, no auto-launched shells, agents or background work. Empty startup must keep low CPU/RAM and zero standing ConPTY children.

## 4. State and transition contract — agree/test before React implementation

| Transition | Authoritative outcome and failure branch |
| --- | --- |
| Open checkout A / create slot | Bind canonical checkout root and Git common-dir; do **not** launch from navigation. Explicit Open embedded terminal / + / Start is a user launch and may start a shell. Repeated attach/focus of the same native ID never starts a duplicate. Invalid checkout refuses without a native session. |
| Switch A → B → A | A's unique native IDs, PIDs, output and exit state remain; B shows **only B's slots**. No process spawn or close from selection change. |
| Switch slots 1 ↔ 2 | Xterm reattaches by session ID; output replay uses revision/watermark; no duplication, mixing or lost early exit. |
| Hide, route change, component remount | **No `terminal_close` on UI unmount.** Ordinary hide leaves live terminal attachment intact where possible. True detach removes UI listeners and Xterm view only; Rust snapshots recover bounded output and exit, not arbitrary full-screen TUI state. Window destruction still terminates native child trees. |
| Agent + shell share checkout | Purpose and unique session ID separate them; regular shell status never replaces an exited agent card. |
| Stop single / stop all | Explicit target IDs, confirmation when running, targeted Job Object termination and visible errors; do not remove unrelated worktrees or live sessions. |
| Worktree removed / invalid / locked / dirty | UI removal is blocked while that checkout has live native sessions; require explicit stop first and recheck identity/dirty/locked Git state before removal. Do not promise an atomic cross-process guarantee without a backend guard. No deletion of unrelated checkout files or indexes. |
| App restart (#104 only) | Persist bounded ordinary-tab slot descriptors and restore as stopped; discard stale process IDs, never auto-launch an agent/shell. Actual live-session persistence remains unimplemented. App shutdown/crash must leave no owned child tree. |

Concurrency: Define ordering for start/stop, close during launch, fast exit, output truncation, tab switch during output, and duplicate requests before implementing. Bound retained sessions, slot count, paths, titles, output, UI buffer and subscriptions; reject invalid or symlink/reparse escapes under the existing Git root safety rules. Do not prescribe arbitrary test repetition counts or build counts.

## 5. Implementation sequence — focused proof, then production build

**A — Backend contract and failing tests.** Inspect current source, draw a compact lifetime/state map and add focused tests for exact checkout/ID routing, detach vs stop, duplicate open/close, exit-before-UI and app shutdown. Reuse `TerminalManager` without creating a second process owner. **Do not add persisted terminal slots until #086's backend/TS behaviour is stable.** Prove Rust's existing window-`Destroyed` shutdown and Windows Job Object cleanup independently. No production package build yet.

**B — Penpot, before any significant UI implementation.** Use ArcLane Design Playground and the current Review Bench, Worktrees and Run 4 Agent Sessions frames. Create **light/dark/1080×680 compact** worktree-terminal frames with actual IDs and explicit controls for worktree switch, tab switch, minimize vs stop, and running/ended output. Show existing explicit Open/+ immediate launch behaviour, no extra modal for benign navigation. Do not redesign the entire shell. Design a restart-stopped tab state **only if the #104 optional phase is undertaken**.

**C — Implement and prove #086 first.** Wire the selected worktree from App → TerminalDock, derive visible shell tabs by exact checkout identity and unique session ID, preserve other checkout sessions on navigation/hide, and let Xterm attach/re-attach with bounded snapshot replay. Remove destructive terminal cleanup from React unmount; do **not** disable native shutdown. Keep agent-owned sessions independent. Run deterministic Rust/TS and focused packaged tests for #086 before taking on #104. Maintain existing toolbar Open, tab +, and Run 4 Agent Sessions flows without implicit background launches.

**D — Optional #104 tab-layout extension, then package as needed.** Once #086 passes focused tests, evaluate whether per-worktree multiple slot UI and bounded persisted layout can be added safely **without new background infrastructure or a wide refactor**. Persist ordinary tab descriptors only using backward-compatible, validated workspace state; migrate prior `workspace.json` (Rust `deny_unknown_fields` and TypeScript `WorkspaceState` must agree). Test deleted checkout, name/ordering, duplicate slot IDs, malformed files and restore-as-stopped. Otherwise record specific remaining #104 gaps and stop here. Package a fresh Tauri/WebView2 EXE after final source edits and run the relevant native suites. Keep interactive Xterm attached for a delayed-attach test until its fixture can answer ConPTY queries; do not test a fixture that hangs on an unattached cursor-query as evidence of product failure.

**E — Full acceptance and handoff.** After focused native and light/dark/compact checks pass against the **current** EXE, run the entire backend and native suite collections (Run 4 baseline 24/22, new suites registered deliberately). Categorize failures by shared root cause; do not weaken assertions or substitute fake provenance. Use **Run 5's own package record and independently checked EXE SHA-256**, not a Run 4/3 ignored JSON path. Capture source/binary hash, screenshot references, per-ID honest disposition, commit/push and clean local/remote. No merge/install/provider writes/Actions.

## 6. Independent evidence and negative acceptance

- Reuse Run 2 worktree fixtures where possible, then add only the missing terminal-specific disposable fixture: primary + two linked checkouts with independent HEAD/index/WIP, Unicode/spaces/brackets and detached-HEAD case. For read-only navigation verify Git HEAD/refs/index/status/file bytes are unchanged. Do **not** duplicate broad Git testing already covered by the existing 24-suite backend matrix; use new `C:\AI\REA\Experiments\Forge-Testbed` descendants only.
- Add focused packaged `scripts/native-terminal-worktrees-accept.mjs` (or justified equivalent): **#086 gate:** two live shells in A, one in B; exact cwd/PID/IDs; isolated output, A→B→A and tab switches without relaunch; hide and ongoing output; agent+shell identity separation; single close vs unrelated sessions; native shutdown and child cleanup; unavailable/deleted checkout and Git safety refusal. **#104 only if implemented:** bounded per-worktree tab order/title restoration after app restart as stopped, explicit restart creates a fresh PID/ID and nothing auto-runs. Do not claim complete TUI-render state restoration from 64 KiB output replay.
- Keep Run 4's `native-agent-workspaces-accept.mjs`, `native-graph-accept.mjs`, `native-ui-accept.mjs`, `native-worktree-workflows-accept.mjs`, `native-workspace-accept.mjs`, `native-operation-workflows-accept.mjs` and provenance suites unchanged unless a test is independently proven invalid. Final full backend + native runner still required.
- Independent process proof uses Windows PID/Job children; no real Codex/Kilo/account usage. Test normal shutdown, forced close, and failed-stop reporting; forbid global process termination. No persistent terminal processes without explicit user launch. Measure cold start and idle against original Run 4 binary, report observed deltas without invented targets.
- Verify actual light/dark/compact pixels vs Penpot, keyboard focus and screen-reader labels, tab selection and stop confirmation, History title + Refresh control on non-Agent routes, and no viewport overlap. A successful backend call or mock DOM alone is insufficient.

## 7. Explicit acceptance / honest ledger decision

**086 ACCEPTED only if:** an actual packaged user can select primary/two linked worktrees and their embedded terminal groups, all running sessions retain exact CWD/PID/ID/output/state across worktree switching, and errors/close/shutdown are correctly handled without affecting other worktrees. Otherwise PARTIAL with exact missing test.

**104:** optional after #086 proves stable; advance only independently tested portions of per-worktree multiple tabs, ordering, saved ordinary-slot layout and cleanup. **Retain PARTIAL** under this run's no-background-broker policy because a live process does not survive a full ArcLane restart, and don't reclassify via a changed definition of "persistent". Full live-process reattachment needs a separately approved architectural decision.

**Do not claim** #088 session pause/resume, #085 issue handoff, wider #090 idle-budget acceptance, or provider/write features. Keep all prior accepted #003/#032/#062/#082–084 passing. Source and installed app unchanged outside this isolated branch.

## 8. Final execution checklist and efficient agent prompt

Before coding: `git status` clean; verify `c77f4c6` ancestry and exact Run 5 planning HEAD, confirm no other agent editing this checkout; read only this packet, `AGENTS.md`, relevant REA cited evidence, target ledger rows and source seams. Capture a **short** state map and test plan; don't replay Run 1–4 history.

**Required tools:** local Git, targeted existing REA review, Rust/TS/Python, disposable Git fixtures, Penpot for UI, packaged Windows/WebView2 + full regressions. **Not required:** new bulk REA analysis, ReAgent, Figma/Canva, Model Testing, GitHub Actions, real paid CLIs, provider writes or broader web searches unless an evidence gap appears.

**Real PowerShell command baseline** (run **after** focused source tests and final production source edits; commands are not evidence until executed; keep one shell so the CLI environment survives):
```powershell
Set-Location -LiteralPath 'C:\AI\ArcLane-Run5'
git status --short --branch
git log -1 --format=%H
if (-not (Test-Path .\node_modules)) {
  rtk proxy npm ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
}
rtk proxy npm run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
rtk proxy cargo build --release --bin arclane-cli --manifest-path src-tauri/Cargo.toml
if ($LASTEXITCODE -ne 0) { throw 'CLI build failed' }
$env:ARCLANE_CLI = (Resolve-Path '.\src-tauri\target\release\arclane-cli.exe').Path
# Run targeted Rust/TS/Python fixtures before the costly production build.
rtk proxy npx tauri build --no-bundle
if ($LASTEXITCODE -ne 0) { throw 'Native package build failed' }
New-Item -ItemType Directory -Force .\Build | Out-Null
Copy-Item -LiteralPath '.\src-tauri\target\release\arclane.exe' -Destination '.\Build\Arclane.exe' -Force
Get-FileHash -LiteralPath '.\Build\Arclane.exe' -Algorithm SHA256
powershell -NoProfile -File scripts/verify-sprint.ps1 -Phase backend
if ($LASTEXITCODE -ne 0) { throw 'Backend regressions failed' }
powershell -NoProfile -File scripts/verify-sprint.ps1 -Phase native
if ($LASTEXITCODE -ne 0) { throw 'Native regressions failed' }
git diff --check
```

**Prompt to start only after this reviewed planning commit is pushed:**

> Implement Run 5 on `feature/high-terminal-worktree-sessions` at `C:\AI\ArcLane-Run5`. Read `AGENTS.md` and `docs/RUN5_HIGH_TERMINAL_WORKTREES_2026-10-11.md` first. The packet records targeted REA evidence, verified source seams, lifetime boundaries, Penpot and native gates. **Complete and package-test #086 first**, then extend #104 only if its bounded ordinary-tab layout work is safe; retain #104 PARTIAL without true process survival after full restart. No second process owner, background broker, paid CLI tests, installed-app change or Actions. Keep existing explicit terminal launch actions and agent-session identity intact. Validate backend lifetime tests, Penpot before UI, fresh packaged native tests, then full backend/native regressions. Commit/push only this branch with precise per-ID results, executable provenance and clean status. Do not restart a broad planning or REA research exercise.

**Scope guard:** Complete and verify #086 before broadening to #104. If safe #104 persistence needs a large refactor or background daemon, stop and document exact gaps instead of extending the run. Never claim full GitKraken terminal parity: official documentation also includes shell preferences, autocomplete and drag/drop, which are separate obligations unless explicitly scoped. New features and tests are not proof of live-process persistence across restart.
