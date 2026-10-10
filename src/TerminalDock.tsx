import {useCallback,useEffect,useRef,useState}from "react";
import{Terminal as XTerm}from "@xterm/xterm";
import{FitAddon}from "@xterm/addon-fit";
import{listen}from "@tauri-apps/api/event";
import{X,Plus,TerminalSquare,Maximize2,GitFork,LoaderCircle}from "lucide-react";
import "@xterm/xterm/css/xterm.css";
import{client}from "./api";
export type TerminalRequest={path:string;sequence:number};
type SessionMeta={id:string;path:string;pid?:number;title:string;exited:boolean};
type TerminalOutput={id:string;data:string;exited:boolean};
type SessionHandle={term:XTerm;fit:FitAddon;path:string};
const basename=(p:string)=>p.replaceAll("\\","/").split("/").filter(Boolean).at(-1)||"Terminal";
export default function TerminalDock({request,onClose}:{request:TerminalRequest|null;onClose:()=>void}){
 const[sessions,setSessions]=useState<SessionMeta[]>([]);
 const[active,setActive]=useState("");
 const[ready,setReady]=useState(false);
 const[opening,setOpening]=useState(false);
 const[error,setError]=useState("");
 const handles=useRef(new Map<string,SessionHandle>());
 const pending=useRef(new Map<string,string>());
 const refs=useRef(new Map<string,HTMLDivElement>());
 const observers=useRef(new Map<string,ResizeObserver>());
 const unlisten=useRef<null|(()=>void)>(null);
 const requestRef=useRef(0);
 const mounted=useRef(false);
 const activeRef=useRef("");
 const attach=useCallback((id:string,element:HTMLDivElement|null)=>{
   if(!element)return;
   const entry=handles.current.get(id);
   if(!entry||refs.current.has(id))return;
   refs.current.set(id,element);
   entry.term.open(element);
   const fit=()=>{if(activeRef.current!==id||!element.isConnected||element.clientWidth<40||element.clientHeight<35)return;
      try{entry.fit.fit();void client.terminalResize(id,entry.term.rows,entry.term.cols).catch(()=>{});}catch{}};
   const ro=new ResizeObserver(fit);
   ro.observe(element);observers.current.set(id,ro);
   requestAnimationFrame(fit);
 },[]);
 const closeTab=useCallback(async(id:string)=>{
   const entry=handles.current.get(id);
   try{await client.terminalClose(id);}catch{}
   observers.current.get(id)?.disconnect();observers.current.delete(id);refs.current.delete(id);
   entry?.term.dispose();handles.current.delete(id);
   const remaining=[...handles.current.keys()];
   setSessions(old=>old.filter(s=>s.id!==id));
   setActive(current=>current===id?(remaining.at(-1)||""):current);
   if(remaining.length===0)onClose();
 },[onClose]);
 const openTab=useCallback(async(path:string)=>{
   if(!path||opening)return;
   setOpening(true);setError("");
   try{
     const meta=await client.terminalOpen(path,28,105);
     if(!mounted.current){await client.terminalClose(meta.id);return;}
     const xterm=new XTerm({cursorBlink:true,convertEol:false,scrollback:3500,
       fontSize:12,fontFamily:"Cascadia Mono,Consolas,monospace",letterSpacing:0,
       theme:{background:"#202938",foreground:"#dce9f1",cursor:"#86dcd1",selectionBackground:"#6e999b80",
          black:"#1b2631",red:"#e38f93",green:"#8cdbb0",yellow:"#edc38d",blue:"#8cafef",
          magenta:"#c8a3e9",cyan:"#8ad5d6",white:"#cbd7e3"}});
     const fit=new FitAddon();xterm.loadAddon(fit);
     handles.current.set(meta.id,{term:xterm,fit,path:meta.path});
     xterm.onData(data=>void client.terminalSend(meta.id,data).catch(e=>setError(String(e))));
     const buffered=pending.current.get(meta.id);
     if(buffered){xterm.write(buffered);pending.current.delete(meta.id);}
     setSessions(old=>[...old,{id:meta.id,path:meta.path,pid:meta.pid,title:basename(meta.path),exited:false}]);
     setActive(meta.id);
     activeRef.current=meta.id;
     // A newline retrieves the prompt if it was emitted before event attachment.
     await client.terminalSend(meta.id,"\r");
   }catch(e){setError(e instanceof Error?e.message:String(e));}
   finally{if(mounted.current)setOpening(false);}
 },[opening]);
 useEffect(()=>{
   mounted.current=true;
   let closed=false;
   void listen<TerminalOutput>("arclane-terminal-output",({payload})=>{
      const t=handles.current.get(payload.id);
      if(t){if(payload.data)t.term.write(payload.data);}
      else if(payload.data)pending.current.set(payload.id,(pending.current.get(payload.id)||"")+payload.data.slice(0,32000));
      if(payload.exited){setSessions(old=>old.map(s=>s.id===payload.id?{...s,exited:true}:s));}
   }).then(unsub=>{if(closed)unsub();else{unlisten.current=unsub;setReady(true);}}).catch(e=>setError(String(e)));
   return()=>{
      closed=true;mounted.current=false;
      unlisten.current?.();unlisten.current=null;
      for(const[id,entry]of handles.current){void client.terminalClose(id).catch(()=>{});entry.term.dispose();}
      for(const ob of observers.current.values())ob.disconnect();
      handles.current.clear();refs.current.clear();observers.current.clear();pending.current.clear();
   };
 },[]);
 useEffect(()=>{
   if(!ready||!request||request.sequence===requestRef.current)return;
   requestRef.current=request.sequence;void openTab(request.path);
 },[request,ready,openTab]);
 useEffect(()=>{
   activeRef.current=active;
   const view=handles.current.get(active);const node=refs.current.get(active);
   if(view&&node)requestAnimationFrame(()=>{try{view.fit.fit();void client.terminalResize(active,view.term.rows,view.term.cols);}catch{}});
 },[active,sessions.length]);
 return <section className="terminal-dock" aria-label="Embedded terminal sessions">
  <div className="terminal-top"><TerminalSquare size={15}/><strong>Terminal</strong><span className="terminal-count">{sessions.length} sessions</span><div className="terminal-tabs">{sessions.map(s=><div key={s.id} className={"terminal-tab"+(active===s.id?" active":"")}><button className="terminal-select" onClick={()=>setActive(s.id)} title={s.path}><GitFork size={12}/>{s.title}{s.exited&&<span className="term-exited">Exited</span>}</button><button className="terminal-tab-close" aria-label={"Close "+s.title} onClick={()=>void closeTab(s.id)}><X size={12}/></button></div>)}</div><button className="terminal-add" title="New terminal tab" disabled={!ready||opening} onClick={()=>void openTab(handles.current.get(active)?.path||request?.path||"")}>{opening?<LoaderCircle size={15} className="spin"/>:<Plus size={15}/>}</button><button className="terminal-dismiss" onClick={onClose} title="Hide and close all terminal processes"><X size={15}/></button></div>
  {error&&<div className="terminal-error">{error}</div>}
  <div className="terminal-body">{sessions.map(s=><div key={s.id} className="terminal-host" style={{display:active===s.id?"block":"none"}} ref={node=>attach(s.id,node)}/>)}
    {sessions.length===0&&<div className="terminal-empty">{opening?"Starting PowerShell in the selected repository...":"Opening terminal..."}<span>Terminal processes run only while their tabs are open.</span></div>}</div>
 </section>;
}
