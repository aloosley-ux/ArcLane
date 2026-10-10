# Luna Max pilot — ArcLane requirement 035 (ignored-file visibility)

**Run via existing VS Code/Codex agent.** Model **GPT-6 Luna** with reasoning **Maximum** ("Luna Max" is a reasoning configuration, not a separate model identifier). Suggested working window: **up to 3 hours**. This is a real implementation task, not an investigation or UI prototype.

## User outcome

ArcLane's current Review Bench correctly groups changed/untracked/renamed/deleted files, but does **not** show ignored files. Complete the **ignored-file portion of ledger requirement 035** as a usable, safe, responsive native Windows workflow while preserving every accepted existing status/staging workflow. **Do not reimplement existing file status/staging.** A final 035 acceptance needs both the new ignored-file coverage and the existing mixed-state matrix, so add explicit regression evidence.

## Mandatory constraints

- Source `https://github.com/aloosley-ux/ArcLane`, starting from **`origin/feature/next-parity-sprint`** (verify current remote HEAD before changes). Create a **new separate topic branch** `feature/luna-035-ignored-files`. Work in your own clean clone or fresh worktree, *not* `C:\AI\REA\Experiments\Arclane`, `Arclane-Features` or `C:\AI\ArcLane`. Do not alter `main`.
- Existing design authority = **ArcLane Review Bench** (existing components/CSS tokens) and approved **Penpot** components. Penpot MCP is registered in the local Codex config; **find the approved Penpot file/node before relying on it**. If unavailable, don't invent another design system: extend the currently used file-state rows/sections only, and report the unavailable Penpot cross-check. No second theme; no unapproved redesign.
- Existing `src-tauri/src/git.rs` status parser uses `git status --porcelain=v1 -z --branch --untracked-files=all`; first read it and `src/App.tsx` file-state UI, `src/types.ts` and `docs/FEATURE_COVERAGE.md`. Keep compatibility with exact Git index/refs and linked worktrees.
- No GitKraken proprietary code/assets. Consult existing **REA** read-only evidence only if a behaviour question actually needs it; existing REA evidence targets mainly GitKraken 12.5, not proven 12.6. **ReAgent is NOT required** for this ordinary Rust/status task; don't force a native-function reconstruction process without a legitimate parity question.
- No new background scans, filesystem watchers, embedded AI, external infrastructure, no app-wide polling. Use on-demand ignored visibility and lazy results, with bounded output for repositories containing huge ignored directories. State clearly if an existing performance boundary requires an explicit "load more" action.
- Never mutate a non-fixture Git repository in testing. No real provider writes or test PR/issue creation. Do not spend GitHub Actions minutes or troubleshoot runners.
- Preserve stage/unstage/discard safety: ignored paths are **not** accidentally staged by "Stage all", must not be treated as ordinary untracked, and must not allow destructive operations by implication. A forced add would require a separately designed, explicit opt-in; it is **not** part of this pilot.

## Acceptance behaviour and fixture matrix

1. User can **deliberately reveal/hide ignored paths** inside the existing files/changes workspace; the default remains efficient and faithful to Git; no extra visual language.
2. Correctly distinguish **ignored (`!!`)** from untracked (`??`), staged rename (`R`), staged addition, unstaged modification and deletion. Independent `git status --porcelain=v1 -z --ignored`, `git check-ignore` and `git ls-files` comparisons; don't infer flags from filename extensions.
3. Nested `.gitignore` and `.git/info/exclude` semantics are honoured; large ignored directories do not cause eager deep scans or frozen UI. Show actual total/truncation/continuation truthfully rather than silently dropping files.
4. Special names: spaces, Unicode, brackets and safe literal path handling. Test on Windows. Neither shell injection nor path traversal.
5. Changing visibility or selecting an ignored item cannot alter HEAD, refs, Git index, tree or file contents. "Stage all" still only affects allowed non-ignored files. Any error/cancellation leaves state accurately displayed.
6. Existing **mixed-state WIP acceptance** (`scripts/native-existing-file-states-audit.mjs`) still passes unmodified; extend it or add a new fixture test for ignored state. Tests should use **new disposable** Git repositories only.
7. Run `npm run build`, `cargo build --release --bin arclane-cli` as appropriate, packaged `npx tauri build --no-bundle` and real native WebView2 test using separate profile; independently assert Git state before/after UI actions. Use repository `scripts/verify-sprint.ps1` relevant phase and broader regressions once feature-specific pass.
8. Inspect screenshots in **light and dark**, compare against existing Review Bench and **Penpot-approved components if available**. No new one-off CSS framework. Low idle CPU/RAM must remain unchanged; capture before/after and report evidence rather than speculative numbers.
9. Record any unfinished cases exactly. Upgrade ledger **035** from partial only if its complete scope and native acceptance are truly satisfied, otherwise leave partial with remaining blocker.

## Suggested tool allocation

| Tool | Work |
| --- | --- |
| VS Code + GPT-6 Luna (Maximum) | Own investigation, code, tests, fixes, coherent commit |
| GitHub + Git for Windows | Isolated topic branch and push after verified completion |
| Rust/Git/Python | Implement accurate Git status and independently validate fixtures |
| Penpot MCP | Read currently approved Review Bench tokens/components; preserve them; if inaccessible, report |
| Playwright/WebView2 packaged Tauri | Verify actual user toggle, mixed statuses, keyboard, warnings, light/dark |
| REA 6.2 | Optional **read-only** reference if observable GitKraken ignore handling is unclear |
| ReAgent 0.4 | **Not applicable by default**; avoid useless runs |
| Aaron Model Testing | Record task metrics/reliability if existing harness supports VS Code/Codex agent traces; never pretend model quality proves Git correctness |

## Efficiency and fair model evaluation

- Begin by writing the **failing fixture** and identify existing seams. Don't restart an architecture audit.
- Keep the first output short: existing implementation found, target files, baseline test(s). Then implement.
- Capture time to usable outcome, token/call counts *only where observed*, amount of human intervention, number of successful native/CLI tests, regressions, UI deviation, and whether the branch actually builds and pushes.
- Success = **working code + independent evidence**, not polished chat output. Compare a later agent on the **same inputs/tests/budget** without changing acceptance midway.
- If blocked, commit only complete safe work, report exact file/line/test blocker, and leave the integration branch untouched.

## Deliverables

1. Pushed `feature/luna-035-ignored-files` with readable commits and no forced history changes.
2. Actual built Windows test artifact and screen captures, with verified SHA/state fixture evidence.
3. Updated `docs/FEATURE_COVERAGE.md` for #035 only if justified.
4. 1-page handoff: changed files, tests PASS/FAIL, design reference, tool usage actually performed, process/performance impact, and open issues.
5. Do **not** auto-merge or auto-install over the user's running desktop ArcLane; the integrated branch reviewer can inspect and deploy the accepted batch.

---

## Copy/paste prompt for Luna Max

> You are the implementation engineer for ArcLane requirement **035**, not the product designer. Read `AGENTS.md`, `docs/FEATURE_COVERAGE.md`, `docs/DEVELOPMENT_PROGRAM_2026-10-11.md`, and **`docs/LUNA_MAX_PILOT_035.md`** in `https://github.com/aloosley-ux/ArcLane`, branch `feature/next-parity-sprint`.
>
> Work in your own fresh clone and topic branch `feature/luna-035-ignored-files`. Implement **safe, on-demand ignored-file visibility** in the existing Rust/Tauri 2 status workflow and original Review Bench using the existing UI components/tokens; do not invent CSS or redesign. Inspect the locally configured Penpot design authority if an approved node/file is available. Use REA read-only behavioural evidence only if needed; ReAgent is not automatically applicable. Implement complete success/error/large-repo/dirty-state behaviour with disposable Git fixtures and real packaged Windows UI tests. Never modify user Git repos, public `main`, or create provider test objects. No Actions/runner, background models or polling.
>
> Do actual implementation now, not another roadmap. Verify Git HEAD, refs, index, status and file bytes independently, run local Rust/TypeScript plus native WebView2 acceptance and existing mixed-WIP regressions. Fix failures before pushing. Update #035 only if completely accepted, otherwise say partial and why. Push only the verified topic branch and hand back commit hashes, exact test results, screenshot evidence, and a concise account of time/tools/tokens actually observed. **No unverified success claims.**

