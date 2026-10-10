// Existing native UI flows only: local bare remotes, no hosted provider writes.
// Targets partial tags (052) and backend-only push/upstream/refusal (055).
import {fixture,launch,evidence,expect,fs,path,base,execFileSync} from './native-sprint-harness.mjs';
const {repo,git,write}=fixture('push-tag-audit');
write('tracked.txt','base\n');git('add','--all');git('commit','-qm','Base');
const initial=git('rev-parse','HEAD'),tree=git('write-tree');
const bare=fs.mkdtempSync(path.join(base,'artifacts','native-push-tag-bare-'));
git('init','--bare','-q',bare);
git('remote','add','origin',bare);
const session=await launch(repo,'push-tag-audit',9491),{page}=session,checks=[];
async function confirm(title,phrase){
 const dialog=page.getByRole('dialog',{name:title});
 await expect(dialog).toBeVisible();
 await dialog.getByRole('textbox',{name:'Confirmation phrase'}).fill(phrase);
 await dialog.getByRole('button',{name:'Confirm operation'}).click();
 await expect(dialog).toHaveCount(0,{timeout:15000});
}
const remoteRef=()=>execFileSync('git',['--git-dir',bare,'rev-parse','refs/heads/main'],{encoding:'utf8'}).trim();
try{
 await page.locator('.workspace-tabs').getByRole('button',{name:'Repository tools'}).click();
 await page.locator('.rtools-remote').filter({hasText:'origin'}).getByRole('button',{name:'Push and set upstream'}).click();
 await confirm('Push and set upstream','PUSH');
 if(remoteRef()!==initial||git('rev-parse','@{upstream}')!==initial)throw Error('Native upstream push did not establish correct remote and tracking ref');
 checks.push('055 native Push & set upstream creates exact bare remote ref and local tracking configuration');
 await page.locator('.rtools-nav').getByRole('button',{name:/Tags/}).click();
 const forms=page.locator('.rtools-form');
 const annotated=forms.filter({hasText:'Annotated tag at HEAD'});
 await annotated.getByRole('textbox',{name:'Tag name'}).fill('v-ui-annotated');
 await annotated.getByRole('textbox',{name:'Annotation'}).fill('ArcLane native release');
 await annotated.getByRole('button',{name:'Create tag'}).click();
 await confirm('Create annotated tag','TAG');
 if(git('cat-file','-t','refs/tags/v-ui-annotated')!=='tag'||!git('cat-file','-p','refs/tags/v-ui-annotated').includes('ArcLane native release'))throw Error('Native annotated tag object content incorrect');
 checks.push('052 native annotated tag carries exact message and tag-object type');
 const pushForm=forms.filter({hasText:'Publish or delete remote tag'});
 await pushForm.getByRole('combobox',{name:'Remote'}).selectOption('origin');
 await pushForm.getByRole('textbox',{name:'Tag name'}).fill('v-ui-annotated');
 await pushForm.getByRole('button',{name:'Push tag'}).click();
 await confirm('Push remote tag','PUSH');
 const remoteTag=execFileSync('git',['--git-dir',bare,'rev-parse','refs/tags/v-ui-annotated'],{encoding:'utf8'}).trim();
 if(remoteTag!==git('rev-parse','refs/tags/v-ui-annotated'))throw Error('Remote annotated tag object mismatch');
 checks.push('052 explicit native tag push preserves exact annotated SHA on disposable bare remote');
 await pushForm.getByRole('combobox',{name:'Remote'}).selectOption('origin');
 await pushForm.getByRole('textbox',{name:'Tag name'}).fill('v-ui-annotated');
 await pushForm.getByRole('button',{name:'Delete remote tag'}).click();
 await confirm('Delete remote tag','DELETE');
 const probe=(()=>{try{return execFileSync('git',['--git-dir',bare,'show-ref','--tags'],{encoding:'utf8'}).trim()}catch(e){if(e.status===1)return '';throw e}})();
 if(probe.includes('v-ui-annotated')||git('cat-file','-t','refs/tags/v-ui-annotated')!=='tag')throw Error('Remote tag deletion affected wrong refs');
 checks.push('052 native remote tag delete preserves local annotated tag');
 await page.keyboard.press('Control+p');
 const palette=page.getByRole('dialog',{name:'Command palette'});await palette.locator('input').fill('Create lightweight tag');await palette.getByRole('button',{name:'Create lightweight tag'}).click();
 const create=page.getByRole('dialog',{name:'Create Git tag'});
 await create.getByRole('textbox',{name:'Tag name'}).fill('v-ui-light');
 await create.getByRole('button',{name:'Create tag'}).click();
 await expect(create).toHaveCount(0);
 await expect.poll(()=>git('cat-file','-t','refs/tags/v-ui-light')).toBe('commit');
 checks.push('052 palette native lightweight tag resolves directly to exact commit');
 await page.locator('.workspace-tabs').getByRole('button',{name:'Commit graph'}).click();
 await page.keyboard.press('Control+p');const pp=page.getByRole('dialog',{name:'Command palette'});
 await pp.locator('input').fill('Delete tag');await pp.getByRole('button',{name:'Delete tag',exact:true}).click();
 const remove=page.getByRole('dialog',{name:'Delete Git tag'});
 await remove.getByRole('textbox',{name:'Tag name'}).fill('v-ui-light');
 await remove.getByRole('button',{name:'Delete tag'}).click();
 await expect(remove).toHaveCount(0);
 await expect.poll(()=>git('tag','-l','v-ui-light')).toBe('');
 checks.push('052 native lightweight tag deletion updates local Git refs safely');
 // Build a real remote rejection without changing any of the user's repositories.
 const clone=path.join(fs.mkdtempSync(path.join(base,'artifacts','push-tag-clone-')),'clone');
 execFileSync('git',['clone','-q','--branch','main',bare,clone]);
 const ext=(...args)=>execFileSync('git',['-C',clone,...args],{encoding:'utf8'}).trim();
 ext('config','user.name','Diverged fixture');ext('config','user.email','diverged@invalid.local');
 fs.writeFileSync(path.join(clone,'remote-new.txt'),'upstream\n');
 ext('add','--all');ext('commit','-qm','Independent remote change');ext('push','-q','origin','main');
 const remoteBefore=remoteRef();
 write('local-new.txt','local divergent\n');git('add','--all');git('commit','-qm','Local commit');
 const localHead=git('rev-parse','HEAD');
 await page.getByRole('button',{name:'Push',exact:true}).click();
 await expect(page.locator('.error-toast')).toBeVisible({timeout:14000});
 if(remoteRef()!==remoteBefore||git('rev-parse','HEAD')!==localHead||
    git('status','--porcelain')!=='')throw Error('Non-fast-forward push altered remote or local commits');
 checks.push('055 non-fast-forward push refused through packaged UI; remote/local refs and clean worktree unchanged');
 if(git('cat-file','-t','refs/tags/v-ui-annotated')!=='tag')throw Error('Local tag disappeared');
 await evidence(session,'native-existing-push-tags-audit',checks,repo);
}catch(e){await evidence(session,'native-existing-push-tags-audit-failure',checks,repo).catch(()=>{});throw e}
finally{await session.close();}
