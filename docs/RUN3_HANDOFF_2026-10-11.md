# Run 3 controlled handoff — continue under Luna High

The user stopped this run for model usage cost on 11 October 2026. Scope expansion stopped. The already-running production build was allowed to finish; no new build or broad regression cycle was started after the stop. All three requirements remain **PARTIAL**, not accepted.

## Checkout and source

`C:\AI\ArcLane-Run3`, `feature/sol-low-file-review`. Starting HEAD `8ccc91256ae69f47c56e8b2ffc311748778c882e`, exact accepted Run 2 ancestor `e0fd0492613a88ceb8a11fe30307d14104747630`. Read AGENTS.md, the original Run 3 packet, RUN3_EXECUTION_EVIDENCE.md and this handoff before continuing. Do not use or overwrite the installed application or Run 2 checkout.

Implemented source:

- #036: one shared line alignment for paired and virtualized full-context inline unified review; safe React lexical coloring for a bounded extension set; BOM/endings/final-newline labels; retained find, word/whitespace controls; persisted mode and expanded focus/Escape handling.
- #037: separate bounded media commands and WIP/index/revision/file-history UI. PNG/JPEG/GIF/WebP byte detection and bounded decoding; re-encoded static PNG first-frame thumbnails; metadata-only fallback, size/hash/side labels and absent-side distinction. Text retains its 1 MB limit; media input 2 MB, 4096 px and 64 MiB decode budget, thumbnail at most 1024 px and 2 MB.
- #049: exact pre-discard bytes/existence saved and verified outside Git; persistent records and recovery UI; Git restore uses a verified private index to preserve the real index's exact bytes. Undo guards checkout/git-dir/HEAD/index/refs/target and verifies snapshot integrity. Refuses unsafe paths, reparse points, untracked/conflicted/nonregular entries, custom filters and excessive sizes. 4 MB before-file limit, 2 MB staged source bound allowing CRLF expansion; 32 retained folders with no automatic eviction. Completed snapshots survive CLI process restart. Failed/prepared snapshots are retained but UI undo requires finalized `available` state.
- Inherited fixture scripts now require ARCLANE_CLI instead of silently using another checkout's executable. New scripts and PowerShell runner preserve independent fixtures and logs.

## Actually executed evidence

- `npm ci` passed; repeated `npm run build` passed (TypeScript/Vite). Vite retains its existing large-chunk advisory.
- `cargo test --manifest-path src-tauri/Cargo.toml` passed compilation with **zero unit assertions**; this is not a correctness claim.
- Release CLI builds passed; existing dead-code warnings remain.
- Last completed focused runner: **38 media checks + 25 discard/undo checks**, plus comparison **9**, file inspection **4**, advanced Git **20**, revision review **6**, literal paths **10**: seven suites / **112 grouped checks**. Logs and fixture paths retained in this checkout's ignored artifacts.
- Media checks cover staged/worktree/history exact sides, decoded PNG previews/dimensions, new/deleted/identical/renamed files, binary/non-UTF8/PDF/executable/corrupt/oversize/SVG metadata fallbacks, BOM/CRLF/mixed/EOF and 30k-line text; unsafe paths and exact HEAD/refs/index/tree/status/file invariants.
- Recovery checks independently compare exact HEAD/refs/index/tree/target/neighbor bytes; staged overlap, missing-file recovery, fresh CLI processes, duplicate undo, newer edits and retry, changed index/HEAD/refs, wrong linked checkout, corrupt snapshot, unavailable/full storage, untracked/oversize/path/symlink/junction refusal.
- The first destructive fixture caught Git restore refreshing index stat bytes. Fixed by private-index restore; final 25-check pass proves the real index remains exact. Another test-harness issue was fixed by taking Git write-tree before index-byte snapshot and disabling optional status locks. Assertions were preserved.

**Untested later additions:** the current `accept-diff-media.py` also adds independent Pillow JPEG/GIF/WebP, dimension-limit and animated-first-frame checks; these were added after the retained 38-check run and have **not run**. The current `accept-discard-undo.py` adds a duplicate-discard case after the retained 25-check run and has **not run**. Do not cite expanded counts as passed.

The two new full packaged scripts have **not run**. No full backend/native regression phase ran. Packaged visual parity, focus trapping, search/whitespace/word behavior, long scrolling, historical/file-history media, destructive native safety, navigation and normal EXE restart recovery remain unaccepted. A brief wrap-up smoke, if build completion permits, is recorded separately and does not replace G3/G4/G5.

**Wrap-up package/smoke result:** already-running Tauri build completed (1m43s, exit 0). EXE SHA-256 `B52DAA8B836F6FB88EF44E3B46F15891770F1EA283AFBCEC91951D3CF24370AC`, 11,446,272 bytes. Two brief smoke checks passed, no renderer errors: Inline renders new source and both raster sides decode. `artifacts/run3-wrapup-smoke.png` was actually inspected at default light 1536×958. Full visual comparison remains pending. Main.rs BOM/blank EOF housekeeping followed build to satisfy diff hygiene; no behavior changed, but strict latest-source package acceptance requires rebuilding when the next run resumes. Exact built-source hashes and package timestamp proof remain in artifacts. No additional build was started after the stop.

## Known issues / follow-up risks

- Nonregular historical media entries currently use metadata-only fallback with size 0; verify/refuse or report the real size before accepting #037.
- New native scripts are unexecuted and may contain selector/race errors; diagnose without weakening assertions. The shared harness waits for Ready; new scripts additionally wait for loaded history.
- Full-context inline uses one honest whole-file hunk rather than collapsed contextual hunks. Lexical coloring is not AST or multiline semantic highlighting. Adversarial alignment performance and CR-only files have not been tested.
- Prepared/failed recovery transactions retain their private folders but have no automatic UI recovery path; document/export manually before removing them. No automatic expiry/cleanup exists. Completed/undone folders consume the 32-folder cap. Size limits and custom-filter refusal are deliberate.
- Undo checks state immediately before replacement but does not lock independent editors or external Git processes. External write races, readonly permissions, unusual filesystem failures and abrupt process termination need explicit assessment.
- New suites are not yet registered in verify-sprint.ps1's explicit native list. Run them explicitly, then register before a final full acceptance pass. Do not alter assertions to gain green results.

## Exact continuation checkpoint and commands

Start at G2's **pending extended fixtures**, then reuse the existing fresh EXE only if its saved hash/source provenance still matches. Any implementation source edits require a new package before acceptance. Preserve passing logs; do not treat this handoff as permission to install, merge, run Actions or mutate provider data.

```powershell
Set-Location -LiteralPath C:\AI\ArcLane-Run3
rtk git status --short --branch
rtk git log -1 --format=%H
# After any backend source change:
rtk cargo build --release --bin arclane-cli --manifest-path src-tauri/Cargo.toml
rtk proxy powershell -NoProfile -File scripts/run3-check.ps1 -Phase focused
# Only when resuming implementation/acceptance, not during this cost-limited stop:
rtk proxy powershell -NoProfile -File scripts/run3-check.ps1 -Phase package
rtk proxy node scripts/native-diff-media-accept.mjs
rtk proxy node scripts/native-discard-undo-accept.mjs
```

Inspect actual screenshots in artifacts against Penpot and correct pixels **before** full sweeps. After focused green, run impacted native-ui, native-diff-productivity, native-file-insights, native-revision-review, native-workspace, native-worktree-workflows and native-ignored-files suites. Register new native suites, then:

```powershell
rtk proxy powershell -NoProfile -File scripts/run3-check.ps1 -Phase backend
rtk proxy powershell -NoProfile -File scripts/run3-check.ps1 -Phase native
rtk git diff --check
```

Runner exports this checkout's ARCLANE_CLI in the same process. It catches native exit codes independently of stderr warnings. Never run native suites concurrently against shared ports.

## Design and tools

Penpot file `52a5041f-08a1-80f1-8008-c5171920d528`, page `52a5041f-08a1-80f1-8008-c5171920d529`. Eight initial frames and checklist are in RUN3_EXECUTION_EVIDENCE.md. Later design references: compact light media `362e4773-7c31-8074-8008-c574ff26f239`, recovery `362e4773-7c31-8074-8008-c574ffb5cb88`; light paired `362e4773-7c31-8074-8008-c575003d1834`; compact dark media `362e4773-7c31-8074-8008-c57501094863`, recovery `362e4773-7c31-8074-8008-c57502394510`; dark paired `362e4773-7c31-8074-8008-c57503612062`. Initial compact and dark exports were visually inspected. Later refinements were not packaged-validated.

USED: Git CLI and GitHub connector (remote starting HEAD), Penpot MCP, Rust/Tauri/TypeScript, independent Python fixtures, PowerShell; UI/UX skill for modal-focus guidance; narrow web read of official image 0.25.8 decoder/limits documentation (https://docs.rs/image/0.25.8/image/struct.ImageReader.html). REA and ReAgent SKIPPED: requirements/design sufficient, no differential experiment. Figma/Canva SKIPPED: Penpot sole authority. Model Testing SKIPPED: optional post-run only. Full packaged Playwright acceptance pending; any brief smoke is separately recorded.

Human interventions: **1**, the cost-limit stop. No model/effort switch or agents spawned. Allowance/token delta unavailable, not guessed. Checkout creation measured at 02:06:34 UTC (03:06:34 London); wrap-up time recorded in execution evidence. No main/integration/Run 2 mutation, installation overwrite, merge, force push, hosted issue/PR/provider writes or manually launched Actions.
