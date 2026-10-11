import{useCallback,useEffect,useRef,useState}from"react";
import{Terminal as XTerm}from"@xterm/xterm";
import{FitAddon}from"@xterm/addon-fit";
import{X,Plus,TerminalSquare,GitFork,LoaderCircle}from"lucide-react";
import"@xterm/xterm/css/xterm.css";
import{client,watchTerminalSessions}from"./api";
import type{TerminalSnapshot}from"./terminal-session-state";
export type TerminalRequest={path:string;sequence:number;session?:{id:string;path:string;pid?:number;title:string}};
type SessionMeta={id:string;path:string;pid?:number;title:string;exited:boolean;exitCode?:number|null};
type SessionHandle={term:XTerm;fit:FitAddon;path:string};
const basename=(p:string)=>p.replaceAll("\\","/").split("/").filter(Boolean).at(-1)||"Terminal";
export default function TerminalDock({request,onClose}:{request:TerminalRequest|null;onClose:()=>void}){
 const[sessions,setSessions]=useState<SessionMeta[]>([]);
 const[active,setActive]=useState("");
 const[ready,setReady]=useState(false);
 const[opening,setOpening]=useState(false);
 const[error,setError]=useState("");
 const handles=useRef(new Map<string,SessionHandle>());
 const renderedOutput=useRef(new Map<string,string>());
 const snapshots=useRef(new Map<string,TerminalSnapshot>());
 const refs=useRef(new Map<string,HTMLDivElement>());
 const observers=useRef(new Map<string,ResizeObserver>());
 const requestRef=useRef(0);
 const mounted=useRef(false);
 const activeRef=useRef("");
 const writeSnapshot=useCallback((snapshot:TerminalSnapshot)=>{
   const handle=handles.current.get(snapshot.id);
   if(!handle||!refs.current.has(snapshot.id))return;
   const old=renderedOutput.current.get(snapshot.id)||"";
   if(old===snapshot.output)return;
   if(snapshot.output.startsWith(old))handle.term.write(snapshot.output.slice(old.length));
   else{handle.term.reset();handle.term.write(snapshot.output);}
   renderedOutput.current.set(snapshot.id,snapshot.output);
 },[]);
 const attach=useCallback((id:string,element:HTMLDivElement|null)=>{
   if(!element)return;
   const entry=handles.current.get(id);
   if(!entry||refs.current.has(id))return;
   refs.current.set(id,element);entry.term.open(element);
   const fit=()=>{if(activeRef.current!==id||!element.isConnected||element.clientWidth<40||element.clientHeight<35)return;try{entry.fit.fit();void client.terminalResize(id,entry.term.rows,entry.term.cols).catch(()=>{});}catch{}};
   const ro=new ResizeObserver(fit);ro.observe(element);observers.current.set(id,ro);
   writeSnapshot(snapshots.current.get(id)||{id,path:entry.path,pid:null,agentSession:false,running:true,exitCode:null,exitError:null,output:"",outputTruncated:false,outputClosed:false,revision:-1,closed:false});
   requestAnimationFrame(fit);
 },[writeSnapshot]);
 const disposeView=(id:string)=>{
   observers.current.get(id)?.disconnect();observers.current.delete(id);refs.current.delete(id);
   handles.current.get(id)?.term.dispose();handles.current.delete(id);renderedOutput.current.delete(id);
 };
 const closeTab=useCallback(async(id:string)=>{
   const entry=handles.current.get(id);
   try{await client.terminalClose(id);}catch(e){setError(`Could not stop ${entry?.path||"terminal"}: ${e instanceof Error?e.message:String(e)}`);return;}
   disposeView(id);const remaining=[...handles.current.keys()];
   setSessions(old=>old.filter(s=>s.id!==id));setActive(current=>current===id?(remaining.at(-1)||""):current);
   if(remaining.length===0)onClose();
 },[onClose]);
 const closeAll=useCallback(async()=>{
   const failures:string[]=[];
   for(const[id,entry]of handles.current){try{await client.terminalClose(id);}catch(e){failures.push(`${entry.path}: ${e instanceof Error?e.message:String(e)}`);}}
   if(failures.length){setError("Could not stop every terminal process: "+failures.join("; "));return;}
   for(const id of [...handles.current.keys()])disposeView(id);
   setSessions([]);setActive("");onClose();
 },[onClose]);
 const openTab=useCallback(async(path:string,existing?:TerminalRequest["session"])=>{
   if(!path||opening)return;
   if(existing&&handles.current.has(existing.id)){setActive(existing.id);return;}
   setOpening(true);setError("");
   try{
     let snapshot:TerminalSnapshot;
     if(existing){const current=await client.terminalSessions();const authoritative=current.find(item=>item.id===existing.id);if(!authoritative)throw new Error("The requested terminal session has already closed.");snapshot=authoritative;}
     else snapshot=await client.terminalOpen(path,28,105);
     if(!mounted.current){if(!existing)await client.terminalClose(snapshot.id);return;}
     const term=new XTerm({cursorBlink:true,convertEol:false,scrollback:3500,fontSize:12,fontFamily:"Cascadia Mono,Consolas,monospace",letterSpacing:0,
       theme:{background:"#202938",foreground:"#dce9f1",cursor:"#86dcd1",selectionBackground:"#6e999b80",black:"#1b2631",red:"#e38f93",green:"#8cdbb0",yellow:"#edc38d",blue:"#8cafef",magenta:"#c8a3e9",cyan:"#8ad5d6",white:"#cbd7e3"}});
     const fit=new FitAddon();term.loadAddon(fit);handles.current.set(snapshot.id,{term,fit,path:snapshot.path});snapshots.current.set(snapshot.id,snapshot);
     term.onData(data=>void client.terminalSend(snapshot.id,data).catch(e=>setError(String(e))));
     setSessions(old=>old.some(s=>s.id===snapshot.id)?old:[...old,{id:snapshot.id,path:snapshot.path,pid:snapshot.pid||undefined,title:existing?.title||basename(snapshot.path),exited:!snapshot.running,exitCode:snapshot.exitCode}]);
     setActive(snapshot.id);activeRef.current=snapshot.id;
     if(!existing&&snapshot.running)await client.terminalSend(snapshot.id,"\r");
   }catch(e){setError(e instanceof Error?e.message:String(e));}
   finally{if(mounted.current)setOpening(false);}
 },[opening]);
 useEffect(()=>{
   mounted.current=true;
   const stop=watchTerminalSessions(next=>{
     const nextMap=new Map(next.map(snapshot=>[snapshot.id,snapshot]));
     snapshots.current=nextMap;
     for(const snapshot of next)writeSnapshot(snapshot);
     setSessions(old=>old.filter(session=>nextMap.has(session.id)).map(session=>{const state=nextMap.get(session.id)!;return{...session,path:state.path,pid:state.pid||undefined,exited:!state.running,exitCode:state.exitCode};}));
     for(const id of handles.current.keys())if(!nextMap.has(id))disposeView(id);
     setReady(true);
   },e=>setError(String(e)));
   return()=>{mounted.current=false;stop();for(const id of [...handles.current.keys()]){void client.terminalClose(id).catch(()=>{});disposeView(id);}};
 },[writeSnapshot]);
 useEffect(()=>{if(!ready||!request||request.sequence===requestRef.current)return;requestRef.current=request.sequence;void openTab(request.path,request.session);},[request,ready,openTab]);
 useEffect(()=>{activeRef.current=active;const view=handles.current.get(active);const node=refs.current.get(active);if(view&&node)requestAnimationFrame(()=>{try{view.fit.fit();void client.terminalResize(active,view.term.rows,view.term.cols);}catch{}});},[active,sessions.length]);
 return <section className="terminal-dock" aria-label="Embedded terminal sessions">
  <div className="terminal-top"><TerminalSquare size={15}/><strong>Terminal</strong><span className="terminal-count">{sessions.length} sessions</span><div className="terminal-tabs">{sessions.map(s=><div key={s.id} className={"terminal-tab"+(active===s.id?" active":"")}><button className="terminal-select" onClick={()=>setActive(s.id)} title={s.path}><GitFork size={12}/>{s.title}{s.exited&&<span className="term-exited">Exited · {s.exitCode??"?"}</span>}</button><button className="terminal-tab-close" aria-label={(s.exited?"Close ":"Stop and close ")+s.title} title={s.exited?"Close exited terminal":"Stop and close terminal process"} onClick={()=>void closeTab(s.id)}><X size={12}/></button></div>)}</div><button className="terminal-add" title="New terminal tab" disabled={!ready||opening} onClick={()=>void openTab(handles.current.get(active)?.path||request?.path||"")}>{opening?<LoaderCircle size={15} className="spin"/>:<Plus size={15}/>}</button><button className="terminal-dismiss" onClick={()=>void closeAll()} title="Stop and close all terminal processes"><X size={15}/></button></div>
  {error&&<div className="terminal-error">{error}</div>}
  <div className="terminal-body">{sessions.map(s=><div key={s.id} className="terminal-host" style={{display:active===s.id?"block":"none"}} ref={node=>attach(s.id,node)}/>)}{sessions.length===0&&<div className="terminal-empty">{opening?"Starting process in the selected checkout…":"Opening terminal…"}<span>Terminal processes run only while their tabs are open.</span></div>}</div>
 </section>;
}
