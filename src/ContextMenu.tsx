import {useEffect,useRef} from "react";
import type {LucideIcon} from "lucide-react";
import "./workflow.css";
export type MenuAction={name:string;icon:LucideIcon;perform:()=>void;enabled?:boolean;shortcut?:string};
export type ContextState={x:number;y:number;label:string;actions:MenuAction[]};
export default function ContextMenu({menu,onClose}:{menu:ContextState;onClose:()=>void}){
 const ref=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();const close=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose()};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[onClose]);
 return <div className="context-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}} onContextMenu={e=>{e.preventDefault();onClose()}}><div ref={ref} className="git-context-menu" role="menu" aria-label={menu.label} style={{left:Math.min(menu.x,window.innerWidth-290),top:Math.max(8,Math.min(menu.y,window.innerHeight-(menu.actions.length*34+42)))}} onKeyDown={e=>{if(!["ArrowDown","ArrowUp","Home","End"].includes(e.key))return;e.preventDefault();const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];const i=buttons.indexOf(document.activeElement as HTMLButtonElement);const next=e.key==="Home"?0:e.key==="End"?buttons.length-1:(i+(e.key==="ArrowUp"?-1:1)+buttons.length)%buttons.length;buttons[next]?.focus()}}><div className="context-caption">{menu.label}</div>{menu.actions.map(a=><button key={a.name} role="menuitem" disabled={a.enabled===false} onClick={()=>{onClose();a.perform()}}><a.icon size={14}/><span>{a.name}</span>{a.shortcut&&<kbd>{a.shortcut}</kbd>}</button>)}</div></div>
}
