import {fixture,launch,evidence,expect,fs,path,base} from './native-sprint-harness.mjs';
const a=fixture('favourite-one'),b=fixture('favourite-two');
for(const f of [a,b]){f.write('example.txt','content\n');f.git('add','--all');f.git('commit','-qm','Fixture commit');}
const original=[a,b].map(f=>[f.git('rev-parse','HEAD'),f.git('write-tree')]);
const profile=fs.mkdtempSync(path.join(base,'artifacts','native-favourite-profile-'));
fs.writeFileSync(path.join(profile,'repos.json'),JSON.stringify([a.repo,b.repo]));
let s=await launch(a.repo,'native-favourite',9461,{},profile),p=s.page;const checks=[];
try{
 await expect(p.locator('.repo-tab')).toHaveCount(2);
 await p.locator('.repository-tab-shell').first().click({button:'right'});
 await p.getByRole('menuitem',{name:'Pin as favourite'}).click();
 await expect.poll(()=>JSON.parse(fs.readFileSync(path.join(profile,'workspace.json'),'utf8')).favourites).toEqual([a.repo]);
 checks.push('Native tab context pin saves canonical repository favourite');
 await p.locator('.repository-tab-close').last().click();
 await p.locator('.repository-tab-close').first().click();
 await expect(p.getByRole('heading',{name:'Pinned repositories'})).toBeVisible();
 await expect(p.getByRole('button',{name:'Remove favourite '+path.basename(a.repo)})).toBeVisible();
 await p.getByRole('textbox',{name:'Search repositories'}).fill(path.basename(b.repo));
 await expect(p.getByRole('button',{name:'Remove favourite '+path.basename(a.repo)})).toHaveCount(0);
 await expect(p.getByRole('button',{name:'Add favourite '+path.basename(b.repo)})).toBeVisible();
 checks.push('Closing tabs reveals filtered pinned/recent lists without scanning repositories');
 await p.getByRole('textbox',{name:'Search repositories'}).fill('');
 await s.close();
 s=await launch(a.repo,'native-favourite-restart',9462,{},profile);p=s.page;
 await expect(p.getByRole('heading',{name:'Pinned repositories'})).toBeVisible();
 await p.getByRole('button',{name:'Remove favourite '+path.basename(a.repo)}).click();
 await expect.poll(()=>JSON.parse(fs.readFileSync(path.join(profile,'workspace.json'),'utf8')).favourites).toEqual([]);
 checks.push('Packaged executable restart restores and can unpin favourite');
 await p.getByRole('button',{name:'Add favourite '+path.basename(b.repo)}).click();
 await expect.poll(()=>JSON.parse(fs.readFileSync(path.join(profile,'workspace.json'),'utf8')).favourites).toEqual([b.repo]);
 await p.locator('.welcome-repo-open').filter({hasText:path.basename(b.repo)}).click();
 await expect(p.locator('.repo-tab.chosen')).toContainText(path.basename(b.repo));
 checks.push('Recent repository pin and reopen restores real history workspace');
 const after=[a,b].map(f=>[f.git('rev-parse','HEAD'),f.git('write-tree')]);
 if(JSON.stringify(original)!==JSON.stringify(after))throw Error('Favourites mutated HEAD/index');
 checks.push('Both fixture repositories preserved exact Git refs and index');
 await evidence(s,'native-favourites',checks,[a.repo,b.repo]);
}catch(e){await evidence(s,'native-favourites-failure',checks,[a.repo,b.repo]).catch(()=>{});throw e}
finally{await s.close();}
