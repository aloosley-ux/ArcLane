"""Destructive safety tested in disposable Git repositories, never development data."""
from fixture_support import *
checks=[];fixtures=[]
def check(name,condition):assert condition,name;checks.append(name);print('PASS',name,flush=True)
def setup(name='undo'):
    f=Fixture(name);fixtures.append(f);f.write("é's notes[1] space.txt",b'HEAD\r\n');f.write('notes1.txt',b'neighbor');f.commit();return f
file="é's notes[1] space.txt"
def action(f,op,id=None,ok=True,name=file,repo=None):return f.call('action',{'op':op,'file':name,'input':id},ok,repo)
f=setup();f.write(file,b'INDEX\x00staged\r\n');f.git('add','--',file);original=b'\xef\xbb\xbfWORK\x00\xff\nno final newline';f.write(file,original);before=f.state();r=action(f,'discard_file');id=r['recoveryId'];after=f.state()
check('Discard restores index bytes exactly',(f.repo/file).read_bytes()==b'INDEX\x00staged\r\n')
check('Discard preserves HEAD refs exact index tree neighbor',all(before[k]==after[k] for k in ['head','refs','index','tree']) and before['files']['notes1.txt']==after['files']['notes1.txt'])
check('Snapshot exact private verified bytes',(f.data/'file-recovery'/id/'before.bin').read_bytes()==original)
check('Recovery survives fresh process',f.call('recoveries')[0]['id']==id)
stable=f.state();action(f,'discard_file',ok=False);check('Duplicate discard refuses without mutation',f.state()==stable and len(f.call('recoveries'))==1)
action(f,'undo_discard',id);check('Undo restores full independent state',f.state()==before);action(f,'undo_discard',id,False);check('Duplicate undo refuses without mutation',f.state()==before)
for case in ['newer','index','head','refs','corrupt','wrong-worktree']:
    f=setup(case);f.write(file,b'important');id=action(f,'discard_file')['recoveryId']
    if case=='newer':f.write(file,b'newer edits')
    elif case=='index':f.write('notes1.txt',b'new staged');f.git('add','notes1.txt')
    elif case=='head':f.git('commit','--allow-empty','-qm','move head')
    elif case=='refs':f.git('branch','new-ref')
    elif case=='corrupt':(f.data/'file-recovery'/id/'before.bin').write_bytes(b'corrupt')
    elif case=='wrong-worktree':
        wt=f.repo.parent/(f.repo.name+'-linked');f.git('worktree','add','-qb','linked',str(wt));state=f.state();action(f,'undo_discard',id,False,repo=wt);check('Wrong linked checkout undo refused',f.state()==state);continue
    state=f.state();action(f,'undo_discard',id,False);check('Undo safety refusal '+case,f.state()==state)
    if case=='newer':f.write(file,b'HEAD\r\n');action(f,'undo_discard',id);check('Safe retry restores saved bytes',(f.repo/file).read_bytes()==b'important')
f=setup('missing');(f.repo/file).unlink();before=f.state();id=action(f,'discard_file')['recoveryId'];check('Missing before snapshot recorded',(f.repo/file).exists());action(f,'undo_discard',id);check('Undo restores absent-file state exactly',f.state()==before)
f=setup('negative');f.write('untracked.txt',b'important');f.write('large.bin',b'A'*4_000_001);f.git('add','large.bin');f.git('commit','-qm','large base');f.write('large.bin',b'B'*4_000_001)
for name in ['untracked.txt','large.bin','../escape',str(f.repo/file),'-evil']:
    state=f.state();action(f,'discard_file',ok=False,name=name);check('Discard refusal '+name,f.state()==state)
f=setup('storage-failure');f.write(file,b'keep');(f.data/'file-recovery').write_bytes(b'blocking storage');state=f.state();action(f,'discard_file',ok=False);check('Storage creation failure refuses before mutation',f.state()==state)
f=setup('capacity');f.write(file,b'keep');store=f.data/'file-recovery';store.mkdir();[(store/str(i)).mkdir() for i in range(32)];state=f.state();action(f,'discard_file',ok=False);check('Capacity failure refuses without eviction or mutation',f.state()==state and len(list(store.iterdir()))==32)
f=setup('symlink')
blob=subprocess.run(['git','-C',str(f.repo),'hash-object','-w','--stdin'],input=b'notes1.txt',capture_output=True,check=True).stdout.decode().strip();f.git('update-index','--add','--cacheinfo',f'120000,{blob},link');f.write('link',b'notes1.txt');state=f.state();action(f,'discard_file',ok=False,name='link');check('Index symlink refused',f.state()==state)
f=setup('readonly');f.write(file,b'longer readonly worktree content');readonly=f.repo/file;readonly.chmod(0o444);state=f.state();mode=readonly.stat().st_mode;action(f,'discard_file',ok=False);check('Read-only file discard refused without byte, permission or Git state changes',f.state()==state and readonly.read_bytes()==b'longer readonly worktree content' and readonly.stat().st_mode==mode)
# Junction requires no symlink privilege; points at a separate disposable target.
target=pathlib.Path(tempfile.mkdtemp(prefix='run3-junction-target-',dir=f.repo.parent));(target/'outside.txt').write_bytes(b'outside');junction=f.repo/'junction'
p=subprocess.run(['cmd','/c','mklink','/J',str(junction),str(target)],capture_output=True);assert p.returncode==0,p.stderr
for command,opts in [('media',{'file':'junction/outside.txt'}),('action',{'op':'discard_file','file':'junction/outside.txt'})]:
    f.call(command,opts,ok=False);check('Junction refused '+command,(target/'outside.txt').read_bytes()==b'outside')
save('discard-undo-acceptance',checks,fixtures)
