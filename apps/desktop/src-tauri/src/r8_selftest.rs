// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! R8 真机自检:创建真实 Tauri 画中画窗 → 收起 → 展开 → 关闭 → 重开,
//! 记录每一步的真实 `inner_size`。只有显式 `--features r8-selftest` 才编译。
//!
//! 为什么不是单测:窗口尺寸/DPI/收起态几何只有真实 WebView2 窗口才成立;
//! mock runtime 的 `set_size` 是空实现(tauri 2.11 mock_runtime.rs:649),
//! 拿它断言等于自欺。这里用真实窗口跑一遍,把读数写进 JSON 供账本引用。
//!
//! 真实登录态:从主窗 WebView2 的 httpOnly `auth_token` cookie 取 access token,
//! 列出/创建一个真实 Browser Hub 会话,再把该会话 ID + token 交给 PIP 窗。
//! 不依赖人工点击,也不使用假 token 冒充登录。

use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager, WebviewWindow};

const FALLBACK_SESSION: &str = "r8-selftest";
const FALLBACK_TOKEN: &str = "r8-selftest-token-not-a-real-credential";

fn pip_label(session: &str) -> String {
    format!("ai-browser-pip-{session}")
}

async fn wait_for_window(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
    for _ in 0..200 {
        if let Some(window) = app.get_webview_window(label) {
            return Ok(window);
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    Err(format!("等待窗口 {label} 超时"))
}

async fn wait_for_window_gone(app: &AppHandle, label: &str) -> Result<(), String> {
    for _ in 0..200 {
        if app.get_webview_window(label).is_none() {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    Err(format!("窗口 {label} 关闭超时"))
}

fn size_of(window: &WebviewWindow) -> Result<(u32, u32), String> {
    window
        .inner_size()
        .map(|size| (size.width, size.height))
        .map_err(|e| format!("读取 inner_size 失败: {e}"))
}

async fn wait_for_main_url(app: &AppHandle) -> Result<tauri::Url, String> {
    for _ in 0..200 {
        if let Some(main) = app.get_webview_window("main") {
            if let Ok(url) = main.url() {
                if matches!(url.scheme(), "http" | "https") {
                    return Ok(url);
                }
            }
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    Err("主窗口 URL 未在超时内变为 http(s)".to_string())
}

async fn read_auth_cookies(app: &AppHandle) -> Result<(String, String, String), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在".to_string())?;
    // Tauri 文档:Windows 上 cookies() 在同步命令/事件处理器里会死锁,
    // 必须走 async 命令或独立线程 —— 本函数由 async_runtime 调用。
    let cookies = main
        .cookies()
        .map_err(|e| format!("读取主窗 cookie 失败: {e}"))?;
    let access = cookies
        .iter()
        .find(|cookie| cookie.name() == "auth_token")
        .map(|cookie| cookie.value().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "主窗没有 auth_token cookie(当前不是真实登录态)".to_string())?;
    let refresh = cookies
        .iter()
        .find(|cookie| cookie.name() == "refresh_token")
        .map(|cookie| cookie.value().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_default();
    let origin = main
        .url()
        .map_err(|e| format!("读取主窗 URL 失败: {e}"))?
        .origin()
        .ascii_serialization();
    Ok((origin, access, refresh))
}

async fn refresh_access_token(origin: &str, refresh: &str) -> Result<String, String> {
    if refresh.is_empty() {
        return Err("没有 refresh_token cookie,无法刷新".to_string());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("构建 HTTP client 失败: {e}"))?;
    let url = format!("{origin}/api/auth/refresh");
    let data = api_json(
        &client,
        reqwest::Method::POST,
        &url,
        "",
        Some(json!({ "refreshToken": refresh })),
    )
    .await?;
    data.get("accessToken")
        .or_else(|| data.get("access_token"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| format!("刷新响应缺少 accessToken: {data}"))
}

async fn api_json(
    client: &reqwest::Client,
    method: reqwest::Method,
    url: &str,
    token: &str,
    body: Option<Value>,
) -> Result<Value, String> {
    let mut request = client.request(method, url).header("Accept", "application/json");
    if !token.is_empty() {
        request = request.bearer_auth(token);
    }
    if let Some(body) = body {
        request = request
            .header("Content-Type", "application/json")
            .body(serde_json::to_string(&body).map_err(|e| format!("序列化请求体失败: {e}"))?);
    }
    let response = request
        .send()
        .await
        .map_err(|e| format!("请求 {url} 失败: {e}"))?;
    let status = response.status();
    let raw = response
        .text()
        .await
        .map_err(|e| format!("读取 {url} 响应失败: {e}"))?;
    let payload: Value = serde_json::from_str(&raw)
        .map_err(|e| format!("解析 {url} 响应失败: {e} raw={raw}"))?;
    if !status.is_success() || payload.get("code").and_then(Value::as_i64) != Some(0) {
        return Err(format!(
            "{url} 返回异常 status={status} payload={payload}"
        ));
    }
    Ok(payload.get("data").cloned().unwrap_or(Value::Null))
}

/// 用真实登录 cookie 列出或创建一个 Browser Hub 会话。
/// access token 过期时用 refresh_token 轮换一次再试。
async fn real_session(app: &AppHandle) -> Result<(String, String, String), String> {
    let origin = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在".to_string())?
        .url()
        .map_err(|e| format!("读取主窗 URL 失败: {e}"))?
        .origin()
        .ascii_serialization();
    let injected = std::env::var("IHUI_R8_ACCESS_TOKEN")
        .ok()
        .filter(|value| !value.trim().is_empty());
    let (mut token, refresh) = match injected {
        Some(token) => (token, String::new()),
        None => {
            let (_, access, refresh) = read_auth_cookies(app).await?;
            (access, refresh)
        }
    };
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("构建 HTTP client 失败: {e}"))?;
    let list_url = format!("{origin}/api/browser/sessions");

    let list = match api_json(&client, reqwest::Method::GET, &list_url, &token, None).await {
        Ok(list) => list,
        Err(error) => {
            log::warn!("[r8-selftest] access token 直连失败,尝试 refresh: {error}");
            token = refresh_access_token(&origin, &refresh).await?;
            api_json(&client, reqwest::Method::GET, &list_url, &token, None).await?
        }
    };

    let session = list
        .get("session_ids")
        .and_then(Value::as_array)
        .and_then(|ids| ids.iter().find_map(Value::as_str))
        .map(str::to_string);
    if let Some(session) = session {
        return Ok((origin, token, session));
    }
    let created = api_json(
        &client,
        reqwest::Method::POST,
        &list_url,
        &token,
        Some(json!({ "url": format!("{origin}/") })),
    )
    .await?;
    let session = created
        .get("session_id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| format!("创建 Browser Hub 会话未返回 session_id: {created}"))?;
    Ok((origin, token, session))
}

async fn close_real_session(origin: &str, token: &str, session: &str) {
    let client = reqwest::Client::new();
    let url = format!("{origin}/api/browser/sessions/{session}");
    let _ = api_json(&client, reqwest::Method::DELETE, &url, token, None).await;
}

/// 返回一次完整 R8 的读数;失败返回 Err(调用方写盘并 exit 1)。
pub async fn run(app: AppHandle) -> Result<Value, String> {
    let main_url = wait_for_main_url(&app).await?;

    let (origin, session, token, auth_mode) = match real_session(&app).await {
        Ok((origin, token, session)) => (origin, session, token, "real-login"),
        Err(error) => {
            log::warn!("[r8-selftest] 真实登录态不可用,退回几何自检: {error}");
            (main_url.origin().ascii_serialization(), FALLBACK_SESSION.to_string(), FALLBACK_TOKEN.to_string(), "fallback")
        }
    };
    let label = pip_label(&session);

    crate::browser_pip_window::open_browser_pip_window(
        app.clone(),
        session.clone(),
        token.clone(),
    )
    .await?;
    let window = wait_for_window(&app, &label).await?;
    tokio::time::sleep(Duration::from_millis(400)).await;
    let before = size_of(&window)?;
    let scale = window.scale_factor().unwrap_or(1.0);

    crate::browser_pip_window::set_browser_pip_collapsed(window.clone(), true)?;
    tokio::time::sleep(Duration::from_millis(500)).await;
    let collapsed = size_of(&window)?;

    crate::browser_pip_window::set_browser_pip_collapsed(window.clone(), false)?;
    tokio::time::sleep(Duration::from_millis(500)).await;
    let expanded = size_of(&window)?;

    // 收起态关闭,再重开:必须回到完整高度,不能以 32px 状态栏复现。
    crate::browser_pip_window::set_browser_pip_collapsed(window.clone(), true)?;
    tokio::time::sleep(Duration::from_millis(300)).await;
    crate::browser_pip_window::close_browser_pip_window(app.clone(), Some(session.clone()))?;
    wait_for_window_gone(&app, &label).await?;

    crate::browser_pip_window::open_browser_pip_window(
        app.clone(),
        session.clone(),
        token.clone(),
    )
    .await?;
    let reopened_window = wait_for_window(&app, &label).await?;
    tokio::time::sleep(Duration::from_millis(500)).await;
    let reopened = size_of(&reopened_window)?;

    let collapsed_limit = (40.0 * scale).round() as u32;
    let full_min = (200.0 * scale).round() as u32;
    if collapsed.1 > collapsed_limit {
        return Err(format!(
            "收起后高度 {} 超过上限 {} (scale={scale})",
            collapsed.1, collapsed_limit
        ));
    }
    if expanded.1 < full_min {
        return Err(format!(
            "展开后高度 {} 小于下限 {} (scale={scale})",
            expanded.1, full_min
        ));
    }
    if reopened.1 < full_min {
        return Err(format!(
            "收起态重开后高度 {} 小于下限 {} (scale={scale})",
            reopened.1, full_min
        ));
    }
    let height_delta = (i64::from(reopened.1) - i64::from(expanded.1)).unsigned_abs();
    if height_delta > 2 {
        return Err(format!(
            "重开高度 {} 与展开高度 {} 相差 {}px",
            reopened.1, expanded.1, height_delta
        ));
    }

    let _ = crate::browser_pip_window::close_browser_pip_window(
        app.clone(),
        Some(session.clone()),
    );
    if auth_mode == "real-login" {
        close_real_session(&origin, &token, &session).await;
    }

    Ok(json!({
        "session": session,
        "authMode": auth_mode,
        "origin": origin,
        "scaleFactor": scale,
        "before": { "width": before.0, "height": before.1 },
        "collapsed": { "width": collapsed.0, "height": collapsed.1 },
        "expanded": { "width": expanded.0, "height": expanded.1 },
        "reopened": { "width": reopened.0, "height": reopened.1 },
        "heightDelta": height_delta,
        "ok": true,
    }))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
