// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! WorkBuddy「网页登录自动添加账号」(2026-10-12 立,普通用户零 token 体验)。
//!
//! 背景:WorkBuddy 桌面端 5.8+ 把 accessToken/refreshToken 包进 AES-256-GCM
//! 信封(密钥只在客户端进程内,第三方进程不可解 —— 2026-10-12 真机实证),
//! 普通 用户不懂 token/JWT,不能要求手动粘贴。本模块走**网页登录**路线:
//!
//! 1. `checkin_workbuddy_web_login_open`:弹一个内嵌 WebView 窗口加载
//!    https://www.workbuddy.cn/,用户像平常一样登录(手机号/扫码);
//! 2. `checkin_workbuddy_web_login_probe`:前端轮询 —— 从 WebView2 cookie jar
//!    读 workbuddy.cn 全量 Cookie(wry cookies_for_url,含 HttpOnly),再在
//!    Rust 侧直接 GET /console/accounts 验证登录态并取 uid/昵称;
//! 3. 验证通过 → 返回 {status:"ok", cookie, accounts},前端自动回填表单:
//!    jwt 字段=Cookie 串(加密落库复用现有机制),device_map.login_type="web"。
//!
//! 服务端契约(2026-10-12 asar 逆向实证):签到接口本域就有
//! /v2/billing/meter/daily-checkin 与 copilot.tencent.com 双网关同服务;
//! 网页版全 Cookie 认证(asar 原话「Web 端已由浏览器 Cookie 保持登录态」+
//! bundle credentials:"include")。Cookie 30 天滚动(refreshExpiresIn 2592000),
//! 过期由签到 401 → SessionDead 永久冷却 → 提示重新网页登录。
//!
//! 判据与执行分离:纯函数(cookie 拼接/响应解析)在此文件可单测,
//! `#[tauri::command]` 只做 AppHandle → 窗口 → HTTP 的转发。

use serde::Serialize;
use std::sync::OnceLock;
use tauri::webview::Cookie;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};

use crate::IpcError;

/// 登录窗口 label(前端 bridge 与窗口管理共用)。
pub const WB_WEB_LOGIN_LABEL: &str = "wb-web-login";
/// 网页版站点(登录入口)。
pub const WB_WEB_ORIGIN: &str = "https://www.workbuddy.cn";
/// /console/accounts 响应里取账号的 JSON 路径:data.accounts[]。
const ACCOUNTS_PATH: &str = "/console/accounts";
/// 轮询时把 cookie 换登录态的 HTTP 超时。
const PROBE_HTTP_TIMEOUT_SECS: u64 = 10;

// ---------------------------------------------------------------------------
// 纯函数(单测覆盖)
// ---------------------------------------------------------------------------

/// cookie jar → 请求头 Cookie 串("k=v; k2=v2")。空 jar 返回 None。
pub fn cookie_header_from_jar(cookies: &[Cookie<'static>]) -> Option<String> {
    let parts: Vec<String> = cookies
        .iter()
        .filter(|c| !c.name().trim().is_empty())
        .map(|c| format!("{}={}", c.name(), c.value()))
        .collect();
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("; "))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct WbWebAccount {
    pub uid: String,
    pub nickname: String,
}

/// 解析 /console/accounts 响应体 → 账号列表(data.accounts[],uid 必填,
/// nickname 是服务端明文;非 JSON / 结构不符返回空表)。
pub fn parse_accounts_body(body: &str) -> Vec<WbWebAccount> {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(body) else {
        return Vec::new();
    };
    let Some(list) = v.get("data").and_then(|d| d.get("accounts")).and_then(|a| a.as_array()) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for item in list {
        let Some(uid) = item
            .get("uid")
            .and_then(|u| u.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
        else {
            continue;
        };
        // nickname 服务端返回明文字符串;个别环境可能是 {$wbEncrypted} 信封 → 降级空串
        let nickname = item
            .get("nickname")
            .and_then(|n| n.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        out.push(WbWebAccount {
            uid: uid.to_string(),
            nickname,
        });
    }
    out
}

// ---------------------------------------------------------------------------
// 探测结果(前端契约)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum WebLoginProbe {
    /// 登录窗口未打开(前端引导先点「网页登录」)。
    NoWindow,
    /// 窗口在,但 cookie jar 还没有 workbuddy.cn 的任何 cookie(未登录/加载中)。
    NoCookie,
    /// 有 cookie 但服务端说未登录(登录中/会话失效)。
    NotLoggedIn,
    /// 验证通过:cookie + 账号齐全,前端可自动回填。
    Ok {
        cookie: String,
        accounts: Vec<WbWebAccount>,
    },
    /// 本地/网络错误。
    Error { message: String },
}

fn shared_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(PROBE_HTTP_TIMEOUT_SECS))
            .build()
            .expect("reqwest client build")
    })
}

// ---------------------------------------------------------------------------
// #[tauri::command] 薄胶水
// ---------------------------------------------------------------------------

/// 打开(或聚焦)WorkBuddy 网页登录窗口。
#[tauri::command]
pub fn checkin_workbuddy_web_login_open(app: AppHandle) -> Result<(), IpcError> {
    if let Some(win) = app.get_webview_window(WB_WEB_LOGIN_LABEL) {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        return Ok(());
    }
    let url: Url = format!("{WB_WEB_ORIGIN}/")
        .parse()
        .map_err(|e| IpcError::internal(format!("登录地址解析失败: {e}")))?;
    WebviewWindowBuilder::new(&app, WB_WEB_LOGIN_LABEL, WebviewUrl::External(url))
        .title("登录 WorkBuddy(登录后回到本窗口自动获取)")
        .inner_size(1080.0, 760.0)
        .build()
        .map_err(|e| IpcError::internal(format!("登录窗口创建失败: {e}")))?;
    Ok(())
}

/// 轮询探测:读 cookie jar → Rust 侧 GET /console/accounts 验证登录态。
#[tauri::command]
pub async fn checkin_workbuddy_web_login_probe(app: AppHandle) -> Result<WebLoginProbe, IpcError> {
    let Some(win) = app.get_webview_window(WB_WEB_LOGIN_LABEL) else {
        return Ok(WebLoginProbe::NoWindow);
    };
    let url = Url::parse(format!("{WB_WEB_ORIGIN}/").as_str())
        .map_err(|e| IpcError::internal(format!("URL 解析失败: {e}")))?;
    let cookies = win
        .cookies_for_url(url)
        .map_err(|e| IpcError::internal(format!("读取登录 Cookie 失败: {e}")))?;
    let Some(cookie_header) = cookie_header_from_jar(&cookies) else {
        return Ok(WebLoginProbe::NoCookie);
    };

    // cookie 在手 → 服务端验证登录态(带 Cookie 直调,与网页版同机制)
    let resp = shared_client()
        .get(format!("{WB_WEB_ORIGIN}{ACCOUNTS_PATH}"))
        .header("accept", "application/json")
        .header("cookie", &cookie_header)
        .header(
            "user-agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) IHUI-Desktop-Checkin",
        )
        .send()
        .await;
    let resp = match resp {
        Ok(r) => r,
        Err(e) => {
            return Ok(WebLoginProbe::Error {
                message: format!("登录态验证请求失败: {e}"),
            })
        }
    };
    match resp.status().as_u16() {
        200 => {
            let body = resp.text().await.unwrap_or_default();
            let accounts = parse_accounts_body(&body);
            if accounts.is_empty() {
                // 200 但解析不到账号:结构不符或登录态名存实亡
                return Ok(WebLoginProbe::NotLoggedIn);
            }
            Ok(WebLoginProbe::Ok {
                cookie: cookie_header,
                accounts,
            })
        }
        s if s == 401 || s == 403 => Ok(WebLoginProbe::NotLoggedIn),
        s => Ok(WebLoginProbe::Error {
            message: format!("登录态验证失败(HTTP {s})"),
        }),
    }
}

// ================== 单测(纯判据区) ==================

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::webview::cookie::Cookie as RawCookie;

    fn mk_cookie(name: &str, value: &str) -> Cookie<'static> {
        RawCookie::new(name.to_string(), value.to_string())
    }

    #[test]
    fn cookie_header_joins_all_pairs() {
        let jar = vec![
            mk_cookie("session_id", "abc123"),
            mk_cookie("wb_uid", "u-1"),
        ];
        let header = cookie_header_from_jar(&jar).expect("non-empty jar");
        assert_eq!(header, "session_id=abc123; wb_uid=u-1");
    }

    #[test]
    fn cookie_header_empty_jar_is_none() {
        assert!(cookie_header_from_jar(&[]).is_none());
        // 只有空名 cookie 也视为空
        assert!(cookie_header_from_jar(&[mk_cookie("  ", "v")]).is_none());
    }

    #[test]
    fn parse_accounts_body_ok_shape() {
        let body = r#"{"code":0,"data":{"accounts":[
            {"uid":"14f939c3-889b-4ea2-88b7-ca4582f3b435","nickname":"李总","uin":"330100052422"},
            {"uid":"","nickname":"缺失 uid 应跳过"}
        ]}}"#;
        let accounts = parse_accounts_body(body);
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].uid, "14f939c3-889b-4ea2-88b7-ca4582f3b435");
        assert_eq!(accounts[0].nickname, "李总");
    }

    #[test]
    fn parse_accounts_body_bad_shapes() {
        // 非 JSON
        assert!(parse_accounts_body("<html>401</html>").is_empty());
        // 缺 data.accounts
        assert!(parse_accounts_body(r#"{"code":401,"msg":"unauthorized"}"#).is_empty());
        // accounts 非 list
        assert!(parse_accounts_body(r#"{"data":{"accounts":null}}"#).is_empty());
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
