# Historical Forge research — GitKraken 12.5.0 product and implementation audit

Restored to ArcLane on 10 October 2026 from `C:\AI\REA\Experiments\Forge\docs\GITKRAKEN_AUDIT.md`, the missing source referenced by AGENTS.md and the handoff. The original research below describes the earlier Forge/WPF experiment and GitKraken 12.5. It does **not** describe current ArcLane implementation or acceptance. Use [FEATURE_COVERAGE.md](FEATURE_COVERAGE.md), the 12.6 additions there, and [LOCAL_AGENT_CHECKPOINT_2026-10-10.md](LOCAL_AGENT_CHECKPOINT_2026-10-10.md) for current state. No proprietary application sources or assets were copied.

**Date:** 10 October 2026
**Purpose:** Ground a complete Windows Git client in verified workflows before another UI redesign. **Not** a claim that Forge has feature parity.

## Executive findings

GitKraken is not merely a colourful Git DAG. Its daily work surface is a carefully coordinated, *resizable* three-region workspace: repository references and agent/worktree navigation on the left, a configurable virtualized history graph in the middle, and a contextual WIP/commit/diff panel on the right. Tabs, command palette, rich context menus, keyboard flows, safe history manipulation, merge resolution and Git provider integrations turn the graph into a usable Git environment.

**The current Forge prototype is a partial Git tool, not a GitKraken replacement.** Its real Rust Git backend and WPF exploratory frontend are reusable experiments, but the WPF DataGrid rendering and current panel structure do not satisfy the product's interaction-density, animation, or graphic-polish goals. Do not interpret a successful CLI test as UI feature coverage.

### Authenticated local reference

- Installed reference: GitKraken **12.5.0** at `%LOCALAPPDATA%\gitkraken\app-12.5.0`.
- Reference ASAR: 447,572,451 bytes; inventory identified 63,186 entries.
- `rea inspect-artifact --integrity-policy record-and-continue` completed against that ASAR. **Direct** whole-ASAR `rea analyze-javascript-application` rejected a declared entry checksum mismatch; this was not silently overridden or used to modify GitKraken.
- To analyze inert program structure without executing proprietary bootstrap code, 340 code/resource files (37,638,303 bytes) were extracted **for local reference only**, individually hash-verified, into the ignored `artifacts/gitkraken-app-code` directory.
- REA 6.2.0 analyzed the code-only directory: Evidence `ev_e859c192d0ac18bc37e22f9dc26f8bc4dfc67eb4f71efdf11850230bfa48415e`; input SHA-256 `590566a0c897ed1cb80c0564325fe7954bc41c4b8e2befb6d16f06b712b007f1`.
- REA parsed 157 JavaScript files; 172 relevant files; 34,514,077 text bytes; 6,457,396 AST nodes; 1,129 findings; 85 summarized modules; **one parse failure**; **no truncated parser scopes**. The application graph is nevertheless marked **partial**.
- REA graph counts: 577 recovered JavaScript module nodes, 389 endpoint nodes, 157 JS asset nodes, 84 bundle chunks, 68 IPC-channel nodes, 44 IPC handlers, 7 worker nodes, 4 BrowserWindow constructions, 3 context-bridge API nodes, 3 renderer entrypoints, one Electron main entrypoint.
- Separate high-level summary: 78 IPC operations, 19 literal channels, 49 dynamic channel operations, 34 renderer transmissions, 33 main handlers, 11 renderer listeners, 8 paired renderer transmissions. These figures describe distinct analysis views and **are not additive**.
- The 4 `BrowserWindow` findings are **code constructions**, not four active visible GitKraken windows. REA identified main, request-handler and test/support renderer entrypoints; a development devtools window also appears. A `HostIPC` context API exposes `name`, `on`, `once`, `sendToHost`, and `version` statically.
- Static evidence alone does **not** demonstrate actual UI behaviour, security enforcement, installed feature availability, or runtime frequencies. The attempted native-UI scenario did not produce a verified usable interactive capture.

Local files retained (all ignored by Git):
`artifacts/rea-complete-app-code.json.gz` (89.6 MB, exact byte-for-byte verified gzip copy of the 1.03 GB UTF-16 evidence; original SHA-256 `008bbce52795502c6c5fadb6d1f2138266221fe70f1bdb9a3811e1d0c8476ca1`). The raw duplicate was removed to save disk space; it can be restored on demand;
`artifacts/rea-bounded-findings.json` and `artifacts/rea-app-graph-highlights.json`;
`artifacts/gitkraken-translation-features.json` and the code extraction manifest.

## Interface contract to reproduce in original Forge implementation

1. **Application shell** — true resizable Windows window, compact toolbar, command palette, dockable terminal, persistable per-repo tabs, tab reordering and worktree grouping, repo switcher and favourites, consistent high-DPI support and keyboard focus.
2. **Reference navigator** — local branches, remotes, tags, PRs, issues, teams, stashes, submodules and worktrees; hierarchical collapse, search, filtering, hide/solo, visible ahead/behind and context actions. Separate `List | Agents` modes with shared underlying worktrees.
3. **Graph/history** — real multi-parent DAG lines rather than simulated rows; lanes and crossings; WIP node; refs, authors, times, SHA; rich selection and hovered ancestry/ghost branches; multiselect; search/filter; customizable columns and saved widths; vertical and horizontal virtualization; interaction with refs and commit details.
4. **Commit panel** — when WIP selected: staged/unstaged/untracked/conflicted grouping, stage per file/hunk, discard with safe preview, side-by-side and inline diffs, commit summary and description, amendments, co-authors and hooks state. When commit selected: metadata, changed-file list, diffs, blame/history, parents, context actions.
5. **Git workflow engine** — clone/init/open; branch/tag; checkout including detached; fetch/push/pull strategies; merge/rebase (interactive included), cherry pick, revert, reset (with guarded scope), stash, worktree, submodule, LFS, patches, Gitflow, GPG signing, undo/redo where recovery can be reliably implemented.
6. **Remote collaboration** — GitHub-first but provider abstraction; PRs and their base/head diffs, reviews, labels, issues, actions/CI, integrations, hyperlinks to the browser when the native client cannot safely perform an action.
7. **Agent work surface** — explicit agent-backed worktrees, CLI launch, terminal output, status and pending decisions; issue -> branch -> worktree -> agent; recoverable sessions; all opt-in; **no standing inference services, idle polling or startup models**.
8. **Trust and recoverability** — safe previews, staged vs unstaged distinctions, explicit warnings for history rewrites, no automatic forced pushes or resets, process exit codes and actionable error detail, re-open/resume interrupted Git states, independent checks against the system Git CLI.

## Evidence, not assumption

**Official documentation** confirms UX behaviour; labels from the installed 12.5.0 `strings.json` provide additional candidate coverage but are not proof of enabled UI features. REA provides application architecture and static boundaries; it does not prove runtime action semantics.

Reference docs:
- Interface, resizing, columns, WIP, graph, ghost branches, tabs: https://help.gitkraken.com/gitkraken-desktop/interface/
- Current release history (12.5.0 and Codex/agent/worktree changes): https://help.gitkraken.com/gitkraken-desktop/current/
- Agent sessions and their worktrees: https://help.gitkraken.com/gitkraken-desktop/agents/
- Worktree lifecycle: https://help.gitkraken.com/gitkraken-desktop/worktrees/
- Pull requests: https://help.gitkraken.com/gitkraken-desktop/pull-requests/
- Interactive rebase: https://help.gitkraken.com/gitkraken-desktop/interactive-rebase/
- Interactive cherry pick: https://help.gitkraken.com/gitkraken-desktop/cherrypick/
- WIP/commit/amend behaviour: https://help.gitkraken.com/gitkraken-desktop/commits/
- Command palette: https://help.gitkraken.com/gitkraken-desktop/command-palette/
- Preferences: https://help.gitkraken.com/gitkraken-desktop/preferences/
- Full docs feature categories: https://help.gitkraken.com/gitkraken-desktop/gitkraken-desktop-home/

## Current Forge assessment

Already exercised independently against **disposable testbed**: staged/unstaged/untracked inspection, merge conflict discovery, Unicode/space/shell punctuation paths, ahead/behind/worktrees, file diffs and stage/unstage, commit, push to local bare remote, branch create/switch, stash/pop including untracked data, worktree creation, multi-ref history and rejection of malicious flag-like pathspec. These cover **backend slices**, not the entire experience.

**10 October native-history increment:** The Rust history API now accepts bounded offsets with `has_more` metadata. A disposable 811-commit fast-import fixture returned pages of 350/350/111; all SHAs matched independently collected `git log` output, with no gaps or duplicates. The WPF history pane now exposes a real `Load older commits` button. Windows UI Automation invoked it twice and confirmed the live application displayed 700 then 811 commits. Tests: `scripts/accept-history-pagination.py` and `scripts/accept-wpf-pagination.ps1`. Evidence: `artifacts/history-acceptance.json` and `artifacts/wpf-history-acceptance.json`. This does **not** prove 10k+ scalability or full graph parity.

Not accepted or unproven: complete graph behaviour under extensive branching, hunk staging, amend/undo/redo, merge conflict editor, tag UI, all reset modes, rebasing, cherry-pick UI, PR/issue/CI integration, sessions, embedded terminal, app restart/persistence, accessibility, input latency under 10k+ commits, crash recovery, startup idle overhead and full production distribution.

**Architecture direction:** retain the useful tested Git CLI boundary and independent acceptance probes; treat WPF (native controls, .NET 10) as a candidate foundation rather than as a finished design. Reject superficial colour-only redesigns. The central history graph, column layout, reference navigator, interactions, and commit panel require a deliberate custom visual/component system and measured WPF rendering, not default table widgets. Do not ship or commit GitKraken code/assets.

## Safety before further development

Only `C:\AI\REA\Experiments\Forge-Testbed` and newly created disposable descendants may be mutated by tests. Cortana, SDS, Nostalgia, GitKraken installation, credentials and unrelated running services remain untouched. The source extraction and 1 GB REA dump are locally ignored by `.gitignore` to prevent accidental proprietary redistribution.

**Next gate**: Implement and verify the graph/navigation/commit panel as integrated functional workflows; test real repository states from the fixture set, not screenshots alone. Treat each feature as incomplete until the native UI action produces an independently verified Git state transition. The detailed matrix is `docs/FEATURE_COVERAGE.md`.
