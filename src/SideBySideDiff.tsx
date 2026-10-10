import{useEffect,useMemo,useRef,useState}from "react";
import{diffLines}from "diff";
import{Braces,Columns2,Search,Settings2}from "lucide-react";
import type{FileComparison}from "./types";
import "./comparison.css";

type Pair={left:string;right:string;leftNum:number|null;rightNum:number|null;kind:"equal"|"removed"|"added"|"changed"};
const split=(value:string)=>{
 if(!value)return[];
 const rows=value.split(/\r?\n/);
 if(value.endsWith("\n"))rows.pop();
 return rows;
};
function align(before:string,after:string,ignoreWhitespace:boolean):Pair[]{
 const blocks=diffLines(before,after,{ignoreWhitespace});
 const rows:Pair[]=[];
 let left=1,right=1;
 for(let i=0;i<blocks.length;){
  const b=blocks[i];
  if(!b.added&&!b.removed){
   for(const line of split(b.value)){rows.push({left:line,right:line,leftNum:left++,rightNum:right++,kind:"equal"});}
   i++;continue;
  }
  const removed:string[]=[],added:string[]=[];
  while(i<blocks.length&&(blocks[i].added||blocks[i].removed)){
   const block=blocks[i++];
   (block.added?added:removed).push(...split(block.value));
  }
  const size=Math.max(removed.length,added.length);
  for(let j=0;j<size;j++){
   const old=removed[j],next=added[j];
   rows.push({left:old??"",right:next??"",leftNum:old===undefined?null:left++,rightNum:next===undefined?null:right++,
    kind:old===undefined?"added":next===undefined?"removed":"changed"});
  }
 }
 return rows;
}
export default function SideBySideDiff({comparison}:{comparison:FileComparison}){
 const[ignoreWhitespace,setIgnoreWhitespace]=useState(false);
 const[query,setQuery]=useState("");
 const[scrollTop,setScrollTop]=useState(0);
 const[height,setHeight]=useState(360);
 const viewport=useRef<HTMLDivElement|null>(null);
 const rows=useMemo(()=>align(comparison.before,comparison.after,ignoreWhitespace),[comparison.before,comparison.after,ignoreWhitespace]);
 const rowHeight=23;
 const start=Math.max(0,Math.floor(scrollTop/rowHeight)-8);
 const count=Math.ceil(height/rowHeight)+20;
 const subset=rows.slice(start,start+count);
 const endSpace=(rows.length-start-subset.length)*rowHeight;
 const added=rows.filter(v=>v.kind==="added"||v.kind==="changed").length;
 const removed=rows.filter(v=>v.kind==="removed"||v.kind==="changed").length;
 useEffect(()=>{const node=viewport.current;if(!node)return;const observe=()=>setHeight(node.clientHeight);observe();const observer=new ResizeObserver(observe);observer.observe(node);return()=>observer.disconnect();},[]);
 useEffect(()=>{setScrollTop(0);if(viewport.current)viewport.current.scrollTop=0;},[comparison.file,comparison.staged,comparison.before,comparison.after,ignoreWhitespace]);
 const search=()=>{
   if(!query)return;
   const index=rows.findIndex(row=>row.left.toLowerCase().includes(query.toLowerCase())||row.right.toLowerCase().includes(query.toLowerCase()));
   if(index>=0&&viewport.current){viewport.current.scrollTop=index*rowHeight;setScrollTop(index*rowHeight);}
 };
 return <div className="comparison">
  <div className="comparison-top">
   <div className="comparison-metrics"><Columns2 size={14}/><b>Side-by-side</b><span className="compare-added">+{added}</span><span className="compare-removed">−{removed}</span></div>
   <label className="compare-query"><Search size={13}/><input aria-label="Find in compared files" value={query} placeholder="Find in file" onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")search();}}/><button onClick={search} disabled={!query}>Find</button></label>
   <button className={"compare-whitespace"+(ignoreWhitespace?" active":"")} onClick={()=>setIgnoreWhitespace(v=>!v)} aria-pressed={ignoreWhitespace} title="Ignore whitespace when comparing lines"><Settings2 size={13}/> Ignore whitespace</button>
  </div>
  <div className="comparison-titles"><div><span className="compare-branch-left"/><strong>{comparison.leftLabel}</strong><small>{comparison.beforeExists?comparison.linesBefore+" lines":"New file"}</small></div><div><span className="compare-branch-right"/><strong>{comparison.rightLabel}</strong><small>{comparison.afterExists?comparison.linesAfter+" lines":"Deleted file"}</small></div></div>
  <div className="comparison-body" ref={viewport} onScroll={e=>setScrollTop(e.currentTarget.scrollTop)} role="region" aria-label="Side-by-side Git diff">
   <div style={{height:start*rowHeight}} aria-hidden="true"/>
   {subset.map((row,i)=><div key={start+i} className={"comparison-row "+row.kind}>
     <div className={"comparison-half left "+(row.leftNum===null?"empty":"")}><span>{row.leftNum??""}</span><code>{row.left||" "}</code></div>
     <div className={"comparison-half right "+(row.rightNum===null?"empty":"")}><span>{row.rightNum??""}</span><code>{row.right||" "}</code></div>
   </div>)}
   <div style={{height:endSpace}} aria-hidden="true"/>
  </div>
  <div className="comparison-bottom"><span><Braces size={12}/> UTF-8 text, directly from Git index and working tree</span><span>{rows.length} aligned lines · virtualised</span></div>
 </div>;
}
