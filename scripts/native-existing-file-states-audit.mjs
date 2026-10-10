// Evidence-only audit of existing WIP/staging/file-state scopes 022 and 035.
import {fixture,launch,evidence,expect,fs,path} from './native-sprint-harness.mjs';
const f=fixture('partial-files'),{repo,git,write}=f;
for(const [n,v]of [['edited.txt','original\n'],['rename-old.txt','old file\n'],['deleted.txt','to be removed\n'],['.gitignore','ignored*.tmp\n']])write(n,v);
git('add','--all');git('commit','-qm','Mixed files baseline');
const head=git('rev-parse','HEAD');
write('edited.txt','working modification\n');
fs.unlinkSync(path.join(repo,'deleted.txt'));
git('mv','rename-old.txt','rename-new.txt');
write('staged-added.txt','staged new\n');git('add','--','staged-added.txt');
write('untracked.txt','unstaged new\n');write('ignored-private.tmp','ignored ignored\n');
const expected=git('status','--porcelain','-uall');
if(!/R\s+rename-old\.txt -> rename-new\.txt/.test(expected)||!expected.includes('?? untracked.txt')||!expected.includes(' D deleted.txt')||!expected.includes(' M edited.txt'))throw Error('Fixture not in expected independent mixed state: '+expected);
const index=git('write-tree'),saved={};
for(const file of ['edited.txt','rename-new.txt','staged-added.txt','untracked.txt','ignored-private.tmp'])saved[file]=fs.readFileSync(path.join(repo,file),'utf8');
const session=await launch(repo,'partial-file-states',9485),{page}=session,checks=[];
try{
 await expect(page.locator('.wip-commit')).toContainText('5 uncommitted files');
 const staged=page.locator('.change-group-head.staged-head');
 const unstage=page.locator('.change-group-head').filter({hasText:'Unstaged changes'});
 await expect(staged).toContainText('2');
 await expect(unstage).toContainText('3');
 for(const n of ['rename-new.txt','staged-added.txt'])await expect(page.getByRole('button',{name:'Unstage '+n})).toBeVisible();
 for(const n of ['edited.txt','deleted.txt','untracked.txt'])await expect(page.getByRole('button',{name:'Stage '+n})).toBeVisible();
 await expect(page.locator('.change-list .file-flag').filter({hasText:'R'})).toHaveCount(1);
 await expect(page.locator('.change-list .file-flag').filter({hasText:'D'})).toHaveCount(1);
 await expect(page.locator('.change-list .file-flag').filter({hasText:'+'})).toHaveCount(1);
 checks.push('022 WIP badge and staged/unstaged mixed counts, distinct rename/delete/modified/new labels match Git status');
 const ignored=page.locator('.change-row').filter({hasText:'ignored-private.tmp'});
 await expect(ignored).toHaveCount(0);
 checks.push('035 gap identified: ignored files are excluded from the navigator (not fully accepted)');
 if(git('rev-parse','HEAD')!==head||git('write-tree')!==index||git('status','--porcelain','-uall')!==expected)throw Error('Mixed audit changed HEAD/index/status');
 for(const [n,v]of Object.entries(saved)){if(fs.readFileSync(path.join(repo,n),'utf8')!==v)throw Error('Unexpected file mutation '+n)}
 checks.push('Exact HEAD/index/status and all working/ignored file bytes unaffected');
 await evidence(session,'native-existing-file-states-audit',checks,repo);
}catch(e){await evidence(session,'native-existing-file-states-audit-failure',checks,repo).catch(()=>{});throw e}
finally{await session.close();}
