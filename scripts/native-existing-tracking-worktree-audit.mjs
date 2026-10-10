// Native audits of previously backend-only 018 (divergence indicators) and
// 032 (worktree list and create). Every mutation uses disposable local fixtures.
import {fixture,launch,evidence,expect,fs,path,base,execFileSync} from './native-sprint-harness.mjs';
const {repo,git,write}=fixture('partial-tracking');
write('history.txt','base\n');git('add','--all');git('commit','-qm','Base');
const bare=fs.mkdtempSync(path.join(base,'artifacts','native-tracking-remote-'));
git('init','--bare','-q',bare);git('remote','add','origin',bare);git('push','-u','origin','main');
write('local-only.txt','local\n');git('add','--all');git('commit','-qm','Local ahead');
const own=git('rev-parse','HEAD');
const mirror=path.join(fs.mkdtempSync(path.join(base,'artifacts','native-tracking-other-')),'clone');
execFileSync('git',['clone','-q','--branch','main',bare,mirror],{stdio:'pipe'});
const ext=(...args)=>execFileSync('git',['-C',mirror,...args],{encoding:'utf8'}).trim();
ext('config','user.name','Upstream fixture');ext('config','user.email','upstream@invalid.local');
fs.writeFileSync(path.join(mirror,'upstream.txt'),'remote ahead\n');
ext('add','--all');ext('commit','-qm','Remote ahead');ext('push','-q','origin','main');
git('fetch','-q','origin');
const range=git('rev-list','--left-right','--count','main...origin/main').split(/\s+/).map(Number);
if(range[0]!==1||range[1]!==1)throw Error('Fixture diverged counts incorrect: '+range);
git('branch','feature/work');
const linked=fs.mkdtempSync(path.join(base,'artifacts','linked-root-'));
const linkedPath=path.join(linked,'linked-work');
git('worktree','add','-q',linkedPath,'feature/work');
const before=git('write-tree'),tracked=fs.readFileSync(path.join(repo,'history.txt'),'utf8');
const session=await launch(repo,'partial-tracking-worktree',9486),{page}=session,checks=[];
try{
 await expect(page.locator('.identity-tracking .ahead')).toContainText('↑ 1');
 await expect(page.locator('.identity-tracking .behind')).toContainText('↓ 1');
 checks.push('018 packaged tracking shows exact independent left/right rev-list counts (1 ahead, 1 behind)');
 await page.locator('.workspace-tabs').getByRole('button',{name:'Worktrees'}).click();
 const cards=page.locator('.worktree-grid .worktree-card');
 await expect(cards).toHaveCount(2);
 await expect(cards.filter({hasText:'feature/work'})).toContainText(linkedPath.replaceAll('\\','/').split('/').at(-1));
 await expect(cards.filter({hasText:'main'})).toContainText('MAIN');
 checks.push('032 native worktree list shows main/linked checkout, exact branch and disk path');
 await page.getByRole('button',{name:'Create a worktree'}).click();
 const dialog=page.getByRole('dialog',{name:'New worktree'});
 await dialog.getByRole('textbox').fill('feature/from-ui');
 await dialog.getByRole('button',{name:'Create worktree'}).click();
 await expect(page.locator('.worktree-card')).toHaveCount(3,{timeout:16000});
 const newPath=path.join(path.dirname(repo),'arclane-feature-from-ui');
 if(!fs.existsSync(path.join(newPath,'.git')))throw Error('App-created linked worktree did not exist on disk: '+newPath);
 if(git('rev-parse','refs/heads/feature/from-ui')!==own)throw Error('Worktree branch ref mismatch');
 const listed=git('worktree','list','--porcelain');
 if(!listed.replaceAll('\\','/').toLowerCase().includes(newPath.replaceAll('\\','/').toLowerCase()))throw Error('New worktree absent from git worktree list');
 checks.push('032 create linked worktree through native UI; validate new directory, branch ref and Git worktree registry');
 if(git('rev-parse','HEAD')!==own||git('write-tree')!==before||fs.readFileSync(path.join(repo,'history.txt'),'utf8')!==tracked)throw Error('Source repository changed during tracking and worktree audit');
 checks.push('Original checkout preserved exact HEAD, index and file bytes');
 await evidence(session,'native-existing-tracking-worktree-audit',checks,repo);
}catch(e){await evidence(session,'native-existing-tracking-worktree-audit-failure',checks,repo).catch(()=>{});throw e}
finally{await session.close();}
