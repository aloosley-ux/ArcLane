//! Harmless Codex-named process used only by local acceptance.
use std::io::{self,BufRead,Write};
fn main(){
    let args:Vec<_>=std::env::args_os().skip(1).collect();
    if args.first().is_some_and(|arg|arg=="--child"){
        if let Some(target)=args.get(1){let _=std::fs::write(target,std::process::id().to_string());}
        loop{std::thread::park();}
    }
    let spawn_child=args.first().is_some_and(|arg|arg=="--spawn-child");
    println!("FIXTURE_READY");
    println!("CWD={}",std::env::current_dir().unwrap_or_default().display());
    for (index,arg) in args.iter().enumerate(){println!("ARG{index}={arg:?}");}
    if let Some(position)=args.iter().position(|arg|arg=="--capture") { if let Some(target)=args.get(position+1){let _=std::fs::write(target,format!("CWD={}\nARGS={args:?}\n",std::env::current_dir().unwrap_or_default().display()));} }
    let _=io::stdout().flush();
    if args.iter().any(|arg|arg=="--exit7"){println!("FIXTURE_RAPID_STDOUT");let _=io::stdout().flush();std::process::exit(7);}
    for line in io::stdin().lock().lines(){
        let Ok(line)=line else{break};
        let command=line.trim_end_matches('\r');
        if spawn_child&&command=="spawn-child" {
            if let (Some(exe),Some(pidfile))=(args.get(1),args.get(2)){
                match std::process::Command::new(exe).arg("--child").arg(pidfile).stdin(std::process::Stdio::null()).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null()).spawn(){
                    Ok(_)=>println!("FIXTURE_CHILD_STARTED"),Err(error)=>println!("FIXTURE_CHILD_ERROR={error}")
                }
                let _=io::stdout().flush();
            }
            continue;
        }
        if let Some(code)=command.strip_prefix("exit ").and_then(|n|n.parse::<i32>().ok()) { println!("FIXTURE_EXIT={code}");let _=io::stdout().flush();std::process::exit(code); }
        println!("FIXTURE_INPUT={command:?}");let _=io::stdout().flush();
    }
}
