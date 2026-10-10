import {fixture,launch,evidence,expect,fs,path,wait} from './native-sprint-harness.mjs';
const {repo,git,write}=fixture('cancel-core-git'),checks=[];
write('README.md','Original file\n');git('add','--all');git('commit','-qm','Baseline');
const start=git('rev-parse','HEAD');
write('README.md','Staged update\n');git('add','--all');
const staged=git('write-tree');
fs.writeFileSync(path.join(repo,'.git','hooks','pre-commit'),
 '#!/bin/sh\nprintf entered > "$(git rev-parse --absolute-git-dir)/arclane-cancel-hook"\nsleep 9\n');
const session=await launch(repo,'native-git-cancel',9471),{page}=session;
try{
 await page.getByLabel('Commit summary').fill('Must not complete');
 await page.getByRole('button',{name:/Commit 1 staged file/}).click();
 const cancel=page.getByRole('button',{name:'Cancel Git'});
 await expect(cancel).toBeVisible();
 const marker=path.join(repo,'.git','arclane-cancel-hook');
 for(let tries=0;tries<65&&!fs.existsSync(marker);tries++)await wait(50);
 if(!fs.existsSync(marker))throw Error('Git pre-commit hook never launched');
 await cancel.click();
 await expect(page.locator('.error-toast')).toContainText('Git operation cancelled',{timeout:12000});
 await expect(cancel).toHaveCount(0);
 if(git('rev-parse','HEAD')!==start||git('write-tree')!==staged||
    fs.readFileSync(path.join(repo,'README.md'),'utf8')!=='Staged update\n'){
    throw Error('Cancellation corrupted Git HEAD/index/file contents');
 }
 checks.push('Cancel Git kills running hook and leaves exact HEAD, staged index and file content');
 await expect(page.locator('.commit-submit')).toBeEnabled();
 checks.push('App refreshes after cancellation and preserves usable existing commit composer');
 await evidence(session,'native-git-cancel',checks,repo);
}catch(e){await evidence(session,'native-git-cancel-failure',checks,repo).catch(()=>{});throw e}
finally{await session.close();}
