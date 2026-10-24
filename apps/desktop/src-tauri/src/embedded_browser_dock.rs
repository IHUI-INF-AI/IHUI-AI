// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 右侧工作区「停靠浏览器」——把原生 webview 铺在工作面板的 Tab 内容区上(2026-10-24 立)。
//!
//! ## 为什么要有这一档
//!
//! 2026-10-24 用户拍板:内置浏览器必须是**右侧工作区里那个浏览器**(「+」号菜单 /
//! 工作面板 Tab),不是独立弹窗。此前 Trae 网页登录复用了 `embedded_browser_open`
//! 建的独立窗口 —— 形态就不对。
//!
//! 同时,工作面板原生的三档渲染(iframe / 代理 iframe / CDP)都**拿不到登录态**:
//! - iframe:跨域,本站脚本读不到目标站 cookie;
//! - 代理帧:opaque origin(故意不给 allow-same-origin),登录态也不在本机域下;
//! - CDP:依赖服务端 `/api/browser` 转发,生产未接。
//!
//! 唯一能同时满足「长在右侧工作区」+「登录后本机可读 cookie」的形态,是**把原生
//! WebView2 子 webview 按前端给的矩形铺在 Tab 内容区里**:视觉与交互都在工作区,
//! cookie 也落在本进程的 webview cookie store 里(探针可直接读)。
//!
//! ## 契约
//!
//! - 前端 `openDockedTab(url,title)` 建一个 `mode:'docked'` 的占位 Tab,渲染一个
//!   `[data-ihui-dock-host]` 宿位 div;
//! - 前端把宿位 `getBoundingClientRect()`(CSS px = 逻辑 px)传给
//!   `embedded_browser_dock_open`,窗口尺寸变化时持续 `..._dock_bounds`;
//! - 关闭走 `embedded_browser_dock_close`(Tab 关闭 / 验收完成 / 页面卸载)。
//!
//! 窗口开/关与标签管理仍归 `embedded_browser.rs`(独立窗口那条路保持原样,
//! WorkBuddy 仍在用);本文件只管「主窗内的一个子 webview」。

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::webview::Color;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, Url, WebviewBuilder, WebviewUrl};

use crate::embedded_browser::{CHROME_UA, WEBVIEW2_BROWSER_ARGS};
use crate::IpcError;

/// 停靠 webview 的 label(主窗子 webview,全仓唯一)。
pub const DOCK_LABEL: &str = "workpanel-docked-browser";

/// 是否处于打开状态(子 webview 被销毁时由 close 复位)。
static DOCKED: AtomicBool = AtomicBool::new(false);

/// 探针用:若停靠浏览器正开着,返回它的 webview(cookie 读取目标)。
///
/// 不能只按 label 查:`get_webview` 在子 webview 已被销毁后仍可能短暂返回句柄,
/// 而 `DOCKED` 是我们自己维护的权威开关 —— 关掉之后探针应回到「没有浏览器」态。
pub fn docked_webview(app: &AppHandle) -> Option<tauri::Webview> {
    if !DOCKED.load(Ordering::SeqCst) {
        return None;
    }
    app.get_webview(DOCK_LABEL)
}

/// 最小尺寸护栏:宿位还没量出来(0×0)时不要建 0 尺寸 webview。
fn clamp_geometry(x: f64, y: f64, width: f64, height: f64) -> (LogicalPosition<f64>, LogicalSize<f64>) {
    (
        LogicalPosition::new(x.max(0.0), y.max(0.0)),
        LogicalSize::new(width.max(1.0), height.max(1.0)),
    )
}

// ---------------------------------------------------------------------------
// #[tauri::command]
// ---------------------------------------------------------------------------

/// 打开(或复用)停靠浏览器并铺到给定逻辑矩形。
///
/// 复用分支:同一 label 已存在 ⇒ 只调整位置尺寸 + 导航,不重复建 webview
/// (WebView2 子 webview 不支持同名重建)。
#[tauri::command]
pub async fn embedded_browser_dock_open(
    app: AppHandle,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), IpcError> {
    let parsed = Url::parse(&url).map_err(|e| IpcError::internal(format!("URL 解析失败: {e}")))?;
    let (pos, size) = clamp_geometry(x, y, width, height);

    if let Some(wv) = app.get_webview(DOCK_LABEL) {
        wv.set_position(pos)
            .map_err(|e| IpcError::internal(format!("调整停靠位置失败: {e}")))?;
        wv.set_size(size)
            .map_err(|e| IpcError::internal(format!("调整停靠尺寸失败: {e}")))?;
        wv.navigate(parsed)
            .map_err(|e| IpcError::internal(format!("停靠浏览器导航失败: {e}")))?;
        DOCKED.store(true, Ordering::SeqCst);
        return Ok(());
    }

    // 主窗口:桌面端唯一的主 webview 窗口(tauri.conf.json windows[0] 的 label)。
    let window = app
        .get_window("main")
        .ok_or_else(|| IpcError::internal("主窗口不存在(停靠浏览器只能挂在主窗上)"))?;
    let builder = WebviewBuilder::new(DOCK_LABEL, WebviewUrl::External(parsed))
        .user_agent(CHROME_UA)
        .additional_browser_args(WEBVIEW2_BROWSER_ARGS)
        .devtools(true)
        .background_color(Color(0x24, 0x24, 0x24, 0xff));
    // 必须在非主线程调用 add_child(async command 所在线程满足)。
    if let Err(e) = window.add_child(builder, pos, size) {
        // 并发竞态:另一个调用刚建好同名 webview(`get_webview` 那一刻还是 None)。
        // 这不算失败 —— 复用刚建好的那个,补一次矩形校正即可。
        let msg = e.to_string();
        if msg.contains("already exists") {
            if let Some(wv) = app.get_webview(DOCK_LABEL) {
                wv.set_position(pos)
                    .map_err(|e| IpcError::internal(format!("调整停靠位置失败: {e}")))?;
                wv.set_size(size)
                    .map_err(|e| IpcError::internal(format!("调整停靠尺寸失败: {e}")))?;
                DOCKED.store(true, Ordering::SeqCst);
                return Ok(());
            }
        }
        return Err(IpcError::internal(format!("创建停靠浏览器失败: {msg}")));
    }
    DOCKED.store(true, Ordering::SeqCst);
    Ok(())
}

/// 跟随工作面板布局变化(拖动分栏、窗口缩放、Tab 切换)调整停靠矩形。
#[tauri::command]
pub async fn embedded_browser_dock_bounds(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), IpcError> {
    let Some(wv) = app.get_webview(DOCK_LABEL) else {
        return Ok(());
    };
    let (pos, size) = clamp_geometry(x, y, width, height);
    wv.set_position(pos)
        .map_err(|e| IpcError::internal(format!("调整停靠位置失败: {e}")))?;
    wv.set_size(size)
        .map_err(|e| IpcError::internal(format!("调整停靠尺寸失败: {e}")))?;
    Ok(())
}

/// 关闭停靠浏览器(销毁子 webview;再次 open 会重新建)。
#[tauri::command]
pub async fn embedded_browser_dock_close(app: AppHandle) -> Result<(), IpcError> {
    DOCKED.store(false, Ordering::SeqCst);
    if let Some(wv) = app.get_webview(DOCK_LABEL) {
        wv.close()
            .map_err(|e| IpcError::internal(format!("关闭停靠浏览器失败: {e}")))?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// 工作面板工具条直连(2026-10-24 用户反馈「两套浏览器、独立窗口有的功能这里没有」)
// ---------------------------------------------------------------------------
//
// 停靠浏览器是 OS 级子 webview,工作面板 React 工具条(后退/前进/刷新/地址栏)
// 管不到它 —— 这些动作必须落到原生 webview 上,而不是走 iframe/代理那套 store。
// 以下命令与独立窗口工具栏(BAR_JS → 哨兵导航)语义对齐,共享同一套 UI 按钮。

fn require_webview(app: &AppHandle) -> Result<tauri::Webview, IpcError> {
    docked_webview(app).ok_or_else(|| IpcError::internal("停靠浏览器未打开"))
}

/// 地址栏回车:在停靠 webview 里导航(只允许 http/https)。
#[tauri::command]
pub async fn embedded_browser_dock_navigate(app: AppHandle, url: String) -> Result<(), IpcError> {
    if !crate::embedded_browser::is_browsable_url(&url) {
        return Err(IpcError::internal("只允许 http/https 地址"));
    }
    let parsed = Url::parse(&url).map_err(|e| IpcError::internal(format!("URL 解析失败: {e}")))?;
    require_webview(&app)?
        .navigate(parsed)
        .map_err(|e| IpcError::internal(format!("停靠浏览器导航失败: {e}")))
}

#[tauri::command]
pub async fn embedded_browser_dock_back(app: AppHandle) -> Result<(), IpcError> {
    require_webview(&app)?
        .eval("history.back();")
        .map_err(|e| IpcError::internal(format!("停靠浏览器后退失败: {e}")))
}

#[tauri::command]
pub async fn embedded_browser_dock_forward(app: AppHandle) -> Result<(), IpcError> {
    require_webview(&app)?
        .eval("history.forward();")
        .map_err(|e| IpcError::internal(format!("停靠浏览器前进失败: {e}")))
}

#[tauri::command]
pub async fn embedded_browser_dock_reload(app: AppHandle) -> Result<(), IpcError> {
    require_webview(&app)?
        .reload()
        .map_err(|e| IpcError::internal(format!("停靠浏览器刷新失败: {e}")))
}

#[tauri::command]
pub async fn embedded_browser_dock_devtools(app: AppHandle) -> Result<(), IpcError> {
    require_webview(&app)?.open_devtools();
    Ok(())
}

/// 当前落点 URL(登录跳转后地址栏跟随);未打开返回 None。
#[tauri::command]
pub fn embedded_browser_dock_url(app: AppHandle) -> Option<String> {
    docked_webview(&app)
        .and_then(|wv| wv.url().ok())
        .map(|u| u.to_string())
}
