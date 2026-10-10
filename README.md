# Arclane — Windows Git desktop client (working name)

**Status: exploratory v0.1, NOT GitKraken feature parity.** Original user-facing design and source. Full product target: complete GitKraken 12.6 workflow coverage with a distinct visual system, a Rust-native Git/process backend, on-demand GitHub integrations, agent/worktree operations and low idle overhead.

## Run and build

- Production frontend: `npm install && npm run build`.
- **Production Windows build:** `npx tauri build --no-bundle`. This invokes the frontend build and packages its output inside the actual native EXE. **Do not use standalone `cargo build --release` for distribution**: that binary may load the Vite dev server (`127.0.0.1:1422`) instead of embedded assets. For this checkout, share the existing Rust target cache with `$env:CARGO_TARGET_DIR = "C:\\AI\\REA\\Experiments\\Forge\\src-tauri\\target"` and copy the resulting `target/release/arclane.exe` to local `Build/Arclane.exe`.
- Desktop dev mode: `npm run desktop` (uses Vite + Tauri).
- Functional UI capture without touching real repos: `node scripts/visual-accept.mjs`; it injects recorded **real Git output** from the disposable `Forge-Testbed/forge-visual-benchmark` into a short-lived local browser. This test mock is never shipped in the production app.

## Current working slices

- Persistent repository tabs, aliases, ordering, active selection and closed-tab history; recent repositories and open folder picker. Right-click a tab for its actions; Ctrl+W closes a tab and Ctrl+Shift+T reopens it. Tabs survive a full application restart.
- References sidebar (local, remote, tags, stashes, worktrees); graph history across refs, search and manual pagination.
- Real staged/unstaged status and **selective hunk staging/unstaging**; read-only native side-by-side UTF-8 diff including expanded full-file view; **three-way text conflict resolution** with ours/theirs/manual decisions; file history and line blame; commits, branch/tag maintenance, merge/rebase/cherry-pick/revert (including conflict detection/continue/abort), stash apply/pop/drop, worktree create/lock/unlock/remove, soft/mixed reset, fetch, fast-forward pull, push.
- Explicit clone and repository initialization with folder selection and Rust-side destination/transport validation.
- Guarded commit amend with full message, author and co-author controls; remote-tracking sharing warnings; exact two-commit/ref comparisons, commit metadata and confirmed multi-file historical restore that preserves the index.
- Context menus for commits and references; merge/rebase/fast-forward pull choices; stash patch review including untracked content and index restoration; detection and continue/abort of Git-paused merge/rebase/cherry-pick/revert operations when opening a repository.
- Searchable patch and side-by-side diffs, word highlights, visible/ignored whitespace and persistent diff preferences. UTF-8 text is supported; patch views show at most 1,400 lines and search those displayed lines.
- On-demand GitHub PR/issue/CI integration via existing `gh` login, including PR patches and CI job/step detail. Provider reads support scoped cancellation, bounded output, deadlines and Windows helper-process cleanup. **Public GitHub PR/patch/CI reads, cancellation and missing-repository retry are live verified; private/enterprise coverage remains unverified.** Existing confirmed provider write controls have mock contract tests only.
- Agent worktree organisation, **multiple live on-demand ConPTY PowerShell terminal tabs** and external editor integration. ConPTY processes terminate with their tabs or when the app closes. Does **not** represent real agent status until an integration exists.
- Native process model: Git CLI processes are short-lived, with no repo polling, model inference or embedded server required during ordinary native use.

## Reference and evidence

- Latest installed source reference: GitKraken `12.6.0`, `%LOCALAPPDATA%/gitkraken/app-12.6.0/resources/app.asar`. The archival extraction uses REA's installed local ASAR library, with 340 code/resources entries **individually SHA-256 integrity checked, zero mismatches**, in `C:/AI/REA/Experiments/Forge/artifacts/gitkraken-12.6-app-code` (locally ignored, proprietary, not copied to Arclane).
- REA 6.2.0 completed the 12.6 application architecture scan; an attempt to request only summary keys returned an empty filtered result. It is **not** legitimate to infer coverage from that output. Complete 12.5 REA static evidence and known limitations remain at `C:/AI/REA/Experiments/Forge/docs/GITKRAKEN_AUDIT.md`.
- GitKraken 12.6 adds **stacked pull requests** (branch-to-branch PR chains and graph/list status) and **multiple terminal tabs per worktree/repo**. Stacked PR chains remain **unimplemented**; multiple embedded terminal tabs are implemented and validated in a packaged native Windows application. See official 12.6 release notes: https://gitkraken.com/blog/break-up-that-monster-pr-whats-new-in-gitkraken-desktop-12-6
- The complete **104-obligation** ledger is in [docs/FEATURE_COVERAGE.md](docs/FEATURE_COVERAGE.md). Every accepted scope requires native interactive acceptance, not static labels or screenshot appearance.

## Boundaries

- Existing Forge and installed GitKraken remain untouched and separately usable.
- Tests may mutate only disposable repositories under `C:/AI/REA/Experiments/Forge-Testbed`.
- No tests mutate Cortana, SDS, Nostalgia or any other live repository; real repos were **not tested for writes**.
- No extraction of proprietary product source, bundled icons, proprietary styles or internal names into tracked Arclane implementation.
- A successful compile or visual screenshot is **not evidence** of full UI acceptance; future evaluations should explicitly grade native behaviour, Git correctness and resource usage.

## Known gaps — major

Side-by-side diff and text conflict resolver lack syntax highlighting, rich per-word editing, image/binary conflicts, complex three-way merge automation and very large file scalability. Interactive rebase, general undo/redo and core Git process cancellation are outstanding; recovery currently offers non-destructive reflog-to-new-branch rescue. Gitflow starts and basic LFS/submodule tools exist, but their complete lifecycles remain unfinished. Complete provider workflows, signing, complete stacked PR workflows, agent permission requests, worktree tab grouping and installer acceptance remain outstanding. The graph has been tested through 811 commits, not 10k+ or octopus-merge complexity. Repository tabs persist; terminal processes do not survive app restart.

## Feature sprint checkpoint

Latest: [read-only GitHub verification](docs/GITHUB_LIVE_CHECKPOINT_2026-10-10.md) covers real public PR patches/CI detail, cancellation and actionable errors, with the final executable hash. Live writes remain untested and unperformed.

Six completed feature batches retain the Review Bench design. See [the sprint technical checkpoint](docs/FEATURE_SPRINT_2026-10-10.md) for commit hashes, implementation boundaries and final acceptance evidence. Build the executable with Tauri, then run `powershell -NoProfile -File scripts/verify-sprint.ps1` for all backend and packaged native regressions. Use `-Phase backend` or `-Phase native` for targeted runs. The backend tests use the shared release CLI at `C:\AI\REA\Experiments\Forge\src-tauri\target\release\arclane-cli.exe`; build that CLI from this checkout before running them. All Git mutation fixtures live under `Forge-Testbed`; provider suites use the local mock executable.

## Verified preview acceptance

- Frontend `npm run build`: passed, 1,746 modules transformed and no TypeScript errors.
- Testbed GUI `node scripts/visual-accept.mjs`: loaded all **109** genuine commits from the isolated `forge-visual-benchmark` fixture in the live custom interface, with **zero JavaScript page errors**. Evidence: ignored `artifacts/arclane-visual-acceptance.json` and `arclane-visual-1600.png`.
- Rust release executable: `Build/Arclane.exe` (locally ignored); passed `scripts/native-accept.ps1` Windows window launch and process-idle check. At that checkpoint, **main process only** measured 32.2 MB working set and 0 ms additional CPU over 8 seconds; **WebView2 processes are not included**. This is not total footprint or large-repo performance.
- No GitHub remote writes or destructive live-repo operations were performed.

## October 10 independent acceptance expansion

- `python scripts/accept-advanced-git.py`: 20 grouped backend workflows passed in disposable repositories, including merge-conflict abort, rebase, cherry-pick, revert, safe worktree removal, stash and dangerous input rejection.
- `python scripts/accept-hunks.py`: six checks passed for selective index patching, including a three-hunk file, exact reverse unstage, Unicode paths and invalid path refusal.
- `node scripts/native-ui-accept.mjs`: ten checks passed against **the actual packaged native EXE** with WebView2 CDP and independent Git state verification (five diff/hunk checks and five pseudo-terminal lifecycle checks); zero JavaScript errors.
- `python scripts/accept-repositories.py`: five tests passed for clone/initialize, SHA/content identity, overwrite refusal and unsafe URL rejection.
- The first native launch test exposed an incorrectly built development-only EXE. That failure is documented and the release build was corrected to use `npx tauri build --no-bundle`. Native CDP verified the production page is `http://tauri.localhost/`, with no Vite listener required.
- Idle CPU/memory measurement remains incomplete for the **full** WebView2 process tree. No claimed total RAM budget until measured.

- Native 811-commit graph acceptance: 350, 700 and 811 loaded commits each mounted 37 rows or fewer; oldest commit reachable; no renderer exceptions. See ignored artifacts/graph-native-acceptance.json.
- Full idle process-tree measurement on the same 811-commit fixture (8-second window): 1 Arclane process + 6 WebView2 processes; 201.0 MB summed private memory; 413.1 MB summed working sets (shared pages potentially double-counted); 47 ms total CPU across 8 seconds. This is not a typical fresh-install footprint, GPU metric or long-duration benchmark. See scripts/measure-resources.ps1 and artifacts/resource-measurement.json.

## Verified file-inspection and merge milestone — 2026-10-10

- Rust conflict engine: 6 isolated backend checks covering base/ours/theirs extraction, exact ours/theirs/manual staging, Unicode file paths and rejected invalid or stale targets (`scripts/accept-conflicts.py`).
- Native conflict resolver: 6 actual packaged Windows application acceptance checks against **two real simultaneous conflicts**; one incoming-version resolution, one manual reconciliation, independent Git index verification, and successful two-parent merge completion (`scripts/native-conflict-accept.mjs`).
- Paired file comparison: 9 Rust command acceptance checks for HEAD/index/worktree contents, partially staged files, added/deleted files, historical commit parent snapshots, Unicode and invalid/binary paths (`scripts/accept-compare.py`). Read-only side-by-side UI aligns changed lines and virtualises both small/expanded views.
- File history and blame: 4 isolated Rust checks across commits by different authors (`scripts/accept-file-inspection.py`), and 6 packaged Windows UI checks for three commit records, historical diff, correct per-line authorship, search and no Git mutations (`scripts/native-file-insights-accept.mjs`).
- Latest packaged native regression: **12** Git/hunk/side-by-side/terminal checks, **6** conflict checks and **5** virtualised graph checks all pass independently, with no JavaScript renderer exceptions. All state-changing tests use disposable `Forge-Testbed` descendants.
- The full product ledger remains at **104 target workflows**. Specific verified slices have been updated in `docs/FEATURE_COVERAGE.md`, while whole-feature parity remains unclaimed. Unfinished major areas include provider PR reviews and mutations, stacked PRs, interactive rebase, multi-provider CI, LFS/submodules, signing, agent integrations, high-volume graph tests and installer distribution acceptance.

**Latest provisional idle measurement:** packaged Arclane with 811 loaded commits, 10-second warm-up, 8-second observation: seven processes (one Arclane, six WebView2), **230 MB total private memory**, **426 MB summed working sets** (shared pages can be counted repeatedly), and **437 ms accumulated CPU** across the process tree. A shorter three-second warm-up measured 258 MB private and 1,079 ms CPU during its eight-second sample, so results vary with startup settling. These are measurements, not a validated lifetime resource budget.
