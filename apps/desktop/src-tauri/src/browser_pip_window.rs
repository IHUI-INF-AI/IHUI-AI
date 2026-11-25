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
/// 上次 AI 画中画窗口尺寸(逻辑坐标);同样关闭时记,下次打开沿用。
static AI_PIP_LAST_SIZE: Mutex<Option<(f64, f64)>> = Mutex::new(None);

/// 上次尺寸不能把窗口缩到看不了;下限仍是 320×200。
fn clamp_pip_size(last: Option<(f64, f64)>) -> (f64, f64) {
    let Some((width, height)) = last else {
        return (AI_PIP_WIDTH, AI_PIP_HEIGHT);
    };
    if !width.is_finite() || !height.is_finite() {
        return (AI_PIP_WIDTH, AI_PIP_HEIGHT);
    }
    (width.max(AI_PIP_MIN_WIDTH), height.max(AI_PIP_MIN_HEIGHT))
}

fn pip_open_size() -> (f64, f64) {
    clamp_pip_size(AI_PIP_LAST_SIZE.lock().ok().and_then(|guard| *guard))
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

/// 只把 token 注入预期 origin 的页面。`initialization_script` 会在每次页面
/// 加载时执行;若误导航到外部站点,不能让 token 跟着脚本落到别人 origin。
fn pip_token_script(access_token: &str, origin: &str) -> Result<String, String> {
    let token = serde_json::to_string(access_token).map_err(|e| format!("令牌序列化失败: {e}"))?;
    let origin = serde_json::to_string(origin).map_err(|e| format!("origin 序列化失败: {e}"))?;
    Ok(format!(
        "(() => {{ if (window.location.origin === {origin}) {{ window.__IHUI_PIP_TOKEN__ = {token}; }} }})();"
    ))
}

/// 打开 AI 画中画窗;同 label 已存在则先关旧窗,避免叠窗。
///
/// `access_token` 由主窗 IPC 传入,只注入新窗口的 `window.__IHUI_PIP_TOKEN__`,
/// 不拼进 URL、不落盘、不写日志。新窗口页面拿它连 Browser Hub WS。
#[tauri::command]
pub async fn open_browser_pip_window(
    app: AppHandle,
    session_id: String,
    access_token: String,
) -> Result<(), String> {    if access_token.is_empty() || access_token.len() > 4096 {
        return Err("访问令牌长度非法".to_string());
    }
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在".to_string())?;
    let main_url = main
        .url()
        .map_err(|e| format!("读取主窗口 URL 失败: {e}"))?;
    let url = browser_pip_url(&main_url, &session_id)?;
    let token_script = pip_token_script(&access_token, &url.origin().ascii_serialization())?;

    let (x, y) = pip_open_position(&app);
    let build_app = app.clone();
    let build_session = session_id.clone();
    let build_script = token_script.clone();
    // WebView2 控制器必须在 UI 线程创建;从 async 命令线程直接 build 会报
    // HRESULT(0x8007139F) "Expecting object to be local"(2026-11-25 真机实测,
    // 同进程连 admin 窗也一并失败)。`run_on_main_thread` 只排队、不阻塞调用方,
    // 所以命令可立刻返回;真正的失败走 `browser-pip://failed` 回主窗,不静默。
    //
    // 重复打开必须先等旧窗真正销毁:close() 只是把销毁排进事件循环,紧接着
    // build 同 label 会报 "a webview with label ai-browser-pip already exists"
    // (页面热更新/用户连点两次都会踩到)。这里先把关闭发出去,250ms 后在 UI
    // 线程重建 —— 让事件循环有机会处理 Destroyed,而不是在主线程 sleep 死等。
    if let Some(old) = app.get_webview_window(AI_PIP_WINDOW_LABEL) {
        let _ = old.close();
    }
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        let create_app = build_app.clone();
        let _ = build_app.run_on_main_thread(move || {
            let result = (|| -> Result<(), String> {
                if create_app.get_webview_window(AI_PIP_WINDOW_LABEL).is_some() {
                    return Err("旧画中画窗口尚未销毁,已放弃本次重建".to_string());
                }
                let (open_w, open_h) = pip_open_size();
                let win = WebviewWindowBuilder::new(
                    &create_app,
                    AI_PIP_WINDOW_LABEL,
                    WebviewUrl::External(url),
                )
                .title("AI 画中画监看")
                .inner_size(open_w, open_h)
                .min_inner_size(AI_PIP_MIN_WIDTH, AI_PIP_MIN_HEIGHT)
                .position(x, y)
                .resizable(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .focused(false)
                .decorations(true)
                .initialization_script(&build_script)
                .build()
                .map_err(|e| format!("打开 AI 画中画窗口失败: {e}"))?;
                win.show()
                    .map_err(|e| format!("显示 AI 画中画窗口失败: {e}"))?;
                // builder 的 .title 在本机被外壳的窗控标题覆盖成「智汇AI」,
                // show 之后再落一次,保证任务栏/Alt-Tab 里认得出这是监看窗。
                let _ = win.set_title("AI 画中画监看");

                // 关窗即记位置;下次打开沿用,避免每次都回到主窗右上角。
                let win_ev = win.clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        if let Ok(pos) = win_ev.outer_position() {
                            let scale = win_ev.scale_factor().unwrap_or(1.0);
                            if let Ok(mut guard) = AI_PIP_LAST_POS.lock() {
                                *guard = Some((pos.x as f64 / scale, pos.y as f64 / scale));
                            }
                            if let Ok(size) = win_ev.inner_size() {
                                let logical = (
                                    size.width as f64 / scale,
                                    size.height as f64 / scale,
                                );
                                if let Ok(mut guard) = AI_PIP_LAST_SIZE.lock() {
                                    *guard = Some(clamp_pip_size(Some(logical)));
                                }
                            }
                        }
                        let _ = win_ev.emit_to("main", "browser-pip://closed", ());
                    }
                });
                log::info!("[browser-pip] 打开 AI 画中画监看窗 session={build_session}");
                Ok(())
            })();
            if let Err(error) = result {
                log::error!("[browser-pip] {error}");
                let _ = create_app.emit_to("main", "browser-pip://failed", error);
                let _ = create_app.emit_to("main", "browser-pip://closed", ());
            }
        });
    });
    Ok(())
}

/// 关闭 AI 画中画窗(供主窗按钮切换用;窗口内「接管」也会自己关)。
#[tauri::command]
pub fn close_browser_pip_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(AI_PIP_WINDOW_LABEL) {
        win.close()
            .map_err(|e| format!("关闭 AI 画中画窗口失败: {e}"))?;
    }
    Ok(())
}

/// 一键接管:把主窗从最小化/后台拉回前台并聚焦,把当前会话的 url/title
/// 交给主窗定位/重建 CDP tab,最后关掉监看窗。
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
            session_id,
            url,
            title,
        },
    )
    .map_err(|e| format!("投递接管事件失败: {e}"))?;
    close_browser_pip_window(app)?;
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
    fn pip_size_defaults_and_clamps_to_minimum() {
        assert_eq!(clamp_pip_size(None), (AI_PIP_WIDTH, AI_PIP_HEIGHT));
        assert_eq!(clamp_pip_size(Some((520.0, 390.0))), (520.0, 390.0));
        assert_eq!(
            clamp_pip_size(Some((200.0, 120.0))),
            (AI_PIP_MIN_WIDTH, AI_PIP_MIN_HEIGHT)
        );
        assert_eq!(
            clamp_pip_size(Some((f64::NAN, 400.0))),
            (AI_PIP_WIDTH, AI_PIP_HEIGHT)
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
        assert_eq!(json.get("sessionId").and_then(|v| v.as_str()), Some("sess-01"));
        assert!(json.get("session_id").is_none());
        assert_eq!(
            json.get("url").and_then(|v| v.as_str()),
            Some("https://example.com/")
        );
    }
}

