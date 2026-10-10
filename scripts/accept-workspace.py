"""Persistent workspace settings; Git state is independently checked."""
import json, subprocess, tempfile, pathlib, os
base=pathlib.Path(__file__).resolve().parent.parent
cli=r'C:\AI\REA\Experiments\Forge\src-tauri\target\release\arclane-cli.exe'
profile=pathlib.Path(tempfile.mkdtemp(prefix='workspace-profile-',dir=base/'artifacts'))
env=dict(os.environ,ARCLANE_DATA_DIR=str(profile))
repos=[]
def git(repo,*args): return subprocess.check_output(['git','-C',str(repo),*args],text=True).strip()
for i in range(3):
 r=pathlib.Path(tempfile.mkdtemp(prefix='arclane-tabs-',dir=r'C:\AI\REA\Experiments\Forge-Testbed'))
 git(r,'init','-q','-b','main');git(r,'config','user.name','Tabs');git(r,'config','user.email','tabs@invalid.local');git(r,'config','core.autocrlf','false')
 (r/'file[1].txt').write_bytes(b'original\n');git(r,'add','.');git(r,'commit','-qm','Tab fixture');repos.append(git(r,'rev-parse','--show-toplevel'))
def call(kind,value=None,ok=True):
 args=[cli,kind,repos[0]]+([] if value is None else [json.dumps(value)])
 p=subprocess.run(args,env=env,capture_output=True,text=True)
 assert (p.returncode==0)==ok,(p.stdout,p.stderr)
 result=json.loads(p.stdout if ok else p.stderr)
 return result['result'] if ok else result
before=[(git(r,'rev-parse','HEAD'),git(r,'write-tree'),pathlib.Path(r,'file[1].txt').read_bytes()) for r in repos]
(profile/'repos.json').write_text(json.dumps(repos+[repos[0]]),encoding='utf-8')
state=call('workspace');assert len(state['tabs'])==3 and state['active']==repos[0]
print('PASS migrate and deduplicate recent repositories')
state={'tabs':[{'path':repos[2],'alias':'Third'},{'path':repos[0],'alias':'  Project A  '}],'active':repos[2],'closed':[{'path':repos[1],'alias':'Second'}]}
saved=call('save_workspace',state);assert saved['tabs'][1]['alias']=='Project A' and call('workspace')==saved
saved['active']=repos[0];call('save_workspace',saved);assert call('workspace')==saved
print('PASS aliases, order, active and closed tabs survive repeated atomic saves')
prior=(profile/'workspace.json').read_bytes()
for bad in [dict(saved,active=repos[1]),dict(saved,tabs=[{'path':repos[0],'alias':'bad\nname'}]),dict(saved,tabs=[{'path':str(profile),'alias':''}])]:
 call('save_workspace',bad,False);assert (profile/'workspace.json').read_bytes()==prior
print('PASS invalid roots, aliases and active tab rejected without overwriting settings')
missing=dict(saved,tabs=saved['tabs']+[{'path':str(profile/'missing'),'alias':'Gone'}]);(profile/'workspace.json').write_text(json.dumps(missing),encoding='utf-8')
assert call('workspace')==saved
print('PASS missing repository skipped on restart')
assert before==[(git(r,'rev-parse','HEAD'),git(r,'write-tree'),pathlib.Path(r,'file[1].txt').read_bytes()) for r in repos]
print('PASS workspace operations preserve all repository HEADs, indexes and file bytes')
