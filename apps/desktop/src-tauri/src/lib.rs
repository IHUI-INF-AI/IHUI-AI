// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-09-17 薄壳化配套:线上前端自动刷新 + 断网兜底守卫(详见模块文档)
mod auto_refresh;

use serde::{Deserialize, Serialize};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent, TrayIconId};
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use std::io::Cursor;
use std::collections::{HashMap, VecDeque};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};
use base64::Engine;
use enigo::{Axis, Button, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings};
use screenshots::Screen;

#[derive(Debug, Serialize, Deserialize)]
struct AppInfo {
    name: String,
    version: String,
    platform: String,
}

/// admin 窗口元数据,前端用于决定窗口尺寸/标题。
#[derive(Debug, Serialize, Deserialize)]
struct AdminWindowInfo {
    label: String,
    title: String,
    width: f64,
    height: f64,
    min_width: f64,
    min_height: f64,
}

// ================== Computer Control 返回类型 ==================

#[derive(Serialize)]
struct ScreenshotResult {
    screenshot: String,
}

#[derive(Serialize)]
struct OkResult {
    ok: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowInfo {
    title: String,
    app_name: String,
    window_id: String,
    /// 窗口在屏幕上的 [x, y, width, height](物理像素),2026-08-16 立。
    /// 此前前端收到占位 [0,0,0,0],LLM 无法据此判断窗口位置/大小。
    bounds: [i32; 4],
}

#[derive(Serialize)]
struct ActiveWindowResult {
    window: WindowInfo,
}

#[derive(Serialize)]
struct ClipboardResult {
    clipboard: String,
}

/// 检测系统 UI 语言是否为中文(Windows: GetUserDefaultUILanguage)。
/// 支持的语言代码(与 web 端 i18n 5 语言对齐:zh-CN/zh-TW/ko/ja/en)。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AppLocale {
    ZhCn,
    ZhTw,
    Ko,
    Ja,
    En,
}

#[cfg(windows)]
fn get_system_locale() -> AppLocale {
    use winapi::um::winnls::GetUserDefaultLocaleName;
    let mut buf = [0u16; 85]; // LOCALE_NAME_MAX_LENGTH
    let len = unsafe { GetUserDefaultLocaleName(buf.as_mut_ptr(), buf.len() as i32) };
    if len <= 0 {
        return AppLocale::En;
    }
    let locale: String = String::from_utf16_lossy(&buf[..len as usize - 1])
        .to_lowercase()
        .replace('-', "-");
    // 精确匹配 5 语言,其他降级为 En
    if locale.starts_with("zh-cn") || locale.starts_with("zh-sg") || locale.starts_with("zh-hans") {
        AppLocale::ZhCn
    } else if locale.starts_with("zh-tw") || locale.starts_with("zh-hk") || locale.starts_with("zh-mo") || locale.starts_with("zh-hant") {
        AppLocale::ZhTw
    } else if locale.starts_with("ko") {
        AppLocale::Ko
    } else if locale.starts_with("ja") {
        AppLocale::Ja
    } else {
        AppLocale::En
    }
}

/// 检测系统 UI 语言(非 Windows: LANG 环境变量)。
#[cfg(not(windows))]
fn get_system_locale() -> AppLocale {
    let locale = std::env::var("LANG")
        .unwrap_or_default()
        .to_lowercase()
        .replace('_', "-");
    if locale.starts_with("zh-cn") || locale.starts_with("zh-sg") || locale.starts_with("zh-hans") {
        AppLocale::ZhCn
    } else if locale.starts_with("zh-tw") || locale.starts_with("zh-hk") || locale.starts_with("zh-hant") {
        AppLocale::ZhTw
    } else if locale.starts_with("ko") {
        AppLocale::Ko
    } else if locale.starts_with("ja") {
        AppLocale::Ja
    } else {
        AppLocale::En
    }
}

/// 根据系统 UI 语言返回本地化应用名称:中文(简/繁)→ 智汇AI,其他 → IHUI AI。
fn localized_app_name() -> &'static str {
    match get_system_locale() {
        AppLocale::ZhCn | AppLocale::ZhTw => "智汇AI",
        AppLocale::Ko => "IHUI AI",
        AppLocale::Ja => "IHUI AI",
        AppLocale::En => "IHUI AI",
    }
}

#[tauri::command]
fn get_app_info(app: tauri::AppHandle) -> AppInfo {
    AppInfo {
        name: localized_app_name().to_string(),
        // 版本以 tauri.conf.json 的 version 为准(运行时动态读取,勿在此硬编码版本号),
        // 不再用 Cargo.toml 的 CARGO_PKG_VERSION(0.1.0,二者会漂移)。
        version: app.package_info().version.to_string(),
        platform: std::env::consts::OS.to_string(),
    }
}

fn pick_free_port() -> std::io::Result<u16> {
    let listener = std::net::TcpListener::bind(("127.0.0.1", 0))?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

/// 2026-08-17:用系统 Google Chrome 以 --app 模式打开 URL(独立无边框窗口,完整浏览器功能)。
/// - 用户要求"内置浏览器要谷歌 Chrome,不要 Edge"——Tauri 内嵌只能用 WebView2(Edge 壳),
///   而 Chrome --app 是"Google Chrome 本体 + 独立窗口",登录/点击/输入/视频全支持。
/// - Chrome 常见安装路径探测,找不到返回错误(前端提示安装 Chrome)。
/// - 仅允许 http/https URL(防参数注入)。
#[tauri::command]
fn open_in_chrome(url: String) -> Result<u16, String> {
    let trimmed = url.trim();
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err("仅支持 http/https URL".into());
    }
    let candidates = [
        std::env::var_os("LOCALAPPDATA")
            .map(|p| std::path::PathBuf::from(p).join("Google/Chrome/Application/chrome.exe")),
        std::env::var_os("PROGRAMFILES")
            .map(|p| std::path::PathBuf::from(p).join("Google/Chrome/Application/chrome.exe")),
        std::env::var_os("PROGRAMFILES(X86)")
            .map(|p| std::path::PathBuf::from(p).join("Google/Chrome/Application/chrome.exe")),
        Some(std::path::PathBuf::from(
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        )),
        Some(std::path::PathBuf::from(
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        )),
    ];
    let chrome = candidates.into_iter().flatten().find(|p| p.exists());
    let Some(chrome) = chrome else {
        return Err("未找到 Google Chrome,请先安装 Chrome 浏览器".into());
    };

    let port = pick_free_port().map_err(|e| format!("分配调试端口失败: {}", e))?;
    let mut cmd = std::process::Command::new(&chrome);
    cmd.arg(format!("--app={}", trimmed))
        .arg("--new-window")
        .arg(format!("--remote-debugging-port={}", port))
        .arg("--user-data-dir=/tmp/ihui-chrome-profile");
    let _child = cmd.spawn().map_err(|e| format!("启动 Chrome 失败: {}", e))?;
    Ok(port)
}

/// 启动窗口 resize(P0-1:8 方向边缘缩放,2026-07-27 立)。
/// direction: n/s/e/w/ne/nw/se/sw
/// label: 窗口标签(main/admin),默认 "main"。2026-07-27 立:支持 admin 窗口独立 resize。
///
/// 2026-07-28 修复:最大化/全屏状态下拒绝 resize(Windows 原生行为)。
/// 前端 MainShell 也已禁用最大化时的 resize 区域渲染,这里作为防御性兜底。
#[tauri::command]
fn start_resize(
    direction: String,
    label: Option<String>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let dir_name = match direction.as_str() {
        "n" => "North",
        "s" => "South",
        "e" => "East",
        "w" => "West",
        "ne" => "NorthEast",
        "nw" => "NorthWest",
        "se" => "SouthEast",
        "sw" => "SouthWest",
        _ => return Err(format!("unknown direction: {}", direction)),
    };
    let label = label.as_deref().unwrap_or("main");
    let webview = app
        .get_webview_window(label)
        .ok_or_else(|| format!("window {} not found", label))?;
    let win = webview.as_ref().window();
    // 2026-07-28 立:最大化/全屏状态下拒绝 resize(Windows 原生行为)
    if win.is_maximized().unwrap_or(false) {
        return Err("window is maximized".to_string());
    }
    if win.is_fullscreen().unwrap_or(false) {
        return Err("window is fullscreen".to_string());
    }
    let dir = serde_json::from_value(serde_json::Value::String(dir_name.to_string()))
        .map_err(|e| e.to_string())?;
    win.start_resize_dragging(dir).map_err(|e| e.to_string())
}

/// 切换窗口全屏状态(P2:桌面端标配,2026-07-27 立)。
/// 返回切换后的全屏状态(true=全屏,false=窗口模式)。
#[tauri::command]
fn toggle_fullscreen(window: tauri::WebviewWindow) -> Result<bool, String> {
    let fs = window.is_fullscreen().unwrap_or(false);
    window.set_fullscreen(!fs).map_err(|e| e.to_string())?;
    Ok(!fs)
}

/// 切换窗口置顶状态(P2:AI 对话悬浮场景,2026-07-27 立)。
/// 返回切换后的置顶状态(true=置顶,false=普通)。
#[tauri::command]
fn toggle_always_on_top(window: tauri::WebviewWindow) -> Result<bool, String> {
    let current = window.is_always_on_top().unwrap_or(false);
    window
        .set_always_on_top(!current)
        .map_err(|e| e.to_string())?;
    Ok(!current)
}

#[tauri::command]
fn get_admin_window_info() -> AdminWindowInfo {
    AdminWindowInfo {
        label: "admin".to_string(),
        title: "IHUI AI 管理后台".to_string(),
        width: 1280.0,
        height: 820.0,
        min_width: 1200.0,
        min_height: 720.0,
    }
}

/// 2026-07-25 修订:**已删除原 build_app_menu 函数 + 移除 app.set_menu() 调用**。
///
/// 原因:HTML 顶栏(NativeTopBar.tsx)已自绘菜单 UI,再显示系统原生菜单
/// 会出现"两层菜单栏",体验割裂。原菜单的快捷键(Ctrl+R/F12/Ctrl+Shift+A/Ctrl+Q)
/// 移到 web 端 keydown 监听(见 use-native-shortcuts.ts useNativeShortcuts),
/// 真正需要 Rust 的能力(F12 devtools / Ctrl+Shift+A 唤起 admin / Ctrl+Q 退出)
/// 通过 invoke 命令调用,逻辑保持不变。
///
/// 此位置预留,如未来需恢复原生菜单可参照之前版本。

/// 切换 webview 开发者工具(前端 menu dispatcher 调用,2026-07-25 立)。
/// Tauri 2 没有 JS 端 toggle API,必须在 Rust 端做。
#[tauri::command]
fn toggle_devtools(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.is_devtools_open() {
        window.close_devtools();
    } else {
        window.open_devtools();
    }
    Ok(())
}

/// 真正退出应用(供前端 menu dispatcher 调用,2026-07-25 立)。
/// 绕过 closeWindow 的"隐藏到托盘"语义,直接走 `app.exit(0)`。
/// 2026-07-27 立:退出时持久化所有窗口状态(main + admin)。
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    let _ = save_window_state(Some("main".to_string()), app.clone());
    let _ = save_window_state(Some("admin".to_string()), app.clone());
    app.exit(0);
}

/// 重启应用(2026-07-31 立,updater 安装完成后调用)。
/// Tauri 2 标准 API `app.restart()`:终止当前进程并以新进程拉起同路径可执行文件。
/// 用于 updater 下载安装完毕后让新版本立即生效,无需用户手动关闭再打开。
#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    // 持久化窗口状态后再重启,避免重启后窗口位置丢失
    let _ = save_window_state(Some("main".to_string()), app.clone());
    let _ = save_window_state(Some("admin".to_string()), app.clone());
    app.restart();
}

/// 唤起 / 创建 admin 窗口(2026-07-25 立,供前端 menu dispatcher 调用)。
/// admin 已存在则 show + focus;否则按 tauri.conf.json admin 配置新建。
/// 2026-07-27 立:新建后恢复 admin 窗口上次位置/尺寸(若有保存)+ 添加窗口阴影。
#[tauri::command]
async fn open_admin_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("admin") {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    let app_name = localized_app_name();
    // 2026-09-17 薄壳化配套修复:admin 窗口原用 WebviewUrl::App("admin"),
    // 薄壳后 frontendDist 改为 src-tauri/shell(仅占位页),App 路径会解析为不存在的
    // shell/admin → 空白窗口。改为加载线上管理后台同源页面。
    let admin_url = std::env::var("IHUI_ADMIN_URL")
        .unwrap_or_else(|_| "https://aizhs.top/admin".to_string());
    let _admin_window = WebviewWindowBuilder::new(&app, "admin", WebviewUrl::External(
        admin_url.parse().map_err(|e| format!("admin url: {e}"))?,
    ))
    .title(&format!("{} 管理后台", app_name))
    .inner_size(1280.0, 820.0)
    .min_inner_size(1200.0, 720.0)
    .resizable(true)
    .center()
    .decorations(false)
    .shadow(true)
    .build()
    .map_err(|e| e.to_string())?;
    // 创建后恢复 admin 窗口上次位置/尺寸(若有保存)
    let _ = restore_window_state(Some("admin".to_string()), app.clone());
    Ok(())
}

/// 返回托盘菜单 7 项的本地化文案(5 语言全配,与 web 端 i18n 对齐)。
/// 2026-07-29 扩充:新增对话/切换主题/打开设置/检查更新,emit 事件给前端处理。
fn tray_menu_labels() -> [&'static str; 7] {
    match get_system_locale() {
        AppLocale::ZhCn => [
            "新建对话", "显示主窗口", "隐藏主窗口", "切换主题", "打开设置", "检查更新", "退出",
        ],
        AppLocale::ZhTw => [
            "新建對話", "顯示主視窗", "隱藏主視窗", "切換主題", "開啟設定", "檢查更新", "結束",
        ],
        AppLocale::Ko => [
            "새 대화", "메인 창 표시", "메인 창 숨기기", "테마 전환", "설정 열기", "업데이트 확인", "종료",
        ],
        AppLocale::Ja => [
            "新規会話", "メインウィンドウを表示", "メインウィンドウを隠す", "テーマ切替", "設定を開く", "更新確認", "終了",
        ],
        AppLocale::En => [
            "New Chat", "Show Main Window", "Hide Main Window", "Toggle Theme", "Open Settings", "Check for Updates", "Quit",
        ],
    }
}

/// 构建系统托盘(7 项菜单:新建对话/显示/隐藏/切换主题/设置/检查更新/退出)+ 双击托盘唤起。
/// 2026-07-29 扩充:emit 事件给前端处理业务逻辑(新建对话/主题/设置),检查更新调 updater。
fn build_tray(app: &tauri::AppHandle) -> Result<(), String> {
    let labels = tray_menu_labels();
    let new_chat_item = MenuItemBuilder::with_id("tray.new_chat", labels[0])
        .build(app)
        .map_err(|e| e.to_string())?;
    let show_item = MenuItemBuilder::with_id("tray.show", labels[1])
        .build(app)
        .map_err(|e| e.to_string())?;
    let hide_item = MenuItemBuilder::with_id("tray.hide", labels[2])
        .build(app)
        .map_err(|e| e.to_string())?;
    let theme_item = MenuItemBuilder::with_id("tray.theme", labels[3])
        .build(app)
        .map_err(|e| e.to_string())?;
    let settings_item = MenuItemBuilder::with_id("tray.settings", labels[4])
        .build(app)
        .map_err(|e| e.to_string())?;
    let update_item = MenuItemBuilder::with_id("tray.update", labels[5])
        .build(app)
        .map_err(|e| e.to_string())?;
    let quit_item = MenuItemBuilder::with_id("tray.quit", labels[6])
        .build(app)
        .map_err(|e| e.to_string())?;
    let menu = MenuBuilder::new(app)
        .item(&new_chat_item)
        .separator()
        .item(&show_item)
        .item(&hide_item)
        .separator()
        .item(&theme_item)
        .item(&settings_item)
        .item(&update_item)
        .separator()
        .item(&quit_item)
        .build()
        .map_err(|e| e.to_string())?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| "no default window icon".to_string())?;
    TrayIconBuilder::with_id(TrayIconId::new("main"))
        .icon(icon)
        .tooltip(localized_app_name())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray.new_chat" => {
                // emit 事件给前端,前端处理新建对话(切到 /agents + 重置 chat store)
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = window.emit("desktop-tray-action", "new_chat") {
                        log::warn!("[desktop-event] emit desktop-tray-action failed: {}", e);
                    }
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "tray.show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "tray.hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "tray.theme" => {
                // emit 事件给前端,前端切换主题(light/dark)
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = window.emit("desktop-tray-action", "toggle_theme") {
                        log::warn!("[desktop-event] emit desktop-tray-action failed: {}", e);
                    }
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "tray.settings" => {
                // emit 事件给前端,前端跳转 /settings
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = window.emit("desktop-tray-action", "open_settings") {
                        log::warn!("[desktop-event] emit desktop-tray-action failed: {}", e);
                    }
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "tray.update" => {
                // emit 事件给前端,前端调 updater plugin 检查更新(带 UI 反馈)
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = window.emit("desktop-tray-action", "check_update") {
                        log::warn!("[desktop-event] emit desktop-tray-action failed: {}", e);
                    }
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "tray.quit" => {
                // 2026-07-31:退出前先持久化窗口状态,然后 emit 事件给前端。
                // 前端会检查更新:有更新则下载+安装+重启,无更新则调 quit_app 退出。
                // 2026-08-16 修订:不做"emit 后定时强退"兜底——此前 2s 强退实现
                // 有缺陷:get_webview_window 在进程存活期间恒为 Some,前端处理 quit
                // (检查/安装更新可能数十秒)必然被 2s 强杀,中断更新流程甚至损坏安装。
                // 正确兜底:仅当 main 窗口对象不存在(异常状态)时直接退出。
                let _ = save_window_state(Some("main".to_string()), app.clone());
                let _ = save_window_state(Some("admin".to_string()), app.clone());
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = window.emit("desktop-tray-action", "quit") {
                        log::warn!("[desktop-event] emit desktop-tray-action failed: {}", e);
                    }
                } else {
                    // 主窗口不存在(异常状态),直接退出
                    app.exit(0);
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            let app = tray.app_handle();
            match event {
                TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                } => {
                    // 双击:切换显示/隐藏(仅非 Windows 平台)
                    // 2026-08-16 修复:Windows 双击会先派发 Click(已显示窗口),再派发
                    // DoubleClick,若在此 hide 会把"单击唤起"的窗口隐藏 → 双击永远=隐藏,
                    // 与预期相反。Windows 上保留单击显示行为,双击不额外处理。
                    #[cfg(not(target_os = "windows"))]
                    {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                }
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    ..
                } => {
                    // Windows 习惯:左键单击托盘图标显示主窗口并聚焦
                    // macOS 已通过 menu 显示菜单,不重复处理
                    #[cfg(target_os = "windows")]
                    {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.set_focus();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                }
                _ => {}
            }
        })
        .build(app)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 托盘常驻本地配置(2026-09-02 #2 立,存于 <app_config_dir>/tray-settings.json)。
/// - always_visible:用户开关,"托盘图标常驻任务栏"(默认开)。
/// - promoted_keys:已处理过的 NotifyIconSettings 注册表键名(hash,纯数字字符串)。
///   每个键只在首次出现时自动写一次 IsPromoted=1;之后用户在任务栏设置里
///   手动隐藏该图标的选择会被永久尊重(不再每次启动强制拉回)。
///   键级粒度优于 exe 级:同一 exe 可能同时存在多条历史/当前身份键,
///   exe 级记录会把"另一条新键"误判为已处理而永远跳过(2026-09-02 修复)。
///   旧版 exe 尾段记录(promoted_identities)反序列化时被 serde 忽略作废,自动迁移。
#[cfg(target_os = "windows")]
#[derive(serde::Deserialize, serde::Serialize, Clone)]
#[serde(default)]
struct TraySettings {
    always_visible: bool,
    #[serde(default)]
    promoted_keys: Vec<String>,
}

// 手写 Default:bool 的派生 Default 是 false,会导致默认开关被静默关闭(2026-09-02 修复)
#[cfg(target_os = "windows")]
impl Default for TraySettings {
    fn default() -> Self {
        Self { always_visible: true, promoted_keys: Vec::new() }
    }
}

#[cfg(target_os = "windows")]
fn tray_config_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("tray-settings.json"))
}

/// 读取托盘常驻配置,缺失/损坏时回退默认值(always_visible=true)。
#[cfg(target_os = "windows")]
fn load_tray_settings(app: &tauri::AppHandle) -> TraySettings {
    let Some(path) = tray_config_path(app) else { return TraySettings::default() };
    std::fs::read(&path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

/// 写回托盘常驻配置(目录不存在则创建,失败仅记日志,不影响主流程)。
#[cfg(target_os = "windows")]
fn save_tray_settings(app: &tauri::AppHandle, settings: &TraySettings) {
    let Some(path) = tray_config_path(app) else { return };
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    match serde_json::to_vec_pretty(settings) {
        Ok(bytes) => {
            if let Err(e) = std::fs::write(&path, bytes) {
                log::warn!("[desktop] save tray settings failed: {}", e);
            }
        }
        Err(e) => log::warn!("[desktop] serialize tray settings failed: {}", e),
    }
}

/// 扫描 Win11 注册表 NotifyIconSettings,按 ExecutablePath 尾段匹配本应用托盘身份
/// (dev 的 ihui-desktop.exe 与安装版 IHUI AI.exe 都算),把 IsPromoted 写为 target
/// (1=任务栏常驻 / 0=收入右下角隐藏溢出区)。
///
/// 机制(2026-09-02 #2 立):Win11 22H2+ 把"新出现的托盘图标"默认塞进隐藏溢出区,
/// 用户"拖拽出来常驻"的记忆按图标身份存于 `HKCU\Control Panel\NotifyIconSettings\
/// <hash>\IsPromoted`。AUMID + NIF_GUID 已稳定图标身份,但身份首次出现(dev↔安装版、
/// 首次安装、系统清理)时默认仍是隐藏,用户被迫反复手动拖拽——本函数自动补写。
///
/// force=false(启动自动路径):仅处理 promoted_keys 里未记录的新键,
///   每个键只写一次,此后尊重用户手动调整(含手动隐藏)。
/// force=true(设置开关显式操作):忽略记录,全部匹配键强制写 target。
///
/// 返回是否有注册表写盘 —— 有则在主线程移除并重建托盘图标(NIM_DELETE+NIM_ADD),
/// Explorer 在 NIM_ADD 时读取 IsPromoted,立即生效,无需重启 Explorer。
/// Windows 10 / Win11 22H2 之前无此键,静默跳过(仅靠 GUID 身份记忆,拖拽一次即持久)。
#[cfg(target_os = "windows")]
fn apply_tray_promotion(app: &tauri::AppHandle, target: u32, force: bool) -> bool {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_SET_VALUE};
    use winreg::RegKey;

    // 0) 开关关闭且非显式强制 → 不做任何事
    let mut settings = load_tray_settings(app);
    if !force && !settings.always_visible {
        return false;
    }

    // 1) 候选身份 = dev/安装版二进制名 ∪ 当前进程 exe 名(仅尾段精确匹配,防误伤同名前缀应用)
    let exe = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return false,
    };
    let mut candidates: Vec<String> = vec!["ihui-desktop.exe".into(), "ihui ai.exe".into()];
    if let Some(name) = exe.file_name() {
        let n = name.to_string_lossy().to_lowercase();
        if !candidates.contains(&n) {
            candidates.push(n);
        }
    }

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let Ok(root) =
        hkcu.open_subkey_with_flags("Control Panel\\NotifyIconSettings", KEY_READ | KEY_SET_VALUE)
    else {
        log::info!("[desktop] NotifyIconSettings not present, skip tray promote (pre-Win11 22H2)");
        return false;
    };

    let mut changed = false;
    for sub in root.enum_keys().flatten() {
        let Ok(entry) = root.open_subkey_with_flags(&sub, KEY_READ | KEY_SET_VALUE) else {
            continue;
        };
        let path = entry
            .get_value::<String, _>("ExecutablePath")
            .map(|p| p.replace('/', "\\").to_lowercase())
            .unwrap_or_default();
        let last_segment = path.rsplit('\\').next().unwrap_or("");
        if !candidates.iter().any(|c| c == last_segment) {
            continue;
        }
        // 尊重用户选择:该注册表键已处理过且非显式强制 → 跳过
        if !force && settings.promoted_keys.iter().any(|k| k == &sub) {
            continue;
        }
        if entry.get_value::<u32, _>("IsPromoted").unwrap_or(0) != target
            && entry.set_value("IsPromoted", &target).is_ok()
        {
            changed = true;
            log::info!("[desktop] tray icon IsPromoted={} written: {} ({})", target, sub, path);
        }
        // 记录已处理键名(幂等去重)
        if !settings.promoted_keys.iter().any(|k| k == &sub) {
            settings.promoted_keys.push(sub.clone());
        }
    }

    if !settings.promoted_keys.is_empty() {
        save_tray_settings(app, &settings);
    }
    changed
}

/// 在主线程移除并重建托盘图标,使注册表 IsPromoted 变更即时生效(2026-09-02 #2 立)。
/// 菜单/事件处理器由 build_tray 全量重建,与启动时行为一致。
#[cfg(target_os = "windows")]
fn rebuild_tray_on_main_thread(app: &tauri::AppHandle) {
    let app = app.clone();
    let _ = app.clone().run_on_main_thread(move || {
        let _ = app.remove_tray_by_id("main");
        if let Err(e) = build_tray(&app) {
            log::error!("[desktop] rebuild tray after promote failed: {}", e);
        }
    });
}

/// 后台延迟触发托盘常驻写入(2026-09-02 #2 立,target=1,尊重身份记录与开关)。
/// Explorer 在托盘图标注册后才创建 NotifyIconSettings 条目,首次安装时启动瞬间
/// 条目尚不存在,故延迟扫描两次(1.5s / 6s)覆盖;后续启动条目已存在,首次扫描即命中。
#[cfg(target_os = "windows")]
fn schedule_tray_promote(app: &tauri::AppHandle) {
    let handle = app.clone();
    std::thread::spawn(move || {
        for delay in [Duration::from_millis(1500), Duration::from_millis(6000)] {
            std::thread::sleep(delay);
            if apply_tray_promotion(&handle, 1, false) {
                rebuild_tray_on_main_thread(&handle);
            }
        }
    });
}

// ================== Computer Control 命令(10 个)==================

/// 将字符串键名解析为 enigo Key 枚举。
fn parse_key(key: &str) -> Result<Key, String> {
    match key {
        "Enter" | "Return" => Ok(Key::Return),
        "Tab" => Ok(Key::Tab),
        "Escape" | "Esc" => Ok(Key::Escape),
        "Space" => Ok(Key::Space),
        "Backspace" | "BackSpace" => Ok(Key::Backspace),
        "Delete" | "Del" => Ok(Key::Delete),
        "Control" | "Ctrl" => Ok(Key::Control),
        "Shift" => Ok(Key::Shift),
        "Alt" | "Option" => Ok(Key::Alt),
        "Meta" | "Super" | "Win" | "Command" | "Cmd" => Ok(Key::Meta),
        "Home" => Ok(Key::Home),
        "End" => Ok(Key::End),
        "PageUp" => Ok(Key::PageUp),
        "PageDown" => Ok(Key::PageDown),
        "ArrowUp" | "Up" => Ok(Key::UpArrow),
        "ArrowDown" | "Down" => Ok(Key::DownArrow),
        "ArrowLeft" | "Left" => Ok(Key::LeftArrow),
        "ArrowRight" | "Right" => Ok(Key::RightArrow),
        "F1" => Ok(Key::F1),
        "F2" => Ok(Key::F2),
        "F3" => Ok(Key::F3),
        "F4" => Ok(Key::F4),
        "F5" => Ok(Key::F5),
        "F6" => Ok(Key::F6),
        "F7" => Ok(Key::F7),
        "F8" => Ok(Key::F8),
        "F9" => Ok(Key::F9),
        "F10" => Ok(Key::F10),
        "F11" => Ok(Key::F11),
        "F12" => Ok(Key::F12),
        _ if key.chars().count() == 1 => {
            // 2026-07-22 P0 Round 5:显式 match 防 panic(虽有 count==1 守护,但 unwrap 写法不安全)
            match key.chars().next() {
                Some(ch) => Ok(Key::Unicode(ch)),
                None => Err(format!("Empty key: {}", key)),
            }
        }
        _ => Err(format!("Unknown key: {}", key)),
    }
}

#[tauri::command]
async fn screenshot_screen(
    display_index: Option<usize>,
    region: Option<Vec<f64>>,
) -> Result<ScreenshotResult, String> {
    let screens = Screen::all().map_err(|e| e.to_string())?;
    let idx = display_index.unwrap_or(0);
    let screen = screens
        .get(idx)
        .ok_or(format!("Display index {} not found", idx))?;
    let img = if let Some(r) = region {
        if r.len() < 4 {
            return Err("region must be [x, y, w, h]".to_string());
        }
        // 2026-08-16 防御:负值/零尺寸会被截断成 u32 导致回绕成巨大区域,加显式校验
        if r[2] <= 0.0 || r[3] <= 0.0 || r[0] < 0.0 || r[1] < 0.0 {
            return Err(format!(
                "region 必须为屏幕内非负坐标且宽高为正,got [{}, {}, {}, {}]",
                r[0], r[1], r[2], r[3]
            ));
        }
        screen
            .capture_area(r[0] as i32, r[1] as i32, r[2] as u32, r[3] as u32)
            .map_err(|e| e.to_string())?
    } else {
        screen.capture().map_err(|e| e.to_string())?
    };
    let dyn_img = image::DynamicImage::ImageRgba8(img);
    let mut buf = Cursor::new(Vec::new());
    dyn_img
        .write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    let screenshot = base64::engine::general_purpose::STANDARD.encode(buf.into_inner());
    Ok(ScreenshotResult { screenshot })
}

#[tauri::command]
async fn mouse_move(x: f64, y: f64, absolute: Option<bool>) -> Result<OkResult, String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    let coord = if absolute.unwrap_or(true) {
        Coordinate::Abs
    } else {
        Coordinate::Rel
    };
    enigo
        .move_mouse(x as i32, y as i32, coord)
        .map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

#[tauri::command]
async fn mouse_click(
    x: f64,
    y: f64,
    button: Option<String>,
    count: Option<u32>,
) -> Result<OkResult, String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo
        .move_mouse(x as i32, y as i32, Coordinate::Abs)
        .map_err(|e| e.to_string())?;
    let btn = match button.as_deref().unwrap_or("left") {
        "left" => Button::Left,
        "right" => Button::Right,
        "middle" => Button::Middle,
        other => return Err(format!("Unknown button: {}", other)),
    };
    // 2026-07-22 P1 鲁棒性加固:count 上限 10,防止恶意调用方传 1000000 长时间点击
    let n = count.unwrap_or(1).min(10);
    for _ in 0..n {
        enigo
            .button(btn, Direction::Click)
            .map_err(|e| e.to_string())?;
    }
    Ok(OkResult { ok: true })
}

#[tauri::command]
async fn keyboard_type(text: String, delay: Option<u64>) -> Result<OkResult, String> {
    // 2026-07-22 P1 鲁棒性加固:防止超长 text 卡死 UI
    const MAX_TEXT_LEN: usize = 10000;
    if text.chars().count() > MAX_TEXT_LEN {
        return Err(format!("text too long: max {} chars", MAX_TEXT_LEN));
    }
    // 2026-08-16 加固:delay 无上限 + 同步命令在主线程执行,大 delay(如 5000ms)
    // 可让 UI 假死数小时。单字符间隔上限 100ms,总耗时上限 10s,超出后停止输入
    // (返回成功,避免调用方收到 Err 后重试造成重复输入)。
    const MAX_DELAY_MS: u64 = 100;
    const MAX_TOTAL_MS: u64 = 10_000;
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    if let Some(ms) = delay {
        let ms = ms.min(MAX_DELAY_MS);
        if ms > 0 {
            let mut elapsed = 0u64;
            for ch in text.chars() {
                enigo
                    .text(&ch.to_string())
                    .map_err(|e| e.to_string())?;
                if elapsed + ms > MAX_TOTAL_MS {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(ms));
                elapsed += ms;
            }
            return Ok(OkResult { ok: true });
        }
    }
    enigo.text(&text).map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

#[tauri::command]
async fn mouse_scroll(
    delta_y: f64,
    x: Option<f64>,
    y: Option<f64>,
) -> Result<OkResult, String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    if let (Some(x), Some(y)) = (x, y) {
        enigo
            .move_mouse(x as i32, y as i32, Coordinate::Abs)
            .map_err(|e| e.to_string())?;
    }
    enigo
        .scroll(delta_y as i32, Axis::Vertical)
        .map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

#[tauri::command]
async fn keyboard_press(key: String) -> Result<OkResult, String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    let k = parse_key(&key)?;
    enigo.key(k, Direction::Click).map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

#[tauri::command]
async fn keyboard_hotkey(keys: Vec<String>) -> Result<OkResult, String> {
    // 2026-07-22 P1 鲁棒性加固:防止超多 keys 长时间占用
    if keys.len() > 10 {
        return Err("too many keys: max 10".to_string());
    }
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    let parsed: Vec<Key> = keys
        .iter()
        .map(|k| parse_key(k))
        .collect::<Result<_, _>>()?;
    for k in &parsed {
        enigo
            .key(k.clone(), Direction::Press)
            .map_err(|e| e.to_string())?;
    }
    for k in parsed.iter().rev() {
        enigo
            .key(k.clone(), Direction::Release)
            .map_err(|e| e.to_string())?;
    }
    Ok(OkResult { ok: true })
}

/// Windows: winapi(GetForegroundWindow + GetWindowTextW + GetWindowRect + 进程映像名);其他平台未实现。
#[cfg(windows)]
mod active_window_impl {
    use winapi::shared::windef::RECT;
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::winbase::QueryFullProcessImageNameW;
    use winapi::um::winuser::{
        GetForegroundWindow, GetWindowRect, GetWindowTextLengthW, GetWindowTextW,
        GetWindowThreadProcessId,
    };

    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

    pub fn get() -> Result<super::WindowInfo, String> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return Err("No foreground window".to_string());
            }
            let len = GetWindowTextLengthW(hwnd);
            let mut title_buf: Vec<u16> = vec![0u16; len as usize + 1];
            let written = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), title_buf.len() as i32);
            let title = String::from_utf16_lossy(&title_buf[..written.max(0) as usize]);

            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);
            let app_name = if pid != 0 {
                process_name(pid).unwrap_or_default()
            } else {
                String::new()
            };

            // 2026-08-16:获取前台窗口在屏幕上的矩形 [x, y, width, height]。
            // GetWindowRect 返回屏幕坐标(left/top/right/bottom);最小化窗口的坐标是 -32000,
            // 且 width/height 非正,此时返回占位 [0,0,0,0],避免前端拿到异常坐标。
            let mut rect: RECT = std::mem::zeroed();
            let bounds = if GetWindowRect(hwnd, &mut rect) != 0 {
                let w = rect.right - rect.left;
                let h = rect.bottom - rect.top;
                if w > 0 && h > 0 {
                    [rect.left, rect.top, w, h]
                } else {
                    [0, 0, 0, 0]
                }
            } else {
                [0, 0, 0, 0]
            };

            Ok(super::WindowInfo {
                title,
                app_name,
                window_id: format!("{}", hwnd as usize),
                bounds,
            })
        }
    }

    /// 通过进程映像路径提取可执行文件名(去 .exe 后缀)。
    fn process_name(pid: u32) -> Result<String, String> {
        unsafe {
            let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if h.is_null() {
                return Err("OpenProcess failed".to_string());
            }
            let mut size: u32 = 1024;
            let mut buf: Vec<u16> = vec![0u16; 1024];
            let ok = QueryFullProcessImageNameW(h, 0, buf.as_mut_ptr(), &mut size);
            CloseHandle(h);
            if ok == 0 {
                return Err("QueryFullProcessImageNameW failed".to_string());
            }
            let path = String::from_utf16_lossy(&buf[..size as usize]);
            let base = path.rsplit(|c| c == '\\' || c == '/').next().unwrap_or(&path);
            if base.len() > 4 && base[base.len() - 4..].eq_ignore_ascii_case(".exe") {
                Ok(base[..base.len() - 4].to_string())
            } else {
                Ok(base.to_string())
            }
        }
    }
}

#[cfg(not(windows))]
mod active_window_impl {
    pub fn get() -> Result<super::WindowInfo, String> {
        Err("active_window only implemented on Windows".to_string())
    }
}

#[tauri::command]
fn active_window() -> Result<ActiveWindowResult, String> {
    Ok(ActiveWindowResult {
        window: active_window_impl::get()?,
    })
}

// ================== 本地文件访问 ==================

#[derive(Serialize)]
struct FileInfo {
    path: String,
    name: String,
    size: u64,
    is_dir: bool,
    extension: String,
}

#[derive(Serialize)]
struct ReadTextResult {
    content: String,
    size: u64,
}

#[derive(Serialize)]
struct ReadBinaryResult {
    base64: String,
    size: u64,
    mime: String,
}

#[derive(Serialize)]
struct DirListResult {
    entries: Vec<FileInfo>,
}

/// 词法规范化路径:解析 `.` / `..`,不做 IO(不存在的路径也能规范化)。
fn normalize_path(p: &std::path::Path) -> std::path::PathBuf {
    use std::path::Component;
    let mut out = std::path::PathBuf::new();
    for comp in p.components() {
        match comp {
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// 2026-08-16 安全加固:自定义文件命令不受 capabilities 约束(仅约束插件命令),
/// 此前 read/write/list/stat 接受任意路径,webview 被 XSS(应用渲染 LLM 内容)
/// 后可读写/外带用户任意文件。统一限制在 app_data_dir 内。
fn ensure_in_app_data(
    app: &tauri::AppHandle,
    path: &str,
) -> Result<std::path::PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir 解析失败: {}", e))?;
    let p = std::path::Path::new(path);
    if !p.is_absolute() {
        return Err(format!("路径必须是绝对路径(拒绝): {}", path));
    }
    let p_norm = normalize_path(p);
    let app_data_norm = normalize_path(&app_data);
    if !p_norm.starts_with(&app_data_norm) {
        return Err(format!("路径不在应用数据目录内(拒绝): {}", path));
    }
    Ok(p_norm)
}

/// 读取文本文件(UTF-8)。路径仅允许 app_data_dir 内。
#[tauri::command]
async fn read_text_file(app: tauri::AppHandle, path: String) -> Result<ReadTextResult, String> {
    let path = ensure_in_app_data(&app, &path)?;
    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let size = metadata.len();
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(ReadTextResult { content, size })
}

/// 读取二进制文件,返回 base64 + MIME(用于图片/附件预览)。路径仅允许 app_data_dir 内。
/// 2026-08-16 加固:限制文件大小上限 50MB,防止大文件 OOM
/// (base64 编码会膨胀约 4/3,GB 级文件会把内存直接打爆)。
const MAX_BINARY_FILE_SIZE: u64 = 50 * 1024 * 1024;

#[tauri::command]
async fn read_binary_file(app: tauri::AppHandle, path: String) -> Result<ReadBinaryResult, String> {
    let path = ensure_in_app_data(&app, &path)?;
    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let size = metadata.len();
    if size > MAX_BINARY_FILE_SIZE {
        return Err(format!(
            "file too large: max 50MB ({} bytes), got {} bytes",
            MAX_BINARY_FILE_SIZE, size
        ));
    }
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let mime = mime_from_extension(&path.to_string_lossy());
    Ok(ReadBinaryResult { base64, size, mime })
}

/// 写入文本文件(覆盖)。父目录不存在时自动创建。路径仅允许 app_data_dir 内。
#[tauri::command]
async fn write_text_file(app: tauri::AppHandle, path: String, content: String) -> Result<OkResult, String> {
    let path = ensure_in_app_data(&app, &path)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

/// 列出目录下的文件/子目录(非递归)。路径仅允许 app_data_dir 内。
#[tauri::command]
async fn list_dir(app: tauri::AppHandle, path: String) -> Result<DirListResult, String> {
    let path = ensure_in_app_data(&app, &path)?;
    let mut entries = Vec::new();
    let dir = std::fs::read_dir(&path).map_err(|e| e.to_string())?;
    for entry in dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let path_str = entry.path().to_string_lossy().to_string();
        let name = entry.file_name().to_string_lossy().to_string();
        let extension = entry
            .path()
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default();
        entries.push(FileInfo {
            path: path_str,
            name,
            size: metadata.len(),
            is_dir: metadata.is_dir(),
            extension,
        });
    }
    // 文件在前,目录在后,各自按名称排序
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .reverse()
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(DirListResult { entries })
}

/// 获取单个文件/目录的元信息。路径仅允许 app_data_dir 内。
#[tauri::command]
async fn stat_file(app: tauri::AppHandle, path: String) -> Result<FileInfo, String> {
    let path = ensure_in_app_data(&app, &path)?;
    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let path_obj = std::path::Path::new(&path);
    let name = path_obj
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let extension = path_obj
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();
    Ok(FileInfo {
        path: path.to_string_lossy().to_string(),
        name,
        size: metadata.len(),
        is_dir: metadata.is_dir(),
        extension,
    })
}

/// 从文件扩展名推断 MIME 类型(常用类型)。
fn mime_from_extension(path: &str) -> String {
    let ext = std::path::Path::new(path)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "png" => "image/png".to_string(),
        "jpg" | "jpeg" => "image/jpeg".to_string(),
        "gif" => "image/gif".to_string(),
        "webp" => "image/webp".to_string(),
        "svg" => "image/svg+xml".to_string(),
        "bmp" => "image/bmp".to_string(),
        "pdf" => "application/pdf".to_string(),
        "txt" | "md" | "log" | "csv" | "json" | "xml" | "yml" | "yaml" | "toml" => {
            "text/plain".to_string()
        }
        "mp3" | "wav" | "ogg" | "m4a" => "audio/mpeg".to_string(),
        "mp4" | "webm" | "mov" | "avi" | "mkv" => "video/mp4".to_string(),
        "zip" | "gz" | "tar" | "rar" | "7z" => "application/zip".to_string(),
        _ => "application/octet-stream".to_string(),
    }
}

// ================== 窗口状态持久化 ==================

use tauri_plugin_store::StoreExt;

const WINDOW_STORE_FILE: &str = "window-state.json";

/// 窗口状态写盘节流:Resized/Moved 事件每帧触发,记录 label → 上次写盘时刻,
/// 同一窗口 300ms 内最多合并写一次盘(注释与实现一致:避免拖动过程中高频写盘)。
static WINDOW_STATE_LAST_SAVE: LazyLock<Mutex<HashMap<String, Instant>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// 节流保存窗口状态:300ms 内同一窗口的 Resized/Moved 重复事件直接忽略。
fn debounce_save_window_state(label: String, app: tauri::AppHandle) {
    const DEBOUNCE: Duration = Duration::from_millis(300);
    let now = Instant::now();
    {
        let mut last = WINDOW_STATE_LAST_SAVE.lock().unwrap();
        if let Some(prev) = last.get(&label) {
            if now.duration_since(*prev) < DEBOUNCE {
                return;
            }
        }
        last.insert(label.clone(), now);
    }
    let _ = save_window_state(Some(label), app);
}

/// 生成窗口状态 store key(格式: window.<label>.<field>),区分 main/admin 窗口。
/// 2026-07-27 立:支持多窗口独立持久化位置/尺寸/最大化状态。
fn win_key(label: &str, field: &str) -> String {
    format!("window.{}.{}", label, field)
}

/// 保存指定窗口当前位置 / 尺寸 / 最大化状态到 store。
/// label: 窗口标签(main/admin),默认 "main"。2026-07-27 立:支持多窗口独立持久化。
#[tauri::command]
fn save_window_state(label: Option<String>, app: tauri::AppHandle) -> Result<OkResult, String> {
    let label = label.as_deref().unwrap_or("main");
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("window {} not found", label))?;
    let store = app.store(WINDOW_STORE_FILE).map_err(|e| e.to_string())?;
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let maximized = window.is_maximized().unwrap_or(false);
    store.set(win_key(label, "x"), pos.x);
    store.set(win_key(label, "y"), pos.y);
    store.set(win_key(label, "width"), size.width);
    store.set(win_key(label, "height"), size.height);
    store.set(win_key(label, "maximized"), maximized);
    store.save().map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

/// 从 store 恢复指定窗口位置 / 尺寸 / 最大化状态(应用启动时调用)。
/// label: 窗口标签(main/admin),默认 "main"。
/// 多显示器校验:若窗口中心点不在任何显示器内(外接显示器已断开),fallback 到 center()。
#[tauri::command]
fn restore_window_state(label: Option<String>, app: tauri::AppHandle) -> Result<OkResult, String> {
    let label = label.as_deref().unwrap_or("main");
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("window {} not found", label))?;
    let store = app.store(WINDOW_STORE_FILE).map_err(|e| e.to_string())?;
    // 优先恢复最大化状态
    if let Some(true) = store
        .get(win_key(label, "maximized"))
        .and_then(|v| v.as_bool())
    {
        let _ = window.maximize();
        return Ok(OkResult { ok: true });
    }
    let x = store.get(win_key(label, "x")).and_then(|v| v.as_i64());
    let y = store.get(win_key(label, "y")).and_then(|v| v.as_i64());
    let w = store.get(win_key(label, "width")).and_then(|v| v.as_u64());
    let h = store
        .get(win_key(label, "height"))
        .and_then(|v| v.as_u64());
    if let (Some(x), Some(y), Some(w), Some(h)) = (x, y, w, h) {
        use tauri::PhysicalPosition;
        use tauri::PhysicalSize;
        // 2026-09-01 修复"窗口过窄":旧版本遗留的 window-state.json 可能保存过
        // 比当前 minWidth 还小的尺寸,直接恢复会让窗口异常窄;同时屏幕分辨率变化
        // 后旧尺寸可能超屏。统一 clamp 到 [min_inner_size, 屏幕可用区 92%]。
        let (cw, ch) = clamp_window_size(&window, w as u32, h as u32);
        if cw != w as u32 || ch != h as u32 {
            log::info!(
                "[desktop] restore window state clamped: {}x{} -> {}x{}",
                w, h, cw, ch
            );
        }
        // 先设置 size,再设置 position,避免最大化状态下 set_position 失效
        let _ = window.set_size(PhysicalSize::new(cw, ch));
        let _ = window.set_position(PhysicalPosition::new(x as i32, y as i32));
        // 多显示器校验:窗口中心点不在任何显示器内时 fallback 到 center()
        // 场景:上次关闭时窗口在外接显示器,本次启动未接外接显示器
        if !is_window_visible_on_any_monitor(&window) {
            let _ = window.center();
        }
    } else {
        // 无持久化记录(首次安装 / reset_window_state 后):按屏幕可用区
        // clamp tauri.conf.json 默认尺寸,避免 2700x900 在低分辨率屏幕上超屏。
        // 2026-09-01 接入:此前 adapt_window_to_screen 仅定义未调用。
        let _ = adapt_window_to_screen(&window);
    }
    Ok(OkResult { ok: true })
}

/// 校验窗口中心点是否在任意一个显示器可见区域内。
/// 用于 restore_window_state 时防止窗口恢复到已断开的外接显示器坐标。
fn is_window_visible_on_any_monitor(window: &tauri::WebviewWindow) -> bool {
    // Manager trait 提供 available_monitors()(已 use tauri::Manager)
    let monitors = match window.available_monitors() {
        Ok(m) => m,
        Err(_) => return true, // 无法获取显示器列表时不拦截,保持原行为
    };
    if monitors.is_empty() {
        return true;
    }
    let win_pos = match window.outer_position() {
        Ok(p) => p,
        Err(_) => return true,
    };
    let win_size = match window.outer_size() {
        Ok(s) => s,
        Err(_) => return true,
    };
    // 窗口中心点
    let center_x = win_pos.x + (win_size.width as i32) / 2;
    let center_y = win_pos.y + (win_size.height as i32) / 2;
    // 中心点在任意显示器范围内即视为可见
    for monitor in monitors {
        let mon_pos = monitor.position();
        let mon_size = monitor.size();
        if center_x >= mon_pos.x
            && center_x <= mon_pos.x + mon_size.width as i32
            && center_y >= mon_pos.y
            && center_y <= mon_pos.y + mon_size.height as i32
        {
            return true;
        }
    }
    false
}

/// 重置指定窗口状态(清除 store 中的窗口记录,下次启动用默认尺寸)。
/// label: 窗口标签(main/admin),默认 "main"。2026-07-27 立:支持多窗口独立重置。
#[tauri::command]
fn reset_window_state(label: Option<String>, app: tauri::AppHandle) -> Result<OkResult, String> {
    let label = label.as_deref().unwrap_or("main");
    let store = app.store(WINDOW_STORE_FILE).map_err(|e| e.to_string())?;
    store.delete(win_key(label, "x"));
    store.delete(win_key(label, "y"));
    store.delete(win_key(label, "width"));
    store.delete(win_key(label, "height"));
    store.delete(win_key(label, "maximized"));
    store.save().map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

/// 将窗口尺寸限制在 [窗口最小尺寸, 屏幕可用区 92%] 之间(2026-09-01 立)。
///
/// 背景:用户反馈"安装后初始打开的尺寸太窄"——(a) 默认 1200 宽在侧边栏 160px +
/// AI 面板 380px 的布局下内容区仅 ~660px;(b) 旧版本遗留的 window-state.json 可能
/// 保存过更窄的尺寸,升级后 restore 直接恢复导致窗口过窄;(c) 低分辨率屏幕(如
/// 1366x768)上默认 2700x900 会超出屏幕。统一在此 clamp:
/// - 下限:窗口 min_inner_size(tauri.conf.json 的 minWidth/minHeight)
/// - 上限:窗口所在显示器可用区的 92%(去掉任务栏/缩放余量)
/// 返回 clamp 后的物理像素尺寸。
fn clamp_window_size(
    window: &tauri::WebviewWindow,
    w: u32,
    h: u32,
) -> (u32, u32) {
    // 下限:窗口 min 尺寸(逻辑像素)→ 物理像素。
    // 优先读 tauri.conf.json 的 minWidth/minHeight(单一来源,避免硬编码漂移);
    // 若当前窗口不在 conf 定义(如 admin 由 builder 创建)则 fallback 主窗口默认值。
    let scale = window.scale_factor().unwrap_or(1.0);
    let min = window
        .app_handle()
        .config()
        .app
        .windows
        .iter()
        .find(|c| c.label == window.label())
        .and_then(|c| match (c.min_width, c.min_height) {
            (Some(mw), Some(mh)) => Some(tauri::PhysicalSize::new(
                (mw * scale) as u32,
                (mh * scale) as u32,
            )),
            _ => None,
        })
        .unwrap_or(tauri::PhysicalSize::new(1100, 720));
    // 上限:窗口所在显示器(优先 current,fallback primary)可用区 92%
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());
    if let Some(m) = monitor {
        let msize = m.size();
        let max_w = ((msize.width as f64) * 0.92) as u32;
        let max_h = ((msize.height as f64) * 0.92) as u32;
        let cw = w.clamp(min.width, max_w.max(min.width));
        let ch = h.clamp(min.height, max_h.max(min.height));
        return (cw, ch);
    }
    (w.max(min.width), h.max(min.height))
}

/// 启动时把窗口尺寸适配到屏幕(2026-09-01 立)。
/// 无持久化窗口状态(首次安装/重置后)时,tauri.conf.json 的默认尺寸
/// (2700x900)在低分辨率屏幕上会超出可见区,这里按屏幕可用区 clamp。
/// 有持久化状态时由 restore_window_state 恢复(其内部同样 clamp)。
fn adapt_window_to_screen(window: &tauri::WebviewWindow) -> Result<(), String> {
    let current = window.outer_size().map_err(|e| e.to_string())?;
    let (cw, ch) = clamp_window_size(window, current.width, current.height);
    if cw != current.width || ch != current.height {
        window.set_size(tauri::PhysicalSize::new(cw, ch)).map_err(|e| e.to_string())?;
        log::info!("[desktop] window adapted to screen: {}x{} -> {}x{}", current.width, current.height, cw, ch);
    }
    Ok(())
}

/// WebView2 数据目录里**删了就丢用户数据**的名字(2026-09-25 立)。
/// 起因:旧实现把整棵 `EBWebView` 目录 `remove_dir_all` 当作"清理缓存"——用户在设置页点一次
/// "清理缓存",或谁跑一次 `tauri dev`(下面的 dev 分支同样曾经整树删),登录态、本地会话、
/// 已加密的 `ihui-chat` 信封就一起没了。清理缓存不该等于注销并清空本机数据。
const WEBVIEW_DATA_NAMES: [&str; 6] = [
    "Local Storage",
    "Session Storage",
    "IndexedDB",
    "Network",
    "Local State",
    "leveldb",
];

/// 可安全删除的缓存目录(相对 `EBWebView`;`Default/` 下的与根级的都列出)。
/// 只列**重新访问站点就会自动重建**的东西;拿不准的不列(宁可少清,不可误删)。
const WEBVIEW_CACHE_NAMES: [&str; 8] = [
    "Default/Cache",
    "Default/Code Cache",
    "Default/GPUCache",
    "Default/blob_storage",
    "Default/Service Worker/CacheStorage",
    "Default/Service Worker/ScriptCache",
    "GrShaderCache",
    "ShaderCache",
];

/// 白名单与数据名单有任何一段重名 ⇒ 该条整条剔除(配置错误的默认结论是"不删")。
fn webview_cache_paths(root: &std::path::Path) -> Vec<std::path::PathBuf> {
    WEBVIEW_CACHE_NAMES
        .iter()
        .filter(|rel| {
            !rel.split('/')
                .any(|seg| WEBVIEW_DATA_NAMES.contains(&seg))
        })
        .map(|rel| root.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR)))
        .filter(|p| p.is_dir())
        .collect()
}

/// 只删缓存类目录,数据类目录一律保留;返回 (删除数, 在场且被保留的数据目录名)。
fn clear_webview_caches(root: &std::path::Path) -> Result<(usize, Vec<&'static str>), String> {
    // 根目录名不是 EBWebView 就拒删:拼错路径的后果应该是"什么也没清",不是"抹掉一棵树"
    let is_ebwebview = root
        .file_name()
        .map(|n| n.to_string_lossy().eq_ignore_ascii_case("EBWebView"))
        .unwrap_or(false);
    if !is_ebwebview {
        return Err(format!(
            "拒绝清理:目标末段不是 EBWebView({})",
            root.display()
        ));
    }
    let mut cleared = 0usize;
    for p in webview_cache_paths(root) {
        std::fs::remove_dir_all(&p).map_err(|e| format!("{}: {}", p.display(), e))?;
        cleared += 1;
    }
    let skipped = WEBVIEW_DATA_NAMES
        .iter()
        .filter(|n| root.join("Default").join(n).is_dir() || root.join(n).is_dir())
        .copied()
        .collect();
    Ok((cleared, skipped))
}

/// 清理 WebView2 缓存(Windows)。
/// 2026-07-29 #6:prod 模式缓存子目录会无限增长(几个月可达数百 MB),供前端设置项"清理缓存"调用。
/// 2026-09-25:由"整树删"改为"只删缓存白名单"——清理动作不再可能带走登录态与本地会话。
#[tauri::command]
fn clear_webview_cache() -> Result<OkResult, String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let webview_root = std::path::Path::new(&local_app_data)
                .join("com.ihui.desktop")
                .join("EBWebView");
            if webview_root.is_dir() {
                let (cleared, skipped) = clear_webview_caches(&webview_root)?;
                log::info!(
                    "[desktop] WebView2 缓存已由用户清理:删除 {} 个缓存目录,保留 {} 个数据目录({})",
                    cleared,
                    skipped.len(),
                    skipped.join(", ")
                );
            }
        }
    }
    Ok(OkResult { ok: true })
}

#[cfg(test)]
mod webview_cache_tests {
    use super::{clear_webview_caches, webview_cache_paths, WEBVIEW_CACHE_NAMES, WEBVIEW_DATA_NAMES};
    use std::fs;
    use std::path::{Path, PathBuf};

    /// 造一棵最小 WebView2 树:每个名字一个目录,里面各放一个文件,便于事后判"还在不在"。
    fn fixture(tag: &str, dirs: &[&str]) -> PathBuf {
        let root = std::env::temp_dir()
            .join(format!("ihui-wvcache-{}", tag))
            .join("EBWebView");
        let _ = fs::remove_dir_all(root.parent().unwrap());
        for d in dirs {
            let p = root.join(d.replace('/', std::path::MAIN_SEPARATOR_STR));
            fs::create_dir_all(&p).expect("建夹具目录失败");
            fs::write(p.join("payload.bin"), b"must-survive-or-be-deleted-as-a-whole")
                .expect("写夹具文件失败");
        }
        root
    }

    fn exists(root: &Path, rel: &str) -> bool {
        root.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR)).exists()
    }

    fn child_names(dir: &Path) -> Vec<String> {
        let mut v: Vec<String> = fs::read_dir(dir)
            .expect("夹具目录应可读")
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        v.sort();
        v
    }

    #[test]
    fn 配置不变量_缓存白名单里不得有任何数据段() {
        for rel in WEBVIEW_CACHE_NAMES.iter() {
            for seg in rel.split('/') {
                assert!(
                    !WEBVIEW_DATA_NAMES.contains(&seg),
                    "缓存白名单 {} 里出现了数据目录段 {},清理会连带删掉用户数据",
                    rel,
                    seg
                );
            }
        }
    }

    #[test]
    fn 清缓存必须保住登录态与本地会话() {
        let root = fixture(
            "keep-data",
            &[
                "Default/Cache",
                "Default/Code Cache",
                "Default/GPUCache",
                "Default/Local Storage",
                "Default/IndexedDB",
                "Default/Network",
                "GrShaderCache",
            ],
        );
        let (cleared, skipped) = clear_webview_caches(&root).expect("清理应成功");
        assert_eq!(cleared, 4, "应删掉 4 个缓存目录");
        assert!(exists(&root, "Default/Local Storage"), "登录态被删了");
        assert!(exists(&root, "Default/IndexedDB"), "本地会话被删了");
        assert!(exists(&root, "Default/Network"), "Cookie 被删了");
        assert!(!exists(&root, "Default/Cache"), "缓存没被删掉");
        assert_eq!(skipped.len(), 3, "保留清单应如实报出在场的 3 个数据目录");
        let _ = fs::remove_dir_all(root.parent().unwrap());
    }

    #[test]
    fn 目标根目录名不对就整条拒删() {
        let misplaced = std::env::temp_dir().join("ihui-wvcache-wrong-root").join("Default");
        let _ = fs::remove_dir_all(misplaced.parent().unwrap());
        fs::create_dir_all(misplaced.join("Local Storage")).expect("建夹具失败");
        let before = child_names(&misplaced);
        let err = clear_webview_caches(&misplaced).expect_err("末段不是 EBWebView 必须被拒");
        assert!(err.contains("拒绝清理"), "报错文案要能看出是被拒,不是被删:{}", err);
        let after = child_names(&misplaced);
        assert_eq!(before, after, "被拒的同时一个子项都不许少");
        let _ = fs::remove_dir_all(misplaced.parent().unwrap());
    }

    #[test]
    fn 白名单筛出的路径只含在场的目录() {
        let root = fixture("paths", &["Default/Cache", "Default/Session Storage"]);
        let picked = webview_cache_paths(&root);
        assert_eq!(picked.len(), 1, "只应挑中在场的缓存目录: {:?}", picked);
        assert!(picked[0].ends_with("Cache"));
        let _ = fs::remove_dir_all(root.parent().unwrap());
    }
}

/// 根据状态返回本地化托盘 tooltip(2026-07-29 #10)。
/// status: "idle" | "new_message" | "thinking"
fn tray_status_tooltip(status: &str) -> String {
    let base = localized_app_name();
    match get_system_locale() {
        AppLocale::ZhCn => match status {
            "new_message" => format!("{} · 有新消息", base),
            "thinking" => format!("{} · AI 思考中…", base),
            _ => base.to_string(),
        },
        AppLocale::ZhTw => match status {
            "new_message" => format!("{} · 有新訊息", base),
            "thinking" => format!("{} · AI 思考中…", base),
            _ => base.to_string(),
        },
        AppLocale::Ko => match status {
            "new_message" => format!("{} · 새 메시지", base),
            "thinking" => format!("{} · AI 생각 중…", base),
            _ => base.to_string(),
        },
        AppLocale::Ja => match status {
            "new_message" => format!("{} · 新着メッセージ", base),
            "thinking" => format!("{} · AI 思考中…", base),
            _ => base.to_string(),
        },
        AppLocale::En => match status {
            "new_message" => format!("{} · New message", base),
            "thinking" => format!("{} · AI thinking…", base),
            _ => base.to_string(),
        },
    }
}

/// 设置托盘状态(2026-07-29 #10):切换 tooltip 表示新消息/AI 思考中。
/// status: "idle" | "new_message" | "thinking"
#[tauri::command]
fn set_tray_status(app: tauri::AppHandle, status: String) -> Result<(), String> {
    let tray = app
        .tray_by_id("main")
        .ok_or_else(|| "tray icon not found".to_string())?;
    let tooltip = tray_status_tooltip(&status);
    tray.set_tooltip(Some(&tooltip))
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 查询"托盘图标常驻任务栏"开关状态(2026-09-02 #2 立)。
/// 非 Windows 平台无 NotifyIconSettings 概念,恒返回 true(开关显示为开、操作为 no-op)。
#[tauri::command]
fn get_tray_always_visible(app: tauri::AppHandle) -> bool {
    #[cfg(target_os = "windows")]
    {
        load_tray_settings(&app).always_visible
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = &app;
        true
    }
}

/// 设置"托盘图标常驻任务栏"开关(2026-09-02 #2 立)。
/// enabled=true:立即把本应用全部托盘身份 IsPromoted 置 1 并重建托盘(即时常驻),
///   同时记录身份,后续启动不再重复打扰;
/// enabled=false:置 0 并重建托盘(收入溢出区),且后续启动不再强制常驻。
#[tauri::command]
fn set_tray_always_visible(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let mut settings = load_tray_settings(&app);
        settings.always_visible = enabled;
        save_tray_settings(&app, &settings);
        if apply_tray_promotion(&app, if enabled { 1 } else { 0 }, true) {
            rebuild_tray_on_main_thread(&app);
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&app, enabled);
    }
    Ok(())
}

#[tauri::command]
async fn clipboard_get(format: Option<String>) -> Result<ClipboardResult, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let fmt = format.as_deref().unwrap_or("text");
    let result = match fmt {
        "text" => clipboard.get_text().map_err(|e| e.to_string())?,
        "image" => {
            let img = clipboard.get_image().map_err(|e| e.to_string())?;
            let rgba_img = image::RgbaImage::from_raw(
                img.width as u32,
                img.height as u32,
                img.bytes.to_vec(),
            )
            .ok_or("Failed to convert clipboard image")?;
            let dyn_img = image::DynamicImage::ImageRgba8(rgba_img);
            let mut buf = Cursor::new(Vec::new());
            dyn_img
                .write_to(&mut buf, image::ImageFormat::Png)
                .map_err(|e| e.to_string())?;
            base64::engine::general_purpose::STANDARD.encode(buf.into_inner())
        }
        other => return Err(format!("Unknown format: {}", other)),
    };
    Ok(ClipboardResult { clipboard: result })
}

#[tauri::command]
async fn clipboard_set(
    content: String,
    format: Option<String>,
) -> Result<OkResult, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let fmt = format.as_deref().unwrap_or("text");
    match fmt {
        "text" => {
            clipboard
                .set_text(&content)
                .map_err(|e| e.to_string())?;
        }
        "image" => {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(&content)
                .map_err(|e| e.to_string())?;
            let rgba_img = image::load_from_memory_with_format(&bytes, image::ImageFormat::Png)
                .map_err(|e| e.to_string())?
                .to_rgba8();
            let (w, h) = (rgba_img.width() as usize, rgba_img.height() as usize);
            let img_data = arboard::ImageData {
                width: w,
                height: h,
                bytes: std::borrow::Cow::Owned(rgba_img.into_raw()),
            };
            clipboard
                .set_image(img_data)
                .map_err(|e| e.to_string())?;
        }
        other => return Err(format!("Unknown format: {}", other)),
    };
    Ok(OkResult { ok: true })
}

// ================== 深链就绪闸门(2026-09-26 立 · A10C-1「未就绪不丢,就绪后补投」)==================
//
// 立因(冷启动必丢登录码,用户表现"从浏览器/IM 点链接回 App,登录转圈或无反应"):
// 外部协议 `ihui://sso?sso_code=…` 抵达 Rust 的时刻,早于 webview 里
// `listen('desktop-deep-link')` 注册的时刻 —— Tauri 先按 tauri.conf.json 建好 main 窗口,
// 再派发 on_open_url,而前端要等页面加载 + hydration + 动态 chunk 才订阅。
// 旧实现是 `if let Some(window) = … { emit(…) }`(无 else)且只取 `urls().first()`,于是:
//   ① 窗口不存在 ⇒ 整条回调静默蒸发,连一行日志都没有(违 §5e「失败必须响」同一条禁令);
//   ② 窗口在但渲染端还没订阅 ⇒ emit 返回 Ok 而无人接收,同样蒸发(emit 成功不等于送达);
//   ③ 一批多条 URL ⇒ 第 2 条起无人认领,既不投递也不计数。
// 机制(三条硬要求对应下面三处):未投递出去的 URL 一律进**有上限、按 URL 去重**的 pending
// 队列并打日志;渲染端注册完监听后调 `take_pending_deep_links` 一次性取回(取即清 ⇒ 同一个
// code 不会被换两次 token),这次调用同时把闸门标成"已就绪",此后抵达才走直投;
// 溢出丢弃必须 warn + 计数,目标窗口销毁必须清账(不得留跨会话残留把旧码投给下一次冷启动)。
// 与 `chain: continuous` 的分界:队列住在 Rust 侧且**上限/去重/丢弃/清账四处都喊**,
// 不是往实时链里塞"看不见补发"—— 那正是 scripts/check-desktop-event-wiring.mjs 规则 E1 拦的形态。

/// 深链的唯一投递目标窗口 label。take 命令按它绑定,别的窗口取不走(防串号)。
const DEEP_LINK_TARGET_LABEL: &str = "main";
/// 事件名 —— 与 use-desktop.ts 的 `listen('desktop-deep-link')` 逐字同名,守门 G 组按字面量对账。
const DEEP_LINK_EVENT: &str = "desktop-deep-link";
/// 前端取回积压的命令名 —— 与 `invoke_handler!` 注册项、use-desktop.ts 的 `invoke(...)` 逐字同名。
const DEEP_LINK_TAKE_COMMAND: &str = "take_pending_deep_links";
/// pending 队列上限。溢出丢最旧并计数:SSO code 是一次性凭据,留着的最有用的是最新那条。
const DEEP_LINK_PENDING_CAP: usize = 8;
/// 进日志前必须掩掉取值的查询键 —— 深链本体就是一次性登录凭据,不得原样落进日志(§5e 同族要求)。
const DEEP_LINK_SENSITIVE_KEYS: [&str; 4] = ["sso_code", "auth_code", "code", "token"];

/// 日志形态的 URL:结构保留、敏感参数的**取值**换成 `***`。
/// 只掩值不掩键,是因为排查时"带没带 code、还带了哪些参数"正是需要的信息。
fn deep_link_log_form(url: &str) -> String {
    let (head, query) = match url.split_once('?') {
        Some((h, q)) => (h, Some(q)),
        None => (url, None),
    };
    let Some(query) = query else {
        return head.to_string();
    };
    let masked: Vec<String> = query
        .split('&')
        .map(|pair| {
            let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
            if value.is_empty() || !DEEP_LINK_SENSITIVE_KEYS.contains(&key.to_ascii_lowercase().as_str())
            {
                pair.to_string()
            } else {
                format!("{}=***", key)
            }
        })
        .collect();
    format!("{}?{}", head, masked.join("&"))
}

/// 一条 URL 抵达时的去向 —— 刻意只有两个出口,"什么都不做"不是一种出口。
#[derive(Debug, PartialEq, Eq)]
enum DeepLinkDelivery {
    /// 渲染端已就绪:直接 emit
    Emit(String),
    /// 窗口不在 / 渲染端未就绪 / 直投失败回填:暂存等前端取回
    Queue(String),
}

/// 纯函数:由闸门状态决定去向。契约是**输入 N 条 ⇒ 输出必 N 条**(既不丢也不复制)。
/// 变异对照:把"未就绪 ⇒ Queue"改回"未就绪 ⇒ 丢弃",`未就绪时每条都必须入队` 那条用例即红 ——
/// 判据有牙的证明落在这里,而不是"运行时恰好没丢"。
fn decide_deep_link_deliveries(target_ready: bool, urls: &[String]) -> Vec<DeepLinkDelivery> {
    urls
        .iter()
        .map(|url| {
            if target_ready {
                DeepLinkDelivery::Emit(url.clone())
            } else {
                DeepLinkDelivery::Queue(url.clone())
            }
        })
        .collect()
}

/// 有上限、按 URL 去重的待补投队列。两个计数器都存在的意义:丢弃与去重都是"少做了事",
/// 不数出来的话,下游读到的队列长度就无法区分"没有新链接"与"链接被扔了"。
#[derive(Default)]
struct DeepLinkPending {
    urls: VecDeque<String>,
    /// 因重复(已在队里)被跳过的条数
    deduped: usize,
    /// 因溢出被丢弃的条数 —— 静默变短等于伪造完整性
    dropped: usize,
}

impl DeepLinkPending {
    /// 入队:同 URL 去重、超上限丢最旧。返回 true 表示这次真的收下了。
    fn push(&mut self, url: &str) -> bool {
        if self.urls.iter().any(|existing| existing == url) {
            self.deduped += 1;
            log::info!("[deep-link] 同一 URL 已在 pending 队列中,跳过重复入队(累计去重 {} 次)", self.deduped);
            return false;
        }
        self.urls.push_back(url.to_string());
        while self.urls.len() > DEEP_LINK_PENDING_CAP {
            // 只可能弹出刚入队之外的那一条(队首 = 最旧),不存在"把刚收到的丢掉"
            let lost = self.urls.pop_front().unwrap_or_default();
            self.dropped += 1;
            log::warn!(
                "[deep-link] pending 超上限 {} ⇒ 丢弃最旧一条(累计丢弃 {} 条): {}",
                DEEP_LINK_PENDING_CAP,
                self.dropped,
                deep_link_log_form(&lost)
            );
        }
        true
    }

    /// 取回并清空。取即清是幂等的来源:同一条 URL 结构上不可能被补投两次。
    fn take_all(&mut self) -> Vec<String> {
        std::mem::take(&mut self.urls).into_iter().collect()
    }

    /// 清账(目标窗口销毁时调用),返回清掉的条数。
    fn clear(&mut self) -> usize {
        let n = self.urls.len();
        self.urls.clear();
        n
    }
}

#[derive(Default)]
struct DeepLinkGateState {
    /// 渲染端是否已注册监听 —— 由 take_pending_deep_links 置真;目标窗口销毁**或导航发起**时复位。
    /// 未就绪期间(冷启动窗口期 / location.href·reload 造成的渲染端暂存期)抵达的 URL 只进队列,
    /// 不做"发了就当作收到了"的假设。
    target_ready: bool,
    pending: DeepLinkPending,
}

static DEEP_LINK_GATE: LazyLock<Mutex<DeepLinkGateState>> =
    LazyLock::new(|| Mutex::new(DeepLinkGateState::default()));

/// 取闸门。投递路径上不得因锁中毒而 panic —— 那会把"这一次抵达"变成真的丢掉,
/// 正是本机制要修的那一型;中毒后继续用同一份内容,并把中毒本身喊出来。
fn deep_link_gate() -> std::sync::MutexGuard<'static, DeepLinkGateState> {
    match DEEP_LINK_GATE.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            log::warn!("[deep-link] 闸门锁中毒(前一持有者 panic),仍取回其内容继续投递");
            poisoned.into_inner()
        }
    }
}

/// on_open_url 的唯一投递入口:逐条按闸门状态决定去向。绝不只取 first,绝不静默返回。
fn dispatch_deep_links(app: &tauri::AppHandle, urls: &[String]) {
    if urls.is_empty() {
        log::warn!("[deep-link] on_open_url 抵达但 URL 列表为空 —— 无内容可投递,留这一行而不是静默返回");
        return;
    }
    if urls.len() > 1 {
        log::info!(
            "[deep-link] 一次抵达 {} 条 URL,逐条走闸门(旧实现只取 first,其余静默丢弃)",
            urls.len()
        );
    }

    let window = app.get_webview_window(DEEP_LINK_TARGET_LABEL);
    // 先只读判据、马上放锁:emit 会同步派发 IPC,若在前端回调里再 invoke take,
    // 持锁跨 emit 就是一次自死锁(std Mutex 不可重入)。
    let target_ready = { deep_link_gate().target_ready && window.is_some() };
    let block_reason = match (window.is_some(), target_ready) {
        (false, _) => Some("main 窗口尚未创建"),
        (true, false) => Some("渲染端尚未注册监听(冷启动窗口期)"),
        (true, true) => None,
    };

    let mut emitted = 0usize;
    let mut queued = 0usize;
    let mut deduped = 0usize;
    for delivery in decide_deep_link_deliveries(target_ready, urls) {
        match delivery {
            DeepLinkDelivery::Emit(url) => {
                let Some(w) = window.as_ref() else {
                    // 结构上不可达(target_ready 已含 window.is_some()),仍转入队而不是 panic
                    let mut gate = deep_link_gate();
                    if gate.pending.push(&url) {
                        queued += 1;
                    }
                    continue;
                };
                match w.emit(DEEP_LINK_EVENT, &url) {
                    Ok(_) => emitted += 1,
                    Err(e) => {
                        log::warn!(
                            "[deep-link] emit 失败 ⇒ 回填 pending 等前端取回(不丢弃): {} —— {}",
                            deep_link_log_form(&url),
                            e
                        );
                        let mut gate = deep_link_gate();
                        if gate.pending.push(&url) {
                            queued += 1;
                        } else {
                            deduped += 1;
                        }
                    }
                }
            }
            DeepLinkDelivery::Queue(url) => {
                log::warn!(
                    "[deep-link] {} ⇒ 暂存待补投(未就绪不丢,前端就绪后经 {} 取回): {}",
                    block_reason.unwrap_or("投递条件不成立"),
                    DEEP_LINK_TAKE_COMMAND,
                    deep_link_log_form(&url)
                );
                let mut gate = deep_link_gate();
                if gate.pending.push(&url) {
                    queued += 1;
                } else {
                    deduped += 1;
                }
            }
        }
    }

    let pending_now = deep_link_gate().pending.urls.len();
    log::info!(
        "[deep-link] 本次 {} 条:直投 {} / 入队 {} / 重复跳过 {} / 队列现有 {}",
        urls.len(),
        emitted,
        queued,
        deduped,
        pending_now
    );

    // 唤起动作与投递解耦:即便全部进了 pending,窗口该露脸还是要露脸(用户点了链接就该看到 App)
    if let Some(w) = window {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// 前端在 `listen('desktop-deep-link')` 注册成功之后立刻调用:一次性取回积压并清账,
/// 同时把闸门标为"已就绪"(此后抵达才允许直投)。
/// 语义:①**取即清** ⇒ 同一 URL 结构上不会被补投两次(第二次取回为空);
/// ②按 label 绑定 ⇒ 非目标窗口(admin)一律空手而归,不会把别人的登录码取走。
#[tauri::command]
fn take_pending_deep_links(window: tauri::WebviewWindow) -> Vec<String> {
    let mut gate = deep_link_gate();
    if window.label() != DEEP_LINK_TARGET_LABEL {
        log::warn!(
            "[deep-link] 窗口 {} 试图取回目标窗口 {} 的深链积压 —— 已拒绝(防投错窗口)",
            window.label(),
            DEEP_LINK_TARGET_LABEL
        );
        return Vec::new();
    }
    let (first_take, backlog) = apply_take_ready(&mut gate);
    log::info!(
        "[deep-link] 渲染端就绪(本次取回点亮就绪标记: {}) —— 补投 {} 条,队列已清空",
        first_take,
        backlog.len()
    );
    backlog
}

/// 目标窗口销毁 ⇒ 闸门清账并复位就绪标记。
/// 不清的后果就是本机制立项时的那一型:残留的 sso_code 活到下一次冷启动,
/// 被投给"另一次会话的渲染端"(凭据串到别人的会话里)。
fn reset_deep_link_gate_on_destroy(label: &str) {
    if label != DEEP_LINK_TARGET_LABEL {
        return;
    }
    let mut gate = deep_link_gate();
    let cleared = gate.pending.clear();
    gate.target_ready = false;
    if cleared > 0 {
        log::warn!(
            "[deep-link] {} 窗口销毁:清掉 {} 条未消费的深链积压(不留跨会话残留),就绪标记已复位",
            DEEP_LINK_TARGET_LABEL,
            cleared
        );
    }
}

/// 导航发起时的状态迁移(纯函数,供单测直接断言):
/// 就绪标记拉回 false,**pending 队列原样保留**。
/// 与 destroy 路径(reset_deep_link_gate_on_destroy)的差别是两条,且都是刻意的:
///  - destroy = 会话终结 ⇒ 清账,旧 code 不得活到下一次冷启动;
///  - 导航 = 同一会话里渲染端短暂不在 ⇒ 已入队的条目是**未兑现的补投债务**,
///    由新页面注册监听后的 take_pending_deep_links 一次取走;导航时清账反而把
///    "未就绪不丢"这条立命之本弄丢。
fn apply_navigation_reset(gate: &mut DeepLinkGateState) -> (bool, usize) {
    let was_ready = gate.target_ready;
    gate.target_ready = false;
    (was_ready, gate.pending.urls.len())
}

/// 渲染端取回时的状态迁移(纯函数):点亮就绪 + 一次性取回积压(取即清)。
/// "就绪"只由这一处置真 —— take 被调用结构上意味着 listen 已注册成功,
/// 这比任何页面加载事件(如 Tauri 的 on_page_load Finished)都强:
/// Finished 只保证文档加载完,不保证监听已挂上,拿它点亮就复刻本机制立项的那一型。
fn apply_take_ready(gate: &mut DeepLinkGateState) -> (bool, Vec<String>) {
    let first_take = !gate.target_ready;
    gate.target_ready = true;
    (first_take, gate.pending.take_all())
}

/// **导航发起处(auto_refresh.rs 的 `location.href` / `location.reload` 各站点)必须先调用本函数**。
/// 页面重载期间渲染端不存在,此时抵达的深链若按"曾经就绪过"直投,emit 会打在一个没有监听者的
/// webview 上静默消失(既不入队也没人消费)—— 与冷启动丢码同型,只是换了触发面。
/// 复位后新 URL 一律走"未就绪 ⇒ 入队";就绪由新页面的 take_pending_deep_links 重新点亮。
/// 若新页面始终没能加载(断网/崩溃),闸门保持"未就绪"——这是正确的保守态:
/// 链接继续留在队列(上限 8 + 丢弃计数),而不是点亮一个不存在监听者的"就绪"。
pub(crate) fn reset_deep_link_gate_for_navigation(label: &str) {
    if label != DEEP_LINK_TARGET_LABEL {
        return;
    }
    let (was_ready, kept_pending) = apply_navigation_reset(&mut deep_link_gate());
    log::info!(
        "[deep-link] 导航发起:就绪标记已复位(原值 {}) —— 导航期间抵达的链接转入队,既有 {} 条补投债务保留待新页取回",
        was_ready,
        kept_pending
    );
}

#[cfg(test)]
mod deep_link_gate_tests {
    use super::{
        apply_navigation_reset, apply_take_ready, decide_deep_link_deliveries, deep_link_log_form,
        DeepLinkDelivery, DeepLinkGateState, DeepLinkPending, DEEP_LINK_PENDING_CAP,
    };

    fn urls(n: usize) -> Vec<String> {
        (0..n).map(|i| format!("ihui://sso?sso_code=c{}", i)).collect()
    }

    /// 核心不变量:决策函数不得让任何一条 URL 蒸发 —— 输入 N 条 ⇒ 输出 N 条去向。
    /// 变异对照:把"未就绪 ⇒ Queue"改回"未就绪 ⇒ 丢弃",下面三条用例立刻红(0 条去向)。
    #[test]
    fn 未就绪时每条都必须有去向且一律入队() {
        for n in 1..=4usize {
            let got = decide_deep_link_deliveries(false, &urls(n));
            assert_eq!(got.len(), n, "{} 条输入必须产出 {} 条去向,少一条就是静默丢弃", n, n);
            assert!(
                got.iter().all(|d| matches!(d, DeepLinkDelivery::Queue(_))),
                "未就绪时不允许出现直投: {:?}",
                got
            );
        }
    }

    #[test]
    fn 就绪时每条都走直投且条数守恒() {
        let got = decide_deep_link_deliveries(true, &urls(3));
        assert_eq!(got.len(), 3);
        assert!(got
            .iter()
            .all(|d| matches!(d, DeepLinkDelivery::Emit(_))));
    }

    #[test]
    fn 空批次不伪造去向() {
        assert!(decide_deep_link_deliveries(false, &[]).is_empty());
    }

    #[test]
    fn 入队顺序保持原始到达顺序() {
        let mut q = DeepLinkPending::default();
        for u in urls(3) {
            assert!(q.push(&u));
        }
        assert_eq!(q.take_all(), urls(3));
    }

    /// 取即清 = 补投幂等的来源:同一批积压不可能被前端取到第二次
    /// (否则同一个一次性 sso_code 会被拿去换两次 token)。
    #[test]
    fn 取回即清空_第二次取回必须为空() {
        let mut q = DeepLinkPending::default();
        q.push("ihui://sso?sso_code=only");
        assert_eq!(q.take_all(), vec!["ihui://sso?sso_code=only".to_string()]);
        assert!(q.take_all().is_empty(), "取回后仍留条目 ⇒ 补投会重复消费同一个 code");
    }

    #[test]
    fn 同一链接重复入队只留一份并计数() {
        let mut q = DeepLinkPending::default();
        assert!(q.push("ihui://sso?sso_code=dup"));
        assert!(!q.push("ihui://sso?sso_code=dup"), "重复入队必须返回 false");
        assert_eq!(q.urls.len(), 1);
        assert_eq!(q.deduped, 1, "去重必须计数,否则队列长度读不出'少了'");
    }

    /// 溢出必须"丢最旧 + 计数 + 不静默":丢弃计数是这条路径唯一的可见出口。
    #[test]
    fn 超上限丢最旧并计数_保留的是最新几条() {
        let mut q = DeepLinkPending::default();
        for u in urls(DEEP_LINK_PENDING_CAP + 2) {
            q.push(&u);
        }
        assert_eq!(q.urls.len(), DEEP_LINK_PENDING_CAP);
        assert_eq!(q.dropped, 2, "溢出丢弃必须计数(累计 2 条)");
        // 丢的是最旧两条(c0、c1),队首应为 c2
        let kept = q.take_all();
        assert_eq!(kept.first().map(|s| s.as_str()), Some("ihui://sso?sso_code=c2"));
        assert_eq!(kept.last().map(|s| s.as_str()), Some("ihui://sso?sso_code=c9"));
    }

    #[test]
    fn 清账返回被清条数且不留残留() {
        let mut q = DeepLinkPending::default();
        q.push("ihui://sso?sso_code=a");
        q.push("ihui://sso?sso_code=b");
        assert_eq!(q.clear(), 2);
        assert_eq!(q.clear(), 0, "已空的队列再清不得报数,否则'清账'读起来像一直在丢");
        assert!(q.take_all().is_empty());
    }

    /// 深链本体就是一次性登录凭据:日志只留结构,掩掉敏感参数的取值(键名保留以便排查)。
    #[test]
    fn 日志形态掩掉凭据取值但保留结构与键名() {
        assert_eq!(
            deep_link_log_form("ihui://sso?sso_code=secret123&from=im"),
            "ihui://sso?sso_code=***&from=im"
        );
        assert_eq!(deep_link_log_form("ihui://sso/callback"), "ihui://sso/callback");
        assert_eq!(
            deep_link_log_form("ihui://oauth?AUTH_CODE=abc"),
            "ihui://oauth?AUTH_CODE=***",
            "大小写不同的敏感键同样要掩"
        );
        assert!(
            !deep_link_log_form("ihui://sso?sso_code=secret123").contains("secret123"),
            "掩完不得残留原取值"
        );
    }

    /// 本票(2026-09-26 补"导航期间直投丢失"窗口)的核心正例,走完整状态序列:
    /// 冷启动入队 → take 点亮 → 就绪期入队一条债务 → **导航复位** →
    /// 新 URL 必须入队而不是直投(复位缺失时这里是 Emit,即原缺陷形态)→
    /// 再 take 点亮且把债务与新链一并交回 → 此后恢复直投。
    /// 变异对照:把 apply_navigation_reset 里 `target_ready = false` 删掉(模拟"导航处不复位"),
    /// ③ 之后的 Queue 断言与 `kept==1` 之外还会让"新链入队"变"新链直投"立刻红。
    #[test]
    fn 就绪后导航复位_新链接必入队_重新点亮后恢复直投() {
        let mut gate = DeepLinkGateState::default();

        // ① 冷启动未就绪:两条全进队列,一条都不许直投
        let cold = urls(2);
        for d in decide_deep_link_deliveries(gate.target_ready, &cold) {
            match d {
                DeepLinkDelivery::Queue(u) => {
                    gate.pending.push(&u);
                }
                DeepLinkDelivery::Emit(_) => panic!("冷启动未就绪时不得出现直投分支"),
            }
        }
        assert_eq!(gate.pending.urls.len(), 2);

        // ② 渲染端注册完成,第一次 take:点亮就绪并一次取回(取即清)
        let (first_take, backlog) = apply_take_ready(&mut gate);
        assert!(first_take, "第一次 take 必须报告'首次点亮'");
        assert_eq!(backlog, cold);
        assert!(gate.target_ready);
        assert!(gate.pending.urls.is_empty(), "取即清:取回后队列必须为空");

        // 就绪期有一条 emit 失败回填(模拟 dispatch 的失败回填入队路径),导航前它是欠账
        gate.pending.push("ihui://sso?sso_code=debt");

        // ③ 导航发起:就绪拉回 false,**债务保留**(这是与 destroy 清账的刻意分野)
        let (was_ready, kept) = apply_navigation_reset(&mut gate);
        assert!(was_ready, "复位前是就绪态");
        assert_eq!(kept, 1, "导航复位不得清账 —— 队列里的补投债务归新页取");
        assert!(!gate.target_ready);

        // ④ 导航期间新 URL 抵达:必须走"未就绪 ⇒ 入队",绝不能直投给已不存在的渲染端
        let arrived: Vec<String> = vec!["ihui://sso?sso_code=nav".to_string()];
        let got = decide_deep_link_deliveries(gate.target_ready, &arrived);
        assert!(
            matches!(got[0], DeepLinkDelivery::Queue(_)),
            "导航复位后仍直投 = 本票要修的缺陷: {:?}",
            got
        );
        gate.pending.push(&arrived[0]);
        assert_eq!(gate.pending.urls.len(), 2, "债务 + 新链都必须在队");

        // ⑤ 新页面注册完监听、再次 take:重新点亮,债务与新链一并交回
        let (relit_first, backlog2) = apply_take_ready(&mut gate);
        assert!(
            relit_first,
            "导航复位后就绪标记已是 false,这次的 take 就是重新点亮那一次(first_take 必为 true)"
        );
        assert_eq!(
            backlog2,
            vec!["ihui://sso?sso_code=debt".to_string(), "ihui://sso?sso_code=nav".to_string()],
            "积压按到达顺序全量交回"
        );
        assert!(gate.target_ready, "take 之后恢复就绪");

        // ⑥ 此后抵达恢复直投(对照:若不点亮则永远是队列,把 take 变成唯一通路)
        let after = decide_deep_link_deliveries(gate.target_ready, &arrived);
        assert!(matches!(after[0], DeepLinkDelivery::Emit(_)));
    }

    /// 复位对"本来就未就绪"的状态是幂等的(启动早期/连续两次导航都不该报错或清账)。
    #[test]
    fn 未就绪时导航复位幂等且不动队列() {
        let mut gate = DeepLinkGateState::default();
        gate.pending.push("ihui://sso?sso_code=keep");
        let (was_ready, kept) = apply_navigation_reset(&mut gate);
        assert!(!was_ready);
        assert_eq!(kept, 1);
        let (was_ready2, kept2) = apply_navigation_reset(&mut gate);
        assert!(!was_ready2);
        assert_eq!(kept2, 1, "二次复位不得吞队列");
        assert_eq!(gate.pending.take_all(), vec!["ihui://sso?sso_code=keep".to_string()]);
    }

    /// "导航发起处必须调用复位函数"的源码级棘轮 —— 单元测试只能证明纯函数分支正确,
    /// 真正会让运行时丢链接的是**调用点被摘掉**(本仓最高频的"修好但没人看守"一型)。
    /// 判据:auto_refresh.rs 里每一处发起整页导航的 eval(`location.href=` / `location.reload()`)
    /// 之前 ≤8 行内必须出现 reset_deep_link_gate_for_navigation。
    /// 变异对照:删掉 auto_refresh.rs 任一处的复位调用 ⇒ 本用例红;新增导航站点不复位 ⇒ 同样红。
    /// (守门 scripts/check-desktop-event-wiring.mjs 的 G 组按同一判据在提交链上再看一遍。)
    #[test]
    fn 导航发起处无一例外必须先复位闸门() {
        let src = include_str!("auto_refresh.rs");
        let lines: Vec<&str> = src.lines().collect();
        let mut nav_sites = 0usize;
        for (i, line) in lines.iter().enumerate() {
            let is_nav = line.contains(".eval(")
                && (line.contains("location.href=") || line.contains("location.reload()"));
            if !is_nav {
                continue;
            }
            nav_sites += 1;
            let start = i.saturating_sub(8);
            let window = &lines[start..=i];
            assert!(
                window.iter().any(|l| l.contains("reset_deep_link_gate_for_navigation")),
                "auto_refresh.rs 第 {} 行发起整页导航却没有先复位深链闸门(导航期间抵达的链接会被直投丢失): {}",
                i + 1,
                line.trim()
            );
        }
        assert_eq!(
            nav_sites, 5,
            "导航发起处数量与登记的 5 处不符(启动离线/切离线/恢复/挂起热刷/热刷新)—— \
             若确属新增或删除导航站点,先在本断言处同步数字并在提交信息说明依据"
        );
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 2026-09-02 修复:显式固定进程级 AppUserModelID,使 Windows 通知区(系统托盘)
    // 图标的"显示/隐藏"记忆在 dev 重编译 / 发布更新 / 安装版之间保持一致。
    // 根因:Tauri 2.11 不会为进程设置 AppUserModelID,Windows 改用 exe 路径自动派生,
    // dev(target/debug/ihui-desktop.exe) 与安装版/更新版路径不同 → 被当成不同应用
    // → 托盘显隐记忆每次重置、图标被丢进隐藏溢出区。
    // 2026-09-02 修订:从 setup 前移到 run() 顶部——MS 要求该调用早于进程内任何窗口
    // 创建,而 Tauri 在 setup 之前就已按 tauri.conf.json 创建 main 窗口。
    // 注:winapi 0.3.9 与 Tauri 2.11 均未导出该 API,改用已在依赖树中的 windows-sys 调用。
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;

        let id = "com.ihui.desktop";
        let wide: Vec<u16> =
            std::ffi::OsStr::new(id).encode_wide().chain(std::iter::once(0)).collect();
        unsafe {
            let _ = SetCurrentProcessExplicitAppUserModelID(wide.as_ptr());
        }
    }
    // 2026-07-26 立:启动时清理 WebView2 缓存(Windows),彻底杜绝桌面端样式不同步问题
    // - 用户反馈"样式没同步":web dev 已更新,但 Tauri WebView2 缓存了旧 CSS chunk
    // - 2026-09-25 收窄:旧写法是 `remove_dir_all(EBWebView)`,而 `cfg(dev)` **确实会被编译**
    //   (`tauri-build` 输出 `cargo:rustc-cfg=dev`,已在构建日志里回读到),所以每次 `tauri dev`
    //   启动都在删用户的 WebView2 数据树(登录态 / 本地会话 / 已加密的 ihui-chat 信封一并没了)。
    //   现在只删缓存白名单,样式同步所需的"重新取 chunk"照样成立,数据目录一律保留。
    // - 仅 dev 模式生效(release 模式加载 frontendDist 静态产物,不需要清缓存)
    #[cfg(all(dev, target_os = "windows"))]
    {
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let webview_root = std::path::Path::new(&local_app_data)
                .join("com.ihui.desktop")
                .join("EBWebView");
            if webview_root.is_dir() {
                match clear_webview_caches(&webview_root) {
                    Ok((cleared, skipped)) => log::info!(
                        "[desktop] dev 启动清理 WebView2 缓存:删除 {} 个缓存目录,保留 {} 个数据目录",
                        cleared,
                        skipped.len()
                    ),
                    Err(e) => log::warn!("[desktop] dev 启动清理缓存被拒:{}", e),
                }
            }
        }
    }
    tauri::Builder::default()
        // 结构化日志(写文件 $APPDATA/com.ihui.ai/logs/ + 控制台)
        // 2026-07-29: 替代裸 println!/eprintln!,线上问题可追溯 + 设置项可一键导出
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        // 2026-09-17 薄壳化配套:离线兜底页协议。断网时 auto_refresh 模块将 main 窗口
        // 导航到 http://offline.localhost/index.html(此 handler 返回内嵌 HTML),
        // 恢复后自动切回线上前端。Windows 自定义协议 URL 形如 http://<scheme>.localhost/。
        .register_uri_scheme_protocol("offline", |_uri, _request| {
            tauri::http::Response::builder()
                .status(200)
                .header("Content-Type", "text/html; charset=utf-8")
                .header("Cache-Control", "no-store")
                .body(include_str!("../offline/index.html").as_bytes().to_vec())
                .expect("offline protocol: static html")
        })
        // single-instance 必须在 plugin chain 最前,防止多开 + 唤起已有窗口
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        // 开机自启(macOS 用 LaunchAgent,其他平台原生,启动参数 --minimized)
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        // 全局快捷键 plugin(handler 在 setup 中通过 on_shortcut 注册)
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .on_window_event(|window, event| {
            let label = window.label().to_string();
            // main 窗口关闭时最小化到托盘,而不是退出应用(真正退出走托盘菜单"退出")
            // admin 窗口直接关闭(辅助窗口,不需要最小化到托盘)
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if label == "main" {
                    api.prevent_close();
                    // 2026-07-29 #12:emit before-close 事件给前端,前端保存正在编辑的消息
                    // emit 是同步派发,前端 listen 异步处理;前端保存完不需要回调 Rust,
                    // 窗口立即隐藏(保存仍在进行,可接受)
                    if let Err(e) = window.emit("desktop-before-close", ()) {
                        log::warn!("[desktop-event] emit desktop-before-close failed: {}", e);
                    }
                    let _ = window.hide();
                    // 隐藏到托盘时持久化窗口状态
                    let app = window.app_handle().clone();
                    let _ = save_window_state(Some(label.clone()), app);
                } else if label == "admin" {
                    // 2026-08-16 修复:admin 在 CloseRequested 时就持久化窗口状态。
                    // 此前依赖 Destroyed 事件,但销毁后 get_webview_window 可能返回 None,
                    // 且 debounce 300ms 窗口内最后一次 Moved 位置可能被跳过 → 落点漏存。
                    let app = window.app_handle().clone();
                    let _ = save_window_state(Some(label.clone()), app);
                }
            }
            // 窗口焦点变化推给前端(2026-09-22 立):窗口 decorations:false,标题栏与
            // Min/Max/Close 三按钮全由前端自绘,DWM 不会替我们画"非活动窗口"的灰态。
            // 内核自带的 tauri://focus|blur 在远程 URL 页面实测收不到(真机聚焦/失焦两态
            // 像素逐字相同),所以走与 desktop-tray-action 同一条已被生产验证可用的应用层通道。
            if let tauri::WindowEvent::Focused(focused) = event {
                if label == "main" || label == "admin" {
                    if let Err(e) = window.emit("desktop-window-focus", focused) {
                        log::warn!("[desktop-event] emit desktop-window-focus failed: {}", e);
                    }
                }
            }
            // 窗口移动 / 缩放过程中防抖持久化(300ms 内合并,避免每次拖动都写盘)
            // 2026-07-27 立:扩展 admin 窗口也持久化位置/尺寸
            if let tauri::WindowEvent::Resized(_) = event {
                if label == "main" || label == "admin" {
                    let app = window.app_handle().clone();
                    debounce_save_window_state(label.clone(), app);
                }
            }
            if let tauri::WindowEvent::Moved(_) = event {
                if label == "main" || label == "admin" {
                    let app = window.app_handle().clone();
                    debounce_save_window_state(label.clone(), app);
                }
            }
            if let tauri::WindowEvent::Destroyed = event {
                if label == "main" || label == "admin" {
                    let app = window.app_handle().clone();
                    let _ = save_window_state(Some(label.clone()), app);
                }
                // 2026-09-26 A10C-1:深链闸门的目标窗口销毁 ⇒ 清账 + 复位就绪标记,
                // 否则积压的 sso_code 会活到下一次冷启动、被投给另一次会话的渲染端。
                reset_deep_link_gate_on_destroy(&label);
            }
        })
        .setup(|app| {
            // AUMID 已前移到 run() 顶部(2026-09-02,须早于任何窗口创建)

            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            // 2026-08-01 立:注册 deep-link scheme + 监听 ihui:// 回调
            // - on_open_url 监听外部浏览器 / 其他应用打开的 ihui://sso?sso_code=xxx
            // - emit "desktop-deep-link" 事件给前端 webview,前端 useDesktopDeepLink 完成 SSO 闭环
            // 2026-08-16 修复:此前 cfg 排除 Windows release(仅 debug 注册),
            // 生产版 Windows 不写注册表 → ihui:// SSO 扫码登录闭环失效。
            #[cfg(any(target_os = "linux", windows))]
            {
                let _ = app.deep_link().register_all();
            }
            app.deep_link().on_open_url({
                let app = app.handle().clone();
                move |event| {
                    // 2026-09-26 A10C-1:整批 URL 交给闸门逐条决定去向(旧实现在这里
                    // `if let Some(window)` + 只取 first,窗口未就绪/不存在时静默吞掉整条回调)。
                    let urls: Vec<String> = event
                        .urls()
                        .iter()
                        .map(|url| url.as_str().to_string())
                        .collect();
                    dispatch_deep_links(&app, &urls);
                }
            });
            // 2026-07-25 修订:不再调用 build_app_menu(已删除),菜单全部走 web 端 HTML 顶栏
            // let _ = build_app_menu(app.handle().clone());
            let _ = build_tray(app.handle());
            // 2026-09-02 #2:托盘图标写入 Win11 任务栏常驻(IsPromoted=1),
            // 解决"新身份图标默认被丢进右下角隐藏溢出区、需反复手动拖拽"的问题
            #[cfg(target_os = "windows")]
            schedule_tray_promote(app.handle());
            // 启动时设置本地化窗口标题(中文系统 → 智汇AI,其他 → IHUI AI)
            // admin 窗口已改为 lazy create(2026-07-29),启动时不存在,
            // 标题在 open_admin_window 中通过 WebviewWindowBuilder::title 设置
            let app_name = localized_app_name();
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title(app_name);
            }
            // 应用启动时恢复上次窗口状态(位置/尺寸/最大化)
            // 2026-07-27 立:仅恢复 main 窗口,admin 窗口在 open_admin_window 时恢复
            let _ = restore_window_state(Some("main".to_string()), app.handle().clone());
            // 2026-09-17 薄壳化配套:启动线上前端自动刷新(3min 构建指纹轮询)+ 断网兜底守卫(30s 健康检查)
            auto_refresh::start(app.handle().clone());
            // 2026-08-16 修复:autostart 插件透传 --minimized(开机自启最小化到托盘),
            // 此前无任何 args 解析,开机自启会直接弹出主窗口。须在恢复窗口状态后执行。
            if std::env::args().any(|a| a == "--minimized") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            // 注册全局快捷键(2026-07-29 扩充:3 个系统级快捷键)
            // 系统级 = 窗口失焦也能触发(与浏览器内 keydown 互补)
            // Ctrl+K 不注册(浏览器内 use-global-shortcuts.ts 已处理,窗口聚焦时用)
            // Ctrl+Shift+I:唤起/隐藏主窗口(原有,浏览器内无法监听)
            let _ = app.global_shortcut().on_shortcut("Ctrl+Shift+I", |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            });
            // Ctrl+Shift+N:新建对话(系统级,窗口失焦也能触发;窗口聚焦时浏览器内也会触发,前端去重)
            let _ = app.global_shortcut().on_shortcut("Ctrl+Shift+N", |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if let Some(window) = app.get_webview_window("main") {
                        if let Err(e) = window.emit("desktop-shortcut", "new_chat") {
                            log::warn!("[desktop-event] emit desktop-shortcut failed: {}", e);
                        }
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            });
            // Ctrl+Shift+S:快速截图(复用 Computer Control 的 capture_screen,emit 给前端)
            let _ = app.global_shortcut().on_shortcut("Ctrl+Shift+S", |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if let Some(window) = app.get_webview_window("main") {
                        if let Err(e) = window.emit("desktop-shortcut", "quick_screenshot") {
                            log::warn!("[desktop-event] emit desktop-shortcut failed: {}", e);
                        }
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            });
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            open_in_chrome,
            get_admin_window_info,
            toggle_devtools,
            quit_app,
            restart_app,
            open_admin_window,
            start_resize,
            toggle_fullscreen,
            toggle_always_on_top,
            screenshot_screen,
            mouse_move,
            mouse_click,
            keyboard_type,
            mouse_scroll,
            keyboard_press,
            keyboard_hotkey,
            active_window,
            clipboard_get,
            clipboard_set,
            read_text_file,
            read_binary_file,
            write_text_file,
            list_dir,
            stat_file,
            save_window_state,
            restore_window_state,
            reset_window_state,
            clear_webview_cache,
            set_tray_status,
            get_tray_always_visible,
            set_tray_always_visible,
            take_pending_deep_links
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            // 2026-07-22 P0 Round 5 鲁棒性加固:主入口 panic → 写 crash log + exit(1)
            // 原:.expect() 会 panic 导致"应用已停止运行"弹窗,无 crash log 落盘
            // 新:尝试写 crash log 到 APPDATA/LOCALAPPDATA(不依赖额外 crate),失败也 exit(1)
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let log_content = format!(
                "IHUI Desktop crash report\nTimestamp: {}\nError: {}\n\n{:?}",
                ts, e, e
            );
            // 尝试写 crash log(Windows: %APPDATA%,macOS/Linux: $HOME)
            let written = (|| {
                let base = std::env::var_os("APPDATA")
                    .or_else(|| std::env::var_os("XDG_DATA_HOME"))
                    .or_else(|| std::env::var_os("HOME"))?;
                let log_dir = std::path::Path::new(&base).join("com.ihui.ai").join("logs");
                std::fs::create_dir_all(&log_dir).ok()?;
                let log_path = log_dir.join(format!("crash-{}.log", ts));
                std::fs::write(&log_path, &log_content).ok()?;
                Some(log_path)
            })();
            match &written {
                // crash handler 在 tauri_plugin_log 初始化之前触发,log::error! 会丢失,
                // 用 eprintln! 保证 stderr 至少有输出(父进程可捕获),crash log 文件已落盘
                Some(p) => eprintln!("[crash] IHUI Desktop error log written to: {:?}", p),
                None => eprintln!("[crash] IHUI Desktop error (log write failed): {}", log_content),
            }
            std::process::exit(1);
        });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
