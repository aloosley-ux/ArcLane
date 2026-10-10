import {fixture,launch,evidence,expect,fs,path} from './native-sprint-harness.mjs';
const f=fixture('sequence-dark'),{repo,git,write}=f,checks=[];
write('base.txt','base\n');git('add','.');git('commit','-qm','Dark sequence base');
const base=git('rev-parse','HEAD');write('topic.txt','topic\n');git('add','.');git('commit','-qm','Dark topic');
const session=await launch(repo,'native-sequence-dark',9453),{page}=session;
try{
 await page.getByRole('button',{name:'Preferences',exact:true}).click();
 await page.getByRole('button',{name:'Dark',exact:true}).click();
 await page.getByRole('button',{name:'History',exact:true}).click();
 await page.locator(`.commit-row[data-commit="${base}"]`).click({button:'right'});
 await page.getByRole('menuitem',{name:'Interactive rebase after this commit'}).click();
 const rebase=page.getByRole('dialog',{name:'Interactive rebase'});
 await expect(rebase.locator('.sequence-step')).toHaveCount(1);
 const colors=await rebase.evaluate(el=>{
  const s=getComputedStyle(el);return {background:s.backgroundColor,text:s.color,canvas:getComputedStyle(document.body).backgroundColor,width:el.getBoundingClientRect().width};
 });
 if(colors.width<680||colors.background==='rgb(255, 255, 255)')throw Error('Dark rebase modal did not inherit ArcLane dark palette '+JSON.stringify(colors));
 await page.screenshot({path:path.join(session.profile,'interactive-rebase-dark.png')});
 checks.push('Packaged rebase uses shared dark styling and usable width');
 await page.keyboard.press('Escape');await expect(rebase).toHaveCount(0);
 await page.keyboard.press('Control+p');
 const palette=page.getByRole('dialog',{name:'Command palette'});
 await palette.locator('input').fill('Cherry-pick a sequence');await page.keyboard.press('Enter');
 const picker=page.getByRole('dialog',{name:'Cherry-pick a commit sequence'});
 await expect(picker).toBeVisible();
 const pickColors=await picker.evaluate(el=>({bg:getComputedStyle(el).backgroundColor,width:el.getBoundingClientRect().width}));
 if(pickColors.width<680||pickColors.bg!==colors.background)throw Error('Picker diverges from shared dark modal '+JSON.stringify(pickColors));
 await page.screenshot({path:path.join(session.profile,'cherry-pick-dark.png')});
 await page.keyboard.press('Escape');await expect(picker).toHaveCount(0);
 if(git('rev-parse','HEAD')===base||git('status','--porcelain')!=='')throw Error('No-op dialog changed Git state');
 checks.push('Packaged cherry-pick inherits same dark modal and Escape keeps repository clean');
 await evidence(session,'native-sequence-dark',checks,repo);
}catch(e){await evidence(session,'native-sequence-dark-failure',checks,repo).catch(()=>{});throw e}finally{await session.close()}
