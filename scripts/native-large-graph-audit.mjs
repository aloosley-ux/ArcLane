// Native 10k+ history scalability acceptance. No real developer repository writes.
import {fixture,launch,evidence,expect,fs,path,base,execFileSync,wait} from './native-sprint-harness.mjs';
const f=fixture('long-graph'),{repo,git,write}=f;
write('history.txt','base\n');git('add','--all');git('commit','-qm','Root');
const starting=git('rev-parse','HEAD'),extra=10040,parts=[],epoch=1750000000;
for(let i=0;i<extra;i++){
 const msg='History '+String(i).padStart(5,'0');
 const file='history '+i+'\n';
 parts.push('commit refs/heads/main\ncommitter ArcLane Fixture <fixture@invalid.local> '+(epoch+i)+' +0000\ndata '+Buffer.byteLength(msg)+'\n'+msg+'\n'+(i===0?'from '+starting+'\n':'')+'M 100644 inline history.txt\ndata '+Buffer.byteLength(file)+'\n'+file+'\n');
}
execFileSync('git',['-C',repo,'fast-import','--quiet'],{input:parts.join(''),maxBuffer:5*1024*1024});
git('restore','--source=HEAD','--staged','--worktree','--','history.txt');
const total=Number(git('rev-list','--count','HEAD'));if(total!==extra+1)throw Error('Fixture count '+total);
const head=git('rev-parse','HEAD'),tree=git('write-tree'),bytes=fs.readFileSync(path.join(repo,'history.txt'),'utf8');
const session=await launch(repo,'large-graph-accept',9490),{page}=session,checks=[];
try{
 const count=page.locator('.commit-count');
 await expect(count).toContainText('350+');
 let maxRows=0;
 const samples=[];
 while(true){
   const text=(await count.innerText()).trim();
   const loaded=Number(text.match(/\d+/)?.[0]||0);
   const rows=await page.locator('.commit-row').count();
   maxRows=Math.max(rows,maxRows);
   if(rows>85)throw Error('DOM virtualization exceeded 85 rows at '+loaded+': '+rows);
   if(loaded%1400===0||loaded===350||loaded===total)samples.push({loaded,rows});
   if(loaded===total)break;
   if(loaded>total)throw Error('Pagination overran fixture count');
   const scroll=page.locator('.graph-scroll');
   const more=page.locator('.history-more');
   await more.scrollIntoViewIfNeeded({timeout:12000});
   const prior=await scroll.evaluate(n=>n.scrollTop);
   await more.click();
   await expect(count).toContainText(String(Math.min(total,loaded+350)),{timeout:20000});
   const after=await scroll.evaluate(n=>n.scrollTop);
   if(after<Math.max(0,prior-350))throw Error('Loading more reset scroll position at '+loaded+': '+prior+' -> '+after);
 }
 checks.push('024 paged through '+total+' real commits with max '+maxRows+' mounted DOM rows and retained scroll position');
 const scroll=page.locator('.graph-scroll');
 await scroll.evaluate(n=>{n.scrollTop=n.scrollHeight;n.dispatchEvent(new Event('scroll',{bubbles:true}));});
 await expect(page.locator('.commit-row').filter({hasText:'Root'})).toHaveCount(1,{timeout:12000});
 const metrics=await page.evaluate(()=>({
  jsHeap:performance.memory&&performance.memory.usedJSHeapSize?performance.memory.usedJSHeapSize:null,
  rows:document.querySelectorAll('.commit-row').length,
  height:document.querySelector('.graph-scroll')?.scrollHeight,
  scroll:document.querySelector('.graph-scroll')?.scrollTop
 }));
 if(metrics.rows>85)throw Error('Unbounded DOM at bottom');
 if(metrics.jsHeap!==null&&metrics.jsHeap>200*1024*1024)throw Error('JS heap exceeded 200 MiB: '+metrics.jsHeap);
 checks.push('024 oldest root commit reachable and bounded JS heap '+(metrics.jsHeap===null?'not exposed by WebView2':Math.round(metrics.jsHeap/1048576)+' MiB'));
 if(git('rev-parse','HEAD')!==head||git('write-tree')!==tree||fs.readFileSync(path.join(repo,'history.txt'),'utf8')!==bytes)throw Error('History viewing changed repo state');
 checks.push('Read-only massive history preserved exact HEAD/index/content');
 await evidence(session,'native-large-graph-audit',checks,repo);
 console.log('LARGE_GRAPH_SAMPLES',JSON.stringify(samples));
}catch(e){await evidence(session,'native-large-graph-audit-failure',checks,repo).catch(()=>{});throw e}
finally{await session.close();}
