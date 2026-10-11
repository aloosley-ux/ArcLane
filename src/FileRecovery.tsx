import {useEffect,useState} from 'react';
import {client} from './api';
import type {FileRecovery} from './types';
export default function FileRecoveryPanel({path,refresh,busy,onUndo}:{path:string;refresh:unknown;busy:boolean;onUndo:(id:string)=>Promise<boolean>}){
 const[records,setRecords]=useState<FileRecovery[]>([]),[error,setError]=useState('');
 useEffect(()=>{let alive=true;setRecords([]);setError('');client.recoveries(path).then(r=>{if(alive)setRecords(r)}).catch(e=>{if(alive)setError(String(e))});return()=>{alive=false}},[path,refresh]);
 if(!records.length&&!error)return null;
 return <section className="file-recovery" aria-label="Discard recovery"><div className="change-group-head"><span>Discard recovery</span><span>{records.length}</span></div>{records.map(r=><div className="recovery-entry" key={r.id}><span title={r.file}>{r.file}<small>{r.state==='available'?'Exact bytes saved':'Incomplete operation · saved folder retained'}</small></span><button disabled={busy||r.state!=='available'} onClick={()=>void onUndo(r.id)}>Undo discard</button></div>)}{error&&<p role="alert">{error}</p>}<small>Survives restart · 32 snapshots, 4 MB each · no automatic expiry. Undo refuses newer edits or changed Git state.</small></section>;
}
