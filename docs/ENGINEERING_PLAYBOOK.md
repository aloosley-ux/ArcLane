# ArcLane Engineering Playbook
*Living lessons, architecture rules and run review. Version 1.0 | Started 11 October 2026 | Owner: ArcLane development team.*

> **Read this before preparing a new run.** This is an evidence-backed improvement log, not another feature roadmap or permission to bypass `AGENTS.md`. Update it when a new finding changes how we should design, test or supervise work. Keep the next run's kickoff prompt short; link to this file rather than copying it.

## At a glance: what we learned

1. **Start with the REA reports — our primary product reference.** Review the actual GitKraken research and capture evidence-to-requirement mappings before choosing UI or architecture. See [REA evidence index](REA_EVIDENCE_INDEX.md). Our current code and Penpot are implementation/design inputs, not replacements for that reference.
2. **Design the complete user journey before implementing the components.** Review Bench/Penpot addresses visual quality; it does not define state ownership or error recovery.
3. **One authoritative owner per mutable state.** For native process sessions, Rust should own the facts; React should display/reconcile them. Worktree selection is not process identity.
4. **Events are notifications, not guaranteed history.** A short-lived child can print and exit before a React component subscribes or learns its session ID. Use an authoritative snapshot and race-safe replay/reconciliation.
5. **Model failure and recovery as first-class journeys.** Create succeeds + launch fails, refresh while retrying, tab switch during launch, exit before UI readiness, close after exit, startup output before attach.
6. **Test the riskiest boundary before paying for a production build.** Compile + isolated state-machine/PTY/Git-fixture tests should catch identity and lifetime defects; the real packaged EXE remains indispensable for final acceptance.
7. **Never weaken an assertion to obtain green.** Fix a fixture when it incorrectly models Windows (such as a CR-terminated ConPTY line); verify product behavior separately.
8. **Accepted means proven, not merely coded.** Record per-requirement status honestly and distinguish user-visible tests, backend-only checks and the agent's statements.
9. **Instruction quality is our responsibility.** A detailed tool checklist is not a substitute for understanding existing code, system invariants and failure boundaries. Avoid arbitrary deadlines, test counts, or promises about number of rebuilds.

## Recorded evidence and lessons

These are short evidence-backed lessons, not instructions to replay previous sprints. Look up the detailed incident only when a new task reaches the same boundary.

| Run | Verified outcome | Carry-forward rule |
| --- | --- | --- |
| Run 2 | #003, #032, #062 accepted. | Git common-dir identity is shared; each checkout has its own HEAD, index and working state. |
| Run 3 | #036/#037 accepted; #049 **PARTIAL** due to incomplete interrupted recovery and external-write races. | Native success on a narrow path does not justify broader acceptance. |
| Run 4 | #082/#083/#084 accepted; 4 Rust lifecycle tests, 4 frontend sync groups, 24/24 backend and 22/22 packaged native. | Backend owns immutable agent/process state and bounded replay; UI mounts and normal terminals must never redefine identity. |
| Run 4 regressions | Four history suites failed from hidden mounted route matching broad CSS `:has()`; two provenance suites relied on missing Run 3-local JSON. All six retested green. | Scope global CSS selectors by **visible route**; each isolated run verifies its own executable hash and inherited UI. |

Run 4 final commit: `305c30411b87fb98c2c20478e3f6aaae5e62c57a`. One RTK stderr-stream parser diagnostic was non-fatal (native runner exit 0); evidence is in [Run 4 packet](RUN4_LUNA_HIGH_AGENT_WORKSPACES_2026-10-11.md).

## Architecture contract for stateful/native workflows

This is the **desired invariant**, not a claim that all details are already implemented. Before changing stateful features, draw their equivalent ownership map.

### Agent session ownership

- **Rust/TerminalManager is authoritative** for immutable session ID, verified absolute checkout path, executable/argument identity, PID where available, lifecycle state, observed exit code and bounded output retention. Session records should survive child exit until explicitly closed/retired according to a documented retention policy; this does **not** promise durable restart persistence (#088/#104 are separate).
- **Git/worktree layer is authoritative** for the repository, linked checkout path, branch, locked/dirty state and common Git directory. Creating a checkout and launching a child are two distinguishable operations; an agent-launch failure **must not erase the created checkout**.
- **React owns only presentation**: selected card, visible tab, modal state and rendering. It must never silently rewrite an existing session's checkout identity on refresh, fallback, tab switch or retry.
- **Tauri bridge owns a verifiable synchronization contract** between native state and UI. Events can notify; snapshot/replay must reconcile missed events, output and exit status. Sequence/watermark ordering, gaps and duplicate application must be explicitly handled. A naive `subscribe -> fetch -> append` can duplicate or lose data.
- **Process lifetime is separate from PTY output lifetime.** EOF does not by itself prove the exit code has been persisted. Waiting for exit must not hold a mutex that prevents stop/close. Cleanup must account for child processes and report failure rather than hide it.
- **Security/resource policy**: use argv, not shell string interpolation; bound output, retained sessions, inputs and children; start no paid agents in tests or automatically on app startup; no added idle polling or unbounded React buffers.

### Minimum transition matrix to agree before coding

| Transition | Required observable behavior |
| --- | --- |
| Select checkout -> launch | Launch binds exact validated checkout path. Later UI selections cannot alter it. |
| Create linked worktree -> launch succeeds | Separate worktree and branch are correct; actual child cwd equals that checkout; PID/session ID and terminal are correlated. |
| Create succeeds -> launch fails -> configure -> retry | Checkout survives. Retry retains its own target, even if Git refreshes or selected tab changes. |
| Output emitted before UI subscribes | Native retained output is recovered without loss, duplication or unbounded growth. |
| Process exits before launch IPC resolves/UI learns ID | Real exit code and final output remain discoverable from native snapshot. |
| Navigate, hide, reopen, switch tabs | Existing session state and output remain correct; no duplicate listeners/processes. |
| Stop/close / unexpected exit / shutdown | No orphaned child tree; errors are visible; other sessions are unaffected. |
| Invalid executable, locked checkout, unsafe branch/path | Refuse safely without unexpected worktree or user-repo mutation. |

## Better development sequence (short and actionable)

**Before coding (one focused architecture note, not a research marathon):**

1. **Read `AGENTS.md` first**, then use [REA_EVIDENCE_INDEX.md](REA_EVIDENCE_INDEX.md) to locate only the **relevant** existing REA evidence and record bounded finding(s)/journey(s). Look up only target ledger rows, source seams and relevant playbook sections; consult old handoffs only to resolve a specific uncertainty. **Do not read whole archives, all 104 rows, every historical packet or this whole playbook by default.**
2. Describe one user journey end-to-end, including state owners, inputs/outputs, invariants, async ordering and two or three highest-risk failures. Draw a short transition table if there are multiple async actors.
3. State a falsifiable acceptance criterion for each requirement. Differentiate backend, packaged-native and externally unverified behavior. Confirm a safe disposable fixture design.
4. For changed UI, perform the existing mandatory Penpot light/dark/compact review **after determining behavior and before writing React/CSS**. Penpot does not replace the architecture note.
5. Use the smallest appropriate specialist tools; explicitly SKIP those without a concrete purpose. Don't ask an agent to conduct a broad research tour before coding.

**During implementation:**

6. Test the risky seams in isolation first: path invariants and Git state, process spawn/exit/stop, snapshot ordering, early output, late listeners and failure/retry. Prefer deterministic synchronization over arbitrary sleeps. Repetitions are useful only when they expose a meaningful race and capture evidence.
7. If a second failure has the same root boundary as the first, reassess the design rather than immediately doing another patch+package. Document the changed invariant and test it below the UI first.
8. Compile/type-check, then package the real Tauri/WebView2 executable when the relevant foundation is stable. A necessary later rebuild is fine; **never force a fixed build count** or reuse a stale package after source changes.
9. Run focused native acceptance on the exact fresh executable, including light/dark/compact pixels. Then impacted/full regression and independent before/after Git/process checks. Claims must match actual exit codes and logs.
10. Commit/push only the isolated topic branch with coverage/evidence. Do not automatically merge, install, mutate real provider data or run GitHub Actions.

**At handoff:** Say `ACCEPTED`, `PARTIAL` or `UNVERIFIED` for each ID; list exact passed/failed tests, remaining races, binary SHA, commit SHA, branch cleanliness, tool-use exceptions and installed-app status. Avoid progress praise that implies acceptance.

## Instructions and communication: what to stop doing

- **Stop:** giant prompts whose most precise details are tool lists and time budgets while the state machine is underspecified. **Replace with:** brief mission + authority boundaries + failure transitions + acceptance proof; reference repo documents.
- **Stop:** "rebuild once more" after each event race without revisiting the model. **Replace with:** first determine whether the process, session or React event stream owns truth.
- **Stop:** prescribing arbitrary "50 tests", exactly one further build or a guaranteed 30–60 minute completion. **Replace with:** meaningful deterministic cases, a reasonable efficiency goal and scope negotiation when complexity is discovered.
- **Stop:** interpreting compiler activity, a PID or a passing focused fixture as full product acceptance. **Replace with:** explicit statement of what it proves and what remains unverified.
- **Stop:** letting source code evolve while a stale plan is treated as complete evidence. **Replace with:** update an evidence log/decision when an architectural assumption changes.
- **Keep:** isolated Git branches, native packaged acceptance, exact Git-state fixtures, honest partial status, Penpot for visual work and no surprise paid model launches.

## Compact run-brief template (copy and adapt)

```text
Implement ArcLane requirements [IDs] in [isolated checkout / branch] from [exact SHA].
Read AGENTS.md FIRST; use docs/REA_EVIDENCE_INDEX.md to locate the
relevant bounded REA evidence (not the whole archive). Record a short
evidence-to-requirement mapping. Read only the relevant ledger rows,
source seams and playbook sections.

User journey: [one end-to-end outcome].
Reuse: [current working components].
Authority: [owner of Git state / process state / UI state].
Non-negotiable invariants: [3-5 clear properties].
Failure paths: [create/launch fail; refresh/retry; fast exit; close or equivalent].
Proof: [disposable backend fixtures], [fresh packaged native UX],
       [independent state/process checks], [impacted/full regressions].
Safety: no main/installed-app changes; no real-repo destructive tests;
        no provider writes, Actions, always-on agents or paid test launches.
Design UI in Penpot when affected; document decisions before coding.
If multiple defects reveal one ownership flaw, stop patching and redesign that boundary.
Finish with per-ID disposition, evidence, package/commit SHA and clean Git status.
```

## Living log: how we update this

After **every completed run** or material architectural incident, append a dated entry using the following five fields. Keep entries short, reproducible and scoped; amend earlier statements if new evidence contradicts them. Do not turn individual observations into universal rules without a reason.

```markdown
### YYYY-MM-DD - Run / issue
- Observed: [symptom and user-visible impact].
- Root cause: [verified / provisional; owning component and sequence].
- Change/decision: [what was changed or explicitly deferred].
- Evidence: [test name/commands, result, commit, screenshot or log link].
- Reuse: [one invariant/check/prompt change to carry into the next run].
```

### 2026-10-11 - REA research was incorrectly bypassed
- **Observed:** The Run 4 packet marked REA SKIPPED before mapping the existing product research to #082–#084; Penpot and current ArcLane components drove the proposed workflow instead.
- **Root cause:** Research was treated as optional validation rather than the primary product specification input.
- **Change/decision:** Mandatory existing-REA evidence review and evidence-to-requirement brief before architecture or Penpot; see [REA evidence index](REA_EVIDENCE_INDEX.md). Further REA analysis is conditional, but existing reports must not be ignored.
- **Evidence:** The recorded Run 4 tool matrix and the verified local 12.5 research, 12.6 extraction manifest and agent/worktree/terminal feature labels.
- **Reuse:** Every new run cites the actual research evidence and distinguishes supported behaviour from unconfirmed candidate features.

### 2026-10-11 - Run 4 lifecycle and regressions (final)
- **Observed:** checkout-selection retry launched in the wrong directory; early output and exit events were lost; ordinary terminal sessions could masquerade as agent sessions in the same checkout. Four unrelated history suites subsequently failed and two provenance suites could not find a Run 3-specific JSON in the isolated Run 4 checkout.
- **Root causes:** worktree path was incorrectly used as process identity; React events outran UI subscriptions; hidden mounted Agent Sessions matched a broad CSS `:has(.agent-sessions-page)` selector; provenance checks were coupled to another checkout's ignored local file.
- **Change/decision:** Rust `TerminalManager` owns immutable ID, purpose, CWD, PID, exit state and bounded 64 KiB output; backend process wait and revisioned snapshots permit late terminal attach and UI remount. Agent/normal-terminal sessions remain independent. Scope the CSS selector to the **visible** route and add packaged regression coverage. Package provenance is local to each isolated checkout and retains an exact EXE hash check.
- **Evidence:** [Run 4 packet](RUN4_LUNA_HIGH_AGENT_WORKSPACES_2026-10-11.md); 4 Rust lifecycle, 4 frontend sync, 24/24 backend and 22/22 native regression groups; accepted 082/083/084; final pushed commit `305c30411b87fb98c2c20478e3f6aaae5e62c57a`; packaged EXE SHA256 `6C0C4FF84E87F468BDC199EB07FF819716BED25B91A4F6BBF0AD98AA6E2255A5`.
- **Reuse:** native state is authoritative, route visibility differs from DOM mounting, and provenance is verified per checkout/build. Diagnose shared suite failures by common root, not weakened selectors or copied local artifacts.

### 2026-10-11 - Run 3 acceptance integrity
- **Observed:** #036/#037 accepted; #049 still partial, despite passing discard/undo paths. Native window-size report wasn't reproduced at 96 DPI.
- **Root cause:** recoverability gaps in interrupted transactions and unresolved external mutation races; apparent viewport-gap cause not established.
- **Change/decision:** preserve partial ledger disposition and test-backed bounds finding; avoid guessing from screenshots.
- **Evidence:** [Run 3 final handoff](RUN3_HANDOFF_2026-10-11.md), [Run 3 execution results](RUN3_EXECUTION_EVIDENCE.md), [coverage ledger](FEATURE_COVERAGE.md).
- **Reuse:** truthfully separate reproducible results, hypothesis and incomplete risk.

## Related source documents

- [REA evidence index](REA_EVIDENCE_INDEX.md) — PRIMARY product reference sources, local report locations and required evidence-to-requirement review.
- [Development rules](../AGENTS.md) — authoritative Git/safety/native/Penpot policy.
- [Feature coverage](FEATURE_COVERAGE.md) — authoritative 104-row per-ID disposition. **Use current rows, not cached totals or old roadmap counts.** Run 4 accepted #082/#083/#084; recompute current counts from the ledger whenever needed, rather than repeating Run 3 numbers.
- [Development programme](DEVELOPMENT_PROGRAM_2026-10-11.md) — backlog and dependency map, **not proof that remaining work is complete**.
- [Run 3 final handoff](RUN3_HANDOFF_2026-10-11.md) — exact accepted results and #049 gap.
- [Run 4 execution packet](RUN4_LUNA_HIGH_AGENT_WORKSPACES_2026-10-11.md) — completed 082–084, 24 backend/22 packaged-native suites and final package provenance; initial plan was too procedural and under-specified lifecycle authority.

*Editorial rule: update this playbook only when a lesson produces a different engineering decision or test. Keep it shorter and more useful over time, not longer by default.*
