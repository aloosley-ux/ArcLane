export type StackPr={number:number;headRefName:string;baseRefName:string;state?:string;title:string;updatedAt?:string};
export type StackEntry<T extends StackPr>={pr:T;depth:number;parent:number|null};
export type StackGroup<T extends StackPr>={id:string;base:string;entries:StackEntry<T>[]};
export function buildPrStacks<T extends StackPr>(pulls:T[]):StackGroup<T>[]{
 const all=[...pulls].sort((a,b)=>b.number-a.number);
 const head=new Map<string,T>();
 // Open branch references take precedence over archived PRs from the same branch.
 for(const p of all){const previous=head.get(p.headRefName);if(!previous||previous.state!=="OPEN"&&p.state==="OPEN")head.set(p.headRefName,p);}
 const parent=new Map<number,T>();
 const children=new Map<number,T[]>();
 for(const p of all){
   const owner=head.get(p.baseRefName);
   if(owner&&owner.number!==p.number){
     parent.set(p.number,owner);
     const list=children.get(owner.number)||[];
     list.push(p);children.set(owner.number,list);
   }
 }
 const seen=new Set<number>();
 const visit=(p:T,depth:number,target:StackEntry<T>[],trail:Set<number>)=>{
   if(trail.has(p.number)||seen.has(p.number))return;
   seen.add(p.number);trail.add(p.number);
   target.push({pr:p,depth,parent:parent.get(p.number)?.number??null});
   for(const child of (children.get(p.number)||[]).sort((a,b)=>a.number-b.number)){
     visit(child,Math.min(depth+1,20),target,trail);
   }
   trail.delete(p.number);
 };
 const roots=all.filter(pr=>!parent.has(pr.number));
 const groups:StackGroup<T>[]=[];
 for(const pr of roots){
   if(seen.has(pr.number))continue;
   const entries:StackEntry<T>[]=[];
   visit(pr,0,entries,new Set());
   groups.push({id:String(pr.number),base:pr.baseRefName,entries});
 }
 // Malformed cyclic provider data cannot cause infinite recursion.
 for(const pr of all){
   if(seen.has(pr.number))continue;
   const entries:StackEntry<T>[]=[];
   visit(pr,0,entries,new Set());
   groups.push({id:"orphan-"+pr.number,base:pr.baseRefName,entries});
 }
 return groups.sort((a,b)=>b.entries.length-a.entries.length||Number(b.entries[0].pr.number)-Number(a.entries[0].pr.number));
}
