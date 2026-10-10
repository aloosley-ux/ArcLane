import {fixture,launch,evidence,expect,fs,path,execFileSync} from './native-sprint-harness.mjs';
for(const operation of ['merge','rebase','cherry-pick','revert']){
 for(const action of ['abort','continue']){
  const f=fixture('native-resume-'+operation+'-'+action),{repo,git,write}=f,checks=[];
  write('conflict.txt','base\n');git('add','.');git('commit','-qm','Base');git('switch','-qc','topic');write('conflict.txt','topic\n');git('add','.');git('commit','-qm','Topic');const topic=git('rev-parse','HEAD');git('switch','-q','main');write('conflict.txt','main\n');git('add','.');git('commit','-qm','Main');let before=git('rev-parse','HEAD'),beforeBytes=fs.readFileSync(path.join(repo,'conflict.txt'));
  if(operation==='revert'){write('conflict.txt','later\n');git('add','.');git('commit','-qm','Later');const target=before;before=git('rev-parse','HEAD');beforeBytes=fs.readFileSync(path.join(repo,'conflict.txt'));try{git('revert','--no-edit',target)}catch{}}
  else try{git(operation,...(operation==='merge'?['--no-edit','topic']:operation==='rebase'?['topic']:[topic]))}catch{}
  if(!git('ls-files','-u'))throw Error('Fixture did not pause '+operation);
  const session=await launch(repo,'native-resume-'+operation+'-'+action,9396),{page}=session;
  try{
   await expect(page.locator('.sequencer-banner')).toContainText(operation);checks.push('App open detects interrupted '+operation+' from real Git state');
   if(action==='abort'){
    await page.locator('.sequencer-banner').getByRole('button',{name:'Abort safely'}).click();await expect(page.locator('.sequencer-banner')).toHaveCount(0);
    if(git('rev-parse','HEAD')!==before||git('status','--porcelain')!==''||!fs.readFileSync(path.join(repo,'conflict.txt')).equals(beforeBytes))throw Error('Abort did not restore original state');checks.push('Abort restores exact HEAD, clean index and original bytes');
   }else{
    await page.locator('.change-row').filter({hasText:'conflict.txt'}).getByRole('button',{name:'Resolve',exact:true}).click();const d=page.getByRole('dialog',{name:'Resolve conflict: conflict.txt'});await expect(d).toBeVisible();await d.getByRole('textbox',{name:'Manual resolution editor'}).fill('resolved '+operation+'\n');await d.getByRole('button',{name:'Resolve and stage'}).click();await expect(d).toHaveCount(0);
    if(git('ls-files','-u')!=='')throw Error('Resolution still unmerged');await page.locator('.sequencer-banner').getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('.sequencer-banner')).toHaveCount(0);
    if(git('status','--porcelain')!==''||git('show','HEAD:conflict.txt')!=='resolved '+operation||git('rev-parse','HEAD')===before)throw Error('Continue did not finish actual operation');checks.push('Manual resolution and Continue finish exact commit tree with clean index');
   }
   await evidence(session,'native-resume-'+operation+'-'+action,checks,repo);
  }catch(e){await evidence(session,'native-resume-failure',checks,repo).catch(()=>{});throw e}finally{await session.close()}
 }
}
