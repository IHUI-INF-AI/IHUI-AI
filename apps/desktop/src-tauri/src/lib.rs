use serde::{Deserialize, Serialize};
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
#[cfg(debug_assertions)]
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
struct AppInfo {
    name: String,
    version: String,
    platform: String,
}

/// 桌面端 admin 窗口元数据,前端用于决定窗口尺寸/标题。
#[derive(Debug, Serialize, Deserialize)]
struct AdminWindowInfo {
    label: String,
    title: String,
    width: f64,
    height: f64,
    min_width: f64,
    min_height: f64,
}

#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: "IHUI AI".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
    }
}

#[tauri::command]
fn get_admin_window_info() -> AdminWindowInfo {
    AdminWindowInfo {
        label: "admin".to_string(),
        title: "IHUI AI 管理后台".to_string(),
        width: 1280.0,
        height: 820.0,
        min_width: 960.0,
        min_height: 640.0,
    }
}

/// 构造应用主菜单(文件/视图/帮助三组)。Windows / macOS 通用。
#[tauri::command]
fn build_app_menu(app: tauri::AppHandle) -> Result<(), String> {
    let file_open_admin = MenuItemBuilder::with_id("file.open_admin", "打开管理后台…")
        .accelerator("CmdOrCtrl+Shift+A")
        .build(&app)
        .map_err(|e| e.to_string())?;
    let file_quit = MenuItemBuilder::with_id("file.quit", "退出")
        .accelerator("CmdOrCtrl+Q")
        .build(&app)
        .map_err(|e| e.to_string())?;
    let view_reload = MenuItemBuilder::with_id("view.reload", "刷新")
        .accelerator("CmdOrCtrl+R")
        .build(&app)
        .map_err(|e| e.to_string())?;
    let view_toggle_devtools = MenuItemBuilder::with_id("view.devtools", "切换开发者工具")
        .accelerator("F12")
        .build(&app)
        .map_err(|e| e.to_string())?;
    let help_about = MenuItemBuilder::with_id("help.about", "关于 IHUI AI")
        .build(&app)
        .map_err(|e| e.to_string())?;

    let file_menu = SubmenuBuilder::new(&app, "文件")
        .item(&file_open_admin)
        .separator()
        .item(&file_quit)
        .build()
        .map_err(|e| e.to_string())?;
    let view_menu = SubmenuBuilder::new(&app, "视图")
        .item(&view_reload)
        .item(&view_toggle_devtools)
        .build()
        .map_err(|e| e.to_string())?;
    let help_menu = SubmenuBuilder::new(&app, "帮助")
        .item(&help_about)
        .build()
        .map_err(|e| e.to_string())?;

    let menu = MenuBuilder::new(&app)
        .item(&file_menu)
        .item(&view_menu)
        .item(&help_menu)
        .build()
        .map_err(|e| e.to_string())?;
    app.set_menu(menu).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            let _ = build_app_menu(app.handle().clone());
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_admin_window_info,
            build_app_menu
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
