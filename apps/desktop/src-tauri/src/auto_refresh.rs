// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 线上前端自动刷新 + 断网兜底(2026-09-17 薄壳化配套)。
//!
//! 薄壳模式下 main 窗口加载 https://aizhs.top 线上前端:
//! 1. [自动刷新] 每 3 分钟抓取线上 HTML,提取 `main-app-<contenthash>.js` 构建指纹
//!    (App Router 入口 chunk 的内容哈希——部署后必变,且不含时间戳,零误报)。
//!    指纹变化 → `location.reload()` 热刷新,用户无需重启桌面端。
//!    reload 防抖 10 分钟,防止连续部署造成反复打断。
//! 2. [断网兜底] 每 30 秒 HEAD 健康检查;失败 → 导航到内置 `offline://` 协议兜底页
//!    (见 offline/index.html),窗口标题标注离线;恢复 → 自动切回线上前端。
//! 3. [通知] 离线/恢复经系统通知告知(tauri_plugin_notification)。

use std::time::Duration;

use tauri::Manager;
use tauri_plugin_notification::NotificationExt;

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
/// 2026-09-17 修订:Next 16 线上 chunk 为随机命名(如 chunks/0kfiffa3czsbc.css),
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

/// 启动后台守卫任务(在 setup 中调用一次)。
pub fn start(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(12))
            .user_agent("ihui-desktop-auto-refresh")
            .build()
            .expect("auto-refresh: build reqwest client");
        let mut offline = false;
        let mut baseline: Option<String> = None;
        let mut round: u32 = 0;
        let mut last_reload: Option<std::time::Instant> = None;
        loop {
            let healthy = client
                .head(HEALTH_URL)
                .send()
                .await
                .map(|r| r.status().is_success())
                .unwrap_or(false);

            if !healthy {
                if !offline {
                    offline = true;
                    log::warn!("[auto-refresh] 线上不可达 → 切换离线兜底页");
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.eval(&format!("location.href='{OFFLINE_URL}'"));
                        let _ = w.set_title(&format!("{} · 离线,自动重连中", crate::localized_app_name()));
                    }
                    notify(&app, "智汇AI", "网络连接不可用,已切换离线页并自动重连");
                }
            } else {
                if offline {
                    offline = false;
                    log::info!("[auto-refresh] 连接恢复 → 返回线上前端");
                    baseline = None; // 恢复后重建指纹基线,避免陈旧基线误触发
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.eval(&format!("location.href='{FRONTEND_URL}'"));
                        let _ = w.set_title(&crate::localized_app_name());
                    }
                    notify(&app, "智汇AI", "网络已恢复,已回到线上工作区");
                }
                round = round.wrapping_add(1);
                // 首轮立即建基线;此后每 REFRESH_EVERY_ROUNDS 轮检查一次
                if baseline.is_none() || round % REFRESH_EVERY_ROUNDS == 0 {
                    if let Ok(resp) = client.get(FRONTEND_URL).send().await {
                        if let Ok(body) = resp.text().await {
                            match extract_frontend_fingerprint(&body) {
                                Some(fp) => {
                                    let changed = baseline.as_ref().map(|p| p != &fp).unwrap_or(false);
                                    match baseline {
                                        None => log::info!("[auto-refresh] 指纹基线建立: {fp}"),
                                        Some(_) if changed => {
                                            let debounced = last_reload
                                                .map(|t| {
                                                    t.elapsed() < Duration::from_secs(RELOAD_DEBOUNCE_SECS)
                                                })
                                                .unwrap_or(false);
                                            if debounced {
                                                log::info!(
                                                    "[auto-refresh] 线上前端有更新({fp}),防抖窗口内跳过本轮"
                                                );
                                            } else {
                                                log::info!(
                                                    "[auto-refresh] 检测到线上前端更新 → 热刷新"
                                                );
                                                last_reload = Some(std::time::Instant::now());
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
                                        _ => {}
                                    }
                                    baseline = Some(fp);
                                }
                                None => log::warn!("[auto-refresh] 未能从 HTML 提取构建指纹(页面结构变更?)"),
                            }
                        }
                    }
                }
            }
            tokio::time::sleep(Duration::from_secs(HEALTH_SECS)).await;
        }
    });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
