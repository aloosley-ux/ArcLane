# ArcLane v0.1.0 — first public alpha

This is the first public, standalone Windows preview of ArcLane, an independent Rust/Tauri Git desktop client. **It is not a fully tested GitKraken replacement.**

## What works in this preview

- Persistent repo tabs and Review Bench UI, commit graph, branch/ref inspection, local staging including hunks, commit/amend controls and file history/blame.
- Two-commit/ref revision reviews, historical file restore, side-by-side and patch diffs, three-way text conflict resolution.
- Pull strategy selection, stash review/apply with index restoration, cherry-pick, revert, soft/mixed reset, reflog and pause/continue/abort handling for Git sequencer operations.
- Worktree tools and embedded Windows PowerShell ConPTY terminal tabs.
- On-demand GitHub PR patches and CI details via installed/authenticated `gh`; public provider reads and cancellation tested on real repositories.

## Verification, as of 10 October 2026

The last complete regression checkpoint passed **14 backend suites / 120 grouped checks** and **16 packaged Windows UI suites**, plus native launch/idle checks. The follow-up live read-only GitHub check passed **six backend and eight packaged UI checks**, plus focused provider regressions, and performed **no remote writes**.

[Feature acceptance and limitations](FEATURE_COVERAGE.md) · [Full sprint checkpoint](FEATURE_SPRINT_2026-10-10.md) · [GitHub live check](GITHUB_LIVE_CHECKPOINT_2026-10-10.md).

## Download and run

Asset: **Arclane.exe** — x64 Windows portable application, built with `npx tauri build --no-bundle` and embedded WebView2 frontend. Windows WebView2 runtime and Git CLI are required. The executable is **unsigned**, so Windows SmartScreen may warn. No installer, updater or clean-machine installation acceptance is implied.

Last packaged executable (unchanged after documentation-only GitHub preparation):
- Size: **10,189,824 bytes**
- SHA-256: `3F4087C7EF2003BE73847380289D4ED8BBE88BAF3AF69358EAAAA826BBF451B2`

**Caution:** Alpha software can have Git edge cases. Try it first with disposable repositories and keep a backup or established Git client for important work. Private/enterprise GitHub, provider writes, interactive rebase, advanced worktree/agent lifecycle and high-volume graph acceptance are unfinished.

The source is public. A reuse/contribution licence is not yet selected; the repository's README explains the current status.
