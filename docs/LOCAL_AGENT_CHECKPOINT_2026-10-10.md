# ArcLane local development checkpoint — 10 October 2026

Continues baseline `4e681f6` on `handoff/arclane-local-agent-20261010`. The original handoff remains the intended scope. No remote is configured; nothing was pushed and no live GitHub actions were performed.

## Verified baseline and architecture

- Clean checkout at the handoff commit. Rust/Tauri 2 application, React/TypeScript renderer, installed Git CLI for operations, installed `gh` for opt-in provider requests, ConPTY for terminals.
- Tauri commands run blocking Git/provider work on `spawn_blocking`. Modules cover repository creation, advanced Git operations, hunks, text conflicts, paired file comparisons, history/blame, repository tools and the provisional provider bridge. The separate CLI shares those Rust modules for backend acceptance.
- Renderer builds real history lanes from parent SHAs and virtualizes mounted rows. The existing 811-commit native regression passes; 10k+/100k and broad DAG shapes remain unaccepted.
- Native text conflicts, paired diffs, history/blame, two on-demand terminal tabs, Toolbox operations, and the fixture-only provider views reproduced the handoff evidence. Gitflow finish, agent process management, rich PR diffs/reviews, stack mutations, signing, image/binary diffs, installer lifecycle and broad recovery/cancellation remain incomplete.
- `docs/GITKRAKEN_AUDIT.md` was missing. Restored the authored research document from the adjacent Forge project, labelled as historical Forge/WPF/12.5 evidence. It is not current ArcLane acceptance.

## Single-file correctness fix

Previously `Stage notes[1].txt` also staged `notes1.txt`: passing a filename after `--` still allows Git wildcard/pathspec interpretation. The same ambiguity affected diff/hunk inspection, unstage, discard, history and restore. Explicit file-selection commands now use `--literal-pathspecs`. Pattern-based batch internals such as stash retain normal Git semantics.

New `scripts/accept-literal-paths.py` checks exact index/worktree outcomes for stage, unstage, patch, hunk stage/reverse, history, historical restore, discard, wildcard/magic input refusal, stash round-trip and isolated conflict resolution. It reproduced the baseline failure before the fix; all 10 groups pass with the final implementation.

New `scripts/native-literal-paths-accept.mjs` exercises real packaged Windows UI controls and independently checks index, bytes and HEAD. All 8 checks pass. Screenshot: ignored `artifacts/native-literal-paths.png` (1536 × 958). No renderer errors; no visual redesign.

The existing native hunk script had a timing failure: it inspected Git's index before UI refresh/reinspection completed, then used the first hunk button while switching to the staged panel. It now waits for the settled one-hunk view and targets the explicitly named **Unstage hunk** button. Exact index/worktree verification remains unchanged.

Regression testing caught that enabling literal mode for *all* Git commands disrupts stash's internal magic pathspecs. That approach was corrected before checkpointing. Existing advanced tests and the new tracked/untracked bracket-name stash round-trip pass.

## Repository and selection ownership fix

Delayed file, history and Git-action replies previously could populate another repository after switching tabs. Refreshes and inspection requests now invalidate obsolete replies; repository switches clear old dialogs, selections, titles and provider state. History pagination ignores superseded pages. Toolbox sections discard obsolete loads, and repository-owned views remount when their path changes.

Pending main-view Git mutations are tracked per normalized repository path. Returning to that repository keeps mutation controls busy until the original operation settles. Old-repository completion cannot refresh the active repository, publish its success toast, or clear a different repository's busy state. This is renderer ownership protection, not backend cancellation or a cross-process Git lock.

Collaboration now clears records from failed feeds while retaining independently successful feeds. Closing a selection clears its detail/loading state. The mock provider regression verifies a failed PR feed, independently valid issues, and explicit retry recovery using only a disposable copy of offline fixtures.

New `scripts/native-repository-state-accept.mjs` passes 11 checks against the packaged EXE. It delays delivery of **real Tauri/backend results**, rather than replacing commands or Git data, to reproduce file, pagination, mutation, WIP-selection and Toolbox-section races. Independent Git checks confirm repo A's requested index mutation and unchanged repo B HEAD, index and working bytes. Screenshot: ignored `artifacts/native-repository-state.png`. The baseline reproduced the stale-file failure; the intermediate build reproduced the pending-operation tab-reentry failure before the final guard was added.

## Final verification

Built frontend and CLI, then packaged the frontend through `npx tauri build --no-bundle` and copied the release executable to `Build/Arclane.exe`. The copied binary's SHA-256 matches the Tauri build output. The Vite >500 kB chunk warning and three unused CLI settings-function warnings predate this work; builds succeed.

Backend scripts pass: `accept-repositories.py`, `accept-advanced-git.py` (20 groups), `accept-hunks.py`, `accept-conflicts.py` (6), `accept-compare.py` (9), `accept-file-inspection.py`, `accept-toolbox.py` (17), `accept-github-mock.py` (10 fixture-only groups), and `accept-literal-paths.py` (10).

Packaged native scripts pass: `native-ui-accept.mjs` (12), `native-conflict-accept.mjs` (6), `native-file-insights-accept.mjs` (6), `native-graph-accept.mjs` (5), `native-toolbox-accept.mjs` (8), `native-collab-mock-accept.mjs` (11 fixture-only), `native-literal-paths-accept.mjs` (8), `native-repository-state-accept.mjs` (11). All mutating Git acceptance work used fresh fixtures under Forge-Testbed; the graph test only reads the existing 811-commit fixture.

Final packaged executable SHA-256: `3AAEE6EAA7702B185D288E03D69B6FB281EF7A6478251220E1B2F249258E35A5`. The release output and copied `Build/Arclane.exe` were compared after Tauri finished successfully. The nine backend scripts passed for the Rust filename milestone; all eight native suites were exercised against the final renderer package.

## Tool findings

Git/terminal tools and local Playwright CDP successfully exercised the packaged WebView2 application, including screenshots. Penpot MCP access succeeded: eight named design imports plus the ArcLane playground were connected, with **583 Ant Design components** exposed in the initial probe. That initial probe preceded the parallel library improvements. The user's subsequent update confirms editor counts Ant Design 583, Blender 859, GNOME 245 and Material 3 382; Ant Design, Blender and GNOME enumeration has now been verified through MCP by that parallel work, while Material 3's equivalent MCP check remains pending. These newer counts were not re-audited during functional development. Use relevant libraries for substantive new UI; preserve the current architecture and UI. No dedicated VS Code/Codex workspace MCP was exposed. REA tools are available; these source-evidenced correctness fixes did not require original-application reverse-engineering.

## Next development priorities identified in source

1. Provider failures and cancellation: `gh`/Git `.output()` is unbounded in time; the output-size check occurs after collection. Collaboration still hides actionable provider error details. Failed-feed stale records and the dismissed-detail loader are now fixed with offline regression coverage. Next implement bounded subprocess execution and actionable offline-tested errors before a separately approved isolated live-provider validation.
2. Broader asynchronous operation safety: renderer ownership fixes do not cancel backend processes or serialize Toolbox/provider operations with main-view mutations. Same-repository reference-scope changes during a mutation and pending Toolbox action completion need additional targeted coverage.
3. Stacks remain display-only; head/base name matching lacks fork identity and ambiguous/cyclic dependency reporting. Do not implement remote restack/retarget/merge until the intended semantics and provider contracts are verified.
4. Continue the full 104-obligation ledger, prioritising interactive rebase, reliable recovery, large-history behaviour, agent lifecycle, and Gitflow/submodule/LFS lifecycle gaps. Significant visual changes require user approval. Configurable design languages will need semantic component/style contracts; the current dark/light colour toggle does not meet that product goal.

Native passes are scoped to their fixtures. Mock provider tests do not establish real GitHub compatibility, auth, permissions, rate limits, cancellation or remote mutation acceptance.
