import {useEffect,useMemo,useRef,useState} from "react";
import {FileDiff,Search} from "lucide-react";
import "./workflow.css";
export default function PatchDiff({text,label="Git diff"}:{text:string;label?:string}){
 const[query,setQuery]=useState(""),[active,setActive]=useState(-1);
 const viewport=useRef<HTMLDivElement|null>(null);
 const lines=useMemo(()=>text.split(/\r?\n/).slice(0,1400),[text]);
 const matches=useMemo(()=>query?lines.flatMap((l,i)=>l.toLowerCase().includes(query.toLowerCase())?[i]:[]):[],[lines,query]);
 useEffect(()=>setActive(-1),[text,query]);
 const find=(direction=1)=>{if(!matches.length)return;const index=active<0?(direction===1?0:matches.length-1):(active+direction+matches.length)%matches.length;setActive(index);viewport.current?.querySelector('[data-line="'+matches[index]+'"]')?.scrollIntoView({block:"center"})};
 const highlight=(line:string)=>{if(!query)return line||" ";const lower=line.toLowerCase(),needle=query.toLowerCase(),out:React.ReactNode[]=[];let start=0,pos=lower.indexOf(needle);while(pos>=0){out.push(line.slice(start,pos),<mark className="diff-search-hit" key={pos}>{line.slice(pos,pos+query.length)}</mark>);start=pos+query.length;pos=lower.indexOf(needle,start)}out.push(line.slice(start));return out};
 if(!text)return <div className="diff-placeholder"><FileDiff size={26}/><b>Choose a file to inspect</b><span>The patch will appear here without changing your working tree.</span></div>;
 return <div className="patch-view"><div className="patch-find"><label><Search size={13}/><input aria-label="Find in patch" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find in patch" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();find(e.shiftKey?-1:1)}}}/></label><span aria-live="polite">{query?(active>=0?active+1:0)+"/"+matches.length:""}</span><button aria-label="Previous patch match" disabled={!matches.length} onClick={()=>find(-1)}>↑</button><button aria-label="Next patch match" disabled={!matches.length} onClick={()=>find(1)}>↓</button><small>Search displayed patch</small></div><div ref={viewport} className="diff-code" role="region" aria-label={label}>{lines.map((line,i)=>{const type=line.startsWith("+")&&!line.startsWith("+++")?"added":line.startsWith("-")&&!line.startsWith("---")?"removed":line.startsWith("@@")?"hunk":/^(diff |index |---|\+\+\+|new file |deleted file )/.test(line)?"meta":"";return <div key={i} data-line={i} className={"diff-line "+type+(matches[active]===i?" search-current":"")}><span className="line-no">{i+1}</span><span className="line-source">{highlight(line)}</span></div>})}{text.split(/\r?\n/).length>1400&&<p className="diff-truncated">Large diff truncated to 1400 lines for display and search.</p>}</div></div>
}
