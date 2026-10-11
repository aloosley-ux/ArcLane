import {useEffect,useState} from "react";
import {ArrowLeftRight,FileDiff,LoaderCircle,Undo2,X} from "lucide-react";
import {client} from "./api";
import PatchDiff from "./PatchDiff";
import SideBySideDiff from "./SideBySideDiff";
import MediaDiff from "./MediaDiff";
import type {Commit,CommitDefaults,Ref,RevisionReview} from "./types";
import "./workflow.css";

export default function RevisionReviewPanel({path,to,from=null,refs,commits,busy,onSave,onClose}:{path:string;to:string;from?:string|null;refs:Ref[];commits:Commit[];busy:boolean;onSave:(input:string)=>Promise<boolean>;onClose:()=>void}){
 const[target,setTarget]=useState(to),[source,setSource]=useState(from||"");
 const[data,setData]=useState<RevisionReview|null>(null),[file,setFile]=useState<string|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const[head,setHead]=useState<string|null>(null),[selected,setSelected]=useState<string[]>([]),[confirm,setConfirm]=useState(false),[ack,setAck]=useState(false),[mode,setMode]=useState<"side"|"patch">("side");
 useEffect(()=>{let alive=true;client.commitContext(path).then(c=>{if(alive)setHead((c as CommitDefaults).head)}).catch(e=>{if(alive)setError(String(e))});return()=>{alive=false}},[path]);
 useEffect(()=>{let alive=true;setLoading(true);setError("");setData(null);client.reviewRevisions(path,source||null,target,file).then(d=>{if(alive)setData(d)}).catch(e=>{if(alive)setError(String(e))}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[path,source,target,file]);
 useEffect(()=>{setSelected([]);setConfirm(false);setAck(false);setFile(null)},[source,target]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!busy){e.preventDefault();onClose()}};document.addEventListener("keydown",key);return()=>document.removeEventListener("keydown",key)},[busy,onClose]);
 const options=[...refs.map(r=>({value:r.full,label:r.name})),...commits.map(c=>({value:c.sha,label:c.sha.slice(0,8)+" · "+c.subject}))];
 if(!options.some(o=>o.value===target))options.push({value:target,label:target.slice(0,8)});
 if(source&&!options.some(o=>o.value===source))options.push({value:source,label:source.slice(0,8)});
 const restore=async()=>{if(!data||!head)return;const ok=await onSave(JSON.stringify({sha:data.to,expectedHead:head,files:selected,confirmed:ack}));if(ok){setConfirm(false);setSelected([]);setAck(false)}};
 return <div className="diff-expand-overlay"><section className="diff-expand-frame revision-frame" role="dialog" aria-modal="true" aria-label="Revision review">
  <header className="diff-expand-heading"><span><ArrowLeftRight size={18}/><strong>Revision review</strong><small>Tree comparison · index preserved on restore</small></span><button aria-label="Close revision review" disabled={busy} onClick={onClose}><X size={18}/></button></header>
  <div className="revision-controls"><label>From<select aria-label="Comparison base" value={source} onChange={e=>setSource(e.target.value)}><option value="">First parent / empty tree</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label><span>→</span><label>To<select aria-label="Comparison target" value={target} onChange={e=>setTarget(e.target.value)}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label><button className="outline-action" disabled={!source||loading} onClick={()=>{setSource(target);setTarget(source)}}>Swap</button></div>
  <div className="revision-body"><aside className="revision-sidebar">
   {data&&<><div className="revision-metadata"><b>{data.details.message.split('\n')[0]}</b><dl><dt>Author</dt><dd>{data.details.author} &lt;{data.details.authorEmail}&gt;</dd><dt>Authored</dt><dd>{data.details.authorDate}</dd><dt>Committer</dt><dd>{data.details.committer} &lt;{data.details.committerEmail}&gt;</dd><dt>Committed</dt><dd>{data.details.committerDate}</dd><dt>Signature</dt><dd>{({N:"Unsigned",G:"Good",B:"Bad",U:"Good, untrusted",E:"Cannot verify",X:"Expired",Y:"Expired key",R:"Revoked key"} as Record<string,string>)[data.details.signature]||data.details.signature}</dd><dt>Parents</dt><dd>{data.details.parents.length?data.details.parents.map(p=><button key={p} onClick={()=>{setSource("");setTarget(p)}} title={p}>{p.slice(0,8)}</button>):"Root commit"}</dd></dl><pre>{data.details.message}</pre></div>
   <div className="revision-list-heading"><FileDiff size={14}/>{data.files.length} changed files <button onClick={()=>setFile(null)}>All changes</button></div>
   <div className="revision-files">{data.files.map(f=><div key={f.path} className={"revision-file"+(file===f.path?" selected":"")}><input type="checkbox" aria-label={"Select restore "+f.path} checked={selected.includes(f.path)} disabled={f.status==="D"||busy||loading} onChange={e=>setSelected(s=>e.target.checked?[...s,f.path]:s.filter(x=>x!==f.path))}/><button onClick={()=>setFile(f.path)} title={f.path}><span>{f.status}</span>{f.path}</button></div>)}</div></>}
   <div className="revision-restore"><button className="outline-action" disabled={!selected.length||!head||busy||loading} onClick={()=>{setConfirm(true);setAck(false)}}><Undo2 size={14}/>Restore {selected.length||"selected"} file(s)</button><small>Restores source bytes to the working tree. Staged bytes stay intact.</small></div>
  </aside><div className="revision-preview"><div className="revision-preview-heading"><span>{file||"All changed files"}</span><small>{data?.from?.slice(0,8)||"Empty tree"} → {data?.to.slice(0,8)}</small>{file&&data?.comparison&&<button aria-pressed={mode==="side"} onClick={()=>setMode(m=>m==="side"?"patch":"side")}>{mode==="side"?"Show patch":"Side by side"}</button>}</div>
   {loading?<div className="revision-wait"><LoaderCircle className="spin" size={20}/>Reading Git trees…</div>:data?.media&&file?<MediaDiff media={data.media}/>:data&&file&&data.comparison&&mode==="side"?<SideBySideDiff comparison={data.comparison}/>:<PatchDiff text={data?.patch||"No changes between these revisions."} label="Revision patch"/>}
   {data?.comparisonError&&!data.media&&<div className="revision-note">{data.comparisonError}. Patch remains available.</div>}{error&&<div role="alert" className="revision-note workflow-error">{error}</div>}
  </div></div>
  {confirm&&<div className="revision-confirm"><strong>Restore {selected.length} historical file(s)?</strong><p>{selected.join(", ")}</p><label className="workflow-check"><input type="checkbox" checked={ack} disabled={busy} onChange={e=>setAck(e.target.checked)}/>Overwrite the selected working files with revision {data?.to.slice(0,8)}; preserve the index</label><button className="quiet-btn" disabled={busy} onClick={()=>setConfirm(false)}>Cancel restore</button><button className="dialog-confirm" disabled={!ack||busy} onClick={()=>void restore()}>Confirm historical restore</button></div>}
 </section></div>
}
