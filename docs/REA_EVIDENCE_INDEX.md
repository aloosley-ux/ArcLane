# ArcLane — REA evidence index and mandatory research baseline
*Living source map | 11 October 2026 | Update when further REA reports or versions are verified.*

## Rule: research first, not research if convenient

**The existing REA research is the primary input for every ArcLane feature design and parity run.** It is not an optional debugging aid. Start by finding the strongest relevant REA report/inventory, extract the supported behaviour and product structure, map it to the 104-feature ledger, then design ArcLane's **independent implementation**. Read the existing reports before deciding whether additional REA queries or observations are needed.

Required order: **REA research and GitKraken product evidence → exact user journeys + state ownership + failure paths → ArcLane architecture → Penpot UI → implementation → independent native verification**.

Do not silently substitute the current ArcLane UI or a generic Git-client convention for missing research. Mark gaps and decide deliberately whether to research further. **Mandatory REA report review ≠ mandatory new heavyweight analysis** when an existing report already answers the question.

## Existing evidence: where to start

| Resource | Verified location | What it provides / caveat |
| --- | --- | --- |
| Product/feature synthesis | `docs/GITKRAKEN_AUDIT.md` | Historical GitKraken 12.5 audit; multi-region workspace, tabs, refs, history, worktrees, agents and trust model. Starting orientation, not complete specification. |
| Verified high-volume REA evidence (12.5) | `C:\AI\REA\Experiments\Forge\artifacts\rea-complete-app-code.json.gz` | Compressed copy of a large REA analysis result (about 85 MiB gzip); provenance, corpus/limitations in the audit. Use bounded extracts/summaries before processing the full payload. |
| Structural + scoped REA views | `C:\AI\REA\Experiments\Forge\artifacts\rea-structural-summary.json`, `rea-app-graph-highlights.json`, `rea-bounded-findings.json`, `rea-electron-boundaries.json` | Structural and process-boundary starting points. Verify a specific claim in the relevant evidence, not an unsourced interpretation. |
| Interface and feature labels | `C:\AI\REA\Experiments\Forge\artifacts\gitkraken-translation-features.json` | Local candidate UI vocabulary/inventory: 129 agent-labelled, 78 worktree-labelled, 41 terminal-labelled examples and many other groups. Translation keys are **clues for further evidence**, not proof every control is enabled. |
| Focused graph and repo-navigation report | `C:\AI\REA\Reports\GitKraken-focused.md` and `C:\AI\REA\Evidence\GitKraken-focused-rea.json` | Bounded 12.5 AST evidence about commit graph, repo tab identity and navigation; not the whole research collection. |
| GitKraken 12.6 extracted corpus | `C:\AI\REA\Experiments\Forge\artifacts\gitkraken-12.6-extraction-manifest.json` | 340/340 files verified, 37,773,936 extracted bytes, no integrity warnings in this manifest; corresponding **reference-only** data under `gitkraken-12.6-app-code`. |
| 12.6 REA output provenance | `C:\AI\REA\Experiments\Forge\artifacts\rea-12.6-errors.txt` and `rea-12.6-compact.json` | Progress log reaches a terminal 'graph and boundaries reconstructed' message, but the saved compact JSON contains only `{"normalized_result":{}}`. Locate/validate the actual evidence result before claiming a complete, queryable 12.6 REA report. |
| Feature and current product status | `docs/FEATURE_COVERAGE.md` | 104 numbered user-visible obligations and current ArcLane evidence; **not a replacement** for the reference REA research. |

**Important protection:** Keep vendor code/data and large local artifacts under ignored local REA research; never copy original JS, proprietary art, assets or internal UI into ArcLane source, docs or GitHub. Use observable feature specifications and write an original implementation.

## Immediate example: Run 4 #082–#084

The label inventory already contains relevant concepts which the initial Run 4 packet overlooked:

- Agent status integrations and plugins/hooks (Codex, Claude Code, Copilot CLI, OpenCode), install/uninstall failure feedback and provider integration management.
- Worktree-specific agent setup commands and worktree WIP nodes showing active agent session or uncommitted work.
- Integrated and external terminal options, executable paths/arguments and terminal-panel open/close actions.
- Explicit relationship among worktrees, agent status and Git graph/state — broader than a new Agent Sessions page.

These are *evidence leads*. Before claiming parity, inspect the associated REA records and supported GitKraken 12.6 product workflows. Run 4's scoped safety implementation can still be accepted on its own tests, while unimplemented competitor flows remain separately tracked. Do not suddenly extend an active run without approval.

## Mandatory evidence-to-requirement mini-brief

For every future run, produce a **short table before Penpot/coding**:

| Item | Record |
| --- | --- |
| Requirement IDs | Exact ledger rows and intended slice |
| REA source | Specific files, analysis evidence IDs, relevant findings/terms or bounded locations and version |
| Reference journey | What the competing product appears to do, including uncertainty and unsupported claims |
| ArcLane decision | Intended original behaviour, explicitly identified improvements/differences |
| State owners | Git/repository state, process/session state, UI state, provider state |
| Critical transitions | Happy path, failure/rollback/retry, race/concurrency/restart where relevant |
| Proof | Disposable backend fixtures, fresh packaged native UX and independent Git/process invariants |
| Remaining unknown | Specific unanswered behaviour and whether another REA read is required |

**Gate:** If there is no recorded REA source review or explicit 'not present in indexed evidence, search undertaken' finding, the run is **not ready to implement**. If the reference evidence and our proposed UI disagree, discuss and resolve the discrepancy *before* Penpot.

## Updating this index

When a new report or version is analysed, append its path, product version, date, evidence provenance, supported workflows and important gaps. For each completed run, link the relevant REA evidence from its handoff and update this map when a discovered behaviour changes the design baseline.

**Priority distinction:** REA defines the **reference research**, the coverage ledger measures **ArcLane verification**, and our Rust/Tauri code expresses the **independent product implementation**. None should quietly replace another.
