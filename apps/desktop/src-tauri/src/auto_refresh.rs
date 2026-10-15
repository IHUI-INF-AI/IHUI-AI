// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 线上前端自动刷新 + 断网兜底(2026-09-17 薄壳化配套,同日极致化修订)。
//! 2026-09-22 抖动修复:探活改为「同轮重试 + 连续失败阈值」滞回判定。
//!
//! 薄壳模式下 main 窗口的加载地址由 tauri.conf.json / `--config` 覆盖决定:
//! 1. [启动序列·永不白屏] main 窗口 conf `visible: false`,本模块探活(≤2 次,单次超时 12s)后:
//!    在线 → show(远程页已在后台加载);离线 → 切内置 `offline://` 兜底页 + show。
//! 2. [自动刷新] 每 3 分钟抓取线上 HTML,提取首个 `/_next/static/` 资源路径段为
//!    构建指纹(Next16 随机 chunk 命名,部署后必变、不含时间戳,零误报)。
//!    指纹变化 → 若窗口聚焦则挂起 pending,失焦后自动 `location.reload()`,
//!    不打断正在进行的对话;防抖 10 分钟防反复部署干扰。
//! 3. [断网守卫] 每 30 秒 HEAD 健康检查;同轮内最多重试 2 次(间隔 2s),
//!    仅当**连续 3 轮**(≈90s)全部失败才切 offline 页;恢复只需单次成功,
//!    且优先回跳「切离线前用户所在地址」而非一律回首页。
//! 4. [通知] 离线/恢复/热刷新经系统通知告知(tauri_plugin_notification)。

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use tauri::{Emitter, Manager};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_updater::UpdaterExt;

/// 离线兜底页地址(与后端基址无关,任何窗口 origin 下都加载它)
const OFFLINE_URL: &str = "http://offline.localhost/index.html";
/// 健康检查间隔(秒)
const HEALTH_SECS: u64 = 30;
/// 单轮探活的最大尝试次数:瞬时抖动多为单次失败,同轮重试一次即可滤掉绝大多数
const PROBE_ATTEMPTS: u32 = 2;
/// 单轮内两次尝试之间的间隔(秒)
const PROBE_RETRY_GAP_SECS: u64 = 2;
/// 连续失败阈值:连续 N 轮探活全部失败才判定离线(3 × 30s ≈ 90s)。
///
/// 2026-09-22 修复「页面反复抖动」:
/// 原实现是「单次失败即切离线页」——真机日志
/// (`%LOCALAPPDATA%\com.ihui.desktop\logs\智汇AI.log`)实测 41 分钟内 8 次
/// 「切离线 → 约 30s 后切回」,每次都是**单轮瞬时失败**(同机直连与走本地代理
/// 各测 8 次均 200 / ≤1.04s,证明底层只是低概率抖动),却把用户整页替换掉
/// (未发送内容、当前会话路由全部丢失)。改为滞回判定:单次失败只计数不动页面。
const OFFLINE_AFTER_FAILS: u32 = 3;
/// 每 N 轮健康检查做一次构建指纹轮询(6 × 30s = 3 分钟)
const REFRESH_EVERY_ROUNDS: u32 = 6;
/// 热刷新防抖(秒):两次 reload 至少间隔 10 分钟
const RELOAD_DEBOUNCE_SECS: u64 = 600;

/// 后端基址(2026-10-13 立,桌面端「开发后端」联调)。
///
/// 单一真源 = main 窗口的 origin,**不再硬编码线上**:
/// - 窗口 `https://aizhs.top`(生产薄壳常态)⇒ 三个值与旧常量逐字节等价;
/// - 窗口 `http://localhost:8801`(`pnpm dev:desktop:saas` 开发后端联调,
///   见 scripts/desktop-dev-saas.mjs)⇒ 探活/指纹/离线恢复全部指向本机
///   后端(next dev rewrites → api 8802 / ai-service 8803),不会出现
///   「本地后端在跑、却拿线上生产当探活目标」的假离线,恢复时也不会被顶回线上首页。
///
/// ⚠ 读取时机(2026-10-13 CDP 实证):setup 期 WebView2 的 `Source` 还没提交首次
/// 导航,`w.url()` 是 `about:blank`/空串。必须经 `effective_main_window_url`
/// 回落**配置初始 URL**(`--config` 覆盖在编译期已合进内嵌配置),否则 dev 后端
/// 会静默退回生产默认。
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BackendBase {
    /// 构建指纹轮询目标 + 离线恢复回跳目标(origin 根路径)
    pub(crate) frontend_url: String,
    /// 健康检查目标(origin + /api/health)
    pub(crate) health_url: String,
    /// 可恢复地址判据:窗口 origin 前缀(跨「离线→在线」保留用户所在页用)
    pub(crate) origin_prefix: String,
}

impl Default for BackendBase {
    /// 生产默认(线上薄壳)。窗口 URL 取不到 / 非 http(s) 时退回这里 ——
    /// 线上薄壳是唯一已知生产形态,猜错方向的代价仅是 dev 期间探活打向生产,
    /// 而 dev 后端的正规入口本来就是显式改窗口 URL。
    fn default() -> Self {
        Self {
            frontend_url: "https://aizhs.top/".to_string(),
            health_url: "https://aizhs.top/api/health".to_string(),
            origin_prefix: "https://aizhs.top".to_string(),
        }
    }
}

/// 从 main 窗口当前 URL 解析后端基址(纯函数,便于单测)。
///
/// 只认 http/https:自定义协议(tauri:// / offline:// 等)没有可探活的后端,
/// 一律退回生产默认。origin 取 `scheme://host[:port]`,**不含路径** ——
/// 窗口在 `/agents?x=1` 与在 `/` 必须得到同一个基址。
pub(crate) fn resolve_backend_base(window_url: Option<&tauri::Url>) -> BackendBase {
    let Some(url) = window_url else {
        return BackendBase::default();
    };
    if url.scheme() != "http" && url.scheme() != "https" {
        return BackendBase::default();
    }
    // http(s) 的 origin 恒为 scheme://host[:port](无尾斜杠、无路径)
    let origin = url.origin().ascii_serialization();
    BackendBase {
        health_url: format!("{origin}/api/health"),
        frontend_url: format!("{origin}/"),
        origin_prefix: origin,
    }
}

/// main 窗口在**配置**里的初始 URL —— setup 期活 URL 还不可读时的真源。
///
/// 只认 `WebviewUrl::External`:薄壳态 main 窗口永远是绝对地址(线上
/// `https://aizhs.top/`,或开发后端联调的 `http://localhost:8801/`)。
/// 后者由 `scripts/desktop-dev-saas.mjs` 经 `tauri dev --config` 覆盖,而
/// `--config` 的合并发生在**编译期**(tauri-codegen 读 `TAURI_CONFIG` env 后
/// `json_patch::merge` 进内嵌配置),所以运行期 `app.config()` 拿到的一定是
/// 覆盖后的值 —— 2026-10-13 CDP 实证:webview 命令行里的
/// `--remote-debugging-port=9333`(同一次 `--config` 传的)确实生效了。
///
/// `App(PathBuf)`(相对路径)在 dev 下要再拼 `build.devUrl`、生产下拼
/// `frontendDist`,不在本模块职责内,返回 None 让调用方回落生产默认。
fn configured_main_window_url(config: &tauri::Config) -> Option<tauri::Url> {
    let win = config.app.windows.iter().find(|w| w.label == "main")?;
    match &win.url {
        tauri::WebviewUrl::External(url) => Some(url.clone()),
        _ => None,
    }
}

/// main 窗口"当前应处"的 URL 与来源标注:活 URL 仅在**已是 http(s)** 时采纳,
/// 否则退回配置初始 URL。
///
/// 为什么不能只读活 URL(2026-10-13 CDP 实证踩坑):
/// setup 期 WebView2 的 `Source` 尚未提交首次导航,`w.url()` 拿到的是
/// `about:blank`(或空串解析失败)。旧写法
/// `app.get_webview_window("main").and_then(|w| w.url().ok())` 于是变 None,
/// 回落生产默认 ⇒ 开发后端联调时探活打向线上生产、离线恢复把用户顶回线上首页。
/// 而窗口导航历史第 0 条明明是 `http://localhost:8801/`(`--config` 覆盖已生效),
/// 纯粹是读取时机太早 —— 与"页面加载失败"无关,是读取面的缺陷。
///
/// 返回的来源串只进日志,用于上线后一眼区分"读了活 URL"还是"回落了配置"。
fn effective_main_window_url(app: &tauri::AppHandle) -> Option<(tauri::Url, &'static str)> {
    if let Some(w) = app.get_webview_window("main") {
        if let Ok(url) = w.url() {
            if url.scheme() == "http" || url.scheme() == "https" {
                return Some((url, "窗口当前 URL"));
            }
        }
    }
    configured_main_window_url(app.config()).map(|url| (url, "配置初始 URL(活 URL 尚未就绪)"))
}

/// 从线上 HTML 提取构建指纹。
/// 2026-09-17 修订:Next16 线上 chunk 为随机命名(如 chunks/0kfiffa3czsbc.css),
/// 无 main-app- 前缀——改为取首个 `/_next/static/` 资源路径段(部署后必变,零误报)。
fn extract_frontend_fingerprint(html: &str) -> Option<String> {
    let key = "/_next/static/";
    let idx = html.find(key)?;
    let rest = &html[idx + key.len()..];
    let end = rest.find(|c: char| {
        c == '"' || c == '\'' || c == ')' || c == ' ' || c == '\\' || c == '<'
    })?;
    let seg = &rest[..end];
    let ok = !seg.is_empty()
        && seg.len() <= 120
        && seg
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "-_./".contains(c));
    ok.then(|| seg.to_string())
}

fn notify(app: &tauri::AppHandle, title: &str, body: &str) {
    let _ = app
        .notification()
        .builder()
        .title(title)
        .body(body)
        .show();
}

/// 把字符串安全嵌入 JS 表达式(JSON 转义)。
/// 直接 `format!("location.href='{url}'")` 在 URL 含 `'` / `\` 时会破坏脚本并静默失效。
fn js_string(s: &str) -> String {
    serde_json::to_string(s).unwrap_or_else(|_| "\"\"".to_string())
}

// G-379,2026-10-07
/// 宿主发起整页导航前先触发"存草稿"——与 lib.rs CloseRequested 是**同一道闸**:
/// 那边注释原文"三种去向都照发…先存草稿"(无条件 `emit("desktop-before-close")`),
/// 而本模块的热刷新/离线切换同样由宿主掀掉渲染端,CloseRequested 根本不会走,
/// 那条 emit 一次都不发生 ⇒ 正在编辑的草稿随页面一起丢。导航前补发同一事件,
/// 前端消费链与关窗路径完全一致(use-desktop.ts listen → dispatchEvent → 存草稿)。
///
/// emit 是 fire-and-forget,而紧随的 eval 会立刻开始卸载页面 ⇒ 同一轮里 emit 必输给
/// unload,"发了事件"不等于"草稿存住"。故发完等一拍再返回,给监听链留落盘时间
/// (关窗路径有 prevent_close 顶着不缺这一拍,导航路径必须自己等)。失败只告警:
/// 存草稿闸与深链复位闸同纪律——闸失败不拦导航,导航照走,不能因存草稿卡死重连。
const DRAFT_FLUSH_GRACE: Duration = Duration::from_millis(200);

async fn emit_before_close_for_navigation(window: &tauri::WebviewWindow) {
    if let Err(e) = window.emit("desktop-before-close", ()) {
        log::warn!("[auto-refresh] 导航前 emit desktop-before-close 失败: {e}");
    }
    tokio::time::sleep(DRAFT_FLUSH_GRACE).await;
}

/// 探活一次(HEAD /api/health)。仅 2xx 视为健康。
async fn probe_health(client: &reqwest::Client, health_url: &str) -> bool {
    client
        .head(health_url)
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

/// 单轮探活:同一轮内最多尝试 `PROBE_ATTEMPTS` 次,任一次成功即判健康。
///
/// 存在的意义:滤掉**单次瞬时报文丢失**。健康检查的结论会驱动"整页替换用户界面"
/// 这种破坏性动作,单次采样的误判代价远高于多打一次轻量 HEAD 请求。
async fn probe_health_with_retry(client: &reqwest::Client, health_url: &str) -> bool {
    for attempt in 1..=PROBE_ATTEMPTS {
        if probe_health(client, health_url).await {
            if attempt > 1 {
                log::info!("[auto-refresh] 探活第 {attempt} 次成功(已滤掉前序瞬时失败)");
            }
            return true;
        }
        if attempt < PROBE_ATTEMPTS {
            tokio::time::sleep(Duration::from_secs(PROBE_RETRY_GAP_SECS)).await;
        }
    }
    false
}

/// 「是否应从在线切到离线」—— 纯函数,便于单测。
///
/// 语义:连续失败轮数达到 `OFFLINE_AFTER_FAILS` 才切;单次失败只累计计数,不动用户页面。
/// 已处于离线态时恒为 false —— 否则每轮都会重复导航 + 重复弹通知。
fn should_go_offline(currently_offline: bool, consecutive_fails: u32) -> bool {
    !currently_offline && consecutive_fails >= OFFLINE_AFTER_FAILS
}

/// 「是否应从离线恢复到在线」—— 纯函数,便于单测。
///
/// 语义:单次成功即恢复。恢复侧刻意不做滞回 —— 停留在离线页对用户零价值,
/// 而误判恢复的代价只是"再多等一轮"(下一轮失败会重新走阈值判定)。
fn should_recover(currently_offline: bool, healthy: bool) -> bool {
    currently_offline && healthy
}

/// 离线前记下的「用户原本所在地址」能否作为恢复目标。
///
/// 必须落在窗口所在前端 origin 内,否则保留一个不可用地址会让恢复动作把用户送到
/// 错误站点。`origin_prefix` 由 `resolve_backend_base` 从窗口 URL 派生(生产 =
/// `https://aizhs.top`,开发后端联调 = `http://localhost:8801`)。
/// 注意前缀比对后必须紧跟 `/` 或结束 —— 否则 `https://aizhs.top.evil.com/` 也会命中。
fn is_resumable_url(url: &str, origin_prefix: &str) -> bool {
    match url.strip_prefix(origin_prefix) {
        Some(rest) => rest.is_empty() || rest.starts_with('/'),
        None => false,
    }
}

/// ── 更新检查世代互斥(G-698)──
///
/// 每小时静默链(本模块 `check_app_update`)与托盘→前端链(lib.rs emit + 前端
/// useUpdater)并存,两条链都可能「请求在飞时被新检查取代」。互斥范围必须覆盖
/// 「请求 + 结果处理」:每次发起检查先在此领取自增 checkId;结果/进度回调携带
/// 该 checkId,处理前与当前世代比对,不一致即旧世代迟到回调,一律作废
/// (不写任何状态、不触发任何副作用)。
static UPDATE_CHECK_GENERATION: AtomicU64 = AtomicU64::new(0);

/// 发起一次新的更新检查:世代 +1,返回本次检查的 checkId(回调据此比对)。
pub(crate) fn issue_update_check_id() -> u64 {
    UPDATE_CHECK_GENERATION.fetch_add(1, Ordering::SeqCst) + 1
}

/// 作废当前在飞的更新检查回调(托盘→前端链发起检查前调用:新检查一旦开始,
/// 旧检查的迟到回调就没有消费价值,按 checkId 作废)。
pub(crate) fn invalidate_inflight_update_checks() {
    UPDATE_CHECK_GENERATION.fetch_add(1, Ordering::SeqCst);
}

/// 旧世代迟到回调判定:回调携带的 checkId ≠ 当前世代 → 作废。纯函数,便于单测。
fn is_stale_update_check(check_id: u64) -> bool {
    check_id != UPDATE_CHECK_GENERATION.load(Ordering::SeqCst)
}

/// 应用自更新检查(每小时一次):经 updater endpoints(Gitee raw 优先)检查新版,
/// 有则下载+静默安装(安装器接管前先做退出准备,应用退出后重启即新版)。
/// **开发构建例外**:函数体首按 `cfg!(debug_assertions)` 早退,不下载不重启(见该处注释)。
async fn check_app_update(app: &tauri::AppHandle) {
    // 开发构建(debug_assertions:`tauri dev` / `tauri build --debug`)一律不自更新。
    // 实测危害:`pnpm dev:desktop:saas` 起来的壳照样读线上 feed,下载 7.9MB 后静默安装并
    // 自杀重启,把正在改代码的人从自己的会话里踢出去(取证窗口连续两次因此中断);
    // 而 dev 壳跑的是未审构建,"升级"到线上版本等于把开发环境换成发布版。
    // release 安装包行为不变;人工「检查更新」(前端非 silent 路径)不受本判据影响。
    if cfg!(debug_assertions) {
        log::info!("[auto-refresh] site=debug_no_self_update 开发构建跳过应用自更新检查(不下载/不安装/不自重启)");
        return;
    }
    // G-698:领取本次检查的 checkId。后面每个 await 点之后都要先确认世代未被
    // (另一条链的)新检查取代 —— 旧世代的迟到结果/回调一律按 checkId 作废。
    let check_id = issue_update_check_id();
    // G-699:退出准备是安装的硬前置。`updater_builder().on_before_exit(..)` 是插件
    // 提供的退出前钩子(install_inner 尾部拉起安装器 + std::process::exit(0) 之前
    // 调用,updater.rs:837-863):安装器覆盖可执行文件前,先把窗口状态落盘 ——
    // 与 lib.rs restart_app 的退出准备同款,静默更新不得丢窗口位置/尺寸。
    let updater = match app
        .updater_builder()
        .on_before_exit({
            let app = app.clone();
            move || {
                let _ = crate::save_window_state(Some("main".to_string()), app.clone());
                let _ = crate::save_window_state(Some("admin".to_string()), app.clone());
            }
        })
        .build()
    {
        Ok(u) => u,
        Err(e) => {
            log::warn!("[auto-refresh] updater 初始化失败: {e}");
            return;
        }
    };
    // ⚠️ 原先写作 `let Ok(Some(update)) = updater.check().await else { return }`,
    // 把「无新版」与「feed 404 / manifest 解析失败 / 版本号不合法 / 网络不可达」
    // 一并静默吞掉。自更新是后台无人触发的链路,静默 = 用户永远收不到更新而日志里
    // 一行痕迹都没有,故障与"本来就是最新版"不可区分。改为三分支,只有 None 静默。
    let check_result = updater.check().await;
    // G-698:结果处理前校验世代 —— check().await 期间若托盘链发起了新检查,
    // 本次即成旧世代,迟到结果(含"无更新"与"发现新版")一律作废。
    if is_stale_update_check(check_id) {
        log::info!("[auto-refresh] 更新检查 #{check_id} 已被新检查取代 → 迟到结果作废");
        return;
    }
    match check_result {
        Ok(Some(update)) => {
            let ver = update.version.clone();
            log::info!("[auto-refresh] 发现应用新版 {ver} → 下载安装");
            notify(app, "智汇AI", &format!("发现新版本 {ver},正在后台安装…"));
            // ⚠️ 第二个闭包**不是**"退出前钩子"。插件签名是
            //   `download_and_install(on_chunk, on_download_finish)`,而
            //   updater.rs:710 在 `verify_signature()`(:712)**之前**就调用它。
            //   更早的历史实现还传过 `|| app.restart()` —— 字节一落地应用就自杀:
            //     · 验签结果永远拿不到(进程已没了),下面那个 Err 分支形同虚设;
            //     · `install()` 里的 ShellExecuteW 拉起安装器与它赛跑,能不能装上全看
            //   谁先动手 → 实测同一份 feed 一次装上、七次没装上且不留任何错误日志;
            //     · 新实例起来后又检测到同一个新版 → **每小时一次的无限重启循环**
            //   (测试里 33s 一轮,日志 12:00:21→12:03:38 连续七轮即为实证)。
            //   所以两个闭包都只挂 G-698 世代守卫(旧世代的迟到分片/完成事件直接
            //   丢弃,不得触发任何副作用),真正的退出准备挂在上面
            //   `updater_builder().on_before_exit(..)`(那个才是正确的时机)。
            let result = update
                .download_and_install(
                    move |_received, _total| {
                        if is_stale_update_check(check_id) {
                            return;
                        }
                    },
                    move || {
                        if is_stale_update_check(check_id) {
                            return;
                        }
                    },
                )
                .await;
            // 签名校验失败 / 下载中断 / 写临时文件失败都落在这里。只打插件给出的
            // 错误串(不含凭据、不含响应体),绝不打完整 manifest 或响应内容。
            if let Err(e) = result {
                // G-698:下载安装横跨多个 await,收尾同样先校验世代。
                if is_stale_update_check(check_id) {
                    log::info!(
                        "[auto-refresh] 更新 #{check_id} 安装收尾前已被新检查取代 → 结果作废"
                    );
                    return;
                }
                log::warn!("[auto-refresh] 应用更新失败(含签名校验不通过): {e}");
            }
        }
        Ok(None) => {
            // 已是最新版:唯一允许静默的分支
        }
        Err(e) => {
            log::warn!("[auto-refresh] 更新检查失败(feed 不可达或 manifest 非法): {e}");
        }
    }
}

/// 抓取前端 HTML 并维护指纹基线;检测到更新时返回 true(调用方决定是否 reload)。
async fn refresh_baseline(
    client: &reqwest::Client,
    frontend_url: &str,
    baseline: &mut Option<String>,
    _app: &tauri::AppHandle,
) -> bool {
    let Ok(resp) = client.get(frontend_url).send().await else {
        return false;
    };
    let Ok(body) = resp.text().await else {
        return false;
    };
    match extract_frontend_fingerprint(&body) {
        Some(fp) => {
            let changed = baseline.as_ref().map(|p| p != &fp).unwrap_or(false);
            match baseline {
                None => log::info!("[auto-refresh] 指纹基线建立: {fp}"),
                Some(_) if changed => log::info!("[auto-refresh] 检测到前端更新: {fp}"),
                _ => {}
            }
            *baseline = Some(fp);
            changed
        }
        None => {
            log::warn!("[auto-refresh] 未能从 HTML 提取构建指纹(页面结构变更?)");
            false
        }
    }
}

/// 启动后台守卫任务(在 setup 中调用一次)。
///
/// `reveal_on_probe` = 探活落定时**允许**把主窗口点亮。它必须由调用方把用户的
/// `launch_minimized` 开关递进来，而不是在这里再读一遍偏好：
/// 2026-09-28 真机实测「启动后先进托盘」在 8~11 秒后窗口自行转可见，成因就是这里
/// 在线/离线两个分支都无条件 `w.show()`(窗口以 visible:false 创建，历史上靠这一次
/// show 解决"永不出现")。同一件事在两处各读一次偏好必然漂移，所以判据只留 lib.rs 那一份。
/// 读取 Windows 系统代理(WinINET/IE 设置 —— Clash/v2rayN 等代理工具写入的就是它)。
/// 返回 `http://host:port` 形式的代理 URL;未启用 / 非 Windows / 读失败 ⇒ None。
///
/// 2026-10-13 立(遗留票收口,用户实测"按钮没反应"定案后):reqwest 默认只认
/// env 代理(HTTP(S)_PROXY);本机这类"系统代理必须"的环境里,从开始菜单/任务栏
/// 启动的壳没有 env ⇒ 探活直连 aizhs.top 超时,而 WebView2 走系统代理能加载线上页
/// ⇒ 探活与页面加载两条网络路结论相反,出现"探活在线、页面已死"的假在线态
/// (页面落 chrome-error 后 IPC 全拒,按钮全部静默失灵——见本文件探活成功分支的
/// webview 落点自愈)。本函数让探活与 webview 同路:env 代理优先(reqwest 默认),
/// env 缺席时叠读系统代理。
#[cfg(windows)]
fn system_proxy_url() -> Option<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let settings = hkcu
        .open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings")
        .ok()?;
    let enabled: u32 = settings.get_value("ProxyEnable").ok()?;
    if enabled != 1 {
        return None;
    }
    let server: String = settings.get_value("ProxyServer").ok()?;
    // ProxyServer 两种形状:"127.0.0.1:7890"(全协议)或 "http=…;https=…;socks=…"(分协议)。
    // 分协议时优先 https 条目,退而 http —— 探活目标是 https://aizhs.top。
    let parsed = if server.contains('=') {
        let mut https: Option<&str> = None;
        let mut http: Option<&str> = None;
        for part in server.split(';') {
            let mut kv = part.splitn(2, '=');
            let k = kv.next().unwrap_or("").trim();
            let v = kv.next().unwrap_or("").trim();
            if v.is_empty() {
                continue;
            }
            match k {
                "https" => https = Some(v),
                "http" => http = Some(v),
                _ => {}
            }
        }
        https.or(http)?.to_string()
    } else {
        server
    };
    if parsed.is_empty() {
        return None;
    }
    if parsed.starts_with("http://") || parsed.starts_with("https://") {
        Some(parsed)
    } else {
        Some(format!("http://{parsed}"))
    }
}

/// env 代理是否在位(reqwest 默认行为已覆盖它,无需我们再叠系统代理)。
fn env_proxy_present() -> bool {
    ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"]
        .iter()
        .any(|k| std::env::var_os(k).map(|v| !v.is_empty()).unwrap_or(false))
}

/// 探活 Client 构建:env 代理缺席时叠读 Windows 系统代理(见 system_proxy_url)。
fn build_probe_client() -> reqwest::Client {
    let mut builder = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent("ihui-desktop-auto-refresh");
    #[cfg(windows)]
    if !env_proxy_present() {
        match system_proxy_url() {
            Some(p) => match reqwest::Proxy::all(&p) {
                Ok(px) => {
                    log::info!("[auto-refresh] 探活走系统代理 {p}(与 webview 同路)");
                    builder = builder.proxy(px);
                }
                Err(e) => log::warn!("[auto-refresh] 系统代理 {p} 解析失败,探活退回直连: {e}"),
            },
            None => {
                log::info!("[auto-refresh] 无 env/系统代理,探活直连");
            }
        }
    }
    builder
        .build()
        .expect("auto-refresh: build reqwest client")
}

/// 直连 Client:目标 host 命中 `should_bypass_proxy` 时使用(见该函数头注)。
///
/// 与 `build_probe_client` 同参数(timeout/user_agent),唯一差别是 `.no_proxy()`
/// —— reqwest 的 `Proxy::all` 没有 bypass 列表,禁不掉已挂的 env 代理,
/// 所以这里整建一个不走任何代理的 Client,按目标 host 分流选用。
fn build_direct_probe_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent("ihui-desktop-auto-refresh")
        .no_proxy()
        .build()
        .expect("auto-refresh: build reqwest client")
}

/// 探活/指纹目标是否应**绕过**系统/env 代理直连。
///
/// 2026-10-15 立(真机事故根治):本机 Clash Verge 系统代理(127.0.0.1:7897)下,
/// `build_probe_client` 的 `Proxy::all` 把 **localhost 探活也发给代理** ——
/// reqwest 的 `Proxy::all` 没有 bypass 列表(不像 WebView2 走 WinINET
/// ProxyOverride,`<local>` 默认 bypass),Clash 规则未 DIRECT localhost 时把
/// `http://localhost:8801/api/health` 导去节点 ⇒ 探活连续失败 ⇒ 桌面端稳态
/// 显示「网络连接不可用 · 自动重连」,而 WebView2 页面本身加载本地 dev server
/// 是通的 —— 纯假离线。真机日志 2026-10-15 14:45 起连续 9 轮全败实证
/// (`%LOCALAPPDATA%\com.ihui.desktop\logs\ihui-desktop.log`)。
///
/// 判据与系统代理 bypass 语义对齐:回环/内网 host 只有本机可达,永不走代理。
/// 公网地址(线上生产 aizhs.top 等)不命中,仍走 env/系统代理
/// (2026-10-13 遗留票的结论不动)。
pub(crate) fn should_bypass_proxy(host: &str) -> bool {
    // IPv6 字面量可能带方括号(url::Url::host_str 不带,调用方防御性处理)
    let host = host
        .trim()
        .trim_matches(|c| c == '[' || c == ']')
        .to_ascii_lowercase();
    if host == "localhost" || host == "0.0.0.0" || host == "::1" {
        return true;
    }
    // IPv4 点分四段逐段校验(避免引入 ipnetwork 依赖;非 IPv4 一律不 bypass)
    let octets: Option<Vec<u8>> = host.split('.').map(|s| s.parse::<u8>().ok()).collect();
    let Some(o) = octets.filter(|v| v.len() == 4) else {
        return false;
    };
    let (a, b) = (o[0], o[1]);
    a == 127 // 127.0.0.0/8 回环
        || a == 10 // 10.0.0.0/8
        || (a == 192 && b == 168) // 192.168.0.0/16
        || (a == 172 && (16..=31).contains(&b)) // 172.16.0.0/12
}

/// 按后端基址选探活 Client:回环/内网直连,公网走 env/系统代理。
///
/// 放在 `start()` 里二选一(而不是给 Client 挂 per-request bypass)——
/// reqwest 没有 per-request no_proxy,且一个 base 只有一个 origin,
/// 整生命周期只需判一次。
fn select_probe_client(base: &BackendBase) -> reqwest::Client {
    let host = tauri::Url::parse(&base.frontend_url)
        .ok()
        .and_then(|u| u.host_str().map(str::to_string));
    match host {
        Some(h) if should_bypass_proxy(&h) => {
            log::info!(
                "[auto-refresh] 探活目标 {h} 命中 bypass 判据(回环/内网)⇒ 直连,不走系统/env 代理"
            );
            build_direct_probe_client()
        }
        _ => build_probe_client(),
    }
}

pub fn start(app: tauri::AppHandle, reveal_on_probe: bool) {
    tauri::async_runtime::spawn(async move {
        // ── 后端基址:单一真源 = main 窗口的 origin(见 BackendBase 头注)──
        // 生产薄壳(aizhs.top)与旧硬编码常量逐字节等价;开发后端联调(localhost:8801)
        // 自动跟随本机后端。⚠ setup 期活 URL 可能还是 about:blank,必须回落配置初始
        // URL(2026-10-13 CDP 实证:只读活 URL 会让 dev 后端静默退回生产默认)。
        let (base, base_source) = match effective_main_window_url(&app) {
            Some((url, source)) => (resolve_backend_base(Some(&url)), source),
            None => (BackendBase::default(), "生产默认(取不到 http(s) URL)"),
        };
        log::info!(
            "[auto-refresh] 后端基址: frontend={} health={} origin={} 来源={}",
            base.frontend_url,
            base.health_url,
            base.origin_prefix,
            base_source
        );

        // 2026-10-15:回环/内网基址(localhost:8801 开发联调等)必须直连 ——
        // 系统代理(Clash)对 localhost 不保证 DIRECT,`Proxy::all` 无 bypass 列表,
        // 会把本机探活导去节点造成假离线(详见 select_probe_client 头注)。
        let client = select_probe_client(&base);

        // ── 启动序列:探活决定首屏,永不白屏 ──
        // 启动期用「同轮重试」而非 ON/OFF 阈值滞回:此刻只有"在线/离线"二选一,
        // 没有可保留的既有页面,尽早定论才对(阈值滞回是给稳态用的)。
        let healthy = probe_health_with_retry(&client, &base.health_url).await;
        if let Some(w) = app.get_webview_window("main") {
            if healthy {
                // 远程页在窗口隐藏期间已开始加载,直接点亮
                if reveal_on_probe {
                    log::info!("[window-show] site=auto_refresh_probe_online trigger=启动探活成功且 reveal_on_probe=true(用户未勾「启动后先进托盘」)⇒ 点亮前端页");
                    let _ = w.show();
                    log::info!("[auto-refresh] 启动探活成功 → 显示前端页");
                } else {
                    log::info!(
                        "[auto-refresh] 启动探活成功,但用户要求启动后进托盘 → 保持隐藏\
                         (唤起另有三条独立通道:托盘、Ctrl+Shift+I、单实例)"
                    );
                }
                // 2026-09-17 薄壳核心假设自检:远程页是否可用 Tauri IPC。
                // 机制:等页面稳定(8s) → JS 写 location.hash(#ipc-ok / #ipc-missing)→
                // Rust 读窗口 URL(原生属性,不受页面 title/CSP 干扰)并落日志 → 清 hash。
                let diag_win = w.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(Duration::from_secs(8)).await;
                    let _ = diag_win.eval(concat!(
                        "try{location.hash=(typeof window.__TAURI_INTERNALS__!=='undefined')",
                        "?'ipc-ok':'ipc-missing';}catch(e){}"
                    ));
                    tokio::time::sleep(Duration::from_secs(2)).await;
                    if let Ok(u) = diag_win.url() {
                        log::info!("[auto-refresh] 远程页 IPC 自检: {u}");
                    }
                    let _ = diag_win.eval(
                        "try{history.replaceState(null,'',location.pathname+location.search);}catch(e){}",
                    );
                });
            } else {
                // 2026-09-26 补(A10C-1 已知窗口):整页导航前必须复位深链闸门 ——
                // 重载期间渲染端不存在,未复位则此窗口期抵达的 ihui:// 链接会被直投给
                // 没有监听者的 webview 而静默消失(冷启动丢码同型)。就绪由新页面注册
                // 监听后调 take_pending_deep_links 重新点亮;复位调用点的对账判据见
                // lib.rs 测试「导航发起处无一例外必须先复位闸门」+ 守门 G 组。
                crate::reset_deep_link_gate_for_navigation("main");
                // G-379,2026-10-07:导航前过存草稿闸(与 CloseRequested 同通道,下同)
                emit_before_close_for_navigation(&w).await;
                let _ = w.eval(&format!("location.href={}", js_string(OFFLINE_URL)));
                let _ = w.set_title(&format!(
                    "{} · 离线,自动重连中",
                    crate::localized_app_name()
                ));
                if reveal_on_probe {
                    log::info!("[window-show] site=auto_refresh_probe_offline trigger=启动探活失败已切离线兜底页且 reveal_on_probe=true ⇒ 点亮离线页");
                    let _ = w.show();
                } else {
                    log::info!("[auto-refresh] 离线兜底页已就绪,但用户要求启动后进托盘 → 保持隐藏");
                }
                notify(&app, "智汇AI", "网络连接不可用,已切换离线页并自动重连");
                log::warn!("[auto-refresh] 启动探活失败 → 离线兜底页");
            }
        }

        let mut offline = !healthy;
        let mut consecutive_fails: u32 = 0;
        // 切离线前用户所在地址(恢复时优先回跳,避免被踢回 /agents 首页)
        let mut resume_url: Option<String> = None;
        let mut baseline: Option<String> = None;
        let mut round: u32 = 0;
        let mut last_reload: Option<std::time::Instant> = None;
        let mut pending_reload = false;

        loop {
            let now_healthy = probe_health_with_retry(&client, &base.health_url).await;

            if !now_healthy {
                consecutive_fails = consecutive_fails.saturating_add(1);
                if should_go_offline(offline, consecutive_fails) {
                    offline = true;
                    log::warn!(
                        "[auto-refresh] 连续 {consecutive_fails} 轮不可达 → 切换离线兜底页"
                    );
                    if let Some(w) = app.get_webview_window("main") {
                        // 记下用户当前所在地址:恢复时回原处,而不是一律回首页
                        resume_url = w
                            .url()
                            .ok()
                            .map(|u| u.to_string())
                            .filter(|u| is_resumable_url(u, &base.origin_prefix));
                        // 导航前复位深链闸门(同启动离线处,调用点对账见 lib.rs 测试)
                        crate::reset_deep_link_gate_for_navigation("main");
                        // G-379,2026-10-07:导航前过存草稿闸
                        emit_before_close_for_navigation(&w).await;
                        let _ = w.eval(&format!("location.href={}", js_string(OFFLINE_URL)));
                        let _ = w.set_title(&format!(
                            "{} · 离线,自动重连中",
                            crate::localized_app_name()
                        ));
                    }
                    notify(&app, "智汇AI", "网络连接不可用,已切换离线页并自动重连");
                } else {
                    // 关键日志:单次失败只记录、不切页。线上出现此日志但页面未变 = 修复生效
                    log::warn!(
                        "[auto-refresh] 探活失败({consecutive_fails}/{OFFLINE_AFTER_FAILS}),未达阈值不切页"
                    );
                }
            } else {
                consecutive_fails = 0;
                // ── webview 落点自愈(2026-10-13 实测立,用户反馈"登录按钮又没反应")──
                // reqwest 探活与 WebView2 网络栈是两条路:探活成功 ≠ 页面加载成功。
                // 本机 CDP 实测:webview 导航 aizhs.top 三分之二概率 net::ERR_CONNECTION_CLOSED,
                // 页面落到 chrome-error://chromewebdata/ —— 此时 Tauri IPC 以
                // "Origin header is not a valid URL" 拒绝**一切** invoke,页面所有按钮
                // 静默无反应(用户感知即"在浏览器中登录点了没反应"),而壳因探活成功
                // 恒在线态、既不切离线页也无任何提示。每轮探活成功后校验 webview
                // 实际落点,落在错误页即自动重导航回前端页(base.frontend_url)。
                    if let Some(w) = app.get_webview_window("main") {
                        if let Ok(cur) = w.url() {
                            if cur.as_str().starts_with("chrome-error://") {
                                log::warn!(
                                    "[auto-refresh] webview 落在错误页({cur})但探活在环 → 自动重导航回前端"
                                );
                                // 导航前复位深链闸门(调用点对账见 lib.rs 测试)
                                crate::reset_deep_link_gate_for_navigation("main");
                                // G-379,2026-10-07:导航前过存草稿闸
                                emit_before_close_for_navigation(&w).await;
                                let _ = w.eval(&format!("location.href={}", js_string(&base.frontend_url)));
                            let _ = w.set_title(&crate::localized_app_name());
                        }
                    }
                }
                if should_recover(offline, now_healthy) {
                    offline = false;
                    log::info!("[auto-refresh] 连接恢复 → 返回前端页");
                    baseline = None; // 恢复后重建指纹基线,避免陈旧基线误触发
                    pending_reload = false;
                    // 优先回到离线前用户所在地址;该地址不可用(或不存在)才回前端根
                    let target = resume_url
                        .take()
                        .filter(|u| is_resumable_url(u, &base.origin_prefix))
                        .unwrap_or_else(|| base.frontend_url.clone());
                    log::info!("[auto-refresh] 恢复目标: {target}");
                    if let Some(w) = app.get_webview_window("main") {
                        // 导航前复位深链闸门(调用点对账见 lib.rs 测试)
                        crate::reset_deep_link_gate_for_navigation("main");
                        // G-379,2026-10-07:导航前过存草稿闸
                        emit_before_close_for_navigation(&w).await;
                        let _ = w.eval(&format!("location.href={}", js_string(&target)));
                        let _ = w.set_title(&crate::localized_app_name());
                    }
                    notify(&app, "智汇AI", "网络已恢复,已回到工作区");
                }
                round = round.wrapping_add(1);

                // 挂起的热刷新:窗口失焦后执行,不打断前台操作
                if pending_reload {
                    let focused = app
                        .get_webview_window("main")
                        .and_then(|w| w.is_focused().ok())
                        .unwrap_or(false);
                    if !focused {
                        pending_reload = false;
                        log::info!("[auto-refresh] 窗口已失焦 → 执行挂起的热刷新");
                        if let Some(w) = app.get_webview_window("main") {
                            // reload 前复位深链闸门(调用点对账见 lib.rs 测试)
                            crate::reset_deep_link_gate_for_navigation("main");
                            // G-379,2026-10-07:reload 前过存草稿闸
                            emit_before_close_for_navigation(&w).await;
                            let _ = w.eval("location.reload()");
                        }
                    }
                }

                // 首轮立即建基线;此后每 REFRESH_EVERY_ROUNDS 轮检查一次
                if baseline.is_none() || round % REFRESH_EVERY_ROUNDS == 0 {
                    let changed = refresh_baseline(&client, &base.frontend_url, &mut baseline, &app).await;
                    if changed {
                        let debounced = last_reload
                            .map(|t| t.elapsed() < Duration::from_secs(RELOAD_DEBOUNCE_SECS))
                            .unwrap_or(false);
                        if debounced {
                            log::info!("[auto-refresh] 前端有更新,防抖窗口内跳过本轮");
                        } else {
                            last_reload = Some(std::time::Instant::now());
                            let focused = app
                                .get_webview_window("main")
                                .and_then(|w| w.is_focused().ok())
                                .unwrap_or(false);
                            if focused {
                                // 用户正在操作 → 挂起,失焦后自动刷
                                pending_reload = true;
                                log::info!("[auto-refresh] 窗口聚焦中,热刷新挂起待失焦");
                            } else {
                                if let Some(w) = app.get_webview_window("main") {
                                    // reload 前复位深链闸门(调用点对账见 lib.rs 测试)
                                    crate::reset_deep_link_gate_for_navigation("main");
                                    // G-379,2026-10-07:reload 前过存草稿闸
                                    emit_before_close_for_navigation(&w).await;
                                    let _ = w.eval("location.reload()");
                                    notify(
                                        &app,
                                        "智汇AI",
                                        "检测到前端更新,已自动刷新到最新版本",
                                    );
                                }
                            }
                        }
                    }
                }

                // 应用自更新:每小时(round % 120)在线时检查一次,静默安装
                if round > 0 && round % 120 == 0 {
                    check_app_update(&app).await;
                }
            }
            tokio::time::sleep(Duration::from_secs(HEALTH_SECS)).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── 判定的核心回归点:单次瞬时失败绝不能触发"整页替换" ──

    #[test]
    fn single_transient_failure_must_not_go_offline() {
        assert!(!should_go_offline(false, 1), "单次失败就切页 = 2026-09-22 抖动事故本体");
        assert!(
            !should_go_offline(false, OFFLINE_AFTER_FAILS - 1),
            "阈值前一档仍不得切页"
        );
    }

    #[test]
    fn goes_offline_exactly_at_threshold() {
        assert!(should_go_offline(false, OFFLINE_AFTER_FAILS));
        assert!(should_go_offline(false, OFFLINE_AFTER_FAILS + 5));
    }

    #[test]
    fn already_offline_must_not_re_trigger_transition() {
        // 已离线时若仍返回 true,每轮都会重复导航 + 重复弹系统通知
        assert!(!should_go_offline(true, OFFLINE_AFTER_FAILS));
        assert!(!should_go_offline(true, 99));
    }

    #[test]
    fn recovers_on_single_success_only_when_offline() {
        assert!(should_recover(true, true));
        assert!(!should_recover(true, false), "仍不健康不得判恢复");
        assert!(!should_recover(false, true), "本就健康不得触发恢复导航");
        assert!(!should_recover(false, false));
    }

    #[test]
    fn resume_url_must_stay_inside_frontend_origin() {
        // 生产薄壳:origin 前缀 = https://aizhs.top
        assert!(is_resumable_url("https://aizhs.top", "https://aizhs.top"));
        assert!(is_resumable_url("https://aizhs.top/agents", "https://aizhs.top"));
        assert!(is_resumable_url("https://aizhs.top/agents/abc?x=1#y", "https://aizhs.top"));
        // 离线页自身不可作为恢复目标(否则会"恢复到离线页")
        assert!(!is_resumable_url(OFFLINE_URL, "https://aizhs.top"));
        // 异域地址必须拒绝
        assert!(!is_resumable_url("https://evil.example.com/agents", "https://aizhs.top"));
        // 前缀相近但不同域 —— 仅比对前缀会误放行,故必须要求紧跟 '/' 或结束
        assert!(!is_resumable_url("https://aizhs.top.evil.com/agents", "https://aizhs.top"));
        assert!(!is_resumable_url("https://aizhs.top2/agents", "https://aizhs.top"));
        // 开发后端联调:origin 前缀 = http://localhost:8801(同族判据换基址即用)
        assert!(is_resumable_url("http://localhost:8801", "http://localhost:8801"));
        assert!(is_resumable_url("http://localhost:8801/agents", "http://localhost:8801"));
        assert!(!is_resumable_url("http://localhost:8802/agents", "http://localhost:8801"));
        assert!(!is_resumable_url("https://aizhs.top/agents", "http://localhost:8801"));
    }

    // ── 后端基址派生(2026-10-13):窗口 origin 是唯一真源 ──

    #[test]
    fn backend_base_defaults_to_production_when_window_url_missing() {
        // 取不到窗口 URL(或非 http(s))⇒ 生产默认,与旧硬编码常量逐字节等价
        let base = resolve_backend_base(None);
        assert_eq!(base.frontend_url, "https://aizhs.top/");
        assert_eq!(base.health_url, "https://aizhs.top/api/health");
        assert_eq!(base.origin_prefix, "https://aizhs.top");
        assert_eq!(base, BackendBase::default());
    }

    #[test]
    fn backend_base_production_window_is_byte_identical_to_legacy_constants() {
        // 生产薄壳:窗口在任意路径/查询串下都必须得到同一组生产常量(回归保护)
        for raw in [
            "https://aizhs.top/",
            "https://aizhs.top/agents",
            "https://aizhs.top/agents/abc?x=1#y",
        ] {
            let url = tauri::Url::parse(raw).unwrap();
            assert_eq!(
                resolve_backend_base(Some(&url)),
                BackendBase::default(),
                "生产窗口 {raw} 必须逐字节等价旧常量"
            );
        }
    }

    #[test]
    fn backend_base_follows_local_dev_origin() {
        // 开发后端联调(pnpm dev:desktop:saas):窗口 http://localhost:8801
        // ⇒ 探活/指纹/恢复全部指向本机(next rewrites → 8802/8803)
        let url = tauri::Url::parse("http://localhost:8801/").unwrap();
        let base = resolve_backend_base(Some(&url));
        assert_eq!(base.frontend_url, "http://localhost:8801/");
        assert_eq!(base.health_url, "http://localhost:8801/api/health");
        assert_eq!(base.origin_prefix, "http://localhost:8801");
        // 深路径不泄漏进基址
        let deep = tauri::Url::parse("http://localhost:8801/agents/abc?x=1").unwrap();
        assert_eq!(resolve_backend_base(Some(&deep)), base);
    }

    // ── 代理 bypass 判据(2026-10-15):回环/内网探活永不走系统/env 代理 ──

    #[test]
    fn bypass_proxy_covers_loopback_and_private_rejects_public() {
        // 回环 / 特殊地址 —— 本机 dev 后端与内网部署的完整覆盖面
        assert!(should_bypass_proxy("localhost"));
        assert!(should_bypass_proxy("LOCALHOST"));
        assert!(should_bypass_proxy("127.0.0.1"));
        assert!(should_bypass_proxy("127.255.0.53"));
        assert!(should_bypass_proxy("::1"));
        assert!(should_bypass_proxy("[::1]"));
        assert!(should_bypass_proxy("0.0.0.0"));
        // RFC1918 内网段
        assert!(should_bypass_proxy("10.0.0.5"));
        assert!(should_bypass_proxy("10.255.255.255"));
        assert!(should_bypass_proxy("192.168.1.10"));
        assert!(should_bypass_proxy("172.16.0.1"));
        assert!(should_bypass_proxy("172.31.255.254"));
        // 公网与畸形输入一律不 bypass(线上生产 aizhs.top 仍走代理,2026-10-13 票结论不动)
        assert!(!should_bypass_proxy("aizhs.top"));
        assert!(!should_bypass_proxy("8.8.8.8"));
        assert!(!should_bypass_proxy("172.15.0.1"), "172.15 在 12 段外");
        assert!(!should_bypass_proxy("172.32.0.1"), "172.32 在 12 段外");
        assert!(!should_bypass_proxy("11.0.0.1"));
        assert!(!should_bypass_proxy("192.169.0.1"));
        assert!(!should_bypass_proxy("128.0.0.1"));
        assert!(!should_bypass_proxy(""));
        assert!(!should_bypass_proxy("1.2.3"), "非四段不是 IPv4");
        assert!(!should_bypass_proxy("999.1.1.1"), "段越界 parse 失败");
        assert!(!should_bypass_proxy("localhost.evil.com"), "仅精确命中 localhost");
        assert!(!should_bypass_proxy("fe80::1"), "IPv6 链路本地不在判据内(不猜)");
    }

    #[test]
    fn direct_probe_client_builds_and_bypass_holds_for_local_base() {
        // 直连 Client 可构建(reqwest no_proxy 分支不 panic),bypass 判据对
        // 开发后端基址的 host 命中 —— 两者合起来保证 select_probe_client
        // 在 localhost 联调态走直连分支。
        let _ = build_direct_probe_client();
        let base = resolve_backend_base(Some(&tauri::Url::parse("http://localhost:8801/").unwrap()));
        let host = tauri::Url::parse(&base.frontend_url)
            .ok()
            .and_then(|u| u.host_str().map(str::to_string))
            .expect("frontend_url 必须可解析出 host");
        assert_eq!(host, "localhost");
        assert!(should_bypass_proxy(&host));
    }

    #[test]
    fn backend_base_rejects_non_http_schemes() {
        // 自定义协议(tauri:// 等)没有可探活的后端 ⇒ 退回生产默认。
        // 注:offline 兜底页虽是 http(offline.localhost),但本模块只在 base 解析**之后**
        // 才可能把它写进窗口,启动期结构上读不到它,故不在此列。
        for raw in ["tauri://localhost/", "doom://index.html"] {
            let url = tauri::Url::parse(raw).unwrap();
            assert_eq!(
                resolve_backend_base(Some(&url)),
                BackendBase::default(),
                "非 http(s) 窗口 {raw} 必须退回生产默认"
            );
        }
    }

    #[test]
    fn backend_base_setup_time_about_blank_falls_back_to_production() {
        // 2026-10-13 CDP 实证:setup 期 WebView2 的 Source 尚未提交首次导航,
        // `w.url()` 拿到 about:blank(或空串解析失败)。此测试锁住"非 http(s)
        // 一律回落生产默认"的语义;真正的修复在 effective_main_window_url ——
        // 活 URL 不可用时回落**配置初始 URL**,而不是直接认输。
        let url = tauri::Url::parse("about:blank").unwrap();
        assert_eq!(resolve_backend_base(Some(&url)), BackendBase::default());
    }

    #[test]
    fn configured_main_window_url_reads_external_main_window() {
        // 开发后端联调:`--config` 覆盖后的运行期配置里,main 窗口是 localhost:8801。
        // 这正是 setup 期活 URL 还不可读时要回落去找的真源。
        let config: tauri::Config = serde_json::from_value(serde_json::json!({
            "identifier": "com.ihui.desktop",
            "app": {
                "windows": [
                    { "label": "main", "url": "http://localhost:8801/" },
                    { "label": "admin", "url": "https://aizhs.top/" }
                ]
            }
        }))
        .unwrap();
        let url = configured_main_window_url(&config).expect("main 窗口必须取到 External URL");
        assert_eq!(url.as_str(), "http://localhost:8801/");
        // 只认 main:admin 的地址不能顶替
        assert_eq!(
            resolve_backend_base(Some(&url)).health_url,
            "http://localhost:8801/api/health"
        );
        // 生产薄壳同理:配置里是 aizhs.top 就得到旧常量
        let prod: tauri::Config = serde_json::from_value(serde_json::json!({
            "identifier": "com.ihui.desktop",
            "app": { "windows": [ { "label": "main", "url": "https://aizhs.top/" } ] }
        }))
        .unwrap();
        assert_eq!(
            resolve_backend_base(configured_main_window_url(&prod).as_ref()),
            BackendBase::default()
        );
    }

    #[test]
    fn configured_main_window_url_none_for_relative_or_missing_main() {
        // 相对路径(WebviewUrl::App)要再拼 devUrl/frontendDist,不在本模块职责内 ⇒ None
        let relative: tauri::Config = serde_json::from_value(serde_json::json!({
            "identifier": "com.ihui.desktop",
            "app": { "windows": [ { "label": "main", "url": "index.html" } ] }
        }))
        .unwrap();
        assert!(configured_main_window_url(&relative).is_none());
        // 没有 main 窗口 ⇒ None(不 panic)
        let no_main: tauri::Config = serde_json::from_value(serde_json::json!({
            "identifier": "com.ihui.desktop",
            "app": { "windows": [ { "label": "admin", "url": "https://aizhs.top/" } ] }
        }))
        .unwrap();
        assert!(configured_main_window_url(&no_main).is_none());
        // 空 windows ⇒ None
        let empty: tauri::Config = serde_json::from_value(serde_json::json!({
            "identifier": "com.ihui.desktop",
            "app": { "windows": [] }
        }))
        .unwrap();
        assert!(configured_main_window_url(&empty).is_none());
    }

    #[test]
    fn js_string_survives_quotes_and_backslashes() {
        assert_eq!(js_string("https://aizhs.top/agents"), "\"https://aizhs.top/agents\"");
        // 单引号不需要转义,但绝不能被"外层单引号包裹"的写法破坏(原实现即有此风险)
        assert_eq!(js_string("a'b"), "\"a'b\"");
        assert!(js_string("a\"b").contains("\\\""), "双引号必须转义");
        assert!(js_string("a\\b").contains("\\\\"), "反斜杠必须转义");
    }

    // ── 顺带钉住既有的指纹提取行为(改动不得回归) ──

    #[test]
    fn fingerprint_extracts_first_next_static_segment() {
        let html = r#"<script src="/_next/static/chunks/0kfiffa3czsbc.js"></script>"#;
        assert_eq!(
            extract_frontend_fingerprint(html).as_deref(),
            Some("chunks/0kfiffa3czsbc.js")
        );
        assert!(extract_frontend_fingerprint("<html>no chunk here</html>").is_none());
        // 超长路径段视为异常(可能命中非资源内容),不得采信为指纹
        let long = format!("/_next/static/{}", "a".repeat(200));
        assert!(extract_frontend_fingerprint(&long).is_none());
    }

    // ── G-698:更新检查世代互斥 —— 旧世代迟到回调必须按 checkId 作废 ──
    // (本文件唯一触碰 UPDATE_CHECK_GENERATION 的用例;其余用例并行跑互不干扰)

    #[test]
    fn stale_generation_callbacks_are_discarded_by_check_id() {
        // 发起一次检查:领取 checkId,当下不是旧世代
        let check_id = issue_update_check_id();
        assert!(!is_stale_update_check(check_id));
        // 另一条链(托盘检查/下一轮)发起新检查 → 世代推进 → 旧 checkId 作废
        invalidate_inflight_update_checks();
        assert!(
            is_stale_update_check(check_id),
            "旧世代迟到回调必须按 checkId 作废"
        );
        // 新检查自己的 checkId 在当下有效,且旧 checkId 依然作废
        let fresh_id = issue_update_check_id();
        assert!(!is_stale_update_check(fresh_id));
        assert!(is_stale_update_check(check_id));
        // 再次作废后,上一个"新"checkId 也随之变成旧世代
        invalidate_inflight_update_checks();
        assert!(is_stale_update_check(fresh_id));
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
