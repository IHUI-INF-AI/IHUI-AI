// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 桌面端 AI 画中画监看窗 —— 2026-11-25 立,2026-11-26 多窗化。
//!
//! 和 `embedded_browser` 的原生小窗不是同一件事:
//! - 内嵌浏览器小窗监控的是**本地浏览器页面**,只读盾/接管/几何记忆已在其模块实现;
//! - 这里开的是**独立 Tauri 窗口**,加载 Web 端 `/browser-pip?session=<id>` 页面,
//!   由该页面连 Browser Hub WS 收帧、任务条、检查点和 phase。这样桌面端也能拿到
//!   文章里“AI 跑网页时的只读监看 + 目标/进度/检查点/继续”的完整体验,而不是把
//!   Browser Hub 的假任务状态硬塞进本地浏览器小窗。
//!
//! 窗口契约:420×280 起、最小 320×200、置顶、可缩放、不进任务栏、打开/点击都不抢焦点。
//!
//! 多窗:每会话一个 label(`ai-browser-pip-<session>`)。旧版全仓唯一 label 的
//! 单例窗会让第二个会话把第一个监看窗顶掉,和 TRAE 可同时看多个任务的形态不一致。
//! 这里按会话保存几何/收起状态,允许最多 6 个窗口(与服务端单主体会话上限一致)。

use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{LazyLock, Mutex},
    time::{Duration, Instant},
};

use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// 每个会话的 AI 画中画窗口 label 前缀。
pub const AI_PIP_WINDOW_LABEL_PREFIX: &str = "ai-browser-pip";
const AI_PIP_WIDTH: f64 = 960.0;
const AI_PIP_HEIGHT: f64 = 540.0;
const AI_PIP_MIN_WIDTH: f64 = 320.0;
const AI_PIP_MIN_HEIGHT: f64 = 200.0;
/// 收起时只留顶部状态栏;32px 与页面 header 的 h-8 一致。
const AI_PIP_COLLAPSED_HEIGHT: f64 = 32.0;
const AI_PIP_MARGIN: f64 = 24.0;
const AI_PIP_CASCADE_STEP: f64 = 40.0;
const AI_PIP_MAX_WINDOWS: usize = 6;

/// 画中画专用 WebView2 profile。
///
/// wry 每次建 webview 都会新建一次 `CreateCoreWebView2EnvironmentWithOptions`;同一个
/// user-data-folder 配不同 options 会直接返回 `0x8007139F`(主窗配置与运行时建窗不同)。
/// `embedded_browser` 已用独立 profile 验证过这条路,这里沿用同一策略:所有画中画窗共用
/// 一套 profile,彼此 options 一致,不会和主窗抢默认目录。
const AI_PIP_PROFILE_DIR: &str = "browser-pip-profile";

fn pip_profile_dir(app: &AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_local_data_dir().ok()?.join(AI_PIP_PROFILE_DIR);
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

fn pip_window_label(session_id: &str) -> String {
    format!("{AI_PIP_WINDOW_LABEL_PREFIX}-{session_id}")
}

/// 兼容旧单例 label:升级时若还留着一个 `ai-browser-pip`,关闭/清理路径也要认。
fn is_pip_window_label(label: &str) -> bool {
    label == AI_PIP_WINDOW_LABEL_PREFIX
        || label
            .strip_prefix(AI_PIP_WINDOW_LABEL_PREFIX)
            .is_some_and(|rest| rest.starts_with('-'))
}

#[derive(Clone, Copy, Default)]
struct PipGeometry {
    /// 物理像素位置;窗口关闭/移动时记,下次打开沿用。
    pos: Option<(i32, i32)>,
    /// 物理像素内容区尺寸;收起态不覆盖,保证下次展开仍是完整尺寸。
    size: Option<(u32, u32)>,
    collapsed: bool,
}

/// 按窗口 label 保存几何。这里刻意用物理像素而不是逻辑坐标:150% DPI 下
/// WebView2 初始化会触发一次 DPI 换算,逻辑尺寸在 builder/show 之间会被再缩放一次,
/// 真机表现为「拖到 900×600,关掉重开变成 600×400」。存物理像素并在 show 后
/// `set_size(PhysicalSize)` 落一次,才能像素级还原。
static AI_PIP_GEOMETRY: LazyLock<Mutex<HashMap<String, PipGeometry>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// 1/4 屏默认尺寸:取主窗口内容区的 50%×50%,面积正好是主窗可用区的 1/4。
/// 主窗最大化时就是整屏右下角 1/4;主窗没铺满时也不会做出一个和主窗一样大的
/// “小窗”。文章要求「尺寸别缩到 1/4 屏以下」,这里按面积算,不是按宽高各 25%
/// (那只有 1/16 面积,连报错弹窗都看不清)。
fn pip_quarter_size(screen_width: f64, screen_height: f64) -> (f64, f64) {
    let width = (screen_width * 0.5).max(AI_PIP_MIN_WIDTH);
    let height = (screen_height * 0.5).max(AI_PIP_MIN_HEIGHT);
    (width.round(), height.round())
}

fn pip_default_size(win: &WebviewWindow) -> (f64, f64) {
    let scale = win.scale_factor().unwrap_or(1.0);
    let scale = if scale.is_finite() && scale > 0.0 {
        scale
    } else {
        1.0
    };
    // 主窗内容区优先:主窗没最大化时,按显示器算会得到一个几乎和主窗一样大的
    // “小窗”。只有拿不到有效主窗尺寸时才回落到显示器。
    if let Ok(inner) = win.inner_size() {
        let logical = inner.to_logical::<f64>(scale);
        if logical.width >= AI_PIP_MIN_WIDTH && logical.height >= AI_PIP_MIN_HEIGHT {
            return pip_quarter_size(logical.width, logical.height);
        }
    }
    let Some(monitor) = win.current_monitor().ok().flatten() else {
        return (AI_PIP_WIDTH, AI_PIP_HEIGHT);
    };
    let logical = monitor.size().to_logical::<f64>(scale);
    pip_quarter_size(logical.width, logical.height)
}

/// 保存几何的兜底下限,避免历史脏数据把窗口缩成指甲盖;真实下限由建窗时的
/// `min_inner_size(1/4 屏)` 约束,用户拖不到 1/4 屏以下。
/// 按当前 DPI 换算成物理像素后再夹。
fn clamp_pip_pixels(width: u32, height: u32, scale: f64) -> (u32, u32) {
    let scale = if scale.is_finite() && scale > 0.0 {
        scale
    } else {
        1.0
    };
    let min_w = (AI_PIP_MIN_WIDTH * scale).round() as u32;
    let min_h = (AI_PIP_MIN_HEIGHT * scale).round() as u32;
    (width.max(min_w), height.max(min_h))
}

fn geometry_for(label: &str) -> PipGeometry {
    AI_PIP_GEOMETRY
        .lock()
        .ok()
        .and_then(|guard| guard.get(label).copied())
        .unwrap_or_default()
}

fn update_geometry<F>(label: &str, mutate: F)
where
    F: FnOnce(&mut PipGeometry),
{
    if let Ok(mut guard) = AI_PIP_GEOMETRY.lock() {
        mutate(guard.entry(label.to_string()).or_default());
    }
}

/// 记当前几何,供同会话下次打开沿用。用户点关闭和代码主动销毁都必须走这里,
/// 否则 `destroy()` 不触发 `CloseRequested`,尺寸/位置会丢。
fn remember_pip_geometry(win: &WebviewWindow) {
    // 最大化是临时查看态,不能把整屏尺寸写成下次打开的默认几何;
    // 还原时 Resized 会自然把正常尺寸写回来。
    if win.is_maximized().unwrap_or(false) {
        return;
    }
    let label = win.label().to_string();
    let pos = win.outer_position().ok().map(|p| (p.x, p.y));
    let size = if geometry_for(&label).collapsed {
        None
    } else {
        win.inner_size().ok().map(|size| {
            let scale = win.scale_factor().unwrap_or(1.0);
            clamp_pip_pixels(size.width, size.height, scale)
        })
    };
    update_geometry(&label, |geometry| {
        if let Some(pos) = pos {
            geometry.pos = Some(pos);
        }
        if let Some(size) = size {
            geometry.size = Some(size);
        }
    });
}

/// 由主窗口 URL 生成 `/browser-pip?session=...`,保留主站 origin(含端口)。
fn browser_pip_url(main: &Url, session_id: &str) -> Result<Url, String> {
    validate_pip_session(session_id)?;
    if !matches!(main.scheme(), "http" | "https") {
        return Err(format!("主窗口不是 http(s) 页面: {}", main.scheme()));
    }
    let origin = main.origin().ascii_serialization();
    let mut url = Url::parse(&format!("{origin}/browser-pip"))
        .map_err(|e| format!("画中画页面 URL 非法: {e}"))?;
    url.query_pairs_mut().append_pair("session", session_id);
    Ok(url)
}

/// 会话 ID 是唯一会从主窗/监看窗回传的标识;两处入口共用同一条校验,
/// 防止「建窗时校验、接管时绕过」的两套口径。
fn validate_pip_session(session_id: &str) -> Result<(), String> {
    if session_id.is_empty() || session_id.len() > 128 {
        return Err("会话 ID 长度非法".to_string());
    }
    if !session_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("会话 ID 含非法字符".to_string());
    }
    Ok(())
}

/// 接管事件回传主窗的载荷。sessionId 用于找回/重建对应 CDP tab,
/// url/title 用于该 tab 已被用户关掉时恢复现场。
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct BrowserPipHandover {
    session_id: String,
    url: String,
    title: String,
}

/// 单个监看窗关闭事件。多窗后不能再用无载荷的 `closed` 事件把主窗按钮
/// 一刀切复位——关掉 B 窗不该把 A 会话的按钮变成「未打开」。
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct BrowserPipClosed {
    session_id: String,
}

/// 主窗口右下角内侧;多窗按打开顺序向上错开,避免完全叠在一起。
/// 同一会话有上次位置时优先还原它。
fn pip_open_position(
    app: &AppHandle,
    label: &str,
    pip_width: f64,
    pip_height: f64,
) -> (i32, i32) {
    if let Some(pos) = geometry_for(label).pos {
        return pos;
    }
    let Some(main) = app.get_webview_window("main") else {
        return (AI_PIP_MARGIN as i32, AI_PIP_MARGIN as i32);
    };
    let scale = main.scale_factor().unwrap_or(1.0);
    let pos = main.outer_position().unwrap_or_default();
    let size = main.outer_size().unwrap_or_default();
    let open_count = app
        .webview_windows()
        .keys()
        .filter(|name| is_pip_window_label(name))
        .count();
    pip_open_position_for(
        pos.x,
        pos.y,
        size.width,
        size.height,
        pip_width,
        pip_height,
        scale,
        open_count,
    )
}

/// 纯几何:主窗右下角内侧,多窗向上错开,并夹在主窗可见范围内。
/// 抽成纯函数是为了单测能覆盖 DPI / 多窗级联 / 主窗过小的边界。
fn pip_open_position_for(
    main_x: i32,
    main_y: i32,
    main_width: u32,
    main_height: u32,
    pip_width: f64,
    pip_height: f64,
    scale: f64,
    open_count: usize,
) -> (i32, i32) {
    let x = main_x + main_width as i32 - ((pip_width + AI_PIP_MARGIN) * scale) as i32;
    let y = main_y + main_height as i32
        - ((pip_height + AI_PIP_MARGIN) * scale) as i32
        - (open_count as f64 * AI_PIP_CASCADE_STEP * scale) as i32;
    let min_y = main_y + (AI_PIP_MARGIN * scale) as i32;
    (x.max(0), y.max(min_y).max(0))
}

/// 只把 token 注入预期 origin 的页面。`initialization_script` 会在每次页面
/// 加载时执行;若误导航到外部站点,不能让 token 跟着脚本落到别人 origin。
fn pip_token_script(access_token: &str, origin: &str) -> Result<String, String> {
    let token = serde_json::to_string(access_token).map_err(|e| format!("令牌序列化失败: {e}"))?;
    let origin = serde_json::to_string(origin).map_err(|e| format!("origin 序列化失败: {e}"))?;
    Ok(format!(
        "(() => {{ if (window.location.origin === {origin}) {{ window.__IHUI_PIP_TOKEN__ = {token}; }} }})();"
    ))
}

fn pip_window_title(session_id: &str) -> String {
    let short: String = session_id
        .chars()
        .rev()
        .take(6)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    if short.is_empty() {
        "AI 画中画监看".to_string()
    } else {
        format!("AI 画中画监看 · {short}")
    }
}

/// 让监看窗成为「可点击但不激活」的置顶工具窗。
///
/// `WS_EX_NOACTIVATE` 是 TRAE 画中画“点小窗不抢焦点”的关键:没有它,用户点
/// 收起/置顶/重连时 Windows 会先把监看窗激活,主窗里的键盘输入就断了。
/// `WS_EX_TOOLWINDOW` 同时兜住 Alt-Tab/任务栏隐藏(与 skip_taskbar 双保险)。
#[cfg(target_os = "windows")]
fn apply_pip_window_styles(win: &WebviewWindow, show: bool) -> Result<(), String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, HWND_TOPMOST,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    };

    let hwnd = win
        .hwnd()
        .map_err(|e| format!("读取画中画窗口句柄失败: {e}"))?;
    let native = HWND(hwnd.0);
    unsafe {
        let ex = GetWindowLongPtrW(native, GWL_EXSTYLE);
        let next = ex | ((WS_EX_NOACTIVATE.0 | WS_EX_TOOLWINDOW.0) as isize);
        if next != ex {
            SetWindowLongPtrW(native, GWL_EXSTYLE, next);
        }
        // 样式位设置后强制落一次 Z 序；只有本次要显示时才带 SWP_SHOWWINDOW,
        // 预建隐藏窗不能被这里顺手 show 出来。
        let mut flags = SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE;
        if show {
            flags |= SWP_SHOWWINDOW;
        }
        let _ = SetWindowPos(native, Some(HWND_TOPMOST), 0, 0, 0, 0, flags);
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn apply_pip_window_styles(_win: &WebviewWindow, _show: bool) -> Result<(), String> {
    Ok(())
}

/// Windows 下用 `SW_SHOWNOACTIVATE` 显示,避免 builder 的 show 抢一次前台。
#[cfg(target_os = "windows")]
fn show_pip_window_without_activating(win: &WebviewWindow) -> Result<(), String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_SHOWNOACTIVATE};

    let hwnd = win
        .hwnd()
        .map_err(|e| format!("读取画中画窗口句柄失败: {e}"))?;
    unsafe {
        let _ = ShowWindow(HWND(hwnd.0), SW_SHOWNOACTIVATE);
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn show_pip_window_without_activating(win: &WebviewWindow) -> Result<(), String> {
    win.show()
        .map_err(|e| format!("显示 AI 画中画窗口失败: {e}"))
}

/// 打开 AI 画中画窗。同一会话已存在时只刷新 token/置顶显示,不重建;
/// 不同会话各开一窗,最多 6 个(与服务端单主体会话上限一致)。
///
/// `show=False` 为预建隐藏窗:检查点提示条出现时把 WebView2 冷启动提前,
/// 用户点「去处理」时同 label 窗口只需 show,不再现等 1.3–1.8s。
#[tauri::command]
pub async fn open_browser_pip_window(
    app: AppHandle,
    session_id: String,
    access_token: String,
    show: Option<bool>,
) -> Result<(), String> {
    ensure_browser_pip_window(app, session_id, access_token, show.unwrap_or(true)).await
}

async fn ensure_browser_pip_window(
    app: AppHandle,
    session_id: String,
    access_token: String,
    show: bool,
) -> Result<(), String> {
    if access_token.is_empty() || access_token.len() > 4096 {
        return Err("访问令牌长度非法".to_string());
    }
    validate_pip_session(&session_id)?;
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在".to_string())?;
    let main_url = main
        .url()
        .map_err(|e| format!("读取主窗口 URL 失败: {e}"))?;
    let url = browser_pip_url(&main_url, &session_id)?;
    let token_script = pip_token_script(&access_token, &url.origin().ascii_serialization())?;
    let label = pip_window_label(&session_id);

    if let Some(existing) = app.get_webview_window(&label) {
        // 同一会话重复点「打开」:更新 token 后原窗显示,不销毁重建。
        let _ = existing.eval(&token_script);
        // 新建窗在 `build()` 后、首次 show 前拿不到 HWND;此时重复点击不能报错，
        // 否则自动监看 4s 轮询会把「正在创建」误报成失败。样式等首次创建流程会补。
        // 预建窗可能仍在 `build()` 中;给最多 3 秒等 HWND 就绪,避免用户
        // 在提示条刚出现时点击被直接打回停靠监看。预建正常在 1.2–2.5s 完成,
        // 命中已就绪窗口时这一循环一次都不会进。
        let ready_deadline = Instant::now() + Duration::from_secs(3);
        loop {
            match apply_pip_window_styles(&existing, show) {
                Ok(()) => break,
                Err(e) if Instant::now() < ready_deadline => {
                    log::debug!("[browser-pip] 窗口仍在创建,等待 HWND 就绪: {e}");
                    tokio::time::sleep(Duration::from_millis(50)).await;
                }
                Err(e) => {
                    log::debug!("[browser-pip] 窗口 3 秒内仍未就绪,本次点击退回停靠监看: {e}");
                    return Err(format!("画中画窗口尚未就绪: {e}"));
                }
            }
        }
        if show {
            show_pip_window_without_activating(&existing)?;
        }
        return Ok(());
    }

    let open_count = app
        .webview_windows()
        .keys()
        .filter(|name| is_pip_window_label(name))
        .count();
    if open_count >= AI_PIP_MAX_WINDOWS {
        return Err(format!("最多同时监看 {AI_PIP_MAX_WINDOWS} 个会话"));
    }

    let open_scale = main.scale_factor().unwrap_or(1.0);
    let (pip_width, pip_height) = pip_default_size(&main);
    let (x, y) = pip_open_position(&app, &label, pip_width, pip_height);
    let saved_size = geometry_for(&label).size;
    let build_app = app.clone();
    let build_session = session_id.clone();
    let build_label = label.clone();
    let build_script = token_script.clone();
    let build_url = url.clone();
    let build_title = pip_window_title(&session_id);
    let build_started = Instant::now();

    // WebView2 控制器必须在 UI 线程创建;从 async 命令线程直接 build 会报
    // HRESULT(0x8007139F) "Expecting object to be local"(2026-11-25 真机实测,
    // 同进程连 admin 窗也一并失败)。`run_on_main_thread` 只排队、不阻塞调用方,
    // 所以命令可立刻返回;真正的失败走 `browser-pip://failed` 回主窗,不静默。
    tauri::async_runtime::spawn(async move {
        let create_app = build_app.clone();
        let _ = build_app.run_on_main_thread(move || {
            let result = (|| -> Result<(), String> {
                if create_app.get_webview_window(&build_label).is_some() {
                    return Ok(());
                }
                // 建窗前记下前台，build 自身可能激活一次；装完 NOACTIVATE 后还原。
                #[cfg(target_os = "windows")]
                let previous_foreground =
                    unsafe { windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow() };
                let mut builder = WebviewWindowBuilder::new(
                    &create_app,
                    build_label.as_str(),
                    WebviewUrl::External(build_url),
                );
                if let Some(dir) = pip_profile_dir(&create_app) {
                    builder = builder.data_directory(dir);
                } else {
                    log::warn!("[browser-pip] 取画中画 profile 目录失败,回退默认目录");
                }
                // 仅本地取证用:设置 IHUI_PIP_DEBUG_PORT 后,画中画自己的 WebView2 环境
                // 才开 CDP;生产不设该变量,不改变任何行为。
                if let Ok(port) = std::env::var("IHUI_PIP_DEBUG_PORT") {
                    if port.chars().all(|c| c.is_ascii_digit()) && !port.is_empty() {
                        builder = builder
                            .additional_browser_args(&format!("--remote-debugging-port={port}"));
                    }
                }
                let win = builder
                    .title(build_title.as_str())
                .inner_size(pip_width, pip_height)
                .min_inner_size(pip_width, pip_height)
                .position(x as f64 / open_scale, y as f64 / open_scale)
                .resizable(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .focused(false)
                .decorations(false)
                .shadow(true)
                .visible(show)
                .initialization_script(&build_script)
                .build()
                .map_err(|e| format!("打开 AI 画中画窗口失败: {e}"))?;

                // build 默认 visible(true)；预建窗显式 visible(false)，不闪屏。
                if show {
                    win.show()
                        .map_err(|e| format!("显示 AI 画中画窗口失败: {e}"))?;
                }
                apply_pip_window_styles(&win, show)?;
                if show {
                    show_pip_window_without_activating(&win)?;
                    apply_pip_window_styles(&win, true)?;
                }
                #[cfg(target_os = "windows")]
                if !previous_foreground.0.is_null() {
                    // SAFETY: 句柄来自建窗之前的前台窗口;只做一次前台还原。
                    unsafe {
                        let _ = windows::Win32::UI::WindowsAndMessaging::SetForegroundWindow(
                            previous_foreground,
                        );
                    }
                }

                // builder 按逻辑像素建窗，150% DPI 下 WebView2 初始化还会再触发
                // 一次 DPI 换算。这里在 show 之后用物理像素把上次的内尺寸和位置
                // 再落一次，保证拖多大、关掉重开就还是多大。
                if let Some((saved_w, saved_h)) = saved_size {
                    let _ = win.set_size(tauri::PhysicalSize::new(saved_w, saved_h));
                }
                let _ = win.set_position(tauri::PhysicalPosition::new(x, y));
                // builder 的 .title 在本机被外壳窗控标题覆盖成「智汇AI」,
                // show 之后再落一次，任务栏/Alt-Tab 才认得出是监看窗。
                let _ = win.set_title(&build_title);
                #[cfg(target_os = "windows")]
                if let Ok(hwnd) = win.hwnd() {
                    use windows::core::HSTRING;
                    use windows::Win32::Foundation::HWND;
                    use windows::Win32::UI::WindowsAndMessaging::SetWindowTextW;
                    // SAFETY: hwnd 来自刚创建的本窗口，调用在主线程;
                    // 仅写标题文本，不持有句柄跨线程。
                    unsafe {
                        let _ = SetWindowTextW(HWND(hwnd.0), &HSTRING::from(build_title.as_str()));
                    }
                }

                // 关窗/拖拽即记几何;下次同会话打开沿用,多窗之间互不覆盖。
                let win_ev = win.clone();
                let closed_session = build_session.clone();
                win.on_window_event(move |event| {
                    if matches!(
                        event,
                        tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_)
                    ) {
                        remember_pip_geometry(&win_ev);
                        return;
                    }
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        remember_pip_geometry(&win_ev);
                        let _ = win_ev.emit_to(
                            "main",
                            "browser-pip://closed",
                            BrowserPipClosed {
                                session_id: closed_session.clone(),
                            },
                        );
                    }
                });
                log::info!(
                    "[browser-pip] {} AI 画中画监看窗 session={build_session} label={build_label} build_ms={}",
                    if show { "打开" } else { "预建" },
                    build_started.elapsed().as_millis()
                );
                Ok(())
            })();
            if let Err(error) = result {
                log::error!("[browser-pip] {error}");
                let _ = create_app.emit_to("main", "browser-pip://failed", error);
            }
        });
    });
    Ok(())
}

/// 收起/展开当前 AI 画中画窗。命令由监看窗页面自己调用,`window` 由 Tauri
/// 注入当前 WebviewWindow;多窗后不能再从全局 label 找“那一个”窗口。
#[tauri::command]
pub fn set_browser_pip_collapsed(window: WebviewWindow, collapsed: bool) -> Result<bool, String> {
    let label = window.label().to_string();
    if !is_pip_window_label(&label) {
        return Err("当前窗口不是 AI 画中画监看窗".to_string());
    }
    let win = window;
    let scale = win.scale_factor().unwrap_or(1.0);
    let (default_w, default_h) = pip_default_size(&win);
    let min_w = (default_w * scale).round() as u32;
    let min_h = (default_h * scale).round() as u32;
    let collapsed_h = (AI_PIP_COLLAPSED_HEIGHT * scale).round() as u32;

    if collapsed {
        if geometry_for(&label).collapsed {
            return Ok(true);
        }
        // 最大化态先还原,否则收起会把整屏宽度带进标题条;等待窗口管理器
        // 完成还原后再记正常几何。80ms 只在这一条用户点击路径上,不阻塞常驻循环。
        if win.is_maximized().unwrap_or(false) {
            let _ = win.unmaximize();
            std::thread::sleep(std::time::Duration::from_millis(80));
        }
        // 先按完整窗记一次几何,再打开收起标记,后续 Resized 不会覆盖它。
        remember_pip_geometry(&win);
        let inner = win
            .inner_size()
            .map_err(|e| format!("读取画中画窗尺寸失败: {e}"))?;
        // 以已记住的正常宽度为准:即使 unmaximize 尚未落到 inner_size,
        // 也不会把整屏宽度写进 32px 标题条。
        let collapsed_width = geometry_for(&label)
            .size
            .map(|size| size.0)
            .unwrap_or(inner.width);
        win.set_resizable(false)
            .map_err(|e| format!("锁定画中画窗缩放失败: {e}"))?;
        update_geometry(&label, |geometry| geometry.collapsed = true);
        let result = (|| -> Result<(), String> {
            win.set_min_size(Some(tauri::PhysicalSize::new(min_w, collapsed_h)))
                .map_err(|e| format!("设置收起最小尺寸失败: {e}"))?;
            // set_size 设的是内容区尺寸;用 inner_size 保住宽度,不把阴影边框
            // 也当成内容再算一遍,否则收起时宽度会莫名多出 20 多像素。
            win.set_size(tauri::PhysicalSize::new(collapsed_width, collapsed_h))
                .map_err(|e| format!("收起画中画窗失败: {e}"))?;
            Ok(())
        })();
        if let Err(error) = result {
            update_geometry(&label, |geometry| geometry.collapsed = false);
            let _ = win.set_resizable(true);
            return Err(error);
        }
        return Ok(true);
    }

    if !geometry_for(&label).collapsed {
        return Ok(false);
    }
    update_geometry(&label, |geometry| geometry.collapsed = false);
    win.set_min_size(Some(tauri::PhysicalSize::new(min_w, min_h)))
        .map_err(|e| format!("恢复画中画最小尺寸失败: {e}"))?;
    win.set_resizable(true)
        .map_err(|e| format!("恢复画中画缩放失败: {e}"))?;
    let (width, height) = geometry_for(&label).size.unwrap_or_else(|| {
        (
            (default_w * scale).round() as u32,
            (default_h * scale).round() as u32,
        )
    });
    win.set_size(tauri::PhysicalSize::new(width, height))
        .map_err(|e| format!("展开画中画窗失败: {e}"))?;
    if let Ok(pos) = win.outer_position() {
        let _ = win.set_position(tauri::PhysicalPosition::new(pos.x, pos.y));
    }
    Ok(false)
}

/// 切换当前窗口的收起/展开状态。页面按钮走这里而不是传布尔值:窗口若在
/// 收起态被刷新,前端 state 可能回到 false,传 false 会把「已收起」误判成
/// 「无需收起」。
#[tauri::command]
pub fn toggle_browser_pip_collapsed(window: WebviewWindow) -> Result<bool, String> {
    let label = window.label().to_string();
    let current = geometry_for(&label).collapsed;
    set_browser_pip_collapsed(window, !current)
}

/// 关闭 AI 画中画窗。传 `session_id` 只关对应会话;不传则关闭全部监看窗。
#[tauri::command]
pub fn close_browser_pip_window(
    app: AppHandle,
    session_id: Option<String>,
    only_hidden: Option<bool>,
) -> Result<(), String> {
    let only_hidden = only_hidden.unwrap_or(false);
    if let Some(session_id) = session_id {
        validate_pip_session(&session_id)?;
        if let Some(win) = app.get_webview_window(&pip_window_label(&session_id)) {
            if !only_hidden || !win.is_visible().unwrap_or(false) {
                win.close()
                    .map_err(|e| format!("关闭 AI 画中画窗口失败: {e}"))?;
            }
        }
        return Ok(());
    }
    let labels: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|label| is_pip_window_label(label))
        .cloned()
        .collect();
    for label in labels {
        if let Some(win) = app.get_webview_window(&label) {
            if only_hidden && win.is_visible().unwrap_or(false) {
                continue;
            }
            let _ = win.close();
        }
    }
    Ok(())
}

/// 一键接管:把主窗从最小化/后台拉回前台并聚焦,把当前会话的 url/title
/// 交给主窗定位/重建 CDP tab,最后关掉该会话的监看窗(其他监看窗不动)。
///
/// 这条命令必须在 Rust 侧完成窗口聚焦与事件投递:
/// 监看窗是远程 origin,若改由页面 `getAllWindows().setFocus()` 去做,
/// 会同时受 `core:window:allow-get-all-windows` 与 event 权限约束,失败时
/// 只剩 `window.close()`,主窗仍在后台 —— 用户点「接管」等于没接管。
#[tauri::command]
pub async fn handover_browser_pip_window(
    app: AppHandle,
    session_id: String,
    url: String,
    title: String,
) -> Result<(), String> {
    validate_pip_session(&session_id)?;
    if url.len() > 4096 {
        return Err("页面 URL 过长".to_string());
    }
    if !url.is_empty() {
        let parsed = Url::parse(&url).map_err(|e| format!("页面 URL 非法: {e}"))?;
        if !matches!(parsed.scheme(), "http" | "https") {
            return Err(format!("页面 URL 不是 http(s): {}", parsed.scheme()));
        }
    }
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在".to_string())?;
    let _ = main.unminimize();
    let _ = main.show();
    main.set_focus()
        .map_err(|e| format!("聚焦主窗口失败: {e}"))?;
    app.emit_to(
        "main",
        "browser-pip://handover",
        BrowserPipHandover {
            session_id: session_id.clone(),
            url,
            title,
        },
    )
    .map_err(|e| format!("投递接管事件失败: {e}"))?;
    if let Some(win) = app.get_webview_window(&pip_window_label(&session_id)) {
        let _ = win.close();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pip_label_is_per_session() {
        assert_eq!(pip_window_label("sess-01"), "ai-browser-pip-sess-01");
        assert!(is_pip_window_label("ai-browser-pip-sess-01"));
        assert!(is_pip_window_label("ai-browser-pip"));
        assert!(!is_pip_window_label("main"));
        assert!(!is_pip_window_label("ai-browser-pipx"));
    }

    #[test]
    fn pip_url_keeps_origin_and_encodes_session() {
        let main = Url::parse("https://aizhs.top/chat?x=1").expect("main url");
        let url = browser_pip_url(&main, "sess-01_ab").expect("pip url");
        assert_eq!(url.scheme(), "https");
        assert_eq!(url.host_str(), Some("aizhs.top"));
        assert_eq!(url.path(), "/browser-pip");
        assert_eq!(
            url.query_pairs()
                .find(|(k, _)| k == "session")
                .map(|(_, v)| v.into_owned()),
            Some("sess-01_ab".to_string())
        );
    }

    #[test]
    fn pip_url_keeps_non_default_port() {
        let main = Url::parse("http://localhost:8801/chat").expect("main url");
        let url = browser_pip_url(&main, "abc").expect("pip url");
        assert_eq!(url.port(), Some(8801));
        assert_eq!(
            url.as_str(),
            "http://localhost:8801/browser-pip?session=abc"
        );
    }

    #[test]
    fn pip_url_rejects_bad_session_and_scheme() {
        let main = Url::parse("https://aizhs.top/").expect("main url");
        assert!(browser_pip_url(&main, "").is_err());
        assert!(browser_pip_url(&main, "a/b").is_err());
        assert!(browser_pip_url(&main, "a b").is_err());
        let file = Url::parse("file:///C:/x.html").expect("file url");
        assert!(browser_pip_url(&file, "abc").is_err());
    }

    #[test]
    fn token_script_only_injects_on_expected_origin() {
        let script = pip_token_script("secret-token", "https://aizhs.top").expect("script");
        assert!(script.contains("window.location.origin"));
        assert!(script.contains("\"https://aizhs.top\""));
        assert!(script.contains("\"secret-token\""));
        assert!(!script.contains("localStorage"));
    }

    #[test]
    fn pip_size_clamps_to_dpi_physical_minimum() {
        assert_eq!(clamp_pip_pixels(520, 390, 1.0), (520, 390));
        assert_eq!(clamp_pip_pixels(200, 120, 1.0), (320, 200));
        assert_eq!(clamp_pip_pixels(200, 120, 1.5), (480, 300));
        assert_eq!(clamp_pip_pixels(900, 600, 1.5), (900, 600));
        // DPI 读不到时按 100% 处理,不能让 NaN 变成非法尺寸。
        assert_eq!(clamp_pip_pixels(200, 120, f64::NAN), (320, 200));
    }

    #[test]
    fn pip_default_size_is_quarter_of_main_area() {
        // 1/4 屏按面积算:宽高各 50%;主窗最大化时就是整屏 1/4。
        assert_eq!(pip_quarter_size(2032.0, 1355.0), (1016.0, 678.0));
        assert_eq!(pip_quarter_size(1920.0, 1080.0), (960.0, 540.0));
        assert_eq!(pip_quarter_size(1115.0, 729.0), (558.0, 365.0));
        assert_eq!(pip_quarter_size(800.0, 600.0), (400.0, 300.0));
        // 小屏托底到可读最小值,不能缩成指甲盖。
        assert_eq!(pip_quarter_size(600.0, 400.0), (320.0, 200.0));
    }

    #[test]
    fn pip_open_position_defaults_to_bottom_right_and_cascades_up() {
        // 1920×1080 主窗、(100,100) 起点、100% DPI、1/4 屏 960×540:
        // 首窗右下角留 24px 边距。
        assert_eq!(
            pip_open_position_for(100, 100, 1920, 1080, 960.0, 540.0, 1.0, 0),
            (1036, 616)
        );
        // 第二个窗从首窗位置向上错开 40px,不再向右下越界。
        assert_eq!(
            pip_open_position_for(100, 100, 1920, 1080, 960.0, 540.0, 1.0, 1),
            (1036, 576)
        );
        // HiDPI 下窗口物理像素变大,仍以主窗右下角为锚点。
        assert_eq!(
            pip_open_position_for(0, 0, 2560, 1440, 1280.0, 720.0, 1.5, 0),
            (604, 324)
        );
    }

    #[test]
    fn pip_open_position_never_leaves_main_window_top() {
        // 主窗矮于一个窗口 + 多重级联时,夹到主窗顶部 24px 处,不能跑到屏幕外。
        assert_eq!(
            pip_open_position_for(0, 0, 800, 300, 480.0, 270.0, 1.0, 3),
            (296, 24)
        );
        // 主窗 x 太窄时也不允许负坐标。
        assert_eq!(
            pip_open_position_for(0, 0, 400, 900, 480.0, 270.0, 1.0, 0).0,
            0
        );
    }

    #[test]
    fn handover_event_uses_camel_case_session_id() {
        // 前端监听读 payload.sessionId;Rust 默认 snake_case 曾让整条接管链路
        // 只聚焦主窗、不切 CDP tab(2026-11-25 真机复现)。
        let payload = BrowserPipHandover {
            session_id: "sess-01".to_string(),
            url: "https://example.com/".to_string(),
            title: "Example Domain".to_string(),
        };
        let json = serde_json::to_value(&payload).expect("serialize handover");
        assert_eq!(
            json.get("sessionId").and_then(|v| v.as_str()),
            Some("sess-01")
        );
        assert!(json.get("session_id").is_none());
        assert_eq!(
            json.get("url").and_then(|v| v.as_str()),
            Some("https://example.com/")
        );
    }

    #[test]
    fn closed_event_carries_session_id() {
        let payload = BrowserPipClosed {
            session_id: "sess-02".to_string(),
        };
        let json = serde_json::to_value(&payload).expect("serialize closed");
        assert_eq!(
            json.get("sessionId").and_then(|v| v.as_str()),
            Some("sess-02")
        );
        assert!(json.get("session_id").is_none());
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
