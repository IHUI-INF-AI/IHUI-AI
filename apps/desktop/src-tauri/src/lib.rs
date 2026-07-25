use serde::{Deserialize, Serialize};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use std::io::Cursor;
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
#[cfg(windows)]
fn is_chinese_locale() -> bool {
    use winapi::um::winnls::GetUserDefaultUILanguage;
    let lang_id = unsafe { GetUserDefaultUILanguage() };
    // 中文主语言 ID = 0x04(涵盖 zh-CN/zh-TW/zh-HK/zh-SG/zh-MO)
    let primary_lang = lang_id & 0x3FF;
    primary_lang == 0x04
}

/// 检测系统 UI 语言是否为中文(非 Windows: LANG 环境变量)。
#[cfg(not(windows))]
fn is_chinese_locale() -> bool {
    std::env::var("LANG")
        .map(|lang| lang.to_lowercase().starts_with("zh"))
        .unwrap_or(false)
}

/// 根据系统 UI 语言返回本地化应用名称:中文 → 智汇AI,其他 → IHUI AI。
fn localized_app_name() -> &'static str {
    if is_chinese_locale() {
        "智汇AI"
    } else {
        "IHUI AI"
    }
}

#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: localized_app_name().to_string(),
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
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// 唤起 / 创建 admin 窗口(2026-07-25 立,供前端 menu dispatcher 调用)。
/// admin 已存在则 show + focus;否则按 tauri.conf.json admin 配置新建。
#[tauri::command]
async fn open_admin_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("admin") {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    let app_name = localized_app_name();
    WebviewWindowBuilder::new(&app, "admin", WebviewUrl::App("admin".into()))
        .title(&format!("{} 管理后台", app_name))
        .inner_size(1280.0, 820.0)
        .min_inner_size(960.0, 640.0)
        .resizable(true)
        .center()
        .decorations(false)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 构建系统托盘(显示主窗口 / 隐藏主窗口 / 退出)+ 双击托盘唤起。
fn build_tray(app: &tauri::AppHandle) -> Result<(), String> {
    let show_item = MenuItemBuilder::with_id("tray.show", "显示主窗口")
        .build(app)
        .map_err(|e| e.to_string())?;
    let hide_item = MenuItemBuilder::with_id("tray.hide", "隐藏主窗口")
        .build(app)
        .map_err(|e| e.to_string())?;
    let quit_item = MenuItemBuilder::with_id("tray.quit", "退出")
        .build(app)
        .map_err(|e| e.to_string())?;
    let menu = MenuBuilder::new(app)
        .item(&show_item)
        .item(&hide_item)
        .separator()
        .item(&quit_item)
        .build()
        .map_err(|e| e.to_string())?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| "no default window icon".to_string())?;
    TrayIconBuilder::new()
        .icon(icon)
        .tooltip(localized_app_name())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
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
            "tray.quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
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
fn screenshot_screen(
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
fn mouse_move(x: f64, y: f64, absolute: Option<bool>) -> Result<OkResult, String> {
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
fn mouse_click(
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
fn keyboard_type(text: String, delay: Option<u64>) -> Result<OkResult, String> {
    // 2026-07-22 P1 鲁棒性加固:防止超长 text 卡死 UI
    const MAX_TEXT_LEN: usize = 10000;
    if text.chars().count() > MAX_TEXT_LEN {
        return Err(format!("text too long: max {} chars", MAX_TEXT_LEN));
    }
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    if let Some(ms) = delay {
        if ms > 0 {
            for ch in text.chars() {
                enigo
                    .text(&ch.to_string())
                    .map_err(|e| e.to_string())?;
                std::thread::sleep(std::time::Duration::from_millis(ms));
            }
            return Ok(OkResult { ok: true });
        }
    }
    enigo.text(&text).map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

#[tauri::command]
fn mouse_scroll(
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
fn keyboard_press(key: String) -> Result<OkResult, String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    let k = parse_key(&key)?;
    enigo.key(k, Direction::Click).map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

#[tauri::command]
fn keyboard_hotkey(keys: Vec<String>) -> Result<OkResult, String> {
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

/// Windows: winapi(GetForegroundWindow + GetWindowTextW + 进程映像名);其他平台未实现。
#[cfg(windows)]
mod active_window_impl {
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::winbase::QueryFullProcessImageNameW;
    use winapi::um::winuser::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
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

            Ok(super::WindowInfo {
                title,
                app_name,
                window_id: format!("{}", hwnd as usize),
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

/// 读取文本文件(UTF-8)。
#[tauri::command]
fn read_text_file(path: String) -> Result<ReadTextResult, String> {
    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let size = metadata.len();
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(ReadTextResult { content, size })
}

/// 读取二进制文件,返回 base64 + MIME(用于图片/附件预览)。
#[tauri::command]
fn read_binary_file(path: String) -> Result<ReadBinaryResult, String> {
    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let size = metadata.len();
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let mime = mime_from_extension(&path);
    Ok(ReadBinaryResult { base64, size, mime })
}

/// 写入文本文件(覆盖)。父目录不存在时自动创建。
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<OkResult, String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

/// 列出目录下的文件/子目录(非递归)。
#[tauri::command]
fn list_dir(path: String) -> Result<DirListResult, String> {
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

/// 获取单个文件/目录的元信息。
#[tauri::command]
fn stat_file(path: String) -> Result<FileInfo, String> {
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
        path,
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
const KEY_WIN_X: &str = "window.x";
const KEY_WIN_Y: &str = "window.y";
const KEY_WIN_W: &str = "window.width";
const KEY_WIN_H: &str = "window.height";
const KEY_WIN_MAX: &str = "window.maximized";

/// 保存主窗口当前位置 / 尺寸 / 最大化状态到 store。
#[tauri::command]
fn save_window_state(app: tauri::AppHandle) -> Result<OkResult, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let store = app
        .store(WINDOW_STORE_FILE)
        .map_err(|e| e.to_string())?;
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let maximized = window.is_maximized().unwrap_or(false);
    store.set(KEY_WIN_X, pos.x);
    store.set(KEY_WIN_Y, pos.y);
    store.set(KEY_WIN_W, size.width);
    store.set(KEY_WIN_H, size.height);
    store.set(KEY_WIN_MAX, maximized);
    store.save().map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

/// 从 store 恢复主窗口位置 / 尺寸 / 最大化状态(应用启动时调用)。
#[tauri::command]
fn restore_window_state(app: tauri::AppHandle) -> Result<OkResult, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let store = app
        .store(WINDOW_STORE_FILE)
        .map_err(|e| e.to_string())?;
    // 优先恢复最大化状态
    if let Some(true) = store.get(KEY_WIN_MAX).and_then(|v| v.as_bool()) {
        let _ = window.maximize();
        return Ok(OkResult { ok: true });
    }
    let x = store.get(KEY_WIN_X).and_then(|v| v.as_i64());
    let y = store.get(KEY_WIN_Y).and_then(|v| v.as_i64());
    let w = store.get(KEY_WIN_W).and_then(|v| v.as_u64());
    let h = store.get(KEY_WIN_H).and_then(|v| v.as_u64());
    if let (Some(x), Some(y), Some(w), Some(h)) = (x, y, w, h) {
        use tauri::PhysicalPosition;
        use tauri::PhysicalSize;
        // 先设置 size,再设置 position,避免最大化状态下 set_position 失效
        let _ = window.set_size(PhysicalSize::new(w as u32, h as u32));
        let _ = window.set_position(PhysicalPosition::new(x as i32, y as i32));
    }
    Ok(OkResult { ok: true })
}

/// 重置窗口状态(清除 store 中的窗口记录,下次启动用默认尺寸)。
#[tauri::command]
fn reset_window_state(app: tauri::AppHandle) -> Result<OkResult, String> {
    let store = app
        .store(WINDOW_STORE_FILE)
        .map_err(|e| e.to_string())?;
    store.delete(KEY_WIN_X);
    store.delete(KEY_WIN_Y);
    store.delete(KEY_WIN_W);
    store.delete(KEY_WIN_H);
    store.delete(KEY_WIN_MAX);
    store.save().map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

// ================== 会话历史持久化 ==================

const CONVERSATION_STORE_FILE: &str = "conversations.json";
const KEY_CONVERSATIONS: &str = "conversations";
const KEY_ACTIVE_CONV: &str = "activeConversationId";

#[derive(Debug, Serialize, Deserialize, Clone)]
struct StoredMessage {
    id: String,
    role: String,
    content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ConversationSummary {
    id: String,
    title: String,
    created_at: i64,
    updated_at: i64,
    message_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Conversation {
    id: String,
    title: String,
    created_at: i64,
    updated_at: i64,
    messages: Vec<StoredMessage>,
}

#[derive(Serialize)]
struct ConversationListResult {
    conversations: Vec<ConversationSummary>,
    active_id: Option<String>,
}

#[derive(Serialize)]
struct ConversationLoadResult {
    conversation: Option<Conversation>,
}

/// 列出所有会话摘要 + 当前活跃会话 ID(按 updated_at 倒序)。
#[tauri::command]
fn list_conversations(app: tauri::AppHandle) -> Result<ConversationListResult, String> {
    let store = app.store(CONVERSATION_STORE_FILE).map_err(|e| e.to_string())?;
    let active_id = store
        .get(KEY_ACTIVE_CONV)
        .and_then(|v| v.as_str().map(|s| s.to_string()));
    let conversations: Vec<Conversation> = store
        .get(KEY_CONVERSATIONS)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    let mut summaries: Vec<ConversationSummary> = conversations
        .iter()
        .map(|c| ConversationSummary {
            id: c.id.clone(),
            title: c.title.clone(),
            created_at: c.created_at,
            updated_at: c.updated_at,
            message_count: c.messages.len(),
        })
        .collect();
    summaries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(ConversationListResult {
        conversations: summaries,
        active_id,
    })
}

/// 加载指定会话的完整消息列表。
#[tauri::command]
fn load_conversation(app: tauri::AppHandle, id: String) -> Result<ConversationLoadResult, String> {
    let store = app.store(CONVERSATION_STORE_FILE).map_err(|e| e.to_string())?;
    let conversations: Vec<Conversation> = store
        .get(KEY_CONVERSATIONS)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    let conversation = conversations.into_iter().find(|c| c.id == id);
    Ok(ConversationLoadResult { conversation })
}

/// 保存/更新会话(id 已存在则覆盖,否则新增)。限制最多 50 个会话。
#[tauri::command]
fn save_conversation(
    app: tauri::AppHandle,
    id: String,
    title: String,
    messages: Vec<StoredMessage>,
) -> Result<OkResult, String> {
    let store = app.store(CONVERSATION_STORE_FILE).map_err(|e| e.to_string())?;
    let mut conversations: Vec<Conversation> = store
        .get(KEY_CONVERSATIONS)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    if let Some(existing) = conversations.iter_mut().find(|c| c.id == id) {
        existing.title = title;
        existing.updated_at = now;
        existing.messages = messages;
    } else {
        conversations.push(Conversation {
            id: id.clone(),
            title,
            created_at: now,
            updated_at: now,
            messages,
        });
    }
    if conversations.len() > 50 {
        conversations.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        conversations.truncate(50);
    }
    let json = serde_json::to_value(&conversations).map_err(|e| e.to_string())?;
    store.set(KEY_CONVERSATIONS, json);
    store.set(KEY_ACTIVE_CONV, id);
    store.save().map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

/// 删除指定会话。
#[tauri::command]
fn delete_conversation(app: tauri::AppHandle, id: String) -> Result<OkResult, String> {
    let store = app.store(CONVERSATION_STORE_FILE).map_err(|e| e.to_string())?;
    let mut conversations: Vec<Conversation> = store
        .get(KEY_CONVERSATIONS)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    conversations.retain(|c| c.id != id);
    let json = serde_json::to_value(&conversations).map_err(|e| e.to_string())?;
    store.set(KEY_CONVERSATIONS, json);
    if let Some(active) = store
        .get(KEY_ACTIVE_CONV)
        .and_then(|v| v.as_str().map(|s| s.to_string()))
    {
        if active == id {
            store.delete(KEY_ACTIVE_CONV);
        }
    }
    store.save().map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

/// 设置当前活跃会话 ID(用于下次启动时恢复)。
#[tauri::command]
fn set_active_conversation(app: tauri::AppHandle, id: Option<String>) -> Result<OkResult, String> {
    let store = app.store(CONVERSATION_STORE_FILE).map_err(|e| e.to_string())?;
    match id {
        Some(id) => store.set(KEY_ACTIVE_CONV, id),
        None => {
            store.delete(KEY_ACTIVE_CONV);
        }
    }
    store.save().map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

#[tauri::command]
fn clipboard_get(format: Option<String>) -> Result<ClipboardResult, String> {
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
fn clipboard_set(
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
    tauri::Builder::default()
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
            // 关闭主窗口时最小化到托盘,而不是退出应用(真正退出走托盘菜单"退出")
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                    // 隐藏到托盘时持久化窗口状态
                    let app = window.app_handle().clone();
                    let _ = save_window_state(app);
                }
            }
            // 窗口移动 / 缩放结束时持久化(避免每次拖动都写盘)
            if let tauri::WindowEvent::Resized(_) = event {
                if window.label() == "main" {
                    let app = window.app_handle().clone();
                    let _ = save_window_state(app);
                }
            }
            if let tauri::WindowEvent::Moved(_) = event {
                if window.label() == "main" {
                    let app = window.app_handle().clone();
                    let _ = save_window_state(app);
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
            // 2026-07-25 修订:不再调用 build_app_menu(已删除),菜单全部走 web 端 HTML 顶栏
            // let _ = build_app_menu(app.handle().clone());
            let _ = build_tray(app.handle());
            // 启动时设置本地化窗口标题(中文系统 → 智汇AI,其他 → IHUI AI)
            let app_name = localized_app_name();
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title(app_name);
            }
            if let Some(window) = app.get_webview_window("admin") {
                let _ = window.set_title(&format!("{} 管理后台", app_name));
            }
            // 应用启动时恢复上次窗口状态(位置/尺寸/最大化)
            let _ = restore_window_state(app.handle().clone());
            // 注册全局快捷键 Ctrl+Shift+I 唤起/隐藏主窗口
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
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_admin_window_info,
            toggle_devtools,
            quit_app,
            open_admin_window,
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
            list_conversations,
            load_conversation,
            save_conversation,
            delete_conversation,
            set_active_conversation
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
                Some(p) => eprintln!("[crash] IHUI Desktop error log written to: {:?}", p),
                None => eprintln!("[crash] IHUI Desktop error (log write failed): {}", log_content),
            }
            std::process::exit(1);
        });
}
