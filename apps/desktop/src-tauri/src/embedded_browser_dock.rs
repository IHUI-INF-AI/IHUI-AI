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

use std::sync::{Mutex, OnceLock};

use tauri::webview::Color;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url, Webview, WebviewBuilder, WebviewUrl};

use crate::embedded_browser::{
    parse_sentinel, percent_decode, SentinelAction, CHROME_UA, HOME_URL, PICK_JS,
};
use crate::IpcError;

/// 停靠标签页 webview 的 label 前缀。
///
/// 2026-10-24 二次修订(用户:「多标签栏都应该有」):停靠档不再是单 webview,
/// 而是**一个标签一个子 webview**,切换标签 = `hide()`/`show()`,页面状态不丢 ——
/// 与独立窗口 `browser-tab-<id>` 同一套做法。工作区上方的**页面**标签仍只有一个
/// 「浏览器」(用户要求统一),多标签是这个浏览器**内部**的标签栏。
pub const DOCK_TAB_PREFIX: &str = "workpanel-docked-tab-";

/// 停靠浏览器内部最多标签数(与独立窗口 MAX_TABS 同量级,防内存失控)。
const MAX_DOCK_TABS: usize = 8;

fn tab_label(id: u64) -> String {
    format!("{DOCK_TAB_PREFIX}{id}")
}

/// 一个停靠标签页的元数据(前端标签栏渲染 + 切换用)。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockTabInfo {
    pub id: u64,
    pub url: String,
    pub title: String,
    pub active: bool,
}

#[derive(Debug, Clone)]
struct DockTab {
    id: u64,
    url: String,
    title: String,
}

/// 停靠浏览器 UI 状态:标签列表 + 当前标签 + 宿位矩形(逻辑 px)。
///
/// 矩形留在 UI 状态里而不是只用于建窗那一瞬:新标签必须落在**同一个**宿位矩形上,
/// 否则第二个标签会铺在默认位置(0,0)。
#[derive(Debug, Clone, Default)]
struct DockChrome {
    next_id: u64,
    tabs: Vec<DockTab>,
    active: Option<u64>,
    rect: Option<(f64, f64, f64, f64)>,
}

static DOCK_CHROME: OnceLock<Mutex<DockChrome>> = OnceLock::new();

fn chrome() -> &'static Mutex<DockChrome> {
    DOCK_CHROME.get_or_init(|| Mutex::new(DockChrome::default()))
}

fn with_chrome<R>(f: impl FnOnce(&mut DockChrome) -> R) -> R {
    let mut g = chrome().lock().unwrap_or_else(|e| e.into_inner());
    f(&mut g)
}

/// 探针用:停靠浏览器正开着 ⇒ 返回**当前标签**的 webview(cookie 读取目标)。
///
/// 不能只按 label 查:标签可能已被销毁而句柄短暂可查。会话里还有标签才是权威。
pub fn docked_webview(app: &AppHandle) -> Option<Webview> {
    let id = with_chrome(|s| if s.tabs.is_empty() { None } else { s.active })?;
    app.get_webview(&tab_label(id))
}

/// 把标签列表推给工作面板 React 标签栏(listen `embedded-browser://dock-tabs`)。
fn emit_tabs(app: &AppHandle) {
    let payload = with_chrome(|s| tabs_json(s));
    let _ = app.emit_to("main", "embedded-browser://dock-tabs", payload);
}

fn tabs_json(s: &DockChrome) -> serde_json::Value {
    serde_json::json!({
        "tabs": s.tabs.iter().map(|t| DockTabInfo {
            id: t.id,
            url: t.url.clone(),
            title: t.title.clone(),
            active: Some(t.id) == s.active,
        }).collect::<Vec<_>>(),
        "active": s.active,
    })
}


/// 点选回传用的哨兵 origin(与 `embedded_browser::SENTINEL_HOST` 同值)。
/// 停靠 webview 没有注入 BAR_JS,所以这里补 `__ihuiNav`(共用的 `PICK_JS` 用它
/// 把结果带出来,`on_navigation` 拦下不真导航)+ 新窗口链接收进**自己的标签栏**
/// + 标题回传(停靠档标签栏是 React 的,读不到 DOM)。
const DOCK_NAV_JS: &str = r#"(function () {
  window.__ihuiNav = function (action, params) {
    location.href = 'https://browser.ihui.invalid/' + action + (params ? ('?' + params) : '');
  };
  function go(url) {
    if (window.__ihuiNav) window.__ihuiNav('new-tab', 'u=' + encodeURIComponent(String(url)));
  }
  // window.open / target=_blank 一律开成**停靠档自己的新标签**(与独立窗口
  // BAR_JS 同语义),绝不弹 OS 新窗口(用户规则:不允许额外出来一个窗口)。
  window.open = function (url) {
    if (url) go(url);
    return null;
  };
  // 捕获阶段接管:WebView2 对 target=_blank 的"新开窗"默认动作在事件到达目标后
  // 就进入处理,冒泡里 preventDefault 已来不及(实测冒泡不跳、捕获跳)。
  // PICK_JS 的点选监听同样在捕获阶段且排在本脚本之前,它已 preventDefault 时
  // 下面直接放行,不会把选中的链接当跳转。
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented) return;
    var a = e.target && e.target.closest ? e.target.closest('a[target="_blank"], a[target="_new"]') : null;
    if (!a || !a.href) return;
    e.preventDefault();
    go(a.href);
  }, true);
  // 标题回传:on_navigation 只负责把 title 送进会话,不产生真实导航。
  function reportTitle() {
    try {
      if (window.__ihuiNav) window.__ihuiNav('title', 't=' + encodeURIComponent(document.title || ''));
    } catch (e) {}
  }
  window.addEventListener('load', function () { setTimeout(reportTitle, 0); });
  window.addEventListener('pageshow', function () { setTimeout(reportTitle, 0); });
  // SPA 改 document.title 不触发 load/pageshow,盯 <title> 元素兜住。
  function watchTitle() {
    var el = document.querySelector('title');
    if (!el || typeof MutationObserver === 'undefined') return;
    new MutationObserver(reportTitle).observe(el, { childList: true, characterData: true, subtree: true });
  }
  if (document.readyState !== 'loading') watchTitle();
  else document.addEventListener('DOMContentLoaded', watchTitle);
})();"#;

/// 主窗口的 additionalBrowserArgs(**未配置 = None**,不是空串)。
///
/// WebView2 每个进程只有一套共享 Environment:主窗与子 webview 的参数必须一致,
/// 否则 `add_child` 直接报 `0x8007139F`。停靠档因此**照抄主窗配置**,而不是写死常量
/// —— 生产 conf 不配参数(None),CDP 调试 conf 配了调试参数,两种情况都能建窗。
///
/// 注意不能把 None 折成 `""` 再传:tauri 的 `additional_browser_args("")` 会落成
/// `Some("")`,而主窗未配置时 wry 用的是它自己的默认参数
/// (`--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`)——
/// 两者不是同一套 Environment 参数,照样会撞 `0x8007139F`。只有 Some 才照抄。
fn main_window_browser_args(app: &AppHandle) -> Option<String> {
    app.config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .and_then(|w| w.additional_browser_args.clone())
}

/// 最小尺寸护栏:宿位还没量出来(0×0)时不要建 0 尺寸 webview。
fn clamp_geometry(x: f64, y: f64, width: f64, height: f64) -> (LogicalPosition<f64>, LogicalSize<f64>) {
    (
        LogicalPosition::new(x.max(0.0), y.max(0.0)),
        LogicalSize::new(width.max(1.0), height.max(1.0)),
    )
}

// ---------------------------------------------------------------------------
// 建标签 / 铺矩形
// ---------------------------------------------------------------------------

fn apply_rect(wv: &Webview, rect: (f64, f64, f64, f64)) -> Result<(), IpcError> {
    let (pos, size) = clamp_geometry(rect.0, rect.1, rect.2, rect.3);
    wv.set_position(pos)
        .map_err(|e| IpcError::internal(format!("调整停靠位置失败: {e}")))?;
    wv.set_size(size)
        .map_err(|e| IpcError::internal(format!("调整停靠尺寸失败: {e}")))?;
    Ok(())
}

/// 构建一个停靠标签页的 webview builder。
///
/// 与独立窗口的 `browser-tab-<id>` 共用 PICK_JS / 哨兵协议,区别只是**不注入
/// BAR_JS**(停靠档的工具栏是 React 的),标题回传改走 `title` 哨兵。
fn build_tab_builder(app: &AppHandle, id: u64, url: Url) -> WebviewBuilder<tauri::Wry> {
    let app_for_nav = app.clone();
    let app_for_load = app.clone();
    let mut builder = WebviewBuilder::new(tab_label(id), WebviewUrl::External(url))
        .user_agent(CHROME_UA)
        .devtools(true)
        .background_color(Color(0x24, 0x24, 0x24, 0xff))
        .initialization_script(PICK_JS)
        .initialization_script(DOCK_NAV_JS)
        .on_navigation(move |u| {
            if let Some(action) = parse_sentinel(u) {
                match action {
                    SentinelAction::Picked(payload) => {
                        let decoded = percent_decode(&payload);
                        let _ = app_for_nav
                            .emit_to("main", "embedded-browser://element-picked", decoded);
                    }
                    SentinelAction::Title(t) => {
                        let title = percent_decode(&t);
                        let app = app_for_nav.clone();
                        tauri::async_runtime::spawn(async move {
                            update_tab_title(&app, id, title);
                        });
                    }
                    SentinelAction::NewTab(target) => {
                        // 页内 window.open / target=_blank:开成停靠档自己的新标签
                        let app = app_for_nav.clone();
                        tauri::async_runtime::spawn(async move {
                            let full = with_chrome(|s| s.tabs.len() >= MAX_DOCK_TABS);
                            if full {
                                return;
                            }
                            let raw = target.unwrap_or_else(|| HOME_URL.to_string());
                            if let Ok(parsed) = Url::parse(&raw) {
                                let _ = create_tab(&app, parsed, true).await;
                            }
                        });
                    }
                    _ => {}
                }
                return false; // 取消真实导航
            }
            true
        })
        .on_page_load(move |_wv, payload| {
            // 标签的 URL 跟随真实落点(重定向/登录跳转);标题由 DOCK_NAV_JS
            // 的 `title` 哨兵回传,这里只补 URL,避免标题栏停在建窗初值。
            let app = app_for_load.clone();
            let url = payload.url().to_string();
            tauri::async_runtime::spawn(async move {
                let changed = with_chrome(|s| {
                    if let Some(t) = s.tabs.iter_mut().find(|t| t.id == id) {
                        t.url = url.clone();
                        if t.title.is_empty() {
                            t.title = url.clone();
                        }
                        true
                    } else {
                        false
                    }
                });
                if changed {
                    emit_tabs(&app);
                }
            });
        });
    // ⚠️ WebView2 的 Environment 全 App 共享:子 webview 的 additionalBrowserArgs
    // 必须与主窗逐字一致,否则 `add_child` 直接 `0x8007139F`。照抄主窗配置。
    if let Some(args) = main_window_browser_args(app) {
        builder = builder.additional_browser_args(&args);
    }
    builder
}

fn update_tab_title(app: &AppHandle, id: u64, title: String) {
    if title.trim().is_empty() {
        return;
    }
    let changed = with_chrome(|s| {
        if let Some(t) = s.tabs.iter_mut().find(|t| t.id == id) {
            t.title = title;
            true
        } else {
            false
        }
    });
    if changed {
        emit_tabs(app);
    }
}

/// 新建一个标签页并(可选)激活;返回新标签 id。
async fn create_tab(app: &AppHandle, url: Url, activate: bool) -> Result<u64, IpcError> {
    let window = app
        .get_window("main")
        .ok_or_else(|| IpcError::internal("主窗口不存在(停靠浏览器只能挂在主窗上)"))?;
    let (id, rect) = with_chrome(|s| {
        if s.next_id == 0 {
            s.next_id = 1;
        } else {
            s.next_id += 1;
        }
        (s.next_id, s.rect)
    });
    let (pos, size) = match rect {
        Some(r) => clamp_geometry(r.0, r.1, r.2, r.3),
        None => (LogicalPosition::new(0.0, 0.0), LogicalSize::new(1.0, 1.0)),
    };
    let builder = build_tab_builder(app, id, url.clone());
    // add_child 内部 run_on_main_thread 阻塞等待 —— 只能在非主线程调用
    // (async command 线程满足)。
    window
        .add_child(builder, pos, size)
        .map_err(|e| IpcError::internal(format!("创建停靠标签失败: {e}")))?;

    let prev = with_chrome(|s| {
        s.tabs.push(DockTab {
            id,
            url: url.to_string(),
            title: url.to_string(),
        });
        let prev = s.active;
        if activate {
            s.active = Some(id);
        }
        prev
    });
    if activate {
        if let Some(pid) = prev {
            if pid != id {
                if let Some(wv) = app.get_webview(&tab_label(pid)) {
                    let _ = wv.hide();
                }
            }
        }
    } else if let Some(wv) = app.get_webview(&tab_label(id)) {
        let _ = wv.hide();
    }
    emit_tabs(app);
    Ok(id)
}

// ---------------------------------------------------------------------------
// #[tauri::command]
// ---------------------------------------------------------------------------

/// 打开(或复用)停靠浏览器并铺到给定逻辑矩形。
///
/// 会话已有标签 ⇒ 只校正矩形;目标 URL 与当前标签不同才导航 —— React 每次
/// 重渲染都会调一次 `open`,若无条件导航会把用户刚点开的页面顶回起点。
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
    with_chrome(|s| s.rect = Some((x, y, width, height)));

    if let Some(wv) = docked_webview(&app) {
        apply_rect(&wv, (x, y, width, height))?;
        let current = with_chrome(|s| {
            s.active
                .and_then(|id| s.tabs.iter().find(|t| t.id == id))
                .map(|t| t.url.clone())
        });
        if current.as_deref() != Some(url.as_str()) {
            wv.navigate(parsed)
                .map_err(|e| IpcError::internal(format!("停靠浏览器导航失败: {e}")))?;
            with_chrome(|s| {
                if let Some(id) = s.active {
                    if let Some(t) = s.tabs.iter_mut().find(|t| t.id == id) {
                        t.url = url.clone();
                    }
                }
            });
            emit_tabs(&app);
        }
        return Ok(());
    }

    create_tab(&app, parsed, true).await?;
    Ok(())
}

/// 跟随工作面板布局变化(拖动分栏、窗口缩放、标签栏出现/消失)调整停靠矩形。
/// 矩形对**所有**标签生效(隐藏的也要摆正,否则切过去会闪一下默认位置)。
#[tauri::command]
pub async fn embedded_browser_dock_bounds(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), IpcError> {
    let ids = with_chrome(|s| {
        s.rect = Some((x, y, width, height));
        s.tabs.iter().map(|t| t.id).collect::<Vec<_>>()
    });
    for id in ids {
        if let Some(wv) = app.get_webview(&tab_label(id)) {
            apply_rect(&wv, (x, y, width, height))?;
        }
    }
    Ok(())
}

/// 关闭整个停靠浏览器(销毁全部标签 webview;再次 open 会重新建)。
#[tauri::command]
pub async fn embedded_browser_dock_close(app: AppHandle) -> Result<(), IpcError> {
    let ids = with_chrome(|s| {
        let ids = s.tabs.iter().map(|t| t.id).collect::<Vec<_>>();
        *s = DockChrome::default();
        ids
    });
    for id in ids {
        if let Some(wv) = app.get_webview(&tab_label(id)) {
            let _ = wv.close();
        }
    }
    emit_tabs(&app);
    Ok(())
}

/// 新建标签页(对齐独立窗口「+」)。不传 url 时开主页。
#[tauri::command]
pub async fn embedded_browser_dock_new_tab(app: AppHandle, url: Option<String>) -> Result<(), IpcError> {
    let full = with_chrome(|s| s.tabs.len() >= MAX_DOCK_TABS);
    if full {
        return Err(IpcError::internal("标签页数量已达上限"));
    }
    let target = url
        .filter(|u| crate::embedded_browser::is_browsable_url(u))
        .unwrap_or_else(|| HOME_URL.to_string());
    let parsed = Url::parse(&target).map_err(|e| IpcError::internal(format!("URL 解析失败: {e}")))?;
    create_tab(&app, parsed, true).await?;
    Ok(())
}

/// 切换标签(隐藏旧标签、显示新标签,页面状态不丢)。
#[tauri::command]
pub async fn embedded_browser_dock_switch_tab(app: AppHandle, id: u64) -> Result<(), IpcError> {
    let prev = with_chrome(|s| {
        if !s.tabs.iter().any(|t| t.id == id) {
            return None;
        }
        let prev = s.active;
        s.active = Some(id);
        Some(prev)
    });
    let Some(prev) = prev else {
        return Err(IpcError::internal("标签不存在"));
    };
    if let Some(pid) = prev {
        if pid != id {
            if let Some(wv) = app.get_webview(&tab_label(pid)) {
                let _ = wv.hide();
            }
        }
    }
    if let Some(wv) = app.get_webview(&tab_label(id)) {
        // 先摆正再显示:隐藏期间宿位可能变过(标签栏出现/消失)
        if let Some(r) = with_chrome(|s| s.rect) {
            apply_rect(&wv, r)?;
        }
        let _ = wv.show();
        let _ = wv.set_focus();
    }
    emit_tabs(&app);
    Ok(())
}

/// 关闭一个标签页;活动标签被关时自动切到剩下的最后一个。
#[tauri::command]
pub async fn embedded_browser_dock_close_tab(app: AppHandle, id: u64) -> Result<(), IpcError> {
    if let Some(wv) = app.get_webview(&tab_label(id)) {
        let _ = wv.close();
    }
    let next = with_chrome(|s| {
        s.tabs.retain(|t| t.id != id);
        if s.active == Some(id) {
            s.active = s.tabs.last().map(|t| t.id);
        }
        s.active
    });
    if let Some(nid) = next {
        if let Some(wv) = app.get_webview(&tab_label(nid)) {
            let _ = wv.show();
        }
    }
    emit_tabs(&app);
    Ok(())
}

/// 当前标签列表(前端标签栏首帧渲染 + 事件丢失时兜底拉取)。
#[tauri::command]
pub fn embedded_browser_dock_tabs() -> serde_json::Value {
    with_chrome(|s| tabs_json(s))
}

// ---------------------------------------------------------------------------
// 工作面板工具条直连(2026-10-24 用户反馈「两套浏览器、独立窗口有的功能这里没有」)
// ---------------------------------------------------------------------------
//
// 停靠浏览器是 OS 级子 webview,工作面板 React 工具条(后退/前进/刷新/地址栏)
// 管不到它 —— 这些动作必须落到原生 webview 上,而不是走 iframe/代理那套 store。
// 以下命令与独立窗口工具栏(BAR_JS → 哨兵导航)语义对齐,共享同一套 UI 按钮。

fn require_webview(app: &AppHandle) -> Result<Webview, IpcError> {
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
        .map_err(|e| IpcError::internal(format!("停靠浏览器导航失败: {e}")))?;
    with_chrome(|s| {
        if let Some(id) = s.active {
            if let Some(t) = s.tabs.iter_mut().find(|t| t.id == id) {
                t.url = url.clone();
            }
        }
    });
    emit_tabs(&app);
    Ok(())
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

/// 停止加载(对齐独立窗口工具条「停止」:页内 `window.stop()`)。
#[tauri::command]
pub async fn embedded_browser_dock_stop(app: AppHandle) -> Result<(), IpcError> {
    require_webview(&app)?
        .eval("window.stop();")
        .map_err(|e| IpcError::internal(format!("停靠浏览器停止失败: {e}")))
}

/// 回主页(对齐独立窗口工具条「主页」)。
#[tauri::command]
pub async fn embedded_browser_dock_home(app: AppHandle) -> Result<(), IpcError> {
    let parsed = Url::parse(HOME_URL).map_err(|e| IpcError::internal(format!("主页 URL 解析失败: {e}")))?;
    require_webview(&app)?
        .navigate(parsed)
        .map_err(|e| IpcError::internal(format!("停靠浏览器回主页失败: {e}")))?;
    with_chrome(|s| {
        if let Some(id) = s.active {
            if let Some(t) = s.tabs.iter_mut().find(|t| t.id == id) {
                t.url = HOME_URL.to_string();
            }
        }
    });
    emit_tabs(&app);
    Ok(())
}

/// 元素点选开关(对齐独立窗口工具条「元素点选」)。
/// 注入的是同一份 `PICK_JS`,点选结果经哨兵 → `embedded-browser://element-picked`。
#[tauri::command]
pub async fn embedded_browser_dock_pick(app: AppHandle, on: bool) -> Result<(), IpcError> {
    require_webview(&app)?
        .eval(format!("if(window.__ihuiPick){{window.__ihuiPick({on});}}"))
        .map_err(|e| IpcError::internal(format!("停靠浏览器点选切换失败: {e}")))
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

/// 「切换为独立窗口」(2026-10-24 用户规则:独立窗口只能由这里打开)。
///
/// 把当前标签的地址交给独立浏览器窗口(它自带多标签/收藏/历史),然后销毁
/// 全部停靠 webview 并通知前端收起停靠标签 —— 两套形态不会同时存在。
#[tauri::command]
pub async fn embedded_browser_dock_popout(app: AppHandle) -> Result<(), IpcError> {
    let url = with_chrome(|s| {
        s.active
            .and_then(|id| s.tabs.iter().find(|t| t.id == id))
            .map(|t| t.url.clone())
    })
    .ok_or_else(|| IpcError::internal("当前没有可弹出的页面"))?;
    crate::embedded_browser::open_or_navigate(app.clone(), url, None).await?;
    let ids = with_chrome(|s| {
        let ids = s.tabs.iter().map(|t| t.id).collect::<Vec<_>>();
        *s = DockChrome::default();
        ids
    });
    for id in ids {
        if let Some(wv) = app.get_webview(&tab_label(id)) {
            let _ = wv.close();
        }
    }
    let _ = app.emit_to("main", "embedded-browser://dock-popped-out", ());
    Ok(())
}

