import{useEffect,useMemo,useState}from "react";
import{ArrowLeft,Braces,CalendarDays,Check,Clock3,Code2,FileClock,FileDiff,GitCommitHorizontal,GitPullRequest,History,LoaderCircle,Search,ShieldCheck,Users,X}from "lucide-react";
import{client}from "./api";
import SideBySideDiff from "./SideBySideDiff";
import MediaDiff from "./MediaDiff";
import type{FileHistory,FileBlame,FileComparison}from "./types";
import "./file-insights.css";

const short=(hash:string)=>hash.slice(0,8);
const date=(stamp:number)=>new Date(stamp*1000).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
const base=(file:string)=>file.replaceAll("\\","/").split("/").at(-1)||file;
const colour=(name:string)=>["#8de0ce","#eabb91","#bdaafa","#96c1f4","#e79cb9","#c4d79c"][Math.abs([...name].reduce((n,c)=>n*31+c.charCodeAt(0),0))%6];

export default function FileInsights({path,file,onClose}:{path:string;file:string;onClose:()=>void}){
 const[tab,setTab]=useState<"history"|"blame">("history");
 const[history,setHistory]=useState<FileHistory|null>(null);
 const[blame,setBlame]=useState<FileBlame|null>(null);
 const[comparison,setComparison]=useState<FileComparison|null>(null);
 const[media,setMedia]=useState<import("./types").MediaComparison|null>(null);
 const[activeSha,setActiveSha]=useState("");
 const[loading,setLoading]=useState(false);
 const[diffLoading,setDiffLoading]=useState(false);
 const[error,setError]=useState("");
 const[search,setSearch]=useState("");
 useEffect(()=>{
   let alive=true;setLoading(true);setError("");
   client.fileHistory(path,file).then(data=>{
     if(!alive)return;
     setHistory(data);if(data.commits.length)setActiveSha(data.commits[0].sha);
   }).catch(e=>{if(alive)setError(String(e))}).finally(()=>{if(alive)setLoading(false)});
   return()=>{alive=false};
 },[path,file]);
 useEffect(()=>{
   if(tab!=="blame"||blame)return;
   let alive=true;setLoading(true);setError("");
   client.fileBlame(path,file).then(data=>{if(alive)setBlame(data)}).catch(e=>{if(alive)setError(String(e))}).finally(()=>{if(alive)setLoading(false)});
   return()=>{alive=false};
 },[tab,path,file,blame]);
 useEffect(()=>{
   if(tab!=="history"||!activeSha)return;
   let alive=true;setComparison(null);setMedia(null);setDiffLoading(true);setError("");
   client.compare(path,file,false,activeSha).then(data=>{if(alive)setComparison(data)}).catch(async()=>{try{const m=await client.media(path,file,false,activeSha);if(alive)setMedia(m)}catch(e){if(alive)setError(String(e))}}).finally(()=>{if(alive)setDiffLoading(false)});
   return()=>{alive=false};
 },[activeSha,path,file,tab]);
 useEffect(()=>{
   const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();onClose();}};
   window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);
 },[onClose]);
 const visibleHistory=useMemo(()=>history?.commits.filter(c=>!search||[c.subject,c.author,c.sha,c.date].some(x=>x.toLowerCase().includes(search.toLowerCase())))||[],[history,search]);
 const visibleBlame=useMemo(()=>blame?.lines.filter(line=>!search||[line.text,line.author,line.summary,line.sha].some(x=>x.toLowerCase().includes(search.toLowerCase())))||[],[blame,search]);
 const authors=useMemo(()=>{
  const authors=new Map<string,number>();
  for(const line of blame?.lines||[])authors.set(line.author,(authors.get(line.author)||0)+1);
  return [...authors.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
 },[blame]);
 return <div className="insights-overlay" role="dialog" aria-modal="true" aria-label={"File insights: "+file}>
  <section className="insights-frame">
   <header className="insights-header"><div className="insights-heading"><span className="insights-logo"><History size={23}/></span><div><span className="insights-kicker">SOURCE INTELLIGENCE / FILE EXPLORER</span><h2>{base(file)}</h2><small>{file}</small></div></div><div className="insights-closebar"><span><ShieldCheck size={14}/> READ ONLY</span><button aria-label="Close file insights" onClick={onClose}><X size={19}/></button></div></header>
   <div className="insights-toolbar"><div className="insights-tabs"><button className={tab==="history"?"active":""} onClick={()=>{setTab("history");setSearch("");}}><FileClock size={15}/> File history {history?.commits.length??""}</button><button className={tab==="blame"?"active":""} onClick={()=>{setTab("blame");setSearch("");}}><Users size={15}/> Line blame</button></div><label className="insights-search"><Search size={16}/><input aria-label="Search file insights" value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==="history"?"Search commits, authors...":"Find lines, authors, SHAs..."}/></label></div>
   <div className="insights-content">
    {tab==="history"?<><aside className="insights-timeline"><div className="insights-list-title"><GitCommitHorizontal size={15}/> EVOLUTION <span>{visibleHistory.length}</span></div><div className="insights-timeline-scroll">{visibleHistory.map((commit,i)=><button key={commit.sha} className={"insights-commit"+(activeSha===commit.sha?" selected":"")} onClick={()=>setActiveSha(commit.sha)}><span className="insights-timeline-node"><span/></span><span className="insights-commit-main"><b>{commit.subject}</b><small>{commit.author}<span>{commit.date}</span></small></span><span className="insights-sha">{short(commit.sha)}</span></button>)}{!loading&&visibleHistory.length===0&&<div className="insights-empty-list">No commit history matches this file.</div>}</div></aside><div className="insights-preview"><div className="insights-preview-top"><FileDiff size={16}/><b>{activeSha?"Commit "+short(activeSha):"Select a revision"}</b><span>Parent → Commit</span></div>{diffLoading?<div className="insights-wait"><LoaderCircle className="spin" size={21}/> Loading historical file snapshots...</div>:media?<MediaDiff media={media}/>:comparison?<SideBySideDiff comparison={comparison}/>:<div className="insights-wait"><FileDiff size={25}/> Select a commit to inspect exact changed lines.</div>}</div></>:
    <div className="insights-blame"><aside className="insights-authors"><div className="insights-list-title"><Users size={15}/> ATTRIBUTION <span>{authors.length}</span></div>{authors.map(([author,count])=><div className="insights-author" key={author}><span style={{background:colour(author)}}/><b>{author}</b><small>{count} lines</small></div>)}<div className="insights-attribution-note">Each line is attributed to the commit that last changed it, according to Git blame.</div></aside><div className="insights-blame-main"><div className="insights-preview-top"><Braces size={16}/><b>Line-by-line ownership</b><span>{blame?.total||0} lines</span></div><div className="insights-blame-scroll">{visibleBlame.map(row=><div className="insights-blame-row" key={row.number}><span className="insights-line-number">{row.number}</span><span className="insights-line-owner" title={row.summary+" · "+date(row.authorTime)}><span style={{background:colour(row.author)}}/><b>{row.author}</b><small>{short(row.sha)}</small></span><code>{row.text||" "}</code></div>)}{!loading&&visibleBlame.length===0&&<div className="insights-empty-list">No attributed lines available for this file.</div>}</div></div></div>}
   </div>
   {loading&&<div className="insights-progress"><LoaderCircle className="spin" size={15}/> Reading file data from Git...</div>}
   {error&&<div className="insights-error">{error}</div>}
   <footer className="insights-footer"><span><ShieldCheck size={15}/> Reading Git history only — no working-tree changes</span><span>ESC to close</span></footer>
  </section>
 </div>;
}
