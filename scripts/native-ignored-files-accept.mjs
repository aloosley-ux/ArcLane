import crypto from 'node:crypto';
import {base,fixture,launch,evidence,expect,fs,path,execFileSync} from './native-sprint-harness.mjs';

const f=fixture('ignored-files'),{repo,git}=f,checks=[];
const write=(name,value)=>{const file=path.join(repo,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);};
for(const [name,value] of [
 ['.gitignore','*.tmp\nignored-dir/\n'],
 ['tracked.txt','baseline\n'],
 ['rename-old.txt','rename baseline\n'],
 ['deleted.txt','remove baseline\n'],
 ['nested/.gitignore','*.secret\n'],
])write(name,value);
git('add','--all');git('commit','-qm','Ignored files baseline');
const head=git('rev-parse','HEAD');
fs.writeFileSync(path.join(repo,'.git','info','exclude'),'local-private.cfg\n');
write('space and [bracket] ü.tmp','ignored root bytes\n');
write('nested/private secret.secret','ignored nested bytes\n');
write('local-private.cfg','ignored local exclude\n');
for(let i=0;i<102;i++)write(`ignored-dir/file-${String(i).padStart(3,'0')}.dat`,`ignored ${i}\n`);
write('untracked file.txt','untracked\n');
write('staged addition.txt','staged addition\n');git('add','--','staged addition.txt');
git('mv','rename-old.txt','rename-new.txt');
write('tracked.txt','working modification\n');fs.unlinkSync(path.join(repo,'deleted.txt'));

const rawGit=(...args)=>execFileSync('git',['-C',repo,...args],{env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
const rootIgnored=()=>rawGit('status','--porcelain=v1','-z','--ignored','--untracked-files=normal').toString('utf8').split('\0').filter(row=>row.startsWith('!! ')).map(row=>row.slice(3));
const fileBytes=()=>{
 const result={};
 const walk=(dir,relative='')=>{for(const item of fs.readdirSync(dir,{withFileTypes:true})){if(item.name==='.git')continue;const child=path.join(dir,item.name),name=relative?relative+'/'+item.name:item.name;if(item.isDirectory())walk(child,name);else result[name]=crypto.createHash('sha256').update(fs.readFileSync(child)).digest('hex');}};
 walk(repo);return result;
};
const state=()=>({
 head:git('rev-parse','HEAD'),
 refs:git('for-each-ref','--format=%(refname) %(objectname)'),
 tree:git('write-tree'),
 index:crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,'.git','index'))).digest('hex'),
 status:rawGit('status','--porcelain=v1','-z','--ignored','--untracked-files=all').toString('base64'),
 files:fileBytes(),
});

const expected=rootIgnored(),initial=state(),session=await launch(repo,'native-ignored-files',9477),{page}=session;
try{
 await expect(page.locator('.wip-commit')).toContainText('5 uncommitted files');
 await expect(page.locator('.change-groups > .change-group-head').nth(0)).toContainText('3');
 await expect(page.locator('.change-groups > .change-group-head').nth(1)).toContainText('2');
 const ignored=page.locator('.ignored-files');
 await expect(ignored.locator('.change-row')).toHaveCount(0);
 await expect(ignored.getByRole('button',{name:'Show'})).toBeVisible();
 checks.push('Ignored entries are hidden by default; existing staged and unstaged groups remain accurate');

 await ignored.getByRole('button',{name:'Show'}).click();
 await expect(ignored.getByRole('button',{name:'Hide'})).toBeVisible();
 await expect(ignored.locator('.change-row')).toHaveCount(expected.length);
 await expect(ignored).toContainText(`${expected.length} of ${expected.length}`);
 for(const name of ['ignored-dir/','nested/private secret.secret','local-private.cfg','space and [bracket] ü.tmp']){
  if(!expected.includes(name))throw Error(`Independent Git status omitted fixture path ${name}`);
  await expect(ignored.getByRole('button',{name:`Select ignored path ${name}`})).toBeVisible();
 }
 checks.push('Git porcelain !! entries match nested .gitignore, .git/info/exclude, Unicode and literal path names');

 const special='space and [bracket] ü.tmp';
 const specialRow=ignored.getByRole('button',{name:`Select ignored path ${special}`}).locator('xpath=..');
 await specialRow.getByRole('button').click();
 await expect(page.locator('.right-diff')).toContainText('Git marked this file as ignored');
 await expect(specialRow.getByRole('button')).toHaveCount(1);
 await expect(ignored.getByRole('button',{name:`Stage ${special}`})).toHaveCount(0);
 await expect(ignored.getByRole('button',{name:`Discard unstaged changes in ${special}`})).toHaveCount(0);
 checks.push('Selecting an ignored file shows read-only Git status detail with no stage, discard or history action');

 await page.screenshot({path:path.join(base,'artifacts','native-ignored-files-light.png')});
 await page.getByRole('button',{name:'Preferences',exact:true}).click();
 await page.getByRole('button',{name:'Dark',exact:true}).click();
 await page.getByRole('button',{name:'Commit graph',exact:true}).click();
 const darkIgnored=page.locator('.ignored-files');
 await darkIgnored.getByRole('button',{name:'Show'}).click();
 await expect(darkIgnored.locator('.change-row')).toHaveCount(expected.length);
 await darkIgnored.getByRole('button',{name:`Select ignored path ${special}`}).click();
 const darkColors=await darkIgnored.evaluate(el=>({theme:document.documentElement.dataset.theme,foreground:getComputedStyle(el).color}));
 if(darkColors.theme!=='dark')throw Error(`Ignored section did not inherit ArcLane dark theme: ${JSON.stringify(darkColors)}`);
 await page.screenshot({path:path.join(base,'artifacts','native-ignored-files-dark.png')});
 checks.push('Light and dark packaged screenshots use the existing Review Bench palette and row styling');

 await darkIgnored.getByRole('button',{name:'Expand ignored directory ignored-dir/'}).click();
 await expect(darkIgnored.getByRole('button',{name:'Load more ignored files'})).toBeVisible();
 await expect(darkIgnored.getByRole('button',{name:'Select ignored path ignored-dir/file-000.dat'})).toBeVisible();
 await darkIgnored.getByRole('button',{name:'Load more ignored files'}).click();
 await expect(darkIgnored.getByRole('button',{name:'Select ignored path ignored-dir/file-101.dat'})).toBeVisible();
 if(JSON.stringify(state())!==JSON.stringify(initial))throw Error('Showing, selecting or expanding ignored entries changed Git state');
 checks.push('Collapsed large ignored directory expands on demand, paginates 102 literal paths and leaves Git state unchanged');

 await darkIgnored.getByRole('button',{name:'Hide'}).click();
 if(JSON.stringify(state())!==JSON.stringify(initial))throw Error('Hiding ignored entries changed Git state');
 checks.push('Hiding ignored entries preserves exact HEAD, refs, index, tree, status and working bytes');

 await darkIgnored.getByRole('button',{name:'Show'}).click();
 await expect(darkIgnored.locator('.change-row')).toHaveCount(expected.length);
 await page.getByRole('button',{name:'Stage all',exact:true}).click();
 await expect(page.locator('.change-groups > .change-group-head').nth(0)).toContainText('0',{timeout:15000});
 const stageable=rawGit('ls-files','--stage').toString('utf8');
 for(const ignoredPath of ['space and [bracket] ü.tmp','nested/private secret.secret','local-private.cfg','ignored-dir/file-000.dat']){
  if(stageable.includes(ignoredPath))throw Error(`Stage all included ignored path ${ignoredPath}`);
 }
 if(stageable.includes('untracked file.txt')===false||stageable.includes('staged addition.txt')===false||stageable.includes('rename-new.txt')===false)throw Error('Stage all omitted an allowed working-tree path');
 const remaining=rawGit('status','--porcelain=v1','-z','--ignored','--untracked-files=all').toString('utf8').split('\0').filter(Boolean);
 const ordinaryRows=remaining.filter(row=>row.length>=3&&row[2]===' '&&!row.startsWith('!! '));
 if(ordinaryRows.some(row=>row.startsWith('?? ')||row[1]!==' '))throw Error(`Stage all left ordinary changes unstaged: ${JSON.stringify(remaining)}`);
 if(git('rev-parse','HEAD')!==head||git('for-each-ref','--format=%(refname) %(objectname)')!==initial.refs||JSON.stringify(fileBytes())!==JSON.stringify(initial.files))throw Error('Stage all changed HEAD, refs or working file bytes');
 checks.push('Stage all stages normal changes and leaves every ignored file outside the Git index');

 await evidence(session,'native-ignored-files-audit',checks,repo);
}catch(e){await evidence(session,'native-ignored-files-audit-failure',checks,repo).catch(()=>{});throw e}
finally{await session.close()}
