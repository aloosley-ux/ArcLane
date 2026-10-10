# Arclane — instructions for local coding agents

Before changing code read:
- docs/LOCAL_AGENT_HANDOFF_2026-10-10.md
- docs/FEATURE_COVERAGE.md (104 product obligations; NOT 104 accepted features)
- docs/GITKRAKEN_AUDIT.md

## Product goals
A polished, information-dense, responsive **Windows Git desktop application**, at least matching the broad daily workflow of GitKraken 12.6. Distinctive original UI, not a generic web dashboard. Rust + Tauri 2 + React/TypeScript; minimal CPU/memory, no routine background polling, no background AI model. The user is very demanding about actual rendered UI quality; inspect packaged pixels, not just source or visual mockups.

## Boundaries
- Work only in C:\AI\REA\Experiments\Arclane.
- The only authorised destructive Git testing location is a NEW test fixture in C:\AI\REA\Experiments\Forge-Testbed.
- Never modify Cortana, SDS, Nostalgia, other real project repositories, installed GitKraken assets, or existing user work.
- No live GitHub PR/issue/review/merge/push writes during development tests. Use scripts/mock-gh.rs and scripts/github-fixtures for offline mock tests. Obtain explicit approval before any real remote mutation.
- Do not import, redistribute, or reuse proprietary GitKraken sources/assets from local REA research.
- Never run git reset --hard, git clean -fd, force push, kill all Node processes or delete unknown directories as cleanup shortcuts.

## Building a real release
~~~powershell
Set-Location 'C:\AI\REA\Experiments\Arclane'
npm run build
$env:CARGO_TARGET_DIR='C:\AI\REA\Experiments\Forge\src-tauri\target'
npx tauri build --no-bundle
Copy-Item 'C:\AI\REA\Experiments\Forge\src-tauri\target\release\arclane.exe' '.\Build\Arclane.exe' -Force
~~~

Important: standalone cargo build --release does NOT package frontend assets and can create an executable looking for a localhost Vite dev server. Run Tauri's build, then test the packaged WebView2 application.

Build/, dist/ and artifacts/ are ignored generated outputs. Source files, scripts and docs should be committed. No Git remote is currently configured.

## Testing, checkpointing
- Run relevant scripts/accept-*.py on fresh disposable Git repos. Check resulting Git index, refs and working files independently.
- Run scripts/native-*-accept.mjs against a *packaged* Windows EXE; native UI acceptance is required before marking a complete workflow accepted.
- New this handoff: python scripts/accept-toolbox.py; node scripts/native-toolbox-accept.mjs; python scripts/accept-github-mock.py; node scripts/native-collab-mock-accept.mjs.
- Mock GitHub tests require ignored artifacts/mock-gh/gh.exe. Build with rustc --edition 2021 scripts/mock-gh.rs -o artifacts/mock-gh/gh.exe. These prepend the mock to PATH; never silently remove that guard.
- Keep docs/FEATURE_COVERAGE.md truthful. Mock test pass is not acceptance against real GitHub. User expects all 104 obligations eventually, not selective feature reductions.
- Commit each coherent milestone with clean git status and actionable summary. Preserve existing branch/main history. Do not push without instruction.
