import {useEffect,useRef,useState} from "react";
import {ChevronDown,ChevronRight,Eye,EyeOff,LoaderCircle} from "lucide-react";
import {client} from "./api";
import type {IgnoredEntry,IgnoredPage} from "./types";

const PAGE_SIZE=100;
const cleanPath=(value:string)=>value.replace(/\/+$/,"");
const nameOf=(value:string)=>cleanPath(value).split("/").pop()||value;
const folderOf=(value:string)=>{const clean=cleanPath(value),index=clean.lastIndexOf("/");return index<0?"Repository root":clean.slice(0,index)||"Repository root";};

export default function IgnoredFiles({path,refreshToken,selectedPath,onSelect}:{path:string;refreshToken:number;selectedPath:string|null;onSelect:(entry:IgnoredEntry|null)=>void}){
 const[visible,setVisible]=useState(false);
 const[root,setRoot]=useState<IgnoredPage|null>(null);
 const[expanded,setExpanded]=useState<Record<string,IgnoredPage>>({});
 const[loading,setLoading]=useState(false);
 const[loadingScope,setLoadingScope]=useState<string|null>(null);
 const[error,setError]=useState("");
 const request=useRef(0);

 const loadRoot=async(offset:number,append:boolean)=>{
  const current=++request.current;setLoading(true);setLoadingScope(null);setError("");
  try{const page=await client.ignoredFiles(path,null,offset,PAGE_SIZE);if(current!==request.current)return;
   setRoot(previous=>append&&previous?{...page,entries:[...previous.entries,...page.entries]}:page);
  }catch(e){if(current===request.current)setError(String(e));}
  finally{if(current===request.current){setLoading(false);setLoadingScope(null);}}
 };
 const loadScope=async(scope:string,offset:number,append:boolean)=>{
  const current=++request.current;setLoading(true);setLoadingScope(scope);setError("");
  try{const page=await client.ignoredFiles(path,cleanPath(scope),offset,PAGE_SIZE);if(current!==request.current)return;
   setExpanded(previous=>{const old=previous[scope];return {...previous,[scope]:append&&old?{...page,entries:[...old.entries,...page.entries]}:page};});
  }catch(e){if(current===request.current)setError(String(e));}
  finally{if(current===request.current){setLoading(false);setLoadingScope(null);}}
 };

 useEffect(()=>{
  if(!visible)return;
  request.current++;setRoot(null);setExpanded({});onSelect(null);
  void loadRoot(0,false);
 },[path,refreshToken]);

 const toggle=()=>{
  if(visible){request.current++;setVisible(false);setRoot(null);setExpanded({});setError("");onSelect(null);return;}
  setVisible(true);setExpanded({});void loadRoot(0,false);
 };
 const select=(entry:IgnoredEntry)=>onSelect(entry);
 const toggleDirectory=(entry:IgnoredEntry)=>{
  if(expanded[entry.path]){setExpanded(previous=>{const next={...previous};delete next[entry.path];return next;});return;}
  void loadScope(entry.path,0,false);
 };
 const loadMoreRoot=()=>{if(root&&!loading)void loadRoot(root.entries.length,true);};
 const loadMoreScope=(scope:string,page:IgnoredPage)=>{if(!loading)void loadScope(scope,page.entries.length,true);};

 const row=(entry:IgnoredEntry)=><div key={entry.path} className={"change-row"+(selectedPath===entry.path?" selected":"")}>
  <button className="change-select" aria-label={"Select ignored path "+entry.path} title={entry.path} onClick={()=>select(entry)}>
   <span className="file-flag">!!</span>
   <span className="file-label"><span className="file-name">{nameOf(entry.path)}{entry.directory?"/":""}</span><span className="file-folder">{folderOf(entry.path)}</span></span>
  </button>
  {entry.directory&&<button className="change-mini" aria-label={(expanded[entry.path]?"Collapse":"Expand")+" ignored directory "+entry.path} title={(expanded[entry.path]?"Collapse":"Expand")+" ignored directory"} disabled={loading} onClick={()=>toggleDirectory(entry)}>{loadingScope===entry.path?<LoaderCircle size={13} className="spin"/>:expanded[entry.path]?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</button>}
 </div>;

 return <section className="ignored-files" aria-label="Ignored files">
  <div className="change-group-head">
   <span><Eye size={13}/> Ignored</span>
   {visible&&root&&<span>{root.entries.length} of {root.total}</span>}
   {visible&&loading&&loadingScope===null&&<LoaderCircle size={13} className="spin" aria-label="Loading ignored paths"/>}
   <button aria-expanded={visible} onClick={toggle}>{visible?<><EyeOff size={12}/> Hide</>:<><Eye size={12}/> Show</>}</button>
  </div>
  {visible&&<>
   {error&&<div className="list-zero" role="alert">Unable to load ignored paths: {error}</div>}
   {!error&&loading&&loadingScope===null&&!root&&<div className="list-zero"><LoaderCircle size={13} className="spin"/> Reading ignored paths…</div>}
   {!error&&root&&root.total===0&&<div className="list-zero">No ignored paths</div>}
   {root&&<div className="change-list">
    {root.entries.map(entry=><div key={entry.path}>
     {row(entry)}
     {entry.directory&&expanded[entry.path]&&<>
      {expanded[entry.path].entries.map(child=>row(child))}
      {expanded[entry.path].total===0&&<div className="list-zero">No ignored files in this directory</div>}
      {expanded[entry.path].has_more&&<div className="list-zero"><button className="text-action" disabled={loading} onClick={()=>loadMoreScope(entry.path,expanded[entry.path])}>Load more ignored files</button></div>}
     </>}
    </div>)}
    {root.has_more&&<div className="list-zero"><button className="text-action" disabled={loading} onClick={loadMoreRoot}>Load more ignored paths</button></div>}
   </div>}
  </>}
 </section>;
}
