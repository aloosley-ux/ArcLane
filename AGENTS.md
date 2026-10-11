# ArcLane — agent instructions (primary entry point)

**Product:** Independent Rust/Tauri Windows Git client, benchmarked against GitKraken. **Current product acceptance:** `docs/FEATURE_COVERAGE.md` (104 feature IDs; read ONLY the relevant rows, not the whole ledger). Follow the active run packet for its exact SHA, branch and scope. **If documents conflict, this `AGENTS.md` and `docs/REA_EVIDENCE_INDEX.md` override historical packets on research/safety rules.** Historical roadmap counts and earlier run packets are not live status.

## Start each new feature run — short, research-led

1. **Read this file.** Identify the requested feature IDs and active checkout/branch. Verify `git status`, HEAD/base ancestry and protected locations before edits. Never touch another agent's checkout.
2. **Review the EXISTING REA evidence FIRST.** Use `docs/REA_EVIDENCE_INDEX.md` as a path/index; select only the relevant report, feature-label matches and bounded findings. Capture source path, version, supporting findings and important unknowns. **Do not scan/decompress the full archive by default.** New REA analysis is conditional; existing research review is mandatory. A translation label alone is a lead, not proven runtime behaviour.
3. **Inspect only the corresponding ledger rows and source seams.** Search/find relevant identifiers; do not reread all 104 rows, all prior runs, full research or every design document. Consult `docs/GITKRAKEN_AUDIT.md` for general product context, `docs/ENGINEERING_PLAYBOOK.md` for the relevant architecture/incident section and the last handoff only when needed.
4. **Before design/code, give a short evidence-to-requirement brief:** REA source + relevant finding, intended user journey, what is known/unknown, state owners, high-risk failure/retry cases, exact disposable test proof. If research disagrees with planned UX, resolve before Penpot. A missing source is a research gap to record, not permission to claim parity.
5. **Then** use Penpot for significant visual/UI changes; design light/dark/compact with actual frame refs before React/CSS. Implement with native authority, focused tests, packaged acceptance and regression evidence. Do not make agents do exhaustive tool tours to tick checkboxes.

**Authority hierarchy:** REA/reference evidence informs **what the reference product does**; the agreed ArcLane specification defines **what we will build**; Rust/Git own durable facts and process state, React owns display; Penpot governs **appearance**; native tests + `FEATURE_COVERAGE.md` determine **what ArcLane has actually proven**. These are different kinds of truth.

## Tools — use for a reason, not for theatre

- **Required for every feature run:** targeted review of existing REA reports; local Git/source inspection; independent fixture proof; honest Git handoff. **Not required every run:** launching REA analyses, reading full REA data, calling ReAgent, web research, Model Testing, Figma/Canva, or generating new design boards for backend-only work.
- **UI/UX changes:** Penpot review before substantial visual implementation; real packaged Tauri/WebView2 pixels after. Penpot does not define native state ownership.
- **Native parity only when justified:** selective ReAgent differential tests. No mandatory full REA rerun. No extra service, model load or idle polling.
- **Preferred scripts:** targeted `scripts/accept-*.py` and `scripts/native-*-accept.mjs` while coding; after a fresh `npx tauri build --no-bundle`, use `powershell -NoProfile -File scripts/verify-sprint.ps1 -Phase backend` and `-Phase native` for full final gates. Native tests must run against the last source-built executable, not stale output.

## Non-negotiable safety

- Work on a clean, isolated feature checkout. Do not merge, rewrite published history, install over the user's app or modify `main` unless explicitly authorised. Push only the agreed feature branch after tests.
- **All mutating Git tests use new disposable repositories** under the authorised fixture root (historically `C:\AI\REA\Experiments\Forge-Testbed`). Protect user/development repos and fixtures belonging to other processes. Never use force push, `git reset --hard`, `git clean -fd`, broad process kills or orphan cleanup against unknown targets.
- No real provider writes (PR/issue/merge/review), billing/paid-agent launches in tests, credential reads/logging, continuous polling, background inference or new network dependency without explicit approval.
- Never copy GitKraken proprietary source, assets, bundles or implementation details from REA into the ArcLane repository. Use evidence to design original code and interfaces.

## Acceptance & handoff

- Before code: record state owner/invariants and the highest-risk failure/retry scenarios; test those boundaries independently. If multiple regressions share one failure mode, revisit the architecture rather than loop through patch → package → patch.
- For state-changing Git work, independently check refs, HEAD, index and file bytes. For terminals/agents, test immutable session identity, correct cwd/argv, late output/exit, unrelated session isolation and child cleanup as relevant.
- Gate: focused backend/type tests → fresh packaged native interactive/light/dark/compact checks → full backend/native regressions → honest per-ID coverage → diff and executable provenance → commit/push → clean status. Do not weaken assertions, invent acceptance, promise a fixed rebuild count or merge before approval.
- Handoff succinctly: feature IDs **ACCEPTED/PARTIAL/UNVERIFIED**, test outcomes, source/EXE SHA, open gaps, branch/commit/push/clean status, unchanged protected repos and any **actually useful** tool exceptions. Historical run packets are evidence, not timeless instructions.
