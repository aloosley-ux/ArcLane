// Delay real Tauri replies to exercise tab-switch races. Git work still runs in fresh fixtures.
import fs from "node:fs";
import path from "node:path";
import {spawn,execFileSync} from "node:child_process";
import {chromium,expect} from "playwright/test";

const base=path.resolve(import.meta.dirname,"..");
const fixture=fs.mkdtempSync("C:\\AI\\REA\\Experiments\\Forge-Testbed\\arclane-state-");
const repoA=path.join(fixture,"repo-a"),repoB=path.join(fixture,"repo-b");
const profile=fs.mkdtempSync(path.join(base,"artifacts","native-state-profile-"));
const git=(repo,...args)=>execFileSync("git",["--literal-pathspecs","-C",repo,...args],{encoding:"utf8"}).trimEnd();
for(const [repo,label] of [[repoA,"A"],[repoB,"B"]]){
 fs.mkdirSync(repo);git(repo,"init","-q","-b","main");git(repo,"config","user.name","Arclane state test");git(repo,"config","user.email","test@invalid.local");git(repo,"config","core.autocrlf","false");
 fs.writeFileSync(path.join(repo,"shared.txt"),label+" original\n");git(repo,"add","--all");git(repo,"commit","-q","-m",label+" seed");
}
let imported="";
for(let i=0;i<360;i++){
 const text=`A history ${i}\n`;
 imported+=`commit refs/heads/main\ncommitter Arclane state test <test@invalid.local> ${1700000000+i} +0000\ndata ${Buffer.byteLength(text)}\n${text}`;
 if(i===0)imported+=`from ${git(repoA,"rev-parse","HEAD")}\n`;
 imported+=`M 100644 inline history.txt\ndata ${Buffer.byteLength(text)}\n${text}\n`;
}
execFileSync("git",["-C",repoA,"fast-import","--quiet"],{input:imported});
git(repoA,"restore","--source=HEAD","--staged","--worktree","--",".");
fs.writeFileSync(path.join(repoA,"shared.txt"),"A working\n");
fs.writeFileSync(path.join(repoB,"shared.txt"),"B working\n");
git(repoB,"remote","add","state-only",repoA);
const beforeB={head:git(repoB,"rev-parse","HEAD"),index:git(repoB,"write-tree"),bytes:fs.readFileSync(path.join(repoB,"shared.txt"),"utf8")};
fs.writeFileSync(path.join(profile,"repos.json"),JSON.stringify([repoA,repoB]));
const port=9383,checks=[],errors=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let child,browser,page;
const switchTo=async(name)=>{
 await page.locator(".repo-tab").filter({hasText:name}).click();
 await expect(page.locator(".identity-text b")).toHaveText(name,{timeout:12000});
 await expect(page.locator(".status-left")).toContainText("Ready");
};
const hold=async(commands,skip=null)=>page.evaluate(({commands,skip})=>{
 // Tauri's invoke API is immutable. Its callback Map lets this test delay delivery
 // of real backend results without replacing commands, data or native execution.
 const registry=window.__TAURI_INTERNALS__.callbacks,originalGet=registry.get;
 const gate={pending:0,releases:[],registry,originalGet,calls:[]};window.__arclaneGate=gate;
 registry.get=function(id){
  const callback=originalGet.call(this,id);
  if(!callback)return callback;
  return data=>{
   gate.calls.push(data&&typeof data==="object"?Object.keys(data):[typeof data]);
   const matches=data&&typeof data==="object"&&(
    commands.includes("file_diff")&&data.file==="shared.txt"&&typeof data.text==="string"||
    commands.includes("get_hunks")&&data.file==="shared.txt"&&Array.isArray(data.hunks)||
    commands.includes("compare_file")&&data.file==="shared.txt"&&typeof data.before==="string"||
    commands.includes("commits")&&data.skip===skip&&Array.isArray(data.commits)||
    commands.includes("git_action")&&data.command==="git add -- shared.txt"||
    commands.includes("toolbox_view")&&Array.isArray(data.remotes));
   if(matches){gate.pending++;gate.releases.push(()=>callback(data));return;}
   return callback(data);
  };
 };
},{commands,skip});
const pending=async(count)=>page.waitForFunction(count=>window.__arclaneGate.pending===count,count,{timeout:12000});
const release=async()=>{
 await page.evaluate(()=>{const gate=window.__arclaneGate;gate.registry.get=gate.originalGet;gate.releases.forEach(fn=>fn());});
 // Allow released Promise chains and React's next rendering task to settle.
 await wait(250);
};
const check=(label,condition)=>{if(!condition)throw Error(label);checks.push(label);};
try{
 child=spawn(path.join(base,"Build","Arclane.exe"),[],{cwd:base,env:{...process.env,ARCLANE_DATA_DIR:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`},stdio:"ignore"});
 let ready=false;
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(300)})).ok){ready=true;break;}}catch{}if(child.exitCode!==null)break;await wait(150);}
 if(!ready)throw Error("Packaged debugger unavailable");
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
 for(let i=0;i<80;i++){page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith("http://tauri.localhost"));if(page)break;await wait(100);}
 if(!page)throw Error("Packaged app page unavailable");
 page.on("pageerror",e=>errors.push(String(e)));
 await expect(page.locator(".commit-count")).toHaveText("350+ commits",{timeout:12000});

 await hold(["file_diff","get_hunks","compare_file"]);
 await page.locator(".change-select").filter({hasText:"shared.txt"}).click();
 await pending(3);await switchTo("repo-b");await release();
 check("Delayed file replies cannot display repo A content in repo B",!(await page.locator(".right-diff").innerText()).includes("A working"));
 check("Repository switch clears previous diff title and selected file",!(await page.locator(".right-diff-heading").innerText()).includes("shared.txt")&&await page.locator(".change-row.selected").count()===0);

 await switchTo("repo-a");await hold(["commits"],350);
 await page.getByRole("button",{name:/Load older commits/}).click();await pending(1);
 await switchTo("repo-b");await release();
 check("Delayed history page cannot append repo A commits to repo B",await page.locator(".commit-count").innerText()==="1 commits"&&await page.locator(".commit-subject").allTextContents().then(items=>items.every(text=>text==="B seed")));

 await switchTo("repo-a");await hold(["git_action"]);
 await page.getByRole("button",{name:"Stage shared.txt",exact:true}).click();await pending(1);
 check("Delayed action performed only the explicit repo A index mutation",git(repoA,"diff","--cached","--name-only")==="shared.txt");
 await switchTo("repo-b");await switchTo("repo-a");
 await page.getByRole("textbox",{name:"Commit summary"}).fill("Do not commit while an operation is pending");
 check("Returning to repo A keeps mutations disabled until its pending operation settles",await page.locator(".commit-submit").isDisabled());
 await switchTo("repo-b");await release();
 check("Completed old-repository action cannot replace current repository snapshot",await page.locator(".identity-text b").innerText()==="repo-b"&&await page.locator(".commit-count").innerText()==="1 commits");
 check("Old-repository completion does not publish a success toast in repo B",await page.locator(".success-toast").count()===0);

 await hold(["file_diff","get_hunks","compare_file"]);
 await page.locator(".change-select").filter({hasText:"shared.txt"}).click();await pending(3);
 await page.locator(".wip-commit").click();await release();
 check("Selecting WIP invalidates pending file inspection and clears its title",!(await page.locator(".right-diff").innerText()).includes("B working")&&!(await page.locator(".right-diff-heading").innerText()).includes("shared.txt"));

 await hold(["toolbox_view"]);
 await page.getByRole("button",{name:"Repository tools",exact:true}).click();await pending(1);
 await page.getByRole("button",{name:/^Recovery/}).click();
 await page.locator(".rtools-reflog-row").first().waitFor({timeout:12000});await release();
 check("Delayed Remotes response cannot overwrite the active Recovery section",await page.locator(".rtools-reflog-row").count()>0&&await page.locator(".rtools-remote").count()===0);
 await page.getByRole("button",{name:"Commit graph",exact:true}).click();
 check("All tab-switch races preserve repo B HEAD, index and working bytes",git(repoB,"rev-parse","HEAD")===beforeB.head&&git(repoB,"write-tree")===beforeB.index&&fs.readFileSync(path.join(repoB,"shared.txt"),"utf8")===beforeB.bytes);
 check("No renderer exceptions during delayed real-backend requests",errors.length===0);
 await page.screenshot({path:path.join(base,"artifacts","native-repository-state.png")});
 console.log("NATIVE_REPOSITORY_STATE_ACCEPTED",checks.length,JSON.stringify(checks));
}catch(e){errors.push(String(e?.stack||e));console.error("NATIVE_REPOSITORY_STATE_FAILURE",String(e));process.exitCode=1;
 if(page)console.error("GATE_DIAGNOSTICS",JSON.stringify(await page.evaluate(()=>({pending:window.__arclaneGate?.pending,calls:window.__arclaneGate?.calls,body:document.body.innerText.slice(-1000)})).catch(()=>null)));
 if(page)await page.screenshot({path:path.join(base,"artifacts","native-repository-state-failure.png")}).catch(()=>{});
}finally{
 fs.writeFileSync(path.join(base,"artifacts","native-repository-state-acceptance.json"),JSON.stringify({fixture,checks,errors,note:"Real Git/Tauri results; only reply delivery delayed"},null,2));
 await browser?.close().catch(()=>{});
 if(child&&child.exitCode===null){try{execFileSync("taskkill",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore"});}catch{}}
}
