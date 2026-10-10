import {useEffect,useState}from "react";
import{AlertTriangle,ArrowRight,Check,ChevronRight,Code2,FileDiff,GitMerge,Layers3,LoaderCircle,ShieldCheck,X}from "lucide-react";
import{client}from "./api";
import type{ConflictData}from "./types";
import "./conflict.css";

type Choice="ours"|"theirs"|"manual";
type Props={path:string;file:string;onClose:()=>void;onResolved:(file:string)=>void};
const shortPath=(s:string)=>s.replaceAll("\\","/").split("/").at(-1)||s;
function CodePane({title,subtitle,text,tone}:{title:string;subtitle:string;text:string|null;tone:string}){
 const lines=text?.split("\n")||[];
 return <section className={"merge-source "+tone}>
  <div className="merge-source-head"><span className="merge-source-glyph"><Code2 size={15}/></span><span><b>{title}</b><small>{subtitle}</small></span><span className="merge-source-count">{text===null?"ABSENT":lines.length+" lines"}</span></div>
  {text===null?<div className="merge-source-empty">This side deleted the file or has no indexed version.</div>:<div className="merge-source-code">{lines.slice(0,1200).map((line,i)=><div className="merge-source-line" key={i}><span>{String(i+1).padStart(2,"0")}</span><code>{line||" "}</code></div>)}{lines.length>1200&&<p>Preview clipped at 1,200 lines. Full text remains available in the resolution editor.</p>}</div>}
 </section>;
}
export default function ConflictResolver({path,file,onClose,onResolved}:Props){
 const[conflict,setConflict]=useState<ConflictData|null>(null);
 const[choice,setChoice]=useState<Choice>("manual");
 const[draft,setDraft]=useState("");
 const[loading,setLoading]=useState(true);
 const[saving,setSaving]=useState(false);
 const[error,setError]=useState("");
 const[originalDraft,setOriginalDraft]=useState("");
 useEffect(()=>{
   let cancelled=false;setLoading(true);setError("");setConflict(null);
   client.inspectConflict(path,file).then(info=>{
     if(cancelled)return;
     setConflict(info);
     // Initialise the editor with actual working-tree conflict markers, then let the
     // user explicitly replace them. Using "ours" by default could silently lose data.
     const initial=(info.ours??"")+"\n<<<<<<< THEIRS (reference only)\n"+(info.theirs??"");
     setDraft(initial);setOriginalDraft(initial);setChoice("manual");
   }).catch(e=>{if(!cancelled)setError(String(e));}).finally(()=>{if(!cancelled)setLoading(false);});
   return()=>{cancelled=true};
 },[path,file]);
 useEffect(()=>{
   const key=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!saving){e.preventDefault();onClose();}};
   window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);
 },[saving,onClose]);
 const choose=(selection:"ours"|"theirs")=>{
   if(!conflict)return;
   const source=conflict[selection];
   if(source===null)return;
   setDraft(source);setChoice(selection);setError("");
 };
 const save=async()=>{
   if(!conflict||saving||loading)return;
   // Decline unresolved Git conflict-marker drafts. Users must review and actively
   // remove conflict markers before a manual stage.
   if(choice==="manual"&&/^(<{7}|={7}|>{7})(?:\s|$)/m.test(draft)){
      setError("The resolution still contains conflict markers. Remove them or select one version before staging.");
      return;
   }
   setSaving(true);setError("");
   try{
     await client.resolveConflict(path,file,choice,choice==="manual"?draft:undefined);
     onResolved(file);
   }catch(e){setError(e instanceof Error?e.message:String(e));}
   finally{setSaving(false);}
 };
 const changed=choice!=="manual"||draft!==originalDraft;
 return <div className="merge-overlay" role="dialog" aria-modal="true" aria-label={"Resolve conflict: "+file}>
 <div className="merge-frame">
  <div className="merge-top"><div className="merge-breadcrumb"><GitMerge size={21}/><div><span>MERGE RESOLUTION / THREE-WAY</span><h2>{shortPath(file)}</h2><small>{file}</small></div></div><div className="merge-top-actions"><span className="merge-stage-badge"><AlertTriangle size={13}/> UNRESOLVED</span><button className="merge-close" onClick={onClose} disabled={saving} aria-label="Close conflict editor"><X size={18}/></button></div></div>
  <div className="merge-intro"><div className="merge-intro-symbol"><Layers3 size={20}/></div><div><strong>Choose what the merged file should contain.</strong><p>Compare the common ancestor with both branches. Your resolution is written and staged only when you explicitly confirm it.</p></div><ShieldCheck size={21}/></div>
  {loading?<div className="merge-loading"><LoaderCircle className="spin" size={26}/> Reading Git's unmerged index versions...</div>:!conflict?<div className="merge-loading merge-failure"><AlertTriangle size={24}/>{error||"Unable to read conflict."}</div>:<>
   <div className="merge-columns">
    <CodePane title="Common ancestor" subtitle="BASE · stage 1" text={conflict.base} tone="baseline"/>
    <CodePane title="Your branch" subtitle="OURS · stage 2" text={conflict.ours} tone="our-version"/>
    <CodePane title="Incoming branch" subtitle="THEIRS · stage 3" text={conflict.theirs} tone="their-version"/>
   </div>
   <section className="merge-editor"><div className="merge-editor-head"><div><span className="merge-edit-icon"><FileDiff size={17}/></span><span><b>Resolution output</b><small>Exactly this content will be written to the working file when using manual resolution.</small></span></div><div className="merge-choose"><button onClick={()=>choose("ours")} disabled={conflict.ours===null} className={choice==="ours"?"selected ours":""}><ChevronRight size={14}/> Use ours</button><button onClick={()=>choose("theirs")} disabled={conflict.theirs===null} className={choice==="theirs"?"selected theirs":""}><ChevronRight size={14}/> Use theirs</button></div></div><textarea spellCheck={false} value={draft} onChange={e=>{setDraft(e.target.value);setChoice("manual");}} aria-label="Manual resolution editor" className="merge-editor-text" /><div className="merge-editor-foot"><span>{draft.split("\n").length} lines · {new TextEncoder().encode(draft).length} bytes</span><span>{choice==="manual"?"CUSTOM MANUAL RESOLUTION":choice==="ours"?"USING YOUR BRANCH":"USING INCOMING BRANCH"}</span></div></section>
   {error&&<div className="merge-error"><AlertTriangle size={15}/><span>{error}</span></div>}
   <div className="merge-bottom"><span><ShieldCheck size={16}/> No changes are applied until you click Resolve and stage.</span><div><button className="merge-cancel" disabled={saving} onClick={onClose}>Cancel</button><button className="merge-confirm" disabled={saving||!changed} onClick={()=>void save()}>{saving?<LoaderCircle className="spin" size={17}/>:<Check size={17}/>} Resolve and stage <ArrowRight size={15}/></button></div></div>
  </>}
 </div>
 </div>;
}
