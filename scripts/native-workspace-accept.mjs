import {fixture,launch,evidence,expect,fs,path,base} from './native-sprint-harness.mjs';
const fixtures=Array.from({length:3},(_,i)=>{const f=fixture('native-tabs-'+i);f.write('file[1].txt','original\n');f.git('add','.');f.git('commit','-qm','Tab fixture '+i);return f});
const before=fixtures.map(f=>[f.git('rev-parse','HEAD'),f.git('write-tree'),fs.readFileSync(path.join(f.repo,'file[1].txt'),'utf8')]);
const profile=fs.mkdtempSync(path.join(base,'artifacts','native-tabs-profile-'));fs.writeFileSync(path.join(profile,'repos.json'),JSON.stringify(fixtures.map(f=>f.repo)));
let session=await launch(fixtures[0].repo,'native-workspace',9398,{},profile);const checks=[];
try{
 let page=session.page;await expect(page.locator('.repo-tab')).toHaveCount(3);
 await page.locator('.repository-tab-shell').nth(2).click({button:'right'});await page.getByRole('menuitem',{name:'Rename tab alias',exact:true}).click();
 await page.getByLabel('Tab alias',{exact:true}).fill('Project C');await page.getByRole('button',{name:'Save alias',exact:true}).click();await expect(page.locator('.repo-tab').nth(2)).toHaveText('Project C');
 await page.locator('.repository-tab-shell').nth(2).click({button:'right'});await page.getByRole('menuitem',{name:'Move tab left',exact:true}).click();await expect(page.locator('.repo-tab').nth(1)).toHaveText('Project C');checks.push('Recent migration, local alias and ordered tab context actions');
 await page.locator('.repo-tab').nth(1).click();await expect(page.locator('.repo-tab.chosen')).toHaveText('Project C');
 await page.locator('.repository-tab-close').nth(2).click();await expect(page.locator('.repo-tab')).toHaveCount(2);await expect(page.locator('.repo-tab.chosen')).toHaveText('Project C');
 await page.keyboard.press('Control+Shift+T');await expect(page.locator('.repo-tab')).toHaveCount(3);checks.push('Close inactive tab preserves selection; keyboard reopen restores tab');
 await page.locator('.repo-tab').nth(1).click();await page.keyboard.press('Control+w');await expect(page.locator('.repo-tab')).toHaveCount(2);checks.push('Close active tab selects adjacent repository');
 await expect.poll(()=>JSON.parse(fs.readFileSync(path.join(profile,'workspace.json'),'utf8')).closed[0]?.alias).toBe('Project C');
 const saved=JSON.parse(fs.readFileSync(path.join(profile,'workspace.json'),'utf8'));await session.close();session=await launch(fixtures[0].repo,'native-workspace-restart',9399,{},profile);page=session.page;
 await expect(page.locator('.repo-tab')).toHaveCount(2);await expect(page.locator('.repo-tab.chosen')).toHaveAttribute('title',saved.active);checks.push('Full executable restart preserves order, active repository and closed history');
 await page.keyboard.press('Control+Shift+T');await expect(page.locator('.repo-tab')).toHaveCount(3);await expect(page.locator('.repo-tab.chosen')).toHaveText('Project C');checks.push('Closed alias survives full restart and reopens through shortcut');
 while(await page.locator('.repo-tab').count())await page.locator('.repository-tab-close').first().click();await expect(page.locator('.repo-tab')).toHaveCount(0);await page.keyboard.press('Control+Shift+T');await expect(page.locator('.repo-tab')).toHaveCount(1);checks.push('Closing last tab returns to empty workspace and can reopen');
 const after=fixtures.map(f=>[f.git('rev-parse','HEAD'),f.git('write-tree'),fs.readFileSync(path.join(f.repo,'file[1].txt'),'utf8')]);if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Tabs changed Git state');checks.push('All repository HEADs, indexes and literal file bytes remain unchanged');
 await evidence(session,'native-workspace',checks,fixtures.map(f=>f.repo));
}catch(e){await evidence(session,'native-workspace-failure',checks,fixtures.map(f=>f.repo)).catch(()=>{});throw e}finally{await session.close()}
