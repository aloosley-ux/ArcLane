# ArcLane feature sprint — verified checkpoint

Development stayed in `C:\AI\REA\Experiments\Arclane-Features` on `feature/gitkraken-parity`, beginning at `af2f816`. No push, new worktree, live GitHub write or destructive acceptance against a real project was performed. The protected main checkout's branch remains `af2f816677ea6fd3c7a2ba39c81c81fe75ab1912` and its tracked working tree is clean. An early inherited backend test wrote an ignored acceptance JSON in the protected checkout before its hardcoded evidence path was corrected; no protected source or Git ref changed. That evidence was preserved.

## Completed batches

| Commit | Delivered behaviour | Principal obligations |
|---|---|---|
| `c413876` | Guarded amend, complete message, author override, co-author trailers, remote-tracking sharing warning, stale-HEAD refusal | 039, 041, 045 |
| `27d3c55` | Two-commit/ref tree comparisons, metadata and changed-file review, root/first-parent comparison, confirmed multiple historical-file restore preserving index | 027, 044, 045 |
| `eb048c7` | Commit/reference context actions, soft/mixed reset, pick/revert, three pull strategies, stash review and index restoration, graph keyboard navigation, real reflog toolbar | 029, 030, 042, 043, 049, 051, 054, 060, 061, 067 |
| `99f2858` | Diff/patch search, word highlighting, whitespace controls and preference persistence; packaged paused-operation continue/abort acceptance | 038, 058, 060, 096 |
| `c0b0971` | Bounded/cancellable provider reads with Windows helper cleanup, PR patches, CI jobs/steps, actionable diagnostics and explicit retry | 073, 077, 093, 095 |
| `6cea999` | Persistent repository tabs, aliases, ordering, active selection, closed history, close/reopen shortcuts and full executable restart | 002, 003, 005 |

All controls perform real local Git/process/settings behaviour. Provider-specific records and action acceptance remain **offline mock evidence**, even where the production command invokes installed `gh`.

## Final acceptance

The release was built with `npx tauri build --no-bundle` using the existing shared Rust cache. TypeScript and Vite passed; Tauri embedded the production frontend inside the native EXE. The release build has harmless dead-code warnings and Vite's large-chunk advisory.

- **14 backend suites / 120 grouped checks passed**: advanced Git, commit options, paired comparisons, conflicts, file inspection, mock GitHub, hunks, literal paths, operation workflows, provider process bounds, repositories, revision review, toolbox and workspace settings. All state-changing checks use fresh disposable `Forge-Testbed` repositories and independently inspect Git refs/index/files. Provider subprocess tests additionally inspect helper PIDs.
- **16 packaged UI suites passed**: the eight existing native regression suites, Review Bench design acceptance, and seven sprint suites (commit options, revision review, operation workflows, sequencer recovery, provider processes, workspace tabs and diff productivity). These run the actual production Windows EXE through WebView2 CDP, with zero reported renderer exceptions.
- **Windows window/idle smoke passed**: app remained alive, main-process working set 27.7 MB and 0 ms main-process CPU over the eight-second sample. These numbers exclude WebView2.
- **Full process-tree sample** on the 811-commit fixture after ten seconds warm-up: seven processes, 192.4 MB summed private memory, 380 MB summed working sets and 16 ms accumulated CPU across eight seconds. Shared pages can be counted repeatedly in working sets; this is a short observation, not a sustained resource-budget guarantee.
- Packaged light/dark Review Bench screenshots, the 1080×680 simulated desktop layout and restored-tab screenshot were inspected. The graph acceptance reached all 811 commits, sampling 27 mounted rows at the 350/700/811 loaded checkpoints. No 10k+ claim.

Reproduce the suites with `powershell -NoProfile -File scripts/verify-sprint.ps1`; use `-Phase backend` or `-Phase native` for targeted runs. Build the release CLI from this checkout into the shared target before backend acceptance. Additional launch and resource observations use `scripts/native-accept.ps1` and `scripts/measure-resources.ps1`. All evidence now defaults to this checkout. The resource script's inherited protected-checkout path was corrected before its final run.

Ignored local evidence: `artifacts/final-backend-regressions.json`, `artifacts/final-native-regressions.json`, per-suite `artifacts/final-*.log`, native screenshots/results, `artifacts/native-acceptance.json` and `artifacts/resource-measurement.json`. Expected merge/rebase/pick/revert conflict diagnostics and fixture LF/CRLF warnings in test logs are not suite failures; every recorded suite exit code is zero.

## Release artifact

`C:\AI\REA\Experiments\Arclane-Features\Build\Arclane.exe`

- Size: **10,189,312 bytes**.
- SHA-256: `CE3E178EAE8BDF3CDFB41707D305DD30C8A410B068466890FDBE03D259A3CDBE`.
- Native page: `http://tauri.localhost/`; a Vite development server is unnecessary.
- This is a standalone packaged executable, **not an installer/update acceptance**.

## Coverage against all 104 obligations

These counts classify the evidence column of `FEATURE_COVERAGE.md`, not complete GitKraken feature parity. Every obligation appears once.

| Evidence classification | Count |
|---|---:|
| Accepted within the explicit local scope | 14 |
| Partial implementation/verification | 45 |
| Partial, provider mock evidence only | 9 |
| Backend-only evidence | 4 |
| Not verified | 32 |
| Total | **104** |

Accepted scopes: **002, 027, 030, 033, 034, 038, 039, 041, 042, 044, 046, 058, 061, 096**. Their limitations remain written in their ledger rows. For example, reversing commits were tested locally without remote publication, text restore excludes symlinks/deleted entries, and sequencer recovery covers reopening a Git-paused operation rather than crashing during an arbitrary filesystem write.

Backend-only: **018, 032, 040, 055**. Mock-only partial: **069, 071, 072, 073, 074, 075, 077, 081, 103**. The remaining 77 rows consist of 45 partial and 32 unverified obligations; the complete per-obligation evidence and acceptance condition is retained in the ledger.

## Implementation boundaries

- Workspace settings live beside `repos.json` in `workspace.json`, under `ARCLANE_DATA_DIR` when specified. Recent history and open-tab order are independent. Roots are resolved by Git, aliases are validated, repeated saves are serialized and replaced through a temporary file. Load skips missing repositories. Open tabs are bounded at 30, with up to 30 closed entries. Closing a tab changes UI/settings only; it does not delete repositories, stashes, branches or terminal processes. Grouping worktrees is outstanding.
- Existing repository/selection ownership guards remain in force: delayed replies from an old repository cannot replace the current view; returning to a repository with a pending mutation keeps its mutation controls disabled. Tabs are distinct from terminal tabs, whose live ConPTY processes do not persist across restart.
- Amend/restore use the opened HEAD as a guard. Pull refuses dirty state and never autostashes. Stash apply/pop/drop pin the reviewed stash SHA rather than trusting an ordinal that may have moved. Continue avoids hanging on an external editor; hooks remain enabled for commits.
- Diff preferences are local and read-only. Paired UTF-8 snapshots preserve exact displayed before/after whitespace even when comparison ignores it. Patch search is limited to the explicit 1,400 displayed lines. Syntax highlighting, image diffs, binary conflict editing and large-file acceptance are outstanding.
- Provider processes concurrently drain bounded stdout/stderr, have a production 45-second deadline and a 3 MB combined-output cap, and attach helper descendants to a Windows job object. Read cancellation is scoped to repository/request ID. Provider mutations are bounded but do not expose cancellation; a timeout can mean unknown remote completion and tells the user to inspect GitHub before retrying. Core Git commands still lack user cancellation/deadlines and complete shared serialization.
- PR review/merge/issue write forms inherited from the baseline are mock-tested only. No live provider credential, permission, network or write acceptance was added. Test deadline overrides are confined to test environments.

No feature was left halfway implemented and presented as complete. Several shipped scopes deliberately cover a subset of their larger obligation, as the ledger and boundaries above state.

## Highest-value next work

1. Finish guarded multi-commit cherry-pick and interactive rebase pick/reword/squash/drop in disposable fixtures (059, 060), with explicit previews and paused-operation recovery.
2. Add shared repository operation serialization and core Git cancellation/deadlines without compromising index ownership (068, 093, 094).
3. Run approved **read-only** live GitHub acceptance for auth, PR patches and CI detail before expanding provider writes (069, 071, 073, 077, 095). Complete stacked PR restack/retarget workflows later (103).
4. Complete worktree grouping/management and Gitflow finish, submodule add/update, and relevant LFS lifecycle controls (003, 062–065); existing foundations are available.
5. Extend graph correctness and scale acceptance to merge-heavy 10k+/100k fixtures, then accessibility/DPI and installer acceptance (023, 024, 092, 097, 100).
