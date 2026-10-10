import type{Commit}from "./types";
export type Segment={start:number;end:number;type:"through"|"parent"};
export type GraphRow=Commit&{lane:number;edges:Segment[]};
export const graphPalette=["var(--lane-1)","var(--lane-2)","var(--lane-3)","var(--lane-4)","var(--lane-5)","var(--lane-6)","var(--lane-7)","var(--lane-8)"];
export function buildGraph(commits:Commit[]):GraphRow[]{
  const active:(string|null)[]=[];
  const free=()=>{const i=active.indexOf(null);return i<0?active.length:i;};
  return commits.map(commit=>{
    let lane=active.indexOf(commit.sha);
    if(lane<0){lane=free();active[lane]=commit.sha;}
    const before=active.slice();
    active[lane]=null;
    const edges:Segment[]=[];
    for(let i=0;i<commit.parents.length;i++){
      const parent=commit.parents[i];
      let target=active.indexOf(parent);
      if(target<0){target=i===0&&active[lane]===null?lane:free();active[target]=parent;}
      edges.push({start:lane,end:target,type:"parent"});
    }
    before.forEach((ref,index)=>{if(ref!==null&&index!==lane)edges.push({start:index,end:index,type:"through"});});
    return{...commit,lane,edges};
  });
}
