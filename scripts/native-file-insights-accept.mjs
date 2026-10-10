import fs from "node:fs";
import path from "node:path";
import {spawn,execFileSync} from "node:child_process";
import {chromium} from "playwright";
const base="C:\\AI\\REA\\Experiments\\Arclane";
const repo=fs.mkdtempSync("C:\\AI\\REA\\Experiments\\Forge-Testbed\\arclane-blame-native-");
const profile=path.join(base,"artifacts","blame-ui-profile");
const exe=path.join(base,"Build","Arclane.exe");
const git=(...a)=>execFileSync("git",["-C",repo,...a],{encoding:"utf8"}).trim();
const file="contributor notes.txt";
const write=text=>fs.writeFileSync(path.join(repo,file),text,"utf8");
git("init","-q","-b","main");git("config","user.email","acceptance@local.invalid");
git("config","user.name","Alice");write("first\nsecond\nthird\nfourth\n");
git("add","--all");git("commit","-m","Alice created notes");
git("config","user.name","Bob");write("first\nBob updated second\nthird\nfourth\n");
git("add","--all");git("commit","-m","Bob revised notes");
git("config","user.name","Charlie");write("first\nBob updated second\nthird\nCharlie revised fourth\n");
git("add","--all");git("commit","-m","Charlie updated fourth");
const commit=git("rev-parse","HEAD");
write("first\nBob updated second\nworking tree edit\nCharlie revised fourth\n");
const priorStatus=git("status","--porcelain");
fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(path.join(profile,"repos.json"),JSON.stringify([repo]));
const out={repo,checks:[],errors:[]};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let child,browser;const port=9376;
try{
 child=spawn(exe,[],{cwd:path.dirname(exe),env:{...process.env,ARCLANE_DATA_DIR:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:"--remote-debugging-port="+port+" --remote-debugging-address=127.0.0.1"},stdio:"ignore"});
 for(let n=0;n<95;n++){try{if((await fetch("http://127.0.0.1:"+port+"/json/version",{signal:AbortSignal.timeout(250)})).ok)break;}catch{}await sleep(140);}
 browser=await chromium.connectOverCDP("http://127.0.0.1:"+port);
 let page;for(let n=0;n<60;n++){page=browser.contexts().flatMap(c=>c.pages()).find(x=>x.url().startsWith("http://tauri.localhost"));if(page)break;await sleep(140);}
 if(!page)throw Error("Production renderer unavailable");
 const errors=[];page.on("pageerror",e=>errors.push(String(e)));
 const launch=page.getByRole("button",{name:"File history and blame "+file});
 await launch.waitFor({timeout:20000});await launch.click();
 const dialog=page.getByRole("dialog",{name:"File insights: "+file});
 await dialog.waitFor({timeout:8000});
 await dialog.locator(".insights-commit").nth(2).waitFor({timeout:8000});
 if(await dialog.locator(".insights-commit").count()!==3)throw Error("Expected three file-specific commits");
 out.checks.push("Native file history lists all three real contributor commits");
 await dialog.locator(".insights-preview .comparison-row.changed").first().waitFor({timeout:9000});
 const initialText=await dialog.locator(".insights-preview .comparison-row.changed").allTextContents();
 if(!initialText.join(" ").includes("Charlie revised fourth"))throw Error("Historical comparison did not show selected commit file content");
 out.checks.push("Historical commit selection displays exact parent-vs-commit change");
 await dialog.getByRole("button",{name:/Line blame/}).click();
 await dialog.locator(".insights-blame-row").nth(3).waitFor({timeout:9000});
 const attribution=await dialog.locator(".insights-blame-row").allTextContents();
 if(attribution.length!==4||!attribution[0].includes("Alice")||!attribution[1].includes("Bob")||!attribution[3].includes("Charlie")){
    throw Error("Incorrect line authorship: "+JSON.stringify(attribution));
 }
 out.checks.push("Blame displays line authors Alice, Bob and Charlie in correct positions");
 await dialog.getByRole("textbox",{name:"Search file insights"}).fill("Bob");
 if(await dialog.locator(".insights-blame-row").count()!==1)throw Error("Line blame search filter did not isolate Bob");
 out.checks.push("Search filters blame by author without modifying Git");
 await dialog.getByRole("button",{name:"Close file insights"}).click();
 if(git("status","--porcelain")!==priorStatus||git("rev-parse","HEAD")!==commit)throw Error("File insights changed repository state");
 out.checks.push("Entire file history and blame flow leaves Git tree, index and refs unchanged");
 if(errors.length)throw Error("Renderer exceptions: "+errors.join("; "));
 out.checks.push("No production WebView2 JavaScript errors");
 console.log("NATIVE_FILE_INSIGHTS_ACCEPTED",out.checks.length,JSON.stringify(out,null,2));
}catch(e){out.errors.push(String(e?.stack||e));console.error("NATIVE_INSIGHTS_FAILURE",String(e));process.exitCode=1}
finally{fs.writeFileSync(path.join(base,"artifacts","native-file-insights-acceptance.json"),JSON.stringify(out,null,2));await browser?.close().catch(()=>{});if(child&&child.exitCode===null){try{execFileSync("taskkill",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore"})}catch{}}}
