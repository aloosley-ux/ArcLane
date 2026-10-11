# ArcLane — remaining 80 requirements development programme
*Historical roadmap snapshot prepared 11 October 2026 against `feature/next-parity-sprint`. The 80 remaining IDs and all counts below describe that **old baseline**, not current Run 3/4 progress. Always query current `docs/FEATURE_COVERAGE.md` target rows instead of rereading this full roadmap for a scoped run. Current agent authority: `AGENTS.md` and `docs/REA_EVIDENCE_INDEX.md`.*

## Mission and non-negotiables

Finish the **104-requirement GitKraken 12.6 workflow-parity target** as an original lightweight Rust/Tauri 2 Windows Git client, without importing GitKraken code, markup, artwork, styles, or proprietary assets. The live ledger currently has **24 accepted, 45 partial, 5 mock-only partial, 1 backend-only and 29 unverified**. The remaining **80** IDs below are mapped **exactly once** (the roadmap concerns unaccepted scopes, not 80 entirely absent features).

**Already usable:** `C:\AI\ArcLane\Arclane.exe` on the user's Windows PC. Keep normal user work protected. Preserve the established Review Bench and its token/styles/components; **no new UI redesign**. `main` remains the stable public baseline; all code on separate topic branches based on the feature integration branch. No Actions/runner dependency, force pushes, new always-on services or idle AI. Mutating tests only on disposable repositories. No real GitHub PR/issue/review/merge writes without explicit, narrowly scoped authorization.

## Execution lanes and ordering

These are **workstreams**, not a requirement to implement every ID in a stage in one large change. Prefer one coherent 1–3 requirement batch at a time, verify and deploy, then move forward. Priorities: P0 = safety/use every day; P1 = Git correctness and parity; P2 = workflow productivity; P3 = opt-in integrations and mature agent features.

| Stream | Target | Priority | Unique remaining requirement IDs |
| --- | --- | --- | --- |
| S0 | Make the preview release-grade | P0 | 001, 010, 012, 016, 097, 100, 101, 102 |
| S1 | Git safety, failure and recovery | P0 | 090, 091, 093, 094, 095, 098, 099 |
| S2 | Finish day-to-day files and commits | P0 | 035, 036, 037, 040, 043, 045, 047, 048, 049 |
| S3A | Branches, remotes, patch and safe history | P1 | 050, 051, 053, 054, 056, 057, 066, 067 |
| S3B | Advanced Git lifecycle | P1 | 059, 060, 062, 063, 064, 065, 068 |
| S4A | Graph correctness and scale | P1 | 023, 028, 029, 031, 092 |
| S4B | Reference workflows and worktree selection | P1 | 019, 020, 021, 025, 026, 032 |
| S5 | Desktop workspace and discovery | P2 | 003, 006, 007, 008, 013, 014, 015 |
| S6A | Real GitHub read workflows | P2 | 069, 070, 071, 073, 077, 079 |
| S6B | Safe GitHub write workflows | P3 | 072, 074, 075, 076, 081, 103 |
| S7 | Other providers and planning integrations | P3 | 078, 080 |
| S8A | Agent-linked worktrees and terminals | P2 | 082, 083, 084, 085, 086, 104 |
| S8B | Durable agent sessions and custom tools | P3 | 087, 088, 089 |

**Dependencies and practical order:** Ship P0 onboarding + safety before broad external usage. Run the contained **#035 ignored-file** Luna Max pilot first because its risk is isolated and it validates the workflow. File/diff fixes precede binary-conflict and review UI; graph correctness precedes drag/drop ref UX; worktree selectability precedes agent sessions; provider **reads precede writes**; GitHub provider workflow precedes secondary providers; agent status/reopen needs a real durable session model. Native performance and accessibility regressions are release gates for *every* stage, not deferred until S0/S1.

## Detailed scope by stream

### S0 — Make the preview release-grade

**Scope:** 001 Repository open/clone/init; 010 Configurable themes, zoom, high DPI; 012 Settings, external tools, per-repo settings; 016 Tray/notification behaviour and low idle CPU; 097 Accessibility, keyboard focus, screen reader; 100 Reproducible Windows installer, cleanup, update; 101 Startup and idle resource budget; 102 Original visual language, no proprietary assets.

**Deliverable:** First-run file-picker and installer/uninstall/upgrade; settings/external tools; tray and native shortcuts; keyboard/screen-reader/DPI passes; measured startup, idle and theme fidelity. Guard old user data and normal installation paths.

**Exit:** one or more independently accepted vertical workflow slices; Rust/TypeScript, negative-path, disposable Git-state and packaged Windows UI tests. Update only proven ledger scopes, retain partial on any missing behaviour.

### S1 — Git safety, failure and recovery

**Scope:** 090 No inference/background polling by default; 091 Unicode/apostrophe/metacharacter paths; 093 Cancellation/timeouts/no app hangs; 094 Multi-process and lock-file handling; 095 Error banners and retry with diagnostics; 098 Offline work without GitHub or AI; 099 No destructive real-repo acceptance writes.

**Deliverable:** Expand deadline/cancel/operation-coordination beyond git_action; external Git lock diagnostics; offline/reparse/Unicode/paths; no destructive fixture escapes; no background inference or polling. Preserve crash/paused-op recovery.

**Exit:** one or more independently accepted vertical workflow slices; Rust/TypeScript, negative-path, disposable Git-state and packaged Windows UI tests. Update only proven ledger scopes, retain partial on any missing behaviour.

### S2 — Finish day-to-day files and commits

**Scope:** 035 Untracked, ignored, renamed and deleted files; 036 Inline and side-by-side textual diffs; 037 Binary/image/file-type diffs; 040 Commit staged contents and push option; 043 Reset mixed/soft/hard with previews; 045 Commit metadata, parents and signatures; 047 Git hooks, skip hooks and GPG signing; 048 Commit templates, trailers and editor settings; 049 Safe discard and undo changed files.

**Deliverable:** Ignored-file opt-in, accurate rename/binary/large-file state; text syntax + true binary/image diff; commit index composition; guarded hard reset/undo; signed metadata/hooks/templates/trailers. Full disk/index/ref differential checks.

**Exit:** one or more independently accepted vertical workflow slices; Rust/TypeScript, negative-path, disposable Git-state and packaged Windows UI tests. Update only proven ledger scopes, retain partial on any missing behaviour.

### S3A — Branches, remotes, patch and safe history

**Scope:** 050 Clone/init/open URL and SSH support; 051 Local/remote branch create/switch/rename/delete; 053 Fetch from multiple remotes; 054 Pull merge/rebase/ff-only and abort; 056 Force push only with exact explicit confirmation; 057 Merge fast-forward and non-FF, abort; 066 Patch generate/apply and reject; 067 Undo/recover destructive operations.

**Deliverable:** Clone/SSH/auth edge cases; remote branch lifecycle; multi-remote fetch; pull strategy and merge matrix; separately confirmed force push; patches and recoverable operations. Use local bare remotes; no hosted writes.

**Exit:** one or more independently accepted vertical workflow slices; Rust/TypeScript, negative-path, disposable Git-state and packaged Windows UI tests. Update only proven ledger scopes, retain partial on any missing behaviour.

### S3B — Advanced Git lifecycle

**Scope:** 059 Rebase interactive pick/reword/squash/drop; 060 Cherry pick single/multiple and conflict resume; 062 Worktree create/open/lock/unlock/remove/prune; 063 Submodules sync/add/update; 064 Git LFS status/track/lock; 065 Gitflow workflow; 068 Error, cancellation and in-progress state handling.

**Deliverable:** Complete rebase/cherry-pick edge cases, Gitflow release/hotfix finish, worktree lock/prune/open safeguards, submodule add/remove, LFS lock/unlock with test server, cancellation of remaining mutation paths.

**Exit:** one or more independently accepted vertical workflow slices; Rust/TypeScript, negative-path, disposable Git-state and packaged Windows UI tests. Update only proven ledger scopes, retain partial on any missing behaviour.

### S4A — Graph correctness and scale

**Scope:** 023 Real DAG merges/octopus/branch lanes; 028 Graph search/filter by author/ref/path; 029 Graph keyboard navigation and copy SHA; 031 Detached HEAD and initial/empty repositories; 092 Huge repo startup and history pagination.

**Deliverable:** Real DAG crossing and octopus fixtures; path/author/commit search across loaded/unloaded history; keyboard SHA clipboard through OS; empty/detached states; 100k+ commits start/scroll/search budgets.

**Exit:** one or more independently accepted vertical workflow slices; Rust/TypeScript, negative-path, disposable Git-state and packaged Windows UI tests. Update only proven ledger scopes, retain partial on any missing behaviour.

### S4B — Reference workflows and worktree selection

**Scope:** 019 Branch folder grouping and filters; 020 Hide/solo refs and graph; 021 Drag-and-drop branch targets; 025 Commit columns and rearrangement; 026 Ghost branch and ancestry highlight; 032 Worktree lists and selectable shared history.

**Deliverable:** Branch folder grouping; hide/solo/drag-drop ref targets; graph column customization and ancestry; open selected linked worktree into normal repository tabs with exact common-dir semantics.

**Exit:** one or more independently accepted vertical workflow slices; Rust/TypeScript, negative-path, disposable Git-state and packaged Windows UI tests. Update only proven ledger scopes, retain partial on any missing behaviour.

### S5 — Desktop workspace and discovery

**Scope:** 003 Tab aliases, reordering, grouping worktrees; 006 Customisable toolbar and action states; 007 Menu bar and Windows keyboard conventions; 008 Profiles and workspace configurations; 013 Undo/redo history with bounded rollback; 014 Search across files, branches and commits; 015 Log/activity viewer with error details.

**Deliverable:** Group tabs/worktrees, customizable toolbar/menubar, profiles, useful undo history, unified cross-domain search, coherent activity/log viewer. Only extend current Review Bench controls and Penpot-approved variants.

**Exit:** one or more independently accepted vertical workflow slices; Rust/TypeScript, negative-path, disposable Git-state and packaged Windows UI tests. Update only proven ledger scopes, retain partial on any missing behaviour.

### S6A — Real GitHub read workflows

**Scope:** 069 GitHub auth with existing gh credential; 070 GitHub orgs/repos and SSH configuration; 071 GitHub pull request listing and metadata; 073 PR base/head diff in native panels; 077 GitHub Actions/CI checks display; 079 Links and fallback to external web.

**Deliverable:** Auth expiry/account switching, org/repo discovery, PR details/diff/patch and CI states, external-link fallback. Test against real public read-only GitHub data and simulated failure matrix.

**Exit:** one or more independently accepted vertical workflow slices; Rust/TypeScript, negative-path, disposable Git-state and packaged Windows UI tests. Update only proven ledger scopes, retain partial on any missing behaviour.

### S6B — Safe GitHub write workflows

**Scope:** 072 Create pull request with template/draft; 074 PR reviews/comments/suggestions/merge; 075 GitHub Issues read/filter/assign/close; 076 Issue -> branch/worktree workflow; 081 Launchpad cross-repo issues/PRs/attention; 103 Stacked PR chains, PR-on-PR branch bases, stack numbers/dependencies/merged state in sidebar, graph and PR panel.

**Deliverable:** PR create/review/merge, issue changes and issue→branch/worktree, cross-repo dashboard, stacked PR restack/retarget. Mutations remain mocked until separately explicitly approved sandbox accounts/repos exist.

**Exit:** one or more independently accepted vertical workflow slices; Rust/TypeScript, negative-path, disposable Git-state and packaged Windows UI tests. Update only proven ledger scopes, retain partial on any missing behaviour.

### S7 — Other providers and planning integrations

**Scope:** 078 GitLab, Bitbucket, Azure DevOps adapters; 080 Jira/Trello and provider integration settings.

**Deliverable:** GitLab/Bitbucket/Azure DevOps parity boundaries and Jira/Trello integrations. Each requires opt-in account fixture and provider capability table, not promised by GitHub-only success.

**Exit:** one or more independently accepted vertical workflow slices; Rust/TypeScript, negative-path, disposable Git-state and packaged Windows UI tests. Update only proven ledger scopes, retain partial on any missing behaviour.

### S8A — Agent-linked worktrees and terminals

**Scope:** 082 Worktree-centred Agent Sessions mode; 083 External agent CLI detection/config; 084 Create branch+worktree+agent session; 085 Issue -> agent context handoff; 086 Dedicated embedded terminal per worktree; 104 Multiple persistent PTY terminal tabs per worktree, create/switch/close, process state and graceful shutdown.

**Deliverable:** Worktree-centred agent session object; installed CLI detection, bounded context handoff; native ConPTY cwd and multiple tabs including linked checkout; no bundled AI or startup load.

**Exit:** one or more independently accepted vertical workflow slices; Rust/TypeScript, negative-path, disposable Git-state and packaged Windows UI tests. Update only proven ledger scopes, retain partial on any missing behaviour.

### S8B — Durable agent sessions and custom tools

**Scope:** 087 Agent session progress and permissions; 088 Session pause/stop/reopen and cleanup; 089 Custom agent, editor, diff/merge tool launches.

**Deliverable:** Session status/progress logs; safe stop/reopen, process reattachment policy, custom agent/editor/diff/browser integration; explicit lifespan and credential constraints.

**Exit:** one or more independently accepted vertical workflow slices; Rust/TypeScript, negative-path, disposable Git-state and packaged Windows UI tests. Update only proven ledger scopes, retain partial on any missing behaviour.


## The actual development loop (must be repeated)

1. **Evidence first (no new audit marathon).** Read the ledger row, existing Rust, React, test files and latest acceptance; identify the exact missing user step before coding. Use existing tests and Git CLI to establish a starting failing case.
2. **Choose specialist tools only when they add evidence.** For undocumented competitor workflow inspect existing REA records and, only if necessary, perform *read-only black-box* REA observation. For any materially changed UI, open approved Penpot document/components/tokens first; no invented styling. Use ReAgent *only* for truly appropriate native-function differential experiments, never as a general code generator.
3. **Implement a complete vertical slice.** Rust/backend + UI + validation + errors + cancellation and recovery as applicable. Do not expose mock-only controls as finished or add inert buttons. Prefer reuse of existing ArcLane components and `workflow.css`.
4. **Prove correctness.** `npm run build`; relevant cargo/Rust tests; independent Python/CLI Git fixtures; exercise success, dirty state, conflict, abort/continue, stale HEAD, Unicode/space paths and no-op/negative paths. For every write compare HEAD, refs, index, tree and actual file bytes before/after. Preserve full logs on disk; print compact PASS/FAIL.
5. **Real native acceptance.** Build an actual production Tauri/WebView2 EXE, run relevant `scripts/native-*-accept.mjs` on disposable Git fixtures. For UI: approved Penpot comparison, light/dark, keyboard, focus, 100–200% DPI/responsive when affected. REA native/UI evidence for ambiguous parity or tricky Windows behaviour. Specialized ReAgent tests only if in scope.
6. **Quality and release.** Run impacted regressions and broader `scripts/verify-sprint.ps1` before integrating. No Actions required. Fix failures; clean working branch; commit/push to *topic branch*, integrate into `feature/next-parity-sprint` only after acceptance and conflict check; **do not change main**. Verify source/content hash and deploy accepted binary using `scripts/install-portable-preview.ps1` after ArcLane is closed, retain rollback. Avoid touching the two original development checkouts.
7. **Update proof.** Per ID mark accepted only when **all** scoped behaviours and native evidence pass; otherwise leave partial and list the missing case. Link fixture names, native test, screenshot, version/commit, performance sample and known limits in ledger/checkpoint. Record install SHA and smoke run.

### Definition of done for a requirement

Complete interactive workflow (no decorative UI), truthful data/state/errors, no known correctness or accidental destructive behaviour; relevant negative cases pass; independent Git state verified; packaged native Windows acceptance passes; UI visually matches approved existing design; no regression in performance or startup/idle resource behaviour; committed with link to evidence; release updated or explicitly tagged as pending deploy. Provider mocks are never counted as live writes.

### Performance/security release gates

- **Performance:** compare with recorded prior build, not arbitrary invented measurements: cold/warm load and idle CPU/RAM/process tree; graph scroll and DOM virtualization; 10k proven, **100k remains #092**; no new listeners/polling/inference when idle. Profile regressions before shipping.
- **Safety:** shared Git common-dir locking, child process containment, cancellation semantics and unknown outcomes; no credential logging; no automatic removal of unrelated lock files; dirty/unstaged conflict safety, path escaping and race tests.
- **Native quality:** WebView2 actual pixels at light/dark, screenshot comparison with Penpot-reviewed baseline; keyboard and accessibility labels/focus; installer clean upgrade/rollback; branch/worktree multi-window behaviour.
- **Compliance:** no proprietary GitKraken implementation/assets/reverse-engineered code copied; competitor research limited to observable feature behaviour and independent verification.
- **Provider writes:** require explicit user approval to name controlled fixture accounts/repos, define allowed effects, test rollback and confirm absence of public side effects. Never use the live ArcLane GitHub repo for fake test PRs/issues.

## Specialised tool matrix (real installed state; do not invoke for theatre)

| Tool/source | Verified or known location | Use it for | Output to keep | Not for |
| --- | --- | --- | --- | --- |
| GitHub + local Git | Connected GitHub repo; Windows Git/gh | Source, branches, reviews of actual diffs, repo history, controlled pushes | commit SHA, changed paths, clean status | Actions/runner debugging or fake provider fixtures |
| **REA 6.2.0** | Primary index: `docs/REA_EVIDENCE_INDEX.md`; local historical reports under `C:\AI\REA\Reports` and `C:\AI\REA\Experiments\Forge\artifacts`; Codex `rea` registered | **Always review relevant existing evidence first**, then narrowly query/observe only if gaps remain | exact reference/version, bounded findings, unknowns | importing competitor code/assets, decompressing full data by default or claiming 12.6 behaviour from 12.5 observations |
| **ReAgent 0.4.0** | `C:\AI\ReAgent\.venv\Scripts\re-agent.exe`; own Ghidra bridge config | Narrow independently verified native-function differential testing where a function boundary truly matters | input/output fixtures, parity differences, version, independent test | default Rust implementation or unlicensed cloning |
| **Penpot (design authority)** | `penpot` Codex MCP registration verified on Windows; current approved file/node ID **not yet verified** | Inspect approved Review Bench tokens/components/layout before changing screens; propose incremental designs, visually approve differences | file+node reference, tokens, before/after screenshots, acceptance | fresh generic dashboard/layouts or styling without evidence |
| Figma (secondary) | Codex Figma MCP and this chat's Figma connector | Cross-check references/asset inventory if specifically useful; do not displace Penpot | asset/component node IDs | silently creating a second design system |
| **Model Testing** | `C:\AI\Aaron Model Testing`, scripts `check.ps1`/`validate.ps1` | Test *model/agent throughput and reliability*, compare the Luna Max pilot with prior/alternative settings using same task/metrics. Reuse methodology where possible | tokens/tool calls if observable, elapsed time, fixes, pass-rate, baseline | replacing Git functional tests or assuming harness observes hosted agent tokens |
| Windows native harness | `scripts/native-sprint-harness.mjs`, WebView2/Playwright, `verify-sprint.ps1` | Packaged app visual/user flows, Windows IPC, keyboard and structured evidence | screenshots, per-suite PASS, fixture diff | claiming browser mocks equal packaged acceptance |
| Rust + Python/git fixture tests | `scripts/accept-*.py`, cargo, disposable `Forge-Testbed` | Exact Git HEAD/refs/index/trees/files and guarded failure/recovery | compact pass summary and full failed traces on disk | destructive testing in ArcLane/user repos |
| GitKraken / GitHub Desktop | Local reference apps, published workflow docs; REA prior observation | **observable UX semantics only**, benchmark parity use cases | requirements/behaviour diffs without proprietary assets | reading or embedding vendor source to ship |
| VS Code + GPT-6 Luna reasoning Max | User's existing VS Code/Codex arrangement | One isolated *real feature task* and measured agent trial | commits, test outcome, session metrics | bypassing checks or claiming success from agent prose |
| Paperclip/Cortana | Existing local stack, optional | Durable delegation or checkpoints if a sprint truly requires multiple workers | task state, evidence paths | adding always-on ArcLane runtime dependency |

**Current tool trigger precedence:** every new feature begins with a **targeted review of the existing REA evidence** using `docs/REA_EVIDENCE_INDEX.md` (mandatory, cheap); a **new** REA analysis or GitKraken observation is conditional on an evidence gap. New visual screen = Penpot **after research and architecture**, before CSS, with packaged screenshots afterward. Ordinary Git correctness = Rust/Python/native. Native differential parity = selective ReAgent when justified. LLM comparisons = Model Testing only when requested. Do not reread full corpora or run tools merely to tick a box.

## Luna Max trial and branch hygiene

See `docs/LUNA_MAX_PILOT_035.md`. Luna Max means **GPT-6 Luna with reasoning set to Maximum**, not a separate model ID. Give it a single bounded end-to-end task under a new topic branch, *not* a re-architecture brief. Verify the results as for any engineer. Keep the same fixed task/acceptance suite so comparison with a stronger model is fair. Do not claim unobserved token usage. If pilot passes, scale to independent, non-overlapping batches; integrate serially after tests, not by parallel pushes to the same branch.

## Status and reporting cadence

After every completed batch: exact new commit(s), branch, IDs advanced, tests genuinely run, known incomplete branches, packaged EXE/install hash, performance delta, accepted/partial/unverified totals. Keep a concise human summary, and commit complete detailed evidence. No idle waiting or repeated historical research.

**Planning artifact only:** this roadmap is not a claim that the remaining requirements were implemented or that a current 12.6 competitor-native audit was conducted.
