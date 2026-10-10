use std::fs;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DiscoveredPlugin {
    pub path: String,
    pub manifest: serde_json::Value,
}

#[tauri::command]
pub fn discover_plugins() -> Result<Vec<DiscoveredPlugin>, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("无法获取程序路径: {}", e))?;

    let exe_dir = exe_path
        .parent()
        .ok_or_else(|| "无法获取程序所在目录".to_string())?;

    let plugins_dir = exe_dir.join("plugins");

    if !plugins_dir.exists() || !plugins_dir.is_dir() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&plugins_dir)
        .map_err(|e| format!("无法读取 plugins 目录: {}", e))?;

    let mut plugins = Vec::new();

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let manifest_path = path.join("manifest.json");

        if !manifest_path.is_file() {
            continue;
        }

        let content = match fs::read_to_string(&manifest_path) {
            Ok(content) => content,
            Err(_) => continue,
        };

        let manifest = match serde_json::from_str(&content) {
            Ok(manifest) => manifest,
            Err(_) => continue,
        };

        plugins.push(DiscoveredPlugin {
            path: path.to_string_lossy().to_string(),
            manifest,
        });
    }

    Ok(plugins)
}