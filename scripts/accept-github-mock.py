from fixture_support import cli_path
"""Hermetic GitHub CLI bridge contract tests. The only gh executable on PATH is a local mock."""
import json,os,subprocess,tempfile,pathlib
base=pathlib.Path(__file__).resolve().parents[1]
repo=pathlib.Path(tempfile.mkdtemp(prefix="arclane-github-mock-",dir=r"C:\AI\REA\Experiments\Forge-Testbed"))
cli=cli_path()
subprocess.run(["git","-C",str(repo),"init","-q","-b","main"],check=True)
mock=base/"artifacts"/"mock-gh"/"gh.exe"
assert mock.exists(), "Hermetic mock gh.exe missing"
log=base/"artifacts"/"mock-gh-command-log.txt"
log.write_text("",encoding="utf-8")
env=dict(os.environ)
env["PATH"]=str(mock.parent)+os.pathsep+env["PATH"]
env["ARCLANE_GH_MOCK_DATA"]=str(base/"scripts"/"github-fixtures")
env["ARCLANE_GH_MOCK_LOG"]=str(log)
checks=[]
def call(cmd,params,success=True):
 result=subprocess.run([str(cli),cmd,str(repo),json.dumps(params,ensure_ascii=False)],capture_output=True,encoding="utf-8",text=True,env=env)
 assert (result.returncode==0)==success,(cmd,params,result.stdout,result.stderr)
 return json.loads(result.stdout if success else result.stderr)
def ok(label,condition):
 assert condition,label
 checks.append(label)
 print("PASS",label,flush=True)
prs=call("collab",{"kind":"prs"})["result"]
ok("PR list has four fixture records",len(prs)==4)
ok("head/base stack relationship preserved",prs[1]["headRefName"]=="feat/payments" and prs[1]["baseRefName"]=="feat/auth")
issues=call("collab",{"kind":"issues"})["result"]
ok("Issues list contains one issue",issues[0]["number"]==42)
runs=call("collab",{"kind":"runs"})["result"]
ok("CI runs fetched on demand",runs[0]["databaseId"]==101)
pr=call("collab",{"kind":"pr","id":"13"})["result"]
ok("PR detail includes changed files and comments",pr["files"][0]["path"]=="src/payments.ts" and len(pr["comments"])==1)
issue=call("collab",{"kind":"issue","id":"42"})["result"]
ok("Issue detail includes assignee and comments",issue["assignees"][0]["login"]=="bob")
for malformed in ("--evil","1;whoami","0","unknown"):
 call("collab",{"kind":"pr","id":malformed},False)
ok("Malicious/non-numeric PR identifiers rejected",True)
for command,opt in (
 ("pr_create",{"title":"ok","base":"main","body":""}),
 ("pr_review",{"action":"unknown","body":"hi"}),
 ("pr_merge",{"method":"force"}),
 ("issue_assign",{"assignee":"--evil"}),
 ("issue_comment",{"body":""})):
 call("collab_action",{"operation":command,"target":"13","detail":opt},False)
ok("Unsafe/invalid write payloads rejected",True)
before=log.read_text(encoding="utf-8")
call("collab_action",{"operation":"pr_create","target":"","detail":{"title":"Local test PR","body":"No network test","base":"main","draft":True}})
after=log.read_text(encoding="utf-8")
assert "--title=Local test PR" in after and "--draft" in after
ok("PR create passes explicit flags to mock only",after!=before)
call("collab_action",{"operation":"pr_review","target":"13","detail":{"action":"request_changes","body":"Requires tests"}})
call("collab_action",{"operation":"pr_merge","target":"13","detail":{"method":"squash"}})
call("collab_action",{"operation":"issue_close","target":"42","detail":{}})
call("collab_action",{"operation":"issue_assign","target":"42","detail":{"assignee":"alice"}})
logtext=log.read_text(encoding="utf-8")
ok("PR reviews, merges, issue closure and assign generate mock commands",all(x in logtext for x in ["pr\treview\t13","pr\tmerge\t13","issue\tclose\t42","issue\tedit\t42"]))
assert not list(repo.glob(".git/refs/remotes/**/*"))
output=base/"artifacts"/"github-mock-acceptance.json"
output.write_text(json.dumps({"passed":len(checks),"checks":checks,"repo":str(repo),"mock":str(mock),"note":"These are mock CLI contracts, NOT real GitHub provider acceptance."},indent=2),encoding="utf-8")
print("PASSED",len(checks),"mock-provider groups")
