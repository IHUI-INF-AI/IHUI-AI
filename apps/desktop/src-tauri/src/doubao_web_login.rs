// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 豆包「网页登录加号」——**项目内嵌浏览器版**(2026-11-17 立)。
//!
//! ## 立因
//!
//! 豆包桌面端每个登录号各占一个 Chromium profile,过去加号只有两条路:①命令行
//! `relay-account-pool.mjs --from doubao --all-profiles`(要退出客户端、且上游只回
//! 掩码号,全号还得靠号池「前3后2唯一命中」事后归位);②管理员手工提供完整手机号。
//! 机主要求「我自己填手机号、自己收验证码,项目自动拿到全号」⇒ 本模块把登录搬进
//! 项目内嵌浏览器:手机号由用户在产品界面里填一次(命令 `doubao_web_login_autofill`
//! 顺手填进豆包登录页),登录完成后从**我们自己的 webview cookie jar** 收会话
//! (含 HttpOnly),上游只用来核验登录态 + 拿掩码号做一致性校验。
//!
//! ## 链路
//!
//! 1. 前端 `embedded_browser_open(DOUBAO_WEB_LOGIN_URL)` 开登录页(统一建窗,
//!    本模块不建窗 —— 与 checkin_web_login 同一条纪律);
//! 2. 前端把用户填的手机号交 `doubao_web_login_autofill`,Rust 用 `eval` 在页面里
//!    找手机号输入框并原生赋值(找不到也不报错:用户可以自己再输一次);
//! 3. 前端轮询 `doubao_web_login_probe(phone)`:
//!    - 窗口不在 ⇒ no_window;页面还没导航到豆包域 ⇒ error(白屏如实说);
//!    - cookie jar 里没有 sessionid/uid_tt 族 ⇒ no_cookie / not_logged_in;
//!    - 用整包 cookie 调上游 `POST /alice/user/get_account_info` 验登录态并取
//!      `data.base_account_info.mobile`(实测恒为掩码,形如 `+86 157******40`);
//!    - 有全号 + 有掩码 ⇒ 前3后2 比对:不一致 ⇒ error(拒绝把 A 号的手机号
//!      落到 B 号头上),一致/上游未判定 ⇒ ok。
//! 4. 前端把 `{phone, cookies[]}` 走现有 `/api/admin/relay/accounts/import`
//!    入池(uid 由服务端从 uid_tt 派生,本模块**不造第二份 uid 判据**)。
//!
//! ## 安全边界
//!
//! - 只读**我们自己内嵌浏览器**的 cookie jar,不碰系统浏览器、不读磁盘 Cookies 库;
//! - Cookie 明文只在 IPC 回包里流向本机前端,不打印、不落日志;
//! - 上游请求过 `egress_gate`(与其它 Rust 出站点同一把尺)。

use std::sync::OnceLock;
use std::time::Duration;

use serde::Serialize;
use tauri::Url;

use crate::embedded_browser::active_webview;
use crate::IpcError;

/// 豆包站点根(上游账号信息接口挂在它下面)。
pub const DOUBAO_WEB_ORIGIN: &str = "https://www.doubao.com";
/// 豆包网页登录页(内嵌浏览器打开的就是它;登录成功后站点自己跳 /chat)。
/// 跨语言对账锚点:与前端 `tauri-bridge.ts` 的 `DOUBAO_WEB_LOGIN_URL` 同值,改一侧必改另一侧;
/// Rust 侧不消费它(建窗 URL 由前端停靠 tab 传入),保留为逐值对照的单一真相源(§0.6)。
#[allow(dead_code)]
pub const DOUBAO_WEB_LOGIN_URL: &str = "https://www.doubao.com/login";
/// 上游账号信息接口(桌面端账号面板自己的取数口,2026-11-17 实证)。
const ACCOUNT_INFO_PATH: &str = "/alice/user/get_account_info";
/// 与 `scripts/lib/doubao-account-info.mjs` 逐字同参(aid 实证 582478)。
const ACCOUNT_INFO_QUERY: &str = "language=zh&device_platform=web&doubao_device_platform=desktop\
&aid=582478&real_aid=582478&pkg_type=release_version&version_code=20800&pc_version=3.46.0\
&use-olympus-account=1";
/// 上游请求 UA(与提取器同源形态;站点不校验 UA 指纹,只要求非空可读)。
const DOUBAO_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
(KHTML, like Gecko) DoubaoDesktop/2.32.6 Chrome/147.0.7727.149 Safari/537.36";
/// 上游请求超时。
const PROBE_HTTP_TIMEOUT_SECS: u64 = 10;

/// 会话族 cookie 键名(与 `scripts/lib/doubao-auth-extract.mjs` 的
/// `SESSION_COOKIE_NAMES` 同集):Rust 侧只用它**收窄采集面**,不做任何映射;
/// 归一/去重/uid 派生全交服务端单一映射(cross-language 两份清单是本模块唯一复制,
/// 因为 Rust 不能 import mjs)。
const SESSION_COOKIE_NAMES: [&str; 15] = [
    "sessionid",
    "sessionid_ss",
    "sid_tt",
    "sid_guard",
    "sid_ucp_v1",
    "ssid_ucp_v1",
    "uid_tt",
    "uid_tt_ss",
    "user_token",
    "msToken",
    "ttwid",
    "odin_tt",
    "session_token",
    "session",
    "sid",
];

/// 字节风控票所在域族(cookie jar 按 URL 取,故按 origin 分两次读再合并)。
const COOKIE_ORIGINS: [&str; 2] = ["https://www.doubao.com", "https://www.bytedance.com"];

// ---------------------------------------------------------------------------
// 纯函数(单测覆盖)
// ---------------------------------------------------------------------------

/// 上游 `mobile` → 统一号码形态(去 `+86`/空格/连字符)。全号与掩码都接受。
pub fn normalize_mobile(raw: &str) -> Option<String> {
    let mut s: String = raw
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .collect();
    if let Some(rest) = s.strip_prefix('+') {
        s = rest.to_string();
    }
    if let Some(rest) = s.strip_prefix("86") {
        s = rest.to_string();
    }
    if is_full_phone(&s) {
        return Some(s);
    }
    // 掩码:前3 + 星号 + 后2~4
    let star_start = s.find('*')?;
    let prefix = &s[..star_start];
    let suffix = s[star_start..].trim_start_matches('*');
    let stars = s[star_start..].len() - suffix.len();
    if prefix.len() == 3
        && prefix.starts_with('1')
        && prefix.chars().all(|c| c.is_ascii_digit())
        && stars >= 2
        && (2..=4).contains(&suffix.len())
        && suffix.chars().all(|c| c.is_ascii_digit())
    {
        return Some(s);
    }
    None
}

/// 11 位中国大陆手机号全号。
pub fn is_full_phone(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 11
        && b[0] == b'1'
        && (b'3'..=b'9').contains(&b[1])
        && b.iter().all(|c| c.is_ascii_digit())
}

/// 全号与上游掩码是否同一个号:前3 与后2 必须逐字相同。
/// 掩码位数不足(前缀不是3位 / 后缀不足2位)⇒ false(未判定不许冒认)。
pub fn phone_mask_matches(full: &str, masked: &str) -> bool {
    if !is_full_phone(full) {
        return false;
    }
    let Some(norm) = normalize_mobile(masked) else {
        return false;
    };
    let Some(star) = norm.find('*') else {
        return norm == full;
    };
    let prefix = &norm[..star];
    let suffix = norm[star..].trim_start_matches('*');
    prefix.len() == 3 && suffix.len() >= 2 && full.starts_with(prefix) && full.ends_with(suffix)
}

/// 展示用脱敏(与号池口径一致:前3 + 6星 + 后2);非全号原样返回。
pub fn mask_phone(full: &str) -> String {
    if !is_full_phone(full) {
        return full.to_string();
    }
    format!("{}******{}", &full[..3], &full[9..])
}

/// cookie 名是否属于会话族(采集面收窄)。
pub fn is_session_cookie_name(name: &str) -> bool {
    SESSION_COOKIE_NAMES.contains(&name)
}

/// webview cookie jar → 请求头 Cookie 串("k=v; k2=v2")。空 jar 返回 None。
pub fn cookie_header(cookies: &[DoubaoCookie]) -> Option<String> {
    let parts: Vec<String> = cookies
        .iter()
        .filter(|c| !c.name.trim().is_empty() && !c.value.is_empty())
        .map(|c| format!("{}={}", c.name, c.value))
        .collect();
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("; "))
    }
}

/// 登录态校验所需的两枚关键票(Cookie 不完整时按 not_logged_in 如实告知)。
pub fn has_login_tickets(cookies: &[DoubaoCookie]) -> bool {
    let has = |n: &str| cookies.iter().any(|c| c.name == n && !c.value.is_empty());
    has("sessionid") && has("uid_tt")
}

/// 解析上游账号信息响应:code==0 取 mobile(全号或掩码);业务码非 0 返回 Err(原因)。
pub fn parse_account_info(body: &str) -> Result<Option<String>, String> {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(body) else {
        return Err("上游账号信息不是合法 JSON".to_string());
    };
    if let Some(code) = v.get("code").and_then(|c| c.as_i64()) {
        if code != 0 {
            let msg = v
                .get("message")
                .or_else(|| v.get("msg"))
                .and_then(|m| m.as_str())
                .unwrap_or("业务码非 0");
            return Err(format!("上游拒绝: {msg}(code={code})"));
        }
    }
    let info = v
        .get("data")
        .and_then(|d| d.get("base_account_info"))
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    let raw = info
        .get("mobile")
        .or_else(|| info.get("mobile_number"))
        .or_else(|| info.get("phone"))
        .and_then(|m| m.as_str());
    Ok(raw.and_then(normalize_mobile))
}

// ---------------------------------------------------------------------------
// 探测结果(前端契约)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct DoubaoCookie {
    pub name: String,
    pub value: String,
    pub domain: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum DoubaoWebLoginProbe {
    /// 内嵌浏览器窗口已不在。
    NoWindow,
    /// 窗口在,但 cookie jar 里还没有豆包域族会话 Cookie(未登录/加载中)。
    NoCookie,
    /// 有 Cookie 但登录态不完整/上游不认。
    NotLoggedIn { message: String },
    /// 登录态有效。
    Ok {
        /// 请求头形态 Cookie 串(诊断/兼容用;入池以 cookies[] 为准)。
        cookie: String,
        /// 整包会话族 Cookie(直接作为导入载荷 cookies[] 的 value 源)。
        cookies: Vec<DoubaoCookie>,
        /// 上游手机号(实测为掩码;上游未给出时 null)。
        masked_phone: Option<String>,
        /// 用户填的全号与上游掩码是否一致;任一侧缺失 ⇒ null(未判定)。
        phone_match: Option<bool>,
    },
    /// 本地/网络错误。
    Error { message: String },
}

// ---------------------------------------------------------------------------
// 执行层
// ---------------------------------------------------------------------------

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(PROBE_HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败: {e}"))
}

fn shared_client() -> Result<&'static reqwest::Client, String> {
    static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(build_client)
        .as_ref()
        .map_err(|e| e.clone())
}

/// 从已打开的内嵌 webview 读会话族 Cookie(doubao.com + bytedance.com 两域合并)。
fn collect_cookies(win: &tauri::webview::Webview) -> Vec<DoubaoCookie> {
    let mut out: Vec<DoubaoCookie> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for origin in COOKIE_ORIGINS {
        let Ok(url) = Url::parse(origin) else {
            continue;
        };
        let Ok(jar) = win.cookies_for_url(url) else {
            continue;
        };
        for c in jar {
            let name = c.name().to_string();
            if !is_session_cookie_name(&name) {
                continue;
            }
            let value = c.value().to_string();
            if value.is_empty() {
                continue;
            }
            let domain = c.domain().map(|d| d.to_string());
            let key = format!("{domain:?}|{name}");
            if !seen.insert(key) {
                continue;
            }
            out.push(DoubaoCookie {
                name,
                value,
                domain,
            });
        }
    }
    out
}

/// 带 cookie 调上游账号信息接口:Ok(masked_phone) / Err(原因,含未登录)。
async fn fetch_masked_phone(cookie_header: &str) -> Result<Option<String>, String> {
    let target = format!("{DOUBAO_WEB_ORIGIN}{ACCOUNT_INFO_PATH}?{ACCOUNT_INFO_QUERY}");
    if let Err(denied) = crate::egress_gate::guard_egress_target(&target) {
        return Err(format!("出口门拒绝该目标: {denied}"));
    }
    let resp = shared_client()?
        .post(&target)
        .header("cookie", cookie_header)
        .header("content-type", "application/json")
        .header("accept", "application/json, text/plain, */*")
        .header("referer", "https://www.doubao.com/chat/")
        .header("origin", DOUBAO_WEB_ORIGIN)
        .header("user-agent", DOUBAO_UA)
        .body("{}".to_string())
        .send()
        .await
        .map_err(|e| format!("账号信息请求失败: {e}"))?;
    match resp.status().as_u16() {
        200 => {
            let body = resp.text().await.unwrap_or_default();
            parse_account_info(&body)
        }
        401 | 403 => Err("登录态未生效或已过期(Cookie 未通过上游鉴权)".to_string()),
        s => Err(format!("账号信息接口 HTTP {s}")),
    }
}

/// 把用户填的手机号填进豆包登录页的输入框(尽力而为;失败不报错)。
#[tauri::command]
pub async fn doubao_web_login_autofill(app: tauri::AppHandle, phone: String) -> Result<bool, IpcError> {
    let trimmed = phone.trim().to_string();
    if !is_full_phone(&trimmed) {
        return Err(IpcError::permission("手机号必须是 11 位中国大陆号码".to_string()));
    }
    let Some(win) = active_webview(&app) else {
        return Ok(false);
    };
    let js = AUTOFILL_JS.replace("__IHUI_PHONE__", &serde_json::to_string(&trimmed).unwrap_or_default());
    win.eval(js)
        .map_err(|e| IpcError::internal(format!("填充手机号失败: {e}")))?;
    Ok(true)
}

/// 轮询探测豆包网页登录态(手机号由前端传,用于和上游掩码做一致性校验)。
#[tauri::command]
pub async fn doubao_web_login_probe(
    app: tauri::AppHandle,
    phone: Option<String>,
) -> Result<DoubaoWebLoginProbe, IpcError> {
    let Some(win) = active_webview(&app) else {
        return Ok(DoubaoWebLoginProbe::NoWindow);
    };
    let cookies = collect_cookies(&win);
    if cookies.is_empty() {
        // 与 WorkBuddy 同一诊断口径:白屏(没导航成功)与「加载了但还没登录」要分开报。
        let navigated = win
            .url()
            .ok()
            .and_then(|u| u.host_str().map(|h| h == "doubao.com" || h.ends_with(".doubao.com")))
            .unwrap_or(false);
        if !navigated {
            let current = win
                .url()
                .map(|u| u.to_string())
                .unwrap_or_else(|_| "<地址不可读>".to_string());
            return Ok(DoubaoWebLoginProbe::Error {
                message: format!(
                    "登录页面还没加载成功(内嵌浏览器当前地址:{current})。请关闭后重试,或检查网络能否访问 www.doubao.com。"
                ),
            });
        }
        return Ok(DoubaoWebLoginProbe::NoCookie);
    }
    if !has_login_tickets(&cookies) {
        return Ok(DoubaoWebLoginProbe::NotLoggedIn {
            message: "登录会话还不完整(缺 sessionid/uid_tt):请在页面里完成手机号 + 验证码登录。"
                .to_string(),
        });
    }
    let Some(header) = cookie_header(&cookies) else {
        return Ok(DoubaoWebLoginProbe::NoCookie);
    };

    let masked = match fetch_masked_phone(&header).await {
        Ok(m) => m,
        Err(msg) => return Ok(DoubaoWebLoginProbe::NotLoggedIn { message: msg }),
    };

    let normalized_phone = phone
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(normalize_mobile);
    // 前端传的是全号才做一致性校验;不合法号码直接拒绝(别把错号写进号池名)。
    if let Some(raw) = phone.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        if normalized_phone.as_deref().map(is_full_phone) != Some(true) {
            return Ok(DoubaoWebLoginProbe::Error {
                message: format!("手机号格式不正确:{raw}"),
            });
        }
    }
    let phone_match = match (normalized_phone.as_deref(), masked.as_deref()) {
        (Some(full), Some(m)) if is_full_phone(full) => Some(phone_mask_matches(full, m)),
        _ => None,
    };
    if phone_match == Some(false) {
        return Ok(DoubaoWebLoginProbe::Error {
            message: format!(
                "刚登录的账号手机号是 {},与你填写的 {} 不一致:请确认登录的是同一个号(避免把号码落到别的账号上)。",
                masked.as_deref().unwrap_or("(未取到)"),
                mask_phone(normalized_phone.as_deref().unwrap_or(""))
            ),
        });
    }

    Ok(DoubaoWebLoginProbe::Ok {
        cookie: header,
        cookies,
        masked_phone: masked,
        phone_match,
    })
}

/// 页面内「找手机号输入框并原生赋值」脚本(单源:只在 `doubao_web_login_autofill` 用)。
/// 只认 tel/number/text 且(placeholder 含手机/电话/账号 或 maxLength≥11),绝不碰验证码框。
const AUTOFILL_JS: &str = r#"
(function () {
  try {
    var PHONE = __IHUI_PHONE__;
    function looksPhone(el) {
      if (!el || !el.tagName || el.tagName.toLowerCase() !== 'input') return false;
      var t = (el.getAttribute('type') || '').toLowerCase();
      if (t === 'tel') return true;
      if (t === 'number' || t === 'text' || t === '') {
        var ph = el.getAttribute('placeholder') || '';
        var ml = el.maxLength || 0;
        return /手机|电话|账号/.test(ph) || ml >= 11;
      }
      return false;
    }
    function setValue(el) {
      var current = (el.value || '').replace(/\s|-/g, '');
      if (current === PHONE) return true;
      var proto = el.constructor && el.constructor.prototype;
      var d = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null;
      if (d && d.set) { d.set.call(el, PHONE); } else { el.value = PHONE; }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    function fillDoc(doc) {
      var list;
      try { list = doc.querySelectorAll('input'); } catch (e) { return false; }
      for (var i = 0; i < list.length; i++) {
        if (looksPhone(list[i])) return setValue(list[i]);
      }
      return false;
    }
    if (fillDoc(document)) return true;
    var frames = document.querySelectorAll('iframe');
    for (var j = 0; j < frames.length; j++) {
      try {
        if (frames[j].contentDocument && fillDoc(frames[j].contentDocument)) return true;
      } catch (e) { /* 跨域 iframe:交给该框自己的注入脚本 */ }
    }
    return false;
  } catch (e) { return false; }
})();
"#;

// ================== 单测(纯判据区) ==================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_mobile_full_and_masked() {
        assert_eq!(normalize_mobile("+86 15754320340"), Some("15754320340".to_string()));
        assert_eq!(normalize_mobile("157-5432-0340"), Some("15754320340".to_string()));
        assert_eq!(normalize_mobile("+86 157******40"), Some("157******40".to_string()));
        assert_eq!(normalize_mobile("157****40"), Some("157****40".to_string()));
        assert_eq!(normalize_mobile("abc"), None);
        assert_eq!(normalize_mobile("23456789012"), None, "非 1[3-9] 开头不是手机号");
    }

    #[test]
    fn mask_matches_prefix_and_suffix_only() {
        assert!(phone_mask_matches("15754320340", "+86 157******40"));
        assert!(phone_mask_matches("15754320340", "157****40"));
        assert!(!phone_mask_matches("15754320340", "157******41"));
        assert!(!phone_mask_matches("15754320340", "158******40"));
        // 掩码位数不足 ⇒ 不冒认
        assert!(!phone_mask_matches("15754320340", "15*40"));
        assert!(!phone_mask_matches("1575432034", "157******40"));
    }

    #[test]
    fn mask_phone_display() {
        assert_eq!(mask_phone("15754320340"), "157******40");
        assert_eq!(mask_phone("157******40"), "157******40");
    }

    #[test]
    fn session_cookie_filter_and_header() {
        let jar = vec![
            DoubaoCookie {
                name: "sessionid".into(),
                value: "s1".into(),
                domain: Some(".doubao.com".into()),
            },
            DoubaoCookie {
                name: "uid_tt".into(),
                value: "u1".into(),
                domain: Some(".doubao.com".into()),
            },
        ];
        assert!(has_login_tickets(&jar));
        assert_eq!(cookie_header(&jar).as_deref(), Some("sessionid=s1; uid_tt=u1"));
        assert!(is_session_cookie_name("sessionid"));
        assert!(!is_session_cookie_name("_ga"));
        // 缺 uid_tt ⇒ 登录态不完整
        assert!(!has_login_tickets(&jar[..1]));
    }

    #[test]
    fn parse_account_info_shapes() {
        let ok = r#"{"code":0,"data":{"base_account_info":{"mobile":"+86 157******40"}}}"#;
        assert_eq!(parse_account_info(ok).ok().flatten().as_deref(), Some("157******40"));
        // 业务码非 0 ⇒ Err(带原因)
        let bad = r#"{"code":1001,"message":"invalid session"}"#;
        assert!(parse_account_info(bad).is_err());
        // 合法 JSON 但无号码 ⇒ Ok(None)(取不到 ≠ 失效)
        assert_eq!(parse_account_info(r#"{"code":0,"data":{}}"#), Ok(None));
        assert!(parse_account_info("<html>").is_err());
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
