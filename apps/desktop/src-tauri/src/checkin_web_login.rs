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
//! 3. 验证通过 → 返回 {status:"ok", accounts, cookie_checkin_ok}(**F-060:
//!    cookie 不再随 IPC 回传**),前端改调 `checkin_workbuddy_web_import`,
//!    由 Rust 从 cookie jar 现读 cookie 直接 POST 后端入库,成功后
//!    `embedded_browser_close` 收尾。粘贴路径同理:cookie 只在前端粘贴草稿里,
//!    probe 回包不含它,入库用前端本地草稿直传(等价于旧 `jwt: probe.cookie`)。
//!    嵌入模式(签到页在内嵌浏览器里,无 IPC)则由看护方直接在 Rust 侧完成导入,
//!    `#wb_import=` 只回「已导入 N 条 + 逐条失败 + cookie_checkin_ok」,不带凭据。
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
/// WorkBuddy 网页登录**真实登录页**(扫码/账号密码)。与前端 tauri-bridge.ts 的
/// `WB_WEB_LOGIN_URL` 逐字同值(一处语义两处定义:前端给主窗口流程开窗用,
/// Rust 给内嵌浏览器哨兵 `wb-checkin-login` 建窗用)。redirect_uri 指回本站首页,
/// 登录成功后落地;/login/ 之外的裸 origin 是营销首页,没有登录入口(2026-10-15 实证)。
pub const WB_WEB_LOGIN_URL: &str = "https://www.workbuddy.cn/login/?platform=website&state=2&product=workbuddy&redirect_uri=https%3A%2F%2Fwww.workbuddy.cn%2F";
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

/// WorkBuddy 网页账号(uid 必填,nickname 是服务端明文;探测回包与入库入参同形)。
/// F-060 起作为 `checkin_workbuddy_web_import` 的入参类型:前端只描述
/// **给谁入库**,不携带任何凭据 —— 凭据(jar cookie)由 Rust 现读。
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
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
    // 出站前过出口门(Z17 与 CLI 同源腿):被拒 ⇒ 报「未知」而不是伪报「登录态无效」,
    // 理由已具名出声(见 egress_gate::report_egress_warnings)。
    crate::egress_gate::guard_egress_target(&format!("{WB_WEB_ORIGIN}/v2/billing/meter/checkin-status")).ok()?;
    let resp = shared_client()
        .ok()?
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

/// 「带 Cookie 直调服务端」的判定产物:账号列表 + 登录态能否驱动签到(实测;
/// None=网络原因未判定)。纯探测函数与命令共用,便于单测与两处入口复用。
pub struct ProbeOutcome {
    pub accounts: Vec<WbWebAccount>,
    pub cookie_checkin_ok: Option<bool>,
}

/// 带 Cookie 直调 `/console/accounts` 取账号 + 自检签到接口可用性。
///
/// 两条入口共用:①`checkin_workbuddy_web_login_probe`(读内嵌窗 cookie jar);
/// ②`checkin_workbuddy_web_login_probe_cookie`(用户粘贴的 Cookie,主窗专用)。
/// 判据与编排分离:本函数只做 HTTP + 解析,不碰任何 webview 状态。
pub async fn probe_cookie_accounts(cookie_header: &str) -> Result<ProbeOutcome, String> {
    let target = format!("{WB_WEB_ORIGIN}{ACCOUNTS_PATH}");
    if let Err(denied) = crate::egress_gate::guard_egress_target(&target) {
        return Err(format!("出口门拒绝该目标: {denied}"));
    }
    let resp = shared_client()?
        .get(format!("{WB_WEB_ORIGIN}{ACCOUNTS_PATH}"))
        .header("accept", "application/json")
        .header("cookie", cookie_header)
        .header(
            "user-agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) IHUI-Desktop-Checkin",
        )
        .send()
        .await
        .map_err(|e| format!("登录态验证请求失败: {e}"))?;
    match resp.status().as_u16() {
        200 => {
            let body = resp.text().await.unwrap_or_default();
            let accounts = parse_accounts_body(&body);
            if accounts.is_empty() {
                // 200 但解析不到账号:结构不符或登录态名存实亡
                return Err("登录态已失效(服务端未返回账号)".to_string());
            }
            let cookie_checkin_ok = probe_cookie_checkin(cookie_header).await;
            Ok(ProbeOutcome {
                accounts,
                cookie_checkin_ok,
            })
        }
        401 | 403 => Err("Cookie 未登录或已过期".to_string()),
        s => Err(format!("登录态验证失败(HTTP {s})")),
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum WebLoginProbe {
    /// 内嵌浏览器窗口已不在(用户关闭了窗口)。前端提示可重开。
    NoWindow,
    /// 窗口在,但 cookie jar 还没有 workbuddy.cn 域族的任何 cookie(未登录/加载中)。
    NoCookie,
    /// 有 cookie 但服务端说未登录(登录中/会话失效)。`message` 带原因
    /// (2026-10-18:粘贴路径要把「Cookie 无效/已过期」如实告知用户)。
    NotLoggedIn { message: String },
    /// 验证通过:账号齐全,前端据此发起入库。
    /// `cookie_checkin_ok`:网页登录态能否驱动签到接口(实测;None=网络原因未判定)。
    /// **F-060:回包不携带 cookie** —— 两条探测命令(jar 探测/粘贴探测)共用本枚举,
    /// cookie 留在 Rust:jar 路径改走 `checkin_workbuddy_web_import` 由 Rust 现读
    /// jar 直 POST 后端;粘贴路径的 cookie 前端本地草稿本来就持有,不依赖回包。
    Ok {
        accounts: Vec<WbWebAccount>,
        cookie_checkin_ok: Option<bool>,
    },
    /// 本地/网络错误。
    Error { message: String },
}

/// 构建 HTTP 客户端(可失败,不 panic):非法配置 ⇒ Err 由调用方决定降级口径。
fn build_client(builder: reqwest::ClientBuilder) -> Result<reqwest::Client, String> {
    builder
        .timeout(Duration::from_secs(PROBE_HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败: {e}"))
}

/// 进程内共享客户端(首次构建失败的结果一并缓存,避免每轮重试重建)。
fn shared_client() -> Result<&'static reqwest::Client, String> {
    static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(|| build_client(reqwest::Client::builder()))
        .as_ref()
        .map_err(|e| e.clone())
}

// ---------------------------------------------------------------------------
// F-060:jar 探测路径的入库 —— cookie 只在 Rust 内部从 jar 流向后端
// ---------------------------------------------------------------------------

/// `checkin_workbuddy_web_import` 回包:只回入库条数与逐条失败文案,
/// **不含 cookie**(F-060,与 `WebLoginProbe::Ok` 同规)。
#[derive(Debug, Clone, Serialize)]
pub struct WbWebImportResult {
    pub imported: usize,
    pub failures: Vec<String>,
}

/// 入库 POST 目标基址白名单(F-060 的出向闸):命令持有 jar cookie 的读出权,
/// 基址若可被任意指定,cookie 就会被定向送出 —— 只放
/// ①本域 https(aizhs.top 与其子域,与 `is_trusted_return_host` 同口径)
/// ②回环 http(开发期 localhost:8801 / 127.0.0.1:8803;回环之外的 http 明文不放)。
pub fn is_allowed_import_base(base: &str) -> bool {
    let Ok(u) = Url::parse(base.trim().trim_end_matches('/')) else {
        return false;
    };
    if !u.username().is_empty() || u.password().is_some() {
        return false; // user:pass@host 形态一律不认
    }
    // 不直接点名 url::Host(本 crate 未直接声明 url 依赖,tauri::Url 只给到 host_str)
    let Some(host) = u.host_str() else {
        return false;
    };
    let host = host.trim_start_matches('[').trim_end_matches(']');
    match u.scheme() {
        "https" => host == "aizhs.top" || host.ends_with(".aizhs.top"),
        "http" => {
            host == "localhost"
                || host
                    .parse::<std::net::IpAddr>()
                    .map(|ip| ip.is_loopback())
                    .unwrap_or(false)
        }
        _ => false,
    }
}

/// 后端失败响应 → 展示文案(纯函数,单测覆盖)。ai-service 的错误信封是
/// `{success:false, error|detail|message:"…"}`;取不到就退 HTTP 状态码。
/// 只取信封里的短文案,**绝不回吐请求体**(请求体含 jar cookie)。
pub fn import_error_message(status: u16, body: &str) -> String {
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(body) {
        for key in ["error", "detail", "message"] {
            match v.get(key) {
                Some(serde_json::Value::String(s)) if !s.trim().is_empty() => return s.clone(),
                Some(serde_json::Value::Array(arr)) => {
                    let texts: Vec<String> = arr
                        .iter()
                        .filter_map(|x| x.as_str().map(str::to_string))
                        .collect();
                    if !texts.is_empty() {
                        return texts.join("; ");
                    }
                }
                _ => {}
            }
        }
    }
    format!("HTTP {status}")
}

/// 逐条 POST `<基址>/api/checkin/accounts` 入库:cookie 作 `jwt`、用户会话作
/// Bearer,请求体逐字段与前端 `createCheckinAccount` 同形(name=昵称,缺省取
/// uid 前 8 位)。聚合口径与前端导入体一致:逐条独立、失败行 `<昵称或uid>: <原因>`。
/// **目标裁决不在本函数**(白名单/出站门在 `wb_import_from_jar` 与命令入口)。
pub async fn post_checkin_accounts(
    api_base: &str,
    group: &str,
    cookie_header: &str,
    access_token: &str,
    accounts: &[WbWebAccount],
) -> WbWebImportResult {
    let url = format!("{}/api/checkin/accounts", api_base.trim_end_matches('/'));
    let mut out = WbWebImportResult {
        imported: 0,
        failures: Vec::new(),
    };
    let client = shared_client().ok();
    for acc in accounts {
        let display = if acc.nickname.is_empty() {
            acc.uid.clone()
        } else {
            acc.nickname.clone()
        };
        let name = if acc.nickname.is_empty() {
            acc.uid.chars().take(8).collect::<String>()
        } else {
            acc.nickname.clone()
        };
        let body = serde_json::json!({
            "name": name,
            "jwt": cookie_header,
            "device_map": { "login_type": "web", "uid": acc.uid, "nickname": acc.nickname },
            "group": group,
            "platform": "workbuddy",
        });
        let Some(client) = client else {
            out.failures.push(format!("{display}: HTTP 客户端初始化失败"));
            continue;
        };
        let resp = client
            .post(&url)
            .header("accept", "application/json")
            .header("content-type", "application/json")
            .header("authorization", format!("Bearer {access_token}"))
            .header("x-requested-with", "XMLHttpRequest")
            .body(serde_json::to_string(&body).unwrap_or_else(|_| "{}".to_string()))
            .send()
            .await;
        match resp {
            Ok(r) if r.status().is_success() => out.imported += 1,
            Ok(r) => {
                let status = r.status().as_u16();
                let text = r.text().await.unwrap_or_default();
                out.failures
                    .push(format!("{display}: {}", import_error_message(status, &text)));
            }
            Err(e) => out.failures.push(format!("{display}: 请求失败({e})")),
        }
    }
    out
}

/// F-060 入库主流程(jar 探测命令与嵌入看护共用):**cookie 现读现用,
/// 终点只到白名单基址,全程不进前端**。
///
/// 顺序:基址白名单 → 会话非空 → 出站门 → cookie jar 现读 → 逐条 POST。
/// 读 jar 必须在内嵌登录窗关闭**之前**调用(关窗后 webview 没了就读不到)。
pub async fn wb_import_from_jar(
    app: &tauri::AppHandle,
    accounts: &[WbWebAccount],
    group: &str,
    access_token: &str,
    api_base: &str,
) -> Result<WbWebImportResult, IpcError> {
    if !is_allowed_import_base(api_base) {
        return Err(IpcError::permission(format!(
            "导入基址不在白名单内: {api_base}"
        )));
    }
    if access_token.trim().is_empty() {
        return Err(IpcError::permission(
            "缺少用户登录态(access_token),无法入库,请重新登录后重试",
        ));
    }
    let target = format!("{}/api/checkin/accounts", api_base.trim_end_matches('/'));
    if let Err(denied) = crate::egress_gate::guard_egress_target(&target) {
        return Err(IpcError::permission(format!(
            "出口门拒绝该目标: {denied}"
        )));
    }
    let url = Url::parse(&format!("{WB_WEB_ORIGIN}/"))
        .map_err(|e| IpcError::internal(format!("URL 解析失败: {e}")))?;
    let win = active_webview(app).ok_or_else(|| {
        IpcError::not_found(
            "内嵌浏览器窗口不在,读不到 WorkBuddy 登录 Cookie(请先完成网页登录)",
        )
    })?;
    let cookies = win
        .cookies_for_url(url)
        .map_err(|e| IpcError::internal(format!("读取登录 Cookie 失败: {e}")))?;
    let Some(cookie_header) = cookie_header_from_jar(&cookies) else {
        return Err(IpcError::not_found(
            "内嵌浏览器 cookie jar 里没有 WorkBuddy 登录 Cookie,请先完成网页登录",
        ));
    };
    Ok(post_checkin_accounts(api_base, group, &cookie_header, access_token, accounts).await)
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

    match probe_cookie_accounts(&cookie_header).await {
        Ok(outcome) => Ok(WebLoginProbe::Ok {
            accounts: outcome.accounts,
            cookie_checkin_ok: outcome.cookie_checkin_ok,
        }),
        Err(msg) => Ok(WebLoginProbe::NotLoggedIn {
            message: msg,
        }),
    }
}

/// 用**用户粘贴的 Cookie**直探测(2026-10-18 主窗默认浏览器版收尾):
/// 默认浏览器登录后应用读不到它的 cookie jar(浏览器安全隔离),由用户把 Cookie
/// 粘过来;粘贴路径与内嵌路径共用同一个服务端探测 ⇒ 同样能取到 uid/昵称,
/// 「记录好账号」不因入口不同而缺位。探测不到账号 ⇒ NotLoggedIn(带原因),
/// 前端如实拒绝入库,不落无名账号。
#[tauri::command]
pub async fn checkin_workbuddy_web_login_probe_cookie(
    cookie: String,
) -> Result<WebLoginProbe, IpcError> {
    let cookie_header = cookie.trim().replace('\n', " ");
    if cookie_header.is_empty() {
        return Ok(WebLoginProbe::NotLoggedIn {
            message: "Cookie 为空".to_string(),
        });
    }
    match probe_cookie_accounts(&cookie_header).await {
        Ok(outcome) => Ok(WebLoginProbe::Ok {
            accounts: outcome.accounts,
            cookie_checkin_ok: outcome.cookie_checkin_ok,
        }),
        Err(msg) => Ok(WebLoginProbe::NotLoggedIn { message: msg }),
    }
}

/// F-060:jar 探测路径的**入库命令**(探测回包已不再携带 cookie)。
/// 前端只带「给谁入库 + 用户会话 + 后端基址」三样,cookie 由 Rust 从内嵌浏览器
/// cookie jar 现读,直 POST `<基址>/api/checkin/accounts`;白名单/会话/读 jar
/// 失败以 `IpcError` 上抛,逐条入库失败在 `failures` 里如实聚合(口径与前端
/// 旧导入体一致)。请求体形状、鉴权头与前端 `createCheckinAccount` 逐字段等价,
/// 后端鉴权(`Authorization: Bearer`)不降级。
#[tauri::command]
pub async fn checkin_workbuddy_web_import(
    app: tauri::AppHandle,
    accounts: Vec<WbWebAccount>,
    group: String,
    access_token: String,
    api_base: String,
) -> Result<WbWebImportResult, IpcError> {
    wb_import_from_jar(&app, &accounts, &group, &access_token, &api_base).await
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

    #[test]
    fn ok_probe_serialization_hides_cookie_per_f060() {
        // F-060:jar 探测回包**不得含 cookie** —— 前端契约是
        // {status, accounts, cookie_checkin_ok},入库改走
        // checkin_workbuddy_web_import(cookie 留在 Rust)。
        let probe = WebLoginProbe::Ok {
            accounts: vec![WbWebAccount {
                uid: "u-1".to_string(),
                nickname: "李总".to_string(),
            }],
            cookie_checkin_ok: Some(true),
        };
        let json = serde_json::to_value(&probe).expect("WebLoginProbe 应可序列化");
        assert_eq!(json["status"], "ok");
        assert!(
            json.get("cookie").is_none(),
            "F-060:cookie 不得出现在探测回包里:{json}"
        );
        assert_eq!(json["accounts"][0]["uid"], "u-1");
        assert_eq!(json["cookie_checkin_ok"], true);
    }

    #[test]
    fn import_base_whitelist_only_aizhs_https_and_loopback_http() {
        // 白名单是 cookie 的出向闸:放行本域 https 与回环 http,其余(含明文本域、
        // 外域、内网 http、带凭据 URL、javascript:)一律不认。
        assert!(is_allowed_import_base("https://aizhs.top"));
        assert!(is_allowed_import_base("https://aizhs.top/"));
        assert!(is_allowed_import_base("https://ai.aizhs.top"));
        assert!(is_allowed_import_base("http://127.0.0.1:8803"));
        assert!(is_allowed_import_base("http://localhost:8801"));
        assert!(is_allowed_import_base("http://[::1]:8803"));
        assert!(!is_allowed_import_base(""));
        assert!(!is_allowed_import_base("http://aizhs.top"));
        assert!(!is_allowed_import_base("https://aizhs.top.evil.com"));
        assert!(!is_allowed_import_base("http://aizhs.top.evil.com"));
        assert!(!is_allowed_import_base("https://evil.example"));
        assert!(!is_allowed_import_base("http://10.0.0.5:8803"));
        assert!(!is_allowed_import_base("https://user:pass@aizhs.top"));
        assert!(!is_allowed_import_base("javascript:alert(1)"));
    }

    #[test]
    fn import_error_message_reads_envelope_then_status() {
        assert_eq!(
            import_error_message(409, r#"{"success":false,"error":"此账号已存在"}"#),
            "此账号已存在"
        );
        assert_eq!(
            import_error_message(400, r#"{"detail":"参数非法"}"#),
            "参数非法"
        );
        assert_eq!(import_error_message(500, "<html>boom</html>"), "HTTP 500");
        // 信封里塞不进请求体外带:没文案就退状态码,不吐原始 body
        assert_eq!(import_error_message(422, r#"{"other":1}"#), "HTTP 422");
    }

    /// 极简回放服务:按序回每个连接回一条预置响应,把收到的原始请求收进 `seen`。
    fn spawn_import_echo_server(
        responses: Vec<(u16, &'static str)>,
    ) -> (String, std::sync::Arc<std::sync::Mutex<Vec<String>>>) {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("回环端口可绑");
        let addr = listener.local_addr().expect("本地地址可读");
        let seen = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let seen2 = seen.clone();
        std::thread::spawn(move || {
            for (code, body) in responses {
                let Ok((mut sock, _)) = listener.accept() else {
                    break;
                };
                sock.set_read_timeout(Some(Duration::from_secs(5))).ok();
                let mut buf: Vec<u8> = Vec::new();
                let mut chunk = [0u8; 4096];
                loop {
                    match sock.read(&mut chunk) {
                        Ok(0) => break,
                        Ok(n) => {
                            buf.extend_from_slice(&chunk[..n]);
                            let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") else {
                                continue;
                            };
                            let head = String::from_utf8_lossy(&buf[..pos]).to_string();
                            let content_len = head
                                .lines()
                                .find_map(|l| {
                                    let (k, v) = l.split_once(':')?;
                                    if k.trim().eq_ignore_ascii_case("content-length") {
                                        v.trim().parse::<usize>().ok()
                                    } else {
                                        None
                                    }
                                })
                                .unwrap_or(0);
                            if buf.len() >= pos + 4 + content_len {
                                seen2
                                    .lock()
                                    .expect("seen 锁")
                                    .push(String::from_utf8_lossy(&buf[..pos + 4 + content_len]).to_string());
                                break;
                            }
                        }
                        Err(_) => break,
                    }
                }
                let resp = format!(
                    "HTTP/1.1 {code} X\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = sock.write_all(resp.as_bytes());
                let _ = sock.flush();
            }
        });
        (format!("http://{addr}"), seen)
    }

    #[tokio::test]
    async fn jar_import_posts_cookie_and_bearer_to_backend_result_has_no_cookie() {
        // F-060 主证据:cookie 只出现在「Rust → 后端」的请求体里(等价于旧
        // jwt:<cookie> 的前端 POST),回包只回 {imported, failures},无 cookie 键。
        let (base, seen) = spawn_import_echo_server(vec![
            (201, r#"{"success":true,"data":{"id":1}}"#),
            (409, r#"{"success":false,"error":"此账号已存在"}"#),
        ]);
        let cookie = "session_id=SECRET-WB-COOKIE; wb_uid=u-1";
        let accounts = vec![
            WbWebAccount {
                uid: "uid-000001".to_string(),
                nickname: "李总".to_string(),
            },
            WbWebAccount {
                uid: "uid-000002".to_string(),
                nickname: String::new(),
            },
        ];
        let out = post_checkin_accounts(&base, "默认分组", cookie, "user-access-token", &accounts).await;
        assert_eq!(out.imported, 1, "201 应计成功");
        assert_eq!(
            out.failures,
            vec!["uid-000002: 此账号已存在".to_string()],
            "失败聚合口径与前端一致:<昵称或uid>: <原因>"
        );
        // 回包不含 cookie,也不含任何凭据片段
        let wire = serde_json::to_value(&out).expect("结果可序列化");
        assert!(wire.get("cookie").is_none(), "F-060:回包不得有 cookie 键");
        assert!(!wire.to_string().contains("SECRET-WB-COOKIE"));
        let seen = seen.lock().expect("seen 锁");
        assert_eq!(seen.len(), 2, "两条账号各发一次 POST");
        let head0 = seen[0].to_ascii_lowercase();
        assert!(
            head0.contains("authorization: bearer user-access-token"),
            "必须带用户会话 Bearer(后端鉴权不降级)"
        );
        assert!(seen[0].contains("SECRET-WB-COOKIE"), "cookie 走请求体进后端");
        assert!(seen[0].contains(r#""platform":"workbuddy""#));
        assert!(seen[0].contains(r#""group":"默认分组""#));
        assert!(seen[0].contains(r#""name":"李总""#));
        assert!(seen[0].contains(r#""uid":"uid-000001""#));
        // 无昵称的账号 name 取 uid 前 8 位(与前端 acc.uid.slice(0, 8) 同口径)
        assert!(seen[1].contains(r#""name":"uid-0000""#));
    }

    #[test]
    fn build_client_invalid_config_returns_err_not_panic() {
        // 非法默认 User-Agent(含换行)会记入 builder 配置错误 → build() 返回 Err;
        // 旧实现 `.expect(...)` 在此处会 panic,新实现必须走 Err 传播。
        let built = build_client(reqwest::Client::builder().user_agent("bad\nagent"));
        assert!(built.is_err(), "非法配置应返回 Err 而非 panic");
    }
}
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
