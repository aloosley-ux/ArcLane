import {fixture,launch,evidence,expect,fs,path} from './native-sprint-harness.mjs';
const {repo,git,write}=fixture('native-revisions');
write('notes[1].txt','old selected\n');write('notes1.txt','neighbour\n');write('second.txt','old second\n');git('add','.');git('commit','-qm','Root commit\n\nRoot description');const root=git('rev-parse','HEAD');git('branch','baseline',root);
write('notes[1].txt','new selected\n');write('second.txt','new second\n');git('add','.');git('commit','-qm','Updated commit\n\nFull review description');const head=git('rev-parse','HEAD');
write('notes[1].txt','staged selected\n');git('add','--','notes[1].txt');write('notes[1].txt','working selected\n');write('notes1.txt','dirty neighbour\n');const index=git('write-tree');
const session=await launch(repo,'native-revision-review',9392),{page}=session,checks=[];
try{
 await page.locator('.commit-row').filter({hasText:'Updated commit'}).click();await page.getByRole('button',{name:'Inspect files, metadata & comparisons'}).click();
 const dialog=page.getByRole('dialog',{name:'Revision review'});await expect(dialog.locator('.revision-metadata')).toContainText('Full review description');await expect(dialog.locator('.revision-metadata')).toContainText('native@invalid.local');await expect(dialog.locator('.revision-metadata')).toContainText('Unsigned');
 await expect(dialog.locator('.revision-file')).toHaveCount(2);checks.push('Full commit message, email, timestamps, signature state and changed-file inventory');
 await dialog.locator('.revision-file button').filter({hasText:'notes[1].txt'}).click();await expect(dialog.getByRole('region',{name:'Side-by-side Git diff'})).toContainText('old selected');await expect(dialog.getByRole('region',{name:'Side-by-side Git diff'})).toContainText('new selected');checks.push('Per-file comparison shows exact parent and selected revision bytes');
 await dialog.getByLabel('Comparison base',{exact:true}).selectOption('refs/heads/baseline');await dialog.getByLabel('Comparison target',{exact:true}).selectOption('refs/heads/main');await expect(dialog.locator('.revision-file')).toHaveCount(2);
 // Restore from the older tree using the direction controls.
 await dialog.getByRole('button',{name:'Swap',exact:true}).click();await expect(dialog.getByLabel('Comparison target',{exact:true})).toHaveValue('refs/heads/baseline');
 await expect(dialog.locator('.revision-metadata')).toContainText('Root description');
 await expect(dialog.locator('.revision-file')).toHaveCount(2);await dialog.getByLabel('Select restore notes[1].txt',{exact:true}).check();await dialog.getByLabel('Select restore second.txt',{exact:true}).check();
 await dialog.getByRole('button',{name:'Restore 2 file(s)',exact:true}).click();await expect(dialog.getByRole('button',{name:'Confirm historical restore'})).toBeDisabled();
 await dialog.getByLabel(/Overwrite the selected working files/).check();await dialog.getByRole('button',{name:'Confirm historical restore'}).click();await expect(dialog.locator('.revision-confirm')).toHaveCount(0);
 if(fs.readFileSync(path.join(repo,'notes[1].txt'),'utf8')!=='old selected\n'||fs.readFileSync(path.join(repo,'second.txt'),'utf8')!=='old second\n'||fs.readFileSync(path.join(repo,'notes1.txt'),'utf8')!=='dirty neighbour\n'||git('write-tree')!==index||git('rev-parse','HEAD')!==head)throw Error('Historical restore corrupted Git state');
 checks.push('Reference comparison, swap and confirmed multi-file restore preserve exact index, HEAD and neighbour');
 await dialog.getByRole('button',{name:'Close revision review'}).click();
 await page.locator('.commit-row').filter({hasText:'Root commit'}).click();await page.locator('.commit-row').filter({hasText:'Updated commit'}).click({modifiers:['Control']});
 await expect(page.getByRole('dialog',{name:'Revision review'})).toBeVisible();await expect(page.getByLabel('Comparison base',{exact:true})).toHaveValue(root);await expect(page.getByLabel('Comparison target',{exact:true})).toHaveValue(head);checks.push('Control-click two graph commits opens exact tree comparison');
 await evidence(session,'native-revision-review',checks,repo);
}catch(e){await evidence(session,'native-revision-review-failure',checks,repo).catch(()=>{});throw e}finally{await session.close()}
