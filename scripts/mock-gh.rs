//! Hermetic fake 'gh.exe'. Never performs network or GitHub actions.
//! Only used by Arclane's locally isolated acceptance tests.
use std::{env,fs::{self,OpenOptions},io::Write,path::PathBuf};
fn main(){
 let args:Vec<String>=env::args().skip(1).collect();
 if let Ok(log)=env::var("ARCLANE_GH_MOCK_LOG"){
    if let Ok(mut f)=OpenOptions::new().create(true).append(true).open(log){
       let line=args.iter().map(|v|v.replace('\t'," ").replace('\n',"\\n")).collect::<Vec<_>>().join("\t");
       let _=writeln!(f,"{line}");
    }
 }
 let base=match env::var("ARCLANE_GH_MOCK_DATA"){Ok(p)=>PathBuf::from(p),Err(_)=>{eprintln!("ARCLANE_GH_MOCK_DATA missing");std::process::exit(1);}};
 if args.first().is_some_and(|s|s=="--mock-child"){
   if let Ok(mut f)=OpenOptions::new().create(true).append(true).open(base.join("child-pids.txt")){let _=writeln!(f,"{}",std::process::id());}
   std::thread::sleep(std::time::Duration::from_secs(120));return;
 }
 if base.join("spawn-child").exists(){let _=std::process::Command::new(env::current_exe().unwrap()).arg("--mock-child").spawn();}
 if let Ok(delay)=fs::read_to_string(base.join("delay-ms")){if let Ok(ms)=delay.trim().parse::<u64>(){std::thread::sleep(std::time::Duration::from_millis(ms.min(120000)));}}
 if let Ok(error)=fs::read_to_string(base.join("error.txt")){eprintln!("{error}");std::process::exit(4);}
 if base.join("oversize").exists(){print!("{}","X".repeat(4_000_000));return;}
 let data=match(args.first().map(String::as_str),args.get(1).map(String::as_str)){
   (Some("pr"),Some("list"))=>"prs.json".into(),
   (Some("pr"),Some("view"))=>format!("pr-{}.json",args.get(2).map(String::as_str).unwrap_or("none")),
   (Some("pr"),Some("diff"))=>format!("pr-{}.patch",args.get(2).map(String::as_str).unwrap_or("none")),
   (Some("issue"),Some("list"))=>"issues.json".into(),
   (Some("issue"),Some("view"))=>format!("issue-{}.json",args.get(2).map(String::as_str).unwrap_or("none")),
   (Some("run"),Some("list"))=>"runs.json".into(),
   (Some("run"),Some("view"))=>format!("run-{}.json",args.get(2).map(String::as_str).unwrap_or("none")),
   (Some("auth"),Some("status"))=>{println!("authenticated (mock)");return;},
   (Some("pr"),Some("create"))=>{println!("https://github.com/fixture/fixture/pull/99");return;},
   (Some("issue"),Some("create"))=>{println!("https://github.com/fixture/fixture/issues/99");return;},
   (Some("pr"),Some("review"|"merge"|"comment"))|
   (Some("issue"),Some("close"|"reopen"|"edit"|"comment"))=>{println!("mock accepted; no network mutation");return;},
   _=>{eprintln!("mock gh command rejected: {:?}",args);std::process::exit(2)}
 };
 let path=base.join(data);
 match fs::read_to_string(&path){Ok(content)=>println!("{content}"),Err(e)=>{eprintln!("mock fixture {}: {e}",path.display());std::process::exit(3)}}
}
