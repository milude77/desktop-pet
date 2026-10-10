use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
mod plugin;

use plugin::discovery::discover_plugins;


static IS_PASSTHROUGH: AtomicBool = AtomicBool::new(false);

/// 前端调用：切换穿透状态
#[tauri::command]
fn set_passthrough(window: tauri::Window, ignore: bool) {
    IS_PASSTHROUGH.store(ignore, Ordering::Relaxed);
    let _ = window.set_ignore_cursor_events(ignore);
}

/// 前端调用：获取当前穿透状态
#[tauri::command]
fn get_passthrough() -> bool {
    IS_PASSTHROUGH.load(Ordering::Relaxed)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![set_passthrough, get_passthrough, discover_plugins])
        .setup(|app| {
            // 创建托盘菜单
            let toggle_show = MenuItem::with_id(app, "toggle-show", "显示/隐藏桌宠", true, None::<&str>)?;
            let toggle_passthrough = MenuItem::with_id(app, "toggle-passthrough", "鼠标穿透", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&toggle_show, &toggle_passthrough, &separator, &quit])?;

            // 创建托盘图标
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("桌面宠物")
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "toggle-show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        "toggle-passthrough" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let current = IS_PASSTHROUGH.load(Ordering::Relaxed);
                                let new_val = !current;
                                IS_PASSTHROUGH.store(new_val, Ordering::Relaxed);
                                let _ = window.set_ignore_cursor_events(new_val);
                                let text = if new_val { "鼠标穿透✓ " } else { "鼠标穿透" };
                                let _ = toggle_passthrough.set_text(text);
                                // 通知前端状态变化
                                let _ = app.emit("passthrough-changed", new_val);
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}