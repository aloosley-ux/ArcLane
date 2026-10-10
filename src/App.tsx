import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {
 Activity,ArrowDown,ArrowDownLeft,ArrowLeftRight,ArrowRight,ArrowUp,ArrowUpRight,
 Bell,BookOpen,Box,Braces,Check,CheckCheck,ChevronDown,ChevronRight,ChevronsUpDown,
 Circle,Clock3,Columns2,CloudDownload,CloudUpload,Code2,Command,Compass,Copy,ExternalLink,
 Eye,FileClock,FileCode2,FileDiff,FilePlus2,FileText,Filter,Folder,FolderGit2,GitBranch,
 GitCommitHorizontal,GitFork,GitMerge,GitPullRequest,GitPullRequestArrow,HardDrive,
 Layers3,LayoutGrid,ListFilter,LoaderCircle,Maximize2,Minus,MoreHorizontal,
 PanelLeftClose,PanelLeftOpen,Plus,RefreshCw,Search,Settings2,ShieldCheck,SlidersHorizontal,
 Sparkles,SquareArrowOutUpRight,Terminal,Trash2,Undo2,Workflow, X
} from "lucide-react";
import type{LucideIcon}from "lucide-react";
import {client}from "./api";
import {PaneSplitter,WorkspaceTabs,storedPaneSize} from "./DesktopPrimitives";
import TerminalDock,{type TerminalRequest} from "./TerminalDock";
import ConflictResolver from "./ConflictResolver";
import SideBySideDiff from "./SideBySideDiff";
import FileInsights from "./FileInsights";
import RepositoryTools from "./RepositoryTools";
import PatchDiff from "./PatchDiff";
import PullOptions from "./PullOptions";
import StashReview from "./StashReview";
import ContextMenu,{type ContextState,type MenuAction} from "./ContextMenu";
import RevisionReviewPanel from "./RevisionReview";
import CommitOptions from "./CommitOptions";
import CherryPickSeries from "./CherryPickSeries";
import Collaboration from "./Collaboration";
import {buildGraph,graphPalette}from "./graph";
import type{WorkspaceState,RepositoryTab,ChangedFile,Commit,DiffHunk,FileComparison,ProviderPr,ProviderRun,Ref,Repository,Worktree}from "./types";

type Route="history"|"worktrees"|"launchpad"|"agents"|"tools"|"settings";
type ActionDialog={title:string;description:string;label:string;placeholder?:string;defaultValue?:string;confirmText:string;danger?:boolean;onConfirm:(value:string)=>void};
const first=(path:string)=>path.replaceAll("\\","/").split("/").filter(Boolean).at(-1)||path;
const repositoryKey=(path:string)=>path.replaceAll("\\","/").replace(/\/+$/,"").toLowerCase();
const short=(sha:string)=>sha.slice(0,8);
const branchColor=(s:string)=>graphPalette[Math.abs([...s].reduce((n,c)=>((n*31)+c.charCodeAt(0))|0,7))%graphPalette.length];
const hasTauri=()=>typeof window!=="undefined"&&("__TAURI_INTERNALS__" in window);
const statusCode=(f:ChangedFile)=>f.conflict?"!":f.untracked?"+":(f.staged?f.x:f.y).trim()||"M";
const relative=(text:string)=>{if(!text)return"";const d=new Date(text);if(isNaN(d.getTime()))return text;const days=Math.round((Date.now()-d.getTime())/86400000);return days===0?"Today":days===1?"Yesterday":days<30?days+"d ago":d.toLocaleDateString(undefined,{month:"short",day:"numeric"});};
const iconFor=(f:ChangedFile)=>f.conflict?"conflict":f.untracked?"added":f.staged?"staged":"edited";
const groupRef=(r:Ref)=>r.kind==="local"?"Local branches":r.kind==="remote"?"Remotes":"Tags";
const palette=["#426AC5","#8766BA","#A77836","#337F96","#AD5C86","#66863D"];

function Mark({size=28}:{size?:number}){return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M7 31 19.9 8.5 33 31" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M11.5 25.8h17.3" stroke="var(--accent)" strokeWidth="3.8" strokeLinecap="round"/><circle cx="20" cy="8.5" r="3.5" fill="currentColor"/><circle cx="7" cy="31" r="2.7" fill="var(--accent)"/><circle cx="33" cy="31" r="2.7" fill="currentColor"/></svg>}
function IButton({icon:Icon,label,onClick,active=false,disabled=false,kind=""}:{icon:LucideIcon;label:string;onClick:()=>void;active?:boolean;disabled?:boolean;kind?:string}){return <button type="button" className={"icon-btn "+kind+(active?" active":"")} aria-label={label} title={label} onClick={onClick} disabled={disabled}><Icon size={16} strokeWidth={1.8}/></button>}
function ActionButton({icon:Icon,label,onClick,primary=false,disabled=false,busy=false}:{icon:LucideIcon;label:string;onClick:()=>void;primary?:boolean;disabled?:boolean;busy?:boolean}){return <button type="button" className={"action-btn"+(primary?" primary":"")} disabled={disabled||busy} onClick={onClick}>{busy?<LoaderCircle className="spin" size={15}/>:<Icon size={15} strokeWidth={1.85}/>}<span>{label}</span></button>}
function Pill({children,color}:{children:React.ReactNode;color?:string}){return <span className="pill" style={color?{"--pill-color":color} as React.CSSProperties:{}}>{children}</span>}
function Section({title,count,icon:Icon,open,onToggle,children,accent}:{title:string;count?:number;icon:LucideIcon;open:boolean;onToggle:()=>void;children:React.ReactNode;accent?:string}){return <section className="reference-section"><button className="section-header" onClick={onToggle}><Icon size={14} color={accent||"currentColor"} strokeWidth={1.9}/><span>{title}</span><span className="section-count">{count||0}</span>{open?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</button>{open&&<div className="section-items">{children}</div>}</section>}
function CommitGlyph({row,focused}:{row:ReturnType<typeof buildGraph>[number];focused:boolean}){const p=(n:number)=>15+n*17;const center=18;return <svg className="commit-glyph" width="188" height="36" viewBox="0 0 188 36" aria-hidden="true">
 {row.edges.map((e,i)=>{const colour=graphPalette[(e.type==="through"?e.start:e.end)%graphPalette.length];return e.type==="through"?<path key={i} d={"M"+p(e.start)+" 0 V36"} stroke={colour} strokeWidth="2.1" fill="none" opacity=".8"/>:<path key={i} d={"M"+p(e.start)+" 18 C"+p(e.start)+" 28 "+p(e.end)+" 25 "+p(e.end)+" 36"} stroke={colour} strokeWidth="2.2" fill="none"/>;})}
 <path d={"M"+p(row.lane)+" 0 V18"} stroke={graphPalette[row.lane%graphPalette.length]} strokeWidth="2.2" fill="none"/>
 <circle cx={p(row.lane)} cy={center} r={focused?7:6} fill="var(--canvas)" stroke={graphPalette[row.lane%graphPalette.length]} strokeWidth={focused?2.6:2.3}/>
 <circle cx={p(row.lane)} cy={center} r="2.2" fill={graphPalette[row.lane%graphPalette.length]}/>
 </svg>}
function Dialog({dialog,onClose}:{dialog:ActionDialog;onClose:()=>void}){const[value,setValue]=useState(dialog.defaultValue||"");return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal" role="dialog" aria-modal="true" aria-label={dialog.title}><div className="modal-top"><span className="modal-icon"><GitBranch size={20}/></span><IButton icon={X} label="Close" onClick={onClose}/></div><h2>{dialog.title}</h2><p>{dialog.description}</p><label className="field-label" htmlFor="dialog-input">{dialog.label}</label><input id="dialog-input" autoFocus value={value} placeholder={dialog.placeholder} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&value.trim()){dialog.onConfirm(value.trim());onClose();}if(e.key==="Escape")onClose();}}/><div className="dialog-actions"><button className="quiet-btn" onClick={onClose}>Cancel</button><button className={"dialog-confirm"+(dialog.danger?" danger":"")} disabled={!value.trim()} onClick={()=>{dialog.onConfirm(value.trim());onClose();}}>{dialog.confirmText}<ArrowRight size={15}/></button></div></div></div>;}
function Empty({onOpen,onClone,onInitialize,onChoose,recent}:{onOpen:()=>void;onClone:()=>void;onInitialize:()=>void;onChoose:(path:string)=>void;recent:string[]}){return <div className="empty-home"><div className="empty-copy"><Mark size={40}/><h1>Open a Git workspace</h1><p>Choose a local repository to explore its history, review changes and prepare your next commit.</p><div className="welcome-actions"><button className="launch-btn" onClick={onOpen}><FolderGit2 size={16}/>Open repository</button><button className="outline-action" onClick={onClone}><CloudDownload size={15}/>Clone</button><button className="outline-action" onClick={onInitialize}><Plus size={15}/>Initialize</button></div><div className="welcome-hint"><Command size={13}/>Ctrl+O opens a folder · Ctrl+P opens commands</div>{recent.length>0&&<div className="welcome-recents"><h2>Recent repositories</h2>{recent.slice(0,5).map(x=><button key={x} onClick={()=>onChoose(x)}><Folder size={15}/><span>{first(x)}</span><small>{x}</small></button>)}</div>}</div></div>;}

function BlankRoute({icon:Icon,title,body}:{icon:LucideIcon;title:string;body:string}){return <div className="blank-route"><div className="blank-icon"><Icon size={28}/></div><h2>{title}</h2><p>{body}</p></div>;}

export default function App(){
 const[workspace,setWorkspace]=useState<WorkspaceState>({tabs:[],active:null,closed:[]});
 const workspaceState=useRef<WorkspaceState|null>(null);
 const workspaceSave=useRef<Promise<unknown>>(Promise.resolve());
 const persistWorkspace=useCallback((next:WorkspaceState)=>{
  workspaceState.current=next;setWorkspace(next);
  workspaceSave.current=workspaceSave.current.catch(()=>{}).then(()=>client.saveWorkspace(next)).catch(e=>setError(String(e)));
 },[]);
 const rememberTab=useCallback((next:string)=>{
  const state=workspaceState.current;if(!state)return;
  const tabs=state.tabs.some(t=>repositoryKey(t.path)===repositoryKey(next))?state.tabs:[...state.tabs,{path:next,alias:""}];
  persistWorkspace({...state,tabs,active:next,closed:state.closed.filter(t=>repositoryKey(t.path)!==repositoryKey(next))});
 },[persistWorkspace]);
 const[recent,setRecent]=useState<string[]>([]);
 const[path,setPath]=useState("");
 const[repo,setRepo]=useState<Repository|null>(null);
 const[commits,setCommits]=useState<Commit[]>([]);
 const[hasMore,setHasMore]=useState(false);
 const[histLoading,setHistLoading]=useState(false);
 const[loading,setLoading]=useState(false);
 const[busy,setBusy]=useState("");
 const[error,setError]=useState("");
 const[success,setSuccess]=useState("");
 const[route,setRoute]=useState<Route>("history");
 const[selection,setSelection]=useState<string>("WIP");
 const[refScope,setRefScope]=useState("all");
 const[historyQuery,setHistoryQuery]=useState("");
 const[refQuery,setRefQuery]=useState("");
 const[collapsed,setCollapsed]=useState<Record<string,boolean>>({});
 const[leftWidth,setLeftWidth]=useState(()=>storedPaneSize("arclane-bench-navigator",220,190,360));
 const[benchHeight,setBenchHeight]=useState(()=>storedPaneSize("arclane-bench-height",370,260,600));
 const[workspaceHeight,setWorkspaceHeight]=useState(760);
 const workspaceRef=useRef<HTMLDivElement|null>(null);
 const maxBenchHeight=Math.max(260,Math.min(600,workspaceHeight-280));
 const visibleBenchHeight=Math.min(benchHeight,maxBenchHeight);
 useEffect(()=>{localStorage.setItem("arclane-bench-navigator",String(leftWidth));localStorage.setItem("arclane-bench-height",String(benchHeight));},[leftWidth,benchHeight]);
 useEffect(()=>{const n=workspaceRef.current;if(!n)return;const obs=new ResizeObserver(()=>setWorkspaceHeight(n.clientHeight));obs.observe(n);return()=>obs.disconnect();},[]);
 const[showLeft,setShowLeft]=useState(true);
 const[diff,setDiff]=useState("");
 const[comparison,setComparison]=useState<FileComparison|null>(null);
 const[expandedDiff,setExpandedDiff]=useState(false);
 const[hunks,setHunks]=useState<DiffHunk[]>([]);
 const[diffMode,setDiffMode]=useState<"patch"|"hunks"|"side">("patch");
 const[diffTitle,setDiffTitle]=useState("");
 const[selectedFile,setSelectedFile]=useState("");
 const[commitText,setCommitText]=useState("");
 const[commitBody,setCommitBody]=useState("");
 const[pullOptions,setPullOptions]=useState(false);
 const[stashReview,setStashReview]=useState<string|null>(null);
 const[pickSeries,setPickSeries]=useState<string|null>(null);
 const[contextMenu,setContextMenu]=useState<ContextState|null>(null);
 const[collabRefresh,setCollabRefresh]=useState(0);
 const[toolsSection,setToolsSection]=useState<"remotes"|"reflog">("remotes");
 const[revisionReview,setRevisionReview]=useState<{to:string;from?:string}|null>(null);
 const[commitOptions,setCommitOptions]=useState(false);
 const[dialog,setDialog]=useState<ActionDialog|null>(null);
 const[paletteOpen,setPaletteOpen]=useState(false);
 const[conflictFile,setConflictFile]=useState<string|null>(null);
 const[insightsFile,setInsightsFile]=useState<string|null>(null);
 const[terminalDockOpen,setTerminalDockOpen]=useState(false);
 const[terminalRequest,setTerminalRequest]=useState<TerminalRequest|null>(null);
 const terminalSeq=useRef(0);
 const[operationsOpen,setOperationsOpen]=useState(false);
 const[paletteQuery,setPaletteQuery]=useState("");
 const[providerLoading,setProviderLoading]=useState(false);
 const[prs,setPrs]=useState<ProviderPr[]>([]);
 const[runs,setRuns]=useState<ProviderRun[]>([]);
 const[theme,setTheme]=useState<"dark"|"light">(()=>localStorage.getItem("arclane-review-theme")==="dark"?"dark":"light");
 const version=useRef(0);
 const diffVersion=useRef(0);
 const repositoryVersion=useRef(0);
 const activePath=useRef("");
 const pendingGit=useRef(new Map<string,string>());
 const currentCommit=commits.find(x=>x.sha===selection)||null;
 const graph=useMemo(()=>buildGraph(commits),[commits]);
 const refs=useMemo(()=>repo?.refs||[],[repo]);
 const refsByGroup=useMemo(()=>({
  "Local branches":refs.filter(x=>x.kind==="local"),
  "Remotes":refs.filter(x=>x.kind==="remote"),
  "Tags":refs.filter(x=>x.kind==="tag")
 }),[refs]);
 const filtered=useMemo(()=>graph.filter(x=>!historyQuery.trim()||[x.subject,x.author,x.sha,...(refs.filter(r=>x.sha.startsWith(r.sha)).map(r=>r.name))].some(s=>s.toLowerCase().includes(historyQuery.toLowerCase()))),[graph,historyQuery,refs]);
 const graphScrollRef=useRef<HTMLDivElement|null>(null);
 const[graphScrollTop,setGraphScrollTop]=useState(0);
 const[graphViewportHeight,setGraphViewportHeight]=useState(540);
 const graphRowHeight=36;
 const graphStart=Math.max(0,Math.floor(Math.max(0,graphScrollTop-graphRowHeight)/graphRowHeight)-8);
 const graphCapacity=Math.max(25,Math.ceil(graphViewportHeight/graphRowHeight)+18);
 const visibleGraph=filtered.slice(graphStart,graphStart+graphCapacity);
 const graphBelow=Math.max(0,(filtered.length-graphStart-visibleGraph.length)*graphRowHeight);
 useEffect(()=>{const node=graphScrollRef.current;if(!node||route!=="history")return;const measure=()=>setGraphViewportHeight(node.clientHeight);measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[route,path]);
 useEffect(()=>{const node=graphScrollRef.current;if(node)node.scrollTop=0;setGraphScrollTop(0);},[historyQuery,refScope,path]);
 const wip=selection==="WIP";
 const staged=repo?.files.filter(f=>f.staged)||[];
 const unstaged=repo?.files.filter(f=>f.unstaged||f.untracked||f.conflict)||[];
 const showToast=(message:string)=>{setSuccess(message);window.setTimeout(()=>setSuccess(""),4200);};
 const fail=(err:unknown)=>{setError(err instanceof Error?err.message:String(err));};
 const clearInspection=useCallback(()=>{
  ++diffVersion.current;setSelection("WIP");setDiff("");setDiffTitle("");setComparison(null);setHunks([]);setSelectedFile("");setDiffMode("patch");setExpandedDiff(false);
 },[]);
 const refresh=useCallback(async(repoPath:string,scope="all")=>{
  if(repoPath!==activePath.current)return false;
  const t=++version.current;
  clearInspection();setLoading(true);setError("");setHistLoading(false);
  try{const[state,page]=await Promise.all([client.inspect(repoPath),client.history(repoPath,350,scope,0)]);if(t!==version.current)return;
   setRepo(state);setCommits(page.commits);setHasMore(page.has_more);setLoading(false);return true;}
  catch(e){if(t===version.current){setLoading(false);fail(e);}return false;}
 },[clearInspection]);
 const loadPath=useCallback(async(next:string)=>{
   if(!next)return;
   rememberTab(next);activePath.current=next;++repositoryVersion.current;
   setPath(next);setRoute("history");setRefScope("all");setCommitText("");setCommitBody("");setRepo(null);setCommits([]);setHasMore(false);
   setBusy(pendingGit.current.get(repositoryKey(next))||"");setSuccess("");setCommitOptions(false);setRevisionReview(null);setPullOptions(false);setStashReview(null);setContextMenu(null);setToolsSection("remotes");setDialog(null);setOperationsOpen(false);setConflictFile(null);setInsightsFile(null);setPrs([]);setRuns([]);setProviderLoading(false);
   await refresh(next);
 },[refresh,rememberTab]);
 useEffect(()=>{let gone=false;if(!hasTauri()){setError("Open the Arclane desktop application to connect to Git. The standalone browser view does not access local repositories.");return;}
   Promise.all([client.recent(),client.workspace()]).then(([paths,state])=>{if(gone)return;setRecent(paths);workspaceState.current=state;setWorkspace(state);if(state.active)void loadPath(state.active);}).catch(fail);return()=>{gone=true;};},[loadPath]);
 useEffect(()=>{localStorage.setItem("arclane-review-theme",theme);document.documentElement.dataset.theme=theme;},[theme]);
 const openRepo=async()=>{try{const next=await client.pick();if(!next)return;const paths=[next,...recent.filter(x=>x.toLowerCase()!==next.toLowerCase())];await client.setRecent(paths);setRecent(paths);void loadPath(next);}catch(e){fail(e);}};
 const chooseRepo=(next:string)=>{void loadPath(next);setRecent(all=>{const arr=[next,...all.filter(x=>x!==next)];void client.setRecent(arr);return arr;});};
 const initializeRepository=async()=>{try{const folder=await client.pick();if(!folder)return;setDialog({title:"Initialize Git repository",description:"Create a new .git directory in the selected folder. This is refused if the folder is inside an existing Git repository. Type INIT to confirm.",label:"Confirmation",placeholder:"INIT",confirmText:"Initialize repository",onConfirm:value=>{if(value!=="INIT"){fail(new Error("Confirmation did not match"));return;}void client.initialize(folder).then(async result=>{const paths=[result.path,...recent.filter(x=>x!==result.path)];await client.setRecent(paths);setRecent(paths);await loadPath(result.path);showToast("Repository initialized");}).catch(fail);}});}catch(e){fail(e);}};
 const cloneRepository=()=>{setDialog({title:"Clone a repository",description:"Enter an HTTPS/SSH URL or an existing absolute local Git repository path. Afterward choose the parent folder for a new checkout. The clone never overwrites an existing folder.",label:"Repository URL or local path",placeholder:"https://github.com/owner/repository.git",confirmText:"Choose clone location",onConfirm:url=>{void (async()=>{try{const parent=await client.pick();if(!parent)return;setBusy("clone");const result=await client.clone(url,parent);const paths=[result.path,...recent.filter(x=>x!==result.path)];await client.setRecent(paths);setRecent(paths);await loadPath(result.path);showToast("Repository cloned");}catch(e){fail(e);}finally{setBusy("");}})();}});};
 const setScope=async(scope:string)=>{if(!path)return;clearInspection();setRefScope(scope);setLoading(true);setHistLoading(false);setError("");const t=++version.current;try{const page=await client.history(path,350,scope);if(t!==version.current)return;setCommits(page.commits);setHasMore(page.has_more);setLoading(false);}catch(e){if(t===version.current){setLoading(false);fail(e);}}};
 const loadMore=async()=>{
  if(!path||loading||histLoading||!hasMore)return;
  const t=version.current;setHistLoading(true);
  try{const page=await client.history(path,350,refScope,commits.length);if(t!==version.current)return;
   setCommits(old=>{const existing=new Set(old.map(x=>x.sha));return [...old,...page.commits.filter(x=>!existing.has(x.sha))]});setHasMore(page.has_more);
  }catch(e){if(t===version.current)fail(e);}finally{if(t===version.current)setHistLoading(false);}
 };
 const inspectCommit=async(commit:Commit)=>{setSelection(commit.sha);setDiffTitle("Commit "+short(commit.sha));setSelectedFile("");setComparison(null);setHunks([]);setDiffMode("patch");const n=++diffVersion.current;try{const data=await client.diff(path,"",false,commit.sha);if(n===diffVersion.current)setDiff(data.text);}catch(e){if(n===diffVersion.current)fail(e);}};
 const inspectFile=async(file:ChangedFile,isStaged:boolean)=>{setSelection("WIP");setSelectedFile(file.path+(isStaged?"#staged":""));setDiffTitle(file.path);setDiff("");setComparison(null);setHunks([]);setDiffMode("side");const n=++diffVersion.current;try{const results=await Promise.allSettled([client.diff(path,file.path,isStaged),client.hunks(path,file.path,isStaged),client.compare(path,file.path,isStaged)]);if(n!==diffVersion.current)return;if(results[0].status==="fulfilled")setDiff(results[0].value.text);else fail(results[0].reason);setHunks(results[1].status==="fulfilled"?results[1].value.hunks:[]);if(results[2].status==="fulfilled"){setComparison(results[2].value);}else{setComparison(null);setDiffMode(old=>old==="side"?"patch":old);}}catch(e){if(n===diffVersion.current)fail(e);}};
 const stageHunk=async(index:number)=>{
  if(!path||path!==activePath.current||!selectedFile||busy)return;
  const key=repositoryKey(path);if(pendingGit.current.has(key))return;
  pendingGit.current.set(key,"hunk");
  const owner=repositoryVersion.current;
  const staged=selectedFile.endsWith("#staged"),file=staged?selectedFile.slice(0,-7):selectedFile;
  setBusy("hunk");setError("");
  try{
   await client.applyHunk(path,file,staged,index);if(owner!==repositoryVersion.current)return;
   showToast((staged?"Unstaged":"Staged")+" selected hunk");if(!await refresh(path,refScope))return;
   const view=diffVersion.current;
   const next=await Promise.allSettled([client.diff(path,file,staged),client.hunks(path,file,staged)]);
   if(owner!==repositoryVersion.current||view!==diffVersion.current)return;
   setSelection("WIP");setSelectedFile(file+(staged?"#staged":""));setDiffTitle(file);setDiffMode("hunks");setDiff(next[0].status==="fulfilled"?next[0].value.text:"");setHunks(next[1].status==="fulfilled"?next[1].value.hunks:[]);
  }catch(e){if(owner===repositoryVersion.current)fail(e);}finally{
   pendingGit.current.delete(key);if(repositoryKey(activePath.current)===key)setBusy("");
  }
 };
 const runAction=async(op:string,file:string|null=null,input:string|null=null):Promise<boolean>=>{
  if(!path||path!==activePath.current||busy)return false;
  const key=repositoryKey(path);if(pendingGit.current.has(key))return false;
  pendingGit.current.set(key,op);
  const owner=repositoryVersion.current;setBusy(op);setError("");
  try{
   const res=await client.action(path,op,file,input);if(owner!==repositoryVersion.current)return false;
   showToast(res.output||"Git "+op.replaceAll("_"," ")+" completed");return !!await refresh(path,refScope);
  }catch(e){
   if(owner!==repositoryVersion.current)return false;
   const message=e instanceof Error?e.message:String(e);await refresh(path,refScope);
   if(owner===repositoryVersion.current)setError(message);return false;
  }finally{pendingGit.current.delete(key);if(repositoryKey(activePath.current)===key)setBusy("");}
 };
 const stageAll=()=>{if((repo?.stats.conflicts||0)>0){setError("Resolve all merge conflicts before staging all changes.");return;}void runAction("stage_all");};
 const commit=async()=>{if(!commitText.trim())return;const text=commitText.trim()+(commitBody.trim()?"\n\n"+commitBody.trim():"");if(await runAction("commit",null,text)){setCommitText("");setCommitBody("");}};
 const askOperation=(op:string,title:string,description:string,label:string,placeholder:string,confirmText:string,file:string|null=null,danger=false)=>{
   setOperationsOpen(false);
   setDialog({title,description,label,placeholder,confirmText,danger,onConfirm:v=>void runAction(op,file,v)});
 };
 const guardedOperation=(op:string,target:string,title:string,description:string,confirmation:string,file:string|null=null)=>{
   setOperationsOpen(false);
   setDialog({title,description:description+" Type "+confirmation+" to confirm.",label:"Confirmation",placeholder:confirmation,confirmText:title,danger:true,onConfirm:v=>{
     if(v!==confirmation){fail(new Error("Confirmation did not match. No Git command was run."));return;}
     void runAction(op,file,target);
   }});
 };
 const branch=()=>{setDialog({title:"Create a branch",description:"Name your new branch. Arclane will create it at HEAD and switch to it.",label:"Branch name",placeholder:"feature/my-next-step",confirmText:"Create branch",onConfirm:v=>void runAction("branch_create",null,v)});};
 const openProvider=async()=>{if(!path)return;const owner=repositoryVersion.current;setProviderLoading(true);setError("");const res=await Promise.allSettled([client.prs(path),client.runs(path)]);if(owner!==repositoryVersion.current)return;if(res[0].status==="fulfilled")setPrs(res[0].value);else fail(res[0].reason);if(res[1].status==="fulfilled")setRuns(res[1].value);else fail(res[1].reason);setProviderLoading(false);};
 const changeRoute=(r:Route)=>{setRoute(r);};
 const showTerminal=(folder:string)=>{if(!folder)return;setTerminalRequest({path:folder,sequence:++terminalSeq.current});setTerminalDockOpen(true);};
 const canMutate=!!repo&&!busy&&!loading&&!repo.sequencer.active;
 const operationKind=repo?.sequencer.merge?"merge":repo?.sequencer.rebase?"rebase":repo?.sequencer.cherry_pick?"cherry_pick":"revert";
 const actionEnabled=(name:string)=>{
  if(name==="Reopen closed repository tab")return workspace.closed.length>0;
  if(["Open repository","Clone repository","Initialize a repository","Preferences"].includes(name))return true;
  if(!repo||loading)return false;
  if(name==="Interactive rebase from selected commit")return !!currentCommit&&canMutate&&currentCommit.sha!==repo.head;
  if(name==="Cherry-pick a sequence")return canMutate;
  if(name.includes("selected commit"))return !!currentCommit&&(!/Cherry|Revert|Reset/.test(name)||canMutate);
  if(name.includes("conflicted operation"))return !!repo.sequencer.active&&!busy;
  if(name==="Skip current rebase commit")return repo.sequencer.rebase&&!busy;
  if(/Pull|Push|Fetch|Stash|Merge|Rebase|Rename|Delete|Create|Update|Amend/.test(name))return canMutate;
  return true;
 };
 const recover=()=>{setToolsSection("reflog");changeRoute("tools")};
 const commitMenu=(commit:Commit):MenuAction[]=>[
  {name:"Inspect files and metadata",icon:FileDiff,perform:()=>setRevisionReview({to:commit.sha})},
  {name:"Compare with selected commit",icon:ArrowLeftRight,enabled:!!currentCommit&&currentCommit.sha!==commit.sha,perform:()=>currentCommit&&setRevisionReview({from:currentCommit.sha,to:commit.sha})},
  {name:"Copy commit SHA",icon:Copy,perform:()=>void navigator.clipboard.writeText(commit.sha).catch(fail)},
  {name:"Create branch here",icon:GitBranch,enabled:canMutate,perform:()=>askOperation("branch_from_commit","Create branch at commit","Create and switch to a branch at "+short(commit.sha)+". Git protects conflicting local changes.","Branch name","feature/from-history","Create branch",commit.sha)},
  {name:"Cherry-pick commit",icon:GitCommitHorizontal,enabled:canMutate&&commit.parents.length<2,perform:()=>guardedOperation("cherry_pick",commit.sha,"Cherry-pick commit","Apply this commit onto the current branch.",short(commit.sha))},
  {name:"Revert commit",icon:Undo2,enabled:canMutate&&commit.parents.length<2,perform:()=>guardedOperation("revert",commit.sha,"Revert commit","Create a new reversing commit; preserve history.",short(commit.sha))},
  {name:"Reset soft to commit",icon:Undo2,enabled:canMutate,perform:()=>guardedOperation("reset_soft",commit.sha,"Soft reset","Move the current branch pointer; keep staged and working files.",short(commit.sha))},
  {name:"Reset mixed to commit",icon:Undo2,enabled:canMutate,perform:()=>guardedOperation("reset_mixed",commit.sha,"Mixed reset","Move the branch pointer and reset the index; keep working files.",short(commit.sha))}
 ];
 const refMenu=(r:Ref):MenuAction[]=>[
  {name:"Show reference history",icon:Workflow,perform:()=>void setScope(r.full)},
  {name:"Compare reference trees",icon:ArrowLeftRight,perform:()=>setRevisionReview({to:r.sha})},
  {name:"Copy reference name",icon:Copy,perform:()=>void navigator.clipboard.writeText(r.name).catch(fail)},
  ...(r.kind==="local"?[
   {name:"Switch to branch",icon:GitBranch,enabled:canMutate&&!r.current,perform:()=>void runAction("branch_switch",null,r.name)},
   {name:"Merge into current branch",icon:GitMerge,enabled:canMutate&&!r.current,perform:()=>guardedOperation("merge",r.name,"Merge branch","Merge "+r.name+" into "+repo?.branch+".",r.name)},
   {name:"Rebase current onto branch",icon:GitFork,enabled:canMutate&&!r.current,perform:()=>guardedOperation("rebase",r.name,"Rebase branch","Rewrite current commits onto "+r.name+". Coordinate before publishing shared history.",r.name)},
   {name:"Rename branch",icon:GitBranch,enabled:canMutate,perform:()=>askOperation("branch_rename","Rename branch","Rename "+r.name+".","New branch name",r.name,"Rename branch",r.name)},
   {name:"Delete merged branch",icon:Trash2,enabled:canMutate&&!r.current,perform:()=>guardedOperation("branch_delete",r.name,"Delete merged branch","Git refuses unmerged or checked-out branches.",r.name)}
  ]:r.kind==="remote"?[
   {name:"Create tracking branch",icon:GitBranch,enabled:canMutate&&!r.full.endsWith("/HEAD"),perform:()=>askOperation("branch_track_remote","Create tracking branch","Create and switch to a local branch tracking "+r.name+".","Local branch name",r.name.split("/").slice(1).join("/"),"Create tracking branch",r.full)}
  ]:[{name:"Delete local tag",icon:Trash2,enabled:canMutate,perform:()=>guardedOperation("tag_delete",r.name,"Delete local tag","Remove this local tag. Remote tags remain untouched.",r.name)}])
 ];
 const closeTab=(target:string)=>{
  const state=workspaceState.current;if(!state)return;const closed=state.tabs.find(t=>repositoryKey(t.path)===repositoryKey(target));if(!closed)return;
  const tabs=state.tabs.filter(t=>repositoryKey(t.path)!==repositoryKey(target));const active=repositoryKey(path)===repositoryKey(target)?tabs[Math.min(state.tabs.indexOf(closed),tabs.length-1)]?.path||null:path;
  persistWorkspace({tabs,active,closed:[closed,...state.closed.filter(t=>repositoryKey(t.path)!==repositoryKey(target))].slice(0,30)});
  if(repositoryKey(path)!==repositoryKey(target))return;
  if(active){void loadPath(active);return;}
  activePath.current="";++repositoryVersion.current;++version.current;setPath("");setRepo(null);setCommits([]);setHasMore(false);setLoading(false);setHistLoading(false);setBusy("");setError("");setSuccess("");clearInspection();setDialog(null);setCommitOptions(false);setRevisionReview(null);setPullOptions(false);setStashReview(null);setContextMenu(null);setConflictFile(null);setInsightsFile(null);
 };
 const reopenTab=()=>{const tab=workspaceState.current?.closed[0];if(!tab)return;const state=workspaceState.current!;persistWorkspace({...state,tabs:[...state.tabs,tab],closed:state.closed.slice(1)});chooseRepo(tab.path)};
 const moveTab=(target:string,direction:number)=>{const state=workspaceState.current;if(!state)return;const tabs=[...state.tabs],index=tabs.findIndex(t=>repositoryKey(t.path)===repositoryKey(target));const destination=index+direction;if(index<0||destination<0||destination>=tabs.length)return;[tabs[index],tabs[destination]]=[tabs[destination],tabs[index]];persistWorkspace({...state,tabs})};
 const tabMenu=(tab:RepositoryTab):MenuAction[]=>[
  {name:"Rename tab alias",icon:FolderGit2,perform:()=>setDialog({title:"Rename tab alias",description:"Set a local display name. Repository folders and branches remain unchanged.",label:"Tab alias",defaultValue:tab.alias||first(tab.path),confirmText:"Save alias",onConfirm:value=>{const state=workspaceState.current!;persistWorkspace({...state,tabs:state.tabs.map(t=>t.path===tab.path?{...t,alias:value}:t)})}})},
  {name:"Clear tab alias",icon:X,enabled:!!tab.alias,perform:()=>{const state=workspaceState.current!;persistWorkspace({...state,tabs:state.tabs.map(t=>t.path===tab.path?{...t,alias:""}:t)})}},
  {name:"Move tab left",icon:ArrowLeftRight,enabled:workspace.tabs.indexOf(tab)>0,perform:()=>moveTab(tab.path,-1)},
  {name:"Move tab right",icon:ArrowLeftRight,enabled:workspace.tabs.indexOf(tab)<workspace.tabs.length-1,perform:()=>moveTab(tab.path,1)},
  {name:"Close repository tab",icon:X,perform:()=>closeTab(tab.path)},
  {name:"Reopen closed repository tab",icon:Undo2,enabled:workspace.closed.length>0,perform:reopenTab}
 ];
 const openContext=(e:React.MouseEvent,label:string,actions:MenuAction[])=>{e.preventDefault();setContextMenu({x:e.clientX,y:e.clientY,label,actions})};
 const graphKey=(e:React.KeyboardEvent,commit:Commit)=>{
  if(e.key==="Enter"){void inspectCommit(commit);return}
  if(e.key==="ContextMenu"||(e.shiftKey&&e.key==="F10")){e.preventDefault();const r=e.currentTarget.getBoundingClientRect();setContextMenu({x:r.left+180,y:r.top,label:"Commit "+short(commit.sha),actions:commitMenu(commit)});return}
  if(!["ArrowUp","ArrowDown","Home","End"].includes(e.key))return;e.preventDefault();
  const i=filtered.findIndex(c=>c.sha===commit.sha);const next=e.key==="Home"?0:e.key==="End"?filtered.length-1:Math.max(0,Math.min(filtered.length-1,i+(e.key==="ArrowUp"?-1:1)));
  const target=filtered[next];if(!target)return;void inspectCommit(target);const node=graphScrollRef.current;if(node){node.scrollTop=Math.max(0,next*graphRowHeight-node.clientHeight/2);setGraphScrollTop(node.scrollTop)}
  requestAnimationFrame(()=>document.querySelector<HTMLElement>('[data-commit="'+target.sha+'"]')?.focus({preventScroll:true}));
 };
 const actions:MenuAction[]=[
  {name:"Open repository",icon:FolderGit2,shortcut:"Ctrl+O",perform:()=>void openRepo()},
  {name:"Reopen closed repository tab",icon:Undo2,shortcut:"Ctrl+Shift+T",perform:reopenTab},
  {name:"Close current repository tab",icon:X,shortcut:"Ctrl+W",perform:()=>closeTab(path)},
  {name:"Clone repository",icon:CloudDownload,perform:cloneRepository},
  {name:"Initialize a repository",icon:FolderGit2,perform:()=>void initializeRepository()},
  {name:"Refresh repository",icon:RefreshCw,shortcut:"F5",perform:()=>path&&void refresh(path,refScope)},
  {name:"History and commit graph",icon:GitCommitHorizontal,perform:()=>changeRoute("history")},
  {name:"Create branch",icon:GitBranch,perform:branch},
  {name:"Rename branch",icon:GitBranch,perform:()=>askOperation("branch_rename","Rename branch","Rename the currently checked-out branch. The Git branch reference will be updated.", "New branch name","feature/renamed","Rename branch",repo?.branch||null)},
  {name:"Delete merged branch",icon:Trash2,perform:()=>askOperation("branch_delete","Delete a merged branch","Git refuses to delete unmerged branches. Type the exact branch name to delete.", "Branch to delete","feature/old","Delete merged branch",null,true)},
  {name:"Create lightweight tag",icon:Box,perform:()=>askOperation("tag_create","Create Git tag","Create a lightweight tag at HEAD.","Tag name","v1.0.0","Create tag")},
  {name:"Delete tag",icon:Trash2,perform:()=>askOperation("tag_delete","Delete Git tag","Delete a local tag. Existing remote tags are not changed.","Tag name","v1.0.0","Delete tag",null,true)},
  {name:"Merge branch into current",icon:GitMerge,perform:()=>askOperation("merge","Merge branch","Merge an existing local branch into the checked-out branch. Git will stop safely if conflicts need resolution.","Branch to merge","feature/ready","Merge branch")},
  {name:"Rebase current branch onto another",icon:GitFork,perform:()=>askOperation("rebase","Rebase branch","Rebase current commits onto another local branch. This rewrites commit hashes. Avoid rebasing published shared history.","Target branch","main","Rebase current branch",null,true)},
  {name:"Inspect selected commit files and metadata",icon:FileDiff,perform:()=>currentCommit&&setRevisionReview({to:currentCommit.sha})},
  {name:"Compare selected commit with a branch or revision",icon:ArrowLeftRight,perform:()=>currentCommit&&setRevisionReview({to:currentCommit.sha})},
  {name:"Amend and commit author options",icon:GitCommitHorizontal,perform:()=>setCommitOptions(true)},
  {name:"Cherry-pick selected commit",icon:GitCommitHorizontal,perform:()=>currentCommit&&guardedOperation("cherry_pick",currentCommit.sha,"Cherry-pick commit","Apply this commit onto the current branch.",short(currentCommit.sha))},
  {name:"Cherry-pick a sequence",icon:GitCommitHorizontal,perform:()=>{setOperationsOpen(false);setPickSeries(currentCommit?.sha||"");}},
  {name:"Revert selected commit",icon:Undo2,perform:()=>currentCommit&&guardedOperation("revert",currentCommit.sha,"Revert commit","Create a new commit reversing the selected commit.",short(currentCommit.sha))},
  {name:"Stash changes including untracked",icon:Layers3,perform:()=>askOperation("stash","Stash working changes","Temporarily store current tracked and untracked changes.", "Stash message","Work in progress","Stash changes")},
  {name:"Continue conflicted operation",icon:Check,perform:()=>void runAction(operationKind+"_continue")},
  {name:"Skip current rebase commit",icon:ArrowRight,perform:()=>guardedOperation("rebase_skip","","Skip rebase commit","Skip this conflicted commit and continue the rebase.","SKIP")},
  {name:"Abort conflicted operation",icon:X,perform:()=>void runAction(repo?.sequencer?.merge?"merge_abort":repo?.sequencer?.rebase?"rebase_abort":repo?.sequencer?.cherry_pick?"cherry_pick_abort":repo?.sequencer?.revert?"revert_abort":"merge_abort")},
  {name:"Reset current branch to selected commit (soft)",icon:Undo2,perform:()=>currentCommit&&guardedOperation("reset_soft",currentCommit.sha,"Soft reset","Move your current branch pointer. Staged and working files are retained.",short(currentCommit.sha))},
  {name:"Reset current branch to selected commit (mixed)",icon:Undo2,perform:()=>currentCommit&&guardedOperation("reset_mixed",currentCommit.sha,"Mixed reset","Move your current branch pointer and unstage files. Working files are retained.",short(currentCommit.sha))},
  {name:"Update Git submodules",icon:Box,perform:()=>void runAction("submodule_update")},
  {name:"Fetch remotes",icon:CloudDownload,perform:()=>void runAction("fetch")},
  {name:"Pull with strategy options",icon:ArrowDown,perform:()=>setPullOptions(true)},
  {name:"Reflog recovery",icon:Undo2,perform:recover},
  {name:"Pull (fast-forward only)",icon:ArrowDown,perform:()=>void runAction("pull")},
  {name:"Push current branch",icon:ArrowUp,perform:()=>void runAction("push")},
  {name:"View worktrees",icon:GitFork,perform:()=>changeRoute("worktrees")},
  {name:"Repository tools: remotes, recovery, Gitflow, LFS",icon:HardDrive,perform:()=>changeRoute("tools")},
  {name:"View agent worktrees",icon:Braces,perform:()=>changeRoute("agents")},
  {name:"Pull requests and checks",icon:GitPullRequest,perform:()=>changeRoute("launchpad")},
  {name:"Preferences",icon:Settings2,perform:()=>changeRoute("settings")},
  {name:"Open repository in VS Code",icon:Code2,perform:()=>path&&void client.openPath(path,"editor").catch(fail)},
  {name:"Open embedded terminal tab",icon:Terminal,perform:()=>showTerminal(path)}
 ].map(a=>({...a,enabled:actionEnabled(a.name)}));
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="t"){e.preventDefault();reopenTab();return}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="w"&&!dialog&&!commitOptions&&!revisionReview&&!stashReview&&!pullOptions){e.preventDefault();if(path)closeTab(path);return}if((e.ctrlKey||e.metaKey)&&["p","k"].includes(e.key.toLowerCase())){e.preventDefault();setPaletteOpen(s=>!s);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="o"){e.preventDefault();void openRepo();}if(e.key==="F5"){e.preventDefault();if(path)void refresh(path,refScope);}if(e.key==="Escape"){setPaletteOpen(false);setDialog(null);}};document.addEventListener("keydown",handler);return()=>document.removeEventListener("keydown",handler);});
 const renderFiles=(files:ChangedFile[],isStaged:boolean)=><div className="change-list">{files.map(file=><div key={file.path} className={"change-row"+(selectedFile===file.path+(isStaged?"#staged":"")?" selected":"")}><button className="change-select" onClick={()=>file.conflict?setConflictFile(file.path):void inspectFile(file,isStaged)}><span className={"file-flag "+iconFor(file)}>{statusCode(file)}</span><span className="file-label"><span className="file-name">{first(file.path)}</span><span className="file-folder">{file.path.includes("/")?file.path.slice(0,file.path.lastIndexOf("/")):"Repository root"}</span></span></button>{file.conflict?<button className="change-resolve" onClick={()=>setConflictFile(file.path)}><GitMerge size={13}/>Resolve</button>:<button className="change-mini" aria-label={(isStaged?"Unstage ":"Stage ")+file.path} title={(isStaged?"Unstage ":"Stage ")+file.path} onClick={()=>void runAction(isStaged?"unstage":"stage",file.path)}>{isStaged?<Minus size={14}/>:<Plus size={14}/>}</button>}{!isStaged&&!file.untracked&&!file.conflict&&<button className="change-mini file-discard" aria-label={"Discard unstaged changes in "+file.path} title="Discard unstaged changes (confirmation required)" onClick={()=>guardedOperation("discard_file","","Discard file changes","This permanently discards unstaged changes in "+file.path+". Staged changes remain intact.","DISCARD",file.path)}><Trash2 size={13}/></button>}{!file.untracked&&<button className="change-mini" aria-label={"File history and blame "+file.path} title="File history and line-by-line blame" onClick={()=>setInsightsFile(file.path)}><FileClock size={14}/></button>}</div>)}{files.length===0&&<div className="list-zero">{isStaged?"No staged changes":"Working tree is clean"}</div>}</div>;
 const visibleRefs=(key:keyof typeof refsByGroup)=>refsByGroup[key].filter(r=>!refQuery||r.name.toLowerCase().includes(refQuery.toLowerCase()));
 const nav:{route:Route;icon:LucideIcon;label:string;title?:string}[]=[
  {route:"history",icon:Workflow,label:"Commit graph",title:"History"},
  {route:"worktrees",icon:GitFork,label:"Worktrees"},
  {route:"launchpad",icon:GitPullRequestArrow,label:"Pull requests and CI",title:"Pull requests & CI"},
  {route:"agents",icon:Braces,label:"Agent worktrees"},
  {route:"tools",icon:HardDrive,label:"Repository tools"},
  {route:"settings",icon:Settings2,label:"Preferences"}
 ];
 const heading:Record<Route,string>={history:"Commit history",worktrees:"Worktrees",launchpad:"Launchpad",agents:"Agent sessions",tools:"Repository tools",settings:"Preferences"};
 return <div className="desktop">
  <header className="app-top">
   <div className="brand"><span className="brand-mark"><Mark size={23}/></span><span className="brand-name">ArcLane</span></div>
   <div className="tab-area">{workspace.tabs.map(t=><div key={t.path} className="repository-tab-shell" onContextMenu={e=>openContext(e,t.alias||first(t.path),tabMenu(t))}><button title={t.path} className={"repo-tab"+(repositoryKey(path)===repositoryKey(t.path)?" chosen":"")} onClick={()=>chooseRepo(t.path)}><FolderGit2 size={14}/><span>{t.alias||first(t.path)}</span>{repositoryKey(path)===repositoryKey(t.path)&&<span className="tab-dot"/>}</button><button className="repository-tab-close" aria-label={"Close tab "+(t.alias||first(t.path))} onClick={()=>closeTab(t.path)}><X size={12}/></button></div>)}<IButton icon={Plus} label="Open another repository" onClick={()=>void openRepo()}/></div>
   <div className="app-top-end"><span className="top-system">Local workspace</span><span className="top-divider"/><IButton icon={Bell} label="Show status" onClick={()=>showToast("No background services. Refresh only when requested.")}/></div>
  </header>
  <div className="main-toolbar">
   <div className="repo-identity"><IButton icon={showLeft?PanelLeftClose:PanelLeftOpen} label="Toggle references" onClick={()=>setShowLeft(x=>!x)}/><span className="toolbar-sep"/>{repo?<><span className="identity-mark"><FolderGit2 size={18}/></span><span className="identity-text"><b>{repo.name}</b><small>{repo.branch||"Detached HEAD"}</small></span><span className="identity-tracking">{repo.ahead>0&&<span className="ahead">↑ {repo.ahead}</span>}{repo.behind>0&&<span className="behind">↓ {repo.behind}</span>}</span></>:<><span className="identity-mark muted"><FolderGit2 size={19}/></span><span className="identity-text"><b>No repository open</b><small>Local · Offline ready</small></span></>}</div>
   <button className="quick-search" onClick={()=>setPaletteOpen(true)}><Search size={15}/><span>Search commands…</span><kbd>Ctrl P</kbd></button>
   <div className="toolbar-actions"><IButton icon={Undo2} label="Open reflog recovery" onClick={recover} disabled={!repo}/><span className="toolbar-sep"/><ActionButton icon={CloudDownload} label="Fetch" onClick={()=>void runAction("fetch")} disabled={!canMutate} busy={busy==="fetch"}/><ActionButton icon={ArrowDownLeft} label="Pull" onClick={()=>setPullOptions(true)} disabled={!canMutate} busy={busy==="pull"}/><ActionButton icon={ArrowUpRight} label="Push" onClick={()=>void runAction("push")} primary disabled={!canMutate} busy={busy==="push"}/><span className="toolbar-sep"/><IButton icon={MoreHorizontal} label="Repository operations" active={operationsOpen} onClick={()=>setOperationsOpen(v=>!v)}/></div>
  </div>
  {operationsOpen&&<div className="operations-menu" role="menu" aria-label="Repository operations"><div className="operations-heading"><GitMerge size={15}/> Git operations <IButton icon={X} label="Close menu" onClick={()=>setOperationsOpen(false)}/></div>{actions.filter(a=>!["Open repository","Refresh repository","History and commit graph","Pull requests and checks","Preferences","Open repository in VS Code","Open terminal in repository"].includes(a.name)).map(a=><button key={a.name} role="menuitem" disabled={a.enabled===false} onClick={()=>{a.perform();setOperationsOpen(false);}}><a.icon size={15}/>{a.name}</button>)}</div>}
  <div className="workspace-navigation"><WorkspaceTabs items={nav} selected={route} onSelect={changeRoute}/><IButton icon={Terminal} label="Open embedded terminal" disabled={!repo} onClick={()=>showTerminal(path)}/></div>
  <div ref={workspaceRef} className={"work-layout"+(!showLeft?" navigator-hidden":"")} style={{"--side-width":leftWidth+"px","--bench-height":visibleBenchHeight+"px"} as React.CSSProperties}>
   {showLeft&&<aside className="sidebar">
    <div className="sidebar-top"><div className="side-title-row"><h2>Repository</h2><IButton icon={MoreHorizontal} label="Navigator actions" onClick={()=>setPaletteOpen(true)}/></div><div className="filter-wrap"><Search size={15}/><input aria-label="Filter repository references" placeholder="Filter branches, tags..." value={refQuery} onChange={e=>setRefQuery(e.target.value)}/>{refQuery&&<button title="Clear filter" onClick={()=>setRefQuery("")}><X size={13}/></button>}</div></div>
    <div className="sidebar-scroll">{repo?<><div className="sidebar-current"><div className="current-indicator"><GitBranch size={15}/></div><div><small>Checked out</small><strong>{repo.branch||"Detached HEAD"}</strong></div></div>{(Object.keys(refsByGroup) as Array<keyof typeof refsByGroup>).map(key=><Section key={key} title={key} count={refsByGroup[key].length} icon={key==="Local branches"?GitBranch:key==="Remotes"?CloudDownload:Box} open={!collapsed[key]} onToggle={()=>setCollapsed(old=>({...old,[key]:!old[key]}))} accent={key==="Local branches"?"var(--accent)":undefined}>{visibleRefs(key).map(r=><button key={r.full} title={r.full} onContextMenu={e=>openContext(e,r.name,refMenu(r))} className={"ref-row"+(refScope===r.full?" active":"")} onClick={()=>void setScope(r.full)}><span className="branch-stem" style={{background:branchColor(r.full)}}/><span className="ref-name">{r.name}</span>{r.current&&<span className="ref-head">HEAD</span>}</button>)}{visibleRefs(key).length===0&&<span className="list-zero">No matches</span>}</Section>)}<Section title="Stashes" count={repo.stashes.length} icon={Layers3} open={!collapsed.Stashes} onToggle={()=>setCollapsed(old=>({...old,Stashes:!old.Stashes}))}>{repo.stashes.map(s=><div className="stash-row" key={s.id}><button className="stash-inspect" aria-label={"Inspect "+s.id} onClick={()=>setStashReview(s.id)}>{s.id}</button><small title={s.title}>{s.title}</small><span className="stash-actions"><button aria-label={"Apply "+s.id} title="Apply without dropping" onClick={()=>setStashReview(s.id)}><Undo2 size={13}/></button><button aria-label={"Pop "+s.id} title="Apply and drop" onClick={()=>setStashReview(s.id)}><ArrowDown size={13}/></button><button aria-label={"Delete "+s.id} title="Delete stash" onClick={()=>setStashReview(s.id)}><Trash2 size={13}/></button></span></div>)}</Section><Section title="Worktrees" count={repo.worktrees.length} icon={GitFork} open={!collapsed.Worktrees} onToggle={()=>setCollapsed(old=>({...old,Worktrees:!old.Worktrees}))}>{repo.worktrees.map(w=><button className="ref-row" key={w.path} onClick={()=>changeRoute("worktrees")}><span className="branch-stem" style={{background:"#b1a1ff"}}/><span className="ref-name">{w.branch||first(w.path)}</span>{w.main&&<span className="ref-head">MAIN</span>}</button>)}</Section></>:<div className="sidebar-first"><FolderGit2 size={26}/><h3>Nothing to navigate yet</h3><p>Open a local Git repository to explore its history and branches.</p><button className="text-action" onClick={()=>void openRepo()}>Open repository <ArrowRight size={14}/></button></div>}</div>
    <div className="sidebar-footer"><ActionButton icon={GitBranch} label="New branch" onClick={branch} disabled={!repo}/><IButton icon={Plus} label="Add repository" onClick={()=>void openRepo()}/></div>
   </aside>}
   {showLeft&&<PaneSplitter axis="vertical" value={leftWidth} min={190} max={360} onChange={setLeftWidth} label="Resize navigator"/>}
   <div className="workspace-column">
   <main className="work-main">{!path?<Empty onOpen={()=>void openRepo()} onClone={cloneRepository} onInitialize={()=>void initializeRepository()} onChoose={chooseRepo} recent={recent}/>:<>{repo?.sequencer?.active&&<div className="sequencer-banner"><span><GitMerge size={17}/>Git operation paused for conflict resolution — {repo.sequencer.merge?"merge":repo.sequencer.rebase?"rebase":repo.sequencer.cherry_pick?"cherry-pick":"revert"} in progress</span><button onClick={()=>void runAction(repo.sequencer.merge?"merge_continue":repo.sequencer.rebase?"rebase_continue":repo.sequencer.cherry_pick?"cherry_pick_continue":"revert_continue")}><Check size={14}/>Continue</button><button onClick={()=>void runAction(repo.sequencer.merge?"merge_abort":repo.sequencer.rebase?"rebase_abort":repo.sequencer.cherry_pick?"cherry_pick_abort":"revert_abort")}><X size={14}/>Abort safely</button></div>}<div className="pane-titlebar"><div className="pane-title-main"><div><h1>{heading[route]}</h1></div>{route==="history"&&<span className="commit-count">{commits.length}{hasMore?"+" :""} commits</span>}</div><div className="pane-tools">{route==="history"?<><span className="scope-badge"><Workflow size={14}/>{refScope==="all"?"All references":first(refScope)}</span><IButton icon={Search} label="Search history" onClick={()=>document.getElementById("history-search")?.focus()}/><IButton icon={RefreshCw} label="Refresh history" onClick={()=>void refresh(path,refScope)}/></>:<IButton icon={RefreshCw} label="Refresh view" onClick={()=>route==="launchpad"?setCollabRefresh(v=>v+1):void refresh(path,refScope)}/>}</div></div>
     {route==="history"&&<><div className="graph-headers"><span>Graph</span><span>Commit message</span><span>Author</span><span>Date</span><span><IButton icon={Filter} label="Filter history" onClick={()=>document.getElementById("history-search")?.focus()}/></span></div><div className="graph-search-row"><Search size={14}/><input id="history-search" aria-label="Filter visible commits" value={historyQuery} onChange={e=>setHistoryQuery(e.target.value)} placeholder="Find commits by message, author or SHA..."/><span>{historyQuery?"Filtering loaded history":"Filter loaded history"}</span></div><div className="graph-scroll" ref={graphScrollRef} onScroll={e=>setGraphScrollTop(e.currentTarget.scrollTop)}><div className={"wip-commit"+(wip?" selected":"")} onClick={clearInspection} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter")clearInspection();}}><span className="wip-glyph"><span className="wip-node"/></span><span className="wip-text"><Pill color="var(--accent)">Working tree</Pill><strong>{repo?.stats.total?repo.stats.total+" uncommitted file"+(repo.stats.total===1?"":"s"):"Everything is up to date"}</strong></span><span className="wip-descriptor">Your changes</span><span className="wip-time">Now</span><span/></div>{loading?<div className="history-loading"><LoaderCircle size={22} className="spin"/><span>Reading repository history...</span></div>:filtered.length?<><div aria-hidden="true" style={{height:graphStart*graphRowHeight}}/>{visibleGraph.map(row=>{const attached=refs.filter(r=>row.sha.startsWith(r.sha));return <div key={row.sha} data-commit={row.sha} onContextMenu={e=>openContext(e,"Commit "+short(row.sha),commitMenu(row))} className={"commit-row"+(selection===row.sha?" selected":"")} onClick={e=>{if((e.ctrlKey||e.metaKey)&&currentCommit&&currentCommit.sha!==row.sha)setRevisionReview({from:currentCommit.sha,to:row.sha});else void inspectCommit(row)}} role="button" tabIndex={0} onKeyDown={e=>graphKey(e,row)}><CommitGlyph row={row} focused={selection===row.sha}/><div className="commit-content"><span className="commit-subject">{row.subject}</span>{attached.slice(0,2).map(r=><span key={r.full} className={"branch-label "+r.kind} style={{"--branch-c":branchColor(r.full)} as React.CSSProperties}>{r.current?<Circle size={8} fill="currentColor"/>:null}{r.name}</span>)}</div><span className="commit-author">{row.author}</span><span className="commit-date">{row.date}</span><span className="commit-sha">{short(row.sha)}</span></div>})}<div aria-hidden="true" style={{height:graphBelow}}/></>:<div className="no-results"><Search size={20}/><h3>No matching commits</h3><p>Try another search or load additional history.</p></div>}{hasMore&&<button className="history-more" disabled={loading||histLoading} onClick={()=>void loadMore()}>{histLoading?<LoaderCircle className="spin" size={16}/>:<ArrowDown size={15}/>} Load older commits <span>+350</span></button>}</div></>}
     {route==="tools"&&<RepositoryTools key={path+toolsSection} initialSection={toolsSection} path={path} branch={repo?.branch||""} onUpdate={()=>void refresh(path,refScope)}/>}
     {route==="worktrees"&&<div className="route-content"><div className="route-description"><GitFork size={24}/><div><h2>Work in parallel without collisions.</h2><p>Each Git worktree shares repository history but has its own working directory and checked-out branch.</p></div></div><div className="worktree-grid">{repo?.worktrees.map(w=><div className="worktree-card" key={w.path}><div className="wt-card-head"><span className="wt-icon"><GitFork size={18}/></span><Pill color={w.main?"var(--accent)":"var(--purple)"}>{w.main?"MAIN":"LINKED"}</Pill></div><h3>{w.branch||"Detached worktree"}</h3><p>{w.path}</p><div className="wt-card-end"><span><Circle size={8} fill={w.locked?"#e6b27d":"#6fc4ad"} color="transparent"/>{w.locked?"Locked":"Ready"}</span><button onClick={()=>void client.openPath(w.path,"explorer").catch(fail)}>Open folder <ExternalLink size={14}/></button></div>{!w.main&&<div className="wt-extra"><button onClick={()=>void runAction(w.locked?"worktree_unlock":"worktree_lock",w.path)}><ShieldCheck size={12}/>{w.locked?"Unlock":"Lock"}</button><button className="danger" onClick={()=>guardedOperation("worktree_remove","","Remove linked worktree","Git refuses to remove a locked or modified worktree. Deleting a clean worktree removes its directory.",first(w.path),w.path)}><Trash2 size={12}/>Remove</button></div>}</div>)}</div><button className="new-worktree-card" disabled={!canMutate} onClick={()=>setDialog({title:"New worktree",description:"Create an isolated working directory and branch. The location defaults to a sibling folder.",label:"New branch name",placeholder:"agent/new-feature",confirmText:"Create worktree",onConfirm:name=>{const target=path.replace(/[\\/][^\\/]+$/,"")+"\\arclane-"+name.replaceAll("/","-");void runAction("worktree_add",target,name);}})}><Plus size={21}/><span>Create a worktree</span><small>A safe place for a parallel task</small></button><button className="new-worktree-card" disabled={!canMutate} onClick={()=>setDialog({title:"Attach existing branch",description:"Choose an existing local branch which is not already checked out in another worktree. ArcLane will create a new sibling folder and preserve all existing worktrees.",label:"Existing branch",placeholder:"feature/my-feature",confirmText:"Attach branch",onConfirm:name=>{const target=path.replace(/[\\/][^\\/]+$/,"")+"\\arclane-"+name.replace(/[^A-Za-z0-9._-]+/g,"-");void runAction("worktree_add_existing",target,name);}})}><GitBranch size={20}/><span>Attach local branch</span><small>Use an existing branch in a separate checkout</small></button><button className="new-worktree-card" disabled={!canMutate} onClick={()=>setDialog({title:"Detached inspection worktree",description:"Create a read-only-by-convention checkout of a historical commit in a separate folder. Git allows editing it, but the existing branch and HEAD stay unchanged.",label:"Commit SHA",placeholder:currentCommit?.sha.slice(0,12)||"Commit SHA",defaultValue:currentCommit?.sha||"",confirmText:"Create detached worktree",onConfirm:sha=>{const target=path.replace(/[\\/][^\\/]+$/,"")+"\\arclane-inspect-"+sha.slice(0,12);void runAction("worktree_add_detached",target,sha);}})}><FileClock size={20}/><span>Inspect a commit</span><small>Detached worktree without moving a branch</small></button><button className="new-worktree-card" disabled={!canMutate} onClick={()=>guardedOperation("worktree_prune","","Prune stale worktrees","Remove only invalid worktree administration records. Existing checkout folders are not deleted.","PRUNE")}><ShieldCheck size={20}/><span>Prune stale records</span><small>Cleanup missing worktree registrations</small></button></div>}
     {route==="launchpad"&&<Collaboration key={path} path={path} refreshSignal={collabRefresh}/>}
     {route==="agents"&&<div className="route-content"><div className="route-description"><Braces size={25}/><div><h2>Keep agent work isolated.</h2><p>Git worktrees give each coding agent a dedicated branch and folder. Arclane does not run an AI model in the background.</p></div></div><div className="agent-list">{repo?.worktrees.map(w=><div className="agent-card" key={w.path}><span className="agent-worktree-icon"><GitFork size={19}/></span><div><strong>{w.branch||first(w.path)}</strong><small>{w.path}</small></div><Pill color="#81bcb6">WORKTREE</Pill><button onClick={()=>showTerminal(w.path)}><Terminal size={14}/> Open terminal</button></div>)}</div><div className="notice"><ShieldCheck size={19}/><span>Agent status and permission control require explicit agent integrations. No session status is guessed from the presence of a worktree.</span></div></div>}
     {route==="settings"&&<div className="route-content settings-view"><div className="route-description"><Settings2 size={25}/><div><h2>A workspace shaped around your workflow.</h2><p>All preferences remain on this machine.</p></div></div><div className="settings-row"><div><h3>Appearance</h3><p>Choose the contrast that works best for your screen.</p></div><div className="setting-options"><button className={theme==="dark"?"selected":""} onClick={()=>setTheme("dark")}>Dark</button><button className={theme==="light"?"selected":""} onClick={()=>setTheme("light")}>Light</button></div></div><div className="settings-row"><div><h3>Background activity</h3><p>Manual refresh. No repo polling, no automatic fetch, no AI inference service.</p></div><Pill color="var(--good)">DISABLED</Pill></div><div className="settings-row"><div><h3>Current backend</h3><p>Git for Windows, invoked by Rust using argument arrays without shell interpolation.</p></div><Pill color="var(--purple)">RUST</Pill></div><div className="settings-row"><div><h3>Repository folder</h3><p>{path}</p></div><button className="outline-action" onClick={()=>void client.openPath(path,"explorer").catch(fail)}><Folder size={14}/>Open folder</button></div></div>}
   </>}</main>
   {path&&route==="history"&&<PaneSplitter axis="horizontal" value={visibleBenchHeight} min={260} max={maxBenchHeight} onChange={setBenchHeight} label="Resize review bench" invert/>}
   {path&&route==="history"&&<aside className={"inspector"+(!wip?" commit-review":"")} aria-label="Review bench"><div className="inspector-head"><div className="inspector-title"><div><h2>{wip?"Working changes":"Commit details"}</h2><span>{wip?(repo?.files.length||0)+" files changed":currentCommit?short(currentCommit.sha):"Select a commit"}</span></div><IButton icon={MoreHorizontal} label="Inspector actions" onClick={()=>setPaletteOpen(true)}/></div></div>
     {wip?<><div className="change-groups"><div className="change-group-head"><span><Circle size={7} fill="var(--warm)" color="var(--warm)"/> Unstaged changes</span><span>{unstaged.length}</span><button disabled={!unstaged.length||!!busy||(repo?.stats.conflicts||0)>0} title={(repo?.stats.conflicts||0)>0?"Resolve merge conflicts first":"Stage all changes"} onClick={stageAll}>Stage all</button></div>{renderFiles(unstaged,false)}<div className="change-group-head staged-head"><span><Circle size={7} fill="var(--good)" color="var(--good)"/> Staged changes</span><span>{staged.length}</span><button disabled={!staged.length||!!busy} title="Unstage everything" onClick={()=>void runAction("unstage_all")}>Unstage all</button></div>{renderFiles(staged,true)}</div><div className="right-diff"><div className="right-diff-heading"><FileDiff size={14}/><span>{diffTitle||"Diff preview"}</span>{comparison&&<button className="diff-expand" title="Open wide side-by-side diff" aria-label="Expand diff" onClick={()=>setExpandedDiff(true)}><Maximize2 size={14}/></button>}{selectedFile&&<div className="diff-mode-tabs">{comparison&&<button className={diffMode==="side"?"active":""} onClick={()=>setDiffMode("side")}><Columns2 size={12}/> Side by side</button>}<button className={diffMode==="patch"?"active":""} onClick={()=>setDiffMode("patch")}>Patch</button><button className={diffMode==="hunks"?"active":""} onClick={()=>setDiffMode("hunks")}>Hunks {hunks.length}</button></div>}</div>{diffMode==="side"&&comparison?<SideBySideDiff comparison={comparison}/>:diffMode==="hunks"&&selectedFile&&hunks.length>0?<div className="hunk-list">{hunks.map(h=><section key={h.index} className="hunk-card"><div className="hunk-head"><span><GitBranch size={12}/>{h.header}</span><small>+{h.added} / -{h.removed}</small><button disabled={!!busy} onClick={()=>void stageHunk(h.index)}>{selectedFile.endsWith("#staged")?<Minus size={13}/>:<Plus size={13}/>} {selectedFile.endsWith("#staged")?"Unstage":"Stage"} hunk</button></div><pre>{h.text}</pre></section>)}</div>:<PatchDiff text={diff}/>}</div><div className="commit-composer"><div className="composer-context">To <GitBranch size={13}/><strong>{repo?.branch||"Detached HEAD"}</strong></div><div className="composer-head"><GitCommitHorizontal size={16}/><b>Commit changes</b>{staged.length>0&&<Pill color="var(--good)">{staged.length} staged</Pill>}</div><input aria-label="Commit summary" placeholder="Summary of what changed" value={commitText} onChange={e=>setCommitText(e.target.value)} maxLength={300}/><textarea aria-label="Commit description" placeholder="Add a description (optional)" value={commitBody} onChange={e=>setCommitBody(e.target.value)} rows={3}/><button className="composer-options" disabled={!!busy||!!repo?.sequencer?.active} onClick={()=>setCommitOptions(true)}>Amend, author &amp; co-authors…</button><button className="commit-submit" disabled={!commitText.trim()||staged.length===0||!!busy||(repo?.stats.conflicts||0)>0} onClick={commit}>{busy==="commit"?<LoaderCircle className="spin" size={16}/>:<GitCommitHorizontal size={17}/>}Commit {staged.length>0?staged.length+" staged file"+(staged.length===1?"":"s"):"staged changes"}<ArrowRight size={16}/></button></div></>:<div className="commit-inspector">{currentCommit?<><div className="commit-overview"><div className="commit-meta"><span className="meta-label">COMMIT</span><h3>{currentCommit.subject}</h3><div className="meta-row"><span>SHA</span><button className="copy-sha" onClick={()=>{void navigator.clipboard.writeText(currentCommit.sha);showToast("Commit SHA copied");}}>{short(currentCommit.sha)}<Copy size={12}/></button></div><div className="meta-row"><span>Author</span><strong>{currentCommit.author}</strong></div><div className="meta-row"><span>Committed</span><strong>{currentCommit.date}</strong></div><div className="meta-row"><span>Parents</span><strong>{currentCommit.parents.length}</strong></div></div><button className="revision-launch" onClick={()=>setRevisionReview({to:currentCommit.sha})}>Inspect files, metadata &amp; comparisons</button><div className="commit-context-actions"><button disabled={!canMutate||currentCommit.parents.length>1} onClick={()=>guardedOperation("cherry_pick",currentCommit.sha,"Cherry-pick commit","Apply this commit onto the current branch.",short(currentCommit.sha))}><GitCommitHorizontal size={14}/> Cherry-pick</button><button disabled={!canMutate||currentCommit.parents.length>1} onClick={()=>guardedOperation("revert",currentCommit.sha,"Revert commit","Create a reversing commit.",short(currentCommit.sha))}><Undo2 size={14}/> Revert</button><button disabled={!canMutate} onClick={()=>guardedOperation("reset_soft",currentCommit.sha,"Soft reset","Move HEAD to this commit. Keep index and working files.",short(currentCommit.sha))}><GitBranch size={14}/> Reset soft</button></div></div><div className="commit-diff-header"><FileDiff size={15}/> Changes in commit</div><div className="commit-patch"><PatchDiff text={diff}/></div></>:<BlankRoute icon={GitCommitHorizontal} title="Select a commit" body="Select a point in the history to inspect its contents and ancestry."/>}</div>}
   </aside>}
   </div>
  </div>
  {terminalDockOpen&&<TerminalDock request={terminalRequest} onClose={()=>setTerminalDockOpen(false)}/>}
  {expandedDiff&&comparison&&<div className="diff-expand-overlay" role="dialog" aria-modal="true" aria-label={"Side-by-side comparison "+comparison.file}><div className="diff-expand-frame"><div className="diff-expand-heading"><span><Columns2 size={18}/><strong>Side-by-side comparison</strong><small>{comparison.file}</small></span><button aria-label="Close expanded diff" onClick={()=>setExpandedDiff(false)}><X size={19}/></button></div><SideBySideDiff comparison={comparison}/></div></div>}
  {insightsFile&&path&&<FileInsights path={path} file={insightsFile} onClose={()=>setInsightsFile(null)}/>}
  {conflictFile&&path&&<ConflictResolver path={path} file={conflictFile} onClose={()=>setConflictFile(null)} onResolved={file=>{setConflictFile(null);void refresh(path,refScope);showToast("Resolved and staged "+file);}}/>}
  <footer className="statusbar"><span className="status-left"><Circle size={6} fill={error?"#f19698":"#76c5a8"} color="transparent"/>{error?"Attention required":loading?"Reading repository":"Ready"}<span className="status-divider"/>{path?first(path):"No repository selected"}</span><span className="status-right"><span><HardDrive size={12}/> Local workspace</span><span><ShieldCheck size={12}/> Git for Windows</span><span>0.1</span></span></footer>
  {error&&<div className="toast error-toast"><span><ShieldCheck size={16}/>{error}</span><IButton icon={X} label="Dismiss error" onClick={()=>setError("")}/></div>}
  {success&&<div className="toast success-toast"><Check size={17}/>{success}</div>}
  {contextMenu&&<ContextMenu menu={contextMenu} onClose={()=>setContextMenu(null)}/>}
  {pullOptions&&<PullOptions key={path} upstream={repo?.upstream} dirty={!!repo?.files.length} busy={!!busy} onPull={strategy=>runAction(strategy)} onClose={()=>setPullOptions(false)}/>}
  {pickSeries!==null&&repo&&!repo.sequencer.active&&<CherryPickSeries key={path+pickSeries} head={repo.head} commits={commits} initial={pickSeries} onApply={items=>runAction("cherry_pick_series",null,JSON.stringify({expectedHead:repo.head,commits:items}))} onClose={()=>setPickSeries(null)}/>}
  {stashReview&&<StashReview key={path+stashReview} path={path} id={stashReview} busy={!!busy} onAction={(op,sha,id)=>runAction(op,sha,id)} onClose={()=>setStashReview(null)}/>}
  {revisionReview&&<RevisionReviewPanel key={path+revisionReview.to+(revisionReview.from||"")} path={path} to={revisionReview.to} from={revisionReview.from} refs={refs} commits={commits} busy={!!busy} onSave={input=>runAction("restore_revision_files",null,input)} onClose={()=>setRevisionReview(null)}/>}
  {commitOptions&&<CommitOptions key={path} path={path} message={commitText.trim()+(commitBody.trim()?"\n\n"+commitBody.trim():"")} busy={!!busy} onSave={input=>runAction("commit_options",null,input)} onClose={()=>setCommitOptions(false)}/>}
  {dialog&&<Dialog dialog={dialog} onClose={()=>setDialog(null)}/>}
  {paletteOpen&&<div className="palette-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setPaletteOpen(false);}}><div className="palette" role="dialog" aria-modal="true" aria-label="Command palette"><div className="palette-search"><Command size={20}/><input autoFocus value={paletteQuery} placeholder="What would you like to do?" onChange={e=>setPaletteQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){const a=actions.find(a=>a.name.toLowerCase().includes(paletteQuery.toLowerCase())&&a.enabled!==false);if(a){a.perform();setPaletteOpen(false);setPaletteQuery("");}}}}/><kbd>ESC</kbd></div><div className="palette-results"><div className="palette-caption">ACTIONS</div>{actions.filter(a=>a.name.toLowerCase().includes(paletteQuery.toLowerCase())).map(a=><button key={a.name} disabled={a.enabled===false} onClick={()=>{a.perform();setPaletteOpen(false);setPaletteQuery("");}}><a.icon size={18}/><span>{a.name}</span>{a.shortcut&&<kbd>{a.shortcut}</kbd>}<ArrowRight size={14}/></button>)}{!actions.some(a=>a.name.toLowerCase().includes(paletteQuery.toLowerCase()))&&<div className="palette-none">No matching actions</div>}</div><div className="palette-footer"><span>Enter: run action</span><span>Esc: close</span></div></div></div>}
 </div>;
}
