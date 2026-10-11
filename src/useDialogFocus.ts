import {useEffect} from 'react';
export function useDialogFocus(open:boolean,selector:string,onClose:()=>void){
 useEffect(()=>{if(!open)return;const node=document.querySelector<HTMLElement>(selector);if(!node)return;const previous=document.activeElement as HTMLElement|null;
 const focusable=()=>[...node.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(n=>n.getClientRects().length>0);
 focusable()[0]?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}if(e.key==='Tab'){const items=focusable(),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};node.addEventListener('keydown',handler);
 return()=>{node.removeEventListener('keydown',handler);if(previous?.isConnected)previous.focus();};
 },[open,selector]);
}
