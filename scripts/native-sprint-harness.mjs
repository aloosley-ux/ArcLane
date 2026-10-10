import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {chromium,expect} from 'playwright/test';
export {fs,path,expect,execFileSync};
export const base=path.resolve(import.meta.dirname,'..');
export const wait=ms=>new Promise(r=>setTimeout(r,ms));
export function fixture(prefix){
 const repo=fs.mkdtempSync('C:\\AI\\REA\\Experiments\\Forge-Testbed\\arclane-'+prefix+'-');
 const git=(...args)=>execFileSync('git',['--literal-pathspecs','-C',repo,...args],{encoding:'utf8'}).trimEnd();
 git('init','-q','-b','main');git('config','user.name','Native test');git('config','user.email','native@invalid.local');git('config','core.autocrlf','false');
 return {repo,git,write:(file,text)=>fs.writeFileSync(path.join(repo,file),text)};
}
export async function launch(repo,name,port,environment={}){
 fs.mkdirSync(path.join(base,'artifacts'),{recursive:true});
 const profile=fs.mkdtempSync(path.join(base,'artifacts',name+'-profile-'));
 fs.writeFileSync(path.join(profile,'repos.json'),JSON.stringify([repo]));
 const child=spawn(path.join(base,'Build','Arclane.exe'),[],{cwd:base,env:{...process.env,...environment,ARCLANE_DATA_DIR:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`},stdio:'ignore'});
 fs.writeFileSync(path.join(profile,'launch.json'),JSON.stringify({pid:child.pid,port,repo}));
 let browser,page;const errors=[];
 const close=async()=>{await browser?.close().catch(()=>{});if(child.exitCode===null)try{execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'})}catch{}};
 try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(300)})).ok){ready=true;break}}catch{}if(child.exitCode!==null)break;await wait(150)}
  if(!ready)throw Error('Packaged WebView2 debugger unavailable');
  browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  for(let i=0;i<80;i++){page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('http://tauri.localhost'));if(page)break;await wait(100)}
  if(!page)throw Error('Packaged page unavailable');page.on('pageerror',e=>errors.push(String(e)));
  await expect(page.locator('.status-left')).toContainText('Ready',{timeout:15000});
  return {page,errors,close,profile};
 }catch(e){await close();throw e}
}
export async function evidence(session,name,checks,repo){
 await session.page.screenshot({path:path.join(base,'artifacts',name+'.png')});
 fs.writeFileSync(path.join(base,'artifacts',name+'.json'),JSON.stringify({repo,checks,errors:session.errors},null,2));
 if(session.errors.length)throw Error(session.errors.join('\n'));
 console.log(name.toUpperCase(),checks.length,JSON.stringify(checks));
}
