# ArcLane — Run 3 execution packet: File Review & Recovery (Sol Low)

**Status:** READY TO EXECUTE — instructions committed, **not implemented**.
**Date:** 11 October 2026.
**Model experiment:** GPT-6 **Sol**, reasoning **Low** throughout (do not silently switch models/effort).
**Source baseline:** Run 2 accepted/pushed commit **e0fd0492613a88ceb8a11fe30307d14104747630**, from `feature/high-worktree-batch`.
**Isolated Run 3 branch:** `feature/sol-low-file-review`, created from that exact SHA. This document is itself committed on Run 3's branch; start from its current remote HEAD. The branch's plan-only commits are not evidence of feature implementation.

## Mission and non-negotiable boundaries

Deliver three connected, real Git workflows, not three checkboxes:

| ID | Baseline evidence | Required end-to-end outcome |
| --- | --- | --- |
| **036** | PARTIAL: virtualised paired UTF-8 comparison, search, whitespace preferences and word changes already work. | Real **inline/unified** + side-by-side textual review, safe source highlighting, line-ending/EOF fidelity, search, keyboard and long-file behaviour. |
| **037** | NOT VERIFIED: existing comparison rejects binary/non-UTF8/oversized text; untracked binary display is placeholder only. | Staged, unstaged and historical **image and binary comparisons** with bounded genuine image previews where safe and truthful metadata/fallback otherwise. |
| **049** | PARTIAL: confirmed `discard_file` restores tracked working file but lacks actual undo/recovery. | Safe confirmed discard with a **real pre-discard recovery snapshot**, verifiable undo, no overwrite of newer edits, correct index/HEAD preservation, and explicit unsupported-case refusals. |

The three IDs are **independently** accepted or left partial based on completed fixture and freshly packaged Windows UI evidence. Never change the ledger to accepted just because a component compiles.

**Do not modify or merge** `main`, `feature/next-parity-sprint`, Run 2 `feature/high-worktree-batch`, the user's installed `C:\AI\ArcLane\Arclane.exe`, or original development/REA checkouts. Make a **fresh separate local clone/checkout**, suggested `C:\AI\ArcLane-Run3`. Do not run GitHub Actions (allowance may be exhausted), change hosted issues/PRs/remote provider data, force push, erase unknown files or install over any existing app. Use only fresh disposable Git fixture repositories for mutating tests. Avoid persistent background processes, polling, AI load, network dependency and idle resource regressions.

## Every tool has an explicit job — mandatory execution contract

At handoff enumerate **USED with actual evidence** or **SKIPPED with reason** for every tool below. A tool name in a prompt is not evidence it ran.

| Tool | When / required action | Evidence / unacceptable shortcuts |
| --- | --- | --- |
| **GitHub connector + local Git CLI — REQUIRED** | Verify current Run 3 remote HEAD descends from `e0fd049`, source ledger and clean local clone; read changed files, branch, commit and push only isolated Run 3 branch. | Record base SHA, branch, `git status`, diff and final commit SHA. No merges, force pushes, hosted writes or Actions. |
| **Penpot MCP — REQUIRED FIRST for meaningful UI** | **Before editing UI**, open connected **ArcLane — Design Playground**, inspect Review Bench tokens/shell, create/update **File Review & Recovery light and dark frames** plus 1080×680 compact layout. Show real inline/side-by-side diff, image/binary fallback, discard confirmation, available/refused undo. Compare with packaged pixels. | Record real file/page/node/frame refs and design-to-code checklist. Merely reading token names is **not** the design gate; a generic dashboard is unacceptable. |
| **REA 6.2, local evidence — CONDITIONAL** | At orientation decide whether image review/undo interaction has an ambiguous competitor behaviour. Consult existing `C:\AI\REA` evidence; only then perform narrow read-only black-box observation if needed. | Record observed behaviour/version/evidence or `SKIPPED: requirements and ArcLane designs sufficient`. Do not copy GitKraken implementation, code, artwork, assets or CSS. |
| **ReAgent 0.4 — SKIP by default** | Only if a precise native-function differential experiment becomes necessary; state test boundary and evidence first. | Never use as a generic code editor or reverse engineer proprietary implementation. |
| **Rust, Tauri, TypeScript, Git fixture tests — REQUIRED** | Implement real bounded backend + UI, errors, success and safety; run `npm run build`, relevant Rust/CLI/Python fixtures; independent Git-state comparisons. | Actual output, fixture files and exit codes; no mock-only acceptance. |
| **PowerShell / local Windows build — REQUIRED** | Run build in isolated clone, set `ARCLANE_CLI` in **same PowerShell process** as scripts, preserve logs and detect Git exit code separately from benign CRLF stderr. | Capture build provenance, exact EXE hash and checked source. Never overwrite installed preview. |
| **Production Tauri/WebView2 + Playwright — REQUIRED** | Rebuild `Build\Arclane.exe` **after last UI source edit**, prove build freshness, exercise native controls against disposable repos, capture light/dark/1440×900/1080×680, keyboard/focus and errors. | A dev-server screenshot, stale executable or successful test without the updated UI is **not** acceptance. |
| **Figma/Canva — SKIP** | Penpot is sole design authority unless explicitly authorised to switch. | No second disconnected design system. |
| **Aaron Model Testing — POST-RUN ONLY** | Optional scorecard using real measured timing, model/allowance %, verified IDs, interventions and tests; not part of app runtime. | Do not guess tokens or launch expensive background benchmarks. |
| **Web/browser research — CONDITIONAL** | Only for a concrete missing current library/API fact; otherwise use repository docs/code. | No broad discovery or unrelated research loops. |

**Non-skippable gates** — stop progression if failed:

- **G0 Source:** exact `e0fd049` ancestry; isolated clean Run 3 checkout; original local repos and installation untouched.
- **G1 Design:** Penpot **actual updated light/dark + compact UI frames**, explicit review checklist, **before UI code**. No visual acceptance from tokens alone.
- **G2 Correctness:** independent fresh disposable success/failure fixtures; HEAD, refs, index bytes, file bytes and Git status protected.
- **G3 Pixels:** production EXE rebuilt from latest UI source; inspect real screenshots vs Penpot, correct layout/interaction flaws **before full regression sweep**. Verify EXE hash + source age/content; a stale build fails this gate.
- **G4 Native:** focused packaged WebView2 interaction scripts pass; negative/safety/undo proof counts.
- **G5 Regression:** impacted suites, then full backend and native suite passes; document genuine blocked suites, never weaken assertions.
- **G6 Handoff:** final diff review, honest per-ID coverage update, verified commits/push, clean isolated branch, precise proof and skipped tool reasons. No installer deployment or integration merge.

## First 5–10 minutes: code map, not a research marathon

These locations were inspected in the pre-Run-2 integration baseline. **Verify their names and behaviour in the new Run 3 checkout; line numbers may have moved.**

| File | Existing seam and intended work |
| --- | --- |
| `src/App.tsx` | `inspectFile` currently runs `client.diff`, `client.hunks`, `client.compare` concurrently, defaults to `side`. `diffMode` accepts `patch/hunks/side`; `renderFiles` exposes confirmed discard. Add proper inline mode, type-aware preview and undo affordance without a new parallel UI system. |
| `src/SideBySideDiff.tsx` + `src/comparison.css` | Existing virtualised 23px comparison rows, line/word diff, whitespace controls, search, navigation and persistence. Prefer sharing aligned diff data with new inline view. |
| `src/PatchDiff.tsx` + `src/workflow.css` | Patch search and truncation, established tokens, comparison controls. Protect existing behaviour. |
| `src-tauri/src/comparison.rs` | `compare` / `between`; paired commit/index/worktree blobs; UTF-8/NUL/1MB restrictions. Keep strict text limits, add a separate **bounded type-aware media response** rather than unsafe arbitrary text conversion. |
| `src-tauri/src/git.rs` | `diff`, `parse_status`, `action` and Git runtime guard; untracked binary placeholder. Preserve literal path handling and truthful Git classification. |
| `src-tauri/src/advanced.rs` | `discard_file` uses `git restore --worktree -- <file>` after tracked-path check. Wrap recovery snapshot atomically/safely before destructive mutation and integrate approved guarded operation. |
| `src-tauri/src/main.rs`, `src/api.ts`, `src/types.ts` | Existing Tauri commands, types and interfaces; extend narrowly for image preview and undo transaction. |
| `src/RevisionReview.tsx` + `src/FileInsights.tsx` | Existing historical/revision comparisons; make binary/image handling valid beyond current WIP. |
| `scripts/native-sprint-harness.mjs` | Real packaged EXE from checkout's `Build\Arclane.exe`, fresh disposable Git repos, isolated WebView2 profiles, CDP. |
| `scripts/verify-sprint.ps1` | Standard all-backend/all-native runner. Keep new focused tests registered; verify CRLF/nonzero-exit handling and initial-commit readiness separately. |

**Known existing acceptance:** `scripts/native-ui-accept.mjs`, `scripts/native-diff-productivity-accept.mjs`, `scripts/accept-file-inspection.py`, `scripts/accept-advanced-git.py`, `scripts/native-workspace-accept.mjs`, `scripts/native-worktree-workflows-accept.mjs` and `scripts/native-ignored-files-accept.mjs`. Run all impacted tests and retain Run 1/Run 2 regressions. Latest Run 2 handoff reported **21 backend scripts, 17 packaged native regression suites and 12 focused worktree checks** green; these are baseline reports, **not** automatic Run 3 results.

## Requirement-specific acceptance detail

### 036 — Text differences

1. Inline **and** paired modes selectable in the same Review Bench and expanded view; predictable mode persistence and keyboard/focus semantics.
2. Honest unified hunk representation, additions/deletions/replacements and line numbers. Avoid building independent contradictory alignment engines.
3. Safe syntax-colour rendering for a bounded set of common code/text extensions without `dangerouslySetInnerHTML`, unsafe HTML, network calls or huge runtime dependencies. If no suitable highlighter exists, select a lightweight safe implementation and document tradeoffs.
4. Correct missing final newline, CRLF/LF/mixed, blank lines, UTF-8 BOM, rename paths and long-file scrolling. Display normalization must not change underlying byte identity.
5. Preserve current find, match count, next/previous, word-diff, whitespace-ignore/show and virtualization. Readability at 1080×680 in light/dark.

### 037 — Binary/image inspection

1. Distinguish **staged**, **unstaged**, **commit/historical** sides: absent file versus zero bytes, changed versus identical, kind/type/size, supported media versus generic binary.
2. Safe bounded raster previews for verified PNG/JPEG/WebP/GIF bytes; report old/new file sizes and, where dependable, image dimensions. Do not load external URLs; do not execute SVG or arbitrary HTML.
3. No unbounded base64/binary payload in commands, logs or DOM. Oversize, corrupt, unsupported, misleading extension, non-UTF8, PDF, executable, symlink and outside-root paths receive a useful metadata-only fallback or clear refusal.
4. Support changed/new/deleted image files in WIP/index/history, not just an isolated preview dialog.
5. If animated media is supported, make first-frame/animation limitation honest. Secure mode/path handling; preserve HEAD/refs/index/file bytes on all inspection.

### 049 — Real discard and undo

1. Existing confirmed discard is **not** enough. Store exact pre-discard bytes (and missing-file state where needed) in **bounded app-private recovery storage**, outside Git repository, before `git restore`. No secrets in logs.
2. Snapshot creation/verification failure **must refuse** discard. Refuse unsafe symlink/reparse, untracked, outside-root and oversized/unsupported targets rather than silently losing recovery.
3. Undo must actually restore exact file bytes and existence while preserving current HEAD, index, shared refs and neighbouring checkout paths. Respect staged + unstaged overlap.
4. Refuse undo if checkout identity/HEAD/index or target bytes have changed since discard in a way that makes overwrite unsafe. Never silently clobber later edits; provide actionable refusal.
5. Document retention/size limits, process restart recovery and cleanup. For **full acceptance**, recovered state must survive app navigation and a normal executable restart and remain safe; otherwise ledger stays **partial**.
6. Test duplicate clicks, failure/retry, stale snapshot, multiple linked worktrees, Unicode/apostrophe/brackets/spaces paths and exact fixture invariants.

## Implementation/testing sequence — no backwards design

1. **Orientation**: read `AGENTS.md`, this packet, coverage, current source and relevant fixtures; confirm Git baseline, no undocumented source changes. Identify minimum missing behaviour and save baseline results.
2. **Penpot mandatory design**: access connected ArcLane Design Playground, add/update frames for these workflows in **light + dark**, compact 1080×680, including error/discard/undo states. Log real frame references and a concrete alignment checklist. **Do not edit React/CSS before completing this stage.**
3. **Focused implementation**: bounded Rust/Tauri commands, types and React components; preserve Review Bench and active feature functionality. Write/extend independent Python/CLI and packaged native fixture scripts **before claiming done**. Suggested new names: `scripts/accept-diff-media.py`, `scripts/accept-discard-undo.py`, `scripts/native-diff-media-accept.mjs`, `scripts/native-discard-undo-accept.mjs`.
4. **Fast backend proof**: `npm run build`, cargo/Rust tests, relevant CLI fixtures. Compare exact HEAD/refs/index bytes/tree and target/neighbor file bytes before/after every mutation, including refused mutation and undo. No test can mutate original checkout or user data.
5. **Rebuild current packaged app** (PowerShell, from isolated Run 3 repo only):

   ~~~powershell
   npm ci  # if lockfile-consistent node_modules absent
   npm run build
   cargo build --release --bin arclane-cli --manifest-path src-tauri/Cargo.toml
   $env:ARCLANE_CLI = (Resolve-Path '.\src-tauri\target\release\arclane-cli.exe').Path
   npx tauri build --no-bundle
   New-Item -ItemType Directory -Force .\Build | Out-Null
   Copy-Item -LiteralPath '.\src-tauri\target\release\arclane.exe' -Destination '.\Build\Arclane.exe' -Force
   Get-FileHash -Algorithm SHA256 .\Build\Arclane.exe
   # Run relevant node/Python tests in THIS same session to retain ARCLANE_CLI.
   ~~~

   If cargo output differs, inspect the actual build path. Verify executable freshness by SHA, timestamp **and at least one new UI/behaviour marker** before trusting screenshots or test results. Never run parallel native tests against shared CDP ports.
6. **Design-vs-package checkpoint**: inspect light/dark at 1440×900 and 1080×680, verify controls readable and reachable; compare with actual Penpot frames. Fix density, unwanted duplicated surfaces, missing error affordances, focus, truncation and awkward dialogs now, **before full suites**.
7. **Focused packaged native acceptance**: new media/text/undo suites plus `node scripts/native-ui-accept.mjs`, `node scripts/native-diff-productivity-accept.mjs`, `python scripts/accept-file-inspection.py`, `python scripts/accept-advanced-git.py`, and Run 1/2 impacted regressions. Distinguish actual Git exit failure from warnings on stderr.
8. **Full regression phase**: only after focused green, run `powershell -NoProfile -File scripts/verify-sprint.ps1 -Phase backend` then `-Phase native`, while `ARCLANE_CLI` is correctly exported. Await a genuine history/commit load before route-changing in native tests; don't simply inflate timeouts.
9. **Final evidence**: verify source diff, `git diff --check`, native EXE SHA-256, fixture byte invariants and real screenshots. Update only proven `036/037/049` rows in `docs/FEATURE_COVERAGE.md`; do not accidentally revert accepted `003/032/035/062`. Stage/review coherent changes, commit and push **this branch only**. Verify remote HEAD=local HEAD and clean tracked state.
10. **Handoff**: no release install or merge unless the user separately authorises it.

## Experiment: Sol Low versus Luna

Record observed wall time, five-hour allowance delta, human interventions, independently accepted IDs, any partials, focused/backend/native test counts, tool-use/skips, build/provenance misses, and defects independently found/fixed. Be explicit that batches differ in difficulty, so raw speed or allowance is not a complete quality comparison.

Reference runs: Run 1 Luna Extra High (#035, reported independent acceptance); Run 2 Luna High (#003/#032/#062, remote commit `e0fd049`, reported 21 backend + 17 native suite passes and 12 focused worktree checks, one human Penpot redirect).

### Completion report — required concise structure

- Exact starting Run 2 SHA, topic branch and final pushed SHA; remote/local agreement and clean checkout.
- `036/037/049` each ACCEPTED or PARTIAL, with missing real behaviour where applicable.
- Actual Penpot file/page/frame URLs or IDs and light/dark/compact screenshot paths; produced binary SHA-256.
- New Rust/React scripts/fixtures; tests run with their actual results and limitations.
- Git fixture index/ref/tree/file protection proof; error/refusal/undo cases.
- All tool entries USED/SKIPPED with real evidence; observed time, allowance and user interventions.
- No hosted writes, no installed-app overwrite, no main/integration or Run 2 branch mutation.

**Agent launch directive:** The task is to **implement and verify**, not to rewrite this packet or spend a long time auditing the architecture. Execute independently in Sol Low, maintain high safety/quality, stop and report only a genuine blocker. No fabricated validation and no unsupported acceptance claims.
