import fs from "node:fs";import path from "node:path";
import{spawn,execFileSync}from "node:child_process";
import{chromium}from "playwright";
const base=(process.env.ARCLANE_TEST_ROOT||path.resolve(import.meta.dirname,".."));
const repo=fs.mkdtempSync("C:\\AI\\REA\\Experiments\\Forge-Testbed\\arclane-native-provider-");
const profile=fs.mkdtempSync(path.join(base,"artifacts","native-provider-profile-"));
const data=path.join(profile,"github-fixtures");fs.mkdirSync(data);
for(const file of fs.readdirSync(path.join(base,"scripts","github-fixtures")))fs.copyFileSync(path.join(base,"scripts","github-fixtures",file),path.join(data,file));
if(!fs.existsSync(path.join(base,"artifacts","mock-gh","gh.exe")))throw Error("Hermetic mock gh.exe missing; refusing to launch provider tests");
const log=path.join(base,"artifacts","native-provider-mock-gh.log");
fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(log,"");
const git=(...a)=>execFileSync("git",["-C",repo,...a],{encoding:"utf8"}).trim();
git("init","-b","main","-q");git("config","user.name","Arclane Test");git("config","user.email","test@invalid.local");
fs.writeFileSync(path.join(repo,"README.md"),"test\n");git("add","--all");git("commit","-m","mock data fixture");
const prior=git("status","--porcelain");
fs.writeFileSync(path.join(profile,"repos.json"),JSON.stringify([repo]));
const port=9377;
const checks=[],errors=[];let browser,child;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const env={...process.env,PATH:path.join(base,"artifacts","mock-gh")+";"+process.env.PATH,
 ARCLANE_DATA_DIR:profile,
 ARCLANE_GH_MOCK_DATA:data,
 ARCLANE_GH_MOCK_LOG:log,
 WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:"--remote-debugging-port="+port+" --remote-debugging-address=127.0.0.1"};
try{
 child=spawn(path.join(base,"Build","Arclane.exe"),[],{cwd:path.join(base,"Build"),env,stdio:"ignore"});
 let ready=false;for(let i=0;i<110;i++){try{if((await fetch("http://127.0.0.1:"+port+"/json/version",{signal:AbortSignal.timeout(300)})).ok){ready=true;break;}}catch{}await wait(170);}
 if(!ready)throw Error("Production WebView2 debugger did not start");
 browser=await chromium.connectOverCDP("http://127.0.0.1:"+port);
 let page;for(let i=0;i<70;i++){page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith("http://tauri.localhost"));if(page)break;await wait(140);}
 if(!page)throw Error("Production Arclane interface not found");
 page.on("pageerror",e=>errors.push(String(e)));
 await page.getByRole("button",{name:"Pull requests and CI"}).first().click();
 await page.locator(".collab-item").first().waitFor({timeout:15000});
 if(await page.locator(".collab-item").count()!==4)throw Error("Expected four mocked GitHub pull requests");
 checks.push("native GitHub PR list displays four fixture records");
 await page.getByRole("button",{name:/PR stacks/}).click();
 await page.locator(".collab-stack-entry").nth(3).waitFor({timeout:7000});
 const groups=await page.locator(".collab-stack").count();
 const grouped=await page.locator(".collab-stack").first().locator(".collab-stack-entry").count();
 if(groups!==2||grouped!==3)throw Error("Expected 3-chain + standalone PR, got groups="+groups+" chain="+grouped);
 checks.push("native stacked PR graph reconstructs one three-layer stack plus standalone");
 await page.locator(".collab-stack-entry").filter({hasText:"#13"}).click();
 await page.getByText("Payment integration",{exact:true}).last().waitFor({timeout:9000});
 await page.getByText("src/payments.ts",{exact:true}).waitFor({timeout:9000});
 checks.push("native PR detail shows changed files from isolated fixture");
 await page.getByRole("button",{name:/Issues/}).click();
 await page.locator(".collab-item").filter({hasText:"Improve payment retries"}).click();
 await page.getByText("Retry failures",{exact:true}).waitFor({timeout:9000});
 checks.push("native issue details and assignees read from mock");
 await page.getByRole("button",{name:/CI runs/}).click();
 await page.locator(".collab-item").filter({hasText:"Build and test"}).waitFor({timeout:9000});
 checks.push("native CI runs view shows fixture workflow");
 if(git("status","--porcelain")!==prior)throw Error("GitHub mock interface changed Git repository");
 checks.push("mock interaction leaves repository state untouched");
 if(errors.length)throw Error(errors.join("\n"));
 checks.push("native renderer has no JavaScript exceptions");
 const calls=fs.readFileSync(log,"utf8");if(!calls.includes("pr\tlist")||!calls.includes("issue\tlist"))throw Error("Expected invocation log was not written by local mocked gh");
 checks.push("all provider reads routed to local mock gh.exe");
 // A failed refresh must not keep presenting records from the previous successful feed.
 fs.renameSync(path.join(data,"prs.json"),path.join(data,"prs-unavailable.json"));
 await page.getByRole("button",{name:/Pull requests \d/}).click();
 await page.getByRole("button",{name:"Refresh GitHub"}).click();
 await page.locator(".collab-diagnostics").waitFor({timeout:9000});
 if(await page.locator(".collab-item").count()!==0)throw Error("Failed PR feed retained stale records");
 checks.push("failed mock PR feed clears obsolete PR records");
 await page.getByRole("button",{name:/Issues/}).click();
 await page.locator(".collab-item").filter({hasText:"Improve payment retries"}).waitFor({timeout:9000});
 checks.push("unavailable PR feed preserves independently successful issue feed");
 fs.renameSync(path.join(data,"prs-unavailable.json"),path.join(data,"prs.json"));
 await page.getByRole("button",{name:"Refresh GitHub"}).click();
 await page.getByRole("button",{name:/Pull requests \d/}).click();
 await page.locator(".collab-item").nth(3).waitFor({timeout:9000});
 checks.push("mock PR feed recovers on an explicit retry");
 if(git("status","--porcelain")!==prior)throw Error("Feed failure/retry changed the Git repository");
 if(errors.length)throw Error(errors.join("\n"));
 console.log("NATIVE_COLLAB_MOCK_ACCEPTED",checks.length,JSON.stringify(checks));
}catch(e){errors.push(String(e?.stack||e));console.error("NATIVE_COLLAB_MOCK_FAILURE",String(e));process.exitCode=1;}
finally{fs.writeFileSync(path.join(base,"artifacts","native-collab-mock-acceptance.json"),JSON.stringify({checks,errors,repo,note:"Fixture/mocked gh only — no real GitHub integration acceptance"},null,2));await browser?.close().catch(()=>{});if(child&&child.exitCode===null){try{execFileSync("taskkill",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore"});}catch{}}}
