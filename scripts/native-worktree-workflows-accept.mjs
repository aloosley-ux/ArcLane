// Packaged Windows acceptance for shared-history tabs and the complete local worktree lifecycle.
import {launch,evidence,expect,fs,path,base,execFileSync} from './native-sprint-harness.mjs';

const parent=fs.mkdtempSync('C:\\AI\\REA\\Experiments\\Forge-Testbed\\native-worktree-東京[]-');
const repo=path.join(parent,'primary repo [a]');fs.mkdirSync(repo);
const git=(cwd,...args)=>execFileSync('git',['--literal-pathspecs','-C',cwd,...args],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trimEnd();
git(repo,'init','-q','-b','main');git(repo,'config','user.name','Native worktree');git(repo,'config','user.email','worktree@invalid.local');git(repo,'config','core.autocrlf','false');
fs.writeFileSync(path.join(repo,'shared.txt'),'base\n');git(repo,'add','.');git(repo,'commit','-qm','Common base');
const baseSha=git(repo,'rev-parse','HEAD');fs.writeFileSync(path.join(repo,'main-only.txt'),'main history\n');git(repo,'add','.');git(repo,'commit','-qm','Main-only commit');
const mainHead=git(repo,'rev-parse','HEAD'),mainTree=git(repo,'write-tree');
git(repo,'branch','feature/open');git(repo,'branch','feature/existing');
const linked=path.join(parent,'linked checkout [東京]');git(repo,'worktree','add','-q',linked,'feature/open');
git(linked,'config','user.name','Native worktree');git(linked,'config','user.email','worktree@invalid.local');
fs.writeFileSync(path.join(linked,'linked-only.txt'),'linked history\n');git(linked,'add','linked-only.txt');git(linked,'commit','-qm','Linked-only commit');
fs.writeFileSync(path.join(linked,'shared.txt'),'linked staged\n');git(linked,'add','shared.txt');fs.writeFileSync(path.join(linked,'linked-dirty.txt'),'dirty\n');
const linkedHead=git(linked,'rev-parse','HEAD'),linkedTree=git(linked,'write-tree');
const snapshots=()=>[repo,linked].map(root=>({head:git(root,'rev-parse','HEAD'),status:git(root,'status','--porcelain=v1','-z'),tree:git(root,'write-tree'),files:fs.readdirSync(root).filter(x=>!['.git'].includes(x)).sort().map(x=>[x,fs.statSync(path.join(root,x)).isFile()?fs.readFileSync(path.join(root,x)):null])}));
const initial=snapshots(),initialRefs=git(repo,'show-ref');
const profile=fs.mkdtempSync(path.join(base,'artifacts','worktree-workflows-profile-'));
fs.writeFileSync(path.join(profile,'repos.json'),JSON.stringify([repo]));
// This is the pre-grouping workspace shape; Rust must migrate it without losing aliases/order.
fs.writeFileSync(path.join(profile,'workspace.json'),JSON.stringify({tabs:[{path:repo,alias:'Primary'}],active:repo,closed:[]}));
let session=await launch(repo,'native-worktree-workflows',9497,{},profile),page=session.page;const checks=[];
const cards=()=>page.locator('.worktree-grid .worktree-card');
const chooseRoute=async name=>page.locator('.workspace-tabs').getByRole('button',{name,exact:true}).click();
const confirm=async(title,text)=>{const dlg=page.getByRole('dialog',{name:title});await dlg.getByRole('textbox').fill(text);await dlg.getByRole('button',{name:title,exact:true}).click();};
const branch=(root)=>git(root,'branch','--show-current');
try{
 await expect(page.locator('.repo-tab')).toHaveCount(1);await expect(page.locator('.repo-tab')).toContainText('Primary');
 let saved=JSON.parse(fs.readFileSync(path.join(profile,'workspace.json'),'utf8'));
 if(!saved.tabs[0].commonDir)throw Error('Old workspace shape was not migrated to a Git common-directory group');
 checks.push('Old workspace shape migrates common-directory identity while retaining alias and active tab');

 await chooseRoute('Worktrees');await expect(cards()).toHaveCount(2);
 await expect(page.locator('.quick-search')).toContainText('Search commands…');
 const worktreeReadability=await cards().filter({hasText:'feature/open'}).evaluate(card=>{const path=card.querySelector('.wt-path'),branch=card.querySelector('.wt-branch h3'),actions=card.querySelector('.worktree-card-actions'),extra=card.querySelector('.wt-extra');return {pathFont:parseFloat(getComputedStyle(path).fontSize),branchFont:parseFloat(getComputedStyle(branch).fontSize),actionFont:parseFloat(getComputedStyle(actions.querySelector('button')).fontSize),secondaryGap:extra.getBoundingClientRect().top-actions.getBoundingClientRect().bottom};});
 if(worktreeReadability.pathFont<10.9||worktreeReadability.branchFont<12.9||worktreeReadability.actionFont<10.9||worktreeReadability.secondaryGap>18)throw Error('Worktree card text or secondary-action spacing remains below the readable compact baseline: '+JSON.stringify(worktreeReadability));
 checks.push('Command search label renders a real ellipsis; worktree metadata/actions are legible and secondary actions stay grouped');
 await expect(cards().filter({hasText:'main'})).toContainText('MAIN');
 await expect(cards().filter({hasText:'feature/open'})).toContainText(linked.replaceAll('\\','/'));
 await page.getByRole('button',{name:'Open worktree in ArcLane'}).click();
 await expect(page.locator('.repo-tab')).toHaveCount(2);await expect(page.locator('.repo-tab.chosen')).toContainText('linked checkout [東京]');
 await expect(page.locator('.identity-text')).toContainText('feature/open');await expect(page.locator('.wip-commit')).toContainText('2 uncommitted files');
 await expect(page.locator('.commit-row').filter({hasText:'Linked-only commit'})).toHaveCount(1);
 await expect(page.locator('.repo-tab-group-badge')).toHaveCount(2);
 await chooseRoute('Worktrees');
 await expect(page.locator('.worktree-card').filter({hasText:'CURRENT LINKED'})).toHaveCount(1);
 await page.locator('.repository-tab-shell').nth(1).click({button:'right'});await page.getByRole('menuitem',{name:'Rename tab alias',exact:true}).click();
 await page.getByLabel('Tab alias',{exact:true}).fill('Linked alias');await page.getByRole('button',{name:'Save alias',exact:true}).click();
 await page.locator('.repository-tab-shell').nth(1).click({button:'right'});await page.getByRole('menuitem',{name:'Move tab left',exact:true}).click();
 await expect(page.locator('.repo-tab').nth(0)).toContainText('Linked alias');
 checks.push('032 opens the actual linked directory as a tab with its branch, WIP and distinct HEAD over shared history');

 await page.locator('.repo-tab').filter({hasText:'Primary'}).click();await expect(page.locator('.identity-text')).toContainText('main');
 await expect(page.locator('.commit-row').filter({hasText:'Linked-only commit'})).toHaveCount(1);
 const navLinked=page.locator('.sidebar-scroll .reference-section').filter({has:page.locator('.section-header').filter({hasText:'Worktrees'})}).locator('.ref-row').filter({hasText:'feature/open'});await navLinked.click();
 await expect(page.locator('.repo-tab.chosen')).toContainText('Linked alias');await expect(page.locator('.repo-tab.chosen')).toHaveAttribute('title',/linked checkout \[東京\]/);await expect(page.locator('.identity-text')).toContainText('feature/open');
 if(branch(repo)!=='main'||branch(linked)!=='feature/open'||git(repo,'rev-parse','HEAD')!==mainHead||git(linked,'rev-parse','HEAD')!==linkedHead)throw Error('Selecting linked worktree changed a checkout HEAD or branch');
 checks.push('Navigator selection focuses the same linked tab; main and linked branches remain independent');

 await chooseRoute('Worktrees');await expect(page.locator('.sidebar-scroll .reference-section').filter({has:page.locator('.section-header').filter({hasText:'Worktrees'})}).locator('.ref-row')).toHaveCount(0);await page.getByRole('button',{name:'Open worktree in ArcLane'}).focus();
 await expect(page.getByRole('button',{name:'Open worktree in ArcLane'})).toBeFocused();
 await page.screenshot({path:path.join(base,'artifacts','native-worktree-workflows-light.png')});
 await page.setViewportSize({width:1080,height:680});
 await expect(page.locator('.worktree-grid')).toBeVisible();
 await page.screenshot({path:path.join(base,'artifacts','native-worktree-workflows-light-1080x680.png')});
 await page.setViewportSize({width:1440,height:900});
 await chooseRoute('Preferences');await page.getByRole('button',{name:'Dark',exact:true}).click();await chooseRoute('Worktrees');
 await page.screenshot({path:path.join(base,'artifacts','native-worktree-workflows-dark.png')});
 checks.push('Review Bench worktree grouping/cards retain accessible focus and render at 1080x680 in light and dark');

 await page.locator('.repo-tab').filter({hasText:'Primary'}).click();await chooseRoute('Worktrees');
 await page.locator('.new-worktree-card').filter({hasText:'Create a worktree'}).click();
 let dlg=page.getByRole('dialog',{name:'New worktree'});await dlg.getByRole('textbox').fill('feature/from-ui');await dlg.getByRole('button',{name:'Create worktree'}).click();
 const newPath=path.join(parent,'arclane-feature-from-ui');await expect(cards()).toHaveCount(3,{timeout:20000});
 if(!fs.existsSync(path.join(newPath,'.git'))||git(newPath,'branch','--show-current')!=='feature/from-ui')throw Error('New UI worktree path/branch invalid');
 checks.push('062 creates a new branch/worktree in a fixture path containing spaces, brackets and Unicode');

 await page.locator('.new-worktree-card').filter({hasText:'Attach local branch'}).click();
 dlg=page.getByRole('dialog',{name:'Attach existing branch'});await dlg.getByRole('textbox').fill('feature/existing');await dlg.getByRole('button',{name:'Attach branch'}).click();
 const existingPath=path.join(parent,'arclane-feature-existing');await expect(cards()).toHaveCount(4,{timeout:20000});
 if(git(existingPath,'branch','--show-current')!=='feature/existing')throw Error('Existing branch attachment failed');
 checks.push('062 attaches a pre-existing branch without moving the source checkout');

 await page.locator('.new-worktree-card').filter({hasText:'Inspect a commit'}).click();
 dlg=page.getByRole('dialog',{name:'Detached inspection worktree'});await dlg.getByRole('textbox').fill(baseSha);await dlg.getByRole('button',{name:'Create detached worktree'}).click();
 const detachedPath=path.join(parent,'arclane-inspect-'+baseSha.slice(0,12));await expect(cards()).toHaveCount(5,{timeout:20000});
 if(git(detachedPath,'rev-parse','HEAD')!==baseSha)throw Error('Detached worktree SHA mismatch');
 let detachedBranch='';try{detachedBranch=git(detachedPath,'symbolic-ref','--short','HEAD')}catch{}
 if(detachedBranch)throw Error('Inspection checkout unexpectedly has a branch');
 checks.push('062 creates a detached historical worktree without a fake branch');

 const created=cards().filter({hasText:'feature/from-ui'});
 await created.getByRole('button',{name:'Lock',exact:true}).click();await expect(created).toContainText('Locked');
 await created.getByRole('button',{name:'Remove',exact:true}).click();await confirm('Remove linked worktree','arclane-feature-from-ui');
 await expect(page.locator('.error-banner,.error-toast,[role=alert]')).toContainText(/locked|refus/i);await expect(cards()).toHaveCount(5);
 await created.getByRole('button',{name:'Unlock',exact:true}).click();await expect(created).toContainText('Clean');
 const dirty=path.join(newPath,'ui-dirty.txt');fs.writeFileSync(dirty,'preserve me\n');
 await created.getByRole('button',{name:'Remove',exact:true}).click();await confirm('Remove linked worktree','arclane-feature-from-ui');
 await expect(page.locator('.error-banner,.error-toast,[role=alert]')).toContainText(/modified|local changes|dirty|refus/i);
 if(fs.readFileSync(dirty,'utf8')!=='preserve me\n'||!fs.existsSync(newPath))throw Error('Dirty removal changed fixture data');
 fs.unlinkSync(dirty);await created.getByRole('button',{name:'Remove',exact:true}).click();await confirm('Remove linked worktree','arclane-feature-from-ui');
 await expect.poll(()=>fs.existsSync(newPath)).toBe(false);await expect(cards()).toHaveCount(4);
 checks.push('062 lock blocks removal, dirty removal preserves bytes, unlock permits confirmed clean removal');

 // Remove the active checkout from its own Worktrees view; ArcLane must fall back to Primary.
 await cards().filter({hasText:'feature/existing'}).getByRole('button',{name:'Open worktree in ArcLane'}).click();
 await expect(page.locator('.identity-text')).toContainText('feature/existing');
 await chooseRoute('Worktrees');await cards().filter({hasText:'CURRENT LINKED'}).getByRole('button',{name:'Remove',exact:true}).click();
 await confirm('Remove linked worktree','arclane-feature-existing');
 await expect.poll(()=>fs.existsSync(existingPath)).toBe(false);await expect(page.locator('.repo-tab.chosen')).toContainText('Primary');
 if((await page.locator('.repo-tab').allTextContents()).some(x=>x.includes('arclane-feature-existing')))throw Error('Removed active worktree tab was not reconciled');
 checks.push('Successful removal of the selected linked checkout closes its tab and selects the primary checkout');

 const stalePath=path.join(parent,'stale checkout');git(repo,'worktree','add','--detach','-q',stalePath,baseSha);fs.rmSync(stalePath,{recursive:true,force:true});
 await chooseRoute('Worktrees');await page.locator('.new-worktree-card').filter({hasText:'Prune stale records'}).click();
 await confirm('Prune stale worktrees','PRUNE');await expect(cards()).toHaveCount(3,{timeout:15000});
 if(!fs.existsSync(repo)||!fs.existsSync(linked)||!fs.existsSync(detachedPath))throw Error('Pruning deleted a valid checkout');
 checks.push('062 prune removes stale administration only and keeps valid main/linked/detached directories');

 const migrated=JSON.parse(fs.readFileSync(path.join(profile,'workspace.json'),'utf8'));
 if(migrated.tabs.filter(t=>t.commonDir===migrated.tabs[0].commonDir).length<2)throw Error('Shared repository grouping was not persisted');
 const after=snapshots();if(JSON.stringify(initial)!==JSON.stringify(after))throw Error('Navigation/grouping changed independently captured Git state or file bytes');
 if(git(repo,'rev-parse','HEAD')!==mainHead||git(repo,'write-tree')!==mainTree||git(linked,'rev-parse','HEAD')!==linkedHead||git(linked,'write-tree')!==linkedTree)throw Error('Shared refs/index state changed unexpectedly');
 const expectedRefs=new Map(initialRefs.split(/\r?\n/).map(line=>line.split(' ')[0]).filter(Boolean).map(ref=>[ref,git(repo,'rev-parse',ref)]));
 expectedRefs.set('refs/heads/feature/from-ui',mainHead);
 for(const [ref,sha] of expectedRefs)if(git(repo,'rev-parse',ref)!==sha)throw Error(`Unexpected branch ref after worktree lifecycle: ${ref}`);
 if(!initialRefs.includes('refs/heads/feature/open')||!initialRefs.includes('refs/heads/main'))throw Error('Initial branch refs were not captured');
 checks.push('Independent primary/linked HEAD, porcelain, index tree and file-byte snapshots unchanged by navigation/grouping');
 await page.locator('.repo-tab').filter({hasText:'Linked alias'}).click();await expect(page.locator('.identity-text')).toContainText('feature/open');
 await expect.poll(()=>JSON.parse(fs.readFileSync(path.join(profile,'workspace.json'),'utf8')).active.toLowerCase()).toContain('linked checkout');
 await session.close();session=await launch(repo,'native-worktree-workflows-restart',9498,{},profile);page=session.page;
 await expect(page.locator('.repo-tab')).toHaveCount(2);await expect(page.locator('.repo-tab').nth(0)).toContainText('Linked alias');
 await expect(page.locator('.repo-tab').nth(1)).toContainText('Primary');await expect(page.locator('.repo-tab.chosen')).toContainText('Linked alias');
 await expect(page.locator('.repo-tab-group-badge')).toHaveCount(2);await expect(page.locator('.identity-text')).toContainText('feature/open');
 checks.push('Graceful full executable restart retains grouped-tab identity, alias, order and selected linked checkout');
 await evidence(session,'native-worktree-workflows',checks,repo);
}catch(e){await evidence(session,'native-worktree-workflows-failure',checks,repo).catch(()=>{});throw e}
finally{await session.close()}
