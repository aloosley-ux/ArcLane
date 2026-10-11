//! On-demand discovery and validation for supported local coding agent CLIs.
use serde_json::{json, Value};
use std::{env, fs::File, io::Read, path::{Path, PathBuf}};

fn names(agent: &str) -> Result<&'static [&'static str], String> {
    match agent {
        "codex" => Ok(&["codex.exe"]),
        "kilo" => Ok(&["kilo.exe", "kilo-agent.exe"]),
        _ => Err("Choose Codex or Kilo".into()),
    }
}

fn is_valid(agent: &str, path: &Path) -> bool {
    let mut signature=[0u8;2];
    path.is_file() && path.extension().is_some_and(|e| e.eq_ignore_ascii_case("exe"))
        && path.file_name().and_then(|n| n.to_str()).is_some_and(|n| names(agent).ok().is_some_and(|list| list.iter().any(|candidate| n.eq_ignore_ascii_case(candidate))))
        && File::open(path).and_then(|mut f|f.read_exact(&mut signature)).is_ok() && signature==*b"MZ"
}

fn candidates(agent: &str) -> Result<Vec<PathBuf>, String> {
    let exe_names = names(agent)?;
    let mut paths = Vec::new();
    if let Some(local) = env::var_os("LOCALAPPDATA") {
        let local = PathBuf::from(local);
        paths.push(local.join("Programs").join(agent).join(exe_names[0]));
        paths.push(local.join("Programs").join("OpenAI").join("Codex").join(exe_names[0]));
        paths.push(local.join("Programs").join("Kilo").join(exe_names[0]));
    }
    if let Some(home) = env::var_os("USERPROFILE") {
        paths.push(PathBuf::from(home).join(".local").join("bin").join(exe_names[0]));
    }
    for folder in env::split_paths(&env::var_os("PATH").unwrap_or_default()) {
        for name in exe_names { paths.push(folder.join(name)); }
    }
    Ok(paths)
}

#[tauri::command]
pub fn agent_discover() -> Result<Value, String> {
    let mut result = Vec::new();
    for agent in ["codex", "kilo"] {
        let found = candidates(agent)?.into_iter().find(|p| is_valid(agent, p));
        result.push(json!({"agent":agent,"available":found.is_some(),"path":found.map(|p|p.to_string_lossy().into_owned())}));
    }
    Ok(json!(result))
}

#[tauri::command]
pub fn agent_validate(agent: String, path: String) -> Result<String, String> {
    names(&agent)?;
    if path.trim().is_empty() || path.len() > 2048 { return Err("Enter an executable path (up to 2048 characters)".into()); }
    let source = Path::new(path.trim());
    if !source.is_absolute() { return Err("Executable path must be absolute".into()); }
    let resolved = source.canonicalize().map_err(|_| "Executable was not found")?;
    if !is_valid(&agent, &resolved) { return Err(format!("Choose a {} executable (.exe)", if agent == "codex" { "Codex" } else { "Kilo" })); }
    Ok(resolved.to_string_lossy().into_owned())
}
