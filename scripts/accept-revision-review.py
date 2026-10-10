"""Tree comparisons, metadata and index-preserving restores, all in new testbed."""
import json,subprocess,tempfile,pathlib
repo=pathlib.Path(tempfile.mkdtemp(prefix='arclane-revisions-',dir=r'C:\AI\REA\Experiments\Forge-Testbed'))
cli=r'C:\AI\REA\Experiments\Forge\src-tauri\target\release\arclane-cli.exe'
def git(*args):return subprocess.check_output(['git','--literal-pathspecs','-C',str(repo),*args],text=True).strip()
def call(kind,opts,ok=True):
 p=subprocess.run([cli,kind,str(repo),json.dumps(opts)],capture_output=True,text=True);assert (p.returncode==0)==ok,(p.stdout,p.stderr)
 return json.loads(p.stdout if ok else p.stderr).get('result')
def write(name,text):(repo/name).write_bytes(text.encode('utf-8'))
git('init','-q','-b','main');git('config','user.name','Revision Tester');git('config','user.email','revision@invalid.local');git('config','core.autocrlf','false')
write('notes[1].txt','old\n');write('notes1.txt','neighbour\n');write('second.txt','second old\n');git('add','.');git('commit','-qm','Root\n\nRoot body');root=git('rev-parse','HEAD')
write('notes[1].txt','new\n');write('second.txt','second new\n');write('new.txt','addition\n');git('add','.');git('commit','-qm','Updated\n\nFull description');head=git('rev-parse','HEAD')
v=call('review_revisions',dict(to=root));assert v['from'] is None and len(v['files'])==3 and '+old' in v['patch']
print('PASS root commit compared to empty tree')
git('branch','reference',root)
v=call('review_revisions',dict(to='refs/heads/main',**{'from':'refs/heads/reference'},file='notes[1].txt'))
assert v['from']==root and v['to']==head and v['comparison']['before']=='old\n' and v['comparison']['after']=='new\n'
assert 'neighbour' not in v['patch'] and [f['path'] for f in v['files']]==['new.txt','notes[1].txt','second.txt']
assert v['details']['message']=='Updated\n\nFull description' and v['details']['authorEmail']=='revision@invalid.local'
print('PASS exact ref trees, literal per-file patch, metadata and full message')
back=call('review_revisions',dict(to=root,**{'from':head},file='notes[1].txt'));assert back['comparison']['before']=='new\n' and back['comparison']['after']=='old\n'
print('PASS reversed comparison direction')
write('notes[1].txt','staged\n');git('add','--','notes[1].txt');write('notes[1].txt','working\n');write('notes1.txt','neighbour dirty\n')
index=git('write-tree');opts=dict(sha=root,expectedHead=head,files=['notes[1].txt','second.txt'],confirmed=True)
call('action',dict(op='restore_revision_files',input=json.dumps(opts)))
assert (repo/'notes[1].txt').read_text()=='old\n' and (repo/'second.txt').read_text()=='second old\n' and (repo/'notes1.txt').read_text()=='neighbour dirty\n'
assert git('write-tree')==index and git('rev-parse','HEAD')==head
print('PASS multi-file restore preserves HEAD, exact index and neighbouring bytes')
for change in [dict(confirmed=False),dict(expectedHead=root),dict(files=['../outside']),dict(files=['missing']),dict(files=['*.txt']),dict(sha='--all')]:
 bad=opts|change;call('action',dict(op='restore_revision_files',input=json.dumps(bad)),False)
 assert git('write-tree')==index and git('rev-parse','HEAD')==head
for bad in ['--all','HEAD;echo bad','refs/heads/missing']:call('review_revisions',dict(to=bad),False)
print('PASS confirmation, stale HEAD, missing paths, magic and injection guards')
write('binary.bin','a\x00b');git('add','binary.bin');git('commit','-qm','Binary')
v=call('review_revisions',dict(to=git('rev-parse','HEAD'),file='binary.bin'));assert v['comparison'] is None and 'Binary' in v['comparisonError'] and 'Binary files' in v['patch']
print('PASS binary fallback returns real patch and explicit text limitation')
