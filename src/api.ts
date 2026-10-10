import{invoke}from "@tauri-apps/api/core";
import type{Repository,HistoryPage,DiffResult,HunkResponse,ActionResult,ProviderPr,ProviderRun}from "./types";
export const client={
  recent:()=>invoke<string[]>("repositories"),
  setRecent:(paths:string[])=>invoke<string[]>("set_repositories",{paths}),
  pick:()=>invoke<string|null>("pick_repository"),
  initialize:(folder:string)=>invoke<{path:string;output:string}>("create_repository",{folder}),
  clone:(url:string,parent:string)=>invoke<{path:string;output:string}>("clone_repository",{url,parent}),
  inspect:(path:string)=>invoke<Repository>("snapshot",{path}),
  history:(path:string,limit=350,reference="all",skip=0)=>invoke<HistoryPage>("commits",{path,limit,reference,skip}),
  diff:(path:string,file="",staged=false,commit:string|null=null)=>invoke<DiffResult>("file_diff",{path,file,staged,commit}),
  hunks:(path:string,file:string,staged:boolean)=>invoke<HunkResponse>("get_hunks",{path,file,staged}),
  applyHunk:(path:string,file:string,staged:boolean,index:number)=>invoke<ActionResult>("apply_hunk",{path,file,staged,index}),
  action:(path:string,op:string,file:string|null=null,input:string|null=null)=>invoke<ActionResult>("git_action",{path,op,file,input}),
  prs:(path:string)=>invoke<ProviderPr[]>("github_query",{path,kind:"prs"}),
  runs:(path:string)=>invoke<ProviderRun[]>("github_query",{path,kind:"runs"}),
  openExternal:(url:string)=>invoke<void>("open_external",{url}),
  openPath:(path:string,kind:"editor"|"terminal"|"explorer")=>invoke<void>("open_path",{path,kind}),
  terminalOpen:(path:string,rows=28,cols=105)=>invoke<{id:string;path:string;pid?:number}>("terminal_open",{path,rows,cols}),
  terminalSend:(id:string,data:string)=>invoke<void>("terminal_send",{id,data}),
  terminalResize:(id:string,rows:number,cols:number)=>invoke<void>("terminal_resize",{id,rows,cols}),
  terminalClose:(id:string)=>invoke<void>("terminal_close",{id}),
  terminalSessions:()=>invoke<Array<{id:string;path:string;pid?:number}>>("terminal_sessions"),
};
