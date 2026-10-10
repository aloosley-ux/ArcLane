import {fixture,launch,evidence,expect,fs,path} from './native-sprint-harness.mjs';

const {repo,git,write}=fixture('native-sequence'),checks=[];
write('base.txt','base\n');git('add','.');git('commit','-qm','Sequence base');const base=git('rev-parse','HEAD');
git('switch','-qc','topic');write('one.txt','one\n');git('add','.');git('commit','-qm','Topic one');const one=git('rev-parse','HEAD');
write('two.txt','two\n');git('add','.');git('commit','-qm','Topic two');const two=git('rev-parse','HEAD');
git('switch','-q','main');
const session=await launch(repo,'native-sequence',9452),{page}=session;
const cp=async(name)=>{await page.keyboard.press('Control+p');const d=page.getByRole('dialog',{name:'Command palette'});await d.locator('input').fill(name);await page.keyboard.press('Enter');};
const ready=()=>expect(page.locator('.status-left')).toContainText('Ready');
try{
 await expect(page.locator(`.commit-row[data-commit="${two}"]`)).toBeVisible();
 await cp('Cherry-pick a sequence');
 let dialog=page.getByRole('dialog',{name:'Cherry-pick a commit sequence'});
 await expect(dialog).toBeVisible();
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 if(git('rev-parse','HEAD')!==base)throw Error('Escape changed repository state');
 checks.push('Cherry-pick editor Escape closes without modifying HEAD');
 await cp('Cherry-pick a sequence');dialog=page.getByRole('dialog',{name:'Cherry-pick a commit sequence'});
 const available=dialog.getByRole('list',{name:'Available commits'});
 await available.getByRole('button').filter({hasText:'Topic one'}).click();
 await available.getByRole('button').filter({hasText:'Topic two'}).click();
 await expect(dialog.getByText('2/32')).toBeVisible();
 const cherryBounds=await dialog.boundingBox();if(!cherryBounds||cherryBounds.width<680)throw Error('Cherry-pick editor too narrow for Review Bench');
 await page.screenshot({path:path.join(session.profile,'cherry-pick-sequence.png')});
 await expect(dialog.getByRole('button',{name:/Cherry-pick 2 commits/})).toBeDisabled();
 await dialog.getByLabel('I have reviewed the commits and their exact order.').check();
 await dialog.getByRole('button',{name:'Cherry-pick 2 commits'}).click();
 await expect(dialog).toHaveCount(0,{timeout:15000});await ready();
 if(git('log','-2','--format=%s').trim()!=='Topic two\nTopic one')throw Error('Multi pick changed ordered commits');
 if(git('rev-parse','HEAD~2')!==base||git('write-tree')!==git('rev-parse','HEAD^{tree}')||
    fs.readFileSync(path.join(repo,'one.txt'),'utf8')!=='one\n'||fs.readFileSync(path.join(repo,'two.txt'),'utf8')!=='two\n')throw Error('Multi pick refs/index/files mismatch');
 checks.push('Packaged sequence dialog chooses two commits and writes exact Git history/index/files');

 await page.locator(`.commit-row[data-commit="${base}"]`).click({button:'right'});
 await page.getByRole('menuitem',{name:'Interactive rebase after this commit'}).click();
 dialog=page.getByRole('dialog',{name:'Interactive rebase'});
 await expect(dialog).toContainText(base.slice(0,10));
 await expect(dialog.locator('.sequence-step')).toHaveCount(2);
 const rebaseBounds=await dialog.boundingBox();if(!rebaseBounds||rebaseBounds.width<680)throw Error('Rebase editor too narrow for Review Bench');
 await page.screenshot({path:path.join(session.profile,'interactive-rebase.png')});
 await dialog.locator('.sequence-step').nth(1).getByRole('combobox').selectOption('reword');
 await dialog.getByLabel(/New message for/).fill('Native reworded');
 await dialog.getByLabel('I have reviewed the complete rebase plan and the history rewrite.').check();
 await dialog.getByRole('button',{name:'Run interactive rebase'}).click();
 await expect(dialog).toHaveCount(0,{timeout:15000});await ready();
 if(git('log','-1','--format=%s')!=='Native reworded'||
    git('rev-parse','HEAD~2')!==base||
    git('write-tree')!==git('rev-parse','HEAD^{tree}'))throw Error('Native rebase Git outcome');
 checks.push('Packaged rebase editor rewords selected commit while preserving correct tree and ancestry');
 await evidence(session,'native-sequence-accept',checks,repo);
}catch(e){await evidence(session,'native-sequence-failure',checks,repo).catch(()=>{});throw e}
finally{await session.close();}
