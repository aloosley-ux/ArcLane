import {useEffect,useRef} from "react";
import type {LucideIcon} from "lucide-react";

/** A desktop pane boundary, usable by pointer and keyboard. */
export function PaneSplitter({axis,value,min,max,onChange,label,invert=false}:{axis:"horizontal"|"vertical";value:number;min:number;max:number;onChange:(value:number)=>void;label:string;invert?:boolean}) {
 const cleanup=useRef<(()=>void)|null>(null);
 useEffect(()=>()=>cleanup.current?.(),[]);
 const clamp=(n:number)=>Math.max(min,Math.min(max,n));
 return <div className={"pane-splitter "+axis} role="separator" aria-label={label} aria-orientation={axis} aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value)} tabIndex={0}
  onKeyDown={e=>{const keys=axis==="horizontal"?["ArrowUp","ArrowDown"]:["ArrowLeft","ArrowRight"];if(keys.includes(e.key)){e.preventDefault();onChange(clamp(value+(e.key===keys[0]?-1:1)*(invert?-1:1)*(e.shiftKey?40:10)));}if(e.key==="Home"){e.preventDefault();onChange(min);}if(e.key==="End"){e.preventDefault();onChange(max);}}}
  onPointerDown={e=>{cleanup.current?.();e.currentTarget.setPointerCapture(e.pointerId);const start=axis==="horizontal"?e.clientY:e.clientX;const move=(ev:PointerEvent)=>onChange(clamp(value+((axis==="horizontal"?ev.clientY:ev.clientX)-start)*(invert?-1:1)));const stop=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",stop);window.removeEventListener("pointercancel",stop);cleanup.current=null;};cleanup.current=stop;window.addEventListener("pointermove",move);window.addEventListener("pointerup",stop);window.addEventListener("pointercancel",stop);}}
  onLostPointerCapture={()=>cleanup.current?.()}><span/></div>;
}

export function WorkspaceTabs<T extends string>({items,selected,onSelect}:{items:{route:T;icon:LucideIcon;label:string;title?:string}[];selected:T;onSelect:(value:T)=>void}) {
 return <nav className="workspace-tabs" aria-label="Sections">{items.map(({route,icon:Icon,label,title})=><button key={route} aria-label={label} aria-current={selected===route?"page":undefined} className={selected===route?"active":""} onClick={()=>onSelect(route)}><Icon size={15} strokeWidth={1.8}/><span>{title||label}</span></button>)}</nav>;
}

export function storedPaneSize(key:string,fallback:number,min:number,max:number) {
 const raw=localStorage.getItem(key);const n=raw===null?NaN:Number(raw);
 return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
}
