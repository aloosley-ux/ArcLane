import fs from "node:fs";import path from "node:path";import{spawn,execFileSync}from "node:child_process";import{chromium}from "playwright";
const base=(process.env.ARCLANE_TEST_ROOT||path.resolve(import.meta.dirname,".."));
const repo="C:\\AI\\REA\\Experiments\\Forge-Testbed\\forge-history-pages-dhdxjlfk";
const exe=path.join(base,"Build","Arclane.exe");
const profile=fs.mkdtempSync(path.join(base,"artifacts","history-native-profile-"));
if(!fs.existsSync(repo))throw Error("811-commit fixture missing");
fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(path.join(profile,"repos.json"),JSON.stringify([repo]));
const port=9358;
let child,browser;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const evidence={repo,tests:[],issues:[]};
try{
 child=spawn(exe,[],{cwd:path.dirname(exe),env:{...process.env,ARCLANE_DATA_DIR:profile,WEBVIEW2_USER_DATA_FOLDER:path.join(profile,"webview2"),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:"--remote-debugging-port="+port+" --remote-debugging-address=127.0.0.1"},stdio:"ignore"});
 let ready=false;
 for(let i=0;i<80;i++){await sleep(200);try{if((await fetch("http://127.0.0.1:"+port+"/json/version",{signal:AbortSignal.timeout(350)})).ok){ready=true;break}}catch{}}
 if(!ready)throw Error("WebView2 CDP unavailable");
 browser=await chromium.connectOverCDP("http://127.0.0.1:"+port);
 let page;
 for(let i=0;i<50;i++){
  page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith("http://tauri.localhost"));
  if(page)break;await sleep(150);
 }
 if(!page)throw Error("Native application did not load embedded frontend");
 const errors=[];page.on("pageerror",e=>errors.push(String(e)));
 await page.getByText("350+",{exact:false}).first().waitFor({timeout:15000});
 const firstRows=await page.locator(".commit-row").count();
 if(firstRows>85||firstRows<8)throw Error("History not virtualized at 350 commits: "+firstRows);
 evidence.tests.push("350 real commits use only "+firstRows+" mounted DOM rows");
 for(const expected of [700,811]){
  const button=page.locator(".history-more");await button.scrollIntoViewIfNeeded({timeout:20000});await button.click();
  await page.locator(".commit-count").filter({hasText:String(expected)}).waitFor({timeout:15000});
  const rows=await page.locator(".commit-row").count();
  if(rows>85)throw Error("Virtualization lost after "+expected+" commits: "+rows);
  evidence.tests.push(expected+" loaded Git commits, "+rows+" DOM rows");
 }
 const scrollbar=page.locator(".graph-scroll");
 await scrollbar.evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event("scroll",{bubbles:true}));});
 await sleep(400);
 const visible=await page.locator(".commit-row").allTextContents();
 if(!visible.some(s=>s.includes("0000")))throw Error("Oldest commit not reachable after page load; visible "+visible.slice(-4).join(";"));
 evidence.tests.push("scrolling to end reaches oldest commit, without mounted-list explosion");
 if(errors.length)throw Error("Frontend page errors: "+errors.join("; "));
 evidence.tests.push("zero native renderer JavaScript errors");
 evidence.renderedRows=await page.locator(".commit-row").count();evidence.pageUrl=page.url();
 console.log("GRAPH_VIRTUAL_ACCEPTED",JSON.stringify(evidence,null,2));
}catch(e){evidence.issues.push(String(e?.stack||e));console.error("GRAPH_TEST_FAILED",String(e));process.exitCode=1}
finally{
 fs.writeFileSync(path.join(base,"artifacts","graph-native-acceptance.json"),JSON.stringify(evidence,null,2));
 await browser?.close().catch(()=>{});
 if(child&&child.exitCode===null){try{execFileSync("taskkill",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore"})}catch{}}
}
