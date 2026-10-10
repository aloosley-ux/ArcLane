# ArcLane — complete product workflow coverage ledger

**Audit baseline: 2026-10-10**. 102 individually testable obligations across GitKraken's core interface and advanced workflows. These are **target behaviours, not promises of implemented features**. Column 4 describes the current Forge evidence; 'backend-tested' means only an underlying CLI slice was tested, never native-UI acceptance. 'partial' indicates incomplete coverage; 'prototype-only' indicates no behavioural acceptance. The matrix includes the entire product scope, not a suggestion to omit later sections. Source background in [GITKRAKEN_AUDIT.md](GITKRAKEN_AUDIT.md).

| # | Domain | User-visible obligation | Current evidence | Acceptance condition |
|---|---|---|---|---|
| 001 | Application shell | Repository open/clone/init | partial | Fixture repo selection, clone+init verified in native UI |
| 002 | Application shell | Multi-repository tabs and tab history | not verified | Open 3 repos; close/reopen app; tabs restored |
| 003 | Application shell | Tab aliases, reordering, grouping worktrees | not verified | Persist aliases/order and group across restart |
| 004 | Application shell | Repo favourites, recent repos and search | not verified | Open from favourite/recents without rescanning idle |
| 005 | Application shell | Command palette with keyboard actions | not verified | Ctrl+P search and activate commands |
| 006 | Application shell | Customisable toolbar and action states | not verified | Enabled state tracks actual repo state |
| 007 | Application shell | Menu bar and Windows keyboard conventions | not verified | Access keys, focus and menu command tests |
| 008 | Application shell | Profiles and workspace configurations | not verified | Separate repo and layout settings |
| 009 | Application shell | Splitters, resizable panels, persistence | not verified | Resize to min width; restart retains widths |
| 010 | Application shell | Configurable themes, zoom, high DPI | not verified | Compare 100%-200% and multiple monitors |
| 011 | Application shell | Native window controls, minimize/restore | not verified | Windows UIA inspection and cold start |
| 012 | Application shell | Settings, external tools, per-repo settings | not verified | Persist exact settings and run external tool |
| 013 | Application shell | Undo/redo history with bounded rollback | not verified | Independent inverse Git state checks |
| 014 | Application shell | Search across files, branches and commits | not verified | Result relevance and click navigation |
| 015 | Application shell | Log/activity viewer with error details | not verified | Error trace without leaked secrets |
| 016 | Application shell | Tray/notification behaviour and low idle CPU | not verified | No running background service required |
| 017 | Reference navigator and history | Local/remotes/tags/stashes hierarchy | not verified | Expand/collapse/search and verify refs |
| 018 | Reference navigator and history | Ahead/behind and tracking indicators | backend-tested | Diverged testbed accurate independently |
| 019 | Reference navigator and history | Branch folder grouping and filters | not verified | Grouped refs, name/path match |
| 020 | Reference navigator and history | Hide/solo refs and graph | not verified | Hidden graph rows follow toggle; persistent |
| 021 | Reference navigator and history | Drag-and-drop branch targets | not verified | Merge/rebase menus reflect source/target |
| 022 | Reference navigator and history | WIP node and staged/unstaged badges | backend-tested | Mixed fixture shows all categories |
| 023 | Reference navigator and history | Real DAG merges/octopus/branch lanes | prototype-only | Graph parents and crossings match git rev-list |
| 024 | Reference navigator and history | Graph row virtualisation >10k commits | not verified | Bounded rows/memory, scroll position retained |
| 025 | Reference navigator and history | Commit columns and rearrangement | not verified | Reorder, author/date/SHA and save widths |
| 026 | Reference navigator and history | Ghost branch and ancestry highlight | not verified | Hover selections use real reachability |
| 027 | Reference navigator and history | Commit/branch multi-selection and diff range | accepted for two-tree review — Control-click two graph commits or choose two local/remote/tag references, inspect exact changed files and swap comparison direction; larger selection sets excluded | Select 2 commits/refs and compare |
| 028 | Reference navigator and history | Graph search/filter by author/ref/path | not verified | Independent git log query checks |
| 029 | Reference navigator and history | Graph keyboard navigation and copy SHA | partial — Arrow/Home/End selection and Shift+F10 context navigation native verified; copy SHA command wired, clipboard acceptance remains | Selection and exact SHA copied |
| 030 | Reference navigator and history | Commit context menus and shortcuts | accepted for explicit commit/reference context menus — native cherry-pick, revert, soft/mixed reset and branch switch independently verify refs/index/files; inactive operations disabled | Correct actions guarded by selection |
| 031 | Reference navigator and history | Detached HEAD and initial/empty repositories | not verified | Open and recover safely |
| 032 | Reference navigator and history | Worktree lists and selectable shared history | backend-tested | Create worktree & visible in list |
| 033 | Files and commits | Stage/unstage full files | accepted for tracked text files — packaged native stage/unstage of bracket filename verified against exact index; neighbouring file unchanged | Index changes independently verified |
| 034 | Files and commits | Stage/unstage selected hunks | accepted — index verified in packaged Windows UI including reverse unstage | Index exact diff independently verified |
| 035 | Files and commits | Untracked, ignored, renamed and deleted files | partial | Mixed fixture correctly groups file states |
| 036 | Files and commits | Inline and side-by-side textual diffs | partial — verified UTF-8 paired snapshots, virtual scroll, wide view; syntax highlighting and binary/image diffs remain | Whitespace/line endings and syntax highlighting |
| 037 | Files and commits | Binary/image/file-type diffs | not verified | Image preview, safe fallback for binaries |
| 038 | Files and commits | Diff search, word diff, whitespace controls | not verified | Diff settings do not mutate repository |
| 039 | Files and commits | Commit summary+description and co-authors | accepted for local index commits — packaged commit editor verifies multiline message, author override and Co-authored-by trailers against git show | Headers validated with git show |
| 040 | Files and commits | Commit staged contents and push option | backend-tested | Only staged bytes committed and upstream checked |
| 041 | Files and commits | Amend previous commit with safeguard | accepted for local amend — message-only amend, remote-tracking sharing warning, explicit rewrite acknowledgement and stale-HEAD refusal backend/native verified; remote publishing excluded | Hash changed, file state correct, shared warning |
| 042 | Files and commits | Revert previous published commit | accepted for local reversing commits — packaged confirmation creates new reversing commit and preserves previous history; remote publication excluded | New reversing commit, history preserved |
| 043 | Files and commits | Reset mixed/soft/hard with previews | partial — confirmed soft/mixed resets native verify target HEAD, exact index, retained working files and other branches; hard reset intentionally absent | Each mode produces correct state, hard guarded |
| 044 | Files and commits | Restore single or multiple historical files | accepted for regular files — packaged confirmed multi-file historical restore preserves exact index, HEAD and neighbouring literal paths; source symlinks and deleted entries refused | Worktree/index bytes independently verified |
| 045 | Files and commits | Commit metadata, parents and signatures | partial — full body, author/committer emails and ISO dates, parent navigation and Git signature status exposed; unsigned fixture native verified, signed-key scenarios unaccepted | Author/email/date/hash accurate |
| 046 | Files and commits | File history and blame | accepted — native commit timeline, parent comparison, correct author attribution and search verified | Line origin matches git blame |
| 047 | Files and commits | Git hooks, skip hooks and GPG signing | not verified | Configured hook and signed commit tests |
| 048 | Files and commits | Commit templates, trailers and editor settings | not verified | Template and multiline messages |
| 049 | Files and commits | Safe discard and undo changed files | partial — native confirmed single-file discard preserves neighbouring bytes and staged index; undo/recovery for discarded bytes remains absent | Explicit preview and recover path |
| 050 | Git operations | Clone/init/open URL and SSH support | partial — clone/init tested previously; this checkpoint adds validated remote-management tools; live SSH/account handling incomplete | Local origin clone and invalid credentials |
| 051 | Git operations | Local/remote branch create/switch/rename/delete | partial | Branches match git show-ref |
| 052 | Git operations | Tags annotated/lightweight and push/delete | partial — annotated tag creation and remote tag pushes/deletes passed local fixtures; native basic create tested | Refs and tag content verified |
| 053 | Git operations | Fetch from multiple remotes | partial — single remote explicit fetch available; multi-remote coverage remains untested | Remote refs and fetched object state |
| 054 | Git operations | Pull merge/rebase/ff-only and abort | partial — all three strategies backend/native verified with local bare upstream, dirty states refused, strategy preference saved; sequencer abort covered by existing conflict workflows, live transport/auth unaccepted | Diverged/dirty worktree guarded |
| 055 | Git operations | Push, set upstream, reject non-fast-forward | backend-tested | Local bare remote verifies push |
| 056 | Git operations | Force push only with exact explicit confirmation | not verified | Blocked without confirmation, never automatic |
| 057 | Git operations | Merge fast-forward and non-FF, abort | not verified | Correct parents and working tree |
| 058 | Git operations | Conflict detection, resolver and continue | accepted for text merges — native ours/theirs/manual resolution, clean staged index and merge continue verified | Unmerged paths surface; safe resolve |
| 059 | Git operations | Rebase interactive pick/reword/squash/drop | not verified | Result SHA & commit order validated |
| 060 | Git operations | Cherry pick single/multiple and conflict resume | partial — confirmed single-commit context action native verifies expected file tree and parent; merge commits disabled, multi-pick absent | Expected tree diff and parent relationship |
| 061 | Git operations | Stash list/create/apply/pop/drop | accepted for local stash workflows — native create/review/apply with index restoration and retained stash; backend guarded pop/drop plus tracked/untracked checks; stale selector refuses mismatched stash SHA | Tracked and untracked preserved |
| 062 | Git operations | Worktree create/open/lock/unlock/remove/prune | partial | Disk, branch, lock and refs validated |
| 063 | Git operations | Submodules sync/add/update | partial — submodule status/sync/update controls exist; native sync acceptance only; add/removal lifecycle unverified | Gitlink and nested refs validated |
| 064 | Git operations | Git LFS status/track/lock | partial — LFS detection and track/untrack verified using installed git-lfs; live server lock/unlock not accepted | Objects and pointers validated |
| 065 | Git operations | Gitflow workflow | partial — Gitflow feature/release/hotfix starts verified in local Git fixtures; finishing/merge lifecycle not implemented | Branches established per repo config |
| 066 | Git operations | Patch generate/apply and reject | not verified | Resulting diff content verified |
| 067 | Git operations | Undo/recover destructive operations | partial — reflog list and SHA-to-new-branch rescue tested; general undo/redo absent | Recoverable reflog-backed operations |
| 068 | Git operations | Error, cancellation and in-progress state handling | partial | Native delayed-reply fixtures verify repository ownership and pending main-view mutation guards; sequencer conflict/abort paths covered separately. Backend cancellation and shared operation serialization remain incomplete |
| 069 | Provider collaboration | GitHub auth with existing gh credential | partial/mock only — gh delegated auth; live auth states untested; no token storage | No key read/exfiltration; login detection |
| 070 | Provider collaboration | GitHub orgs/repos and SSH configuration | not verified | Discover and open authenticated repo |
| 071 | Provider collaboration | GitHub pull request listing and metadata | partial/mock only — PR list/detail fixture and native UI passed; live GitHub not verified | Real PR title/base/head and status |
| 072 | Provider collaboration | Create pull request with template/draft | partial/mock only — create PR form with confirmation; CLI argument contract mocked; no real create acceptance | PR created only with explicit confirmation |
| 073 | Provider collaboration | PR base/head diff in native panels | partial/mock only — changed files shown in fixture; no full native PR diff/review | Files/commits match provider |
| 074 | Provider collaboration | PR reviews/comments/suggestions/merge | partial/mock only — review/comment/merge confirmations and mock commands; live actions not verified | Permissions and actions verified |
| 075 | Provider collaboration | GitHub Issues read/filter/assign/close | partial/mock only — issues list/details/action forms; live assign/close/comment not verified | Issue metadata and mutations confirmed |
| 076 | Provider collaboration | Issue -> branch/worktree workflow | partial — issue-to-worktree UI drafted; native Git workflow not verified | Issue ID/reference carries to branch |
| 077 | Provider collaboration | GitHub Actions/CI checks display | partial/mock only — CI runs shown in native fixture; no live GitHub CI acceptance | Published job state, failure link, refreshing user-driven |
| 078 | Provider collaboration | GitLab, Bitbucket, Azure DevOps adapters | not verified | Provider-specific verified read/write operations |
| 079 | Provider collaboration | Links and fallback to external web | not verified | Unsupported native actions open exact URLs |
| 080 | Provider collaboration | Jira/Trello and provider integration settings | not verified | No integrations run without consent |
| 081 | Provider collaboration | Launchpad cross-repo issues/PRs/attention | partial/mock only — on-demand GitHub PRs/issues/CI list; no cross-repo aggregations verified | Cross-repo list/filter and detail |
| 082 | Agent and terminal | Worktree-centred Agent Sessions mode | not verified | Same worktrees in List and Agents views |
| 083 | Agent and terminal | External agent CLI detection/config | not verified | Detect local executables without side effects |
| 084 | Agent and terminal | Create branch+worktree+agent session | not verified | Named worktree and child process verified |
| 085 | Agent and terminal | Issue -> agent context handoff | not verified | Issue ID and title forwarded once |
| 086 | Agent and terminal | Dedicated embedded terminal per worktree | not verified | Process attaches to intended cwd and exits cleanly |
| 087 | Agent and terminal | Agent session progress and permissions | not verified | Visible when supported; no invented status |
| 088 | Agent and terminal | Session pause/stop/reopen and cleanup | not verified | No orphan CLI children or worktree deletion |
| 089 | Agent and terminal | Custom agent, editor, diff/merge tool launches | not verified | Safe argv quoting including spaces |
| 090 | Agent and terminal | No inference/background polling by default | not verified | Idle process/CPU/network measured |
| 091 | Quality and recovery | Unicode/apostrophe/metacharacter paths | partial — backend Unicode/space/apostrophe/dollar tests and native literal bracket-file stage/unstage/hunk/discard verified; broad path/reparse-point coverage remains | Non-injection and diff verified |
| 092 | Quality and recovery | Huge repo startup and history pagination | partial — 811 commits paged through native UI and verified against Git CLI | Load 10k+/100k history with bounded memory |
| 093 | Quality and recovery | Cancellation/timeouts/no app hangs | not verified | Cancel long Git operation; UI remains responsive |
| 094 | Quality and recovery | Multi-process and lock-file handling | not verified | No concurrent index modification races |
| 095 | Quality and recovery | Error banners and retry with diagnostics | partial | Offline native provider fixture verifies failed PR feed clears stale records, successful issue feed remains available, and explicit retry recovers. Actionable provider diagnostics and live failure recovery remain unaccepted |
| 096 | Quality and recovery | Crash/restart while rebase/cherry-pick | not verified | Detect sequencer and offer continue/abort |
| 097 | Quality and recovery | Accessibility, keyboard focus, screen reader | not verified | UIA names, tabs, input and narration |
| 098 | Quality and recovery | Offline work without GitHub or AI | not verified | Local workflows function disconnected |
| 099 | Quality and recovery | No destructive real-repo acceptance writes | not verified | All mutations limited to disposable fixture repos |
| 100 | Quality and recovery | Reproducible Windows installer, cleanup, update | not verified | Fresh install and uninstall test |
| 101 | Quality and recovery | Startup and idle resource budget | not verified | Measure cold start CPU/RAM and quiet idle |
| 102 | Quality and recovery | Original visual language, no proprietary assets | not verified | Independent assets/code and tracked license audit |

## Completion rule

A feature changes to **accepted** only when real Windows UI interaction is tested against actual disposable Git states, and resulting Git tree/index/refs/process outcome is independently checked. Documents, type signatures, REA static findings, string labels, screenshots and backend-only tests are **not** UI acceptance.

## Safety

Never use Cortana, SDS, Nostalgia, any live developer repo, or external GitHub remotes as a destructive test target. Local repo fixtures in `C:\AI\REA\Experiments\Forge-Testbed` are disposable and authorised. GitKraken assets and proprietary code remain local ignored research references.

## GitKraken 12.6.0 requirements — added 2026-10-10

| # | Domain | User-visible obligation | Current evidence | Acceptance condition |
|---|---|---|---|---|
| 103 | Remote collaboration | Stacked PR chains, PR-on-PR branch bases, stack numbers/dependencies/merged state in sidebar, graph and PR panel | partial/mock only — head/base branch dependencies shown as a 3-level stack; no restack/retarget/cascade operations | GitHub-connected disposable PR fixture has exact chain order and cross-panel consistency; explicit user approval required for creation |
| 104 | Agent and terminal | Multiple persistent PTY terminal tabs per worktree, create/switch/close, process state and graceful shutdown | partial — two independent Windows ConPTY tabs, cwd and teardown native verified; process persistence after app restart not supported | Separate concurrent CLI processes in isolated testbed worktree; no orphaned processes after closing tabs/app |

**Total Arclane product obligations: 104** (102 baseline plus the 12.6 additions). These do not represent implemented counts.

**Feature sprint, batch 3 (2026-10-10):** `accept-operation-workflows.py` passed 12 groups; `native-operation-workflows-accept.mjs` passed 9 Git-context/stash/recovery checks and 3 packaged pull checks. Advanced Git (20) and conflicts (6) regressions passed. Pull never autostashes and rejects dirty, detached, missing-upstream and active-sequencer states. Stash review includes saved untracked content and pins the reviewed SHA before apply/pop/drop. Reference menus expose switch/merge/rebase/rename/safe delete/local tracking; commit menus expose inspect/compare/create branch/pick/revert/soft/mixed reset. Graph arrows, Home/End and Shift+F10 work on loaded history. The old unavailable Undo toolbar now opens real non-destructive reflog recovery. Continue palette dispatch now includes revert; rebase skip is explicitly confirmed. No hard reset, force push or remote provider writes.

**Feature sprint, batch 2 (2026-10-10):** `accept-revision-review.py` passed six groups; `native-revision-review-accept.mjs` passed four packaged Windows checks. Existing paired comparison (9) and Toolbox (17) regressions passed. Review supports first-parent comparison, root-to-empty-tree comparison, two SHA/ref trees, exact per-file snapshots and binary patch fallback. Historical restore requires confirmation and the opened HEAD, validates all selected paths before invoking one Git restore, and never modifies the index. Merge metadata uses the first-parent changed-file inventory. No hard reset or remote mutation was added.

**Feature sprint, batch 1 (2026-10-10):** `accept-commit-options.py` passed five groups; `native-commit-options-accept.mjs` passed four packaged Windows checks. Existing advanced Git (20 groups) and literal paths (10 groups) regressions passed. The options editor leaves hooks enabled, never stages implicitly, checks the opened HEAD, and keeps original author on amend unless overridden. Source and screenshots use Review Bench semantic tokens. Existing acceptance scripts now locate evidence/mock resources relative to their active worktree. Remote-tracking reachability is a warning signal, not proof a commit is unpublished.

**2026-10-10 local agent handoff:** scopes 050, 052, 053, 063–065, 067, 069–077, 081 and 103 were updated with evidence labels. Provider-specific write paths remain *mock-only*, not production-accepted. See LOCAL_AGENT_HANDOFF_2026-10-10.md.
