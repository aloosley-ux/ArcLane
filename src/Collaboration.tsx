import{useEffect,useMemo,useRef,useState}from "react";
import{Activity,ArrowRight,Check,ChevronDown,ChevronRight,CircleDot,Cloud,Code2,ExternalLink,FileDiff,GitBranch,GitFork,GitMerge,GitPullRequest,GitPullRequestArrow,GitCommitHorizontal,Layers3,LoaderCircle,MessageSquare,Plus,RefreshCw,Search,ShieldAlert,ShieldCheck,Trash2,Users,X}from "lucide-react";
import ProviderReadDetails from "./ProviderReadDetails";
import{client}from "./api";
import{buildPrStacks,type StackPr}from "./pr-stack";
import "./collaboration.css";

type Page="prs"|"issues"|"stacks"|"runs";
type Person={login:string};
type Label={name:string;color?:string};
type Pr=StackPr&{isDraft:boolean;url:string;body?:string;reviewDecision?:string;mergeable?:string;mergeStateStatus?:string;author?:Person;labels?:Label[];files?:{path:string;additions:number;deletions:number}[];commits?:{oid:string;messageHeadline?:string}[];reviews?:{author?:Person;body:string;state:string}[];comments?:{author?:Person;body:string}[];statusCheckRollup?:{name?:string;status?:string;conclusion?:string}[]};
type Issue={number:number;title:string;body?:string;state:string;url:string;updatedAt:string;author?:Person;labels?:Label[];assignees?:Person[];comments?:{author?:Person;body:string}[]};
type Run={databaseId:number;displayTitle:string;workflowName:string;status:string;conclusion?:string;headBranch:string;updatedAt:string;url:string};
type Modal={operation:string;target:string;title:string;message:string;confirm:string;detail:Record<string,unknown>;editable?:boolean};
const ago=(date:string)=>{const days=Math.floor((Date.now()-new Date(date).getTime())/86400000);return days<=0?"Today":days===1?"Yesterday":days<30?days+"d ago":new Date(date).toLocaleDateString("en-GB",{day:"2-digit",month:"short"});};
const safe=(v:string,n=110)=>v.length>n?v.slice(0,n)+"…":v;
const checkStatus=(checks:Pr["statusCheckRollup"])=>{const list=checks||[];const fails=list.filter(x=>x.conclusion==="FAILURE");const good=list.filter(x=>x.conclusion==="SUCCESS");return list.length?fails.length?fails.length+" failing":good.length+"/"+list.length+" passing":"Not checked"};
export default function Collaboration({path,refreshSignal=0}:{path:string;refreshSignal?:number}){
 const[providerRead,setProviderRead]=useState<{kind:"pr_diff"|"run";id:string}|null>(null);
 const feedRequests=useRef<string[]>([]),detailRequest=useRef<string|null>(null);
 const cancelReads=()=>{const ids=[...feedRequests.current,...(detailRequest.current?[detailRequest.current]:[])];void Promise.all(ids.map(id=>client.cancelProviderRead(path,id))).catch(e=>setError(String(e)))};
 const[page,setPage]=useState<Page>("prs");
 const[prs,setPrs]=useState<Pr[]>([]);
 const[issues,setIssues]=useState<Issue[]>([]);
 const[runs,setRuns]=useState<Run[]>([]);
 const[selected,setSelected]=useState<{type:"pr"|"issue";id:number}|null>(null);
 const[detail,setDetail]=useState<Pr|Issue|null>(null);
 const[busy,setBusy]=useState(false);
 const[detailsBusy,setDetailsBusy]=useState(false);
 const[error,setError]=useState("");
 const[notice,setNotice]=useState("");
 const[query,setQuery]=useState("");
 const[refresh,setRefresh]=useState(0);
 const[modal,setModal]=useState<Modal|null>(null);
 const[typed,setTyped]=useState("");
 const[body,setBody]=useState("");
 const[title,setTitle]=useState("");
 const[base,setBase]=useState("main");
 const[assignee,setAssignee]=useState("");
 const[strategy,setStrategy]=useState("squash");
 const[draft,setDraft]=useState(true);
 useEffect(()=>{
   let active=true;setBusy(true);setError("");const ids=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];feedRequests.current=ids;
   void Promise.allSettled([client.collabQuery(path,"prs",null,ids[0]),client.collabQuery(path,"issues",null,ids[1]),client.collabQuery(path,"runs",null,ids[2])]).then(results=>{
     if(!active)return;
     setPrs(results[0].status==="fulfilled"?results[0].value as Pr[]:[]);
     setIssues(results[1].status==="fulfilled"?results[1].value as Issue[]:[]);
     setRuns(results[2].status==="fulfilled"?results[2].value as Run[]:[]);
     const failures=results.flatMap((r,i)=>r.status==="rejected"?[["PRs","Issues","CI"][i]+": "+String(r.reason)]:[]);
     if(failures.length)setError(failures.join("\n"));
   }).finally(()=>{if(active){setBusy(false);feedRequests.current=[]}});
   return()=>{active=false;for(const id of ids)void client.cancelProviderRead(path,id).catch(()=>{});};
 },[path,refresh,refreshSignal]);
 useEffect(()=>{
   if(!selected){setDetail(null);setDetailsBusy(false);return;}
   let active=true;setDetailsBusy(true);setDetail(null);const request=crypto.randomUUID();detailRequest.current=request;
   void client.collabQuery(path,selected.type,String(selected.id),request).then(value=>{if(active)setDetail(value as Pr|Issue)}).catch(e=>{if(active)setError(String(e))}).finally(()=>{if(active){setDetailsBusy(false);detailRequest.current=null}});
   return()=>{active=false;void client.cancelProviderRead(path,request).catch(()=>{});};
 },[path,selected,refresh]);
 const stacks=useMemo(()=>buildPrStacks(prs),[prs]);
 const filteredPrs=useMemo(()=>prs.filter(p=>[p.title,p.headRefName,p.baseRefName,String(p.number)].some(s=>s.toLowerCase().includes(query.toLowerCase()))),[prs,query]);
 const filteredIssues=useMemo(()=>issues.filter(p=>[p.title,String(p.number),p.body||""].some(s=>s.toLowerCase().includes(query.toLowerCase()))),[issues,query]);
 const openModal=(next:Modal)=>{setTitle("");setBody("");setTyped("");setAssignee("");setModal(next);};
 const apply=async()=>{
   if(!modal||typed!==modal.confirm||busy)return;
   setBusy(true);setError("");
   try{
     let detail=modal.detail;
     if(modal.operation==="pr_create"){detail={title,body,base,draft};}
     if(modal.operation==="issue_create"){detail={title,body};}
     if(["pr_comment","pr_review","issue_comment"].includes(modal.operation)){detail={...detail,body};}
     if(modal.operation==="pr_merge"){detail={method:strategy};}
     if(modal.operation==="issue_assign"){detail={assignee};}
     if(modal.operation==="issue_worktree"){
       const parent=await client.pick();
       if(!parent){setBusy(false);return;}
       const number=modal.target;
       const label=(modal.detail.title||"task").toString().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,28);
       const name="issue/"+number+"-"+(label||"work");
       const target=parent.replace(/[\\/]+$/,"")+"\\"+name.replaceAll("/","-");
       const result=await client.action(path,"worktree_add",target,name);
       setNotice(result.output||"Created issue worktree at "+target);
     }else{
       const result=await client.collabAction(path,modal.operation,modal.target,detail);
       setNotice(result.output||modal.title+" completed");
     }
     setModal(null);setRefresh(x=>x+1);
   }catch(e){setError(String(e));}
   finally{setBusy(false);}
 };
 const select=(type:"pr"|"issue",id:number)=>setSelected({type,id});
 const button=(label:string,handler:()=>void,danger=false)=><button className={"collab-action"+(danger?" danger":"")} onClick={handler}>{label}</button>;
 const openUrl=(url:string)=>void client.openExternal(url).catch(e=>setError(String(e)));
 const selectedPr=selected?.type==="pr"&&detail?detail as Pr:null;
 const selectedIssue=selected?.type==="issue"&&detail?detail as Issue:null;
 return <div className="collab">
 <div className="collab-hero"><div><span className="collab-kicker">GITHUB / LOCAL CLIENT BRIDGE</span><h2><GitPullRequestArrow size={23}/> Collaboration</h2><p>Reviews, issues, CI and stacked pull requests. Your existing GitHub CLI authentication, on demand.</p></div>{(busy||detailsBusy)&&(feedRequests.current.length>0||detailRequest.current)&&<button onClick={cancelReads}>Cancel GitHub reads</button>}<button onClick={()=>setRefresh(n=>n+1)} disabled={busy}><RefreshCw size={15}/> Refresh GitHub</button></div>
 <div className="collab-tabs"><button className={page==="prs"?"selected":""} onClick={()=>{setPage("prs");setQuery("");}}><GitPullRequest size={16}/> Pull requests <span>{prs.length}</span></button><button className={page==="stacks"?"selected":""} onClick={()=>{setPage("stacks");setQuery("");}}><Layers3 size={16}/> PR stacks <span>{stacks.filter(g=>g.entries.length>1).length}</span></button><button className={page==="issues"?"selected":""} onClick={()=>{setPage("issues");setQuery("");}}><CircleDot size={16}/> Issues <span>{issues.length}</span></button><button className={page==="runs"?"selected":""} onClick={()=>{setPage("runs");setQuery("");}}><Activity size={16}/> CI runs <span>{runs.length}</span></button></div>
 <div className="collab-content">
 <div className="collab-list-panel"><div className="collab-list-top"><div><strong>{page==="prs"?"Pull requests":page==="stacks"?"Stacked changes":page==="issues"?"Issues":"Workflow runs"}</strong><small>{page==="stacks"?"Mapped by PR head/base branch":page==="runs"?"Live CI from GitHub":"Open and historical items"}</small></div>{["prs","issues"].includes(page)&&<button title={"Create "+(page==="prs"?"pull request":"issue")} onClick={()=>openModal({operation:page==="prs"?"pr_create":"issue_create",title:page==="prs"?"Create pull request":"Create GitHub issue",target:"",message:"This creates a new item on GitHub using your authenticated account.",confirm:"CREATE",detail:{}})}><Plus size={16}/></button>}</div>{page!=="stacks"&&page!=="runs"&&<label className="collab-search"><Search size={14}/><input aria-label="Filter collaboration entries" placeholder="Filter titles, branch, number…" value={query} onChange={e=>setQuery(e.target.value)}/></label>}
 <div className="collab-list-scroll">
 {page==="prs"&&filteredPrs.map(p=><button key={p.number} className={"collab-item"+(selected?.type==="pr"&&selected.id===p.number?" chosen":"")} onClick={()=>select("pr",p.number)}><span className="collab-item-icon"><GitPullRequest size={17}/></span><span className="collab-item-text"><strong>{p.title}</strong><small>#{p.number} · {p.headRefName} → {p.baseRefName}</small><span className="collab-meta"><span>{p.state||"OPEN"}</span><span>{p.isDraft?"Draft":"Ready"}</span><span>{checkStatus(p.statusCheckRollup)}</span></span></span><ChevronRight size={15}/></button>)}
 {page==="issues"&&filteredIssues.map(issue=><button key={issue.number} className={"collab-item"+(selected?.type==="issue"&&selected.id===issue.number?" chosen":"")} onClick={()=>select("issue",issue.number)}><span className="collab-item-icon issue"><CircleDot size={17}/></span><span className="collab-item-text"><strong>{issue.title}</strong><small>#{issue.number} · {issue.author?.login||"Unknown author"}</small><span className="collab-meta">{issue.state} · {ago(issue.updatedAt)}</span></span><ChevronRight size={15}/></button>)}
 {page==="stacks"&&stacks.map(g=><section key={g.id} className="collab-stack"><div className="collab-stack-heading"><Layers3 size={15}/><b>{g.entries.length>1?g.entries.length+"-PR stack":"Standalone PR"}</b><small>base: {g.base}</small></div>{g.entries.map(entry=><button key={entry.pr.number} className="collab-stack-entry" style={{paddingLeft:14+entry.depth*17}} onClick={()=>select("pr",entry.pr.number)}><span className="collab-stack-spine"/><span><GitBranch size={15}/></span><div><strong>#{entry.pr.number} {entry.pr.title}</strong><small>{entry.pr.headRefName} → {entry.pr.baseRefName}</small></div><span className="collab-stack-state">{entry.pr.state||"OPEN"}</span></button>)}</section>)}
 {page==="runs"&&runs.map(run=><button key={run.databaseId} className="collab-item" onClick={()=>setProviderRead({kind:"run",id:String(run.databaseId)})}><span className="collab-item-icon run"><Activity size={16}/></span><span className="collab-item-text"><strong>{run.displayTitle}</strong><small>{run.workflowName} · {run.headBranch}</small><span className="collab-meta">{run.conclusion||run.status} · {ago(run.updatedAt)}</span></span><ChevronRight size={15}/></button>)}
 {busy&&prs.length===0&&<div className="collab-empty"><LoaderCircle className="spin" size={24}/> Contacting GitHub...</div>}
 {!busy&&((page==="prs"&&!filteredPrs.length)||(page==="issues"&&!filteredIssues.length)||(page==="stacks"&&!stacks.length)||(page==="runs"&&!runs.length))&&<div className="collab-empty">No items returned in this section.</div>}
 </div></div>
 <div className="collab-detail">
 {detailsBusy?<div className="collab-empty"><LoaderCircle className="spin" size={25}/> Fetching details…</div>:selectedPr?<><header className="collab-detail-head"><span><GitPullRequest size={17}/> PULL REQUEST · #{selectedPr.number}</span><button onClick={()=>setSelected(null)} aria-label="Close collaboration details"><X size={16}/></button></header><div className="collab-detail-scroll"><h2>{selectedPr.title}</h2><div className="collab-pills"><span>{selectedPr.state}</span><span>{selectedPr.isDraft?"DRAFT":"READY"}</span><span>{selectedPr.reviewDecision||"Awaiting reviews"}</span></div><div className="collab-branch-chain"><GitBranch size={14}/><code>{selectedPr.headRefName}</code><ArrowRight size={14}/><code>{selectedPr.baseRefName}</code></div><p className="collab-body">{selectedPr.body||"No description provided."}</p><div className="collab-detail-section"><b><FileDiff size={15}/> Changed files</b><small>{selectedPr.files?.length||0}</small></div>{selectedPr.files?.map(f=><div className="collab-file" key={f.path}><span>{f.path}</span><small>+{f.additions} / -{f.deletions}</small></div>)}<div className="collab-detail-section"><b><MessageSquare size={15}/> Reviews and comments</b></div>{[...(selectedPr.reviews||[]).map(r=>({author:r.author,body:r.body,kind:r.state})),...(selectedPr.comments||[]).map(r=>({...r,kind:"COMMENT"}))].slice(-15).map((r,i)=><div className="collab-comment" key={i}><strong>{r.author?.login||"Contributor"} <small>· {r.kind}</small></strong><p>{safe(r.body||"",400)}</p></div>)}<div className="collab-detail-section"><b><Activity size={15}/> Checks</b></div>{(selectedPr.statusCheckRollup||[]).map((r,i)=><div className="collab-check" key={i}><Activity size={13}/>{r.name||"CI check"}<span>{r.conclusion||r.status||"Pending"}</span></div>)}</div><footer className="collab-detail-actions">{button("Inspect PR diff",()=>setProviderRead({kind:"pr_diff",id:String(selectedPr.number)}))}{button("Open on GitHub",()=>openUrl(selectedPr.url))}{button("Comment",()=>openModal({operation:"pr_comment",target:String(selectedPr.number),title:"Comment on PR",message:"Publish a GitHub PR comment under your account.",confirm:"COMMENT",detail:{},editable:true}))}{button("Approve",()=>openModal({operation:"pr_review",target:String(selectedPr.number),title:"Approve pull request",message:"Publish an approval review on this pull request.",confirm:"APPROVE",detail:{action:"approve"}}))}{button("Request changes",()=>openModal({operation:"pr_review",target:String(selectedPr.number),title:"Request changes",message:"Publish a review requesting changes.",confirm:"REVIEW",detail:{action:"request_changes"},editable:true}))}{button("Merge PR",()=>openModal({operation:"pr_merge",target:String(selectedPr.number),title:"Merge pull request",message:"This modifies the remote GitHub repository. Review the merge method and type MERGE.",confirm:"MERGE",detail:{},editable:true}),true)}</footer></>:selectedIssue?<><header className="collab-detail-head"><span><CircleDot size={17}/> ISSUE · #{selectedIssue.number}</span><button onClick={()=>setSelected(null)} aria-label="Close collaboration details"><X size={16}/></button></header><div className="collab-detail-scroll"><h2>{selectedIssue.title}</h2><div className="collab-pills"><span>{selectedIssue.state}</span><span>{selectedIssue.author?.login||"Contributor"}</span></div><p className="collab-body">{selectedIssue.body||"No description provided."}</p><div className="collab-detail-section"><b><Users size={15}/> Assignees</b></div><div className="collab-tags">{selectedIssue.assignees?.map(p=><span key={p.login}>{p.login}</span>)}</div><div className="collab-detail-section"><b><MessageSquare size={15}/> Discussion</b></div>{(selectedIssue.comments||[]).slice(-20).map((r,i)=><div className="collab-comment" key={i}><strong>{r.author?.login||"Contributor"}</strong><p>{safe(r.body||"",400)}</p></div>)}</div><footer className="collab-detail-actions">{button("Open on GitHub",()=>openUrl(selectedIssue.url))}{button("Comment",()=>openModal({operation:"issue_comment",target:String(selectedIssue.number),title:"Comment on issue",message:"Publish a comment on GitHub.",confirm:"COMMENT",detail:{},editable:true}))}{button("Assign",()=>openModal({operation:"issue_assign",target:String(selectedIssue.number),title:"Assign issue",message:"Assign a GitHub account to this issue.",confirm:"ASSIGN",detail:{},editable:true}))}{button("Create worktree",()=>openModal({operation:"issue_worktree",target:String(selectedIssue.number),title:"Create issue worktree",message:"Choose an existing parent folder after confirming. A new isolated worktree and branch will be created there.",confirm:"WORKTREE",detail:{title:selectedIssue.title}}))}{button(selectedIssue.state==="OPEN"?"Close issue":"Reopen issue",()=>openModal({operation:selectedIssue.state==="OPEN"?"issue_close":"issue_reopen",target:String(selectedIssue.number),title:selectedIssue.state==="OPEN"?"Close issue":"Reopen issue",message:"This changes issue state on GitHub.",confirm:"CHANGE",detail:{}}),true)}</footer></>:<div className="collab-start"><GitPullRequestArrow size={39}/><h2>Work together, without leaving your Git workspace.</h2><p>Choose a PR or issue to inspect its revisions, checks, discussion and available actions. Stacked PR dependencies appear under PR stacks.</p><span><ShieldCheck size={15}/> User-triggered reads and confirmed remote writes only</span></div>}
 </div></div>
 {notice&&<div className="collab-toast success"><Check size={16}/>{safe(notice,260)}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}
 {error&&<details className="collab-diagnostics" open><summary>GitHub request diagnostics</summary><pre>{error}</pre><button onClick={()=>setRefresh(v=>v+1)} disabled={busy}>Retry GitHub reads</button><button onClick={()=>setError("")}>Dismiss diagnostics</button></details>}
 {providerRead&&<ProviderReadDetails key={path+providerRead.kind+providerRead.id} path={path} kind={providerRead.kind} id={providerRead.id} onClose={()=>setProviderRead(null)}/>}
 {modal&&<div className="collab-shade"><div role="dialog" aria-modal="true" aria-label={modal.title} className="collab-modal"><header><ShieldAlert size={21}/><div><small>EXPLICIT GITHUB ACTION</small><h2>{modal.title}</h2></div><button onClick={()=>setModal(null)} aria-label="Cancel GitHub action"><X size={19}/></button></header><p>{modal.message}</p>{["pr_create","issue_create"].includes(modal.operation)&&<><label>Title<input aria-label="New title" value={title} onChange={e=>setTitle(e.target.value)}/></label>{modal.operation==="pr_create"&&<><label>Base branch<input aria-label="Base branch" value={base} onChange={e=>setBase(e.target.value)}/></label><label className="collab-modal-checkbox"><input type="checkbox" checked={draft} onChange={e=>setDraft(e.target.checked)}/> Create as draft</label></>}</>}{modal.operation==="issue_assign"&&<label>GitHub handle<input aria-label="Assignee handle" value={assignee} onChange={e=>setAssignee(e.target.value)} placeholder="username"/></label>}{modal.operation==="pr_merge"&&<label>Merge method<select aria-label="Merge method" value={strategy} onChange={e=>setStrategy(e.target.value)}><option value="squash">Squash merge</option><option value="merge">Merge commit</option><option value="rebase">Rebase merge</option></select></label>}{(modal.editable&&modal.operation!=="issue_assign"&&modal.operation!=="pr_merge"||["pr_create","issue_create"].includes(modal.operation))&&<label>{["issue_create","pr_create"].includes(modal.operation)?"Description":"Comment / review text"}<textarea aria-label="GitHub text body" value={body} onChange={e=>setBody(e.target.value)} rows={4}/></label>}<label>Type <strong>{modal.confirm}</strong> to confirm<input aria-label="Confirm GitHub action" value={typed} onChange={e=>setTyped(e.target.value)} placeholder={modal.confirm}/></label><footer><button onClick={()=>setModal(null)}>Cancel</button><button className="collab-proceed" disabled={busy||typed!==modal.confirm||(["pr_create","issue_create"].includes(modal.operation)&&title.trim().length<3)||modal.operation==="issue_assign"&&!assignee.trim()} onClick={()=>void apply()}>{busy?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>} Confirm action</button></footer></div></div>}
 </div>;
}
