// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 线上前端自动刷新 + 断网兜底(2026-09-17 薄壳化配套,同日极致化修订)。
//! 2026-09-22 抖动修复:探活改为「同轮重试 + 连续失败阈值」滞回判定。
//!
//! 薄壳模式下 main 窗口加载 https://aizhs.top 线上前端:
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

use std::time::Duration;

use tauri::Manager;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_updater::UpdaterExt;

const FRONTEND_URL: &str = "https://aizhs.top/agents";
const HEALTH_URL: &str = "https://aizhs.top/api/health";
const OFFLINE_URL: &str = "http://offline.localhost/index.html";
/// 线上前端站点前缀:用于判断窗口地址是否属于线上前端(决定能否跨「离线→在线」保留)
const FRONTEND_ORIGIN_PREFIX: &str = "https://aizhs.top";
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

/// 探活一次(HEAD /api/health)。仅 2xx 视为健康。
async fn probe_health(client: &reqwest::Client) -> bool {
    client
        .head(HEALTH_URL)
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

/// 单轮探活:同一轮内最多尝试 `PROBE_ATTEMPTS` 次,任一次成功即判健康。
///
/// 存在的意义:滤掉**单次瞬时报文丢失**。健康检查的结论会驱动"整页替换用户界面"
/// 这种破坏性动作,单次采样的误判代价远高于多打一次轻量 HEAD 请求。
async fn probe_health_with_retry(client: &reqwest::Client) -> bool {
    for attempt in 1..=PROBE_ATTEMPTS {
        if probe_health(client).await {
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
/// 必须落在线上前端域内,否则保留一个不可用地址会让恢复动作把用户送到错误站点。
/// 注意前缀比对后必须紧跟 `/` 或结束 —— 否则 `https://aizhs.top.evil.com/` 也会命中。
fn is_resumable_url(url: &str) -> bool {
    match url.strip_prefix(FRONTEND_ORIGIN_PREFIX) {
        Some(rest) => rest.is_empty() || rest.starts_with('/'),
        None => false,
    }
}

/// 应用自更新检查(每小时一次):经 updater endpoints(Gitee raw 优先)检查新版,
/// 有则下载+静默安装(安装器接管后应用退出,重启即新版)。
async fn check_app_update(app: &tauri::AppHandle) {
    let updater = match app.updater() {
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
    match updater.check().await {
        Ok(Some(update)) => {
            let ver = update.version.clone();
            log::info!("[auto-refresh] 发现应用新版 {ver} → 下载安装");
            notify(app, "智汇AI", &format!("发现新版本 {ver},正在后台安装…"));
            // ⚠️ 第二个闭包**不是**"退出前钩子"。插件签名是
            //   `download_and_install(on_chunk, on_download_finish)`,而
            //   updater.rs:710 在 `verify_signature()`(:712)**之前**就调用它。
            //   原先这里传的是 `|| app.restart()` —— 于是字节一落地应用就自杀:
            //     · 验签结果永远拿不到(进程已没了),下面那个 Err 分支形同虚设;
            //     · `install()` 里的 ShellExecuteW 拉起安装器与它赛跑,能不能装上全看
            //   谁先动手 → 实测同一份 feed 一次装上、七次没装上且不留任何错误日志;
            //     · 新实例起来后又检测到同一个新版 → **每小时一次的无限重启循环**
            //   (测试里 33s 一轮,日志 12:00:21→12:03:38 连续七轮即为实证)。
            //   正解:这里传空闭包。插件在 install_inner 尾部自己
            //   `ShellExecuteW(安装器)` + `std::process::exit(0)`(updater.rs:837-863),
            //   根本不需要我们重启;要挂"退出前保存状态"请用
            //   `app.updater_builder().on_before_exit(..)`(那个才是正确的时机)。
            let result = update.download_and_install(|_, _| {}, || {}).await;
            // 签名校验失败 / 下载中断 / 写临时文件失败都落在这里。只打插件给出的
            // 错误串(不含凭据、不含响应体),绝不打完整 manifest 或响应内容。
            if let Err(e) = result {
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

/// 抓取线上 HTML 并维护指纹基线;检测到更新时返回 true(调用方决定是否 reload)。
async fn refresh_baseline(
    client: &reqwest::Client,
    baseline: &mut Option<String>,
    _app: &tauri::AppHandle,
) -> bool {
    let Ok(resp) = client.get(FRONTEND_URL).send().await else {
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
                Some(_) if changed => log::info!("[auto-refresh] 检测到线上前端更新: {fp}"),
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
pub fn start(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(12))
            .user_agent("ihui-desktop-auto-refresh")
            .build()
            .expect("auto-refresh: build reqwest client");

        // ── 启动序列:探活决定首屏,永不白屏 ──
        // 启动期用「同轮重试」而非 ON/OFF 阈值滞回:此刻只有"在线/离线"二选一,
        // 没有可保留的既有页面,尽早定论才对(阈值滞回是给稳态用的)。
        let healthy = probe_health_with_retry(&client).await;
        if let Some(w) = app.get_webview_window("main") {
            if healthy {
                // 远程页在窗口隐藏期间已开始加载,直接点亮
                let _ = w.show();
                log::info!("[auto-refresh] 启动探活成功 → 显示线上前端");
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
                let _ = w.eval(&format!("location.href={}", js_string(OFFLINE_URL)));
                let _ = w.set_title(&format!(
                    "{} · 离线,自动重连中",
                    crate::localized_app_name()
                ));
                let _ = w.show();
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
            let now_healthy = probe_health_with_retry(&client).await;

            if !now_healthy {
                consecutive_fails = consecutive_fails.saturating_add(1);
                if should_go_offline(offline, consecutive_fails) {
                    offline = true;
                    log::warn!(
                        "[auto-refresh] 线上连续 {consecutive_fails} 轮不可达 → 切换离线兜底页"
                    );
                    if let Some(w) = app.get_webview_window("main") {
                        // 记下用户当前所在地址:恢复时回原处,而不是一律回首页
                        resume_url = w
                            .url()
                            .ok()
                            .map(|u| u.to_string())
                            .filter(|u| is_resumable_url(u));
                        // 导航前复位深链闸门(同启动离线处,调用点对账见 lib.rs 测试)
                        crate::reset_deep_link_gate_for_navigation("main");
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
                        "[auto-refresh] 线上探活失败({consecutive_fails}/{OFFLINE_AFTER_FAILS}),未达阈值不切页"
                    );
                }
            } else {
                consecutive_fails = 0;
                if should_recover(offline, now_healthy) {
                    offline = false;
                    log::info!("[auto-refresh] 连接恢复 → 返回线上前端");
                    baseline = None; // 恢复后重建指纹基线,避免陈旧基线误触发
                    pending_reload = false;
                    // 优先回到离线前用户所在地址;该地址不可用(或不存在)才回首页
                    let target = resume_url
                        .take()
                        .filter(|u| is_resumable_url(u))
                        .unwrap_or_else(|| FRONTEND_URL.to_string());
                    log::info!("[auto-refresh] 恢复目标: {target}");
                    if let Some(w) = app.get_webview_window("main") {
                        // 导航前复位深链闸门(调用点对账见 lib.rs 测试)
                        crate::reset_deep_link_gate_for_navigation("main");
                        let _ = w.eval(&format!("location.href={}", js_string(&target)));
                        let _ = w.set_title(&crate::localized_app_name());
                    }
                    notify(&app, "智汇AI", "网络已恢复,已回到线上工作区");
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
                            let _ = w.eval("location.reload()");
                        }
                    }
                }

                // 首轮立即建基线;此后每 REFRESH_EVERY_ROUNDS 轮检查一次
                if baseline.is_none() || round % REFRESH_EVERY_ROUNDS == 0 {
                    let changed = refresh_baseline(&client, &mut baseline, &app).await;
                    if changed {
                        let debounced = last_reload
                            .map(|t| t.elapsed() < Duration::from_secs(RELOAD_DEBOUNCE_SECS))
                            .unwrap_or(false);
                        if debounced {
                            log::info!("[auto-refresh] 线上前端有更新,防抖窗口内跳过本轮");
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
        assert!(is_resumable_url("https://aizhs.top"));
        assert!(is_resumable_url("https://aizhs.top/agents"));
        assert!(is_resumable_url("https://aizhs.top/agents/abc?x=1#y"));
        // 离线页自身不可作为恢复目标(否则会"恢复到离线页")
        assert!(!is_resumable_url(OFFLINE_URL));
        // 异域地址必须拒绝
        assert!(!is_resumable_url("https://evil.example.com/agents"));
        // 前缀相近但不同域 —— 仅比对前缀会误放行,故必须要求紧跟 '/' 或结束
        assert!(!is_resumable_url("https://aizhs.top.evil.com/agents"));
        assert!(!is_resumable_url("https://aizhs.top2/agents"));
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
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
