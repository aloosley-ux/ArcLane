// Packaged Windows UI regression: a filename containing [] must never select its neighbour.
import fs from "node:fs";
import path from "node:path";
import {spawn,execFileSync} from "node:child_process";
import {chromium,expect} from "playwright/test";

const base=path.resolve(import.meta.dirname,"..");
const repo=fs.mkdtempSync("C:\\AI\\REA\\Experiments\\Forge-Testbed\\arclane-native-literal-");
const profile=fs.mkdtempSync(path.join(base,"artifacts","native-literal-profile-"));
const selected="notes[1].txt", neighbour="notes1.txt";
const git=(...args)=>execFileSync("git",["--literal-pathspecs","-C",repo,...args],{encoding:"utf8"}).trimEnd();
git("init","-q","-b","main");git("config","user.name","Arclane UI test");git("config","user.email","test@invalid.local");git("config","core.autocrlf","false");
for(const file of [selected,neighbour])fs.writeFileSync(path.join(repo,file),file+" original\n");
git("add","--all");git("commit","-q","-m","Literal filename fixture");
const head=git("rev-parse","HEAD");
fs.writeFileSync(path.join(repo,selected),"selected changed\n");fs.writeFileSync(path.join(repo,neighbour),"neighbour changed\n");
fs.writeFileSync(path.join(profile,"repos.json"),JSON.stringify([repo]));
const port=9381,checks=[],errors=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let child,browser,page;
const index=()=>git("diff","--cached","--name-only","-z").split("\0").filter(Boolean);
const check=async(label,condition)=>{if(!await condition())throw Error(label);checks.push(label);};
try{
 child=spawn(path.join(base,"Build","Arclane.exe"),[],{cwd:base,env:{...process.env,ARCLANE_DATA_DIR:profile,
  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`},stdio:"ignore"});
 let ready=false;
 for(let i=0;i<100;i++){
  try{if((await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(300)})).ok){ready=true;break;}}catch{}
  if(child.exitCode!==null)break;await wait(150);
 }
 if(!ready)throw Error("Packaged WebView2 debugger unavailable");
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
 for(let i=0;i<80;i++){
  page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith("http://tauri.localhost"));
  if(page)break;await wait(100);
 }
 if(!page)throw Error("Packaged Arclane page unavailable");
 page.on("pageerror",e=>errors.push(String(e)));
 await page.locator(".commit-row").first().waitFor({timeout:15000});
 const idle=async()=>{
  await expect(page.getByRole("button",{name:`Stage ${neighbour}`,exact:true})).toBeVisible();
  await expect(page.locator(".status-left")).toContainText("Ready");
  await expect(page.locator(".action-btn .spin")).toHaveCount(0);
 };
 await page.getByRole("button",{name:`Stage ${selected}`,exact:true}).click();
 await expect(page.getByRole("button",{name:`Unstage ${selected}`,exact:true})).toBeVisible();
 await idle();
 await check("Native Stage affects selected bracket filename only",()=>JSON.stringify(index())===JSON.stringify([selected]));
 await page.getByRole("button",{name:`Unstage ${selected}`,exact:true}).click();
 await expect(page.getByRole("button",{name:`Unstage ${selected}`,exact:true})).toHaveCount(0);
 await idle();
 await check("Native Unstage restores only selected index entry",()=>index().length===0);

 await page.locator(".change-select").filter({hasText:selected}).click();
 await page.locator(".comparison-row.changed").filter({hasText:"selected changed"}).waitFor();
 await page.getByRole("button",{name:"Patch",exact:true}).click();
 await expect(page.getByRole("region",{name:"Git diff"})).toContainText("selected changed");
 await expect(page.getByRole("region",{name:"Git diff"})).not.toContainText("neighbour changed");
 checks.push("Native patch preview contains only selected filename");
 await page.getByRole("button",{name:/^Hunks/}).click();
 const stageHunk=page.getByRole("button",{name:"Stage hunk",exact:true});
 await expect(stageHunk).toHaveCount(1);await stageHunk.click();
 await expect(page.getByRole("button",{name:`Unstage ${selected}`,exact:true})).toBeVisible();
 // Hunk reinspection finishes after the index mutation. Wait for the whole operation.
 await expect(page.getByRole("button",{name:"Stage hunk",exact:true})).toHaveCount(0);
 await idle();
 await check("Native hunk stages selected file without neighbour",()=>JSON.stringify(index())===JSON.stringify([selected]));
 await page.locator(".staged-head").locator("xpath=following-sibling::*[1]").locator(".change-select").filter({hasText:selected}).click();
 await page.getByRole("button",{name:/^Hunks/}).click();
 const unstageHunk=page.getByRole("button",{name:"Unstage hunk",exact:true});
 await expect(unstageHunk).toBeEnabled();await unstageHunk.click();
 await expect(page.getByRole("button",{name:`Unstage ${selected}`,exact:true})).toHaveCount(0);
 await idle();
 await check("Native reverse hunk restores selected index without changing either working file",()=>index().length===0&&fs.readFileSync(path.join(repo,selected),"utf8")==="selected changed\n"&&fs.readFileSync(path.join(repo,neighbour),"utf8")==="neighbour changed\n");

 await page.getByRole("button",{name:`Discard unstaged changes in ${selected}`,exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Discard file changes"});
 await dialog.getByLabel("Confirmation",{exact:true}).fill("DISCARD");
 await dialog.getByRole("button",{name:"Discard file changes",exact:true}).click();
 await expect(page.getByRole("button",{name:`Discard unstaged changes in ${selected}`,exact:true})).toHaveCount(0);
 await idle();
 await check("Native confirmed discard preserves neighbouring working file",()=>fs.readFileSync(path.join(repo,selected),"utf8")===selected+" original\n"&&fs.readFileSync(path.join(repo,neighbour),"utf8")==="neighbour changed\n");
 await check("UI file actions preserve HEAD and leave a clean index",()=>git("rev-parse","HEAD")===head&&index().length===0);
 await check("Packaged renderer reports no JavaScript errors",()=>errors.length===0);
 await page.screenshot({path:path.join(base,"artifacts","native-literal-paths.png")});
 console.log("NATIVE_LITERAL_PATHS_ACCEPTED",checks.length,JSON.stringify(checks));
}catch(e){errors.push(String(e?.stack||e));console.error("NATIVE_LITERAL_PATHS_FAILURE",String(e));process.exitCode=1;
 if(page)await page.screenshot({path:path.join(base,"artifacts","native-literal-paths-failure.png")}).catch(()=>{});
}finally{
 fs.writeFileSync(path.join(base,"artifacts","native-literal-paths-acceptance.json"),JSON.stringify({repo,checks,errors},null,2));
 await browser?.close().catch(()=>{});
 if(child&&child.exitCode===null){try{execFileSync("taskkill",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore"});}catch{}}
}
