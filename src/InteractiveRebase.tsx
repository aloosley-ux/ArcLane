import {useEffect,useMemo,useState} from "react";
import {ArrowDown,ArrowUp,Check,GitFork,LoaderCircle,ShieldAlert,X} from "lucide-react";
import {client} from "./api";
import type {RebasePreview,RebaseStep} from "./types";
import "./interactive-rebase.css";

export default function InteractiveRebase({path,base,onApply,onClose}:{
 path:string;clamp?:never;base:string;
 onApply:(base:string,head:string,steps:RebaseStep[])=>Promise<boolean>;
 onClose:()=>void;
}){
 const [preview,setPreview]=useState<RebasePreview|null>(null);
 const [steps,setSteps]=useState<RebaseStep[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [confirmed,setConfirmed]=useState(false);
 useEffect(()=>{
  let current=true;
  setLoading(true);
  void client.rebasePreview(path,base).then(result=>{
   if(!current)return;
   setPreview(result);
   setSteps(result.commits.map(item=>({...item,action:"pick",message:""})));
   setError("");
  }).catch(e=>{if(current)setError(String(e));}).finally(()=>{if(current)setLoading(false);});
  return()=>{current=false;};
 },[path,base]);
 const swap=(i:number,diff:number)=>{
  setSteps(rows=>{
   const pos=i+diff;
   if(pos<0||pos>=rows.length)return rows;
   const next=[...rows];[next[i],next[pos]]=[next[pos],next[i]];return next;
  });setConfirmed(false);
 };
 const edit=(i:number,patch:Partial<RebaseStep>)=>{
  setSteps(rows=>rows.map((row,n)=>n===i?{...row,...patch}:row));setConfirmed(false);
 };
 const validation=useMemo(()=>{
  if(!preview||!steps.length)return "No commits available for the selected base.";
  let hasRetained=false;
  for(const step of steps){
   if(step.action==="squash"&&!hasRetained)return "Squash must follow a retained commit.";
   if(step.action!=="drop")hasRetained=true;
   if((step.action==="reword"||step.action==="squash")&&!step.message.trim())return "Enter a commit message for each reword or squash action.";
  }
  if(!hasRetained)return "Dropping every commit is not supported. Use the guarded reset workflow.";
  return "";
 },[steps,preview]);
 const submit=async()=>{
  if(!preview||validation||!confirmed||busy)return;
  setBusy(true);setError("");
  try{await onApply(preview.base,preview.head,steps);onClose();}
  catch(e){setError(String(e));}
  finally{setBusy(false);}
 };
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
  <section className="modal interactive-rebase" role="dialog" aria-modal="true" aria-label="Interactive rebase">
   <header className="modal-top"><span className="modal-icon"><GitFork size={22}/></span><button className="quiet-btn" aria-label="Close interactive rebase" disabled={busy} onClick={onClose}><X size={16}/></button></header>
   <h2>Interactive rebase</h2>
   <p>Rewrite the linear commits after your selected base. Reorder or pick, reword, squash and drop commits. ArcLane uses Git's native rebase sequencer and preserves the plan if conflicts pause progress.</p>
   {preview&&<div className="rebase-range"><span>Branch <b>{preview.branch}</b></span><span>Base <code>{preview.base.slice(0,10)}</code></span><span>Starting HEAD <code>{preview.head.slice(0,10)}</code></span></div>}
   {loading?<div className="rebase-loading"><LoaderCircle size={16} className="spin"/> Checking the commit range…</div>:preview&&<div className="rebase-steps" role="list" aria-label="Rebase todo list">{steps.map((step,index)=><div role="listitem" className={"rebase-step"+(step.action==="drop"?" removed":"")} key={step.sha}>
      <span className="rebase-step-number">{index+1}</span>
      <div className="rebase-step-main"><div className="rebase-step-heading"><strong title={step.subject}>{step.subject}</strong><code>{step.sha.slice(0,8)}</code></div>
       {(step.action==="reword"||step.action==="squash")&&<textarea rows={2} aria-label={"New message for "+step.sha.slice(0,8)} value={step.message} maxLength={10000} placeholder={step.action==="squash"?"Final combined commit message":"New commit message"} onChange={e=>edit(index,{message:e.target.value})}/>}
      </div>
      <select aria-label={"Action for "+step.sha.slice(0,8)} value={step.action} disabled={busy} onChange={e=>edit(index,{action:e.target.value as RebaseStep["action"]})}>
       <option value="pick">Pick</option><option value="reword">Reword</option><option value="squash">Squash</option><option value="drop">Drop</option>
      </select>
      <div className="rebase-order"><button disabled={busy||index===0} aria-label={"Move "+step.sha.slice(0,8)+" up"} onClick={()=>swap(index,-1)}><ArrowUp size={14}/></button><button disabled={busy||index===steps.length-1} aria-label={"Move "+step.sha.slice(0,8)+" down"} onClick={()=>swap(index,1)}><ArrowDown size={14}/></button></div>
     </div>)}</div>}
   <div className="pick-warning"><ShieldAlert size={17}/><span>History hashes will change. Do not rewrite work already shared with other people. Git refuses dirty trees and changed HEAD; conflicts can be continued or aborted through the existing recovery controls.</span></div>
   {validation&&!loading&&preview&&<p role="alert" className="rebase-validation">{validation}</p>}
   {error&&<p role="alert" className="rebase-validation">{error}</p>}
   <label className="pick-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={busy||loading||!!validation}/> I have reviewed the complete rebase plan and the history rewrite.</label>
   <footer className="dialog-actions"><button className="quiet-btn" disabled={busy} onClick={onClose}>Cancel</button><button className="dialog-confirm" disabled={busy||!!validation||!confirmed||loading} onClick={()=>void submit()}><Check size={14}/>{busy?"Rebasing…":"Run interactive rebase"}</button></footer>
  </section>
 </div>;
}
