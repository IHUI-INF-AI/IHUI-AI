// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 线上前端自动刷新 + 断网兜底(2026-09-17 薄壳化配套,同日极致化修订)。
//!
//! 薄壳模式下 main 窗口加载 https://aizhs.top 线上前端:
//! 1. [启动序列·永不白屏] main 窗口 conf `visible: false`,本模块探活(≤2 次×8s)后:
//!    在线 → show(远程页已在后台加载);离线 → 切内置 `offline://` 兜底页 + show。
//! 2. [自动刷新] 每 3 分钟抓取线上 HTML,提取首个 `/_next/static/` 资源路径段为
//!    构建指纹(Next16 随机 chunk 命名,部署后必变、不含时间戳,零误报)。
//!    指纹变化 → 若窗口聚焦则挂起 pending,失焦后自动 `location.reload()`,
//!    不打断正在进行的对话;防抖 10 分钟防反复部署干扰。
//! 3. [断网守卫] 每 30 秒 HEAD 健康检查;失败 → 切 offline 页;恢复 → 切回线上。
//! 4. [通知] 离线/恢复/热刷新经系统通知告知(tauri_plugin_notification)。

use std::time::Duration;

use tauri::Manager;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_updater::UpdaterExt;

const FRONTEND_URL: &str = "https://aizhs.top/agents";
const HEALTH_URL: &str = "https://aizhs.top/api/health";
const OFFLINE_URL: &str = "http://offline.localhost/index.html";
/// 健康检查间隔(秒)
const HEALTH_SECS: u64 = 30;
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
    let Ok(Some(update)) = updater.check().await else {
        return; // None=无新版 / Err=检查失败,均静默
    };
    let ver = update.version.clone();
    log::info!("[auto-refresh] 发现应用新版 {ver} → 下载安装");
    notify(app, "智汇AI", &format!("发现新版本 {ver},正在后台安装…"));
    let app2 = app.clone();
    let Ok(()) = update
        .download_and_install(|_, _| {}, move || {
            let _ = app2.restart();
        })
        .await
    else {
        log::warn!("[auto-refresh] 应用更新安装失败");
        return;
    };
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
        let mut healthy = false;
        for _ in 0..2 {
            healthy = client
                .head(HEALTH_URL)
                .send()
                .await
                .map(|r| r.status().is_success())
                .unwrap_or(false);
            if healthy {
                break;
            }
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
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
                let _ = w.eval(&format!("location.href='{OFFLINE_URL}'"));
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
        let mut baseline: Option<String> = None;
        let mut round: u32 = 0;
        let mut last_reload: Option<std::time::Instant> = None;
        let mut pending_reload = false;

        loop {
            let now_healthy = client
                .head(HEALTH_URL)
                .send()
                .await
                .map(|r| r.status().is_success())
                .unwrap_or(false);

            if !now_healthy {
                if !offline {
                    offline = true;
                    log::warn!("[auto-refresh] 线上不可达 → 切换离线兜底页");
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.eval(&format!("location.href='{OFFLINE_URL}'"));
                        let _ = w.set_title(&format!(
                            "{} · 离线,自动重连中",
                            crate::localized_app_name()
                        ));
                    }
                    notify(&app, "智汇AI", "网络连接不可用,已切换离线页并自动重连");
                }
            } else {
                if offline {
                    offline = false;
                    log::info!("[auto-refresh] 连接恢复 → 返回线上前端");
                    baseline = None; // 恢复后重建指纹基线,避免陈旧基线误触发
                    pending_reload = false;
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.eval(&format!("location.href='{FRONTEND_URL}'"));
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
