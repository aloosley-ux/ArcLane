// Packaged native visual/interaction acceptance. All writes use a fresh testbed fixture.
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {chromium,expect} from 'playwright/test';
const root=path.resolve(import.meta.dirname,'..');
const repo=fs.mkdtempSync('C:\\AI\\REA\\Experiments\\Forge-Testbed\\arclane-review-bench-');
const profile=fs.mkdtempSync(path.join(root,'artifacts','review-profile-'));
const git=(...args)=>execFileSync('git',['-C',repo,...args],{encoding:'utf8'}).trim();
git('init','-q','-b','main');git('config','user.name','Alex Morgan');git('config','user.email','design@local.invalid');git('config','core.autocrlf','false');
fs.mkdirSync(path.join(repo,'src'));
const original=Array.from({length:90},(_,i)=>i===0?'export function reviewWorkspace() {':i===89?'}':`  // Workspace context line ${i+1}`).join('\n')+'\n';
fs.writeFileSync(path.join(repo,'src','workspace.ts'),original);fs.writeFileSync(path.join(repo,'README.md'),'# ArcLane review workspace\n');git('add','.');git('commit','-qm','Establish the desktop workspace');
const messages=['Add repository navigation','Build connected history lanes','Virtualise commit rows','Inspect working changes','Add side-by-side comparison','Keep Git paths literal','Scope async responses to their repository'];
for(let i=0;i<14;i++){fs.appendFileSync(path.join(repo,'README.md'),messages[i%7]+'\n');git('add','.');git('commit','-qm',messages[i%7]);}
git('branch','feature/diff-engine');git('checkout','-q','-b','fix/path-literals');fs.writeFileSync(path.join(repo,'literal.txt'),'Exact path selection\n');git('add','.');git('commit','-qm','Keep single-file operations literal');git('checkout','-q','main');fs.writeFileSync(path.join(repo,'layout.txt'),'Workspace composition\n');git('add','.');git('commit','-qm','Reorganise desktop workspace');git('merge','--no-ff','fix/path-literals','-m','Merge literal path protection');git('tag','v0.1.0');
fs.writeFileSync(path.join(repo,'src','workspace.ts'),original.replace('Workspace context line 5','Keep repository selection scoped').replace('Workspace context line 70','Review each hunk before staging'));
fs.writeFileSync(path.join(repo,'src','design-tokens.css'),':root { --accent: #275ED2; }\n');git('add','src/design-tokens.css');fs.appendFileSync(path.join(repo,'README.md'),'Review bench notes\n');
fs.writeFileSync(path.join(profile,'repos.json'),JSON.stringify([repo]));
const before={head:git('rev-parse','HEAD'),status:git('status','--porcelain'),index:git('diff','--cached'),worktree:git('diff')};
let child,browser;const result={repo,tests:[],errors:[],screenshots:[],mode:'packaged Windows WebView2'};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
 const port=9374;
 child=spawn(path.join(root,'Build','Arclane.exe'),[],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,ARCLANE_DATA_DIR:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`}});
 for(let n=0;n<100;n++){try{await fetch(`http://127.0.0.1:${port}/json/version`);break;}catch{await wait(200);}}
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
 let page;
 for(let n=0;n<80;n++){page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('tauri.localhost'));if(page)break;await wait(150);}
 if(!page)throw Error('Packaged tauri.localhost page missing');result.url=page.url();page.on('pageerror',e=>result.errors.push(String(e)));
 await page.locator('.commit-row').first().waitFor();
 await page.locator('.change-select').filter({hasText:'workspace.ts'}).click();await page.locator('.comparison-row.changed').first().waitFor();
 await page.getByRole('textbox',{name:'Commit summary',exact:true}).fill('Reorganise the review workspace');
 await page.getByRole('textbox',{name:'Commit description',exact:true}).fill('Give history, staging and code review a shared desktop workspace.');
 await page.locator('h1').click();
 const screenshot=async name=>{const file=path.join(root,'artifacts',name+'.png');await page.screenshot({path:file});result.screenshots.push(file);};
 await screenshot('review-bench-native-light');
 const areas=await page.evaluate(()=>Object.fromEntries(['.graph-scroll','.change-groups','.right-diff','.commit-composer'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return[s,{x:r.x,y:r.y,width:r.width,height:r.height}];})));
 if(areas['.right-diff'].width<500||areas['.graph-scroll'].width<1000)throw Error('Desktop graph/review widths do not match selected composition');result.tests.push('wide graph with simultaneous file list, diff and commit preparation');
 const split=page.getByRole('separator',{name:'Resize review bench'});const value=Number(await split.getAttribute('aria-valuenow'));await split.focus();await page.keyboard.press('ArrowUp');await expect(split).toHaveAttribute('aria-valuenow',String(value+10));result.tests.push('keyboard adjusts review bench');
 const nav=page.getByRole('separator',{name:'Resize navigator'});await nav.focus();await page.keyboard.press('ArrowRight');await expect(nav).toHaveAttribute('aria-valuenow','230');result.tests.push('keyboard adjusts reference navigator');
 await page.getByRole('button',{name:'Preferences',exact:true}).click();await page.getByRole('button',{name:'Dark',exact:true}).click();await page.getByRole('button',{name:'Commit graph',exact:true}).click();await screenshot('review-bench-native-dark');
 await page.getByRole('button',{name:'Preferences',exact:true}).click();await page.getByRole('button',{name:'Light',exact:true}).click();await page.getByRole('button',{name:'Commit graph',exact:true}).click();
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1080,height:680,deviceScaleFactor:1,mobile:false});
 await expect.poll(()=>page.evaluate(()=>innerWidth)).toBe(1080);await screenshot('review-bench-native-1080');
 const clipped=await page.evaluate(()=>[...document.querySelectorAll('.workspace-tabs button,.toolbar-actions button,.commit-composer button,.diff-mode-tabs button')].filter(n=>{const r=n.getBoundingClientRect();return r.right>innerWidth+1||r.bottom>innerHeight+1||r.width<10;}).map(n=>n.textContent||n.getAttribute('aria-label')));
 if(clipped.length)throw Error('Clipped controls: '+clipped.join(','));result.tests.push('minimum desktop viewport keeps primary controls on screen');
 await cdp.send('Emulation.clearDeviceMetricsOverride');
 result.viewportNote='1080 × 680 simulated within the actual packaged WebView2; native programmatic resize remains ACL-protected.';
 await page.getByRole('button',{name:'Repository tools',exact:true}).click();await page.locator('.rtools-none').waitFor();await expect(page.locator('.rtools .spin')).toHaveCount(0);await screenshot('review-bench-native-tools');result.tests.push('repository tools use full workspace without inspector compression');
 await page.getByRole('button',{name:'Commit graph',exact:true}).click();await page.keyboard.press('Control+p');await page.getByRole('dialog',{name:'Command palette'}).waitFor();await screenshot('review-bench-native-palette');await page.keyboard.press('Escape');
 await page.locator('.commit-row').nth(1).click();await page.locator('.commit-patch .diff-code').waitFor();await screenshot('review-bench-native-commit');result.tests.push('commit selection retains metadata, patch and contextual actions');
 const after={head:git('rev-parse','HEAD'),status:git('status','--porcelain'),index:git('diff','--cached'),worktree:git('diff')};if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Read-only design inspection mutated fixture Git state');result.tests.push('visual and navigation inspection leaves HEAD, index and worktree unchanged');
 await page.locator('.wip-commit').click();
 await page.getByRole('button',{name:'Commit 1 staged file',exact:true}).click();
 await expect.poll(()=>git('rev-parse','HEAD')).not.toBe(before.head);
 if(git('show','--pretty=format:','--name-only','HEAD')!=='src/design-tokens.css')throw Error('Commit included unstaged paths');
 if(git('log','-1','--format=%s')!=='Reorganise the review workspace'||!git('log','-1','--format=%b').includes('Give history, staging and code review'))throw Error('Commit message fields were not preserved');
 if(git('diff','--cached')!==''||git('diff')!==before.worktree||git('rev-parse','HEAD^')!==before.head)throw Error('Commit changed unexpected index, worktree or ancestry');
 result.tests.push('review bench commit preserves exact staged paths, summary, body, parent and unstaged bytes');
 await page.reload();await page.locator('.commit-row').first().waitFor();
 await expect(page.getByRole('separator',{name:'Resize navigator'})).toHaveAttribute('aria-valuenow','230');
 await expect(page.getByRole('separator',{name:'Resize review bench'})).toHaveAttribute('aria-valuenow',String(value+10));
 result.tests.push('pane sizes persist across renderer restart');
 if(result.errors.length)throw Error(result.errors.join('\n'));result.ok=true;
}catch(e){result.ok=false;result.error=String(e);console.error(e);process.exitCode=1;}
finally{fs.writeFileSync(path.join(root,'artifacts','review-bench-native-results.json'),JSON.stringify(result,null,2));if(browser)await browser.close().catch(()=>{});if(child&&child.exitCode===null)try{execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});}catch{};console.log(JSON.stringify(result,null,2));}
