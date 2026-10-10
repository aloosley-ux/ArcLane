# ArcLane — verification-only promotion sprint (11 October 2026)

Branch: `feature/next-parity-sprint`. This sprint **did not change ArcLane application source, UI components, stylesheet or binary**. Only new disposable Windows acceptance suites and feature evidence documentation were added. The user's installed `C:\AI\ArcLane\Arclane.exe` remains the existing usable preview; no reinstall is necessary.

## Result: nine additional accepted scopes

The 104-requirement ledger changed from **15 accepted / 51 partial / 5 mock-only partial / 4 backend-only / 29 unverified** to **24 accepted / 45 partial / 5 mock-only partial / 1 backend-only / 29 unverified**.

| ID | Verification | Outcome |
|---|---|---|
| 005 | Packaged Ctrl+P/Ctrl+K palette searches, empty match, Escape, Enter activation of distinct real routes; repo state preserved | Accepted local command-palette workflow |
| 009 | Navigator/review-bench keyboard Home/min/clamp/Shift+Arrow; **normal Windows executable close and complete restart** preserves chosen widths; native pointer drag updates persisted layout | Accepted panel sizing and persistence |
| 011 | Independent packaged EXE cold-start native UIAutomation window/type/title; real Win32 minimize, restore, still-running process and normal shutdown | Accepted native window controls |
| 017 | Local/remote branches, tags, stashes and worktrees in actual packaged navigator; filter, collapse/expand, branch scope selection validated against disposable Git refs/index | Accepted reference navigator |
| 018 | Diverged bare upstream produces exactly 1 ahead / 1 behind in native header, independently matching `git rev-list --left-right --count` | Accepted tracking indicators |
| 022 | Mixed staged rename/add and unstaged modify/delete/untracked fixture; WIP totals/badges/groups match `git status`, exact file and index state unchanged | Accepted mixed-state WIP presentation |
| 024 | **10,041** real Git commits, 29 pagination pages, max **27** mounted graph rows, observed **28 MiB** JavaScript heap, preserved scroll position, oldest commit accessible; Git HEAD/index/bytes unchanged | Accepted 10k+ graph virtualisation |
| 052 | Native annotated tag exact object/message; push/delete remote tag via disposable bare remote preserving local tag; lightweight tag create/delete via palette | Accepted local/bare-remote tag lifecycle |
| 055 | Native upstream push to disposable bare remote and tracking confirmation; remote divergence produced safe non-fast-forward rejection without ref/index/file loss | Accepted local/bare-remote push safeguards |

Supporting scripts:
- `scripts/native-existing-shell-audit.mjs` (005/009/017)
- `scripts/accept-native-window.ps1` (011)
- `scripts/native-existing-tracking-worktree-audit.mjs` (018/032)
- `scripts/native-existing-file-states-audit.mjs` (022/035)
- `scripts/native-large-graph-audit.mjs` (024)
- `scripts/native-existing-push-tags-audit.mjs` (052/055)

**Important test correction:** The first 009 restart attempt used the harness's forced process kill, which discarded pending WebView2 storage writes and falsely suggested missing panel persistence. Repeating with a graceful Windows window close and 1200 ms storage flush passed the full process-restart test. The test was additionally extended to verify pointer dragging. Do not interpret the forced-kill test as a verified product defect.

## What still needs code, not merely more testing

- **032 remains partial, not accepted:** A linked worktree was created through the actual native UI and listed with the correct branch/ref/path, but opening its *shared Git history as a selected ArcLane workspace* remains unimplemented.
- **035 remains partial:** All ordinary mixed Git file states were correct, but ignored files are currently absent from the navigator. Exposing/handling ignored entries requires development.
- **010, 029, 045, 059–065, 068, 090, 092–095** each retain specific untested scenarios *and/or* missing feature breadth documented in the authoritative ledger. For example, signed-key cases and SHA-to-OS-clipboard proof are not replaced by tests for unrelated areas, and 100k-history budget is separate from verified 10k virtualisation.
- Provider mock-only workflows still require approved real-provider write acceptance, and cannot be promoted from simulated API success.

## Safety and reproducibility

- No provider writes, GitHub Actions, runner, hosted PR/issue fixtures, or destructive writes against the user's developer repositories.
- All Git mutations were confined to fresh disposable Forge-Testbed repositories and local bare remotes; test results independently checked refs, index, tree and working files where applicable.
- Tests used the existing **packaged WebView2 Windows executable** in a separate test profile; original Review Bench visuals and `main` branch remain unchanged.
- Successful new acceptance groups were recorded in compact stdout; detailed screenshots/evidence remain on the test Windows machine's isolated verification checkout.
- The existing desktop ArcLane preview does not need rebuilding because application source is unchanged.

For subsequent testing-only promotions, identify truly complete user workflows rather than relabelling missing features as testing gaps. Prefer native, independent acceptance and update `docs/FEATURE_COVERAGE.md` only after passing full scoped behaviour.
