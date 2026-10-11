# ArcLane — Run 2 execution packet: worktree workflows (High reasoning)

**11 October 2026 · fixed source baseline:** `c1264b68dca4249194f8a1feb23db1097802012f` (accepted #035; Luna's independently tested topic commit). This branch, `feature/high-worktree-batch`, was created from that exact commit. **Do not merge into `feature/next-parity-sprint` or `main`, and do not install over `C:\AI\ArcLane\Arclane.exe`.**

## Objective — implement three related existing partial requirements

**003 — Tab aliases/reordering/***worktree grouping*: aliases/order/reopen already work. Add a visual and persisted grouping relationship for tabs belonging to the same common Git repository while preserving tab ordering, aliases, favourites, closing/reopening, detached checkouts, and unrelated repos. No fake grouping by similar folder names. Preserve old `workspace.json` data and restart migration.

**032 — Directly selectable linked worktrees and their own live history**: existing Worktrees route/card and navigator list only navigate to the Worktrees route or Explorer. Selecting a linked checkout inside ArcLane must open/focus its **actual** working directory/tab, show its correct independent HEAD/branch/WIP while commits/reference history are shared. Main and linked worktrees must never be conflated, and selections must not change any checkout HEAD/index/files. Show clear current-main/current-linked/detached state. Reopen and stale/missing-path errors need predictable behaviour.

**062 — Native lifecycle completion**: existing backend supports create new branch, attach existing, create detached, lock, unlock, refuse dirty/locked remove, remove clean checkout and prune stale registrations. Finish real **packaged Windows UI** coverage of the entire lifecycle and close remaining UI gaps rather than rewriting working backend code. Destructive folder removal requires existing confirmation pattern and independent before/after verification. If selected tab is removed, safely update/close its tab without touching unrelated checkout state. Refuse destructive force removal and dirty/locked states; no `reset --hard` / `clean -fd`.

**Scope warning:** 003/032/062 are not three green checkboxes. Advance each ledger row only on complete acceptance, or leave partial with exact missing behaviour.

## Mandatory first 5–10 minute orientation (known code locations)

No fresh architecture audit or broad web research. Use the following confirmed seams, and adjust only if current source contradicts them:

| File/seam | Known current behaviour and task |
| --- | --- |
| `src/App.tsx` around lines 82–93 | `workspace` state, `persistWorkspace`, `rememberTab`: safely extend grouping; avoid arbitrary new state machines |
| `src/App.tsx` around lines 186–205 | `refresh` and `loadPath`: reuse these to open a chosen linked worktree |
| `src/App.tsx` around lines 327–343 | `closeTab`, `reopenTab`, `moveTab`, `tabMenu`: preserve alias/order/restoration |
| `src/App.tsx` around line 411 | `.repository-tab-shell` / `.repo-tab`: existing tabs and design tokens, add subordinate worktree grouping only |
| `src/App.tsx` around line 424 | Sidebar `Section title="Worktrees"` only calls `changeRoute("worktrees")`; make linked tree selectable and test it |
| `src/App.tsx` around line 432 | `worktree-grid` / `worktree-card` / `new-worktree-card`: existing UI creation/lock/remove/prune; extend rather than replace |
| `src-tauri/src/git.rs` around lines 226–239 | `worktrees()` parses `git worktree list --porcelain`; **inspect the `main` flag calculation**: comparison with current root may wrongly label linked checkout as main |
| `src-tauri/src/git.rs` around lines 357–405 | Existing `worktree_add`, `worktree_add_existing`, `worktree_add_detached`; delegated lifecycle handling |
| `src-tauri/src/advanced.rs` | Lifecycle lock/unlock/remove/prune back-end (search these exact operation names). Don't duplicate |
| `src-tauri/src/workspace.rs` | Strictly deserialised `Workspace` and `Tab` structs; backward-compatible migration, path dedup, active/closed state |
| `src/types.ts` | `Worktree`, `RepositoryTab`, `WorkspaceState`; align Rust/React serialization |
| `src/api.ts`, `src-tauri/src/main.rs` | Existing `load_workspace`, `save_workspace`, `snapshot`, `git_action`; prefer no new endpoint unless needed |
| `src/workflow.css`, `src/app.css` | Established Review Bench tokens, tab, worktree-card and dialogs, no new visual system |

**Design reference:** Penpot `ArcLane — Design Playground`, Page 1, **Review Bench board A** (actual reference discovered during Run 1, 1440×900). Use its current patterns and packaged source screenshots. If a board omits tab grouping, design the smallest consistent extension to existing tabs and validate light/dark. No generic dashboard or replacement CSS. Do not need REA competitor inspection if the existing UI already defines a usable pattern; ReAgent not applicable without narrow differential-native research.

## Existing reusable tests and exact execution commands

- `scripts/accept-worktree-lifecycle.py` — 4 grouped backend checks: existing branch attach; branch ownership refusal; detached checkout; dirty/locked remove refusal, unlock/remove/prune/ref preservation.
- `scripts/native-existing-tracking-worktree-audit.mjs` — independent packaged fixture verifying listed linked worktree and native creation. **This audit is focused and may not be in the full standard suite; run it directly.**
- `scripts/native-workspace-accept.mjs` — tab aliases/order, close/reopen and full executable restart, with explicit persistent test profile.
- `scripts/native-sprint-harness.mjs` — launches `Build\Arclane.exe` with isolated `WEBVIEW2_USER_DATA_FOLDER`. For **deliberate restart-state acceptance**, pass the *same fresh test-specific profile* to successive launches and close the app gracefully before inspecting persistence. Use a **different** profile between unrelated tests.
- `scripts/verify-sprint.ps1` — full local backend/native suites; does not depend on GitHub Actions; calls `rtk proxy`, available on the user's Windows PC.
- `scripts/native-ignored-files-accept.mjs` — regression to protect requirement 035 from new tab/checkout behaviour.

**Build once using the isolated checkout and re-use artifacts:** Windows PowerShell (modify paths if installed toolchain uses `CARGO_TARGET_DIR`):

```powershell
# Run in your fresh isolated checkout of feature/high-worktree-batch
npm ci                                # Skip only if lockfile-consistent node_modules already present
npm run build
cargo build --release --bin arclane-cli --manifest-path src-tauri/Cargo.toml
$env:ARCLANE_CLI = (Resolve-Path '.\src-tauri\target\release\arclane-cli.exe').Path
python scripts/accept-worktree-lifecycle.py
npx tauri build --no-bundle
New-Item -ItemType Directory -Force Build | Out-Null
Copy-Item -LiteralPath '.\src-tauri\target\release\arclane.exe' -Destination '.\Build\Arclane.exe' -Force
node scripts/native-existing-tracking-worktree-audit.mjs
node scripts/native-workspace-accept.mjs
node scripts/native-ignored-files-accept.mjs
powershell -NoProfile -File scripts/verify-sprint.ps1 -Phase backend
powershell -NoProfile -File scripts/verify-sprint.ps1 -Phase native
```

**Check rather than assume:** if Cargo target location differs, resolve the real built binary; if native tests use fixed debugger ports, run conflicting tests serially. `ARCLANE_CLI` **must be exported in the same session** as backend tests (Run 1 initially lost time here). Reuse cached Cargo target and npm dependencies; avoid unnecessary full rebuilds. Avoid replacing the installed user's EXE; only copy to the isolated checkout's `Build`.

## Independent acceptance matrix — implement tests before declaring completion

1. **Shared Git graph, separate HEAD and workfiles**: main + two linked worktrees with divergent commits/staged/untracked files. Click each from Worktrees card and navigator, focus/create correct tab, validate title/current branch and WIP counts; validate same reachable common history with distinct HEAD. Independently compare `git rev-parse HEAD`, `git status --porcelain=v1 -z`, refs, index bytes and source files per checkout.
2. **Grouping and migration**: unrelated repo + main + two linked checkouts show unambiguous grouped tabs (group identity derived from `git rev-parse --git-common-dir`, normalized for real linked paths, not name guesses); alias/order pin/close/reopen persists through graceful packaged Windows restart. Original old-shape `workspace.json` opens and survives save/restart, no favourites/data loss.
3. **Detached, missing/locked worktrees**: detached SHA opens in ArcLane with correct state and no fake branch; refuse already-checked-out branch, invalid destination and missing paths without quietly changing active tab. Git native main indicator reflects true primary worktree regardless of which checkout is open.
4. **UI native lifecycle**: create new + existing + detached through existing dialogs; lock/unlock; dirty and locked removal refused; clean remove confirmed, and close/reconcile removed tab only after success; prune stale administration records without deleting valid working directories. Test every actual operation on disposable checkouts.
5. **Safety**: never remove a dirty/locked checkout via a force flag; no rewriting shared refs, index or tracked file bytes as side effect of navigation, grouping or failed operations. Source checkout preserved. Test Unicode, spaces, brackets in worktree path. If a test deletes a checkout, it **must** be created by the same fixture, never a user checkout.
6. **Native UX**: light/dark packaged pixels, keyboard focus and screen reader labels; errors visible and actionable; grouping responsive at 1080×680 as well as baseline 1440×900. Check worktree tabs don't trigger extra background Git polling or startup model loads.
7. **Regressions**: original tab suite and original worktree CLI suite pass *without weakened assertions*, #035 ignored-file native suite passes, targeted full backend and native passes. Add focused tests into `verify-sprint.ps1` and keep existing user-data profile isolation; don't break intended restart tests.

## Efficiency instructions (Run 1 learning)

- **Do work, not a new discovery exercise.** Initial source inspection budget ~5–10 minutes; targeted investigation can resume when a test or code observation requires it. Begin with the known file seams and fixture; implement as soon as the approach is safe.
- **Build/test incrementally:** change coherent Rust/React slices, focused fixtures first, packaged EXE once per acceptance-worthy batch, full regression after focused green. Use exact `ARCLANE_CLI` and WebView2 profile instructions above.
- Use **High reasoning**, not Extra High, unless a concrete implementation blocker warrants escalation. Evaluate elapsed time and five-hour allowance consumption, but don't guess hidden tokens or claim unmeasured CPU savings.
- Report only three milestones: (a) first working slice/initial fixture, (b) focused native tests pass, (c) completed branch verification. No excessive progress narration.
- Maintain screenshots/test artifact evidence and compact successful logs. Don't declare anything accepted on mock data alone or skip error/cancellation/safe-failure tests.

## Handoff

- Push verified source changes *only* to `feature/high-worktree-batch`; leave integration and main untouched. Commit coherent slices without force push.
- Ledger updates for 003/032/062 must quote the real Rust/CLI/packaged tests. If any case remains incomplete, leave that ID partial and say precisely why.
- Include exact new commit SHA, compiled EXE hash, source and suite results, Penpot reference, resource changes if actually measured, time, human intervention, and any test-flake cause/fix.
- Do not run paid GitHub Actions; no public provider PR/review/issue writes.
- At handoff, preserve full test artifacts and a clean isolated working tree. Do **not** install over the user's running ArcLane.

## Model-ready first message

> **ArcLane Run 2 — implement, don't re-audit.** Use **High reasoning**. Work on `https://github.com/aloosley-ux/ArcLane`, branch `feature/high-worktree-batch`, which already includes accepted #035. Read `AGENTS.md`, `docs/FEATURE_COVERAGE.md`, and especially `docs/RUN2_WORKTREE_EXECUTION_2026-10-11.md`. That document is your complete engineering execution packet, including exact source locations, existing tests, commands/environment fixes, Penpot reference, and 003/032/062 acceptance. Start in your own fresh isolated checkout, avoid my installed app and existing dev checkouts. Implement the three worktree features end to end, preserve Review Bench styling, run independent Git-state fixtures and real packaged Windows light/dark native acceptance, and fix regressions before push. Don't merge or install. Don't waste time repeating completed research. Push only your verified topic branch, report exact evidence and remaining gaps, and **begin implementation now**.
