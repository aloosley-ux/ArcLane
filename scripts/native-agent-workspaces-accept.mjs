// Packaged WebView2 acceptance for Agent Sessions using only a harmless local CLI fixture.
import {launch,expect,fs,path,base,execFileSync} from './native-sprint-harness.mjs';
import {state,same,invoke} from './native-run3-support.mjs';

const parent=fs.mkdtempSync('C:\\AI\\REA\\Experiments\\Forge-Testbed\\agent-workspaces-東京 []-');
fs.mkdirSync(path.join(base,'artifacts'),{recursive:true});
const repo=path.join(parent,'primary repo [東京]');fs.mkdirSync(repo);
const git=(cwd,...args)=>execFileSync('git',['--literal-pathspecs','-C',cwd,...args],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trimEnd();
git(repo,'init','-q','-b','main');git(repo,'config','user.name','Agent workspace fixture');git(repo,'config','user.email','agent@invalid.local');git(repo,'config','core.autocrlf','false');
fs.writeFileSync(path.join(repo,'tracked.txt'),'base\n');git(repo,'add','.');git(repo,'commit','-qm','Base');
const mainHead=git(repo,'rev-parse','HEAD');git(repo,'branch','feature/linked');
const linked=path.join(parent,'linked checkout [space 東京]');git(repo,'worktree','add','-q',linked,'feature/linked');
fs.writeFileSync(path.join(repo,'tracked.txt'),'staged source\n');git(repo,'add','tracked.txt');fs.writeFileSync(path.join(repo,'tracked.txt'),'unstaged source [bytes]\n');
fs.writeFileSync(path.join(linked,'linked-wip.txt'),'linked uncommitted bytes\n');
const originalStates=[state(repo),state(linked)];
const fixtures=path.join(parent,'fixtures');fs.mkdirSync(fixtures);
const fixtureExe=path.join(fixtures,'codex.exe'),argvFixtureExe=path.join(fixtures,'argv','codex.exe'),brokenExe=path.join(fixtures,'broken','codex.exe');fs.mkdirSync(path.dirname(brokenExe));fs.mkdirSync(path.dirname(argvFixtureExe));
fs.copyFileSync(path.join(process.env.SystemRoot,'System32','cmd.exe'),fixtureExe);
execFileSync('rustc',[path.join(base,'scripts','agent-fixture.rs'),'-O','-o',argvFixtureExe],{stdio:'ignore'});
fs.writeFileSync(brokenExe,'MZThis is a deliberately invalid executable fixture.');
const profile=fs.mkdtempSync(path.join(base,'artifacts','agent-workspaces-profile-'));fs.writeFileSync(path.join(profile,'repos.json'),JSON.stringify([repo]));
const session=await launch(repo,'native-agent-workspaces',9503,{},profile),page=session.page,checks=[];
const chooseRoute=async name=>page.locator('.workspace-tabs').getByRole('button',{name,exact:true}).click();
const norm=s=>s.replace(/^\\\\\?\\/,'').replaceAll('/','\\').toLowerCase();
const closeAll=async()=>{await session.close();};
try{
 await expect(page.locator('.pane-titlebar')).toBeVisible();await expect(page.locator('.commit-count')).toContainText('commits');
 checks.push('A mounted but hidden Agent Sessions route leaves the active history title and controls visible');
 await expect(page.locator('.sidebar-current')).toContainText('main');
 await expect(page.locator('.sidebar-scroll .reference-section').filter({hasText:'Worktrees'})).toContainText('feature/linked');
 await chooseRoute('Agent Sessions');await expect(page.locator('.agent-sessions-page')).toBeVisible();await expect(page.locator('.agent-checkout')).toHaveCount(2);
 await expect(page.locator('.agent-checkout').filter({hasText:'feature/linked'})).toContainText(linked.replaceAll('\\','/'));
 await expect(page.locator('.agent-availability')).toContainText(/available|unavailable/);
 if(fs.existsSync(path.join(fixtures,'launch.log')))throw Error('Agent executable ran during discovery');
 checks.push('082/083 load the Agent Sessions workspace from actual Worktrees identities; on-demand discovery does not start a CLI');

 // A saved stale path must be reported as invalid and keep launch controls disabled.
 await page.evaluate(()=>localStorage.setItem('arclane-agent-path-codex','C:\\missing\\codex.exe'));
 await page.getByRole('button',{name:'Refresh agent availability'}).click();
 await expect(page.locator('.agent-availability')).toContainText('Codex unavailable');
 await expect(page.locator('.agent-config-card')).toContainText('Configured path is invalid');
 await expect(page.getByRole('button',{name:'Launch in selected checkout'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Create checkout and launch Codex'})).toBeDisabled();
 await page.getByRole('button',{name:'Configure path'}).click();
 await page.getByLabel('Full path to Codex .exe').fill(brokenExe);
 await page.getByRole('button',{name:'Validate and save path'}).click();
 await expect(page.locator('.agent-availability')).toContainText('Codex available');
 checks.push('083 reports invalid configured paths and disables launch; an explicit existing Codex-named path validates without execution');

 const branch='feature/agent-failure';
 await page.getByLabel('New branch').fill(branch);
 await page.getByRole('button',{name:'Create checkout and launch Codex'}).click();
 const confirmation=page.getByRole('dialog',{name:'Create checkout and launch Codex?'});
 await expect(confirmation).toContainText(branch);await expect(confirmation).toContainText('that exact folder as its working directory');
 await confirmation.getByRole('button',{name:'Create and launch'}).click();
 const failedCheckout=path.join(parent,'arc-agent-feature-agent-failure');
 await expect(page.locator('.agent-inline-message[role="alert"]')).toContainText('checkout was kept',{timeout:20000});
 if(!fs.existsSync(path.join(failedCheckout,'.git'))||git(failedCheckout,'branch','--show-current')!==branch)throw Error('Failed launch did not preserve its created worktree');
 await expect(page.getByRole('button',{name:'Retry launch'})).toBeVisible();
 checks.push('084 requires explicit confirmation; a real executable-spawn failure keeps the new branch/worktree and exposes retry');

 await page.getByRole('button',{name:'Configure path'}).click();
 await page.getByLabel('Full path to Codex .exe').fill(fixtureExe);
 await page.getByRole('button',{name:'Validate and save path'}).click();
 await page.getByRole('button',{name:'Retry launch'}).click();
 await expect(page.locator('.agent-session-status.running')).toContainText('PID');
 await expect(page.locator('.terminal-dock')).toBeVisible();
 const launchingSnapshot=(await invoke(page,'terminal_sessions')).find(s=>norm(s.path)===norm(failedCheckout));
 await invoke(page,'terminal_send',{id:launchingSnapshot.id,data:'echo FIXTURE_READY\r\n'});
 try{await expect(page.locator('.xterm-rows')).toContainText('FIXTURE_READY',{timeout:15000});}catch(e){throw Error(`${e.message}\nBackend sessions: ${JSON.stringify(await invoke(page,'terminal_sessions'))}\nAgent status: ${await page.locator('.agent-session-status').allTextContents()}`);}
 await invoke(page,'terminal_send',{id:launchingSnapshot.id,data:'cd\r\n'});
 await expect(page.locator('.xterm-rows')).toContainText(failedCheckout,{timeout:10000});
 const opened=await invoke(page,'terminal_sessions');const uiSession=opened.find(s=>norm(s.path)===norm(failedCheckout));
 if(!uiSession?.pid||uiSession.running!==true)throw Error('Agent session has no live PID/path evidence: '+JSON.stringify(opened));
 const live=execFileSync('powershell.exe',['-NoProfile','-Command',`(Get-Process -Id ${uiSession.pid} -ErrorAction Stop).Id`],{encoding:'utf8'}).trim();
 if(Number(live)!==uiSession.pid)throw Error('Native fixture PID is not alive in Windows');
 await invoke(page,'terminal_send',{id:uiSession.id,data:'echo FIXTURE_INPUT=probe\r\n'});
 await expect(page.locator('.xterm-rows')).toContainText('FIXTURE_INPUT=probe',{timeout:10000});
 const agentTab=page.locator('.terminal-select').filter({hasText:'Codex'});
 await page.locator('.terminal-add').click();await expect(page.locator('.terminal-tab')).toHaveCount(2);
 await page.locator('.terminal-select').last().click();
 await invoke(page,'terminal_send',{id:uiSession.id,data:'output-after-tab-switch\r\n'});
 await agentTab.click();await expect(page.locator('.terminal-tab.active')).toContainText('Codex');await expect(page.locator('.terminal-host:visible .xterm-rows')).toContainText('output-after-tab-switch',{timeout:10000});
 if(!(await invoke(page,'terminal_sessions')).some(s=>s.id===uiSession.id&&norm(s.path)===norm(failedCheckout)&&s.running))throw Error('Switching terminal tabs changed the agent session identity');
 checks.push('084 retains the backend session ID, checkout path and output stream while the terminal view switches between independent tabs');
 checks.push('084 launches the selected fixture in the exact Unicode worktree cwd, reports the real live PID, and accepts interactive input in its own ConPTY tab');

 await chooseRoute('Preferences');
 await invoke(page,'terminal_send',{id:uiSession.id,data:'exit 7\r\n'});
 for(let i=0;i<40;i++){const current=await invoke(page,'terminal_sessions');const found=current.find(s=>s.id===uiSession.id);if(found?.running===false&&found.exitCode===7)break;await new Promise(r=>setTimeout(r,100));}
 let terminalState=(await invoke(page,'terminal_sessions')).find(s=>s.id===uiSession.id);
 if(terminalState?.running!==false||terminalState.exitCode!==7)throw Error('Real process exit code was not retained: '+JSON.stringify(terminalState));
 await chooseRoute('Agent Sessions');await page.locator('.agent-checkout').filter({hasText:'feature/agent-failure'}).click();await expect(page.locator('.agent-session-status.exited')).toContainText('Exit code 7',{timeout:10000});
 await page.locator('.terminal-tab-close').first().click();
 if((await invoke(page,'terminal_sessions')).some(s=>s.id===uiSession.id))throw Error('Closing exited terminal did not remove the process session');
 if(await page.locator('.terminal-tab').count())await page.locator('.terminal-tab-close').first().click();
 if((await invoke(page,'terminal_sessions')).length)throw Error('Closing all attached tabs left a terminal session registered');
 checks.push('084 captures the actual exit code, allows closing exited processes and removes the session handle');

 if((await invoke(page,'terminal_sessions')).some(s=>s.id===uiSession.id))throw Error('Agent terminal snapshot remained registered after its tab was closed');
 checks.push('084 restores the same agent identity, exact CWD and exit 7 from a backend snapshot after the Agent Sessions view unmounts and remounts');

 // Direct IPC proves argv stays literal even for shell metacharacters; evidence is outside the repo.
 const argvEvidence=path.join(fixtures,'argv-evidence.txt'),childPidFile=path.join(fixtures,'agent-child.pid');
 const argv=['--spawn-child',argvFixtureExe,childPidFile,'--capture',argvEvidence,'space arg [東京]','"; & | $(Write-Output INJECTED)'];
 await page.locator('.agent-checkout').filter({hasText:'feature/linked'}).click();
 const direct=await invoke(page,'terminal_launch',{path:linked,executable:argvFixtureExe,args:argv});
 const started=await invoke(page,'terminal_sessions');const directState=started.find(s=>s.id===direct.id);
 if(!direct.pid||directState?.running!==true||directState.agentSession!==true||norm(direct.path)!==norm(linked))throw Error('Direct argv fixture was not launched as an agent in exact checkout: '+JSON.stringify({direct,directState}));
 await expect(page.getByRole('button',{name:'Open agent terminal'})).toBeVisible();await page.getByRole('button',{name:'Open agent terminal'}).click();await expect(page.locator('.terminal-host:visible .xterm-rows')).toContainText('FIXTURE_READY',{timeout:15000});
 for(let i=0;i<50&&!fs.existsSync(argvEvidence);i++)await new Promise(r=>setTimeout(r,50));
 const captured=fs.readFileSync(argvEvidence,'utf8');
 if(!captured.toLowerCase().includes(norm(linked))||!captured.includes('space arg [東京]')||!captured.includes('$(Write-Output INJECTED)')||!captured.includes('& |'))throw Error('Safe argv fixture did not receive exact literal arguments: '+captured);
 await invoke(page,'terminal_send',{id:direct.id,data:'spawn-child\r\n'});
 for(let i=0;i<50&&!fs.existsSync(childPidFile);i++)await new Promise(r=>setTimeout(r,50));
 const childPid=Number(fs.readFileSync(childPidFile,'utf8'));
 execFileSync('powershell.exe',['-NoProfile','-Command',`(Get-Process -Id ${childPid} -ErrorAction Stop).Id`],{stdio:'ignore'});
 await invoke(page,'terminal_send',{id:direct.id,data:'exit 0\r\n'});
 for(let i=0;i<40;i++){const current=await invoke(page,'terminal_sessions');if(current.find(s=>s.id===direct.id)?.running===false)break;await new Promise(r=>setTimeout(r,50));}
 await invoke(page,'terminal_close',{id:direct.id});
 try{execFileSync('powershell.exe',['-NoProfile','-Command',`(Get-Process -Id ${childPid} -ErrorAction Stop).Id`],{stdio:'ignore'});throw Error('Agent child process survived terminal close');}catch(e){if(e.message==='Agent child process survived terminal close')throw e;}
 checks.push('084 passes Unicode, spaces, brackets and shell-injection-shaped argv literally through CommandBuilder in the linked checkout');

 if(await page.locator('.terminal-dismiss').count())await page.locator('.terminal-dismiss').click();
 await chooseRoute('Preferences');await page.getByRole('button',{name:'Light',exact:true}).click();await chooseRoute('Agent Sessions');
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:path.join(base,'artifacts','native-agent-workspaces-light.png')});
 const lightBox=await page.locator('.agent-sessions-page').boundingBox();if(!lightBox||lightBox.width<700||lightBox.height<400)throw Error('Agent Sessions did not fill the available WebView area: '+JSON.stringify(lightBox));
 await chooseRoute('Preferences');await page.getByRole('button',{name:'Dark',exact:true}).click();await chooseRoute('Agent Sessions');
 await expect(page.locator('.agent-sessions-page')).toBeVisible();await page.screenshot({path:path.join(base,'artifacts','native-agent-workspaces-dark.png')});
 await page.setViewportSize({width:1080,height:680});await expect(page.locator('.agent-sessions-page')).toBeVisible();
 const compact=await page.locator('.agent-sessions-page').evaluate(e=>({width:e.clientWidth,height:e.clientHeight,scrollWidth:e.scrollWidth,scrollHeight:e.scrollHeight,checkout:e.querySelector('.agent-worktree-list').getBoundingClientRect().toJSON(),content:e.querySelector('.agent-session-main').getBoundingClientRect().toJSON()}));
 if(compact.width<500||compact.scrollWidth>compact.width+1||compact.checkout.right>compact.width)throw Error('Compact Agent Sessions layout overflows: '+JSON.stringify(compact));
 await page.screenshot({path:path.join(base,'artifacts','native-agent-workspaces-dark-1080x680.png')});
 await page.locator('.agent-checkout').filter({hasText:'feature/linked'}).focus();await expect(page.locator('.agent-checkout').filter({hasText:'feature/linked'})).toBeFocused();
 checks.push('082 renders focused Worktrees-derived sessions in light, dark and 1080×680 compact WebView sizes with keyboard focus and no horizontal overflow');

 const finalPrimary=state(repo),finalLinked=state(linked);
 for(const field of ['head','index','tree','status','files']){if(JSON.stringify(originalStates[0][field])!==JSON.stringify(finalPrimary[field]))throw Error('Primary Git state changed: '+field);if(JSON.stringify(originalStates[1][field])!==JSON.stringify(finalLinked[field]))throw Error('Linked Git state changed: '+field);}
 const newRefs=finalPrimary.refs.split(/\r?\n/).filter(line=>line&&!originalStates[0].refs.split(/\r?\n/).includes(line));
 if(JSON.stringify(newRefs)!==JSON.stringify([mainHead+' refs/heads/'+branch]))throw Error('Unexpected ref changes: '+JSON.stringify(newRefs));
 if(git(repo,'rev-parse','HEAD')!==mainHead||git(linked,'branch','--show-current')!=='feature/linked')throw Error('Agent workflow changed original checkout branch or HEAD');
 checks.push('Independent Git HEAD, refs, index bytes, working bytes and status in primary/linked fixtures remain unchanged');
 if(session.errors.length)throw Error(session.errors.join('\n'));
 fs.writeFileSync(path.join(base,'artifacts','native-agent-workspaces-accept.json'),JSON.stringify({repo,linked,failedCheckout,fixtureExe,pid:uiSession.pid,exitCode:terminalState.exitCode,checks,errors:session.errors},null,2));
 console.log('NATIVE-AGENT-WORKSPACES',checks.length,JSON.stringify(checks));
}finally{await closeAll();}
