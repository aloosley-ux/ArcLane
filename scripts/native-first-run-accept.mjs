import {fixture,launch,evidence,expect,fs,path,base,execFileSync} from './native-sprint-harness.mjs';
// Cold-start only with an empty independent app data profile. Never use user settings.
const profile=fs.mkdtempSync(path.join(base,'artifacts','cold-start-profile-'));
const {repo,git,write}=fixture('cold-start-source');
write('initial.txt','Initial fixture\n');git('add','--all');git('commit','-qm','Seed local source');
const original=git('rev-parse','HEAD'),index=git('write-tree');
const parent=fs.mkdtempSync(path.join(base,'artifacts','cold-start-dest-'));
let session=await launch(repo,'native-cold-start',9475,{},profile),page=session.page;
const checks=[];
try{
 await expect(page.getByRole('heading',{name:'Open a Git workspace'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Open repository'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Clone',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Initialize',exact:true})).toBeVisible();
 checks.push('Clean first launch shows Open, Clone and Initialize using standard UI');
 const newFolder=path.join(parent,'new-repository');fs.mkdirSync(newFolder);
 const created=await page.evaluate(folder=>window.__TAURI_INTERNALS__.invoke('create_repository',{folder}),newFolder);
 if(created.path.toLowerCase()!==newFolder.toLowerCase()||!fs.existsSync(path.join(newFolder,'.git')))throw Error('Native initialization failed');
 checks.push('Packaged Rust backend initializes a real empty repository in explicitly selected fixture folder');
 const cloned=await page.evaluate(({url,parent})=>window.__TAURI_INTERNALS__.invoke('clone_repository',{url,parent}),{url:repo,parent});
 const destination=path.join(parent,path.basename(repo));
 if(path.resolve(cloned.path).toLowerCase()!==path.resolve(destination).toLowerCase()||!fs.existsSync(path.join(destination,'.git'))||execFileSync('git',['-C',destination,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==original)throw Error('Native clone ref mismatch');
 checks.push('Packaged Rust backend clones a local repository and preserves exact source HEAD');
 const refused=await page.evaluate(async ({url,parent})=>{
  try{await window.__TAURI_INTERNALS__.invoke('clone_repository',{url,parent});return false;}catch(e){return String(e).includes('already exists');}
 },{url:repo,parent});
 if(!refused)throw Error('Duplicate clone was allowed to overwrite');
 checks.push('Destination overwrite refused before invoking Git');
 if(git('rev-parse','HEAD')!==original||git('write-tree')!==index)throw Error('Existing source repository changed');
 checks.push('Existing source HEAD and index unaffected by onboarding operations');
 await evidence(session,'native-first-run',checks,repo);
}catch(e){await evidence(session,'native-first-run-failure',checks,repo).catch(()=>{});throw e}
finally{await session.close();}
