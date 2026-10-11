from fixture_support import cli_path
"""Commit editor acceptance using fresh disposable Git state, no remotes/network."""
import json,subprocess,tempfile,pathlib
repo=pathlib.Path(tempfile.mkdtemp(prefix='arclane-commit-',dir=r'C:\AI\REA\Experiments\Forge-Testbed'))
cli=cli_path()
def git(*args):return subprocess.check_output(['git','-C',str(repo),*args],text=True).strip()
def call(kind,opts={},ok=True):
 p=subprocess.run([cli,kind,str(repo),json.dumps(opts)],capture_output=True,text=True)
 assert (p.returncode==0)==ok,(p.stdout,p.stderr)
 return json.loads(p.stdout if ok else p.stderr)
def save(message,**kw):
 ok=kw.pop('ok',True)
 opts=dict(message=message,expectedHead=git('rev-parse','HEAD'),**kw)
 return call('action',{'op':'commit_options','input':json.dumps(opts)},ok)
git('init','-q','-b','main');git('config','user.name','Test');git('config','user.email','test@invalid.local');git('config','core.autocrlf','false')
(repo/'a[1].txt').write_text('one\n');git('add','.');git('commit','-qm','Original\n\nOriginal body')
head=git('rev-parse','HEAD');tree=git('rev-parse','HEAD^{tree}')
call('action',{'op':'commit_options','input':json.dumps(dict(message='Rejected',expectedHead=head,amend=True))},False)
assert git('rev-parse','HEAD')==head
print('PASS amend confirmation guard')
git('update-ref','refs/remotes/origin/main',head)
context=call('commit_context')['result'];assert context['last']['remoteRefs']==['origin/main']
save('Amended summary\n\nFull body',amend=True,confirmed=True)
assert git('rev-parse','HEAD')!=head and git('rev-parse','HEAD^{tree}')==tree
assert git('show','-s','--format=%B')=='Amended summary\n\nFull body'
assert git('rev-parse','refs/remotes/origin/main')==head
print('PASS message-only amend and published reference evidence')
(repo/'a[1].txt').write_text('staged\n');git('add','--','a[1].txt');(repo/'a[1].txt').write_text('unstaged\n')
save('Authored\n\nDescription',authorName='Ada Lovelace',authorEmail='ada@invalid.local',coauthors=['Grace Hopper <grace@invalid.local>'])
assert git('show','HEAD:a[1].txt')=='staged' and (repo/'a[1].txt').read_text()=='unstaged\n'
assert git('show','-s','--format=%an <%ae>')=='Ada Lovelace <ada@invalid.local>'
assert 'Co-authored-by: Grace Hopper <grace@invalid.local>' in git('show','-s','--format=%B')
print('PASS staged-only commit, author and coauthor')
current=git('rev-parse','HEAD');index=git('write-tree')
for changes in [dict(expectedHead=head),dict(authorName='Injected\nName',authorEmail='x@y'),dict(coauthors=['bad']),dict(message='')]:
 opts=dict(message='Must refuse',expectedHead=current,amend=True,confirmed=True);opts.update(changes)
 call('action',dict(op='commit_options',input=json.dumps(opts)),False)
 assert git('rev-parse','HEAD')==current and git('write-tree')==index
print('PASS stale HEAD and malformed input refuse without state changes')
detail=call('commit_context',dict(sha=current))['result'];assert detail['files']==[dict(path='a[1].txt',status='M')]
assert detail['authorEmail']=='ada@invalid.local' and detail['parents'] and detail['signature']=='N'
print('PASS exact commit metadata and literal changed path')
