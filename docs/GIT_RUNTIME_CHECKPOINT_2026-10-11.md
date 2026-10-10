# ArcLane — Core Git Reliability Slice (11 October 2026)

Branch: `feature/next-parity-sprint`. GitHub Actions unused. `main` remains the stable baseline.

## Runtime implemented

- **Core Git actions** now run with an operation deadline (120 seconds local; 180 seconds fetch/pull/push), bounded combined stdout/stderr (1.5 MB), a per-repository request identifier, and user-triggered cancellation. The new execution path is strictly on demand. No persistent workers, background Git scans, timers or polling are introduced.
- On Windows, Git actions and their spawned hooks/helpers are held in a kill-on-close Job Object. Cancellation, deadline and output-limit errors communicate **unknown Git completion**. They do **not** automatically delete lockfiles, revert the index or reset refs.
- **Cross-process writer protection** builds on the previous in-process guard. A crash-safe Windows named mutex is keyed by the *canonical Git common directory*, so different ArcLane CLI/GUI processes and linked worktrees in the same Windows session exclude overlapping writes through ArcLane. It is released on success, error and process crash. Normal external Git clients do not participate; their own native lock safeguards still apply.
- **UI:** Only the existing main toolbar gains an on-demand **Cancel Git** action while a tracked operation is active. Existing button/alert styles are reused. The request is scoped to the matching repository/action ID. The app refreshes Git state after the backend exits and never treats a cancellation as proof that Git made no changes.
- Existing `git_action`, including advanced, interactive rebase and cherry-pick Git calls, passes through the bounded runtime. Toolbox, conflict and hunk mutation commands retain the shared writer guard but not yet the full cancel/deadline UI. Repository initialization/clone and external Git processes also remain outside this cancellation coverage.

## Verified Windows acceptance (no real user repository mutations)

- `npm run build`: **PASS**.
- `cargo build --release --bin arclane-cli`: **PASS**.
- `npx tauri build --no-bundle`: **PASS**, new executable only in an isolated verification checkout.
- `python scripts/accept-git-runtime.py`: **6 PASS groups**:
  1. Competing second ArcLane process on linked worktree refused promptly without altering Git state.
  2. Unrelated repository remained independently writable.
  3. Writer lock released after successful delayed commit.
  4. Writer lock released automatically after the CLI was killed.
  5. Timeout ended slow Git hook/process descendants without losing original HEAD, staged index or file bytes.
  6. Subsequent fresh commit succeeded without deleting native Git lockfiles.
- `node scripts/native-git-cancel-accept.mjs`: **2 PASS** packaged WebView2 checks: clicked Cancel Git during a real slow pre-commit hook; verified the original HEAD and exact staged/index/file content, refreshed renderer and usable commit composer.
- Re-ran **five existing backend acceptance scripts**: `accept-operation-workflows.py`, `accept-cherry-pick-series.py`, `accept-gitflow-finish.py`, `accept-worktree-lifecycle.py`, `accept-interactive-rebase.py` — **all exit code 0**.
- Re-ran **three packaged native regression suites**: `native-sequence-accept.mjs`, `native-operation-workflows-accept.mjs`, `native-sequencer-recovery-accept.mjs` — **all exit code 0**.
- No provider writes, test PRs or GitHub Actions were triggered.

## Accurate 104-scope state

Updated ledger entries: **068**, **093**, **094**. All remain *partial* because cancellation/deadline coverage is not yet universal, and the mutex cannot serialize uncooperative external Git clients or independent Windows desktop sessions. Overall scope classification remains **14 accepted, 51 partial, 5 mock-only partial, 4 backend-only, 30 unverified = 104**.

## Follow-on work

1. Extend bounded cancellation and recovery UX to Toolbox, hunks/conflicts, clone/init and other mutating endpoints where appropriate, without adding polling.
2. Add a test matrix for external Git lock contention and stale native Git lockfile diagnostics, without destructive recovery.
3. Continue advanced worktree grouping and full Gitflow finish lifecycle, then remaining ledger scopes.

Safety: all state-changing tests ran inside disposable fixtures. User's regular ArcLane checkout and feature worktree source files were not modified by these tests. Git compilation reused the existing Cargo target cache. Generated executable and native logs remain in a separate `%TEMP%\ArcLane-Verify-88fd7790` checkout.
