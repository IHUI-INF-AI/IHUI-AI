// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! WorkBuddy「网页登录自动添加账号」——**浏览器扫码版**(2026-10-15 改版)。
//!
//! ## 形态演进
//!
//! - 2026-10-12 初版:内嵌 WebView2 弹窗加载 www.workbuddy.cn,probe 从弹窗
//!   cookie jar(cookies_for_url)读登录态。2026-10-13 修过一次 sync 命令主线程
//!   自锁死的白屏根因(open/close async 化)。
//! - **2026-10-15 本版**:用户拍板「弹窗形式不对,应该是打开浏览器去扫码」,
//!   内嵌窗口三件套废弃。改走**真 Google Chrome**:
//!   1. 前端复用既有 `open_in_chrome` 命令(Chrome `--app` + `--remote-debugging-port`
//!      + 专用 profile `%TEMP%\ihui-chrome-profile`)在**真浏览器窗口**里登录;
//!   2. `checkin_workbuddy_web_login_probe(port)`:CDP WebSocket `Storage.getCookies`
//!      → 过滤 workbuddy.cn → Rust 侧直调 /console/accounts 验证登录态并取 uid/昵称;
//!   3. 验证通过 → 返回 {status:"ok", cookie, accounts},前端自动入库并
//!      `closeChromeWindow(port, origin)` 收尾。
//!
//! ## 为什么不是「系统默认浏览器」(决策记录,2026-10-15)
//!
//! 登录态 = workbuddy.cn 全量 Cookie(HttpOnly)。Chrome/Edge 127+ 的 Cookie 落盘
//! 走 **App-Bound Encryption(v20)**,密钥由 SYSTEM 级提权服务持有且严格校验调用方
//! 进程身份,第三方用户态进程解不开(2026-10 社区实证,全部绕过 0x8004B016)——
//! 「默认浏览器里登录 → 事后从 Cookie 库取回」这条链路根本不通,自动导入会死。
//! 而 CDP 是**浏览器进程自己吐 Cookie**(明文、含 HttpOnly),天然免疫 App-Bound;
//! `open_in_chrome` 正是本项目既有范式(2026-08-17 用户亲定「内置浏览器要 Google
//! Chrome,不要 Edge」)。故形态=真 Chrome 窗口(可扫码),机制=CDP 回收登录态。
//!
//! 已知边界:`open_in_chrome` 复用同一 profile;若该 profile 的 Chrome 实例已在跑
//! (如工作台 SSO 登录窗),新调用的 `--remote-debugging-port` 不生效( joining 既有
//! 进程),probe 会报「调试通道不可用」——引导用户关掉旧窗口重试即可。
//!
//! 服务端契约(2026-10-12 asar 逆向实证,未变):签到接口本域
//! /v2/billing/meter/daily-checkin;网页版全 Cookie 认证;Cookie 30 天滚动,
//! 过期由签到 401 → SessionDead 永久冷却 → 提示重新网页登录。
//!
//! 判据与执行分离:纯函数(WS 帧/CDP 解析/Cookie 拼接/响应解析)在此文件可单测,
//! `#[tauri::command]` 只做编排。HTTP 用 reqwest(无 json feature,取 text 再解析,
//! 与 lib.rs close_in_chrome 同一约束,不开第二份依赖)。

use serde::Serialize;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::OnceLock;
use std::time::Duration;

use crate::IpcError;

/// 网页版站点根(本域 API 基址:/console/accounts、/v2/billing/meter/* 都挂在它下面)。
/// 注意:**不是**登录入口 —— 前端 `openInGoogleChrome` 开窗用的是真实登录页
/// `WB_WEB_LOGIN_URL`(https://www.workbuddy.cn/login/?platform=website&state=2&
/// product=workbuddy&redirect_uri=…,扫码/账号密码);裸 origin 是产品营销首页,
/// 没有任何登录入口(2026-10-15 实证修正)。
pub const WB_WEB_ORIGIN: &str = "https://www.workbuddy.cn";
/// /console/accounts 响应里取账号的 JSON 路径:data.accounts[]。
const ACCOUNTS_PATH: &str = "/console/accounts";
/// 轮询时把 cookie 换登录态的 HTTP 超时。
const PROBE_HTTP_TIMEOUT_SECS: u64 = 10;
/// CDP 单步(HTTP /json/version、TCP 连接、单帧读写)超时。轮询 2.5s 一轮,超时要短。
const CDP_STEP_TIMEOUT_SECS: u64 = 5;
/// CDP 只认本机回环:ws url host 非 127.0.0.1 一律拒绝(端口来自我们自建的 Chrome)。
const CDP_ALLOWED_HOST: &str = "127.0.0.1";

// ---------------------------------------------------------------------------
// 纯函数(单测覆盖)
// ---------------------------------------------------------------------------

/// /json/version 响应体 → CDP 浏览器端 WebSocket 地址。
/// 只接受 `ws://127.0.0.1:*`(open_in_chrome 的端口只会是本机回环,其余形态一律拒)。
pub fn ws_url_from_version_body(body: &str) -> Option<String> {
    let v = serde_json::from_str::<serde_json::Value>(body).ok()?;
    let url = v.get("webSocketDebuggerUrl")?.as_str()?;
    let rest = url.strip_prefix("ws://")?;
    let host = rest.split('/').next()?.split(':').next()?;
    if host != CDP_ALLOWED_HOST {
        return None;
    }
    Some(url.to_string())
}

/// CDP 响应 → [(name, value, domain)]。兼容 `result.cookies` 与顶层 `cookies`
/// (后者仅供测试直喂,不再多包一层 JSON)。
pub fn cdp_cookie_tuples(v: &serde_json::Value) -> Vec<(String, String, String)> {
    let list = v
        .get("result")
        .and_then(|r| r.get("cookies"))
        .or_else(|| v.get("cookies"))
        .and_then(|c| c.as_array());
    let Some(list) = list else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for item in list {
        let Some(name) = item.get("name").and_then(|n| n.as_str()) else {
            continue;
        };
        let Some(value) = item.get("value").and_then(|x| x.as_str()) else {
            continue;
        };
        let Some(domain) = item.get("domain").and_then(|d| d.as_str()) else {
            continue;
        };
        out.push((name.to_string(), value.to_string(), domain.to_string()));
    }
    out
}

/// Cookie 行是否属于 workbuddy.cn 域族(登录会跳子域,域族全收)。
fn is_workbuddy_domain(domain: &str) -> bool {
    let d = domain.trim().trim_start_matches('.');
    d == "workbuddy.cn" || d.ends_with(".workbuddy.cn")
}

/// CDP cookie 元组 → 请求头 Cookie 串("k=v; k2=v2")。无 workbuddy 域族命中返回 None。
pub fn cookie_header_from_tuples(tuples: &[(String, String, String)]) -> Option<String> {
    let parts: Vec<String> = tuples
        .iter()
        .filter(|(name, _, domain)| !name.trim().is_empty() && is_workbuddy_domain(domain))
        .map(|(name, value, _)| format!("{name}={value}"))
        .collect();
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("; "))
    }
}

/// CDP 响应文本 → Cookie 串。CDP error 响应显式报错(不冒充 NoCookie)。
pub fn cookie_header_from_cdp_body(body: &str) -> Result<Option<String>, String> {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(body) else {
        return Err(format!("CDP 响应不是 JSON: {}", truncate_log(body, 120)));
    };
    if let Some(err) = v.get("error") {
        return Err(format!("CDP 返回错误: {err}"));
    }
    Ok(cookie_header_from_tuples(&cdp_cookie_tuples(&v)))
}

fn truncate_log(s: &str, max: usize) -> &str {
    if s.len() <= max {
        s
    } else {
        let mut end = max;
        while end > 0 && !s.is_char_boundary(end) {
            end -= 1;
        }
        &s[..end]
    }
}

/// RFC6455 客户端帧(必须掩码):FIN=1 单帧,text/ping/pong 由 opcode 决定。
pub fn build_client_frame(opcode: u8, payload: &[u8], mask: [u8; 4]) -> Vec<u8> {
    let mut out = vec![0x80 | opcode];
    let len = payload.len();
    if len < 126 {
        out.push(0x80 | len as u8);
    } else if len <= 0xffff {
        out.push(0x80 | 126);
        out.extend_from_slice(&(len as u16).to_be_bytes());
    } else {
        out.push(0x80 | 127);
        out.extend_from_slice(&(len as u64).to_be_bytes());
    }
    out.extend_from_slice(&mask);
    for (i, b) in payload.iter().enumerate() {
        out.push(b ^ mask[i % 4]);
    }
    out
}

/// 读一个服务端帧(服务端帧不掩码;防御式兼容掩码帧):返回 (opcode, payload)。
pub fn read_ws_frame(r: &mut impl Read) -> std::io::Result<(u8, Vec<u8>)> {
    let mut head = [0u8; 2];
    r.read_exact(&mut head)?;
    let opcode = head[0] & 0x0f;
    let masked = head[1] & 0x80 != 0;
    let len7 = head[1] & 0x7f;
    let len = match len7 {
        126 => {
            let mut b = [0u8; 2];
            r.read_exact(&mut b)?;
            u16::from_be_bytes(b) as usize
        }
        127 => {
            let mut b = [0u8; 8];
            r.read_exact(&mut b)?;
            let n = u64::from_be_bytes(b) as usize;
            // 防御:单帧上限 64MiB,超过即视为协议错(Storage.getCookies 远到不了这个量级)
            if n > 64 * 1024 * 1024 {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "ws 帧长度异常",
                ));
            }
            n
        }
        n => n as usize,
    };
    let mask = if masked {
        let mut m = [0u8; 4];
        r.read_exact(&mut m)?;
        Some(m)
    } else {
        None
    };
    let mut payload = vec![0u8; len];
    r.read_exact(&mut payload)?;
    if let Some(mask) = mask {
        for (i, b) in payload.iter_mut().enumerate() {
            *b ^= mask[i % 4];
        }
    }
    Ok((opcode, payload))
}

/// 掩码字节。CDP 回环单发即收,不具嗅探价值,非加密用途;取纳秒+地址合成即可。
fn fresh_mask() -> [u8; 4] {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos() as u64 ^ d.as_secs())
        .unwrap_or(0x5eed);
    let seed = nanos ^ (&nanos as *const u64 as u64);
    (seed as u32).to_le_bytes()
}

fn cdp_ws_key() -> String {
    // Sec-WebSocket-Key 只要求 16 字节随机(base64),不要求密码学质量(回环自连)
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0);
    let seed = nanos ^ std::process::id() as u64;
    let bytes = seed.to_le_bytes().repeat(2);
    use base64::Engine as _;
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

/// 最小 CDP WebSocket 客户端:连本机回环 → 握手 → 发一条 `Storage.getCookies`
/// → 收到含 cookies(或 error)的首条文本消息 → 关闭。
///
/// 为什么自实现而不引 tokio-tungstenite:用途只有"回环单发单收",RFC6455 客户端面
/// (掩码发送/长度三档/ping→pong)百余行;为一个命令拉一整棵 ws 依赖树不划算
/// (依赖纪律:能不加就不加)。Chrome 只在空闲时发 ping,本函数秒级往返,必回 pong。
fn cdp_storage_get_cookies(ws_url: &str) -> Result<String, String> {
    let rest = ws_url
        .strip_prefix("ws://")
        .ok_or_else(|| format!("非 ws:// 地址: {ws_url}"))?;
    let (hostport, path) = rest.split_once('/').unwrap_or((rest, ""));
    let (host, port) = hostport
        .split_once(':')
        .ok_or_else(|| format!("CDP 地址缺端口: {ws_url}"))?;
    if host != CDP_ALLOWED_HOST {
        return Err(format!("CDP 地址非本机回环: {host}"));
    }
    let port: u16 = port.parse().map_err(|e| format!("CDP 端口解析失败: {e}"))?;
    let addr = format!("{host}:{port}");
    let stream = TcpStream::connect_timeout(
        &addr
            .parse()
            .map_err(|e| format!("CDP 地址解析失败: {e}"))?,
        Duration::from_secs(CDP_STEP_TIMEOUT_SECS),
    )
    .map_err(|e| format!("连接 Chrome 调试端口失败: {e}"))?;
    stream.set_nodelay(true).ok();
    stream
        .set_read_timeout(Some(Duration::from_secs(CDP_STEP_TIMEOUT_SECS)))
        .ok();
    stream
        .set_write_timeout(Some(Duration::from_secs(CDP_STEP_TIMEOUT_SECS)))
        .ok();
    let mut stream = stream;

    let request = format!(
        "GET /{path} HTTP/1.1\r\n\
         Host: {hostport}\r\n\
         Upgrade: websocket\r\n\
         Connection: Upgrade\r\n\
         Sec-WebSocket-Key: {}\r\n\
         Sec-WebSocket-Version: 13\r\n\
         \r\n",
        cdp_ws_key(),
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|e| format!("WS 握手请求发送失败: {e}"))?;

    // 读握手响应头(到空行为止),必须 101
    let mut head = Vec::new();
    let mut byte = [0u8; 1];
    loop {
        stream
            .read(&mut byte)
            .map_err(|e| format!("WS 握手响应读取失败: {e}"))?;
        head.push(byte[0]);
        if head.ends_with(b"\r\n\r\n") || head.len() > 16 * 1024 {
            break;
        }
    }
    let head = String::from_utf8_lossy(&head);
    if !head.starts_with("HTTP/1.1 101") && !head.starts_with("HTTP/1.0 101") {
        return Err(format!("WS 握手被拒: {}", truncate_log(head.trim(), 120)));
    }

    let message = b"{\"id\":1,\"method\":\"Storage.getCookies\"}";
    let frame = build_client_frame(0x1, message, fresh_mask());
    stream
        .write_all(&frame)
        .map_err(|e| format!("WS 查询发送失败: {e}"))?;

    // 收帧:文本(含分片)拼接完整消息;ping 必回 pong;close/异常即报错
    let mut acc: Vec<u8> = Vec::new();
    loop {
        let (opcode, payload) =
            read_ws_frame(&mut stream).map_err(|e| format!("WS 读取失败: {e}"))?;
        match opcode {
            0x1 | 0x2 | 0x0 => {
                acc.extend_from_slice(&payload);
                let is_final_text = opcode == 0x1;
                if is_final_text && acc.iter().any(|&b| b == b'{') {
                    let text = String::from_utf8_lossy(&acc).to_string();
                    if text.contains("\"cookies\"") || text.contains("\"error\"") {
                        return Ok(text);
                    }
                }
                if is_final_text {
                    acc.clear();
                }
            }
            0x9 => {
                let pong = build_client_frame(0xA, &payload, fresh_mask());
                stream
                    .write_all(&pong)
                    .map_err(|e| format!("WS pong 发送失败: {e}"))?;
            }
            0x8 => return Err("Chrome 提前关闭了调试连接".to_string()),
            _ => {} // pong/其它忽略
        }
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
    /// 浏览器登录窗口已不在(用户关掉 Chrome / 调试端口失效)。前端提示可重开。
    NoWindow,
    /// 浏览器在,但 cookie jar 还没有 workbuddy.cn 域族的任何 cookie(未登录/加载中)。
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

/// CDP 阶段(阻塞 IO,跑在 spawn_blocking):WS 单发单收取回响应文本。
/// /json/version 的 HTTP 在命令主体 async 侧完成(async reqwest,不混阻塞)。
fn cdp_ws_fetch(ws_url: &str) -> Result<String, String> {
    cdp_storage_get_cookies(ws_url)
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

/// 轮询探测(2026-10-15 浏览器扫码版):CDP 读 Chrome cookie jar →
/// Rust 侧 GET /console/accounts 验证登录态并取账号。
///
/// `port` 来自前端 `openInGoogleChrome`(既有 `open_in_chrome` 命令)的返回值。
/// 整条 CDP 链路是阻塞 IO(自实现 WS,不走 tokio),必须 spawn_blocking ——
/// 绝不内联在 IPC 执行器上跑(2026-10-13 白屏死锁同款教训:sync 命令主线程内联)。
#[tauri::command]
pub async fn checkin_workbuddy_web_login_probe(port: u16) -> Result<WebLoginProbe, IpcError> {
    if port == 0 {
        return Ok(WebLoginProbe::Error {
            message: "CDP 端口非法(0),请重新打开浏览器登录".to_string(),
        });
    }
    // async HTTP:/json/version 连不上 = Chrome 已退/调试端口没起来(含 profile 被
    // 既有实例 joining 后新端口不生效的边界)⇒ 前端按"浏览器已关闭"提示重开。
    let body = match shared_client()
        .get(format!("http://127.0.0.1:{port}/json/version"))
        .send()
        .await
    {
        Ok(r) => match r.text().await {
            Ok(t) => t,
            Err(e) => {
                return Ok(WebLoginProbe::Error {
                    message: format!("读取 Chrome 调试信息失败: {e}"),
                })
            }
        },
        Err(_) => return Ok(WebLoginProbe::NoWindow),
    };
    let Some(ws_url) = ws_url_from_version_body(&body) else {
        return Ok(WebLoginProbe::Error {
            message: "Chrome 调试通道不可用(可能该 profile 的旧 Chrome 实例仍在跑)。请关闭已打开的 Chrome 登录窗口后重试。".to_string(),
        });
    };
    // 阻塞 WS(自实现 RFC6455,纯 std::net)必须 spawn_blocking ——
    // 绝不内联在 IPC 执行器上跑(2026-10-13 白屏死锁同款教训)。
    let ws_result = tauri::async_runtime::spawn_blocking(move || cdp_ws_fetch(&ws_url))
        .await
        .unwrap_or_else(|e| Err(format!("CDP 探测任务异常: {e}")));
    let cookie_header = match ws_result {
        Ok(text) => match cookie_header_from_cdp_body(&text) {
            Ok(Some(cookie)) => cookie,
            Ok(None) => return Ok(WebLoginProbe::NoCookie),
            Err(e) => return Ok(WebLoginProbe::Error { message: e }),
        },
        Err(e) => return Ok(WebLoginProbe::Error { message: e }),
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
    use std::io::Cursor;

    #[test]
    fn ws_url_from_version_body_ok_and_host_guard() {
        let body = r#"{"Browser":"Chrome/140.0.0.0","webSocketDebuggerUrl":"ws://127.0.0.1:54321/devtools/browser/abc-def"}"#;
        assert_eq!(
            ws_url_from_version_body(body).as_deref(),
            Some("ws://127.0.0.1:54321/devtools/browser/abc-def")
        );
        // 非 127.0.0.1 host 拒收
        assert!(ws_url_from_version_body(
            r#"{"webSocketDebuggerUrl":"ws://192.168.1.9:9222/devtools/browser/x"}"#
        )
        .is_none());
        // 非 ws scheme 拒收
        assert!(ws_url_from_version_body(
            r#"{"webSocketDebuggerUrl":"wss://127.0.0.1:9222/x"}"#
        )
        .is_none());
        // 缺字段
        assert!(ws_url_from_version_body(r#"{"Browser":"Chrome"}"#).is_none());
        assert!(ws_url_from_version_body("not json").is_none());
    }

    #[test]
    fn cdp_cookie_tuples_shapes() {
        let v: serde_json::Value = serde_json::from_str(
            r#"{"id":1,"result":{"cookies":[
                {"name":"session_id","value":"abc","domain":".workbuddy.cn"},
                {"name":"other","value":"x","domain":"example.com"},
                {"name":"","value":"y","domain":"workbuddy.cn"}
            ]}}"#,
        )
        .unwrap();
        assert_eq!(cdp_cookie_tuples(&v).len(), 3);
        // 顶层 cookies 形态(测试直喂)
        let top: serde_json::Value =
            serde_json::from_str(r#"{"cookies":[{"name":"a","value":"1","domain":"workbuddy.cn"}]}"#)
                .unwrap();
        assert_eq!(cdp_cookie_tuples(&top).len(), 1);
        // 缺 cookies 键
        assert!(cdp_cookie_tuples(&serde_json::json!({})).is_empty());
    }

    #[test]
    fn cookie_header_from_tuples_filters_workbuddy_family() {
        let tuples = vec![
            ("session_id".into(), "abc123".into(), ".workbuddy.cn".into()),
            ("wb_uid".into(), "u-1".into(), "www.workbuddy.cn".into()),
            ("noise".into(), "x".into(), "example.com".into()),
            ("".into(), "y".into(), "workbuddy.cn".into()),
        ];
        let header = cookie_header_from_tuples(&tuples).expect("workbuddy cookies present");
        assert_eq!(header, "session_id=abc123; wb_uid=u-1");
        // 全是域外 cookie ⇒ None(= NoCookie)
        let foreign = vec![("a".into(), "1".into(), "example.com".into())];
        assert!(cookie_header_from_tuples(&foreign).is_none());
    }

    #[test]
    fn cookie_header_from_cdp_body_error_and_ok() {
        // CDP error 响应显式报错,不冒充 NoCookie
        let err = cookie_header_from_cdp_body(r#"{"id":1,"error":{"code":-32601,"message":"x"}}"#);
        assert!(err.is_err());
        let ok = cookie_header_from_cdp_body(
            r#"{"id":1,"result":{"cookies":[{"name":"k","value":"v","domain":".workbuddy.cn"}]}}"#,
        )
        .unwrap();
        assert_eq!(ok.as_deref(), Some("k=v"));
        // 非 JSON
        assert!(cookie_header_from_cdp_body("<html>err</html>").is_err());
    }

    #[test]
    fn client_frame_masks_and_lengths() {
        // 小帧:7-bit 长度 + 掩码 XOR 可逆
        let payload = b"hi";
        let frame = build_client_frame(0x1, payload, [0x01, 0x02, 0x03, 0x04]);
        assert_eq!(frame[0], 0x81);
        assert_eq!(frame[1], 0x80 | 2);
        assert_eq!(&frame[2..6], &[0x01, 0x02, 0x03, 0x04]);
        assert_eq!(&frame[6..], &[b'h' ^ 0x01, b'i' ^ 0x02]);

        // 16-bit 长度
        let big = vec![b'x'; 300];
        let frame = build_client_frame(0x1, &big, [0; 4]);
        assert_eq!(frame[1], 0x80 | 126);
        assert_eq!(&frame[2..4], &300u16.to_be_bytes());

        // 64-bit 长度
        let huge = vec![b'x'; 70_000];
        let frame = build_client_frame(0x1, &huge, [0; 4]);
        assert_eq!(frame[1], 0x80 | 127);
        assert_eq!(&frame[2..10], &(70_000u64).to_be_bytes());
    }

    #[test]
    fn read_ws_frame_unmasked_and_masked() {
        // 服务端帧:FIN=1 text,无掩码,7-bit 长度
        let raw = [0x81u8, 3, b'a', b'b', b'c'];
        let (op, payload) = read_ws_frame(&mut Cursor::new(raw)).unwrap();
        assert_eq!((op, payload.as_slice()), (0x1, b"abc".as_slice()));

        // 16-bit 长度
        let mut raw = vec![0x81u8, 126];
        raw.extend_from_slice(&300u16.to_be_bytes());
        raw.extend(std::iter::repeat_n(b'z', 300));
        let (op, payload) = read_ws_frame(&mut Cursor::new(&raw)).unwrap();
        assert_eq!(op, 0x1);
        assert_eq!(payload.len(), 300);

        // 掩码帧(防御式解掩码)
        let raw = [0x81u8, 0x80 | 2, 1, 2, 3, 4, b'a' ^ 1, b'b' ^ 2];
        let (_, payload) = read_ws_frame(&mut Cursor::new(raw)).unwrap();
        assert_eq!(payload, b"ab");
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
