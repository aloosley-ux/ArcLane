// Brief packaged smoke only. Does not establish native requirement acceptance.
import {fixture,launch,evidence,expect} from './native-sprint-harness.mjs';
import {png,provenance} from './native-run3-support.mjs';
const {repo,git,write}=fixture('run3-wrapup-smoke');
write('code.ts','const review = false;\n');write('image.png',png(12,12,[200,20,40]));git('add','.');git('commit','-qm','Smoke base');write('code.ts','const review = true;\n');write('image.png',png(16,16,[20,200,40]));
const session=await launch(repo,'run3-wrapup-smoke',9412),{page}=session,checks=[];
try{
 provenance();await expect(page.locator('.commit-row').first()).toBeVisible();
 await page.locator('.change-select').filter({hasText:'code.ts'}).click();await page.getByRole('button',{name:'Inline',exact:true}).click();await expect(page.getByRole('region',{name:'Inline unified Git diff'})).toContainText('const review = true;');checks.push('New Inline control displays actual packaged source');
 await page.locator('.change-select').filter({hasText:'image.png'}).click();await expect(page.locator('.media-side img')).toHaveCount(2);await expect.poll(()=>page.locator('.media-side img').evaluateAll(ns=>ns.every(n=>n.complete&&n.naturalWidth>0))).toBe(true);checks.push('Actual packaged raster sides load');
 await evidence(session,'run3-wrapup-smoke',checks,repo);
}catch(e){await evidence(session,'run3-wrapup-smoke-failure',checks,repo).catch(()=>{});throw e}finally{await session.close()}
