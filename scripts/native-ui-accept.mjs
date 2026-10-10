import {spawn,execFileSync} from "node:child_process";
import fs from "node:fs";import path from "node:path";
import {chromium} from "playwright";
const arclane="C:\\AI\\REA\\Experiments\\Arclane";
const testbed="C:\\AI\\REA\\Experiments\\Forge-Testbed";
const exe=path.join(arclane,"Build","Arclane.exe");
const repo=fs.mkdtempSync(path.join(testbed,"arclane-native-ui-"));
const profile=path.join(arclane,"artifacts","native-ui-profile");
fs.mkdirSync(profile,{recursive:true});
const git=(...args)=>execFileSync("git",["-C",repo,...args],{encoding:"utf8"});
git("init","-b","main");
git("config","user.name","Arclane GUI Test");
git("config","user.email","ui@local.invalid");
const original=Array.from({length:100},(_,i)=>"line "+String(i+1).padStart(3,"0")+"\n");
fs.writeFileSync(path.join(repo,"segments.txt"),original.join(""));
git("add","--all");git("commit","-m","Initial test contents");
const edited=original.slice();edited[4]="MODIFIED 005\n";edited[69]="MODIFIED 070\n";
fs.writeFileSync(path.join(repo,"segments.txt"),edited.join(""));
fs.writeFileSync(path.join(profile,"repos.json"),JSON.stringify([repo]));
const port=9357;
let child=null,browser=null;
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const result={repo,tests:[],errors:[],mode:"native WebView2 CDP"};
try{
 child=spawn(exe,[],{cwd:path.dirname(exe),env:{...process.env,ARCLANE_DATA_DIR:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:"--remote-debugging-port="+port+" --remote-debugging-address=127.0.0.1"},stdio:"ignore",windowsHide:false});
 let responsive=false;
 for(let n=0;n<90;n++){
  await wait(220);
  try{const r=await fetch("http://127.0.0.1:"+port+"/json/version",{signal:AbortSignal.timeout(500)});if(r.ok){responsive=true;break;}}catch{}
  if(child.exitCode!==null)break;
 }
 if(!responsive)throw Error("WebView2 CDP unavailable; no native interaction claims can be made");
 result.targets=(await(await fetch("http://127.0.0.1:"+port+"/json/list")).json()).map(x=>({type:x.type,title:x.title,url:x.url}));
 console.log("CDP_TARGETS",JSON.stringify(result.targets));
 browser=await chromium.connectOverCDP("http://127.0.0.1:"+port);
 let page;
 for(let n=0;n<60;n++){
  const pages=browser.contexts().flatMap(c=>c.pages());
  if(n===0)console.log("PLAYWRIGHT_PAGES",pages.map(x=>x.url()));
  for(const candidate of pages){try{if((await candidate.title()).toLowerCase().includes("arclane")||candidate.url().includes("localhost")||candidate.url().includes("tauri:")){page=candidate;break;}}catch{}}
  if(page)break;await wait(200);
 }
 if(!page)page=browser.contexts().flatMap(c=>c.pages())[0];
 if(!page)throw Error("No inspectable WebView2 tab");
 result.nativePage={url:page.url(),title:await page.title().catch(()=>""),body:(await page.locator("body").innerText().catch(()=>"")).slice(0,1800)};
 console.log("NATIVE_PAGE",JSON.stringify(result.nativePage));
 page.on("pageerror",e=>result.errors.push(String(e)));
 await page.locator(".commit-row").first().waitFor({timeout:20000});
 const rows=await page.locator(".commit-row").count();
 if(rows===0)throw Error("Native application did not display real Git history");
 result.tests.push("real commit history in native WebView2");
 const file=page.locator(".change-list .change-select").filter({hasText:"segments.txt"}).first();
 await file.click();
 await page.locator(".comparison-row.changed").first().waitFor({timeout:12000});
 if(await page.locator(".comparison-titles").innerText().then(s=>!s.includes("Staging area")||!s.includes("Working tree")))throw Error("Real index/worktree side-by-side titles not present");
 const nearStart=await page.locator(".comparison-row.changed").allTextContents();
 if(!nearStart.join(" ").includes("MODIFIED 005"))throw Error("First changed line missing from paired file comparison");
 await page.locator(".right-diff .comparison-body").evaluate(node=>{node.scrollTop=65*23;node.dispatchEvent(new Event("scroll",{bubbles:true}));});
 await page.locator(".right-diff .comparison-row.changed").filter({hasText:"MODIFIED 070"}).first().waitFor({timeout:8000});
 result.tests.push("side-by-side virtualisation shows both changed lines by scrolling");
 await page.getByRole("button",{name:"Expand diff"}).click();
 const expanded=page.getByRole("dialog",{name:"Side-by-side comparison segments.txt"});
 await expanded.waitFor({timeout:8000});
 await expanded.locator(".comparison-row.changed").filter({hasText:"MODIFIED 005"}).first().waitFor({timeout:8000});
 await expanded.locator(".comparison-body").evaluate(node=>{node.scrollTop=65*23;node.dispatchEvent(new Event("scroll",{bubbles:true}));});
 await expanded.locator(".comparison-row.changed").filter({hasText:"MODIFIED 070"}).first().waitFor({timeout:8000});
 await expanded.getByRole("button",{name:"Close expanded diff"}).click();
 result.tests.push("large side-by-side modal navigates complete file");
 await page.getByRole("button",{name:/Hunks/}).click();
 await page.locator(".hunk-card").first().waitFor({timeout:12000});
 if(await page.locator(".hunk-card").count()!==2)throw Error("Native diff inspector didn't display both independent hunks");
 result.tests.push("native hunk inspector displays separate code hunks");
 await page.locator(".hunk-card .hunk-head button").nth(1).click();
 for(let n=0;n<40;n++){await wait(170);if(git("diff","--cached","--","segments.txt").includes("+MODIFIED 070"))break;}
 const staged=git("diff","--cached","--","segments.txt");
 if(!staged.includes("+MODIFIED 070")||staged.includes("+MODIFIED 005"))throw Error("Native stage hunk did not isolate the selected change");
 result.tests.push("native UI staged only selected hunk verified against Git index");
 if(fs.readFileSync(path.join(repo,"segments.txt"),"utf8")!==edited.join(""))throw Error("Native hunk action mutated working file");
 result.tests.push("native partial staging did not alter working file bytes");
 const stagedFile=page.locator(".change-group-head.staged-head").locator("xpath=following-sibling::*[1]").locator(".change-select").filter({hasText:"segments.txt"}).first();
 await stagedFile.click({timeout:12000});
 await page.getByRole("button",{name:/Hunks/}).click();
 await page.locator(".hunk-card .hunk-head button").first().click();
 for(let n=0;n<40;n++){await wait(160);if(!git("diff","--cached","--","segments.txt").trim())break;}
 if(git("diff","--cached","--","segments.txt").trim())throw Error("Native unstage hunk did not restore index");
 result.tests.push("native UI unstaged hunk independently verified");
 // Verify on-demand Windows ConPTY session lifecycle via the real packaged application.
 const invoke=(command,args={})=>page.evaluate(async([command,args])=>window.__TAURI_INTERNALS__.invoke(command,args),[command,args]);
 const beforeTerminals=await invoke("terminal_sessions");
 if(beforeTerminals.length)throw Error("Arclane has terminal children before explicit user action");
 result.tests.push("no terminal sessions launched on application startup");
 await page.getByRole("button",{name:"Open embedded terminal"}).click();
 await page.locator(".terminal-tab").first().waitFor({timeout:15000});
 let sessions=await invoke("terminal_sessions");
 if(sessions.length!==1||!sessions[0].pid)throw Error("First terminal wasn't launched in Windows ConPTY");
 if(!sessions[0].path.toLowerCase().endsWith(path.basename(repo).toLowerCase()))throw Error("Terminal cwd does not match selected repo");
 result.tests.push("on-demand Windows pseudo-terminal spawned in selected repository");
 await page.getByRole("button",{name:"New terminal tab"}).click();
 await page.locator(".terminal-tab").nth(1).waitFor({timeout:12000});
 sessions=await invoke("terminal_sessions");
 if(sessions.length!==2||sessions[0].pid===sessions[1].pid)throw Error("Independent Windows terminal tabs were not created");
 result.tests.push("two independent tabs have separate Windows process ids");
 await page.locator(".terminal-tab-close").first().click();
 for(let n=0;n<25;n++){sessions=await invoke("terminal_sessions");if(sessions.length===1)break;await wait(130);}
 if(sessions.length!==1)throw Error("Closing terminal tab did not terminate its process");
 result.tests.push("closing one terminal tab releases its session");
 await page.getByRole("button",{name:"Hide and close all terminal processes"}).click();
 for(let n=0;n<25;n++){sessions=await invoke("terminal_sessions");if(sessions.length===0)break;await wait(130);}
 if(sessions.length!==0)throw Error("Closing terminal dock leaked a session");
 result.tests.push("dismissing dock closes all pseudo-terminals");
 const screenshot=path.join(arclane,"artifacts","native-ui-hunks.png");
 await page.screenshot({path:screenshot});
 result.screenshot=screenshot;result.nativeProcessId=child.pid;
 console.log("NATIVE_UI_ACCEPTED",result.tests.length,"checks",JSON.stringify(result,null,2));
}catch(error){result.errors.push(String(error?.stack||error));console.error("NATIVE_UI_FAILURE",String(error));process.exitCode=1;}finally{
 fs.writeFileSync(path.join(arclane,"artifacts","native-ui-evidence.json"),JSON.stringify(result,null,2));
 await browser?.close().catch(()=>{});
 if(child&&child.exitCode===null){
  try{execFileSync("taskkill",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore"});}catch{}
 }
}
