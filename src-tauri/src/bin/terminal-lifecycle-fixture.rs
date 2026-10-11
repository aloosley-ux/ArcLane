//! Harmless process used by the backend lifecycle tests only.
use std::io::{self, BufRead, Write};
use std::process::{Command, Stdio};

fn main() {
    let mode = std::env::args().nth(1);
    println!("FIXTURE_MODE={mode:?}"); let _ = io::stdout().flush();
    match mode.as_deref() {
        Some("exit7") => { println!("FIXTURE_RAPID_STDOUT"); let _ = io::stdout().flush(); std::process::exit(7); }
        Some("tree-parent") => {
            println!("FIXTURE_PARENT_READY"); let _ = io::stdout().flush();
            for line in io::stdin().lock().lines().flatten() {
                if line.trim() == "spawn-child" {
                    let child = Command::new(std::env::current_exe().unwrap()).arg("tree-child")
                        .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().unwrap();
                    println!("FIXTURE_CHILD_PID={}", child.id()); let _ = io::stdout().flush();
                }
            }
        }
        Some("tree-child") => loop { std::thread::park(); },
        _ => std::process::exit(2),
    }
}
