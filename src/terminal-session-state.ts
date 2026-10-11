export type TerminalSnapshot={id:string;path:string;pid:number|null;agentSession:boolean;running:boolean;exitCode:number|null;exitError:string|null;output:string;outputTruncated:boolean;outputClosed:boolean;revision:number;closed:boolean};
const order=(a:TerminalSnapshot,b:TerminalSnapshot)=>Number(a.id.replace(/^pty-/,""))-Number(b.id.replace(/^pty-/,""))||a.id.localeCompare(b.id);

/** Reconciles notifications against authoritative backend snapshots by immutable ID and revision. */
export class TerminalSessionState {
 private sessions=new Map<string,TerminalSnapshot>();
 private revisions=new Map<string,number>();
 private staged=new Map<string,TerminalSnapshot>();
 private closed=new Set<string>();
 private initialized=false;
 private changed:(sessions:TerminalSnapshot[])=>void;
 constructor(changed:(sessions:TerminalSnapshot[])=>void){this.changed=changed;}
 private publish(){this.changed([...this.sessions.values()].sort(order));}
 private merge(snapshot:TerminalSnapshot){
  if(this.closed.has(snapshot.id))return;
  const seen=this.revisions.get(snapshot.id)??-1;
  if(snapshot.revision<=seen)return;
  const current=this.sessions.get(snapshot.id);
  if(current&&(current.path!==snapshot.path||current.pid!==snapshot.pid))return;
  this.revisions.set(snapshot.id,snapshot.revision);
  if(snapshot.closed){this.closed.add(snapshot.id);this.sessions.delete(snapshot.id);}else this.sessions.set(snapshot.id,snapshot);
 }
 event(snapshot:TerminalSnapshot){
  if(!this.initialized){const old=this.staged.get(snapshot.id);if(!old||snapshot.revision>old.revision)this.staged.set(snapshot.id,snapshot);return;}
  const before=this.revisions.get(snapshot.id)??-1;this.merge(snapshot);if((this.revisions.get(snapshot.id)??-1)!==before)this.publish();
 }
 bootstrap(snapshots:TerminalSnapshot[]){
  if(this.initialized)return;
  for(const snapshot of snapshots)this.merge(snapshot);
  for(const snapshot of this.staged.values())this.merge(snapshot);
  this.staged.clear();this.initialized=true;this.publish();
 }
 current(){return [...this.sessions.values()].sort(order);}
}
