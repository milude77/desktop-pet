use std::fs;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DiscoveredPlugin {
    pub path: String,
    pub manifest: serde_json::Value,
}

#[tauri::command]
pub fn discover_plugins() -> Result<Vec<DiscoveredPlugin>, String> {
    // 1. 确定 plugins 目录

    let plugins_dir = if cfg!(debug_assertions) {
        // --------------------------------
        // 开发环境
        // D:\desktop-pet\plugins
        // --------------------------------

        let manifest_dir = env!("CARGO_MANIFEST_DIR");

        std::path::PathBuf::from(manifest_dir)
            .parent()
            .ok_or_else(|| "无法获取项目根目录".to_string())?
            .join("plugins")
    } else {
        // --------------------------------
        // Release 环境
        // EXE同级 plugins
        //
        // DesktopPet/
        // ├── DesktopPet.exe
        // └── plugins/
        // --------------------------------

        let exe_path = std::env::current_exe()
            .map_err(|e| format!("无法获取程序路径: {}", e))?;

        let exe_dir = exe_path
            .parent()
            .ok_or_else(|| "无法获取程序所在目录".to_string())?;

        exe_dir.join("plugins")
    };

    println!("插件目录: {}", plugins_dir.display());

    // 2. plugins目录不存在

    if !plugins_dir.exists() {
        println!("插件目录不存在");

        return Ok(Vec::new());
    }

    // 3. plugins不是目录

    if !plugins_dir.is_dir() {
        return Ok(Vec::new());
    }

    // 4. 读取插件目录

    let entries = fs::read_dir(&plugins_dir)
        .map_err(|e| format!("无法读取 plugins 目录: {}", e))?;

    let mut plugins = Vec::new();

    // 5. 遍历所有插件

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        let path = entry.path();

        // 只处理目录
        if !path.is_dir() {
            continue;
        }

        // 6. 查找 manifest.json

        let manifest_path = path.join("manifest.json");

        if !manifest_path.is_file() {
            println!(
                "跳过插件 {:?}：不存在 manifest.json",
                path.file_name()
            );

            continue;
        }

        // 7. 读取 manifest.json

        let content = match fs::read_to_string(&manifest_path) {
            Ok(content) => content,
            Err(e) => {
                println!(
                    "读取插件 {:?} 的 manifest.json 失败: {}",
                    path.file_name(),
                    e
                );

                continue;
            }
        };

        // 8. 解析 JSON

        let manifest: serde_json::Value =
            match serde_json::from_str(&content) {
                Ok(manifest) => manifest,
                Err(e) => {
                    println!(
                        "解析插件 {:?} 的 manifest.json 失败: {}",
                        path.file_name(),
                        e
                    );

                    continue;
                }
            };

        // 9. 添加插件

        plugins.push(DiscoveredPlugin {
            path: path.to_string_lossy().to_string(),
            manifest,
        });
    }

    println!("发现 {} 个插件", plugins.len());

    Ok(plugins)
}

#[tauri::command]
pub fn read_plugin_file(
    path: String,
    main: String,
) -> Result<String, String> {
    let plugin_path = std::path::PathBuf::from(path).join(main);

    println!(
        "读取插件文件: {}",
        plugin_path.display()
    );

    fs::read_to_string(&plugin_path)
        .map_err(|e| format!("读取插件文件失败: {}", e))
}