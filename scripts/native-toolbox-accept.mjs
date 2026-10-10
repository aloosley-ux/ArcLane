import fs from "node:fs";
import path from "node:path";
import{spawn,execFileSync}from "node:child_process";
import{chromium}from "playwright";
const base=(process.env.ARCLANE_TEST_ROOT||path.resolve(import.meta.dirname,".."));
const fixtures="C:\\AI\\REA\\Experiments\\Forge-Testbed";
const root=fs.mkdtempSync(path.join(fixtures,"arclane-toolbox-ui-"));
const repo=path.join(root,"repository");const bare=path.join(root,"remote.git");fs.mkdirSync(repo);
const git=(...args)=>execFileSync("git",["-C",repo,...args],{encoding:"utf8"}).trim();
const remoteGit=(...args)=>execFileSync("git",["-C",bare,...args],{encoding:"utf8"}).trim();
git("init","-q","-b","main");git("config","user.name","Arclane UI Test");git("config","user.email","native@local.invalid");
fs.writeFileSync(path.join(repo,"test.txt"),"original\n","utf8");git("add","--all");git("commit","-m","initial");
git("branch","develop");git("init","--bare",bare);
const baseline=git("rev-parse","HEAD");
const profile=path.join(base,"artifacts","native-toolbox-profile");
fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(path.join(profile,"repos.json"),JSON.stringify([repo]));
const tests=[];const errors=[];let child,browser;const port=9359;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function command(page,modalTitle,phrase){
 const dialog=page.getByRole("dialog",{name:modalTitle});
 await dialog.waitFor({timeout:7000});
 await dialog.getByRole("textbox",{name:"Confirmation phrase"}).fill(phrase);
 await dialog.getByRole("button",{name:"Confirm operation"}).click();
 await dialog.waitFor({state:"hidden",timeout:12000});
}
try{
 child=spawn(path.join(base,"Build","Arclane.exe"),[],{cwd:path.join(base,"Build"),env:{...process.env,ARCLANE_DATA_DIR:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:"--remote-debugging-port="+port+" --remote-debugging-address=127.0.0.1"},stdio:"ignore"});
 let listening=false;for(let i=0;i<100;i++){try{if((await fetch("http://127.0.0.1:"+port+"/json/version",{signal:AbortSignal.timeout(400)})).ok){listening=true;break;}}catch{}await wait(200);}
 if(!listening)throw Error("WebView2 debug endpoint absent");
 browser=await chromium.connectOverCDP("http://127.0.0.1:"+port);
 let page;for(let i=0;i<70;i++){page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith("http://tauri.localhost"));if(page)break;await wait(150);}
 if(!page)throw Error("Production WebView2 page absent");
 page.on("pageerror",e=>errors.push(String(e)));
 await page.getByRole("button",{name:"Repository tools"}).first().click();
 await page.locator(".rtools").waitFor({timeout:14000});
 await page.locator(".rtools-none").first().waitFor({timeout:14000});
 tests.push("native window mounts on-demand Repository Tools workspace");
 await page.getByRole("textbox",{name:"Remote name"}).fill("origin");
 await page.getByRole("textbox",{name:"HTTPS, SSH or local Git path"}).fill(bare);
 await page.locator(".rtools-form").getByRole("button",{name:"Add remote"}).click();
 await command(page,"Add remote","ADD");
 for(let i=0;i<35;i++){await wait(100);if(git("remote").includes("origin"))break;}
 if(git("remote").trim()!=="origin"||git("remote","get-url","origin")!==bare)throw Error("Native Add remote didn't write correct Git configuration");
 tests.push("native Add remote dialog writes exact configured URL");
 await page.locator(".rtools-nav > button").filter({hasText:"Gitflow"}).click();
 await page.getByRole("textbox",{name:"Branch suffix"}).fill("native-ui");
 await page.getByRole("button",{name:"Create branch"}).click();
 await command(page,"Start Gitflow feature","START");
 for(let i=0;i<45;i++){await wait(90);if(git("branch","--show-current")==="feature/native-ui")break;}
 if(git("branch","--show-current")!=="feature/native-ui"||git("merge-base","HEAD","develop")!==baseline)throw Error("Native Gitflow start didn't switch to correct branch");
 tests.push("native Gitflow creates feature branch at develop base");
 await page.locator(".rtools-nav > button").filter({hasText:"Recovery"}).click();
 const rescue=page.locator(".rtools-reflog-row").first();
 await rescue.waitFor({timeout:12000});
 await rescue.getByRole("button",{name:"Rescue"}).click();
 const dialog=page.getByRole("dialog",{name:"Create recovery branch"});
 await dialog.getByRole("textbox",{name:"New branch name"}).fill("rescue/ui-snapshot");
 await command(page,"Create recovery branch","RESCUE");
 if(git("rev-parse","refs/heads/rescue/ui-snapshot")!==git("rev-parse","HEAD"))throw Error("Native reflog rescue not created at current hash");
 tests.push("native reflog rescue creates non-destructive recovery branch");
 await page.locator(".rtools-nav > button").filter({hasText:"Git LFS"}).click();
 await page.getByRole("textbox",{name:"Tracking pattern"}).fill("*.psd");
 await page.getByRole("button",{name:"Track pattern"}).click();
 await command(page,"Track LFS pattern","TRACK");
 const attr=fs.readFileSync(path.join(repo,".gitattributes"),"utf8");
 if(!attr.includes("*.psd"))throw Error("Native LFS tracking did not update .gitattributes");
 tests.push("native LFS track updates exact .gitattributes pattern");
 await page.locator(".rtools-nav > button").filter({hasText:"Tags"}).click();
 const tagForm=page.locator(".rtools-form").first();
 await tagForm.getByRole("textbox",{name:"Tag name"}).fill("v0.9-ui");
 await tagForm.getByRole("textbox",{name:"Annotation"}).fill("Native UI acceptance release");
 await tagForm.getByRole("button",{name:"Create tag"}).click();
 await command(page,"Create annotated tag","TAG");
 if(git("cat-file","-t","refs/tags/v0.9-ui")!=="tag")throw Error("Native UI tag not annotated");
 tests.push("native annotated tag preserves Git tag-object type");
 await page.locator(".rtools-nav > button").filter({hasText:"Submodules"}).click();
 await page.getByRole("button",{name:"Sync submodule URLs"}).click();
 await command(page,"Sync submodule URLs","SYNC");
 if(git("status","--short").includes("UU"))throw Error("Submodule action damaged repository");
 tests.push("native submodule synchronisation leaves clean index state");
 if(errors.length)throw Error("Native renderer errors: "+errors.join("; "));
 tests.push("zero native renderer JavaScript errors");
 console.log("NATIVE_TOOLBOX_ACCEPTED",tests.length,JSON.stringify(tests));
}catch(err){errors.push(String(err?.stack||err));console.error("NATIVE_TOOLBOX_FAILED",String(err));process.exitCode=1;}
finally{fs.writeFileSync(path.join(base,"artifacts","toolbox-ui-acceptance.json"),JSON.stringify({repo,remote:bare,checks:tests,errors},null,2));await browser?.close().catch(()=>{});if(child&&child.exitCode===null){try{execFileSync("taskkill",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore"});}catch{}}}
