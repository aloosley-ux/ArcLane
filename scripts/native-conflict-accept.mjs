import fs from "node:fs";
import path from "node:path";
import {spawn,execFileSync} from "node:child_process";
import {chromium} from "playwright";

const root=(process.env.ARCLANE_TEST_ROOT||path.resolve(import.meta.dirname,".."));
const testbed="C:\\AI\\REA\\Experiments\\Forge-Testbed";
const repo=fs.mkdtempSync(path.join(testbed,"arclane-conflict-native-"));
const exe=path.join(root,"Build","Arclane.exe");
const profile=path.join(root,"artifacts","native-conflict-profile");
const git=(...args)=>execFileSync("git",["-C",repo,...args],{encoding:"utf8"}).trim();
const write=(name,contents)=>fs.writeFileSync(path.join(repo,name),contents,"utf8");
git("init","-b","main");git("config","user.name","Arclane native acceptance");git("config","user.email","tests@localhost.invalid");
write("choice.txt","header\nshared\nfooter\n");write("manual.txt","first\nshared\nlast\n");
git("add","--all");git("commit","-m","base");git("branch","incoming");
write("choice.txt","header\nOURS\nfooter\n");write("manual.txt","first\nOUR SIDE\nlast\n");
git("add","--all");git("commit","-m","ours");git("switch","incoming");
write("choice.txt","header\nTHEIRS\nfooter\n");write("manual.txt","first\nOTHER SIDE\nlast\n");
git("add","--all");git("commit","-m","theirs");git("switch","main");
try{git("merge","incoming","--no-edit")}catch{}
if(git("ls-files","-u").split("\n").length<4)throw Error("Failed to construct two merge conflicts");
fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(path.join(profile,"repos.json"),JSON.stringify([repo]));
const result={tests:[],issues:[],repo,mode:"production Windows Arclane with WebView2 CDP and Git index verification"};
let child,browser;const wait=ms=>new Promise(r=>setTimeout(r,ms));const port=9363;
try{
 child=spawn(exe,[],{cwd:path.dirname(exe),env:{...process.env,ARCLANE_DATA_DIR:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:"--remote-debugging-port="+port+" --remote-debugging-address=127.0.0.1"},stdio:"ignore"});
 let ready=false;
 for(let n=0;n<90;n++){await wait(200);try{const res=await fetch("http://127.0.0.1:"+port+"/json/version",{signal:AbortSignal.timeout(300)});if(res.ok){ready=true;break;}}catch{}}
 if(!ready)throw Error("Native CDP unavailable");
 browser=await chromium.connectOverCDP("http://127.0.0.1:"+port);
 let page;
 for(let i=0;i<50;i++){page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith("http://tauri.localhost"));if(page)break;await wait(150);}
 if(!page)throw Error("Embedded production renderer not found");
 const pageErrors=[];page.on("pageerror",e=>pageErrors.push(String(e)));
 const conflictRows=page.locator(".change-resolve");
 await conflictRows.first().waitFor({timeout:20000});
 if(await conflictRows.count()!==2)throw Error("Expected two unresolved file actions");
 result.tests.push("Two real conflicted files show dedicated Resolve actions");
 await page.locator(".change-row").filter({hasText:"choice.txt"}).getByRole("button",{name:"Resolve"}).click();
 await page.getByRole("dialog",{name:"Resolve conflict: choice.txt"}).waitFor({timeout:8000});
 const modal=page.locator(".merge-overlay");
 await modal.locator(".merge-source").nth(2).waitFor({timeout:15000});
 await modal.locator(".merge-source-code").nth(2).waitFor({timeout:15000});
 const sourceText=await modal.locator(".merge-columns").innerText();
 if(!sourceText.includes("OURS")||!sourceText.includes("THEIRS"))throw Error("Three-way panes do not show both alternatives: "+sourceText.slice(0,700));
 result.tests.push("Three-way conflict dialog shows both indexed branch versions");
 if(!git("ls-files","-u").includes("choice.txt"))throw Error("Merely opening resolver modified Git index");
 await modal.getByRole("button",{name:"Use theirs"}).click();
 await modal.getByRole("button",{name:"Resolve and stage"}).click();
 await modal.waitFor({state:"hidden",timeout:12000});
 if(fs.readFileSync(path.join(repo,"choice.txt"),"utf8")!=="header\nTHEIRS\nfooter\n")throw Error("Use theirs did not write exact source bytes");
 if(git("ls-files","-u").includes("choice.txt"))throw Error("Use theirs did not stage resolution");
 result.tests.push("Accept theirs applies exact bytes and stages selected file only");
 await page.locator(".change-row").filter({hasText:"manual.txt"}).getByRole("button",{name:"Resolve"}).click();
 await page.getByRole("dialog",{name:"Resolve conflict: manual.txt"}).waitFor({timeout:12000});
 await page.getByRole("textbox",{name:"Manual resolution editor"}).fill("first\nBOTH CHANGES RECONCILED\nlast\n");
 await page.getByRole("button",{name:"Resolve and stage"}).click();
 await page.locator(".merge-overlay").waitFor({state:"hidden",timeout:12000});
 if(fs.readFileSync(path.join(repo,"manual.txt"),"utf8")!=="first\nBOTH CHANGES RECONCILED\nlast\n")throw Error("Manual merge output mismatch");
 if(git("ls-files","-u")!=="")throw Error("Unmerged index entries remain");
 result.tests.push("Manual resolution stages exact editor content; unmerged index empty");
 await page.locator(".sequencer-banner").getByRole("button",{name:"Continue"}).click();
 for(let i=0;i<50;i++){await wait(170);if(git("rev-list","--parents","-n","1","HEAD").split(" ").length===3)break;}
 if(git("rev-list","--parents","-n","1","HEAD").split(" ").length!==3)throw Error("Merge Continue did not finish two-parent commit");
 result.tests.push("Native Continue finishes merge with both parent SHAs preserved");
 if(pageErrors.length)throw Error("Native JavaScript errors "+pageErrors.join("\n"));
 result.tests.push("Zero frontend exceptions in full conflict flow");
 result.screenshot=path.join(root,"artifacts","native-conflict-accepted.png");await page.screenshot({path:result.screenshot});
 console.log("NATIVE_CONFLICT_ACCEPTED",result.tests.length,JSON.stringify(result,null,2));
}catch(error){result.issues.push(String(error?.stack||error));console.error("NATIVE_CONFLICT_FAILED",String(error));process.exitCode=1;}
finally{
 fs.writeFileSync(path.join(root,"artifacts","native-conflict-evidence.json"),JSON.stringify(result,null,2));
 await browser?.close().catch(()=>{});
 if(child&&child.exitCode===null){try{execFileSync("taskkill",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore"});}catch{}}
}
