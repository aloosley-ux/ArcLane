import{invoke}from "@tauri-apps/api/core";
import{listen}from "@tauri-apps/api/event";
import{TerminalSessionState,type TerminalSnapshot}from "./terminal-session-state";
import type{Repository,HistoryPage,IgnoredPage,DiffResult,HunkResponse,FileComparison,FileHistory,FileBlame,ConflictData,ConflictSummary,ActionResult,ProviderPr,ProviderRun}from "./types";
export const client={
  workspace:()=>invoke<import("./types").WorkspaceState>("load_workspace"),
  saveWorkspace:(state:import("./types").WorkspaceState)=>invoke<import("./types").WorkspaceState>("save_workspace",{state}),
  rebasePreview:(path:string,base:string)=>invoke<import("./types").RebasePreview>("rebase_preview",{path,base}),
  inspectStash:(path:string,id:string)=>invoke<import("./types").StashDetails>("inspect_stash",{path,id}),
  reviewRevisions:(path:string,from:string|null,to:string,file:string|null=null)=>invoke<import("./types").RevisionReview>("review_revisions",{path,from,to,file}),
  commitContext:(path:string,sha:string|null=null)=>invoke<import("./types").CommitDetails|import("./types").CommitDefaults>("commit_context",{path,sha}),
  recent:()=>invoke<string[]>("repositories"),
  setRecent:(paths:string[])=>invoke<string[]>("set_repositories",{paths}),
  pick:()=>invoke<string|null>("pick_repository"),
  initialize:(folder:string)=>invoke<{path:string;output:string}>("create_repository",{folder}),
  clone:(url:string,parent:string)=>invoke<{path:string;output:string}>("clone_repository",{url,parent}),
  inspect:(path:string)=>invoke<Repository>("snapshot",{path}),
  ignoredFiles:(path:string,scope:string|null=null,offset=0,limit=100)=>invoke<IgnoredPage>("ignored_files",{path,scope,offset,limit}),
  history:(path:string,limit=350,reference="all",skip=0)=>invoke<HistoryPage>("commits",{path,limit,reference,skip}),
  diff:(path:string,file="",staged=false,commit:string|null=null)=>invoke<DiffResult>("file_diff",{path,file,staged,commit}),
  hunks:(path:string,file:string,staged:boolean)=>invoke<HunkResponse>("get_hunks",{path,file,staged}),
  compare:(path:string,file:string,staged:boolean,commit:string|null=null)=>invoke<FileComparison>("compare_file",{path,file,staged,commit}),
  media:(path:string,file:string,staged:boolean,commit:string|null=null)=>invoke<import("./types").MediaComparison>("compare_media",{path,file,staged,commit}),
  recoveries:(path:string)=>invoke<import("./types").FileRecovery[]>("file_recoveries",{path}),
  fileHistory:(path:string,file:string)=>invoke<FileHistory>("inspect_file_history",{path,file}),
  fileBlame:(path:string,file:string)=>invoke<FileBlame>("inspect_file_blame",{path,file}),
  collabQuery:(path:string,kind:string,id:string|null=null,requestId:string|null=null)=>invoke<unknown>("collaboration_query",{path,kind,id,requestId}),
  cancelProviderRead:(path:string,requestId:string)=>invoke<boolean>("cancel_provider_read",{path,requestId}),
  collabAction:(path:string,operation:string,target:string,detail:Record<string,unknown>)=>invoke<{ok:boolean;operation:string;output:string}>("collaboration_action",{path,operation,target,detail}),
  toolboxView:(path:string,section:string)=>invoke<Record<string,unknown>>("toolbox_view",{path,section}),
  toolboxAction:(path:string,op:string,file:string,input:string)=>invoke<{ok:boolean;command:string;output:string}>("toolbox_action",{path,op,file,input}),
  conflicts:(path:string)=>invoke<ConflictSummary>("list_conflicts",{path}),
  inspectConflict:(path:string,file:string)=>invoke<ConflictData>("inspect_conflict",{path,file}),
  resolveConflict:(path:string,file:string,choice:"ours"|"theirs"|"manual",manual?:string)=>invoke<{ok:boolean;path:string;resolution:string;bytes:number}>("resolve_conflict",{path,file,choice,manual:choice==="manual"?manual:null}),
  applyHunk:(path:string,file:string,staged:boolean,index:number)=>invoke<ActionResult>("apply_hunk",{path,file,staged,index}),
  action:(path:string,op:string,file:string|null=null,input:string|null=null,requestId:string|null=null)=>invoke<ActionResult>("git_action",{path,op,file,input,requestId}),
  cancelGitAction:(path:string,requestId:string)=>invoke<boolean>("cancel_git_action",{path,requestId}),
  prs:(path:string)=>invoke<ProviderPr[]>("github_query",{path,kind:"prs"}),
  runs:(path:string)=>invoke<ProviderRun[]>("github_query",{path,kind:"runs"}),
  openExternal:(url:string)=>invoke<void>("open_external",{url}),
  openPath:(path:string,kind:"editor"|"terminal"|"explorer")=>invoke<void>("open_path",{path,kind}),
  terminalOpen:(path:string,rows=28,cols=105)=>invoke<TerminalSnapshot>("terminal_open",{path,rows,cols}),
  agentDiscover:()=>invoke<Array<{agent:"codex"|"kilo";available:boolean;path:string|null}>>("agent_discover"),
  agentValidate:(agent:"codex"|"kilo",path:string)=>invoke<string>("agent_validate",{agent,path}),
  agentLaunch:(path:string,executable:string,args:string[]=[])=>invoke<TerminalSnapshot>("terminal_launch",{path,executable,args}),
  terminalSend:(id:string,data:string)=>invoke<void>("terminal_send",{id,data}),
  terminalResize:(id:string,rows:number,cols:number)=>invoke<void>("terminal_resize",{id,rows,cols}),
  terminalClose:(id:string)=>invoke<void>("terminal_close",{id}),
  terminalSessions:()=>invoke<TerminalSnapshot[]>("terminal_sessions"),
};

/** Subscribe first, then snapshot. Revisions merge notifications and the snapshot without gaps or replay duplicates. */
export function watchTerminalSessions(onChange:(sessions:TerminalSnapshot[])=>void,onError?:(error:unknown)=>void){
 let active=true;let unlisten:(()=>void)|undefined;
 const state=new TerminalSessionState(sessions=>{if(active)onChange(sessions);});
 void listen<TerminalSnapshot>("arclane-terminal-output",({payload})=>state.event(payload)).then(async stop=>{
  if(!active){stop();return;}unlisten=stop;
  try{state.bootstrap(await client.terminalSessions());}catch(error){onError?.(error);}
 }).catch(error=>{if(active)onError?.(error);});
 return()=>{active=false;unlisten?.();};
}
