# ArcLane — usable Windows preview checkpoint (11 October 2026)

Branch: `feature/next-parity-sprint`, based on public `main` baseline `ecbb8eb`. This is a local preview, not a new public GitHub Release and not a completed GitKraken parity claim.

## Deployment on the authorized Windows PC

A verified portable executable has been copied into a dedicated ArcLane directory, separate from the developer's original and feature checkouts. A desktop shortcut named **ArcLane** points to it; a Windows NSIS setup executable is stored alongside for later distribution or manual installation. A plain-text START-HERE note is included in that folder.

The portable binary SHA-256 is:

`4691218507C051A3DF8828B06AA9DC1C31EAD00077C6833C8E75BB0F11E7D693`

The shipped Tauri binary was built from **`31615d3`**. Every subsequent change before deployment was restricted to test scripts, so the application source matched the packaged build. The installed binary checksum was independently verified against the native acceptance build. The installed EXE was launched using its normal, non-test desktop environment and survived the cold-start smoke (32.3 MB working set in the four-second sample; no background service added).

The NSIS package build returned code zero; **clean-machine NSIS installation testing remains outstanding**. The known-good user launch path is the portable executable and desktop shortcut. Windows signing/SmartScreen are not solved.

## Feature slice

- **004 — Accepted local slice:** Search and open from recent repositories, pin/unpin favourites using the existing tab context or welcome screen, save favourites independently of tabs, and restore across full app restart. No additional theme/system was introduced.
- **001 — Partial progress:** Real native-packaged Tauri backend verifies init/clone, immutable source HEAD/index, destination collision refusal and first-run Open/Clone/Initialize controls. Windows folder-picker acceptance is still pending.
- **002 — Regression retained:** Original persistent tabs/aliases/close-reopen workflow passes after the favourites schema extension.
- **011 — Partial progress:** Actual installed portable Windows executable and shortcut launch verified. Full window-state UIA/DPI coverage outstanding.

## Executed tests

- TypeScript/Vite and Rust release compilation: **PASS**.
- `npx tauri build --bundles nsis`: **PASS**, packaged EXE and setup generated.
- `python scripts/accept-favourites.py`: **5 groups PASS** (legacy settings, persistence/dedup, bad path refusal, missing path filtering, preserved Git refs/index).
- `node scripts/native-first-run-accept.mjs`: **5 packaged checks PASS** (cold welcome, native init, native clone, collision refusal, source index and HEAD unchanged). Native IPC used for init/clone; actual Windows file picker remains unclaimed.
- `node scripts/native-favourites-accept.mjs`: **5 packaged checks PASS** (pin via tab, search, close/restart, unpin/re-pin/open, preserved exact HEAD/index).
- `node scripts/native-workspace-accept.mjs`: **7 packaged checks PASS** after the workspace change.
- `scripts/install-portable-preview.ps1` verified on a disposable target: copied hash, repeatable replacement with previous-version backup, and refusal to update a locked binary, all **PASS**.
- Native installed EXE: launched successfully with ordinary user profile. The desktop link points at that executable.
- Additional acceptance while the actual user's desktop copy remained open initially encountered a WebView2 debugger profile collision; native harness `launch()` now sets a separate `WEBVIEW2_USER_DATA_FOLDER` for each test profile. Repeated packaged `native-sequence-accept.mjs` (3 checks), `native-operation-workflows-accept.mjs` (9 + 3 checks) and `native-git-cancel-accept.mjs` (2 checks) **all passed concurrently with the user's running ArcLane copy**. Both backend `accept-favourites.py` and `accept-git-runtime.py` passed the final release regression run.

No actual user Git repositories were mutated by any of these tests. Existing source checkouts were not modified; all mutating Git acceptance used disposable repositories. GitHub Actions and runners were not used.

## Coverage and next work

104 obligations now classify as **15 accepted / 51 partial / 5 mock-only partial / 4 backend-only / 29 unverified**. These are scoped acceptance labels, not claims of production equivalence.

Next efficient feature batches should reuse the now-established packaging and acceptance path:
1. Finish Gitflow release/hotfix and native lifecycle; complete worktree grouping and agent worktrees.
2. Improve daily Git capabilities: combined change/search workflows, bulk diff/panel navigation, branch grouping, ignored/binary states.
3. Broaden safe recovery/process controls, provider integration and large graph tests.

Each batch should implement a coherent set of existing ledger requirements, run only the impacted disposable backend/native tests first, then run broader regressions before updating the portable preview. Do not redesign Review Bench.
