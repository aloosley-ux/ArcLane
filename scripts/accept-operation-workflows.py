from fixture_support import cli_path
"""Local bare remotes and stash workflows; never access a remote service."""
import json,subprocess,tempfile,pathlib
base=pathlib.Path(tempfile.mkdtemp(prefix='arclane-operations-',dir=r'C:\AI\REA\Experiments\Forge-Testbed'))
cli=cli_path()
def git(repo,*args):return subprocess.check_output(['git','-C',str(repo),*args],text=True,stderr=subprocess.DEVNULL).strip()
def call(repo,kind,opts,ok=True):
 p=subprocess.run([cli,kind,str(repo),json.dumps(opts)],capture_output=True,text=True);assert (p.returncode==0)==ok,(p.stdout,p.stderr)
 return json.loads(p.stdout if ok else p.stderr).get('result')
def action(repo,op,input=None,file=None,ok=True):return call(repo,'action',dict(op=op,input=input,file=file),ok)
def write(repo,name,text):(repo/name).write_bytes(text.encode('utf8'))
def setup(repo):
 repo.mkdir();git(repo,'init','-q','-b','main');git(repo,'config','user.name','Operation Test');git(repo,'config','user.email','operation@invalid.local');git(repo,'config','core.autocrlf','false')
def commit(repo,message):git(repo,'add','.');git(repo,'commit','-qm',message)
repo=base/'stash';setup(repo);write(repo,'notes[1].txt','base\n');commit(repo,'Base')
write(repo,'notes[1].txt','staged\n');git(repo,'add','--','notes[1].txt');index=git(repo,'write-tree');write(repo,'notes[1].txt','working\n');write(repo,'untracked.txt','untracked\n');action(repo,'stash','Draft')
v=call(repo,'inspect_stash',dict(id='stash@{0}'));sha=v['sha'];assert '+working' in v['patch'] and 'untracked.txt' in [f['path'] for f in v['files']]
action(repo,'stash_apply_index','stash@{0}',sha);assert git(repo,'write-tree')==index and (repo/'notes[1].txt').read_text()=='working\n' and (repo/'untracked.txt').read_text()=='untracked\n'
assert git(repo,'rev-parse','stash@{0}')==sha
print('PASS stash inspection includes untracked; --index apply restores exact staged/working state and retains stash')
write(repo,'new-stash.txt','new saved file\n');action(repo,'stash','New draft');head=git(repo,'rev-parse','HEAD');tree=git(repo,'write-tree')
action(repo,'stash_apply_index','stash@{0}',sha,False);assert git(repo,'rev-parse','HEAD')==head and git(repo,'write-tree')==tree
print('PASS stale stash selector refused without changing HEAD/index')
newsha=git(repo,'rev-parse','stash@{0}');action(repo,'stash_pop_index','stash@{0}',newsha);assert git(repo,'write-tree')==index and git(repo,'rev-parse','stash@{0}')==sha
print('PASS guarded pop restores staging and removes only the reviewed stash')
for mode in ['ff','merge','rebase']:
 folder=base/mode;folder.mkdir();seed=folder/'seed';setup(seed);write(seed,'base.txt','base\n');commit(seed,'Base')
 bare=folder/'origin.git';subprocess.check_call(['git','init','--bare','-q','-b','main',str(bare)])
 git(seed,'remote','add','origin',str(bare));git(seed,'push','-qu','origin','main')
 local=folder/'local';subprocess.check_call(['git','-c','core.autocrlf=false','clone','-q',str(bare),str(local)]);git(local,'config','user.name','Local');git(local,'config','user.email','local@invalid.local');git(local,'config','core.autocrlf','false')
 write(seed,'remote.txt','upstream\n');commit(seed,'Upstream');git(seed,'push','-q');remote=git(seed,'rev-parse','HEAD')
 if mode!='ff':write(local,'local.txt','local\n');commit(local,'Local');before=git(local,'rev-parse','HEAD')
 action(local,'pull_'+mode)
 assert (local/'remote.txt').read_text()=='upstream\n'
 if mode=='ff':assert git(local,'rev-parse','HEAD')==remote
 elif mode=='merge':assert len(git(local,'rev-list','--parents','-n','1','HEAD').split())==3
 else:assert git(local,'rev-parse','HEAD')!=before and git(local,'rev-parse','HEAD^')==remote and (local/'local.txt').exists()
 print('PASS pull',mode,'exact upstream tree and parent outcome')
 write(local,'dirty.txt','keep me\n');before=git(local,'rev-parse','HEAD');action(local,'pull_'+mode,ok=False);assert git(local,'rev-parse','HEAD')==before and (local/'dirty.txt').read_text()=='keep me\n'
 print('PASS dirty pull',mode,'refused without automatic stash')
 # Remote branch creation is local-only; verify upstream configuration.
 action(local,'branch_track_remote','tracked','refs/remotes/origin/main');assert git(local,'symbolic-ref','--short','HEAD')=='tracked' and git(local,'rev-parse','--abbrev-ref','@{upstream}')=='origin/main'
 print('PASS local tracking branch checkout')
print('ACCEPTED operation workflows, fresh fixtures',base)
