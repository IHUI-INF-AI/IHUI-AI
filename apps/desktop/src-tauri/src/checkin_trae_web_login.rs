// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! Trae「网页登录自动添加账号」(2026-10-24 立)。
//!
//! ## 立因
//!
//! 签到页「添加账号」此前对 Trae 只有**本机捕获**(读客户端本地库/leveldb),而
//! 用户换一台机器、或客户端没登录时就没有账号可加。WorkBuddy 早已有「内嵌浏览器
//! 网页登录 → 自动入库」的闭环(见 `checkin_web_login.rs`),Trae 缺口同型补齐。
//!
//! ## 链路
//!
//! 1. 前端调 `embedded_browser_open(TRAE_WEB_LOGIN_URL = https://www.trae.cn/login)`,
//!    在项目内嵌浏览器里打开 Trae 官网登录页(手机验证码 / 抖音扫码);
//! 2. `checkin_trae_web_login_probe()` 轮询:读内嵌窗对 `api.trae.cn` 的 cookie jar
//!    (含 HttpOnly,`.trae.cn` 域族) → Rust 侧 POST `GetUserToken` 换真 JWT;
//! 3. 换到 Token 即登录成功 → 解 JWT payload 取 uid(`sub`)与展示名(手机号优先);
//! 4. 前端 `createCheckinAccount({platform:'trae', jwt:Token, ...})` 自动入库。
//!
//! ## 为什么是 GetUserToken
//!
//! Trae 网页登录态只发 Cookie,签到引擎要的是 JWT;`GetUserToken` 是官方 web 端
//! 的**纯 Cookie 换票**端点(线上实证,见 `apps/api/src/services/upstream-adapters/
//! trae-adapter.ts` 的 refreshToken 注释),不带 body、不带 Authorization,
//! 响应 `Result.Token` + `Result.ExpiredAt`。同一个端点也是号池 web 号自动续票的
//! 唯一通道,两边判据同源。
//!
//! 窗口开/关**不在此文件**:统一走 `embedded_browser` 模块(单一真相源)。

use std::sync::OnceLock;
use std::time::Duration;

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use serde::Serialize;
use tauri::Url;

use crate::checkin_capture::jwt_payload_user_id;
use crate::embedded_browser_dock::docked_webview;
use crate::IpcError;

/// Trae 官网根(会话 cookie 可能落成 www 的 host-only 形态,读 cookie 时两个作用域都要取)。
pub const TRAE_WEB_ORIGIN: &str = "https://www.trae.cn";
/// Trae 开放 API 根(GetUserToken 与签到接口同源)。
pub const TRAE_API_ORIGIN: &str = "https://api.trae.cn";
/// Cookie 换票端点(纯 Cookie,无 body)。
const GET_USER_TOKEN_PATH: &str = "/cloudide/api/v3/common/GetUserToken";
/// 换票请求的站点身份:上游按 `work.trae.cn` 页面发起的请求校验 Origin/Referer
/// (与 trae-adapter 的 `WEB_LOGIN_ORIGIN` 逐字同值)。
const WEB_LOGIN_ORIGIN: &str = "https://work.trae.cn";
/// Chrome UA(与内嵌浏览器一致,避免上游按 UA 走不同风控分支)。
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
/// 换票 HTTP 超时(与 WorkBuddy 探针同档)。
const HTTP_TIMEOUT_SECS: u64 = 10;

// ---------------------------------------------------------------------------
// 纯函数(单测覆盖)
// ---------------------------------------------------------------------------

/// GetUserToken 换到的票。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TraeTokenPayload {
    pub token: String,
    /// 到期时刻(epoch **秒**);上游可能给秒或毫秒,统一折算。
    pub expires_at: Option<i64>,
}

/// 解析 `{"Result":{"Token":"…","ExpiredAt":…}}`;无 Token 一律 None(不猜)。
pub fn parse_get_user_token_body(body: &str) -> Option<TraeTokenPayload> {
    let v: serde_json::Value = serde_json::from_str(body).ok()?;
    let result = v.get("Result").filter(|r| r.is_object())?;
    let token = result
        .get("Token")
        .and_then(|t| t.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())?;
    Some(TraeTokenPayload {
        token: token.to_string(),
        expires_at: result.get("ExpiredAt").and_then(epoch_secs),
    })
}

/// 数值/数字串 → epoch 秒(> 1e12 视为毫秒);非正数/不可解析 → None。
fn epoch_secs(v: &serde_json::Value) -> Option<i64> {
    let raw = match v {
        serde_json::Value::Number(n) => n.as_i64().or_else(|| n.as_f64().map(|f| f as i64))?,
        serde_json::Value::String(s) => s.trim().parse::<i64>().ok()?,
        _ => return None,
    };
    if raw <= 0 {
        return None;
    }
    Some(if raw > 1_000_000_000_000 { raw / 1000 } else { raw })
}

/// 解 JWT payload(不验签;换票端点已证明登录态有效,这里只取身份字段)。
pub fn jwt_claims(token: &str) -> Option<serde_json::Value> {
    let payload = token.split('.').nth(1)?;
    let decoded = URL_SAFE_NO_PAD.decode(payload.trim_end_matches('=')).ok()?;
    serde_json::from_slice(&decoded).ok()
}

/// 从 claims 取展示名:昵称 > 名称 > 用户名 > 手机号;顶层与 `data` 内都找。
///
/// 2026-10-14 真机取证:Trae 新版 JWT payload 形如
/// `{aud,exp,familyId,iat,iss,phone,roleId,sub}` —— 手机号是唯一的人类可读字段,
/// 因此它必须进候选(否则账号名只能退化成 GUID 前 8 位)。
pub fn display_name_from_claims(claims: &serde_json::Value) -> Option<String> {
    let top = claims.as_object()?;
    let nested = top.get("data").and_then(|d| d.as_object());
    let sources = [Some(top), nested];
    for key in ["nickname", "name", "username", "phone", "mobile"] {
        for src in sources.into_iter().flatten() {
            if let Some(s) = src.get(key).and_then(|v| v.as_str()) {
                let s = s.trim();
                if !s.is_empty() {
                    return Some(s.to_string());
                }
            }
        }
    }
    None
}

/// 读内嵌窗 cookie jar → 请求头 Cookie 串:同时取 `api.trae.cn` 与 `www.trae.cn`
/// 两个作用域并按名字去重。
///
/// 为什么取两个:`cookies_for_url(api.trae.cn)` 只覆盖 Domain=.trae.cn 的域 cookie;
/// 若上游把会话种成 www 的 **host-only** 形态(无 Domain 属性),只读 API 域会得到
/// 空 jar ⇒ 登录成功也永远判「未登录」。两个作用域合并能同时覆盖两种落法,
/// 多带的 www 专属 cookie 对换票端点无副作用(上游忽略未知项)。
pub fn collect_trae_cookie_header(
    win: &tauri::Webview,
) -> Result<Option<String>, String> {
    let mut seen = std::collections::HashSet::new();
    let mut parts: Vec<String> = Vec::new();
    // API 域在前:同名时优先用「对换票端点确实生效」的那枚。
    for origin in [TRAE_API_ORIGIN, TRAE_WEB_ORIGIN] {
        let url = Url::parse(&format!("{origin}/"))
            .map_err(|e| format!("URL 解析失败: {e}"))?;
        let cookies = win
            .cookies_for_url(url)
            .map_err(|e| format!("读取登录 Cookie 失败: {e}"))?;
        for c in cookies {
            let name = c.name().trim();
            if name.is_empty() || !seen.insert(name.to_string()) {
                continue;
            }
            parts.push(format!("{name}={}", c.value()));
        }
    }
    if parts.is_empty() {
        Ok(None)
    } else {
        Ok(Some(parts.join("; ")))
    }
}

/// 换票失败的两种性质:未登录(继续等用户操作)/ 其它(网络/结构异常)。
enum ExchangeFailure {
    Unauthorized(String),
    Other(String),
}

/// 用 Cookie 直调 GetUserToken。
async fn exchange_for_token(cookie_header: &str) -> Result<TraeTokenPayload, ExchangeFailure> {
    let resp = shared_client()
        .post(format!("{TRAE_API_ORIGIN}{GET_USER_TOKEN_PATH}"))
        .header("accept", "application/json")
        .header("content-type", "application/json")
        .header("cookie", cookie_header)
        .header("origin", WEB_LOGIN_ORIGIN)
        .header("referer", format!("{WEB_LOGIN_ORIGIN}/"))
        .header("user-agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| ExchangeFailure::Other(format!("换票请求失败: {e}")))?;
    let status = resp.status().as_u16();
    let body = resp.text().await.unwrap_or_default();
    match status {
        200..=299 => match parse_get_user_token_body(&body) {
            Some(p) => Ok(p),
            None => Err(ExchangeFailure::Other(
                "换票响应里没有 Token(登录态可能尚未生效)".to_string(),
            )),
        },
        401 | 403 => Err(ExchangeFailure::Unauthorized(format!(
            "Cookie 未登录或已过期(HTTP {status})"
        ))),
        s => Err(ExchangeFailure::Other(format!(
            "换票失败(HTTP {s}){}",
            body.chars().take(120).collect::<String>()
        ))),
    }
}

fn shared_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .build()
            .expect("reqwest client build")
    })
}

// ---------------------------------------------------------------------------
// 探测结果(前端契约)
// ---------------------------------------------------------------------------

/// 与 WorkBuddy `WebLoginProbe` 同型的状态机;前端只认 `ok` 收尾。
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum TraeWebLoginProbe {
    /// 内嵌浏览器窗口已不在(用户关了窗口)。
    NoWindow,
    /// 窗口在,但 cookie jar 还没有 Trae 域族的任何 cookie(未登录/加载中)。
    NoCookie,
    /// 有 cookie 但换不到票(登录中/会话失效)。
    NotLoggedIn { message: String },
    /// 换票成功:token + uid + 展示名齐全,前端自动入库。
    Ok {
        token: String,
        /// JWT `sub`(GUID);提取不到时为空串,前端用展示名兜底。
        uid: String,
        nickname: String,
        /// token 到期(epoch 秒);上游没给则 None。
        expires_at: Option<i64>,
    },
    /// 本地/网络错误。
    Error { message: String },
}

// ---------------------------------------------------------------------------
// #[tauri::command] 薄胶水
// ---------------------------------------------------------------------------

/// 轮询探测:读**右侧工作区停靠浏览器**对 trae.cn 的 cookie jar → GetUserToken 换票 → 解身份。
///
/// 窗口由 `embedded_browser_dock_open` 建(本文件不建 webview:单一真相源)。
#[tauri::command]
pub async fn checkin_trae_web_login_probe(
    app: tauri::AppHandle,
) -> Result<TraeWebLoginProbe, IpcError> {
    let Some(win) = docked_webview(&app) else {
        return Ok(TraeWebLoginProbe::NoWindow);
    };
    let Some(cookie_header) = collect_trae_cookie_header(&win)
        .map_err(IpcError::internal)?
    else {
        return Ok(TraeWebLoginProbe::NoCookie);
    };
    match exchange_for_token(&cookie_header).await {
        Ok(payload) => {
            let claims = jwt_claims(&payload.token);
            // ExpiredAt 缺失时用 JWT 自身的 exp 兜底(与 trae-protocol 的
            // extractGetUserTokenPayload 同一口径),不猜"24h 后过期"。
            let expires_at = payload.expires_at.or_else(|| {
                claims
                    .as_ref()
                    .and_then(|c| c.get("exp"))
                    .and_then(|v| v.as_i64())
                    .filter(|exp| *exp > 0)
            });
            Ok(TraeWebLoginProbe::Ok {
                uid: jwt_payload_user_id(&payload.token).unwrap_or_default(),
                nickname: claims
                    .as_ref()
                    .and_then(display_name_from_claims)
                    .unwrap_or_default(),
                token: payload.token,
                expires_at,
            })
        }
        Err(ExchangeFailure::Unauthorized(message)) => {
            Ok(TraeWebLoginProbe::NotLoggedIn { message })
        }
        Err(ExchangeFailure::Other(message)) => Ok(TraeWebLoginProbe::Error { message }),
    }
}

// ================== 单测(纯判据区) ==================

#[cfg(test)]
mod tests {
    use super::*;

    fn b64url(s: &str) -> String {
        URL_SAFE_NO_PAD.encode(s.as_bytes())
    }

    fn fake_jwt(claims: &str) -> String {
        format!("eyJhbGciOiJub25lIn0.{}.sig", b64url(claims))
    }

    #[test]
    fn parses_token_and_expiry_seconds_and_millis() {
        let secs = parse_get_user_token_body(
            r#"{"Result":{"Token":"abc.def.ghi","ExpiredAt":1791234567}}"#,
        )
        .expect("应解析");
        assert_eq!(secs.token, "abc.def.ghi");
        assert_eq!(secs.expires_at, Some(1791234567));

        // 毫秒折算成秒
        let ms = parse_get_user_token_body(
            r#"{"Result":{"Token":"t","ExpiredAt":1791234567000}}"#,
        )
        .expect("应解析");
        assert_eq!(ms.expires_at, Some(1791234567));

        // 数字串同样接受
        let s = parse_get_user_token_body(r#"{"Result":{"Token":"t","ExpiredAt":"1791234567"}}"#)
            .expect("应解析");
        assert_eq!(s.expires_at, Some(1791234567));
    }

    #[test]
    fn rejects_missing_or_bad_token_body() {
        for body in [
            "<html>401</html>",
            r#"{"Result":null}"#,
            r#"{"Result":{"Token":""}}"#,
            r#"{"Result":{"Token":"   "}}"#,
            r#"{}"#,
        ] {
            assert!(
                parse_get_user_token_body(body).is_none(),
                "不该解析出 Token: {body}"
            );
        }
        // 无 ExpiredAt ⇒ None(不猜 24h)
        let p = parse_get_user_token_body(r#"{"Result":{"Token":"t"}}"#).expect("应解析");
        assert_eq!(p.expires_at, None);
    }

    #[test]
    fn jwt_claims_and_display_name_priority() {
        let jwt = fake_jwt(
            r#"{"sub":"2ea8afb3-1111-2222-3333-444455556666","phone":"13800138000","exp":1791234567}"#,
        );
        let claims = jwt_claims(&jwt).expect("payload 应可解");
        // 手机号是 Trae JWT 唯一人类可读字段 ⇒ 必须进展示名
        assert_eq!(
            display_name_from_claims(&claims).as_deref(),
            Some("13800138000")
        );
        // uid 取 sub(与 checkin_capture 同判据)
        assert_eq!(
            jwt_payload_user_id(&jwt).as_deref(),
            Some("2ea8afb3-1111-2222-3333-444455556666")
        );
    }

    #[test]
    fn display_name_prefers_nickname_then_nested_data() {
        let claims: serde_json::Value =
            serde_json::from_str(r#"{"nickname":"李总","phone":"13800138000"}"#).unwrap();
        assert_eq!(display_name_from_claims(&claims).as_deref(), Some("李总"));

        let nested: serde_json::Value =
            serde_json::from_str(r#"{"data":{"username":"lizong"}}"#).unwrap();
        assert_eq!(display_name_from_claims(&nested).as_deref(), Some("lizong"));

        let empty: serde_json::Value = serde_json::from_str(r#"{"nickname":"  "}"#).unwrap();
        assert_eq!(display_name_from_claims(&empty), None);
    }

    #[test]
    fn jwt_claims_rejects_non_jwt() {
        assert!(jwt_claims("not-a-jwt").is_none());
        assert!(jwt_claims("a.!!!.c").is_none());
    }
}
