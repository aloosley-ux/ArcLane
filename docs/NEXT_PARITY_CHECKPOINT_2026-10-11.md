# ArcLane — Next parity sprint checkpoint (2026-10-11)

Branch: `feature/next-parity-sprint` (do not merge into `main` until release acceptance). Starting commit `ecbb8eb`.

## Implemented and exercised

- **059 — Interactive rebase, partial:** Git-native linear rebase for 1–32 commits, ordered pick/reword/squash/drop, durable worktree-specific plan/editor helpers, preflight HEAD and clean-tree checks, resume/skip/abort. Disposable Windows CLI verifies changed commit ordering, trees/index/files, stale HEAD refusal and repeated conflict/abort/continue. Native packaged UI reword acceptance verifies exact resulting HEAD ancestry and tree. Merge-preserving and shared/published-history rebase remain unsupported.
- **060 — Multi-cherry-pick, partial:** Ordered 1–32 non-merge SHA selection, validation of all commits before write, stale HEAD/dirty worktree/double inclusion safeguards, Git-native pause/continue/abort. Disposable CLI tests six grouped behaviours, including exact index/ref/file verification and conflict continuation. Packaged UI executes actual two-commit selection and verifies history. No mainline merge-commit pick.
- **062 — Worktrees, partial:** New branch, existing branch, detached historical inspection, existing lock/unlock/remove/prune with no force removal. Four grouped CLI fixture checks verify refs and folder contents. Grouping/agent lifecycle and complete native worktree acceptance remain.
- **065 — Gitflow, partial:** Safe feature finish from the checked-out `feature/*` to `develop`: validates expected source HEAD and clean tree, creates no-ff merge, retains source branch, stops on conflicts for existing recovery. Four grouped CLI fixture checks verify merge parents, HEAD/index/files, stale/dirty refusal and conflict abort. Release/hotfix completion and packaged finish acceptance remain.
- **068/094 — Mutation safety, partial:** Shared in-process Rust writer lease keyed to the Git common directory, including linked worktrees, across git_action, hunks, toolbox and conflict resolution on desktop and CLI. Cross-process/external Git serialization, cancellation, subprocess deadlines and lock-file recovery are not done.

## UI and visual integrity

- Preserved the original Review Bench, its graph, chrome, tabs and navigation.
- Sequence editors use existing `modal`, `workflow-modal`, `workflow.css`, button styles, design tokens and Lucide icons.
- Removed `cherry-pick-series.css` and `interactive-rebase.css`; scoped layout additions are in `src/workflow.css`. Fixed inherited 480px modal width and compacted success toast text.
- Both modal workflows were visually inspected in packaged Windows **light and dark** theme captures, and both passed native interaction checks. Native tests assert width, theme inheritance, Escape dismissal and preserved Git state.

## Windows verification actually run

- `npm run build`: PASS (TypeScript + Vite).
- `cargo build --release --bin arclane-cli`: PASS.
- `npx tauri build --no-bundle`: PASS, isolated checkout executable.
- `python scripts/accept-cherry-pick-series.py`: PASS, six grouped checks.
- `python scripts/accept-gitflow-finish.py`: PASS, four groups.
- `python scripts/accept-worktree-lifecycle.py`: PASS, four groups.
- `python scripts/accept-interactive-rebase.py`: PASS, including reorder/reword/squash/drop, safe abort and repeated continue.
- `node scripts/native-sequence-accept.mjs`: PASS, 3 packaged UI checks (Escape + two real Git mutations).
- `node scripts/native-sequence-dark-accept.mjs`: PASS, 2 packaged theme/UI checks.
- `node scripts/native-operation-workflows-accept.mjs`: PASS, 9 native workflow + 3 native pull checks.
- `node scripts/native-sequencer-recovery-accept.mjs`: PASS, 16 native recovery checks across merge/rebase/cherry-pick/revert.

All mutated test repositories were disposable. No real user repository, GitHub issue, PR, provider mutation or `main` ref was changed. Normal source checkouts were not edited; the Windows cargo build reused the existing cache/target. The isolated testing checkout is under `%TEMP%\ArcLane-Verify-88fd7790`; it contains untracked local logs and screenshots only.

## Authoritative 104-scope ledger

See `docs/FEATURE_COVERAGE.md`. Classification at this checkpoint is **14 accepted, 51 partial, 5 mock-only partial, 4 backend-only, 30 unverified = 104**. Keep 059/060/062/065/068/094 **partial** until the missing breadth and acceptance are verified. Do not promote categories to accepted based on successful targeted tests.

## Priority remaining

1. Native core Git cancellation/timeouts and cross-process operation coordination; add explicit lock/deadline/abort tests against disposable fixtures.
2. Complete worktree grouping and lifecycle UI/agent workflows; Gitflow release/hotfix finishes.
3. Merge-aware interactive rebase, published-history safeguards and richer cherry-pick operations.
4. Full remainder of the 104-scope ledger (provider integrations, graph productivity, collaboration, advanced Git, accessibility, large repos).

GitHub Actions were not used. Main remains the public stable branch.
