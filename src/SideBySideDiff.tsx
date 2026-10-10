import{useEffect,useMemo,useRef,useState}from "react";
import{diffLines,diffWordsWithSpace}from "diff";
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
 const normalized=(text:string)=>split(text).map(line=>"="+line.replace(/[ \t]/g,"")).join("\n")+(text.endsWith("\n")?"\n":"");
 const blocks=diffLines(ignoreWhitespace?normalized(before):before,ignoreWhitespace?normalized(after):after);
 const oldLines=split(before),newLines=split(after);
 const rows:Pair[]=[];
 let left=1,right=1;
 for(let i=0;i<blocks.length;){
  const b=blocks[i];
  if(!b.added&&!b.removed){
   for(const _line of split(b.value)){rows.push({left:oldLines[left-1]??"",right:newLines[right-1]??"",leftNum:left++,rightNum:right++,kind:"equal"});}
   i++;continue;
  }
  const removed:string[]=[],added:string[]=[];
  while(i<blocks.length&&(blocks[i].added||blocks[i].removed)){
   const block=blocks[i++];
   for(const _line of split(block.value)){
    if(block.added)added.push(newLines[right-1+added.length]??"");else removed.push(oldLines[left-1+removed.length]??"");
   }
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
 const[ignoreWhitespace,setIgnoreWhitespace]=useState(()=>localStorage.getItem("arclane-diff-ignore-whitespace")==="true");
 const[wordDiff,setWordDiff]=useState(()=>localStorage.getItem("arclane-diff-word")==="true");
 const[showWhitespace,setShowWhitespace]=useState(()=>localStorage.getItem("arclane-diff-visible-whitespace")==="true");
 const[query,setQuery]=useState("");
 const[matchIndex,setMatchIndex]=useState(-1);
 const[scrollTop,setScrollTop]=useState(0);
 const[height,setHeight]=useState(360);
 const viewport=useRef<HTMLDivElement|null>(null);
 const rows=useMemo(()=>align(comparison.before,comparison.after,ignoreWhitespace),[comparison.before,comparison.after,ignoreWhitespace]);
 const matches=useMemo(()=>query?rows.flatMap((row,i)=>row.left.toLowerCase().includes(query.toLowerCase())||row.right.toLowerCase().includes(query.toLowerCase())?[i]:[]):[],[rows,query]);
 const rowHeight=23;
 const start=Math.max(0,Math.floor(scrollTop/rowHeight)-8);
 const count=Math.ceil(height/rowHeight)+20;
 const subset=rows.slice(start,start+count);
 const endSpace=(rows.length-start-subset.length)*rowHeight;
 const added=rows.filter(v=>v.kind==="added"||v.kind==="changed").length;
 const removed=rows.filter(v=>v.kind==="removed"||v.kind==="changed").length;
 useEffect(()=>{const node=viewport.current;if(!node)return;const observe=()=>setHeight(node.clientHeight);observe();const observer=new ResizeObserver(observe);observer.observe(node);return()=>observer.disconnect();},[]);
 useEffect(()=>{setScrollTop(0);if(viewport.current)viewport.current.scrollTop=0;},[comparison.file,comparison.staged,comparison.before,comparison.after,ignoreWhitespace]);
 useEffect(()=>{localStorage.setItem("arclane-diff-ignore-whitespace",String(ignoreWhitespace));localStorage.setItem("arclane-diff-word",String(wordDiff));localStorage.setItem("arclane-diff-visible-whitespace",String(showWhitespace));},[ignoreWhitespace,wordDiff,showWhitespace]);
 useEffect(()=>setMatchIndex(-1),[query,comparison.file,comparison.before,comparison.after,ignoreWhitespace]);
 const search=(direction=1)=>{
   if(!matches.length)return;
   const next=matchIndex<0?(direction===1?0:matches.length-1):(matchIndex+direction+matches.length)%matches.length;setMatchIndex(next);
   if(viewport.current){const top=Math.max(0,matches[next]*rowHeight-height/3);viewport.current.scrollTop=top;setScrollTop(top);}
 };
 const highlighted=(text:string)=>{
  const shown=showWhitespace?text.replaceAll("\t","→   ").replaceAll(" ","·"):text;
  if(!query||showWhitespace)return shown;
  const lower=text.toLowerCase(),needle=query.toLowerCase(),parts:React.ReactNode[]=[];let cursor=0,found=lower.indexOf(needle);
  while(found>=0){parts.push(text.slice(cursor,found),<mark className="diff-search-hit" key={found}>{text.slice(found,found+query.length)}</mark>);cursor=found+query.length;found=lower.indexOf(needle,cursor)}parts.push(text.slice(cursor));return parts;
 };
 const content=(row:Pair,side:"left"|"right")=>{
  if(!wordDiff||row.kind!=="changed")return highlighted(row[side]||" ");
  return diffWordsWithSpace(row.left,row.right).filter(part=>side==="left"?!part.added:!part.removed).map((part,i)=><span key={i} className={part.added?"word-added":part.removed?"word-removed":""}>{highlighted(part.value)}</span>);
 };
 const lineEnding=(text:string)=>text.includes("\r\n")?(text.replaceAll("\r\n","").includes("\n")?"Mixed":"CRLF"):"LF";
 return <div className="comparison">
  <div className="comparison-top">
   <div className="comparison-metrics"><Columns2 size={14}/><b>Side-by-side</b><span className="compare-added">+{added}</span><span className="compare-removed">−{removed}</span></div>
   <label className="compare-query"><Search size={13}/><input aria-label="Find in compared files" value={query} placeholder="Find in file" onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();search(e.shiftKey?-1:1)}}}/><button onClick={()=>search(1)} disabled={!matches.length}>Find</button></label><span className="diff-match-count" aria-live="polite">{query?(matchIndex>=0?matchIndex+1:0)+"/"+matches.length:""}</span><button className="compare-whitespace" aria-label="Previous diff match" onClick={()=>search(-1)} disabled={!matches.length}>↑</button><button className="compare-whitespace" aria-label="Next diff match" onClick={()=>search(1)} disabled={!matches.length}>↓</button>
   <button className={"compare-whitespace"+(ignoreWhitespace?" active":"")} onClick={()=>setIgnoreWhitespace(v=>!v)} aria-pressed={ignoreWhitespace} title="Ignore whitespace when comparing lines"><Settings2 size={13}/> Ignore whitespace</button>
   <button className={"compare-whitespace"+(wordDiff?" active":"")} onClick={()=>setWordDiff(v=>!v)} aria-pressed={wordDiff}>Word diff</button><button className={"compare-whitespace"+(showWhitespace?" active":"")} onClick={()=>setShowWhitespace(v=>!v)} aria-pressed={showWhitespace}>Show whitespace</button>
  </div>
  <div className="comparison-titles"><div><span className="compare-branch-left"/><strong>{comparison.leftLabel}</strong><small>{comparison.beforeExists?comparison.linesBefore+" lines":"New file"}</small></div><div><span className="compare-branch-right"/><strong>{comparison.rightLabel}</strong><small>{comparison.afterExists?comparison.linesAfter+" lines":"Deleted file"}</small></div></div>
  <div className="comparison-body" ref={viewport} onScroll={e=>setScrollTop(e.currentTarget.scrollTop)} role="region" aria-label="Side-by-side Git diff">
   <div style={{height:start*rowHeight}} aria-hidden="true"/>
   {subset.map((row,i)=><div key={start+i} className={"comparison-row "+row.kind+(matches[matchIndex]===start+i?" search-current":"")}>
     <div className={"comparison-half left "+(row.leftNum===null?"empty":"")}><span>{row.leftNum??""}</span><code>{content(row,"left")}</code></div>
     <div className={"comparison-half right "+(row.rightNum===null?"empty":"")}><span>{row.rightNum??""}</span><code>{content(row,"right")}</code></div>
   </div>)}
   <div style={{height:endSpace}} aria-hidden="true"/>
  </div>
  <div className="comparison-bottom"><span><Braces size={12}/> UTF-8 · Left {lineEnding(comparison.before)} / Right {lineEnding(comparison.after)}</span><span>{rows.length} aligned lines · virtualised</span></div>
 </div>;
}
