import {useMemo,useState} from "react";
import {ArrowDown,ArrowUp,Check,GitCommitHorizontal,Plus,Search,ShieldAlert,X} from "lucide-react";
import type {Commit} from "./types";
import "./cherry-pick-series.css";

type Pick={sha:string;subject:string;parents:string[]};
export default function CherryPickSeries({head,commits,initial,onApply,onClose}:{
 head:string;commits:Commit[];initial?:string;onApply:(commits:string[])=>Promise<boolean>;onClose:()=>void;
}){
 const indexed=useMemo(()=>new Map(commits.map(c=>[c.sha,c])),[commits]);
 const [chosen,setChosen]=useState<Pick[]>(()=>{
  const found=commits.find(c=>c.sha===initial);
  return found&&found.parents.length<2?[found]:[];
 });
 const [search,setSearch]=useState("");
 const [manual,setManual]=useState("");
 const [working,setWorking]=useState(false);
 const [error,setError]=useState("");
 const [confirmed,setConfirmed]=useState(false);
 const add=(sha:string)=>{
  const commit=indexed.get(sha);
  if(chosen.some(c=>c.sha===sha)||chosen.length>=32)return;
  if(commit&&commit.parents.length>1){setError("Merge commits need a mainline parent and cannot be used in this series.");return;}
  setChosen(list=>[...list,{sha,subject:commit?.subject||"Commit outside loaded history",parents:commit?.parents||[]}]);
  setError("");setConfirmed(false);
 };
 const remove=(sha:string)=>{setChosen(list=>list.filter(c=>c.sha!==sha));setConfirmed(false);};
 const move=(index:number,delta:number)=>{
  setChosen(list=>{const next=[...list];const target=index+delta;if(target<0||target>=next.length)return list;[next[index],next[target]]=[next[target],next[index]];return next;});setConfirmed(false);
 };
 const addManual=()=>{
  const sha=manual.trim();
  if(!/^[a-fA-F0-9]{7,40}$/.test(sha)){setError("Enter a 7–40 character hexadecimal Git commit SHA.");return;}
  const matched=commits.find(c=>c.sha.startsWith(sha.toLowerCase()))?.sha||sha;
  add(matched);setManual("");
 };
 const submit=async()=>{
  if(working||!chosen.length||!confirmed)return;
  setWorking(true);setError("");
  try{await onApply(chosen.map(c=>c.sha));onClose();}
  catch(e){setError(String(e));}
  finally{setWorking(false);}
 };
 const available=commits.filter(c=>c.sha!==head&&c.parents.length<2&&!chosen.some(x=>x.sha===c.sha)&&
  (c.sha.includes(search.trim().toLowerCase())||c.subject.toLowerCase().includes(search.trim().toLowerCase()))).slice(0,100);
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!working)onClose();}}>
  <section className="modal pick-series" role="dialog" aria-modal="true" aria-label="Cherry-pick a commit sequence">
   <div className="modal-top"><span className="modal-icon"><GitCommitHorizontal size={22}/></span><button className="quiet-btn" onClick={onClose} disabled={working} aria-label="Close sequence editor"><X size={16}/></button></div>
   <h2>Cherry-pick a sequence</h2>
   <p>Select up to 32 non-merge commits. Their order on the right is the exact order Git will apply them. HEAD must still be <code>{head.slice(0,10)}</code> when the operation starts.</p>
   <div className="pick-columns">
    <div className="pick-column"><label><Search size={14}/> Find commits<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Message or SHA"/></label>
     <div className="pick-entries" role="list" aria-label="Available commits">{available.map(c=><button key={c.sha} type="button" disabled={working||chosen.length>=32} onClick={()=>add(c.sha)}><Plus size={14}/><span title={c.subject}>{c.subject}</span><code>{c.sha.slice(0,8)}</code></button>)}</div>
     <div className="pick-manual"><input aria-label="Commit SHA to add" value={manual} onChange={e=>setManual(e.target.value)} placeholder="Paste another SHA" onKeyDown={e=>{if(e.key==="Enter")addManual();}}/><button className="quiet-btn" onClick={addManual} disabled={working}>Add</button></div>
    </div>
    <div className="pick-column"><strong className="pick-heading">Application order <span>{chosen.length}/32</span></strong>
     <div className="pick-entries pick-selected" aria-label="Selected commit order">{chosen.map((c,i)=><div className="pick-entry" key={c.sha}><span className="pick-index">{i+1}</span><span title={c.subject}>{c.subject}</span><code>{c.sha.slice(0,8)}</code><button aria-label={"Move "+c.sha.slice(0,8)+" earlier"} onClick={()=>move(i,-1)} disabled={working||i===0}><ArrowUp size={13}/></button><button aria-label={"Move "+c.sha.slice(0,8)+" later"} onClick={()=>move(i,1)} disabled={working||i===chosen.length-1}><ArrowDown size={13}/></button><button aria-label={"Remove "+c.sha.slice(0,8)} onClick={()=>remove(c.sha)} disabled={working}><X size={14}/></button></div>)}{chosen.length===0&&<div className="pick-empty">Choose commits on the left to build the sequence.</div>}</div>
    </div>
   </div>
   <div className="pick-warning"><ShieldAlert size={17}/><span>Rewrites local history on this branch. ArcLane refuses a dirty tree or changed HEAD. Conflicts pause Git; resolve, continue or abort using the existing recovery banner.</span></div>
   <label className="pick-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={working||!chosen.length}/> I have reviewed the commits and their exact order.</label>
   {error&&<p role="alert" className="pick-error">{error}</p>}
   <div className="dialog-actions"><button className="quiet-btn" onClick={onClose} disabled={working}>Cancel</button><button className="dialog-confirm" onClick={()=>void submit()} disabled={!chosen.length||!confirmed||working}><Check size={14}/>{working?"Applying…":"Cherry-pick "+chosen.length+" commit"+(chosen.length===1?"":"s")}</button></div>
  </section>
 </div>;
}
