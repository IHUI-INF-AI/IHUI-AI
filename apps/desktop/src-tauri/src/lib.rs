use serde::{Deserialize, Serialize};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent, TrayIconId};
use tauri::{Emitter, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use std::io::Cursor;
use std::collections::HashMap;
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
        // 版本以 tauri.conf.json 的 version 为准(与 package.json 一致 0.1.13),
        // 不再用 Cargo.toml 的 CARGO_PKG_VERSION(0.1.0,二者会漂移)。
        version: app.package_info().version.to_string(),
        platform: std::env::consts::OS.to_string(),
    }
}

/// Chrome 登录会话信息:port 为 CDP 远程调试端口,前端据此提取登录 Cookie。
#[derive(Serialize)]
struct ChromeLoginSession {
    port: u16,
    profile_dir: String,
}

/// 探测系统 Google Chrome 可执行文件路径(常见安装位置)。
/// 返回第一个存在的路径;全部不存在返回 None。
fn find_chrome_path() -> Option<std::path::PathBuf> {
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
    candidates.into_iter().flatten().find(|p| p.exists())
}

/// 2026-08-17:用系统 Google Chrome 以 --app 模式打开 URL(独立无边框窗口,完整浏览器功能)。
/// - 用户要求"内置浏览器要谷歌 Chrome,不要 Edge"——Tauri 内嵌只能用 WebView2(Edge 壳),
///   而 Chrome --app 是"Google Chrome 本体 + 独立窗口",登录/点击/输入/视频全支持。
/// - Chrome 常见安装路径探测,找不到返回错误(前端提示安装 Chrome)。
/// - 仅允许 http/https URL(防参数注入)。
#[tauri::command]
fn open_in_chrome(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err("仅支持 http/https URL".into());
    }
    let chrome = find_chrome_path().ok_or("未找到 Google Chrome,请先安装 Chrome 浏览器")?;
    // spawn 后丢弃句柄:子进程独立运行,不等待、不 kill(--app 是长驻 Chrome 窗口)
    let _child = std::process::Command::new(&chrome)
        .arg(format!("--app={}", trimmed))
        .arg("--new-window")
        .spawn()
        .map_err(|e| format!("启动 Chrome 失败: {}", e))?;
    Ok(())
}

/// 2026-08-17:用系统 Google Chrome 以 --app 模式打开登录页,并开启 CDP 远程调试端口(供前端提取 Cookie)。
/// - 独立临时 profile(--user-data-dir),不污染用户日常 Chrome 会话。
/// - 随机调试端口(9300-9999)+ bind 探测可用性,最多尝试 20 次。
/// - 返回 { port, profile_dir },前端用 port 连 CDP 提取登录 Cookie。
#[tauri::command]
fn start_chrome_login(url: String) -> Result<ChromeLoginSession, String> {
    let trimmed = url.trim();
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err("仅支持 http/https URL".into());
    }
    let chrome = find_chrome_path().ok_or("未找到 Google Chrome,请先安装 Chrome 浏览器")?;
    // 随机调试端口:9300-9999,纳秒种子选起点,再逐个 bind 探测可用性,最多 20 次
    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos() as u64)
        .unwrap_or(0);
    let start = 9300 + (seed % 700) as u16; // 9300..=9999
    let mut port = None;
    for i in 0..20u16 {
        let candidate = if start + i <= 9999 {
            start + i
        } else {
            start + i - 700 // 环绕回 9300,保证在范围内
        };
        // bind 成功即端口空闲(立即 drop listener 释放端口,由 Chrome 抢占监听)
        if std::net::TcpListener::bind(("127.0.0.1", candidate)).is_ok() {
            port = Some(candidate);
            break;
        }
    }
    let port = port.ok_or("未能找到可用调试端口(9300-9999 均被占用)")?;
    // 唯一临时 profile 目录:进程号 + 纳秒时间戳(无 uuid 依赖,Cargo.toml 未引入)
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let profile_dir = std::env::temp_dir().join(format!(
        "ihui-chrome-login-{}-{}",
        std::process::id(),
        ts
    ));
    std::fs::create_dir_all(&profile_dir)
        .map_err(|e| format!("创建临时 profile 目录失败: {}", e))?;
    // spawn 后丢弃句柄:子进程长驻,不等待、不 kill
    let _child = std::process::Command::new(&chrome)
        .arg(format!("--app={}", trimmed))
        .arg(format!("--remote-debugging-port={}", port))
        .arg(format!("--user-data-dir={}", profile_dir.to_string_lossy()))
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg("--new-window")
        .spawn()
        .map_err(|e| format!("启动 Chrome 失败: {}", e))?;
    Ok(ChromeLoginSession {
        port,
        profile_dir: profile_dir.to_string_lossy().to_string(),
    })
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
    let _admin_window = WebviewWindowBuilder::new(&app, "admin", WebviewUrl::App("admin".into()))
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
                    let _ = window.emit("desktop-tray-action", "new_chat");
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
                    let _ = window.emit("desktop-tray-action", "toggle_theme");
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "tray.settings" => {
                // emit 事件给前端,前端跳转 /settings
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("desktop-tray-action", "open_settings");
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "tray.update" => {
                // emit 事件给前端,前端调 updater plugin 检查更新(带 UI 反馈)
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("desktop-tray-action", "check_update");
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
                    let _ = window.emit("desktop-tray-action", "quit");
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
        // 先设置 size,再设置 position,避免最大化状态下 set_position 失效
        let _ = window.set_size(PhysicalSize::new(w as u32, h as u32));
        let _ = window.set_position(PhysicalPosition::new(x as i32, y as i32));
        // 多显示器校验:窗口中心点不在任何显示器内时 fallback 到 center()
        // 场景:上次关闭时窗口在外接显示器,本次启动未接外接显示器
        if !is_window_visible_on_any_monitor(&window) {
            let _ = window.center();
        }
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

/// 清理 WebView2 缓存(Windows)。
/// 2026-07-29 #6:prod 模式 EBWebView 目录会无限增长(几个月可达数百 MB),
/// 供前端设置项"清理缓存"调用。清理后建议重启应用。
#[tauri::command]
fn clear_webview_cache() -> Result<OkResult, String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let webview_cache = std::path::Path::new(&local_app_data)
                .join("com.ihui.desktop")
                .join("EBWebView");
            if webview_cache.exists() {
                std::fs::remove_dir_all(&webview_cache).map_err(|e| e.to_string())?;
                log::info!("[desktop] WebView2 cache cleared by user: {}", webview_cache.display());
            }
        }
    }
    Ok(OkResult { ok: true })
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 2026-07-26 立:启动时清理 WebView2 缓存(Windows),彻底杜绝桌面端样式不同步问题
    // - 用户反馈"样式没同步":web dev 已更新,但 Tauri WebView2 缓存了旧 CSS chunk
    // - 每次 dev 启动清空 EBWebView 目录,强制重新加载 dev server 的最新 HTML/CSS
    // - 仅 dev 模式生效(release 模式加载 frontendDist 静态产物,不需要清缓存)
    #[cfg(all(dev, target_os = "windows"))]
    {
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let webview_cache = std::path::Path::new(&local_app_data)
                .join("com.ihui.desktop")
                .join("EBWebView");
            if webview_cache.exists() {
                let _ = std::fs::remove_dir_all(&webview_cache);
                log::info!("[desktop] WebView2 cache cleared: {}", webview_cache.display());
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
                    let _ = window.emit("desktop-before-close", ());
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
            }
        })
        .setup(|app| {
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
                    if let Some(window) = app.get_webview_window("main") {
                        if let Some(first_url) = event.urls().first() {
                            let url_str = first_url.as_str().to_string();
                            log::info!("[desktop] deep-link received: {}", url_str);
                            let _ = window.emit("desktop-deep-link", url_str);
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            });
            // 2026-07-25 修订:不再调用 build_app_menu(已删除),菜单全部走 web 端 HTML 顶栏
            // let _ = build_app_menu(app.handle().clone());
            let _ = build_tray(app.handle());
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
                        let _ = window.emit("desktop-shortcut", "new_chat");
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            });
            // Ctrl+Shift+S:快速截图(复用 Computer Control 的 capture_screen,emit 给前端)
            let _ = app.global_shortcut().on_shortcut("Ctrl+Shift+S", |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("desktop-shortcut", "quick_screenshot");
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
            start_chrome_login,
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
            set_tray_status
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
