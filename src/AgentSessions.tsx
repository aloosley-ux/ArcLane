import {useEffect,useMemo,useState} from "react";
import {Circle,GitFork,LoaderCircle,Play,RefreshCw,ShieldCheck,Square,Terminal as TerminalIcon,TriangleAlert} from "lucide-react";
import {client,watchTerminalSessions} from "./api";
import type {Worktree} from "./types";
import type {TerminalRequest} from "./TerminalDock";
import "./workflow.css";

type Agent="codex"|"kilo";
type Availability={agent:Agent;available:boolean;path:string|null;error?:string};
type Session={id:string;path:string;pid?:number|null;agent:Agent;state:"creating"|"launching"|"running"|"exited";exitCode?:number|null};
const keyFor=(p:string)=>p.replaceAll("\\","/").replace(/\/+$/g,"").toLowerCase();
const label=(agent:Agent)=>agent==="codex"?"Codex":"Kilo";
const last=(p:string)=>p.replaceAll("\\","/").split("/").filter(Boolean).at(-1)||p;

export default function AgentSessions({path,worktrees,stats,canCreate,active,onRefresh,onTerminal}:{path:string;worktrees:Worktree[];stats:{staged:number;modified:number;untracked:number;conflicts:number;total:number};canCreate:boolean;active:boolean;onRefresh:()=>Promise<void>;onTerminal:(request:NonNullable<TerminalRequest["session"]>)=>void}){
 const [selectedPath,setSelectedPath]=useState(path);
 const [agent,setAgent]=useState<Agent>("codex");
 const [availability,setAvailability]=useState<Availability[]>([]);
 const [discovering,setDiscovering]=useState(false);
 const [session,setSession]=useState<Session|null>(null);
 const [terminalSessions,setTerminalSessions]=useState<import("./terminal-session-state").TerminalSnapshot[]>([]);
 const [retryTarget,setRetryTarget]=useState<string|null>(null);
 const [branch,setBranch]=useState("");
 const [confirmCreate,setConfirmCreate]=useState(false);
 const [configure,setConfigure]=useState(false);
 const [configuredPath,setConfiguredPath]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const selected=worktrees.find(w=>keyFor(w.path)===keyFor(selectedPath))||worktrees.find(w=>keyFor(w.path)===keyFor(path));
 const currentStatus=selected&&keyFor(selected.path)===keyFor(path)?stats:selected?.status||null;
 const agentInfo=availability.find(a=>a.agent===agent);
 const validPath=agentInfo?.available?agentInfo.path:null;
 const agentSnapshots=terminalSessions.filter(s=>s.agentSession&&!s.closed);
 const activeSnapshot=selected?agentSnapshots.filter(s=>keyFor(s.path)===keyFor(selected.path)).at(-1):undefined;
 const visibleSession=activeSnapshot?{id:activeSnapshot.id,path:activeSnapshot.path,pid:activeSnapshot.pid||undefined,agent:session?.id===activeSnapshot.id?session.agent:agent,state:activeSnapshot.running?"running" as const:"exited" as const,exitCode:activeSnapshot.exitCode}:session;
 const entries=useMemo(()=>worktrees.map(w=>({worktree:w,status:keyFor(w.path)===keyFor(path)?stats:w.status||null})),[worktrees,path,stats]);

 const discover=async()=>{setDiscovering(true);setError("");try{const found=await client.agentDiscover();const resolved=await Promise.all(found.map(async item=>{const configured=localStorage.getItem("arclane-agent-path-"+item.agent);if(configured){try{return {...item,path:await client.agentValidate(item.agent,configured),available:true};}catch{return {...item,path:configured,available:false,error:"Configured path is invalid. Choose a valid executable or clear this setting."};}}return item;}));setAvailability(resolved);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setDiscovering(false);}};
 useEffect(()=>{if(active)void discover();},[active]);
 useEffect(()=>watchTerminalSessions(next=>{setTerminalSessions(next);const ids=new Set(next.map(item=>item.id));setSession(current=>current?.id&&!ids.has(current.id)?null:current);},e=>setError(e instanceof Error?e.message:String(e))),[]);
 useEffect(()=>{if(!selectedPath||(!worktrees.some(w=>keyFor(w.path)===keyFor(selectedPath))&&keyFor(session?.path||retryTarget||"")!==keyFor(selectedPath)))setSelectedPath(path);},[worktrees,path,selectedPath,session?.path,retryTarget]);
 useEffect(()=>{setConfiguredPath(agentInfo?.path||"");},[agent,agentInfo?.path]);

 const saveExecutable=async()=>{const retryError=error.includes("checkout was kept")?error:"";setError("");try{const normalized=await client.agentValidate(agent,configuredPath);localStorage.setItem("arclane-agent-path-"+agent,normalized);setAvailability(old=>old.map(a=>a.agent===agent?{...a,path:normalized,available:true}:a));setConfigure(false);setNotice(label(agent)+" executable saved for this user profile.");setError(retryError);}catch(e){setError(e instanceof Error?e.message:String(e));}};
 const launch=async(target:string,branchName?:string)=>{
  if(!validPath){setError(label(agent)+" executable is unavailable. Configure a valid executable path first.");return;}
  if(!target||!selected&&!branchName){setError("Select a registered worktree before launching an agent.");return;}
  setRetryTarget(null);
  let checkoutCreated=false;
  setError("");setNotice(branchName?"Creating branch and worktree…":"Starting "+label(agent)+"…");setSession({id:"",path:target,agent,state:branchName?"creating":"launching"});
  try{
   if(branchName){
    const parent=path.replace(/[\\/][^\\/]+$/g,"");
    const safe=branchName.replace(/[<>:"|?*\\/]/g,"-");
    const destination=parent+"\\arc-agent-"+safe;
    try{await client.action(path,"worktree_add",destination,branchName);checkoutCreated=true;}
    catch(e){throw new Error("Could not create the checkout: "+(e instanceof Error?e.message:String(e)));}
    setSelectedPath(destination);
    setSession({id:"",path:destination,agent,state:"launching"});
    setNotice("Checkout created. Starting "+label(agent)+"…");
    try{await onRefresh();}catch{/* the Git worktree remains available even if the view refresh fails */}
    target=destination;
   }
   const launched=await client.agentLaunch(target,validPath,[]);
   const next:Session={id:launched.id,path:launched.path,pid:launched.pid,agent,state:"running"};
   setSession(next);
   onTerminal({id:launched.id,path:launched.path,pid:launched.pid??undefined,title:label(agent)+" · "+last(launched.path)});
   setNotice(label(agent)+" started in "+launched.path+" (PID "+(launched.pid??"unknown")+").");
  }catch(e){setSession(null);if(checkoutCreated)setRetryTarget(target);setError((e instanceof Error?e.message:String(e))+(checkoutCreated?" The checkout was kept; configure the executable or retry from this checkout.":""));try{await onRefresh();}catch{/* keep original launch error visible */}}
 };
 const startConfirm=()=>{if(!branch.trim()){setError("Enter a branch name before creating a checkout.");return;}setConfirmCreate(true);};
 const confirm=()=>{const name=branch.trim();setConfirmCreate(false);void launch(path,name);};
 const statusText=(w:Worktree,status:typeof stats|null)=>w.locked?"Locked":status?status.total===0?"Clean":`${status.total} change${status.total===1?"":"s"}`:"Status unavailable";

 return <section className="agent-sessions-page" aria-label="Agent Sessions">
  <div className="agent-worktree-list">
   <div className="agent-list-head"><div><h2>Worktrees</h2><p>{worktrees.length} checkout{worktrees.length===1?"":"s"}{agentSnapshots.filter(s=>s.running).length?" · "+agentSnapshots.filter(s=>s.running).length+" session"+(agentSnapshots.filter(s=>s.running).length===1?"":"s")+" running":""}</p></div><button className="agent-icon-action" aria-label="Refresh agent availability" title="Refresh agent availability" onClick={()=>void discover()} disabled={discovering}>{discovering?<LoaderCircle size={15} className="spin"/>:<RefreshCw size={15}/>}</button></div>
   <div className="agent-checkout-list">{entries.map(({worktree:w,status})=><button type="button" key={w.path} className={"agent-checkout"+(keyFor(selected?.path||"")===keyFor(w.path)?" selected":"")} onClick={()=>{setSelectedPath(w.path);setError("");}} aria-pressed={keyFor(selected?.path||"")===keyFor(w.path)}>
    <span className="agent-checkout-branch"><GitFork size={14}/><strong>{w.branch||"Detached HEAD"}</strong>{w.main&&<small>MAIN</small>}</span><span className="agent-checkout-path" title={w.path}>{w.path}</span><span className={"agent-checkout-status"+(w.locked?" locked":status?.total?" dirty":status?" clean":" unknown")}><Circle size={7} fill="currentColor"/>{statusText(w,status)}{agentSnapshots.filter(s=>keyFor(s.path)===keyFor(w.path)).at(-1)?" · "+(agentSnapshots.filter(s=>keyFor(s.path)===keyFor(w.path)).at(-1)!.running?"running":"exited"):""}</span>
   </button>)}</div>
   {!worktrees.length&&<div className="agent-empty-worktrees">No registered worktrees are available. Create one below to launch an agent.</div>}
  </div>
  <div className="agent-session-main">
   <div className="agent-session-heading"><div><h2>Agent Sessions</h2><p>Launch a local agent in a dedicated checkout.</p></div><div className="agent-picker"><label htmlFor="agent-choice">Agent</label><select id="agent-choice" value={agent} onChange={e=>{setAgent(e.target.value as Agent);setError("");}}><option value="codex">Codex</option><option value="kilo">Kilo</option></select></div></div>
   <div className="agent-session-grid">
    <article className="agent-selected-card"><div className="agent-card-title"><h3>Selected checkout</h3><span className={"agent-availability"+(validPath?" available":" unavailable")}><Circle size={8} fill="currentColor"/>{discovering?"Checking local executables…":validPath?label(agent)+" available":label(agent)+" unavailable"}</span></div>
     {selected?<><strong className="agent-branch-name">{selected.branch||"Detached HEAD"}</strong><span className="agent-checkout-path selected-path" title={selected.path}>{selected.path}</span><span className={"agent-git-state"+(selected.locked?" locked":currentStatus?.total?" dirty":" clean")}><ShieldCheck size={13}/>{selected.locked?"This checkout is locked":currentStatus?currentStatus.total===0?"Working tree clean":`${currentStatus.total} uncommitted change${currentStatus.total===1?"":"s"}: ${currentStatus.staged} staged · ${currentStatus.modified} modified · ${currentStatus.untracked} untracked`:"Working state unavailable"}</span>
      {visibleSession&&keyFor(visibleSession.path)===keyFor(selected.path)&&<div className={"agent-session-status "+visibleSession.state} role="status"><span>{visibleSession.state==="creating"?"Creating checkout":visibleSession.state==="launching"?"Launching":visibleSession.state==="running"?"Running":"Exited"}</span>{visibleSession.pid&&<span>PID {visibleSession.pid}</span>}{visibleSession.state==="exited"&&<span>Exit code {visibleSession.exitCode??"unavailable"}</span>}</div>}
     </>:<div className="agent-empty-worktrees">Select a checkout to view its session controls.</div>}
     <div className="agent-selected-actions"><button className="outline-action" disabled={!selected||!validPath||selected.locked} onClick={()=>selected&&void launch(selected.path)}><TerminalIcon size={14}/>Launch in selected checkout</button>{visibleSession?.state==="running"&&selected&&keyFor(visibleSession.path)===keyFor(selected.path)&&<><button className="agent-text-action" onClick={()=>onTerminal({id:visibleSession.id,path:visibleSession.path,pid:visibleSession.pid??undefined,title:label(visibleSession.agent)+" · "+last(visibleSession.path)})}>Open agent terminal</button><span className="agent-stop-hint"><Square size={12}/>Close its terminal tab to stop it.</span></>}</div>
    </article>
    <div className="agent-side-column">
     <article className="agent-config-card"><div className="agent-card-title"><h3>{label(agent)} executable</h3><button className="agent-text-action" onClick={()=>setConfigure(v=>!v)}>{configure?"Cancel":"Configure path"}</button></div><p className="agent-executable-path" title={agentInfo?.path||undefined}>{validPath||agentInfo?.error||"Not found on PATH or standard install locations."}</p>{configure&&<div className="agent-config-form"><label htmlFor="agent-executable-path">Full path to {label(agent)} .exe</label><input id="agent-executable-path" value={configuredPath} onChange={e=>setConfiguredPath(e.target.value)} placeholder="C:\\Users\\you\\AppData\\Local\\Programs\\codex\\codex.exe"/><button className="quiet-btn" onClick={()=>void saveExecutable()}>Validate and save path</button></div>}</article>
     <article className="agent-create-card"><div className="agent-card-title"><h3>Create branch and launch</h3><span>Explicit confirmation</span></div><label htmlFor="agent-branch-name">New branch</label><input id="agent-branch-name" value={branch} onChange={e=>setBranch(e.target.value)} placeholder="feature/agent-task" maxLength={200}/><p>The new checkout stays if launch fails.</p><button className="dialog-confirm" disabled={!canCreate||!validPath||!branch.trim()} onClick={startConfirm}><Play size={14}/>Create checkout and launch {label(agent)}</button></article>
    </div>
   </div>
   {error&&<div className="agent-inline-message error" role="alert"><TriangleAlert size={15}/><span>{error}</span>{error.includes("checkout was kept")&&(retryTarget||selected)&&<button className="agent-text-action" onClick={()=>void launch(retryTarget||selected!.path)}>Retry launch</button>}</div>}
   {notice&&!error&&<div className="agent-inline-message notice" role="status"><ShieldCheck size={15}/><span>{notice}</span></div>}
   <div className="agent-terminal-note"><TerminalIcon size={14}/>Agent processes run only after an explicit launch and use the selected checkout as their working directory.</div>
  </div>
  {confirmCreate&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setConfirmCreate(false);}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="agent-confirm-title"><div className="modal-top"><span className="modal-icon"><GitFork size={19}/></span><button className="icon-btn" aria-label="Close confirmation" onClick={()=>setConfirmCreate(false)}>×</button></div><h2 id="agent-confirm-title">Create checkout and launch {label(agent)}?</h2><p>ArcLane will create branch <strong>{branch.trim()}</strong> in a new linked worktree, then start {label(agent)} in a ConPTY terminal with that exact folder as its working directory.</p><p>If the executable fails to start, ArcLane keeps the new checkout for recovery and retry.</p><div className="dialog-actions"><button className="quiet-btn" onClick={()=>setConfirmCreate(false)}>Cancel</button><button className="dialog-confirm" onClick={confirm}><Play size={14}/>Create and launch</button></div></div></div>}
 </section>;
}
