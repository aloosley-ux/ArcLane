import path from "node:path";
import fs from "node:fs";
import{execFileSync}from "node:child_process";
import{createServer}from "vite";
import{chromium}from "playwright";
const root=path.resolve(import.meta.dirname,"..");
const repo=String.raw`C:\AI\REA\Experiments\Forge-Testbed\forge-visual-benchmark`;
const exe=String.raw`C:\AI\REA\Experiments\Forge\src-tauri\target\release\forge-cli.exe`;
const call=(op,data={})=>JSON.parse(execFileSync(exe,[op,repo,JSON.stringify(data)],{encoding:"utf8",maxBuffer:16*1024*1024})).result;
const fixture={repo,state:call("inspect"),history:call("history",{limit:350,reference:"all"}),commitDiff:call("diff",{commit:call("history",{limit:1}).commits[0]?.sha})};
const server=await createServer({root,server:{host:"127.0.0.1",port:0,strictPort:false},clearScreen:false});
let browser;
try{
 await server.listen();
 const url=server.resolvedUrls.local[0];
 browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
 await page.addInitScript(({repo,state,history,commitDiff})=>{
  const b=globalThis;
  b.__TAURI_INTERNALS__={invoke:async(command,args)=>{
    switch(command){
      case "repositories":return [repo];
      case "snapshot":return state;
      case "commits":return {...history,has_more:false};
      case "file_diff":return args?.commit?commitDiff:{text:"",file:"",staged:false};
      case "github_query":return [];
      case "set_repositories":return args.paths;
      default:throw Error("Visual test mock only: "+command);
    }
  }};
 },fixture);
 const errors=[];
 page.on("pageerror",e=>errors.push(String(e)));
 await page.goto(url,{waitUntil:"networkidle",timeout:30000});
 await page.waitForTimeout(1200);
 const screenshot=path.join(root,"artifacts","arclane-visual-1600.png");
 fs.mkdirSync(path.dirname(screenshot),{recursive:true});
 await page.screenshot({path:screenshot,fullPage:true});
 const evidence={url,title:await page.title(),errors,historyText:await page.locator(".commit-count").allTextContents(),rows:await page.locator(".commit-row").count(),activeRepo:await page.locator(".repo-tab.chosen").allTextContents(),screenshot};
 fs.writeFileSync(path.join(root,"artifacts","arclane-visual-acceptance.json"),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify(evidence,null,2));
 if(errors.length||evidence.rows===0)process.exitCode=1;
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();await server.close();}
