# ArcLane — Run 5 execution packet: Worktree Terminals & Tab Lifetime

**Status:** READY FOR ENGINEERING (planning-only branch; no feature implementation or tests claimed).
**Source baseline:** `c77f4c6a07ed2ef5359053a279a64ddab5e26618` (Run 4 accepted code plus integrated REA-first rules).
**Isolated checkout:** `C:\AI\ArcLane-Run5` · **branch:** `feature/high-terminal-worktree-sessions`.
**Target:** #086 completion; #104 full within-app multi-tab/worktree behaviour, while truthfully retaining PARTIAL if full app-restart process survival remains missing. Do not silently redefine the feature or mark it accepted.
**Model:** GPT-6 Luna, High reasoning. One agent, no simultaneous file editors/builds. Commit/push only the feature branch; never install over `C:\AI\ArcLane\Arclane.exe` or alter `main`/Run 4.

## 0. Mandatory interpretation and stop boundary

For Run 5, a **terminal session** means a real ConPTY process owned by ArcLane while ArcLane is running; a **terminal tab/slot** is a UI layout identity, which may be persisted without retaining a process. Opening a tab is not permission to start a second process if one is already associated with it.

**Lifetime choice for this run:**
- Selecting another linked worktree, navigating to another route, hiding/minimizing the terminal panel, or detaching and reattaching Xterm **must NOT stop or replace** running processes.
- An explicit Stop/Close acts on the exact immutable native session ID. Stopping an agent does not remove its worktree, nor stop an ordinary terminal in the same checkout.
- Closing ArcLane normally or terminating it unexpectedly must clean up its Windows Job Object child trees. **Do not add a daemon, service, startup watcher or background broker to survive full application exit.**
- Persist safe tab layout data (checkout, order, title, selected slot) across app restart; display restored slots as **stopped** and require explicit user action to start a fresh process. Do not persist stale PIDs/session IDs, terminal output, credentials or command history; do not auto-run agents.
- This policy deliberately leaves **live ConPTY process survival across full application restart unsupported**. Current #104 ledger explicitly cites that as unaccepted. Preserve #104 as PARTIAL with a precise remaining gap unless the user separately authorizes a process-host design. Do not move #088 (agent pause/resume) into Run 5.

Stop and ask if the implemented design requires always-on infrastructure, secretly spawns terminals on restore, changes agent-session lifecycle globally, or weakens existing native acceptance.

## 1. REA-first evidence-to-requirement brief (checked before this plan)

| Reference | Supported finding | Decision / uncertainty |
| --- | --- | --- |
| `C:\AI\REA\Reports\GitKraken-focused.md`, repository navigation around line 49, module 12372 (12.5) | Tab data distinguishes repoPath, REPO type, isWorktree and grouping; evidence is static, not proof of terminal lifetime. | Use exact worktree path plus Git common-dir; never treat common-dir or path alone as terminal session ID. |
| `C:\AI\REA\Experiments\Forge\artifacts\gitkraken-translation-features.json` (12.5 UI label inventory) | `Repo-OpenEmbeddedTerminal`, `View-ToggleTerminalPanel`, `Option-BuiltInTerminal`, `ToolPreferences-CustomExternalTerminalPath`, `RefBar-GroupWorktrees`, `AgentsPreferences-ShowWorktreeWipNodes-Description`. | Evidence leads for panel controls and worktree context, **not** proof of enabled/runtime features. No archive expansion required by default. |
| GitKraken official [Terminal Guide](https://help.gitkraken.com/gitkraken-desktop/terminal/) (checked 2026-10-11) | In-app terminal works in active checkout; separate sessions per worktree continue long-running commands when user switches worktrees; panel can minimize and trash action terminates sessions. | Implement these independently and test exact cwd, continued output and navigation. Source does not confirm process survival through app exit. |
| GitKraken official [Worktrees](https://help.gitkraken.com/gitkraken-desktop/worktrees/) and [Agents](https://help.gitkraken.com/gitkraken-desktop/agents/) | List/Agents views refer to the same worktrees; each has independent working directory/index; agent sessions use worktrees. | Reuse Run 2/4 Git identity and Run 4 Rust terminal/session authority. Do not design a second worktree inventory. |
| `docs/FEATURE_COVERAGE.md` rows 003/032/062 and 082–084, 086, 104 | 003/032/062 and 082–084 ACCEPTED; 086/104 PARTIAL. Existing 104 gap includes process lifetime after app restart. | Protect previously accepted scopes and test before raising 086. Declare 104 PARTIAL if its remaining restart-process gap persists. |

Agent orientation: read **`AGENTS.md`**, **this packet**, then the cited small REA/official evidence entries and **only** target ledger rows/source seams. No full REA archive, whole-roadmap reread, new expensive REA analysis or design-document tour without a demonstrated evidence gap. Record 1–3 actual findings and any unresolved UX question before code. ReAgent not justified by this scoped work.

## 2. Actual code baseline and architectural hazard (inspected)

- `src-tauri/src/terminal.rs`: Rust `TerminalManager` owns revisioned session snapshots, immutable `pty-` IDs, exact validated checkout CWD, PID, exit status, purpose flag, bounded **64 KiB** output replay, Windows Job Object cleanup; `terminal_open`, `terminal_launch`, `terminal_sessions`, `terminal_close`. **Extend the same runtime, never create a parallel process tracker.**
- `src/TerminalDock.tsx`: a global React component holds Xterm handles, active tab, session snapshots; tab add uses active/request path, not canonical per-worktree slot ownership. Its cleanup effect currently calls `terminalClose` on every attached handle when **the component unmounts**. This is a lifecycle hazard even though the current App normally retains the component while merely hiding its panel.
- `src/App.tsx` around 150–151, 302–303, 438–461: `terminalDockOpen` and `terminalRequest`; the dock is **mounted even when hidden** by CSS/display. Worktrees/Agents can refer to linked checkouts. Define checkout switches and terminal minimize separately from explicit Stop/Close.
- `src-tauri/src/workspace.rs`: persistent repo tabs, selected path, aliases, closed tabs and favourites; `workspace.json` with strict JSON decoding and backward migration. Terminal layout is not yet persisted. Any new persisted fields **must** migrate old workspace data and must be bounded/validated.
- `src/AgentSessions.tsx`: consumes native agentSession-specific snapshots and can reopen the exact native ID. Do not infer agent purpose from worktree path or convert a normal shell into agent status.
- `scripts/native-agent-workspaces-accept.mjs` checks two same-checkout terminal tabs, late attach, tab switching, child cleanup and hidden-route History controls. Current standard final runner had **24 backend and 22 native suites passing** after Run 4.

**Critical ownership rule:** Rust owns process facts and shutdown. Git owns checkout/common-dir facts. Persisted workspace owns tab layout only. React/Xterm owns view and focus only. Route visibility, session existence and view attachment are distinct.

## 3. Product user journeys (original ArcLane UX, Penpot before CSS)

1. User opens primary repo + two linked worktrees. Select a checkout via Worktrees, repository tabs or Agents; embedded terminal shows that checkout's current session(s) or a clear **Start terminal** state. Switching worktrees changes visible terminal context without spawn, kill, stderr/exit loss or swapping sessions by path. Reopening an existing slot reattaches by immutable ID.
2. For one checkout, create **two** distinct terminal slots, select either, run independent commands, name/reorder/close as existing UI conventions permit. A second checkout retains its own tabs. Show title, checkout/branch, running/exited, PID/exit code and clear association. Ordinary shell and agent processes in one worktree remain separate.
3. **Minimize/hide** the panel without stopping anything; restore it to the same checkout/slot and replay bounded output from Rust. Distinct **Stop and close** action (confirmation when needed) acts only on selected process; optional **Stop all** clearly scopes the affected sessions, never a hidden global kill.
4. Close an ArcLane repository tab or remove a linked worktree with live terminals: require an explicit, safe policy. Never silently leave an active process using a disappearing checkout or remove Git files as a side effect of closing a terminal. A failed removal keeps the process and repository intact; dirty/locked rules from #062 continue to apply.
5. Restart ArcLane: restore only safe layout as stopped tab slots, indicating previous processes ended. An explicit Start creates a **new** process and new native ID in the correct existing checkout; deleted/moved paths show an actionable unavailable state. Do not claim same PID or process persistence.
6. Full app exit, forced close or crash: no orphan child-tree processes; when returning, no auto-launched shells, agents or background work. Empty startup must keep low CPU/RAM and zero standing ConPTY children.

## 4. State and transition contract — agree/test before React implementation

| Transition | Authoritative outcome and failure branch |
| --- | --- |
| Open checkout A / create slot | Bind canonical **checkout root** and current repo common-dir; create a bounded layout slot; launch only on explicit Start. If invalid checkout, refuse without creating a native session. |
| Switch A → B → A | A's unique native IDs, PIDs, output and exit state remain; B shows **only B's slots**. No process spawn or close from selection change. |
| Switch slots 1 ↔ 2 | Xterm reattaches by session ID; output replay uses revision/watermark; no duplication, mixing or lost early exit. |
| Hide, route change, component remount | **No `terminal_close` in unmount cleanup.** Remove only UI listeners/ResizeObservers/Xterm views. Rust snapshots recover live/ended sessions. |
| Agent + shell share checkout | Purpose and unique session ID separate them; regular shell status never replaces an exited agent card. |
| Stop single / stop all | Explicit target IDs, confirmation when running, targeted Job Object termination and visible errors; do not remove unrelated worktrees or live sessions. |
| Worktree removed / invalid / locked / dirty | Refuse unsafe mutation or require explicit prior terminal stop; no deletion of unrelated checkouts, process handles or indexes. |
| App restart | Layout descriptors migrate and restore as **stopped**; stale IDs are discarded, no paid CLI/shell launched. Full app exit or crash leaves no process tree. |

Concurrency: Define ordering for start/stop, close during launch, fast exit, output truncation, tab switch during output, and duplicate requests before implementing. Bound retained sessions, slot count, paths, titles, output, UI buffer and subscriptions; reject invalid or symlink/reparse escapes under the existing Git root safety rules. Do not prescribe arbitrary test repetition counts or build counts.

## 5. Implementation sequence — focused proof, then production build

**A — Native and persistence foundation.** First inspect current source, draw a compact lifecycle/state map and add deterministic Rust/TypeScript tests that demonstrate the failing ownership boundary. Reuse `TerminalManager`; separate UI detach from explicit backend close; ensure app shutdown owns final cleanup. Persist checkout-scoped **tab descriptors only** in a backward-compatible workspace extension or a narrowly justified sibling state store. No persisted PIDs, output or executable secrets. Test old state migration, invalid paths, duplicate slot IDs and bounded storage.

**B — Worktree selection and view wiring.** Make selected checkout explicit in App → TerminalDock; lookup by exact registered checkout identity and per-slot ID. Reattach existing backend snapshot; never assume the newest process at the same path is the desired process. Preserve unrelated agent/ordinary terminal sessions. Minimize vs destructive close must be separate. Do not change global hidden-route `:has()` styling without native History regressions.

**C — Penpot design, then source UI.** Inspect ArcLane Design Playground Review Bench + Worktrees + Run 4 Agent Sessions. Create **actual light/dark/1080×680 compact** terminal/worktree frames and record file/page/node IDs. Show two checkouts with independent terminal tab groups, explicit minimize, stop/close confirmation and restart-stopped state. Use existing semantic tokens, fonts, icons, compact layout and controls. Penpot decides presentation, not process lifetime; do not invent a new theme.

**D — Packaged acceptance.** After focused backend/type gates, build fresh Tauri/WebView2 EXE. Run direct native terminal-worktree fixture(s), visual screenshots and full impacted regressions. Build again only when production source changes necessitate it. Never attempt a CLI launch with an unattached ConPTY fixture that blocks on cursor-position queries; for delayed-attach testing, launch with Xterm attached, detach the view, then remount and verify backend snapshots.

**E — Complete acceptance and handoff.** Run all standard backend and native suites (historical baseline 24/22), plus new focused suites. Fix common causes rather than weaken assertions or patch unrelated harnesses. Use the **Run 5 package's own hash** in new ignored `artifacts/run5-provenance.json`; verify actual EXE SHA independently. Capture screenshots and build/source provenance; update only demonstrated ledger rows, then commit/push and verify clean local + remote. Do not merge/install or perform hosted GitHub writes.

## 6. Independent evidence and negative acceptance

- Add focused Python/CLI fixture for primary + **two linked worktrees**, independent HEAD/index/WIP, Unicode, spaces, brackets and a detached checkout. Compare Git CLI HEAD/refs/index/status/file bytes before/after navigation and failure attempts. Only newly created `C:\AI\REA\Experiments\Forge-Testbed` descendants may be mutated.
- Add packaged `scripts/native-terminal-worktrees-accept.mjs` (or equally justified name) for: two simultaneous live shells in checkout A, one in B; exact CWD/PID/session IDs; input/output isolation, tab reorder/switch, A→B→A without relaunch; same-checkout agent vs shell; minimized panel with ongoing output; remount replay; explicit single close vs all; child-process cleanup after root exit; invalid checkout/missing worktree/dirty locked checkout refusal; native app exit/relaunch **stopped tab layout** without orphan and without startup processes.
- Keep Run 4's `native-agent-workspaces-accept.mjs`, `native-graph-accept.mjs`, `native-ui-accept.mjs`, `native-worktree-workflows-accept.mjs`, `native-workspace-accept.mjs`, `native-operation-workflows-accept.mjs` and provenance suites unchanged unless a test is independently proven invalid. Final full backend + native runner still required.
- Independent process proof uses Windows PID/Job children; no real Codex/Kilo/account usage. Test normal shutdown, forced close, and failed-stop reporting; forbid global process termination. No persistent terminal processes without explicit user launch. Measure cold start and idle against original Run 4 binary, report observed deltas without invented targets.
- Verify actual light/dark/compact pixels vs Penpot, keyboard focus and screen-reader labels, tab selection and stop confirmation, History title + Refresh control on non-Agent routes, and no viewport overlap. A successful backend call or mock DOM alone is insufficient.

## 7. Explicit acceptance / honest ledger decision

**086 ACCEPTED only if:** an actual packaged user can select primary/two linked worktrees and their embedded terminal groups, all running sessions retain exact CWD/PID/ID/output/state across worktree switching, and errors/close/shutdown are correctly handled without affecting other worktrees. Otherwise PARTIAL with exact missing test.

**104:** advance evidenced portions of multi-tab create/switch/reorder/close, saved layout and cleanup **but retain PARTIAL** under this run's no-background-broker policy because a live process does not survive a full ArcLane restart. Do not reclassify as ACCEPTED by redefining "persistent" to mean only saved tab labels. A later deliberate approval is required for live app-restart reattachment.

**Do not claim** #088 session pause/resume, #085 issue handoff, wider #090 idle-budget acceptance, or provider/write features. Keep all prior accepted #003/#032/#062/#082–084 passing. Source and installed app unchanged outside this isolated branch.

## 8. Final execution checklist and efficient agent prompt

Before coding: `git status` clean; verify `c77f4c6` ancestry and exact Run 5 planning HEAD, confirm no other agent editing this checkout; read only this packet, `AGENTS.md`, relevant REA cited evidence, target ledger rows and source seams. Capture a **short** state map and test plan; don't replay Run 1–4 history.

**Required tools:** local Git, targeted existing REA review, Rust/TS/Python, disposable Git fixtures, Penpot for UI, packaged Windows/WebView2 + full regressions. **Not required:** new bulk REA analysis, ReAgent, Figma/Canva, Model Testing, GitHub Actions, real paid CLIs, provider writes or broader web searches unless an evidence gap appears.

**Command baseline** (agent may refine after inspecting actual scripts; not evidence until run):
```powershell
Set-Location C:\AI\ArcLane-Run5
git status --short --branch
git log -1 --format=%H
npm ci  # only if node_modules absent; do not reinstall unnecessarily
npm run build
# Rust lifecycle/backend fixture tests first; build necessary CLI fixture binaries per existing harness
# npx tauri build --no-bundle AFTER final source edits; copy exe to this checkout's Build directory
powershell -NoProfile -File scripts/verify-sprint.ps1 -Phase backend
powershell -NoProfile -File scripts/verify-sprint.ps1 -Phase native
git diff --check
```

**Prompt to start only after this planning commit is pushed:**

> Implement the Run 5 worktree-terminal scope on `feature/high-terminal-worktree-sessions` at `C:\AI\ArcLane-Run5`. Read `AGENTS.md` and `docs/RUN5_HIGH_TERMINAL_WORKTREES_2026-10-11.md` first; the packet contains the verified REA mapping, source seams, architecture decisions, tests and strict lifetime policy. Implement #086 end to end, advance #104 without falsely claiming cross-app-restart process persistence. Build no background broker, start no paid agents, preserve Run 4 native acceptance, and use disposable fixtures. Test the Rust ownership boundary before UI work, review Penpot before substantive CSS, verify the fresh packaged EXE plus all backend/native regressions, then commit/push only this feature branch with an honest ledger and clean status. Start implementation; do not start another broad research or planning loop.

**Scope guard:** If fully implementing both would require a permanent process daemon or significantly enlarge the architecture, finish #086 as the coherent slice and leave #104's remaining process-persistence issue explicitly partial. This is a safety/efficiency decision, not permission to fake complete feature parity.
