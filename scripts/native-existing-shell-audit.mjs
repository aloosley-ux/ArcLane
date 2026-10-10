// Evidence-only native acceptance for existing partial scopes 005, 009 and 017.
// Fresh local Git fixtures only, no application source changes.
import {fixture,launch,evidence,expect,fs,path,base,wait,execFileSync} from './native-sprint-harness.mjs';
const f=fixture('partial-shell'),{repo,git,write}=f;
write('tracked.txt','baseline\n');git('add','--all');git('commit','-qm','Baseline');
const original=git('rev-parse','HEAD');
git('branch','feature/alpha');git('tag','v1.0.0');
const bare=fs.mkdtempSync(path.join(base,'artifacts','partial-shell-remote-'));
git('init','--bare','-q',bare);git('remote','add','origin',bare);git('push','-u','origin','main');
write('tracked.txt','stashed changes\n');git('stash','push','-m','Navigator stash');
const index=git('write-tree'),saved=fs.readFileSync(path.join(repo,'tracked.txt'),'utf8');
const profile=fs.mkdtempSync(path.join(base,'artifacts','partial-shell-profile-'));
fs.writeFileSync(path.join(profile,'repos.json'),JSON.stringify([repo]));
let session=await launch(repo,'partial-shell-audit',9481,{},profile),page=session.page;
const checks=[];
async function palette(query,expected){
 await page.keyboard.press('Control+p');
 const modal=page.getByRole('dialog',{name:'Command palette'});
 await expect(modal).toBeVisible();
 await modal.locator('input').fill(query);
 if(expected){const btn=modal.getByRole('button',{name:expected,exact:true});await expect(btn).toBeEnabled();await page.keyboard.press('Enter');await expect(modal).toHaveCount(0);}
 return modal;
}
try{
 await palette('gibberish-command-000');
 await expect(page.locator('.palette-none')).toHaveText('No matching actions');
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Command palette'})).toHaveCount(0);
 await palette('View worktrees','View worktrees');
 await expect(page.getByRole('heading',{name:'Worktrees'}).first()).toBeVisible();
 await palette('History and commit graph','History and commit graph');
 await expect(page.getByRole('heading',{name:'Commit history'})).toBeVisible();
 await palette('Preferences','Preferences');
 await expect(page.getByRole('heading',{name:'Preferences'}).first()).toBeVisible();
 await page.keyboard.press('Control+k');
 const k=page.getByRole('dialog',{name:'Command palette'});
 await expect(k).toBeVisible();
 await k.locator('input').fill('Repository tools: remotes, recovery, Gitflow, LFS');
 await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'Repository tools'}).first()).toBeVisible();
 checks.push('005 command palette: search, no-results, Escape, Ctrl+P/Ctrl+K, multiple real route commands');
 await page.getByRole('button',{name:'Commit graph',exact:true}).click();
 const section=(name)=>page.locator('.reference-section').filter({has:page.locator('.section-header').filter({hasText:name})});
 for(const name of ['Local branches','Remotes','Tags','Stashes','Worktrees'])await expect(section(name)).toBeVisible();
 await expect(section('Local branches').locator('.ref-row')).toHaveCount(2);
 await expect(section('Remotes').locator('.ref-row')).toHaveCount(1);
 await expect(section('Tags').locator('.ref-row')).toHaveCount(1);
 await expect(section('Stashes').locator('.stash-row')).toHaveCount(1);
 await expect(section('Worktrees').locator('.ref-row')).toHaveCount(1);
 await section('Local branches').locator('.section-header').click();
 await expect(section('Local branches').locator('.ref-row')).toHaveCount(0);
 await section('Local branches').locator('.section-header').click();
 await expect(section('Local branches').locator('.ref-row')).toHaveCount(2);
 await page.getByRole('textbox',{name:'Filter repository references'}).fill('feature/alpha');
 await expect(section('Local branches').locator('.ref-row')).toHaveCount(1);
 await expect(section('Remotes').locator('.ref-row')).toHaveCount(0);
 await page.getByRole('textbox',{name:'Filter repository references'}).fill('');
 await section('Local branches').locator('.ref-row').filter({hasText:'feature/alpha'}).click();
 await expect(page.locator('.scope-badge')).toContainText('alpha');
 await expect(page.locator('.status-left')).toContainText('Ready');
 checks.push('017 reference navigator: independently confirmed branches, tracking remote, tag, stash, worktree, filter/collapse and ref-scope click');
 const left=page.getByRole('separator',{name:'Resize navigator'});
 const bench=page.getByRole('separator',{name:'Resize review bench'});
 await left.focus();await page.keyboard.press('Home');
 await expect(left).toHaveAttribute('aria-valuenow','190');
 await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Shift+ArrowRight');
 await expect(left).toHaveAttribute('aria-valuenow','270');
 await bench.focus();await page.keyboard.press('Home');await expect(bench).toHaveAttribute('aria-valuenow','260');
 await page.keyboard.press('Shift+ArrowUp');await expect(bench).toHaveAttribute('aria-valuenow','300');
 await expect.poll(()=>page.evaluate(()=>[localStorage.getItem('arclane-bench-navigator'),localStorage.getItem('arclane-bench-height')])).toEqual(['270','300']);
 await session.close();
 session=await launch(repo,'partial-shell-audit-restart',9482,{},profile);page=session.page;
 await expect(page.getByRole('separator',{name:'Resize navigator'})).toHaveAttribute('aria-valuenow','270');
 await expect(page.getByRole('separator',{name:'Resize review bench'})).toHaveAttribute('aria-valuenow','300');
 checks.push('009 navigator and review bench keyboard min/clamp/persist after full executable shutdown/restart');
 if(git('rev-parse','HEAD')!==original||git('write-tree')!==index||
    fs.readFileSync(path.join(repo,'tracked.txt'),'utf8')!==saved||
    git('rev-parse','refs/heads/feature/alpha')!==original)throw Error('Read-only native audit changed exact Git refs/index/files');
 checks.push('Independent HEAD, index, bytes and local-branch ref unaffected');
 await evidence(session,'native-existing-shell-audit',checks,repo);
}catch(error){await evidence(session,'native-existing-shell-audit-failure',checks,repo).catch(()=>{});throw error}
finally{await session.close();}
