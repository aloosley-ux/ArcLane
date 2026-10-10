import{invoke}from "@tauri-apps/api/core";
import type{Repository,HistoryPage,DiffResult,ActionResult,ProviderPr,ProviderRun}from "./types";
export const client={
  recent:()=>invoke<string[]>("repositories"),
  setRecent:(paths:string[])=>invoke<string[]>("set_repositories",{paths}),
  pick:()=>invoke<string|null>("pick_repository"),
  inspect:(path:string)=>invoke<Repository>("snapshot",{path}),
  history:(path:string,limit=350,reference="all",skip=0)=>invoke<HistoryPage>("commits",{path,limit,reference,skip}),
  diff:(path:string,file="",staged=false,commit:string|null=null)=>invoke<DiffResult>("file_diff",{path,file,staged,commit}),
  action:(path:string,op:string,file:string|null=null,input:string|null=null)=>invoke<ActionResult>("git_action",{path,op,file,input}),
  prs:(path:string)=>invoke<ProviderPr[]>("github_query",{path,kind:"prs"}),
  runs:(path:string)=>invoke<ProviderRun[]>("github_query",{path,kind:"runs"}),
  openExternal:(url:string)=>invoke<void>("open_external",{url}),
  openPath:(path:string,kind:"editor"|"terminal"|"explorer")=>invoke<void>("open_path",{path,kind}),
};
