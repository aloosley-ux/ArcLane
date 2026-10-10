"""Hermetic provider process acceptance. All gh invocations route to our offline mock."""
import ctypes,json,os,pathlib,shutil,subprocess,tempfile,time
base=pathlib.Path(__file__).resolve().parents[1];mock=base/'artifacts'/'mock-gh'/'gh.exe';assert mock.is_file(),'Mock missing; refusing provider tests'
repo=pathlib.Path(tempfile.mkdtemp(prefix='arclane-provider-bounds-',dir=r'C:\AI\REA\Experiments\Forge-Testbed'))
subprocess.check_call(['git','init','-q',str(repo)])
data=pathlib.Path(tempfile.mkdtemp(prefix='provider-process-',dir=base/'artifacts'))
for file in (base/'scripts'/'github-fixtures').iterdir():shutil.copy(file,data/file.name)
env=os.environ|dict(PATH=str(mock.parent)+';'+os.environ['PATH'],ARCLANE_GH_MOCK_DATA=str(data),ARCLANE_GH_TIMEOUT_MS='1000',ARCLANE_GH_MOCK_LOG=str(data/'calls.log'))
cli=r'C:\AI\REA\Experiments\Forge\src-tauri\target\release\arclane-cli.exe'
def call(kind,id=None,ok=True):
 start=time.monotonic();p=subprocess.run([cli,'collab',str(repo),json.dumps(dict(kind=kind,id=id))],env=env,text=True,capture_output=True,timeout=10)
 assert (p.returncode==0)==ok,(p.stdout,p.stderr);assert time.monotonic()-start<6
 return json.loads(p.stdout if ok else p.stderr)
assert 'retries = 3' in call('pr_diff','13')['result']['patch'];assert call('run','101')['result']['jobs'][0]['steps'][1]['conclusion']=='failure'
print('PASS offline PR patch and CI job/step details')
for text,advice in [('HTTP 401 authentication failed ghp_secret','gh auth login'),('HTTP 429 rate limit exceeded','rate limit'),('network connection failed','Check your connection'),('HTTP 404 repository not found','repository access')]:
 (data/'error.txt').write_text(text);error=call('prs',ok=False)['error'];assert advice in error and 'ghp_secret' not in error
(data/'error.txt').unlink();print('PASS actionable auth/rate-limit/network/access errors with token redaction')
(data/'oversize').write_text('1');assert 'exceeded 3 MB' in call('prs',ok=False)['error'];(data/'oversize').unlink();print('PASS output limit stops provider output before unbounded accumulation')
(data/'delay-ms').write_text('60000');(data/'spawn-child').write_text('1');assert 'timed out' in call('prs',ok=False)['error']
kernel=ctypes.WinDLL('kernel32',use_last_error=True);kernel.OpenProcess.restype=ctypes.c_void_p;kernel.CloseHandle.argtypes=[ctypes.c_void_p];kernel.GetExitCodeProcess.argtypes=[ctypes.c_void_p,ctypes.POINTER(ctypes.c_ulong)]
def alive(pid):
 h=kernel.OpenProcess(0x1000,False,pid)
 if not h:return False
 code=ctypes.c_ulong();kernel.GetExitCodeProcess(h,ctypes.byref(code));kernel.CloseHandle(h);return code.value==259
pids=[int(v) for v in (data/'child-pids.txt').read_text().split()];assert pids and not any(alive(pid) for pid in pids),pids
(data/'delay-ms').unlink();(data/'spawn-child').unlink();print('PASS timeout kills provider and independently verifies no live helper child')
assert len(call('prs')['result'])==4;print('PASS explicit retry recovers after timeout')
assert subprocess.check_output(['git','-C',str(repo),'status','--porcelain'],text=True)==''
print('ACCEPTED provider process groups; mock only, no live GitHub compatibility claim')
