# ArcLane — development and verification rules

## Where we are

ArcLane is a Windows-first Rust/Tauri Git desktop client. The Review Bench interface is the current baseline. Public GitHub repository: https://github.com/aloosley-ux/ArcLane. The 104-item scope is documented in `docs/FEATURE_COVERAGE.md`; implementation status there is authoritative for claims, not a promise of full GitKraken parity.

Start with: `README.md`, `docs/FEATURE_COVERAGE.md`, `docs/FEATURE_SPRINT_2026-10-10.md`, and `docs/GITHUB_LIVE_CHECKPOINT_2026-10-10.md`. Consult historical audit/research only when necessary for a concrete missing behaviour.

## Repo-first working model

- `main` is the integrated, tested public baseline. Develop on a feature branch and preserve commit history.
- No unrelated repository changes, no destructive cleanup, no force pushing, and no history rewrites of published branches.
- Prefer source edits, normal Git commands and reproducible repo scripts. Use desktop remote control only for essential native Windows tasks.
- Commit coherent verified batches with concise messages and updated coverage evidence. Do not claim tests were run unless they were actually executed.
- Remote GitHub reads may be useful; **never** perform live issue/PR/merge/review writes or destructive remote Git operations during tests without explicit approval.
- Never copy proprietary GitKraken code, icons, art, bundles, internal styles or extracted source from REA research into ArcLane.

## Git safety

All mutating Git acceptance tests must use **new disposable fixture repositories**, never real development/user repos. On the original dev machine the isolated fixture root is `C:\AI\REA\Experiments\Forge-Testbed`. Some inherited scripts assume that environment; make them portable gradually, without redirecting destructive tests at real repositories.

Do not use `git reset --hard`, `git clean -fd`, force push, or mass-kill process commands as cleanup shortcuts. Preserve unknown data. Verify HEAD, refs, index and file bytes independently for state-changing operations. Do not extract or log credentials.

## Testing: fast, focused, and honest

- During implementation, run the relevant `scripts/accept-*.py` backend fixture checks and `scripts/native-*-accept.mjs` packaged UI tests.
- Before integrating or releasing, use `powershell -NoProfile -File scripts/verify-sprint.ps1` with configured Windows dependencies. Targeted `-Phase backend` or `-Phase native` is supported.
- Build the release with `npx tauri build --no-bundle`, not standalone `cargo build --release`. Native acceptance must exercise the embedded Tauri/WebView2 production executable.
- Provider mock tests do not count as live provider acceptance. The live GitHub read-only suite is explicitly opt-in and has no remote writes.
- Keep test output compact on success; retain full logs/evidence to inspect only when failures arise. REA can provide evidence-driven native UI inspection; use ReAgent's differential harness only when appropriate.
- Update `docs/FEATURE_COVERAGE.md` accurately; accepted local scopes, mock-only evidence and unverified features are different classifications.
- Protect the original design and responsive behaviour. Inspect actual pixels whenever changing UI.
- Extend existing Review Bench components and `src/workflow.css`/shared design tokens for new Git workflows. Do not introduce parallel theme systems or one-off visual stylesheets where established modal, button, warning, keyboard and layout patterns fit. Validate both light and dark packaged pixels before claiming UI completion.

## AI development boundaries

AI contributions are welcome, but claims must match evidence. Preserve low idle resource usage and on-demand processes. Never introduce background AI, telemetry, always-on polling or cloud dependence without user approval. Favour completion, independent verification and clean handoffs over speculative redesigns.
