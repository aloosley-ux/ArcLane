"""Independent Git fixture and CLI selection shared by acceptance scripts."""
import os,json,pathlib,subprocess,tempfile,hashlib
BASE=pathlib.Path(__file__).resolve().parents[1]
def cli_path():
    value=os.environ.get('ARCLANE_CLI')
    if not value or not pathlib.Path(value).is_file():raise SystemExit('Set ARCLANE_CLI to this checkout\'s freshly compiled CLI')
    return value
class Fixture:
    def __init__(self,name):
        root=pathlib.Path(r'C:\AI\REA\Experiments\Forge-Testbed');root.mkdir(parents=True,exist_ok=True)
        self.repo=pathlib.Path(tempfile.mkdtemp(prefix='arclane-run3-'+name+'-',dir=root))
        self.data=pathlib.Path(tempfile.mkdtemp(prefix='run3-'+name+'-data-',dir=BASE/'artifacts'))
        self.env=os.environ|{'ARCLANE_DATA_DIR':str(self.data)}
        self.git('init','-q','-b','main');self.git('config','user.name','Fixture');self.git('config','user.email','fixture@invalid.local');self.git('config','core.autocrlf','false')
    def git(self,*args):
        p=subprocess.run(['git','--literal-pathspecs','-C',str(self.repo),*args],capture_output=True,env=os.environ|{'GIT_OPTIONAL_LOCKS':'0'})
        assert p.returncode==0,(args,p.stderr.decode(errors='replace'))
        return p.stdout
    def write(self,name,data):
        p=self.repo/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
    def commit(self):self.git('add','.');self.git('commit','-qm','fixture')
    def call(self,command,opts=None,ok=True,repo=None,env=None):
        p=subprocess.run([cli_path(),command,str(repo or self.repo),json.dumps(opts or {},ensure_ascii=False)],env=env or self.env,capture_output=True,encoding='utf-8')
        assert (p.returncode==0)==ok,(command,opts,p.stdout,p.stderr)
        return json.loads(p.stdout if ok else p.stderr).get('result') if ok else json.loads(p.stderr)['error']
    def state(self):
        tree=self.git('write-tree')
        index=pathlib.Path(self.git('rev-parse','--git-path','index').decode().strip());index=index if index.is_absolute() else self.repo/index
        return {'head':self.git('rev-parse','HEAD'),'refs':self.git('show-ref'),'index':index.read_bytes(),'tree':tree,'status':self.git('status','--porcelain=v1','-z'),'files':{str(p.relative_to(self.repo)):p.read_bytes() for p in self.repo.rglob('*') if p.is_file() and '.git' not in p.parts and not p.is_symlink()}}
def save(name,checks,fixtures):
    (BASE/'artifacts'/f'{name}.json').write_text(json.dumps({'checks':checks,'fixtures':[str(f.repo) for f in fixtures]},indent=2))
    print('ACCEPTED',len(checks),'independent checks',flush=True)
