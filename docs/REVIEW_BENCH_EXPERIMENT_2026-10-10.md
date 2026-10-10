# ArcLane Review bench experiment — 10 October 2026

This is an isolated visual/UX experiment based on verified functional checkpoint `379edc3`. The user's unrestricted redesign brief supersedes inherited visual requirements, including the old theme and Obsidian Workbench concepts. Functional boundaries and the 104-workflow product ledger remain applicable. This experiment does not claim GitKraken parity or acceptance of previously unfinished backend features.

## Isolation

- Branch: `experiment/arclane-premium-desktop-20261010`.
- Worktree: `C:\AI\REA\Experiments\Arclane\artifacts\premium-desktop`.
- Original checkout remains on `experiment/arclane-penpot-redesign-20261010` with its existing unfinished `src/app.css` modification. That work was neither stashed nor overwritten.
- The experimental EXE is `Build/Arclane.exe` **inside this worktree**. The original checkout's EXE was not replaced. The documented shared Cargo target cache was reused.
- No Rust/backend source changes, live provider writes, GitHub pushes or changes to shared Penpot libraries.

## Editable Penpot deliverables

File: **ArcLane — Design Playground**, ID `52a5041f-08a1-80f1-8008-c5171920d528`; page ID `52a5041f-08a1-80f1-8008-c5171920d529`.

| Board | ID | Composition |
|---|---|---|
| A · Review bench — selected | `466dcfea-ddde-80ca-8008-c526d4a9ede8` | Labelled horizontal workspace modes; reference navigator; wide connected history above a three-column file/diff/commit bench. |
| B · Editor cockpit | `466dcfea-ddde-80ca-8008-c526d4aca150` | Vertical activity strip; file navigator; large central editor; history/reference sidecar; horizontal commit shelf. |
| Library study | `466dcfea-ddde-80ca-8008-c526634df67a` | Real component instances from seven connected libraries plus applied Dashboard typography. |
| Decision | `466dcfea-ddde-80ca-8008-c526f7c359be` | Tradeoffs and selection rationale. |
| Reusable desktop controls | `466dcfea-ddde-80ca-8008-c5294ccea0ce` | Local command components with Default/Primary variants and flex layout. |

Both alternatives are complete 1440 × 900 compositions, with editable text, shapes and named pane containers. The selected board binds semantic colour tokens in local set `arclane-review-bench`. MCP validation reported no file errors; both compositions passed containment checks. A labelled Penpot version was saved. PNG exports are in `artifacts/penpot-review-bench.png` and `artifacts/penpot-editor-cockpit.png`.

The plugin briefly reported a suspended browser heartbeat. Subsequent MCP health probes recovered the connection; design creation, inspection, token binding, component creation and exports continued through Penpot MCP.

## Library investigation and synthesis

| Connected library | Verified assets | Actual sample inspected | Design judgement |
|---|---|---|---|
| Ant Design v6 / antd-library | 583 components | Skeleton Button 80 × 40, Table HeaderCell 140 × 56, Input 240 × 32; actual instances in study | Table hierarchy and explicit action structure transfer well; default sizing needs desktop reduction. |
| Blender Design System 1.0 | 859 components | Panel Row, 298 × 20, 11 px type | Compact property rows and pane-driven workspaces make good density references. |
| GNOME Components | 245 components, 129 colours, 10 typographies | Active dark tab, 193 × 34 | Document tabs have clear selected state and economical desktop proportions. |
| Material Design 3 | 382 components, 30 colours, 16 typographies | Outlined button, 146 × 40 | Action/state semantics are useful; mobile-scale buttons would waste space here. |
| Pencil / Penpot Design System | 724 components, 34 colours, 7 typographies | Nested List, 308 × 312; Work Sans 12 px | Nested references and quiet pane boundaries support technical navigation. |
| shadcn/ui | 924 components, 222 colours, 21 typographies | Tab card, 400 × 294; Inter 14 px | Restrained borders and focus conventions are useful; card composition is unsuitable for the main Git workspace. |
| Dashboard UI Kit | 13 colours, 17 typographies; no components exposed | Actual 16 Regular typography applied to study text | Tabular typography is useful; dashboard composition is unsuitable. |
| Essential UI Kit | 236 components, 29 colours, 17 typographies | Small button, 45 × 46; list/table assets enumerated | Clear list patterns are useful; web navigation, pricing and CTA patterns were rejected. |

Review bench wins because a Git client needs both relationship context and file-level review. History is no longer squeezed between a wide navigator and a narrow vertical inspector. Files, code and commit preparation stay visible together; tools and collaboration use the full content workspace. Editor cockpit gives more attention to code, but its history sidecar limits DAG visibility and long commit subjects.

## Implementation

- `App.tsx` replaces the icon-only rail with labelled workspace modes, moves the inspector beneath history, and changes its internal composition into file selection, wide review and commit preparation. Selecting a historical commit switches that bench to metadata/contextual actions beside a full-height patch.
- `DesktopPrimitives.tsx` defines reusable workspace navigation, bounded persisted pane sizes and pointer/keyboard splitters. Arrow keys adjust dimensions, Shift increases the step, Home/End select bounds. Pointer listeners are cleaned up on release, cancellation, lost capture and unmount.
- `design-tokens.css` is the semantic style contract: surfaces, text, selection, actions, diff states, graph lanes, font roles and control dimensions. Light is the experimental default; dark uses the same layout. Preferences and pane sizes have separate experiment keys, leaving original appearance preferences intact.
- All ancillary workflow styles consume the same semantic colours. Tools and collaboration headers are compact; worktrees and agents use aligned lists rather than repeated cards. Existing confirmations and mutation handlers remain connected.
- Empty workspace offers direct Open, Clone and Initialize controls. Existing recent repository callbacks are reused.
- UI typography uses offline Windows Segoe UI Variable/Segoe UI; code uses Cascadia Mono/Consolas. Inter is used in Penpot. There are no remote font or image requests.
- Six existing native harnesses gained optional `ARCLANE_TEST_ROOT`, so the experimental EXE and evidence are tested without replacing the original EXE. Two newer harnesses already derive their root from their script location.

Existing workflows remain reachable: repository tabs/open/clone/init; local/remote/tag/stash/worktree navigation; ref-scoped history, search and pagination; staged/unstaged file and hunk actions; patch/paired/expanded comparisons; discard confirmations; file history/blame; commit message/body and metadata; branch/tag and advanced Git command palette; conflict resolution with continue/abort; worktrees/agents; repository tools; on-demand provider fixture views; embedded terminal tabs; preferences.

## Verification and visual iteration

Frontend TypeScript/Vite and the actual `npx tauri build --no-bundle` release succeeded. The >500 kB Vite warning and three unused CLI settings-function warnings remain from the verified baseline.

All nine backend suites passed: repositories (5), advanced Git (20), hunks (6), conflicts (6), compare (9), file inspection (4), toolbox (17), mocked GitHub (10), literal paths (10). All state-changing tests used newly created Forge-Testbed fixtures; the graph regression only reads the existing 811-commit fixture.

The final packaged regression run is recorded in `artifacts/redesign-regressions.json` and per-suite logs. The eight existing native suites cover 67 checks: UI/hunks/terminal (12), conflicts (6), file insights (6), graph (5), tools (8), fixture-only collaboration (11), literal paths (8), repository/selection ownership (11).

The new `native-design-review.mjs` adds nine checks. It launches the actual packaged `http://tauri.localhost/` page, captures light/dark and minimum-size views, checks pane geometry, keyboard sizing/persistence, route navigation, unchanged Git state during read-only review, and an exact staged-file commit. Screenshots capture the real application WebView2 content; the outer Windows frame is outside these captures. The 1080 × 680 case uses CDP viewport simulation within that real native application. Tauri's programmatic window resize ACL was retained.

Visual inspection led to these corrections before delivery: commit metadata no longer leaves a large empty band above its patch; short windows retain more history; tool headers and forms share the desktop hierarchy; punctuation encoding was corrected. Actual screenshots were compared with the Penpot exports.

| Evidence | Local artifact |
|---|---|
| Main review workspace | `artifacts/review-bench-native-light.png` |
| Dark style | `artifacts/review-bench-native-dark.png` |
| Minimum viewport | `artifacts/review-bench-native-1080.png` |
| Commit inspection | `artifacts/review-bench-native-commit.png` |
| Tools | `artifacts/review-bench-native-tools.png` |
| Command palette | `artifacts/review-bench-native-palette.png` |
| Visual/interaction results | `artifacts/review-bench-native-results.json` |

Run `rtk proxy powershell -NoProfile -File scripts/verify-redesign.ps1` from this worktree to repeat all native suites, with a freshly compiled hermetic provider mock. Build first using the repository's Tauri packaging procedure, copying the shared target's release EXE to **this worktree's** `Build/Arclane.exe`.

Screenshots and executables are ignored generated evidence. Source, test harnesses and this report are committed. Live GitHub compatibility, 10k+/100k graph history, Windows DPI/multi-monitor behaviour, installer lifecycle and previously unfinished product features remain outside this experiment's acceptance.

Final packaged EXE SHA-256: `BB840BA5C73EDC5E73B1448B3035FC8724EDB17008C517384E3CDD0BA81D75A5`. The copied experimental executable matches the shared Tauri release output.
