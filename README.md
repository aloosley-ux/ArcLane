# Arclane — Windows Git desktop client (working name)

**Status: exploratory v0.1, NOT GitKraken feature parity.** Original user-facing design and source. Full product target: complete GitKraken 12.6 workflow coverage with a distinct visual system, a Rust-native Git/process backend, on-demand GitHub integrations, agent/worktree operations and low idle overhead.

## Run and build

- Production frontend: `npm install && npm run build`.
- Native Windows binary: `cargo build --manifest-path src-tauri/Cargo.toml --release`, then launch `arclane.exe`. The native build embeds the frontend from `dist`. Rebuild Rust when frontend asset hashes change.
- Desktop dev mode: `npm run desktop` (uses Vite + Tauri).
- Functional UI capture without touching real repos: `node scripts/visual-accept.mjs`; it injects recorded **real Git output** from the disposable `Forge-Testbed/forge-visual-benchmark` into a short-lived local browser. This test mock is never shipped in the production app.

## Current working slices

- Repository tabs and recent repository persistence; open folder picker.
- References sidebar (local, remote, tags, stashes, worktrees); graph history across refs, search and manual pagination.
- Real staged/unstaged status, previews, stage/unstage, commit, create/switch branches, stash, worktrees, fetch, fast-forward pull, push.
- GitHub PR and CI read-only integration via existing `gh` login, loaded **only on demand**.
- Agent worktree organisation, local external terminal/editor launches. Does **not** represent real agent status until a provider integration exists.
- Native process model: Git CLI processes are short-lived, with no repo polling, model inference or embedded server required during ordinary native use.

## Reference and evidence

- Latest installed source reference: GitKraken `12.6.0`, `%LOCALAPPDATA%/gitkraken/app-12.6.0/resources/app.asar`. The archival extraction uses REA's installed local ASAR library, with 340 code/resources entries **individually SHA-256 integrity checked, zero mismatches**, in `C:/AI/REA/Experiments/Forge/artifacts/gitkraken-12.6-app-code` (locally ignored, proprietary, not copied to Arclane).
- REA 6.2.0 completed the 12.6 application architecture scan; an attempt to request only summary keys returned an empty filtered result. It is **not** legitimate to infer coverage from that output. Complete 12.5 REA static evidence and known limitations remain at `C:/AI/REA/Experiments/Forge/docs/GITKRAKEN_AUDIT.md`.
- GitKraken 12.6 adds **stacked pull requests** (branch-to-branch PR chains and graph/list status) and **multiple terminal tabs per worktree/repo**. These are explicit Arclane requirements, **not implemented** in v0.1. See official 12.6 release notes: https://gitkraken.com/blog/break-up-that-monster-pr-whats-new-in-gitkraken-desktop-12-6
- The full 102-item baseline is in `docs/FEATURE_COVERAGE.md`; new 12.6 obligations are appended below. Every feature requires native interactive acceptance, not static labels or screenshot appearance.

## Boundaries

- Existing Forge and installed GitKraken remain untouched and separately usable.
- Tests may mutate only disposable repositories under `C:/AI/REA/Experiments/Forge-Testbed`.
- No tests mutate Cortana, SDS, Nostalgia or any other live repository; real repos were **not tested for writes**.
- No extraction of proprietary product source, bundled icons, proprietary styles or internal names into tracked Arclane implementation.
- A successful compile or visual screenshot is **not evidence** of full UI acceptance; future evaluations should explicitly grade native behaviour, Git correctness and resource usage.

## Known gaps — major

No native hunk-level stage/unstage or side-by-side diff editor; no visual merge conflict resolver; no interactive rebase, merge, cherry-pick, reflog recovery or robust undo; no complete multi-provider PR review/issues/CI workflow, Gitflow, LFS/submodule UX, signing, custom terminal sessions, stacked PRs, agent permission requests, or production installer acceptance. The custom commit graph has not yet been measured under 10k+ commits or octopus-merge complexity.

## Verified preview acceptance

- Frontend `npm run build`: passed, 1,746 modules transformed and no TypeScript errors.
- Testbed GUI `node scripts/visual-accept.mjs`: loaded all **109** genuine commits from the isolated `forge-visual-benchmark` fixture in the live custom interface, with **zero JavaScript page errors**. Evidence: ignored `artifacts/arclane-visual-acceptance.json` and `arclane-visual-1600.png`.
- Rust release executable: `Build/Arclane.exe` (locally ignored); passed `scripts/native-accept.ps1` Windows window launch and process-idle check. At that checkpoint, **main process only** measured 32.2 MB working set and 0 ms additional CPU over 8 seconds; **WebView2 processes are not included**. This is not total footprint or large-repo performance.
- No GitHub remote writes or destructive live-repo operations were performed.
