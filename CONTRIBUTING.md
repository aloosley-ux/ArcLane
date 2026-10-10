# Contributing to ArcLane

Thanks for taking a look. ArcLane is a working **Windows alpha**, not a finished GitKraken replacement.

## Before proposing a change

Read [the README](README.md) and the [104-feature ledger](docs/FEATURE_COVERAGE.md). Pick a narrow, concrete workflow and describe what correct behaviour would look like. Bug reports are especially helpful with the Git version, Windows version, steps to reproduce and whether any Git state was changed.

**Licensing note:** A public source repository isn't automatically open-source licensed. A contributor/redistribution licence has not been selected yet. Until it is, please open an issue to discuss proposed code contributions rather than assuming a blanket right to redistribute the source.

## Development

Requirements: Windows, Git CLI, Node.js/npm, Rust/MSVC, Visual Studio C++ build tools and WebView2.

```powershell
npm ci
npm run build
npm run desktop
```

For the standalone production executable:

```powershell
npx tauri build --no-bundle
```

Standalone `cargo build --release` does **not** guarantee a packaged frontend.

## Verification

The existing testing is intentionally heavy on real Git outcomes: temporary repositories, index/ref/file assertions, a native packaged Windows UI, and public GitHub *read-only* checks. The main suite is:

```powershell
powershell -NoProfile -File scripts/verify-sprint.ps1
```

Use `-Phase backend` or `-Phase native` for targeted checks. These tests currently include development-machine assumptions, notably paths under `C:\AI\REA\Experiments\Forge-Testbed`; review the scripts and configure disposable fixtures before running them on another machine.

Never test destructive Git behaviour on a real user's repository. Live GitHub write tests are prohibited without explicit approval.

## Quality and disclosure

Prefer a failing regression test, a focused fix and a clean commit. Keep `docs/FEATURE_COVERAGE.md` current and explain any remaining risks. You may disclose AI-assisted contributions; don't claim a test passed unless it ran.

For security-sensitive issues, avoid including credentials, personal paths or private repository content in public issues. Contact the maintainer privately before disclosing exploitable details.
