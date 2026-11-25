// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 桌面端 AI 画中画监看窗 —— 2026-11-25 立。
//!
//! 和 `embedded_browser` 的原生小窗不是同一件事:
//! - 内嵌浏览器小窗监控的是**本地浏览器页面**,只读盾/接管/几何记忆已在其模块实现;
//! - 这里开的是**独立 Tauri 窗口**,加载 Web 端 `/browser-pip?session=<id>` 页面,
//!   由该页面连 Browser Hub WS 收帧、任务条、检查点和 phase。这样桌面端也能拿到
//!   文章里“AI 跑网页时的只读监看 + 目标/进度/检查点/继续”的完整体验,而不是把
//!   Browser Hub 的假任务状态硬塞进本地浏览器小窗。
//!
//! 窗口契约:420×280 起、最小 320×200、置顶、可缩放、不进任务栏、打开不抢焦点。

use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindowBuilder};

/// 全仓唯一的 AI 画中画窗口 label。
pub const AI_PIP_WINDOW_LABEL: &str = "ai-browser-pip";
const AI_PIP_WIDTH: f64 = 420.0;
const AI_PIP_HEIGHT: f64 = 280.0;
const AI_PIP_MIN_WIDTH: f64 = 320.0;
const AI_PIP_MIN_HEIGHT: f64 = 200.0;
const AI_PIP_MARGIN: f64 = 24.0;

/// 上次 AI 画中画窗口位置(逻辑坐标);窗口关闭时记,下次打开沿用。
static AI_PIP_LAST_POS: Mutex<Option<(f64, f64)>> = Mutex::new(None);

/// 由主窗口 URL 生成 `/browser-pip?session=...`,保留主站 origin(含端口)。
fn browser_pip_url(main: &Url, session_id: &str) -> Result<Url, String> {
    if session_id.is_empty() || session_id.len() > 128 {
        return Err("会话 ID 长度非法".to_string());
    }
    if !session_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("会话 ID 含非法字符".to_string());
    }
    if !matches!(main.scheme(), "http" | "https") {
        return Err(format!("主窗口不是 http(s) 页面: {}", main.scheme()));
    }
    let origin = main.origin().ascii_serialization();
    let mut url = Url::parse(&format!("{origin}/browser-pip"))
        .map_err(|e| format!("画中画页面 URL 非法: {e}"))?;
    url.query_pairs_mut().append_pair("session", session_id);
    Ok(url)
}

/// 主窗口右上角内侧;拿不到主窗几何时回落到屏幕左上。
fn pip_open_position(app: &AppHandle) -> (f64, f64) {
    if let Some(last) = AI_PIP_LAST_POS.lock().ok().and_then(|g| *g) {
        return last;
    }
    let Some(main) = app.get_webview_window("main") else {
        return (AI_PIP_MARGIN, AI_PIP_MARGIN);
    };
    let scale = main.scale_factor().unwrap_or(1.0);
    let pos = main.outer_position().unwrap_or_default();
    let size = main.outer_size().unwrap_or_default();
    let x = (pos.x as f64 + size.width as f64 - (AI_PIP_WIDTH + AI_PIP_MARGIN) * scale) / scale;
    let y = (pos.y as f64 + AI_PIP_MARGIN * scale) / scale;
    (x.max(0.0), y.max(0.0))
}

/// 打开 AI 画中画窗;同 label 已存在则先关旧窗,避免叠窗。
///
/// `access_token` 由主窗 IPC 传入,只注入新窗口的 `window.__IHUI_PIP_TOKEN__`,
/// 不拼进 URL、不落盘、不写日志。新窗口页面拿它连 Browser Hub WS。
#[tauri::command]
pub fn open_browser_pip_window(
    app: AppHandle,
    session_id: String,
    access_token: String,
) -> Result<(), String> {
    if access_token.is_empty() || access_token.len() > 4096 {
        return Err("访问令牌长度非法".to_string());
    }
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在".to_string())?;
    let main_url = main.url().map_err(|e| format!("读取主窗口 URL 失败: {e}"))?;
    let url = browser_pip_url(&main_url, &session_id)?;
    let token_script = format!(
        "window.__IHUI_PIP_TOKEN__ = {};",
        serde_json::to_string(&access_token).map_err(|e| format!("令牌序列化失败: {e}"))?
    );

    if let Some(old) = app.get_webview_window(AI_PIP_WINDOW_LABEL) {
        let _ = old.close();
    }
    let (x, y) = pip_open_position(&app);
    let win = WebviewWindowBuilder::new(&app, AI_PIP_WINDOW_LABEL, WebviewUrl::External(url))
        .title("AI 画中画监看")
        .inner_size(AI_PIP_WIDTH, AI_PIP_HEIGHT)
        .min_inner_size(AI_PIP_MIN_WIDTH, AI_PIP_MIN_HEIGHT)
        .position(x, y)
        .resizable(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .decorations(true)
        .initialization_script(&token_script)
        .build()
        .map_err(|e| format!("打开 AI 画中画窗口失败: {e}"))?;

    // 关窗即记位置;下次打开沿用,避免每次都回到主窗右上角。
    let win_ev = win.clone();
    win.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            if let Ok(pos) = win_ev.outer_position() {
                let scale = win_ev.scale_factor().unwrap_or(1.0);
                if let Ok(mut guard) = AI_PIP_LAST_POS.lock() {
                    *guard = Some((pos.x as f64 / scale, pos.y as f64 / scale));
                }
            }
            let _ = win_ev.emit_to("main", "browser-pip://closed", ());
        }
    });
    log::info!("[browser-pip] 打开 AI 画中画监看窗 session={session_id}");
    Ok(())
}

/// 关闭 AI 画中画窗(供主窗按钮切换用;窗口内「接管」也会自己关)。
#[tauri::command]
pub fn close_browser_pip_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(AI_PIP_WINDOW_LABEL) {
        win.close().map_err(|e| format!("关闭 AI 画中画窗口失败: {e}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

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
        assert_eq!(url.as_str(), "http://localhost:8801/browser-pip?session=abc");
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
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
