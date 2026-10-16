// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! WorkBuddy「网页登录自动添加账号」——**项目内嵌浏览器版**(2026-10-16 改版)。
//!
//! ## 形态演进
//!
//! - 2026-10-12 初版:内嵌 WebView2 弹窗加载 www.workbuddy.cn,probe 从弹窗
//!   cookie jar(`cookies_for_url`)读登录态。
//! - 2026-10-15 改版:用户拍板「弹窗形式不对,应该是打开浏览器去扫码」,
//!   改外部真 Chrome 窗口 + CDP(`Storage.getCookies`)回收登录态。
//! - **2026-10-16 本版**:用户再拍板「要项目里内嵌的浏览器(参照 Trae/Qoder 的
//!   内嵌浏览器)」。内嵌形态回归,**窗口形态升级为完整浏览器**(不再是当年那个
//!   小弹窗:自绘工具条 + 地址栏 + 1280×860 窗口 + Chrome UA),登录态回收回到
//!   **内嵌窗 cookie jar**(`cookies_for_url`,含 HttpOnly)——与 10-12 初版同一机制,
//!   比 CDP 更直接:窗口就是我们自己的 webview,不需要绕调试协议。
//!
//! ## 链路
//!
//! 1. 前端调 `embedded_browser_open(WB_WEB_LOGIN_URL)` 在项目内嵌浏览器里打开
//!    **真实登录页**(扫码/账号密码);
//! 2. `checkin_workbuddy_web_login_probe()`:读内嵌窗 cookie jar → 过滤
//!    workbuddy.cn 域族 → Rust 侧直调 `/console/accounts` 验证登录态并取 uid/昵称;
//! 3. 验证通过 → 返回 {status:"ok", cookie, accounts},前端自动入库并
//!    `embedded_browser_close` 收尾。
//!
//! 窗口开/关**不在此文件**:统一走 `embedded_browser` 模块(单一真相源,免得
//! 同一个窗口有两套建窗代码)。本文件只负责「探针 + 判据」。
//!
//! ## 服务端契约(2026-10-12 asar 逆向实证,未变)
//!
//! 签到接口本域 `/v2/billing/meter/daily-checkin`;网页版全 Cookie 认证;
//! Cookie 30 天滚动,过期由签到 401 → SessionDead 永久冷却 → 提示重新网页登录。
//!
//! 判据与执行分离:纯函数(cookie 拼接/响应解析)在此文件可单测,
//! `#[tauri::command]` 只做编排。HTTP 用 reqwest(无 json feature,取 text 再解析,
//! 与 lib.rs 同一约束,不开第二份依赖)。

use std::sync::OnceLock;
use std::time::Duration;

use serde::Serialize;
use tauri::Url;

use crate::embedded_browser::active_webview;
use crate::IpcError;

/// 网页版站点根(本域 API 基址:/console/accounts、/v2/billing/meter/* 都挂在它下面)。
/// 注意:**不是**登录入口 —— 开窗用的是真实登录页 `WB_WEB_LOGIN_URL`
/// (https://www.workbuddy.cn/login/?platform=website&state=2&product=workbuddy&
/// redirect_uri=…,扫码/账号密码);裸 origin 是产品营销首页,没有登录入口
/// (2026-10-15 实证修正)。
pub const WB_WEB_ORIGIN: &str = "https://www.workbuddy.cn";
/// /console/accounts 响应里取账号的 JSON 路径:data.accounts[]。
const ACCOUNTS_PATH: &str = "/console/accounts";
/// 轮询时把 cookie 换登录态的 HTTP 超时。
const PROBE_HTTP_TIMEOUT_SECS: u64 = 10;

// ---------------------------------------------------------------------------
// 纯函数(单测覆盖)
// ---------------------------------------------------------------------------

/// webview cookie jar → 请求头 Cookie 串("k=v; k2=v2")。空 jar 返回 None。
pub fn cookie_header_from_jar(cookies: &[tauri::webview::Cookie<'static>]) -> Option<String> {
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

/// 解析 /console/accounts 响应体 → 账号列表(uid 必填,nickname 是服务端明文)。
///
/// 响应结构双形态兼容(asar 侧 `http.get('/console/accounts')?.data?.accounts` 存在
/// axios 封装歧义:body 可能是 `{data:{accounts:[…]}}` 也可能直接 `{accounts:[…]}`)。
pub fn parse_accounts_body(body: &str) -> Vec<WbWebAccount> {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(body) else {
        return Vec::new();
    };
    let list = v
        .get("data")
        .and_then(|d| d.get("accounts"))
        .or_else(|| v.get("accounts"))
        .and_then(|a| a.as_array());
    let Some(list) = list else {
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

/// 用 Cookie 直调本域签到状态接口,验证「网页登录态能否驱动签到」。
///
/// 背景:签到 UI 只在桌面客户端(asar 实证),网页版 bundle 无 meter 端点 ⇒
/// 「Cookie 能否过 /v2/billing/meter/* 的鉴权」没有静态证据,只能真机探。
/// 该自检在 probe 的 ok 分支执行:200 ⇒ cookie_checkin_ok=true;401/403 ⇒ false
/// (登录态本身有效但签到接口不认 Cookie,前端如实告知用户);网络/其它 ⇒ None(未知)。
pub async fn probe_cookie_checkin(cookie_header: &str) -> Option<bool> {
    let resp = shared_client()
        .post(format!("{WB_WEB_ORIGIN}/v2/billing/meter/checkin-status"))
        .header("accept", "application/json")
        .header("content-type", "application/json")
        .header("cookie", cookie_header)
        .header(
            "user-agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) IHUI-Desktop-Checkin",
        )
        .body("{}".to_string())
        .send()
        .await
        .ok()?;
    Some(matches!(resp.status().as_u16(), 200..=299))
}

// ---------------------------------------------------------------------------
// 探测结果(前端契约)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum WebLoginProbe {
    /// 内嵌浏览器窗口已不在(用户关闭了窗口)。前端提示可重开。
    NoWindow,
    /// 窗口在,但 cookie jar 还没有 workbuddy.cn 域族的任何 cookie(未登录/加载中)。
    NoCookie,
    /// 有 cookie 但服务端说未登录(登录中/会话失效)。
    NotLoggedIn,
    /// 验证通过:cookie + 账号齐全,前端可自动回填。
    /// `cookie_checkin_ok`:网页登录态能否驱动签到接口(实测;None=网络原因未判定)。
    Ok {
        cookie: String,
        accounts: Vec<WbWebAccount>,
        cookie_checkin_ok: Option<bool>,
    },
    /// 本地/网络错误。
    Error { message: String },
}

fn shared_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(PROBE_HTTP_TIMEOUT_SECS))
            .build()
            .expect("reqwest client build")
    })
}

// ---------------------------------------------------------------------------
// #[tauri::command] 薄胶水
// ---------------------------------------------------------------------------

/// 轮询探测(2026-10-16 内嵌浏览器版):读内嵌窗 cookie jar →
/// Rust 侧 GET /console/accounts 验证登录态并取账号。
///
/// 窗口由 `embedded_browser_open` 建(本文件不建窗:单一真相源)。
#[tauri::command]
pub async fn checkin_workbuddy_web_login_probe(app: tauri::AppHandle) -> Result<WebLoginProbe, IpcError> {
    let Some(win) = active_webview(&app) else {
        return Ok(WebLoginProbe::NoWindow);
    };
    let url = Url::parse(&format!("{WB_WEB_ORIGIN}/"))
        .map_err(|e| IpcError::internal(format!("URL 解析失败: {e}")))?;
    let cookies = win
        .cookies_for_url(url)
        .map_err(|e| IpcError::internal(format!("读取登录 Cookie 失败: {e}")))?;
    let Some(cookie_header) = cookie_header_from_jar(&cookies) else {
        // 加载诊断:无 cookie 有两种成因 —— 页面没加载出来(导航未发生/失败,
        // 窗口白屏)与已加载但用户还没登录。前者若继续按 NoCookie 等待,用户对
        // 着一扇白屏无限转圈;用当前地址把两者分开:窗口 URL 不在 workbuddy.cn
        // 域族(含子域,登录会跳子域)内 ⇒ 导航没成功,如实报错让用户重开。
        let navigated = win
            .url()
            .map(|u| {
                u.host_str()
                    .map(|h| h == "workbuddy.cn" || h.ends_with(".workbuddy.cn"))
                    .unwrap_or(false)
            })
            .unwrap_or(false);
        if !navigated {
            let current = win
                .url()
                .map(|u| u.to_string())
                .unwrap_or_else(|_| "<地址不可读>".to_string());
            return Ok(WebLoginProbe::Error {
                message: format!(
                    "登录页面还没加载成功(内嵌浏览器当前地址:{current})。请关闭后重试,或检查网络能否访问 www.workbuddy.cn。"
                ),
            });
        }
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
            let cookie_checkin_ok = probe_cookie_checkin(&cookie_header).await;
            Ok(WebLoginProbe::Ok {
                cookie: cookie_header,
                accounts,
                cookie_checkin_ok,
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

    #[test]
    fn cookie_header_from_jar_empty_and_filled() {
        // 空 jar ⇒ None(前端按 NoCookie 处理)
        assert!(cookie_header_from_jar(&[]).is_none());
        // 空名 cookie 跳过(防御:jar 里偶有畸形项)
        // Cookie::build 收 `Into<Cookie>`(元组 (name, value) 即其中一种),再链式设域/路径
        let c = |n: &str, v: &str| {
            tauri::webview::Cookie::build((n.to_string(), v.to_string()))
                .domain("www.workbuddy.cn")
                .path("/")
                .build()
        };
        let jar = vec![c("session_id", "abc123"), c("wb_uid", "u-1"), c("", "skip")];
        let header = cookie_header_from_jar(&jar).expect("jar 非空");
        assert_eq!(header, "session_id=abc123; wb_uid=u-1");
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

    #[test]
    fn parse_accounts_body_top_level_accounts_fallback() {
        // 响应结构双形态:axios 封装歧义下 body 可能直接是顶层 accounts
        let body = r#"{"accounts":[{"uid":"u-top","nickname":"顶层"}]}"#;
        let accounts = parse_accounts_body(body);
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].uid, "u-top");
        assert_eq!(accounts[0].nickname, "顶层");
    }
}
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
