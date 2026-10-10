use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};
mod plugin;

use plugin::discovery::discover_plugins;
use plugin::discovery::read_plugin_file;


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

/// 显示气泡窗口
#[tauri::command]
fn show_bubble(app: tauri::AppHandle, text: String, duration: Option<u64>) -> Result<(), String> {
    let main_win = app.get_webview_window("main").ok_or("主窗口未找到")?;

    // 先定位气泡到主窗口上方
    if let Some(bubble) = app.get_webview_window("bubble") {
        let main_pos = main_win.outer_position().map_err(|e| e.to_string())?;
        let main_size = main_win.outer_size().map_err(|e| e.to_string())?;

        // 气泡窗口放在宠物上方
        let bubble_width = 300u32;
        let bubble_height = 160u32;
        let x = main_pos.x + (main_size.width as i32 / 2) - (bubble_width as i32 / 2);
        let y = main_pos.y - bubble_height as i32 + 15;

        bubble.set_position(tauri::PhysicalPosition::new(x, y)).map_err(|e| e.to_string())?;
        bubble.show().map_err(|e| e.to_string())?;
        bubble.emit("bubble:show", serde_json::json!({
            "text": text,
            "duration": duration.unwrap_or(5000),
        })).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// 隐藏气泡窗口
#[tauri::command]
fn hide_bubble(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(bubble) = app.get_webview_window("bubble") {
        bubble.emit("bubble:hide", ()).map_err(|e| e.to_string())?;
        bubble.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 更新气泡窗口位置（拖拽时调用）
#[tauri::command]
fn update_bubble_position(app: tauri::AppHandle) -> Result<(), String> {
    let main_win = app.get_webview_window("main").ok_or("主窗口未找到")?;
    let bubble_win = app.get_webview_window("bubble").ok_or("气泡窗口未找到")?;

    // 仅在气泡可见时更新位置
    if !bubble_win.is_visible().unwrap_or(false) {
        return Ok(());
    }

    let main_pos = main_win.outer_position().map_err(|e| e.to_string())?;
    let main_size = main_win.outer_size().map_err(|e| e.to_string())?;

    let bubble_width = 300i32;
    let bubble_height = 160i32;
    let x = main_pos.x + (main_size.width as i32 / 2) - (bubble_width / 2);
    let y = main_pos.y - bubble_height + 15;

    bubble_win.set_position(tauri::PhysicalPosition::new(x, y)).map_err(|e| e.to_string())?;

    Ok(())
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![set_passthrough, get_passthrough, discover_plugins, read_plugin_file, show_bubble, hide_bubble, update_bubble_position])
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
                                    // 同时隐藏气泡窗口
                                    if let Some(bubble) = app.get_webview_window("bubble") {
                                        let _ = bubble.hide();
                                    }
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

            // 创建气泡窗口（初始隐藏）
            let app_handle = app.handle().clone();
            let bubble_win = WebviewWindowBuilder::new(&app_handle, "bubble", WebviewUrl::App("bubble.html".into()))
                .title("bubble")
                .inner_size(300.0, 160.0)
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .shadow(false)
                .visible(false)
                .build()?;

            // 气泡窗口鼠标穿透
            let _ = bubble_win.set_ignore_cursor_events(true);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}