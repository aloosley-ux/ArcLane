import {useEffect,useState} from "react";
import {GitCommitHorizontal,LoaderCircle,X} from "lucide-react";
import {client} from "./api";
import type {CommitDefaults} from "./types";
import "./workflow.css";

export default function CommitOptions({path,message,busy,onSave,onClose}:{path:string;message:string;busy:boolean;onSave:(input:string)=>Promise<boolean>;onClose:()=>void}){
 const[context,setContext]=useState<CommitDefaults|null>(null),[error,setError]=useState("");
 const[text,setText]=useState(message),[amend,setAmend]=useState(false),[confirmed,setConfirmed]=useState(false);
 const[customAuthor,setCustomAuthor]=useState(false),[name,setName]=useState(""),[email,setEmail]=useState(""),[coauthors,setCoauthors]=useState("");
 useEffect(()=>{let alive=true;client.commitContext(path).then(data=>{if(!alive)return;const c=data as CommitDefaults;setContext(c);setName(c.name);setEmail(c.email);}).catch(e=>{if(alive)setError(String(e))});return()=>{alive=false}},[path]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!busy)onClose()};document.addEventListener("keydown",key);return()=>document.removeEventListener("keydown",key)},[busy,onClose]);
 const save=async()=>{if(!context)return;const ok=await onSave(JSON.stringify({message:text,expectedHead:context.head,amend,confirmed,authorName:customAuthor?name:"",authorEmail:customAuthor?email:"",coauthors:coauthors.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}));if(ok)onClose()};
 return <div className="modal-backdrop"><section className="modal workflow-modal" role="dialog" aria-modal="true" aria-label="Commit options">
  <div className="modal-top"><GitCommitHorizontal size={20}/><button className="icon-btn" aria-label="Close commit options" disabled={busy} onClick={onClose}><X size={18}/></button></div>
  <h2>Commit options</h2><p>Commit the current staging area. Unstaged files remain in the working tree. Git hooks remain enabled.</p>
  {!context&&!error&&<p><LoaderCircle className="spin" size={14}/> Reading commit context…</p>}{error&&<p role="alert" className="workflow-error">{error}</p>}
  <fieldset disabled={!context||busy} className="workflow-fieldset"><label className="workflow-check"><input type="checkbox" checked={amend} disabled={!context?.head||busy} onChange={e=>{const next=e.target.checked;setAmend(next);setConfirmed(false);setText(next?context?.last?.message||"":message);}}/> Amend previous commit {context?.head?.slice(0,8)}</label>
  {amend&&<div className="workflow-warning"><p>This rewrites the previous commit and changes its hash. {context?.last?.remoteRefs.length?"This commit is reachable from remote-tracking references: "+context.last.remoteRefs.join(", ")+". Coordinate with collaborators before publishing.":"Remote-tracking references do not show this commit as shared; this does not prove it is unpublished."}</p><label className="workflow-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I understand this rewrites history</label></div>}
  <label className="field-label" htmlFor="full-message">Commit message</label><textarea id="full-message" autoFocus value={text} onChange={e=>setText(e.target.value)} rows={6}/>
  <label className="workflow-check"><input type="checkbox" checked={customAuthor} onChange={e=>setCustomAuthor(e.target.checked)}/> Override author for this commit</label>
  {customAuthor&&<div className="workflow-fields"><label>Author name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Author email<input value={email} onChange={e=>setEmail(e.target.value)}/></label></div>}
  <label className="field-label" htmlFor="coauthors">Co-authors (one Name &lt;email&gt; per line)</label><textarea id="coauthors" value={coauthors} onChange={e=>setCoauthors(e.target.value)} rows={2}/>
  </fieldset><div className="dialog-actions"><button className="quiet-btn" disabled={busy} onClick={onClose}>Cancel</button><button className="dialog-confirm" disabled={!context||busy||!text.trim()||(amend&&!confirmed)||(customAuthor&&(!name.trim()||!email.includes("@")))} onClick={()=>void save()}>{busy?<LoaderCircle size={15} className="spin"/>:null}{amend?"Amend commit":"Commit staged changes"}</button></div>
 </section></div>
}
