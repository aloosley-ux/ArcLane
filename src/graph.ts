import type{Commit}from "./types";
export type Segment={start:number;end:number;type:"through"|"parent"};
export type GraphRow=Commit&{lane:number;edges:Segment[]};
export const graphPalette=["#71d7d0","#b1a1ff","#f3ad7e","#8ec9fb","#dc95c8","#a8cf8f","#efce78","#8ec7ae"];
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
