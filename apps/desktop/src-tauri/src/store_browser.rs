// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 应用上架平台「每账号独立浏览器」窗口(2026-11-14 立)。
//!
//! 号池里的商店账号按账号 id 各开一个 WebviewWindow,并给每个窗口指定独立的
//! WebView2 data_directory —— Cookie/LocalStorage 各自落盘、互不覆盖,关窗或
//! 重启应用后再打开仍是原账号的登录态。窗口不登记进 capabilities 的 windows 面,
//! 外部站点拿不到任何 IPC。

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::webview::cookie::{Cookie, Expiration, SameSite};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const STORE_WINDOW_PREFIX: &str = "store-account-";
/// 已打开账号窗口的静默保活间隔:太密会触发平台风控,太疏起不到滑动续期作用。
const KEEPALIVE_INTERVAL: Duration = Duration::from_secs(600);

/// 内置浏览器里「商店后台标签」的映射:标签 id → 平台码。
///
/// 默认形态是**程序自己的内置浏览器一窗多标签**(用户口径 2026-11-15:
/// "不要跳出程序外单独开这么多窗口")。标签共享内置浏览器那一份 profile,
/// 靠 Cookie 域天然隔离各平台;这份映射只用于两件事 —— 心跳续期时按平台
/// 定位标签、关窗回写种子时知道哪些 Cookie 该抄进哪个平台槽。
static STORE_TABS: Mutex<Vec<(u64, String)>> = Mutex::new(Vec::new());

/// 已完成种子注入的标签 id。
///
/// 注入只能做一次(且在 CoreWebView2 就绪之后),重复注入会把平台自己刚更新的票
/// 用旧种子顶回去 —— 那正是「登录完反而掉线」的成因。
static SEEDED_TABS: Mutex<Vec<u64>> = Mutex::new(Vec::new());

/// 记下「这个标签属于哪个平台」。同一平台重开时先摘旧 id,避免僵尸映射。
fn remember_store_tab(id: u64, platform_code: &str) {
    let mut guard = STORE_TABS.lock().unwrap_or_else(|e| e.into_inner());
    guard.retain(|(_, code)| code.as_str() != platform_code);
    guard.push((id, platform_code.to_string()));
}

/// 取某平台对应的标签 id(不存在返回 None)。
fn store_tab_id(platform_code: &str) -> Option<u64> {
    let guard = STORE_TABS.lock().unwrap_or_else(|e| e.into_inner());
    guard
        .iter()
        .find(|(_, code)| code.as_str() == platform_code)
        .map(|(id, _)| *id)
}

/// 取某平台当前登录态的 Cookie 罐。
///
/// 内置浏览器标签优先(默认形态),其次是旧形态的独立窗口;两者都没有 ⇒ None。
fn store_platform_cookies(
    app: &AppHandle,
    platform_code: &str,
    default_uid: &str,
) -> Option<Vec<Cookie<'static>>> {
    if let Some(id) = store_tab_id(platform_code) {
        if let Some(wv) = app.get_webview(&crate::embedded_browser::tab_webview_label(id)) {
            if let Ok(list) = wv.jar_cookies() {
                return Some(list);
            }
        }
    }
    let key = format!("{}__{}", platform_code, fnv1a_base36(default_uid));
    app.get_webview_window(&window_label(&key))
        .and_then(|w| w.jar_cookies().ok())
}

/// 商店平台登录页允许主机(与 packages/shared/src/constants/store-platforms.ts 对齐)。
/// 即使本机没有该平台的种子文件,也不允许把任意站点装进商店账号窗口。
const STORE_PLATFORM_LOGIN_HOSTS: &[(&str, &str)] = &[
    ("huawei-agc", "developer.huawei.com"),
    ("oppo-store", "open.oppomobile.com"),
    ("vivo-store", "dev.vivo.com.cn"),
    ("xiaomi-store", "dev.mi.com"),
    ("honor-store", "developer.honor.com"),
    ("yyb-store", "app.open.qq.com"),
    ("google-play", "play.google.com"),
];

/// 本机会话种子目录:优先环境变量,其次常见同步盘盘符(与项目密钥纪律同口径)。
fn secret_dir() -> Option<PathBuf> {
    if let Some(v) = std::env::var_os("IHUI_SECRET_DIR") {
        let p = PathBuf::from(v);
        if p.is_dir() {
            return Some(p);
        }
    }
    for p in [
        "F:\\BaiduSyncdisk\\密钥",
        "D:\\BaiduSyncdisk\\密钥",
        "E:\\BaiduSyncdisk\\密钥",
    ] {
        let pb = PathBuf::from(p);
        if pb.is_dir() {
            return Some(pb);
        }
    }
    None
}

/// 读取 `store-sessions.json` 里某个平台的登录态种子(只从本机密钥库读,不进仓)。
fn load_session_seed(platform_code: &str) -> Option<serde_json::Value> {
    if platform_code.is_empty() {
        return None;
    }
    let raw = std::fs::read_to_string(secret_dir()?.join("store-sessions.json")).ok()?;
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    v.get("systems")?.get(platform_code).cloned()
}

/// 把登录态种子拼成页面初始化脚本:在页面脚本之前写 Cookie/LocalStorage/SessionStorage。
///
/// 语义是**每页只补缺**(见下方循环里的 `if (existing[c.name])`):同名 Cookie 已在就跳过,
/// 所以永远不会用旧种子覆盖平台/用户刚登录得到的新值。为什么不做「一次性哨兵」:
/// 原生 CookieManager 会静默拒收个别值(实测 base64 尾 `=` 的两枚会话 Cookie),
/// 一次即弃就再也补不回来;而 HttpOnly Cookie 浏览器禁止 JS 改写,补写被静默忽略,
/// 所以「每页补缺」对真会话是安全空操作(Google/vivo/华为 的关键会话正是 HttpOnly)。
fn build_seed_script(seed: &serde_json::Value) -> String {
    let seed_json = serde_json::to_string(seed).unwrap_or_else(|_| "null".to_string());
    format!(
        r#"
(function () {{
  try {{
    var seed = {seed_json};
    if (!seed) return;
    // 初始化脚本也会在第三方子 frame 执行:只允许顶层文档,且当前站点必须属于种子 Cookie 域,
    // 否则广告/埋点 iframe 会把种子值写进它自己 origin 的存储。
    if (window.top !== window) return;
    var cookieDomain = String(seed.cookieDomain || '');
    var domain = cookieDomain.toLowerCase().replace(/^\./, '');
    if (!domain) return;
    var host = String(location.hostname || '').toLowerCase();
    if (host !== domain && host.slice(-(domain.length + 1)) !== '.' + domain) return;
    var SENTINEL = '__ihui_seed_v1';
    var existing = {{}};
    document.cookie.split(';').forEach(function (p) {{
      var eq = p.indexOf('=');
      if (eq > 0) {{
        var name = p.slice(0, eq).trim();
        existing[name] = 1;
      }}
    }});
    // sessionStorage 是「每会话」存储:哨兵在也要补,否则重启后种子里的
    // sessionStorage 永远缺失(vivo 的内置登录态就依赖它)。
    var ss = seed.sessionStorage || {{}};
    for (var k2 in ss) {{
      try {{ if (sessionStorage.getItem(k2) === null) sessionStorage.setItem(k2, ss[k2]); }} catch (e) {{}}
    }}
    // 哨兵在也不提前返回:下面每个 Cookie 都只在「document.cookie 里没有同名」时才补,
    // 永远不会覆盖平台/用户刚更新的值。真 HttpOnly 会话 Cookie 浏览器禁止 JS 改写,
    // 补写会被静默忽略 —— 所以「每页补缺」对它们是安全空操作,却能救回原生接口拒收的
    // 个别值(实测 base64 尾 `=` 的两枚会话 Cookie 落不进 WebView2 CookieManager)。
    var applied = 0;
    var cookies = seed.cookies || [];
    for (var i = 0; i < cookies.length; i++) {{
      var c = cookies[i];
      if (!c || !c.name) {{ continue; }}
      if (existing[c.name]) {{ applied += 1; continue; }}
      var parts = [c.name + '=' + c.value, 'path=/'];
      if (cookieDomain && c.name.indexOf('__Host-') !== 0) parts.push('domain=' + cookieDomain);
      parts.push('secure');
      parts.push('samesite=lax');
      parts.push('max-age=2592000');
      document.cookie = parts.join('; ');
      // 回读确认:平台用 HttpOnly 同名 Cookie 拒收时不能写哨兵假装已种
      var now = document.cookie.split(';');
      for (var j = 0; j < now.length; j++) {{
        var eq2 = now[j].indexOf('=');
        if (eq2 > 0 && now[j].slice(0, eq2).trim() === c.name) {{ applied += 1; break; }}
      }}
    }}
    var ls = seed.localStorage || {{}};
    for (var k in ls) {{
      try {{
        if (localStorage.getItem(k) === null) localStorage.setItem(k, ls[k]);
        if (localStorage.getItem(k) !== null) applied += 1;
      }} catch (e) {{}}
    }}
    // 一条都没写进去(种子为空/全被拒)就不写哨兵,下次打开还能重试
    if (applied <= 0) return;
    var sentinel = [SENTINEL + '=1', 'path=/'];
    if (cookieDomain) sentinel.push('domain=' + cookieDomain);
    sentinel.push('secure');
    sentinel.push('samesite=lax');
    sentinel.push('max-age=31536000');
    document.cookie = sentinel.join('; ');
  }} catch (e) {{}}
}})();
"#
    )
}

/// 把种子 Cookie **以原生 CookieManager 写进窗口 profile**(支持 HttpOnly)。
///
/// 为什么不能只靠初始化脚本:`document.cookie` 既读不到也写不了 HttpOnly Cookie,而
/// Google/vivo/华为的关键会话 Cookie 恰恰是 HttpOnly —— 只走 JS 的种子对它们等于没种
/// (还会因回读不到而反复重试)。这里改由 WebView2 CookieManager 直写,页面首帧请求即带上。
///
/// 安全:只允许写该平台自己的 Cookie 域(与 `build_store_page_script` 同一条判据),
/// 防止被 XSS 的线上页借 IPC 把 Cookie 注入任意站点。返回 (补写成功条数, 已有跳过条数)。
/// 能读写 Cookie 的 webview。
///
/// 商店账号有两种承载形态,共用同一套种子注入 / 续期 / 回写逻辑:
/// ① **内置浏览器的标签页**(默认,`browser-tab-<id>` 子 webview,一窗多标签);
/// ② 旧形态的每账号独立窗口(`WebviewWindow`,独立 data_directory)。
/// 两者 Cookie API 完全同形,故用 trait 抹平,免得逻辑写两份。
trait CookieJar {
    fn jar_cookies(&self) -> tauri::Result<Vec<Cookie<'static>>>;
    fn jar_set_cookie(&self, cookie: Cookie<'_>) -> tauri::Result<()>;
}

impl CookieJar for WebviewWindow {
    fn jar_cookies(&self) -> tauri::Result<Vec<Cookie<'static>>> {
        self.cookies()
    }
    fn jar_set_cookie(&self, cookie: Cookie<'_>) -> tauri::Result<()> {
        self.set_cookie(cookie)
    }
}

impl CookieJar for tauri::webview::Webview {
    fn jar_cookies(&self) -> tauri::Result<Vec<Cookie<'static>>> {
        self.cookies()
    }
    fn jar_set_cookie(&self, cookie: Cookie<'_>) -> tauri::Result<()> {
        self.set_cookie(cookie)
    }
}

fn seed_native_cookies<W: CookieJar>(
    win: &W,
    host: &str,
    seed: &serde_json::Value,
) -> (usize, usize) {
    let Some(domain) = seed
        .get("cookieDomain")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().trim_start_matches('.').to_ascii_lowercase())
    else {
        return (0, 0);
    };
    let host = host.to_ascii_lowercase();
    if domain.is_empty() || !(host == domain || host.ends_with(&format!(".{domain}"))) {
        return (0, 0);
    }
    let Some(list) = seed.get("cookies").and_then(|v| v.as_array()) else {
        return (0, 0);
    };
    // 只补缺、不覆盖:种子是「上次关窗时的快照」,而 profile 里可能已经有更新的一次登录
    // (例如上次登录到一半进程被结束,种子还是旧的)。无条件写会把新的会话票用旧值顶掉,
    // 那正是「登录完反而掉线」的成因。按 (name, domain, path) 判重即可
    // —— 同三元组在 Cookie 规范里就是同一条 Cookie。
    let existing: std::collections::HashSet<(String, String, String)> = win
        .jar_cookies()
        .map(|list| {
            list.iter()
                .map(|c| {
                    (
                        c.name().to_string(),
                        c.domain()
                            .unwrap_or("")
                            .trim_start_matches('.')
                            .to_ascii_lowercase(),
                        c.path().unwrap_or("/").to_string(),
                    )
                })
                .collect()
        })
        .unwrap_or_default();
    let ttl = tauri::webview::cookie::time::Duration::days(30);
    let mut applied = 0usize;
    let mut skipped = 0usize;
    for item in list {
        let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("");
        if name.is_empty() {
            continue;
        }
        let value = item.get("value").and_then(|v| v.as_str()).unwrap_or("");
        let path = item.get("path").and_then(|v| v.as_str()).unwrap_or("/");
        // 逐条用自己的 domain: 种子是「关窗快照」,同一平台常横跨多个域 —— Google 的 SID 在
        // `.google.com`,而 LSID / `__Host-*PSID` 在 `accounts.google.com` 且是 host-only。
        // 旧实现把整份种子统一塞进 cookieDomain,host-only 票会被写到父域,服务端收不到 ⇒
        // 表现成「cookie 明明注入了 32/32,页面还是未登录」(2026-11-15 实测 Google Play)。
        let rec_domain = item
            .get("domain")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().trim_start_matches('.').to_ascii_lowercase())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| domain.clone());
        // 站内校验: 只接受与 cookieDomain 同站的后缀,避免种子被改写后往任意域写票
        if !(rec_domain == domain
            || rec_domain.ends_with(&format!(".{domain}"))
            || domain.ends_with(&format!(".{rec_domain}")))
        {
            continue;
        }
        if existing.contains(&(name.to_string(), rec_domain.clone(), path.to_string())) {
            skipped += 1;
            continue;
        }
        let http_only = item
            .get("httpOnly")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        // SameSite 用种子里的原值; 老种子没有该字段时取 None —— 商店后台普遍跨站调
        // clients*.google.com / *.huawei.com 这类独立站点域名,Lax 会让这些 XHR 不带票,
        // 登录态就表现成「注入了但不生效」。
        let same_site = match item.get("sameSite").and_then(|v| v.as_str()) {
            Some("Strict") => SameSite::Strict,
            Some("Lax") => SameSite::Lax,
            _ => SameSite::None,
        };
        let mut builder = Cookie::build((name.to_string(), value.to_string()))
            .path(path.to_string())
            .secure(true)
            .http_only(http_only)
            .same_site(same_site)
            .max_age(ttl);
        if !name.starts_with("__Host-") {
            builder = builder.domain(rec_domain.clone());
        }
        if win.jar_set_cookie(builder.build()).is_ok() {
            applied += 1;
        }
    }
    (applied, skipped)
}

/// 把账号窗口里的 Cookie 续期落盘。
///
/// 两件事,同一个动作:
/// ① **会话级 Cookie(session cookie,无 Expires)转持久** —— WebView2 关闭 data_directory
///    时会丢弃 session cookie,而多数商店后台的关键票(SESSION / JSESSIONID / sid)恰恰不带
///    Expires。用户「登录完关窗」那一刻,刚拿到的票就被浏览器扔了,下次开窗又要重登 ——
///    这不是种子丢了,是票压根没落盘。
/// ② `renew_persistent` 为真时,把**剩余不足 7 天**的持久 Cookie 也续回 30 天 —— 服务端不
///    一定每次响应都重发 Set-Cookie,光靠它滑动,过期时间迟早会走到头。本地每 10 分钟续一次,
///    才叫「一直活着」。
///
/// 只改过期时间,值/域/路径/HttpOnly/SameSite 一个字节不动;`__ihui_seed_v1` 哨兵跳过。
///
/// `domain_filter`: `Some(站点根)` 时只动该域内的票 —— 内置浏览器的标签与主程序
/// **共享同一份 profile**,不限域会把本站自己的会话票也一并改成 30 天持久,越界。
fn renew_store_cookies<W: CookieJar>(
    win: &W,
    renew_persistent: bool,
    domain_filter: Option<&str>,
) -> usize {
    let Ok(cookies) = win.jar_cookies() else {
        return 0;
    };
    let ttl = tauri::webview::cookie::time::Duration::days(30);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let mut n = 0usize;
    for c in cookies {
        let name = c.name().to_string();
        if name.is_empty() || name == "__ihui_seed_v1" {
            continue;
        }
        if let Some(f) = domain_filter {
            let d = c
                .domain()
                .unwrap_or("")
                .trim_start_matches('.')
                .to_ascii_lowercase();
            if d.is_empty() || !(d == f || d.ends_with(&format!(".{f}"))) {
                continue;
            }
        }
        match c.expires() {
            // 还是新鲜的持久 Cookie ⇒ 不动它,免得每轮心跳都去覆写平台自己设的过期策略
            Some(Expiration::DateTime(dt)) => {
                if !renew_persistent || dt.unix_timestamp() - now > 7 * 86_400 {
                    continue;
                }
            }
            // 会话级(含显式 Session)⇒ 必须转持久,否则关窗即丢
            _ => {}
        }
        let mut b = Cookie::build((name.clone(), c.value().to_string()))
            .path(c.path().unwrap_or("/").to_string())
            .secure(c.secure().unwrap_or(true))
            .http_only(c.http_only().unwrap_or(false))
            .max_age(ttl);
        if let Some(d) = c.domain() {
            // `__Host-` 前缀按规范禁止带 domain(否则浏览器拒收),只能落在当前主机
            if !name.starts_with("__Host-") {
                b = b.domain(d.to_string());
            }
        }
        if let Some(ss) = c.same_site() {
            b = b.same_site(ss);
        }
        if win.jar_set_cookie(b.build()).is_ok() {
            n += 1;
        }
    }
    n
}

/// 把各账号窗口当前 profile 里的 Cookie 回写到本机密钥库种子文件(跨机恢复用)。
///
/// 只改 `systems.<platform>.cookies` 与 `savedAt`,其余字段(localStorage/sessionStorage/
/// 注释)原样保留;种子文件不存在时跳过 —— 不在密钥目录里凭空造文件。
/// **不打印任何 Cookie 值**,只在调用方日志里报条数。
fn dump_store_sessions(app: &AppHandle) -> usize {
    let Some(dir) = secret_dir() else {
        return 0;
    };
    let path = dir.join("store-sessions.json");
    let Ok(raw) = std::fs::read_to_string(&path) else {
        return 0;
    };
    let Ok(mut root) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return 0;
    };
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let mut written = 0usize;
    for p in STORE_AUTO_OPEN {
        // Cookie 罐二选一:内置浏览器的标签页(默认形态)优先,其次是旧形态的独立窗口。
        // 下面统一按「本平台自己的域」过滤,别把第三方埋点 Cookie 抄进密钥库。
        let Some(cookies) = store_platform_cookies(app, p.provider_code, p.default_uid) else {
            continue;
        };
        let domain = platform_domain(p);
        let arr: Vec<serde_json::Value> = cookies
            .iter()
            .filter(|c| {
                let d = c.domain().unwrap_or("").trim_start_matches('.').to_ascii_lowercase();
                !d.is_empty()
                    && !domain.is_empty()
                    && (d == domain || d.ends_with(&format!(".{domain}")) || domain.ends_with(&format!(".{d}")))
            })
            .map(|c| {
                let mut obj = serde_json::Map::new();
                obj.insert(
                    "name".to_string(),
                    serde_json::Value::String(c.name().to_string()),
                );
                obj.insert(
                    "value".to_string(),
                    serde_json::Value::String(c.value().to_string()),
                );
                if let Some(d) = c.domain() {
                    obj.insert(
                        "domain".to_string(),
                        serde_json::Value::String(d.to_string()),
                    );
                }
                if let Some(p) = c.path() {
                    obj.insert("path".to_string(), serde_json::Value::String(p.to_string()));
                }
                if c.http_only().unwrap_or(false) {
                    obj.insert("httpOnly".to_string(), serde_json::Value::Bool(true));
                }
                // SameSite 必须原样带走: 商店后台大量跨站 XHR,丢成 Lax 会让票发不出去
                if let Some(ss) = c.same_site() {
                    let label = match ss {
                        SameSite::Strict => "Strict",
                        SameSite::Lax => "Lax",
                        SameSite::None => "None",
                    };
                    obj.insert(
                        "sameSite".to_string(),
                        serde_json::Value::String(label.to_string()),
                    );
                }
                if let Some(Expiration::DateTime(dt)) = c.expires() {
                    obj.insert(
                        "expires".to_string(),
                        serde_json::Value::Number(dt.unix_timestamp().into()),
                    );
                }
                serde_json::Value::Object(obj)
            })
            .collect();
        if arr.is_empty() {
            continue;
        }
        if let Some(slot) = root
            .get_mut("systems")
            .and_then(|v| v.as_object_mut())
            .and_then(|m| m.get_mut(p.provider_code))
            .and_then(|v| v.as_object_mut())
        {
            slot.insert("cookies".to_string(), serde_json::Value::Array(arr));
            slot.insert("savedAt".to_string(), serde_json::Value::Number(now.into()));
            written += 1;
        }
    }
    if written > 0 {
        if let Ok(text) = serde_json::to_string_pretty(&root) {
            let _ = std::fs::write(&path, text);
        }
    }
    written
}

/// 注入每个账号登录窗的页面脚本。
///
/// 在**页面内存**里统计同源请求的方法/路径/查询参数/请求头/请求体参数名:
/// - 请求头只留可安全重放的字段,`cookie/host/origin/referer/sec-*` 等一律不采;
/// - 请求体只留参数名(JSON/表单顶层的 key),不留值;
/// - 同一 GET 出现 ≥3 次才认定为平台自己的轮询/心跳,保活时带捕获到的请求头重放;
/// - 识别不到就回退站点根。带 token/code/sign 的查询串、写操作和导出类接口一律跳过。
/// 所有值只存在当前页面内存,不落盘、不打印、不外发。
const STORE_PAGE_SCRIPT: &str = r#"
(function () {
  if (window.__ihuiStoreKeepaliveInstalled) return;
  var entries = Object.create(null);
  var order = [];
  var targetKey = null;
  var ALLOWED_HOSTS = __IHUI_API_HOSTS__ || [];
  var HINT = __IHUI_KEEPALIVE_HINT__ || "";
  var BAD = /(logout|signout|delete|remove|revoke|cancel|submit|publish|upload|create|update|save|pay|order|bind|unbind|export|download|report|attachment|refresh|renew|reset|stop|exit|enable|disable)/i;
  var SECRET = /([?&](code|token|access_token|ticket|sign|signature|secret|auth|sessionid|sid|jwt)=)/i;
  var STATIC = /\.(js|mjs|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|map)(\?|$)/i;
  var NOISE = ["_t", "t", "ts", "timestamp", "_", "r", "random", "callback"];
  var SKIP_HEADERS = {
    cookie: 1, host: 1, origin: 1, referer: 1, "user-agent": 1,
    "content-length": 1, "accept-encoding": 1, connection: 1,
    "transfer-encoding": 1, te: 1, trailer: 1, upgrade: 1
  };
  var SENSITIVE_HEADERS = /(token|secret|auth|sign|cookie|key|csrf|xsrf|session|sid)/i;
  function maskHeader(name, value) {
    if (!value) return "";
    if (SENSITIVE_HEADERS.test(name)) {
      // 探针报告只用于人工判断请求形态:敏感值一律全遮,不回传尾部字符。
      return "****";
    }
    return value.length > 200 ? value.slice(0, 200) + "…" : value;
  }
  function headersToPairs(headers) {
    var out = [];
    try {
      if (!headers) return out;
      if (typeof Headers !== "undefined" && headers instanceof Headers) {
        headers.forEach(function (v, k) { out.push([k, v]); });
      } else if (Array.isArray(headers)) {
        headers.forEach(function (p) {
          if (p && p.length >= 2) out.push([String(p[0]), String(p[1])]);
        });
      } else if (typeof headers === "object") {
        Object.keys(headers).forEach(function (k) { out.push([k, String(headers[k])]); });
      }
    } catch (e) {}
    return out;
  }
  function safePairs(pairs) {
    var out = [];
    for (var i = 0; i < pairs.length; i++) {
      var k = String(pairs[i][0] || "").toLowerCase();
      var v = String(pairs[i][1] || "");
      if (!k || SKIP_HEADERS[k] || /^sec-/.test(k) || /^proxy-/.test(k)) continue;
      if (v.length > 2000) continue;
      out.push([k, v]);
    }
    return out;
  }
  function bodyKeys(body) {
    var keys = [];
    try {
      if (!body) return keys;
      if (typeof body === "string") {
        try {
          var j = JSON.parse(body);
          if (j && typeof j === "object" && !Array.isArray(j)) keys = Object.keys(j);
        } catch (e) {
          if (/^[^=&]+=/.test(body)) {
            body.split("&").forEach(function (p) {
              var k = p.split("=")[0];
              if (k) keys.push(k);
            });
          }
        }
      } else if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
        body.forEach(function (_, k) { keys.push(k); });
      } else if (typeof FormData !== "undefined" && body instanceof FormData) {
        body.forEach(function (_, k) { keys.push(k); });
      }
    } catch (e) {}
    return keys.slice(0, 20);
  }
  function isAllowed(u) {
    if (u.origin === location.origin) return true;
    for (var i = 0; i < ALLOWED_HOSTS.length; i++) {
      if (u.host === ALLOWED_HOSTS[i]) return true;
    }
    return false;
  }
  var SENSITIVE_QUERY = /^(code|token|access_token|ticket|sign|signature|secret|auth|session|sessionid|sid|jwt|key|\$httpheaders)$/i;
  function maskQuery(search) {
    try {
      var params = new URLSearchParams(search || "");
      var out = new URLSearchParams();
      params.forEach(function (v, k) {
        if (SENSITIVE_QUERY.test(k) || /(token|secret|auth|sign)/i.test(k)) {
          out.append(k, v.length <= 4 ? "****" : "****" + v.slice(-4));
        } else {
          out.append(k, v);
        }
      });
      var s = out.toString();
      return s ? "?" + s : "";
    } catch (e) { return ""; }
  }
  function maskUrlForDisplay(raw) {
    try {
      var u = new URL(raw, location.href);
      return u.pathname + maskQuery(u.search);
    } catch (e) { return ""; }
  }
  // 已验证的平台会话入口:抓不到心跳时先用它,抓到更高频 GET 后自动覆盖
  window.__ihuiStoreKeepaliveTarget = HINT || null;
  window.__ihuiStoreKeepaliveDisplay = HINT ? maskUrlForDisplay(HINT) : null;
  window.__ihuiStoreKeepaliveHeaders = [];
  function record(method, url, headerPairs, keys) {
    try {
      if (!url || window.__ihuiKeepaliveRunning) return;
      var u = new URL(url, location.href);
      if (!isAllowed(u)) return;
      if (u.search.length > 4096) return;
      if (BAD.test(u.pathname) || BAD.test(u.search)) return;
      if (SECRET.test(u.search)) return;
      if (STATIC.test(u.pathname)) return;
      var stable = new URLSearchParams(u.search || "");
      for (var i = 0; i < NOISE.length; i++) stable.delete(NOISE[i]);
      // Google 的 $httpHeaders 每次带新的 SAPISIDHASH,不能让它把同一接口拆成无数 key
      stable.delete("$httpHeaders");
      stable.delete("$httpheaders");
      var stableQs = stable.toString();
      var m = String(method || "GET").toUpperCase();
      var key = m + " " + u.pathname + (stableQs ? "?" + stableQs : "");
      var rawPath = u.pathname + (u.search || "");
      var displayPath = u.pathname + maskQuery(u.search);
      var entry = entries[key];
      if (!entry) {
        entry = {
          method: m,
          rawPath: rawPath,
          displayPath: displayPath,
          count: 0,
          headers: [],
          bodyKeys: [],
          lastSeen: 0
        };
        entries[key] = entry;
        order.push(key);
      }
      entry.count += 1;
      entry.lastSeen = Date.now();
      entry.rawPath = rawPath;
      entry.displayPath = displayPath;
      if (headerPairs && headerPairs.length) entry.headers = headerPairs;
      if (keys && keys.length) entry.bodyKeys = keys;
      if (m === "GET" && entry.count >= 3) {
        var best = targetKey ? entries[targetKey] : null;
        if (!best || entry.count > best.count || key === targetKey) {
          targetKey = key;
          window.__ihuiStoreKeepaliveTarget = entry.rawPath;
          window.__ihuiStoreKeepaliveDisplay = entry.displayPath;
          window.__ihuiStoreKeepaliveHeaders = entry.headers || [];
        }
      }
    } catch (e) {}
  }
  try {
    var of = window.fetch;
    if (of) {
      window.fetch = function (input, init) {
        try {
          var method = (init && init.method) || (input && input.method) || "GET";
          var url = typeof input === "string" ? input : (input && input.url) || "";
          var hdrs = (init && init.headers) ||
            (typeof Request !== "undefined" && input instanceof Request ? input.headers : null);
          record(method, url, safePairs(headersToPairs(hdrs)), bodyKeys(init && init.body));
        } catch (e) {}
        return of.apply(this, arguments);
      };
    }
  } catch (e) {}
  try {
    var XO = XMLHttpRequest.prototype.open;
    var XH = XMLHttpRequest.prototype.setRequestHeader;
    var XS = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      try { this.__ihui = { method: method, url: url, headers: [], bodyKeys: [] }; } catch (e) {}
      return XO.apply(this, arguments);
    };
    XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
      try { if (this.__ihui) this.__ihui.headers.push([name, value]); } catch (e) {}
      return XH.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      try {
        if (this.__ihui) {
          this.__ihui.bodyKeys = bodyKeys(body);
          record(this.__ihui.method, this.__ihui.url, safePairs(this.__ihui.headers), this.__ihui.bodyKeys);
          this.__ihui = null;
        }
      } catch (e) {}
      return XS.apply(this, arguments);
    };
  } catch (e) {}
  window.__ihuiStoreKeepalive = function () {
    if (window.__ihuiKeepaliveRunning) return;
    window.__ihuiKeepaliveRunning = true;
    try {
      var url = window.__ihuiStoreKeepaliveTarget || (location.origin + "/");
      var headers = {};
      var pairs = window.__ihuiStoreKeepaliveHeaders || [];
      for (var i = 0; i < pairs.length; i++) headers[pairs[i][0]] = pairs[i][1];
      setTimeout(function () { window.__ihuiKeepaliveRunning = false; }, 60000);
      var root = location.origin + "/";
      fetch(url, { credentials: "include", cache: "no-store", headers: headers })
        .then(function (res) {
          // 预置接口参数不兼容时(400/401),再用站点根兜底一次
          if (!res.ok && url !== root) {
            return fetch(root, { credentials: "include", cache: "no-store" }).catch(function () {});
          }
        })
        .catch(function () {
          if (url !== root) {
            fetch(root, { credentials: "include", cache: "no-store" }).catch(function () {});
          }
        })
        .then(function () { window.__ihuiKeepaliveRunning = false; });
    } catch (e) {
      window.__ihuiKeepaliveRunning = false;
    }
  };
  window.__ihuiStoreProbeReport = function () {
    var rows = [];
    for (var i = 0; i < order.length; i++) {
      var e = entries[order[i]];
      if (!e || e.count < 2) continue;
      rows.push({
        method: e.method,
        path: e.displayPath,
        count: e.count,
        headers: (e.headers || []).map(function (p) {
          return { name: p[0], value: maskHeader(p[0], p[1]) };
        }),
        bodyKeys: e.bodyKeys || [],
        replaySafe: e.method === "GET"
      });
    }
    rows.sort(function (a, b) { return b.count - a.count; });
    return JSON.stringify({
      target: window.__ihuiStoreKeepaliveDisplay || null,
      targetSource: targetKey ? "learned" : (HINT ? "hint" : null),
      rows: rows.slice(0, 12)
    });
  };
  window.__ihuiStoreKeepaliveInstalled = true;
})();
"#;

static KEEPALIVE_STARTED: AtomicBool = AtomicBool::new(false);

/// Cookie 登录态摘要(只回统计与到期时间,**不回 Cookie 值**)。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreCookieSummary {
    total: usize,
    session_cookies: usize,
    persistent_cookies: usize,
    http_only_session_cookies: usize,
    http_only_persistent_cookies: usize,
    /// 未过期持久 Cookie 的最早到期(Unix 秒)
    earliest_expiry: Option<i64>,
    /// 未过期持久 Cookie 的最晚到期(Unix 秒)
    latest_expiry: Option<i64>,
}

/// 账号 id 只允许 ASCII 字母数字/`-`/`_`,避免路径穿越与非法窗口 label。
/// 清洗有损时追加原串的稳定哈希,避免 `a/b` 与 `a_b` 映射到同一个 profile 目录。
fn sanitize_profile_key(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .take(64)
        .collect();
    if cleaned.as_str() == raw {
        return cleaned;
    }
    let mut h: u32 = 0x811c_9dc5;
    for b in raw.as_bytes() {
        h ^= u32::from(*b);
        h = h.wrapping_mul(0x0100_0193);
    }
    format!("{cleaned}-{h:08x}")
}

fn window_label(key: &str) -> String {
    format!("{STORE_WINDOW_PREFIX}{key}")
}

/// 平台登录态所属的站点根:优先种子里的 `cookieDomain`,其次 API 主机。
fn platform_domain(p: &AutoOpenPlatform) -> String {
    load_session_seed(p.provider_code)
        .and_then(|s| {
            s.get("cookieDomain")
                .and_then(|v| v.as_str())
                .map(|d| d.trim_start_matches('.').to_ascii_lowercase())
        })
        .unwrap_or_else(|| p.api_hosts.first().map(|h| h.to_string()).unwrap_or_default())
}

/// 商店账号承载形态:默认在**程序自己的内置浏览器**里一窗多标签。
///
/// `IHUI_STORE_WINDOW_MODE=1` 退回「每平台一个独立 WebviewWindow」的旧形态
/// (账号间 profile 完全隔离,适合多账号同时在线);其余情况一律走内置标签。
fn store_tabs_mode() -> bool {
    !matches!(
        std::env::var("IHUI_STORE_WINDOW_MODE").ok().as_deref(),
        Some("1")
    )
}

/// 在内置浏览器里为各平台各开一个标签(用户口径:一窗多标签,不许跳出程序外)。
///
/// - `only`:`Some(&[平台码])` 只开这些;`None` 开 [`STORE_AUTO_OPEN`] 全量。
/// - `respect_visible_env`:`IHUI_STORE_LOGIN_VISIBLE` 只在启动自动打开时生效,
///   用户主动点开某个账号时不该被它挡住。
///
/// 已经存在的标签直接切过去,不会堆第二枚同名标签。
pub async fn open_store_accounts_as_tabs(
    app: &AppHandle,
    only: Option<&[String]>,
    respect_visible_env: bool,
) -> Result<usize, String> {
    ensure_keepalive(app);
    let mut opened = 0usize;
    let mut first_id: Option<u64> = None;
    for p in STORE_AUTO_OPEN {
        // 注意:`IHUI_STORE_LOGIN_VISIBLE` 只决定**窗口亮不亮**,不决定开不开标签。
        // 早先这里用它过滤平台,结果默认(不设变量)一个标签都不开、保活全废 ——
        // 启动自动打开的语义是「后台静默把 7 个后台都挂上」,不是「等你点名才干活」。
        if let Some(list) = only {
            if !list.is_empty() && !list.iter().any(|c| c == p.provider_code) {
                continue;
            }
        }
        // 已有标签 ⇒ 切过去(重复点「打开」不该堆出第二枚同名标签)
        if let Some(id) = store_tab_id(p.provider_code) {
            if app
                .get_webview(&crate::embedded_browser::tab_webview_label(id))
                .is_some()
            {
                first_id.get_or_insert(id);
                opened += 1;
                continue;
            }
        }
        let Some((id, _label)) = crate::embedded_browser::open_tab_for_url(
            app.clone(),
            p.login_url.to_string(),
            Some(p.label.to_string()),
        )
        .await
        else {
            log::warn!(
                "[store-browser] 平台 {} 在内置浏览器建标签失败,跳过",
                p.provider_code
            );
            continue;
        };
        remember_store_tab(id, p.provider_code);
        first_id.get_or_insert(id);
        // 种子注入**不在这里做**:child webview 刚建时 CoreWebView2 还没就绪,
        // set_cookie 会返回 Ok 但被静默丢弃。统一由 `on_browser_page_loaded` 在
        // 首次加载完成时注入并 reload(见该函数注释)。
        opened += 1;
    }
    // 全部开完切回第一个标签 —— 否则用户落在最后一个(常见是登不进去的 Google Play)
    if let Some(id) = first_id {
        crate::embedded_browser::activate_tab(app.clone(), id).await;
    }
    if opened == 0 {
        return Err("没有需要打开的商店后台(检查 only 点名)".to_string());
    }
    // 窗口可见性:`respect_visible_env` 的启动路径下,只有 `IHUI_STORE_LOGIN_VISIBLE`
    // 点名了平台才把窗口亮出来(首次登录引导);否则开完就隐藏,7 个标签在后台继续
    // 跑保活 —— 绝不在用户没要求时抢焦点。用户主动点开某账号(`respect_visible_env=false`)
    // 时一律亮窗。
    let want_visible = !respect_visible_env
        || STORE_AUTO_OPEN
            .iter()
            .any(|p| store_login_visible(p.provider_code));
    if let Some(win) = app.get_window(crate::embedded_browser::BROWSER_WINDOW_LABEL) {
        if want_visible {
            let _ = win.show();
            let _ = win.set_focus();
        } else {
            let _ = win.hide();
        }
    }
    log::info!(
        "[store-browser] 内置浏览器已开 {} 个后台标签(一窗多标签,未跳出程序),窗口{}",
        opened,
        if want_visible { "亮出" } else { "隐藏保活" }
    );
    Ok(opened)
}

/// 在内置浏览器里开(或切到)某个平台的单个标签。
pub async fn open_single_account_tab(
    app: &AppHandle,
    url: &str,
    platform_code: &str,
    title: &str,
) -> Result<(), String> {
    ensure_keepalive(app);
    if let Some(id) = store_tab_id(platform_code) {
        if app
            .get_webview(&crate::embedded_browser::tab_webview_label(id))
            .is_some()
        {
            crate::embedded_browser::activate_tab(app.clone(), id).await;
            return Ok(());
        }
    }
    let Some((id, _label)) =
        crate::embedded_browser::open_tab_for_url(app.clone(), url.to_string(), Some(title.to_string()))
            .await
    else {
        return Err("在内置浏览器里打开标签失败".to_string());
    };
    if !platform_code.is_empty() {
        remember_store_tab(id, platform_code);
    }
    // 种子注入同上:交给 `on_browser_page_loaded`(等 CoreWebView2 就绪)
    Ok(())
}

/// 内置浏览器关窗前的收尾:会话票转持久 + 回写种子。
///
/// 由 `embedded_browser` 的 `CloseRequested` 钩子调用 —— 必须在 webview 销毁**之前**,
/// 否则 CookieManager 已经没了,续期和回写都会落空。
pub fn flush_store_tabs_on_close(app: &AppHandle) {
    let tabs: Vec<(u64, String)> = {
        let guard = STORE_TABS.lock().unwrap_or_else(|e| e.into_inner());
        guard.clone()
    };
    if tabs.is_empty() {
        return;
    }
    let mut kept = 0usize;
    for (id, code) in &tabs {
        let Some(wv) = app.get_webview(&crate::embedded_browser::tab_webview_label(*id)) else {
            continue;
        };
        let Some(p) = STORE_AUTO_OPEN
            .iter()
            .find(|p| p.provider_code == code.as_str())
        else {
            continue;
        };
        let domain = platform_domain(p);
        kept += renew_store_cookies(&wv, false, Some(domain.as_str()));
    }
    let written = dump_store_sessions(app);
    log::info!(
        "[store-browser] 内置浏览器关窗: {} 枚会话级 Cookie 已转持久, 回写 {} 个平台种子",
        kept,
        written
    );
    // 标签随窗口一起销毁,映射同时清掉(下次启动从零开始,不留僵尸 id)
    STORE_TABS
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clear();
    SEEDED_TABS
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clear();
}

/// 关闭**某一枚**商店标签之前:续期该平台的会话票 + 回写种子,然后摘掉映射。
///
/// 关窗有 `CloseRequested` 钩子兜底,但单关一个标签(工具条上的 ×)不会触发窗口事件 ——
/// webview 直接被销毁,那一次会话票就来不及转持久。所以关标签前也要走一遍。
pub fn flush_store_tab_before_close(app: &AppHandle, tab_id: u64) {
    let platform = {
        let guard = STORE_TABS.lock().unwrap_or_else(|e| e.into_inner());
        guard
            .iter()
            .find(|(i, _)| *i == tab_id)
            .map(|(_, c)| c.clone())
    };
    let Some(code) = platform else {
        return;
    };
    if let Some(p) = STORE_AUTO_OPEN
        .iter()
        .find(|p| p.provider_code == code.as_str())
    {
        if let Some(wv) = app.get_webview(&crate::embedded_browser::tab_webview_label(tab_id)) {
            let domain = platform_domain(p);
            let kept = renew_store_cookies(&wv, false, Some(domain.as_str()));
            let written = dump_store_sessions(app);
            log::info!(
                "[store-browser] 标签 {} 关闭前: {} 枚会话级 Cookie 已转持久, 回写 {} 个平台种子",
                code,
                kept,
                written
            );
        }
    }
    STORE_TABS
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .retain(|(i, _)| *i != tab_id);
    SEEDED_TABS
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .retain(|i| *i != tab_id);
}

/// 内置浏览器的某个标签**页面加载完成**时调用:把登录态回写种子。
///
/// 为什么不能只靠关窗:实测窗口 `CloseRequested` 阶段子 webview 已经取不到
/// (`get_webview` 返回 None),那时再 dump 会写成 0 个平台 —— 用户「登录完就关窗」
/// 这个最常见动作恰好落空。登录成功后页面必然跳转一次,就在那一刻落盘;
/// 关窗钩子退化成兜底。
pub fn on_browser_page_loaded(app: &AppHandle, tab_id: u64, wv: &tauri::webview::Webview) {
    let platform = {
        let guard = STORE_TABS.lock().unwrap_or_else(|e| e.into_inner());
        guard
            .iter()
            .find(|(i, _)| *i == tab_id)
            .map(|(_, c)| c.clone())
    };
    let Some(code) = platform else {
        return;
    };
    // ① 首次加载完成 ⇒ 注入种子。
    //    为什么不在建标签时注入:child webview 刚 `add_child` 时 CoreWebView2 尚未就绪,
    //    `set_cookie` 会**返回 Ok 但被静默丢弃**(实测 127 枚种子一枚都没落进 profile,
    //    页面全是未登录态)。`on_page_load` 触发时 CookieManager 才真正可用,此时注入
    //    再 reload 一次,首帧就带登录态。
    {
        let first = {
            let mut guard = SEEDED_TABS.lock().unwrap_or_else(|e| e.into_inner());
            if guard.contains(&tab_id) {
                false
            } else {
                guard.push(tab_id);
                true
            }
        };
        if first {
            if let Some(p) = STORE_AUTO_OPEN
                .iter()
                .find(|p| p.provider_code == code.as_str())
            {
                if let Some(seed) = load_session_seed(&code) {
                    let domain = platform_domain(p);
                    let want = seed
                        .get("cookies")
                        .and_then(|v| v.as_array())
                        .map(|a| a.len())
                        .unwrap_or(0);
                    let before = wv.jar_cookies().map(|c| c.len()).unwrap_or(0);
                    let (applied, skipped) = seed_native_cookies(wv, &domain, &seed);
                    let after = wv.jar_cookies().map(|c| c.len()).unwrap_or(0);
                    log::info!(
                        "[store-browser] 标签 {} 就绪后注入 {}/{} 枚(已有 {} 跳过),Cookie 罐 {} -> {}",
                        code,
                        applied,
                        want,
                        skipped,
                        before,
                        after
                    );
                    if applied > 0 && after > before {
                        // 注入真的落库了 ⇒ reload 一次让首帧带票;再触发时不重复注入
                        let _ = wv.reload();
                        return;
                    }
                }
            }
        }
    }
    // ② 回写种子(节流:同一平台 20 秒内只落盘一次 —— 一次加载会连带若干子导航)
    {
        static LAST_DUMP: Mutex<Vec<(String, u64)>> = Mutex::new(Vec::new());
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let mut guard = LAST_DUMP.lock().unwrap_or_else(|e| e.into_inner());
        if let Some((_, ts)) = guard.iter_mut().find(|(c, _)| c == &code) {
            if now.saturating_sub(*ts) < 20 {
                return;
            }
            *ts = now;
        } else {
            guard.push((code.clone(), now));
        }
    }
    let written = dump_store_sessions(app);
    if written > 0 {
        log::info!(
            "[store-browser] 标签 {} 页面加载后回写 {} 个平台种子",
            code,
            written
        );
    }
}

/// 进程内只启动一次:每 10 分钟对**已打开**的账号窗口做一次同源静默 GET。
/// 不新开窗口、不导航、不读写页面内容;关掉窗口即自然停止请求。
fn ensure_keepalive(app: &AppHandle) {
    if KEEPALIVE_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(KEEPALIVE_INTERVAL);
        // ① 内置浏览器里的商店标签(默认形态):同一份续期逻辑作用到子 webview 上。
        //    标签与主窗**不共享** profile(内置浏览器走 `builtin-browser-profile`),
        //    但仍要按平台域过滤 —— 别把同 profile 里本站会话票也改成 30 天。
        let tabs: Vec<(u64, String)> = {
            let guard = STORE_TABS.lock().unwrap_or_else(|e| e.into_inner());
            guard.clone()
        };
        for (id, code) in tabs {
            let Some(wv) = app.get_webview(&crate::embedded_browser::tab_webview_label(id)) else {
                // 标签已被用户关掉 ⇒ 摘掉映射,生命周期在这里自然收敛
                let mut guard = STORE_TABS.lock().unwrap_or_else(|e| e.into_inner());
                guard.retain(|(i, _)| *i != id);
                continue;
            };
            let domain = STORE_AUTO_OPEN
                .iter()
                .find(|p| p.provider_code == code.as_str())
                .map(platform_domain)
                .unwrap_or_default();
            if domain.is_empty() {
                continue;
            }
            let renewed = renew_store_cookies(&wv, true, Some(domain.as_str()));
            if renewed > 0 {
                log::info!("[store-browser] 标签 {} 续期 {} 枚 Cookie", code, renewed);
            }
            // 错峰 3 秒,避免多个账号同时请求形成机器特征
            std::thread::sleep(Duration::from_secs(3));
        }
        // ② 旧形态(`IHUI_STORE_WINDOW_MODE=1`):每账号独立窗口
        for (label, win) in app.webview_windows() {
            if !label.starts_with(STORE_WINDOW_PREFIX) {
                continue;
            }
            // 优先重放页面自己识别出的高频心跳 GET(带捕获到的请求头);没识别到则回退站点根
            let _ = win.eval("window.__ihuiStoreKeepalive && window.__ihuiStoreKeepalive()");
            // 顺手把会话票续成持久:服务端不一定每次响应都重发 Set-Cookie,光靠它滑动,
            // 过期时间迟早走到头;这里每轮把「会话级 + 剩余不足 7 天」的票续回 30 天。
            let renewed = renew_store_cookies(&win, true, None);
            if renewed > 0 {
                log::info!("[store-browser] {} 续期 {} 枚 Cookie", label, renewed);
            }
            // 错峰 3 秒,避免多个账号同时请求形成机器特征
            std::thread::sleep(Duration::from_secs(3));
        }
        // 每轮心跳后把各账号窗口的 Cookie 回写本机密钥库种子:登录一次后即自动备份,
        // 换机/重装时把种子带回即可复原登录态(只写密钥目录,不进仓、不打日志值)。
        let written = dump_store_sessions(&app);
        if written > 0 {
            log::info!("[store-browser] 已回写 {} 个平台的登录态种子", written);
        }
    });
}

/// 应用上架平台:每次启动自动打开的清单(与 packages/shared/src/constants/store-platforms.ts 对齐)。
///
/// 桌面端无 HTTP client,这里只保留「启动自动打开」所必需的最小字段;
/// 完整展示名/登录 URL/API 主机/保活入口仍以 TS 注册表为单一源。
struct AutoOpenPlatform {
    provider_code: &'static str,
    login_url: &'static str,
    default_uid: &'static str,
    label: &'static str,
    api_hosts: &'static [&'static str],
    keepalive_hint: &'static str,
}

const STORE_AUTO_OPEN: &[AutoOpenPlatform] = &[
    AutoOpenPlatform {
        provider_code: "huawei-agc",
        login_url: "https://developer.huawei.com/consumer/cn/console",
        default_uid: "186******08",
        label: "华为AGC",
        api_hosts: &["developer.huawei.com", "svc-drcn.developer.huawei.com"],
        keepalive_hint: "/consumer/cn/consoleIframe/api/credentials/0",
    },
    AutoOpenPlatform {
        provider_code: "oppo-store",
        login_url: "https://open.oppomobile.com/new/ecological/app",
        default_uid: "1267328360",
        label: "OPPO开放平台",
        api_hosts: &["open.oppomobile.com"],
        keepalive_hint: "/new/ecological/app",
    },
    AutoOpenPlatform {
        provider_code: "vivo-store",
        login_url: "https://dev.vivo.com.cn/manageCenter",
        default_uid: "iHui_Inf",
        label: "vivo开放平台",
        api_hosts: &["dev.vivo.com.cn"],
        keepalive_hint: "/webapi/user/info",
    },
    AutoOpenPlatform {
        provider_code: "xiaomi-store",
        login_url: "https://dev.mi.com/xiaomihyperos/console/app-manage/mobile",
        default_uid: "851635970",
        label: "小米开放平台",
        api_hosts: &["dev.mi.com"],
        keepalive_hint: "/xiaomihyperos",
    },
    AutoOpenPlatform {
        provider_code: "honor-store",
        login_url: "https://developer.honor.com/cn/manageCenter/overview",
        default_uid: "李春川",
        label: "荣耀开发者平台",
        api_hosts: &["developer.honor.com", "auth-drcn.developer.honor.com", "apigw.yun.hihonor.com"],
        keepalive_hint: "https://auth-drcn.developer.honor.com/certification/portalWeb/auth/user",
    },
    AutoOpenPlatform {
        provider_code: "yyb-store",
        login_url: "https://app.open.qq.com/p/login",
        default_uid: "7350840021430848512",
        label: "腾讯应用宝",
        api_hosts: &["app.open.qq.com"],
        keepalive_hint: "/api/org/user/staffs",
    },
    AutoOpenPlatform {
        provider_code: "google-play",
        login_url: "https://play.google.com/console",
        default_uid: "ok502319984@gmail.com",
        label: "Google Play",
        api_hosts: &[
            "play.google.com",
            "playconsoleplatform-pa.clients6.google.com",
            "playconsoleapps-pa.clients6.google.com",
        ],
        keepalive_hint: "/console/developers",
    },
];

/// 组装账号窗口的页面脚本:在 STORE_PAGE_SCRIPT 前注入登录态种子(若本机密钥库有该平台种子)。
///
/// 种子只能用于该平台自己的域,否则拒绝打开(防 XSS 远程页借命令把 Cookie 注入任意站点)。
/// `platform_code` 为空时只返回基础页面脚本(无种子)。
fn build_store_page_script(
    parsed: &tauri::Url,
    platform_code: &str,
    hosts: Vec<String>,
    hint: String,
) -> Result<String, String> {
    let hosts_json =
        serde_json::to_string(&hosts).unwrap_or_else(|_| "[]".to_string());
    let hint_json = serde_json::to_string(&hint).unwrap_or_else(|_| "\"\"".to_string());
    let mut page_script = STORE_PAGE_SCRIPT
        .replace("__IHUI_API_HOSTS__", &hosts_json)
        .replace("__IHUI_KEEPALIVE_HINT__", &hint_json);
    if !platform_code.is_empty() {
        if let Some(seed) = load_session_seed(platform_code) {
            // 种子只能用于该平台自己的域:防止被 XSS 的线上页借命令把 Cookie 注入任意站点
            let domain = seed
                .get("cookieDomain")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .trim_start_matches('.')
                .to_ascii_lowercase();
            let host = parsed.host_str().unwrap_or("").to_ascii_lowercase();
            if domain.is_empty() || !(host == domain || host.ends_with(&format!(".{domain}"))) {
                return Err("登录页域名与该平台登录态不匹配,已拒绝打开".to_string());
            }
            page_script = format!("{}\n{}", build_seed_script(&seed), page_script);
        }
    }
    Ok(page_script)
}

/// 打开/聚焦某个商店账号的独立登录窗。
///
/// - `hidden=true`:建窗后立即隐藏(启动自动打开用,不抢焦点、不弹登录页到眼前)。
/// - `skip_if_exists=true`:窗口已存在则直接返回,不重新导航(避免冲掉已登录会话)。
/// 已存在的窗口默认按既有语义 navigate + show + focus;新建窗口写入独立 profile 并挂上初始化脚本。
fn open_store_window(
    app: &AppHandle,
    parsed: &tauri::Url,
    key: &str,
    title: &str,
    page_script: String,
    hidden: bool,
    skip_if_exists: bool,
) -> Result<(), String> {
    ensure_keepalive(app);
    let label = window_label(key);
    if let Some(win) = app.get_webview_window(&label) {
        if skip_if_exists {
            return Ok(());
        }
        win.navigate(parsed.clone())
            .map_err(|e| format!("切换登录页失败:{e}"))?;
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    let data_dir: PathBuf = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("取本机数据目录失败:{e}"))?
        .join("store-browser-profiles")
        .join(key);
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("创建账号浏览器配置失败:{e}"))?;

    let mut builder = WebviewWindowBuilder::new(app, label, WebviewUrl::External(parsed.clone()))
        .title(title)
        .inner_size(1280.0, 860.0)
        .min_inner_size(900.0, 640.0)
        .resizable(true)
        .center()
        .decorations(true)
        .user_agent(crate::embedded_browser::CHROME_UA)
        .additional_browser_args(crate::embedded_browser::WEBVIEW2_BROWSER_ARGS)
        .data_directory(data_dir)
        // 页面侧请求分析 + 心跳识别 + 保活重放(值只在页面内存,不落盘)
        .initialization_script(page_script)
        // OAuth/扫码弹窗走 WebView2 默认实现(同一账号环境,登录后回跳主窗)
        .on_new_window(|_, _| tauri::webview::NewWindowResponse::Allow);
    if hidden {
        builder = builder.visible(false);
    }
    let win = builder
        .build()
        .map_err(|e| format!("打开账号登录窗失败:{e}"))?;
    // 关窗即回写:心跳是 10 分钟一轮,首次登录后人多半立刻关窗,等不到那一轮。
    // 用 prevent_close 拦一次:先续期 + 回写,写完再真正关 —— 否则窗口先销毁,
    // CookieManager 跟着没了,set_cookie/dump 都会落空。第二次回调直接放行。
    {
        let win_ev = win.clone();
        let done = AtomicBool::new(false);
        win.on_window_event(move |event| {
            let tauri::WindowEvent::CloseRequested { api, .. } = event else {
                return;
            };
            if done.swap(true, Ordering::SeqCst) {
                return;
            }
            api.prevent_close();
            // 顺序要紧:先把会话级 Cookie 改写成持久版,再 dump 进种子。
            // 反过来的话种子拿到的是无 Expires 的 session cookie,下次注入回去照样关窗即丢。
            let kept = renew_store_cookies(&win_ev, false, None);
            let written = dump_store_sessions(win_ev.app_handle());
            log::info!(
                "[store-browser] 关窗: {} 枚会话级 Cookie 已转持久, 回写 {} 个平台种子",
                kept,
                written
            );
            let _ = win_ev.close();
        });
    }
    // 原生种 Cookie(HttpOnly 也能种):建窗时已按 login_url 起过一次加载,这里把种子写进
    // profile 的 CookieManager 后再导航一次,保证真正那一次请求的首帧就带登录态。
    let platform = key.split("__").next().unwrap_or("");
    if let Some(seed) = load_session_seed(platform) {
        let (applied, skipped) =
            seed_native_cookies(&win, parsed.host_str().unwrap_or(""), &seed);
        if applied > 0 {
            // WebView2 会对个别不合规 Cookie 值静默拒收(实测 base64 尾 `=` 的两枚会话 Cookie
            // 落不进库),所以这里同时报「补写成功数 / 种子里应有数 / 已有跳过数」,差异一眼可见。
            let want = seed
                .get("cookies")
                .and_then(|v| v.as_array())
                .map(|a| a.len())
                .unwrap_or(0);
            let _ = win.navigate(parsed.clone());
            log::info!(
                "[store-browser] 平台 {} 种子补写 {}/{} 枚(profile 已有 {} 枚跳过,未覆盖)",
                platform,
                applied,
                want,
                skipped
            );
        } else if skipped > 0 {
            // 一条都不缺 ⇒ 不动它。重新导航会打断用户正在进行的登录/上传,得不偿失。
            log::info!(
                "[store-browser] 平台 {} 种子全部已在 profile({} 枚),不注入不导航",
                platform,
                skipped
            );
        }
    }
    Ok(())
}

/// 复刻 web 端 `storeProfileKey` 的 FNV-1a 32 位哈希(base36),与
/// `apps/web/app/(main)/admin/relay/account-pool/page.tsx` 的 `storeProfileKey` 严格同形:
/// 窗口 label 必须完全一致,否则自动打开的隐藏窗与后台面板打开的可见窗会是两个独立
/// profile(登录态不共享,自动续命失效)。BMP 字符(含中文 uid)`charCodeAt` 等于其标量值,
/// 故按 `ch as u32` 迭代即可与 JS `charCodeAt` 对齐(JS 按 UTF-16 码元,但本清单的 uid 全在 BMP)。
fn fnv1a_base36(s: &str) -> String {
    let mut h: u32 = 0x811c_9dc5;
    for ch in s.chars() {
        h ^= ch as u32;
        h = h.wrapping_mul(0x0100_0193);
    }
    to_base36(h)
}

/// u32 → base36(JS `Number.prototype.toString(36)` 的对应实现)。
fn to_base36(mut n: u32) -> String {
    if n == 0 {
        return "0".to_string();
    }
    const DIGITS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut buf = [0u8; 7]; // u32 的 base36 最长 7 位
    let mut i = buf.len();
    while n > 0 {
        i -= 1;
        buf[i] = DIGITS[(n % 36) as usize];
        n /= 36;
    }
    String::from_utf8_lossy(&buf[i..]).into_owned()
}

/// 首次登录引导:判断本次启动是否要把某个平台的自动窗建成**可见**。
///
/// 默认隐藏 —— 登录态已就位时用户不该看见 7 个后台窗。但「首次登录」必须由人来做,
/// 隐藏窗里没法输入账号密码,所以留一个启动期开关 `IHUI_STORE_LOGIN_VISIBLE`:
/// 取 `1` / `all` 全平台可见,取平台码(逗号分隔,如 `xiaomi-store,vivo-store`)按白名单,
/// 未设或空则维持隐藏。只在建窗瞬间读一次,运行期改环境变量不影响已建窗口。
/// 外部浏览器模式: `IHUI_STORE_EXTERNAL_BROWSER=1` 时不再建 WebView2 窗口,而是把各平台的
/// 后台登录页交给**系统真实浏览器**(优先 Chrome)打开。
///
/// 为什么不复用 Chrome 的 profile 给 WebView2: 两者虽同为 Chromium,但 Chrome 的 User Data
/// 目录只服务 Chrome 自身(版本锁 + 私有 Schema + App-Bound/DPAPI 分级密钥),WebView2 指向它
/// 会直接损坏 Chrome 的登录态。要「用日常 Chrome 的登录」只有两条正路:
/// ① 本开关 —— 页面直接开在 Chrome 里,登录态天然就是 Chrome 自己那份;
/// ② `scripts/store-session/` 的同步器 —— 把 Chrome 已登录的票解密后灌进桌面端种子。
fn external_browser_enabled() -> bool {
    match std::env::var("IHUI_STORE_EXTERNAL_BROWSER") {
        Ok(v) => {
            let v = v.trim();
            v == "1" || v.eq_ignore_ascii_case("true") || v.eq_ignore_ascii_case("all")
        }
        Err(_) => false,
    }
}

/// 用系统真实浏览器打开一个 URL。优先 Chrome(用户日常那份 profile),找不到再退回默认浏览器。
fn launch_in_system_browser(url: &str) -> Result<(), String> {
    let candidates = [
        std::env::var("LOCALAPPDATA").ok(),
        std::env::var("ProgramFiles").ok(),
        std::env::var("ProgramFiles(x86)").ok(),
    ];
    let mut chrome: Option<PathBuf> = None;
    for base in candidates.into_iter().flatten() {
        let p = PathBuf::from(base).join("Google/Chrome/Application/chrome.exe");
        if p.is_file() {
            chrome = Some(p);
            break;
        }
    }
    if let Some(path) = chrome {
        std::process::Command::new(&path)
            .arg("--new-window")
            .arg(url)
            .spawn()
            .map_err(|e| format!("启动 Chrome 失败:{e}"))?;
        return Ok(());
    }
    std::process::Command::new("cmd")
        .args(["/c", "start", "", url])
        .spawn()
        .map_err(|e| format!("启动默认浏览器失败:{e}"))?;
    Ok(())
}

/// 一次把多个后台交给系统浏览器: Chrome 单次 `--new-window` 带全部 URL 时，
/// 第一个 URL 落在新窗口、其余成为**同一窗口的标签**。逐平台各调一次会弹出 N 个窗口，
/// 任务栏上难以分辨也容易误关，故批量走这里。
fn launch_in_system_browser_many(urls: &[&str]) -> Result<(), String> {
    if urls.is_empty() {
        return Ok(());
    }
    let candidates = [
        std::env::var("LOCALAPPDATA").ok(),
        std::env::var("ProgramFiles").ok(),
        std::env::var("ProgramFiles(x86)").ok(),
    ];
    let mut chrome: Option<PathBuf> = None;
    for base in candidates.into_iter().flatten() {
        let p = PathBuf::from(base).join("Google/Chrome/Application/chrome.exe");
        if p.is_file() {
            chrome = Some(p);
            break;
        }
    }
    if let Some(path) = chrome {
        let mut cmd = std::process::Command::new(&path);
        cmd.arg("--new-window");
        for u in urls {
            cmd.arg(u);
        }
        cmd.spawn()
            .map_err(|e| format!("启动 Chrome 失败:{e}"))?;
        return Ok(());
    }
    for u in urls {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", u])
            .spawn()
            .map_err(|e| format!("启动默认浏览器失败:{e}"))?;
    }
    Ok(())
}

fn store_login_visible(provider_code: &str) -> bool {
    let raw = std::env::var("IHUI_STORE_LOGIN_VISIBLE").unwrap_or_default();
    let raw = raw.trim();
    if raw.is_empty() {
        return false;
    }
    if raw == "1" || raw.eq_ignore_ascii_case("all") {
        return true;
    }
    raw.split(',')
        .map(str::trim)
        .any(|s| !s.is_empty() && s.eq_ignore_ascii_case(provider_code))
}

/// 桌面启动时自动打开全部应用上架平台账号的浏览器窗(默认隐藏,接 10 分钟心跳)。
///
/// 与手动「打开 / 切换」(`store_account_open`)共享同一套种子注入/页面脚本/心跳逻辑,
/// 只是窗口建为隐藏、且已存在则跳过(不重新导航,保护已登录会话)。各账号独立 profile
/// 落盘,登录态跨重启保留 —— 这就是「真实保活」:桌面一启动,7 个商店后台的登录态就自动
/// 维持,无需人工点开;首次由各后台面板手动打开登录一次后,后续全自动续。
///
/// 首次登录不想逐个去面板点,可用 `IHUI_STORE_LOGIN_VISIBLE` 让本次启动直接亮窗。
pub fn auto_open_store_accounts(app: &AppHandle) -> Result<(), String> {
    // 外部浏览器模式: 只把「用户点名的平台」交给系统浏览器,不建任何 WebView2 窗口。
    // 默认(未设开关)维持原行为 —— 7 个隐藏窗 + 10 分钟心跳 + 关窗落盘。
    if external_browser_enabled() {
        let mut urls: Vec<&str> = Vec::new();
        for p in STORE_AUTO_OPEN {
            if !store_login_visible(p.provider_code) {
                continue;
            }
            urls.push(p.login_url);
        }
        if urls.is_empty() {
            log::info!(
                "[store-browser] 外部浏览器模式: IHUI_STORE_LOGIN_VISIBLE 未点名任何平台,本次不打开后台"
            );
            return Ok(());
        }
        match launch_in_system_browser_many(&urls) {
            Ok(()) => log::info!(
                "[store-browser] 外部浏览器模式: 已用系统浏览器打开 {} 个后台(一窗多标签,不经 WebView2,保活由浏览器自身负责)",
                urls.len()
            ),
            Err(e) => log::warn!(
                "[store-browser] 外部浏览器模式: 系统浏览器启动失败,本批 {} 个后台全部未打开: {}",
                urls.len(),
                e
            ),
        }
        return Ok(());
    }
    // 默认形态:在**程序自己的内置浏览器**里一窗多标签打开,不跳出程序外。
    // 建标签必须跑在工作线程(`add_child` 会阻塞等主线程),故整体交给 async runtime。
    if store_tabs_mode() {
        let app_bg = app.clone();
        tauri::async_runtime::spawn(async move {
            match open_store_accounts_as_tabs(&app_bg, None, true).await {
                Ok(n) => log::info!(
                    "[store-browser] 启动自动打开: {} 个后台已作为内置浏览器标签打开",
                    n
                ),
                Err(e) => log::info!("[store-browser] 启动自动打开跳过: {}", e),
            }
        });
        return Ok(());
    }
    for p in STORE_AUTO_OPEN {
        let parsed: tauri::Url = match p.login_url.parse() {
            Ok(u) => u,
            Err(e) => {
                log::warn!(
                    "[store-browser] 平台 {} 登录 URL 非法,跳过自动打开: {}",
                    p.provider_code,
                    e
                );
                continue;
            }
        };
        if parsed.scheme() != "https" && parsed.scheme() != "http" {
            continue;
        }
        // 窗口 key 必须与 web 端 `store_profile_key` 严格一致(providerCode__FNV1a(uid)),
        // 否则自动打开的隐藏窗与后台面板打开的可见窗会是两套独立 profile,登录态不共享。
        let key = format!("{}__{}", p.provider_code, fnv1a_base36(p.default_uid));
        let hosts: Vec<String> = p.api_hosts.iter().map(|h| (*h).to_string()).collect();
        match build_store_page_script(&parsed, p.provider_code, hosts, p.keepalive_hint.to_string()) {
            Ok(script) => {
                let visible = store_login_visible(p.provider_code);
                if let Err(e) =
                    open_store_window(app, &parsed, &key, p.label, script, !visible, true)
                {
                    log::warn!(
                        "[store-browser] 自动打开 {} 失败: {}",
                        p.provider_code,
                        e
                    );
                } else if visible {
                    log::info!(
                        "[store-browser] 平台 {} 以可见窗打开(首次登录引导),登录后关闭即可落盘",
                        p.provider_code
                    );
                }
            }
            Err(e) => {
                log::warn!(
                    "[store-browser] 平台 {} 种子域名不匹配,跳过自动打开: {}",
                    p.provider_code,
                    e
                );
            }
        }
    }
    Ok(())
}

/// 打开/聚焦某个商店账号的独立登录窗。已存在则导航到最新登录页并聚焦。
#[tauri::command]
pub async fn store_account_open(
    app: AppHandle,
    url: String,
    profile_key: String,
    title: String,
    platform_code: Option<String>,
    api_hosts: Option<Vec<String>>,
    keepalive_hint: Option<String>,
) -> Result<(), String> {
    let parsed: tauri::Url = url
        .parse()
        .map_err(|e| format!("登录页 URL 非法:{e}"))?;
    if parsed.scheme() != "https" && parsed.scheme() != "http" {
        return Err("只允许打开 http(s) 登录页".to_string());
    }
    let key = sanitize_profile_key(&profile_key);
    if key.is_empty() {
        return Err("账号标识为空".to_string());
    }
    // 平台码白名单 + 登录页主机 + profile 前缀三重绑定:本机没有种子文件时也必须成立,
    // 避免被 XSS 的远程页借命令把任意站点装进商店窗口或跨平台复用账号目录。
    let platform = platform_code.as_deref().unwrap_or("").trim();
    if !platform.is_empty() {
        let allowed_host = STORE_PLATFORM_LOGIN_HOSTS
            .iter()
            .find(|(code, _)| *code == platform)
            .map(|(_, host)| *host)
            .ok_or_else(|| "未知商店平台,已拒绝打开".to_string())?;
        let host = parsed.host_str().unwrap_or("").to_ascii_lowercase();
        if !(host == allowed_host || host.ends_with(&format!(".{allowed_host}"))) {
            return Err("登录页域名与该平台不匹配,已拒绝打开".to_string());
        }
        let prefix = format!("{}__", sanitize_profile_key(platform));
        if !key.starts_with(&prefix) {
            return Err("账号与平台不匹配,已拒绝打开".to_string());
        }
    }
    // 只接受纯主机名,避免把任意字符串注进页面脚本
    let hosts: Vec<String> = api_hosts
        .unwrap_or_default()
        .into_iter()
        .map(|h| h.trim().to_ascii_lowercase())
        .filter(|h| {
            !h.is_empty()
                && h.len() <= 120
                && h
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
        })
        .collect();
    let hint = keepalive_hint.unwrap_or_default();
    let hint = hint.trim();
    let hint = if hint.len() <= 2048
        && (hint.starts_with('/') || hint.starts_with("https://") || hint.starts_with("http://"))
    {
        hint.to_string()
    } else {
        String::new()
    };
    let page_script = build_store_page_script(&parsed, platform, hosts, hint)?;
    // 外部浏览器模式: 三重校验都过了之后,把这个后台直接开在用户日常 Chrome 里,
    // 不再另建 WebView2 窗口 —— 界面里点「打开」看到的就是自己熟悉的浏览器与登录态。
    if external_browser_enabled() {
        launch_in_system_browser(parsed.as_str())?;
        log::info!(
            "[store-browser] 外部浏览器模式: 平台 {} 已交给系统浏览器打开",
            if platform.is_empty() { "(未标注)" } else { platform }
        );
        return Ok(());
    }
    // 默认形态:在程序自己的内置浏览器里开一个标签(不新建独立窗口)
    if store_tabs_mode() {
        return open_single_account_tab(&app, parsed.as_str(), platform, &title).await;
    }
    open_store_window(&app, &parsed, &key, &title, page_script, false, false)
}

/// 读取某个账号登录窗的当前 URL;窗口未打开返回 null。
#[tauri::command]
pub async fn store_account_url(
    app: AppHandle,
    profile_key: String,
) -> Result<Option<String>, String> {
    let key = sanitize_profile_key(&profile_key);
    if key.is_empty() {
        return Ok(None);
    }
    let Some(win) = app.get_webview_window(&window_label(&key)) else {
        return Ok(None);
    };
    match win.url() {
        Ok(url) => Ok(Some(url.to_string())),
        Err(_) => Ok(None),
    }
}

/// 读取某个账号独立 profile 的 Cookie 登录态摘要(不返回值);窗口未打开返回 null。
#[tauri::command]
pub async fn store_account_session(
    app: AppHandle,
    profile_key: String,
) -> Result<Option<StoreCookieSummary>, String> {
    let key = sanitize_profile_key(&profile_key);
    if key.is_empty() {
        return Ok(None);
    }
    let Some(win) = app.get_webview_window(&window_label(&key)) else {
        return Ok(None);
    };
    let cookies = win
        .cookies()
        .map_err(|e| format!("读取账号 Cookie 失败:{e}"))?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let mut total = 0usize;
    let mut session_cookies = 0usize;
    let mut persistent_cookies = 0usize;
    let mut http_only_session_cookies = 0usize;
    let mut http_only_persistent_cookies = 0usize;
    let mut earliest_expiry: Option<i64> = None;
    let mut latest_expiry: Option<i64> = None;
    for cookie in cookies {
        total += 1;
        let http_only = cookie.http_only().unwrap_or(false);
        match cookie.expires() {
            Some(Expiration::DateTime(dt)) => {
                let ts = dt.unix_timestamp();
                if ts <= now {
                    continue;
                }
                persistent_cookies += 1;
                if http_only {
                    http_only_persistent_cookies += 1;
                }
                earliest_expiry = Some(earliest_expiry.map_or(ts, |v| v.min(ts)));
                latest_expiry = Some(latest_expiry.map_or(ts, |v| v.max(ts)));
            }
            _ => {
                session_cookies += 1;
                if http_only {
                    http_only_session_cookies += 1;
                }
            }
        }
    }
    Ok(Some(StoreCookieSummary {
        total,
        session_cookies,
        persistent_cookies,
        http_only_session_cookies,
        http_only_persistent_cookies,
        earliest_expiry,
        latest_expiry,
    }))
}

/// 读取页面脚本识别出的保活接口(**已脱敏的** path+query,不含域名与凭据);未识别到返回 null。
/// 重放用的原始 path(可能含 `$httpHeaders`)只留在页面内存,不经过 IPC 回包。
#[tauri::command]
pub async fn store_account_keepalive_target(
    app: AppHandle,
    profile_key: String,
) -> Result<Option<String>, String> {
    let key = sanitize_profile_key(&profile_key);
    if key.is_empty() {
        return Ok(None);
    }
    let Some(win) = app.get_webview_window(&window_label(&key)) else {
        return Ok(None);
    };
    let (tx, rx) = std::sync::mpsc::channel::<String>();
    win.eval_with_callback(
        "window.__ihuiStoreKeepaliveDisplay || null",
        move |raw| {
            let _ = tx.send(raw);
        },
    )
    .map_err(|e| format!("读取保活接口失败:{e}"))?;
    let received = tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(Duration::from_secs(2))
    })
    .await
    .map_err(|e| format!("读取保活接口超时:{e}"))?;
    let Ok(raw) = received else {
        return Ok(None);
    };
    Ok(serde_json::from_str::<Option<String>>(&raw).ok().flatten())
}

/// 读取页面侧的网络分析报告:方法、路径、查询参数、请求头(值已脱敏)、请求体参数名。
#[tauri::command]
pub async fn store_account_probe(
    app: AppHandle,
    profile_key: String,
) -> Result<Option<serde_json::Value>, String> {
    let key = sanitize_profile_key(&profile_key);
    if key.is_empty() {
        return Ok(None);
    }
    let Some(win) = app.get_webview_window(&window_label(&key)) else {
        return Ok(None);
    };
    let (tx, rx) = std::sync::mpsc::channel::<String>();
    win.eval_with_callback(
        "window.__ihuiStoreProbeReport ? window.__ihuiStoreProbeReport() : null",
        move |raw| {
            let _ = tx.send(raw);
        },
    )
    .map_err(|e| format!("读取接口分析失败:{e}"))?;
    let received = tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(Duration::from_secs(2))
    })
    .await
    .map_err(|e| format!("读取接口分析超时:{e}"))?;
    let Ok(raw) = received else {
        return Ok(None);
    };
    let parsed: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };
    if parsed.is_null() {
        return Ok(None);
    }
    // JS 返回的是 JSON 字符串,回调再包一层 JSON;解两层
    if let serde_json::Value::String(inner) = parsed {
        return Ok(serde_json::from_str(&inner).ok());
    }
    Ok(Some(parsed))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
