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
use std::time::{Duration, Instant};

use tauri::webview::Color;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url, Webview, WebviewBuilder, WebviewUrl};

use crate::embedded_browser::{
    idle_discard_threshold, is_audio_playing, parse_sentinel, percent_decode, SentinelAction,
    AUDIO_PROBE_JS, CHROME_UA, HOME_URL, PICK_JS,
};
use crate::IpcError;

/// 停靠标签页 webview 的 label 前缀。
///
/// 2026-10-24 二次修订(用户:「多标签栏都应该有」):停靠档不再是单 webview,
/// 而是**一个标签一个子 webview**,切换标签 = `hide()`/`show()`,页面状态不丢 ——
/// 与独立窗口 `browser-tab-<id>` 同一套做法。工作区上方的**页面**标签仍只有一个
/// 「浏览器」(用户要求统一),多标签是这个浏览器**内部**的标签栏。
pub const DOCK_TAB_PREFIX: &str = "workpanel-docked-tab-";

/// 停靠浏览器内部最多标签数。
///
/// 2026-10-25 用户拍板从 8 收到 6:标签冻结 + 空闲休眠已经把闲置标签的代价压得
/// 很低,再放宽只会让"同时活跃"的页面变多,峰值内存失控。
const MAX_DOCK_TABS: usize = 6;

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
    /// 当前 webview 的 label。**丢弃重建会换新 label** —— Tauri 按 label 注册
    /// webview,同一个 label 二次 `add_child` 会撞名。
    label: String,
    /// 已休眠丢弃:webview 已销毁(页面状态不再保留),切回按 `url` 重载。
    discarded: bool,
    /// 每次切走 +1。后台维护任务拿着自己那一轮的 token,过期即退出 —— 否则
    /// 「切走→切回→再切走」会让两轮任务同时盯同一个标签,提前把它休眠掉。
    hide_token: u64,
    /// 页内探针报上来的出声状态(WebAudio 一路,原生媒体元素另有探测)。
    audio: bool,
}

/// 停靠浏览器 UI 状态:标签列表 + 当前标签 + 宿位矩形(逻辑 px) + 面板可见性。
///
/// 矩形留在 UI 状态里而不是只用于建窗那一瞬:新标签必须落在**同一个**宿位矩形上,
/// 否则第二个标签会铺在默认位置(0,0)。
#[derive(Debug, Clone, Default)]
struct DockChrome {
    next_id: u64,
    next_label: u64,
    tabs: Vec<DockTab>,
    active: Option<u64>,
    rect: Option<(f64, f64, f64, f64)>,
    /// 工作面板此刻是否真的把停靠层摆在屏幕上。切到别的页面标签 ⇒ false,
    /// 此时**所有**标签都算"看不见",可全部冻结/休眠。
    visible: bool,
    /// 上一次推给前端的标签快照(JSON 原文)。相同就不再 emit —— 页面每完成一次
    /// 加载/改一次标题都会走到 emit_tabs,前端收到就 setState + 重拉收藏历史,
    /// 空推会把整块工作面板连带重渲染。
    last_emit: String,
}

static DOCK_CHROME: OnceLock<Mutex<DockChrome>> = OnceLock::new();

fn chrome() -> &'static Mutex<DockChrome> {
    DOCK_CHROME.get_or_init(|| Mutex::new(DockChrome::default()))
}

fn with_chrome<R>(f: impl FnOnce(&mut DockChrome) -> R) -> R {
    let mut g = chrome().lock().unwrap_or_else(|e| e.into_inner());
    f(&mut g)
}

fn alloc_label(s: &mut DockChrome) -> String {
    s.next_label += 1;
    format!("{DOCK_TAB_PREFIX}{}", s.next_label)
}

fn active_label(s: &DockChrome) -> Option<String> {
    s.active
        .and_then(|id| s.tabs.iter().find(|t| t.id == id))
        .map(|t| t.label.clone())
}

fn label_of(id: u64) -> Option<String> {
    with_chrome(|s| s.tabs.iter().find(|t| t.id == id).map(|t| t.label.clone()))
}

fn webview_of(app: &AppHandle, id: u64) -> Option<Webview> {
    app.get_webview(&label_of(id)?)
}

/// 标签此刻是否"不该被看见":面板收起 或 不是活动标签。
fn is_hidden(s: &DockChrome, id: u64) -> bool {
    !s.visible || s.active != Some(id)
}

/// 探针用:停靠浏览器正开着 ⇒ 返回**当前标签**的 webview(cookie 读取目标)。
///
/// 不能只按 label 查:标签可能已被销毁而句柄短暂可查。会话里还有标签才是权威。
pub fn docked_webview(app: &AppHandle) -> Option<Webview> {
    let label = with_chrome(|s| if s.tabs.is_empty() { None } else { active_label(s) })?;
    app.get_webview(&label)
}

/// 把标签列表推给工作面板 React 标签栏(listen `embedded-browser://dock-tabs`)。
///
/// 快照没变就不推(见 `DockChrome::last_emit`)。
fn emit_tabs(app: &AppHandle) {
    let (payload, changed) = with_chrome(|s| {
        let payload = tabs_json(s);
        let text = payload.to_string();
        if s.last_emit == text {
            (payload, false)
        } else {
            s.last_emit = text;
            (payload, true)
        }
    });
    if changed {
        let _ = app.emit_to("main", "embedded-browser://dock-tabs", payload);
    }
}

/// 某个 webview label 是不是**当前活动**停靠标签(焦点挂起循环用)。
///
/// label 现在带世代号(`workpanel-docked-tab-<n>`),不能再从 label 反解标签 id,
/// 故由本模块给出权威答案:活动标签是哪个 webview。
pub(crate) fn is_active_tab_label(label: &str) -> bool {
    with_chrome(|s| active_label(s).as_deref() == Some(label))
}

// ---------------------------------------------------------------------------
// 标签级冻结(2026-10-24 用户要求「按第一种方案加标签冻结」)
// ---------------------------------------------------------------------------
//
// 与独立窗口同一套机制(见 `embedded_browser::hide_and_suspend_tab` 的模块内注释):
// `hide()` 只保活不省内存,隐藏标签的渲染进程照样占着;切走后调 WebView2 官方
// `TrySuspend` 把它真正冻结(页面状态保留),切回先 `Resume` 再显示、无重载闪烁。
// `TrySuspend` 要求 webview 不可见,故顺序严格是 hide ⇒ (延迟确认仍非活动) ⇒ suspend。
//
// 2026-10-25 起这里再往上加两档(用户「内存还能不能少一些」):
// - **可听不冻**:页面在放声音就跳过挂起,等它安静(Chrome 同策略);
// - **空闲休眠**:安静满 `idle_discard_threshold()` 就销毁 webview(丢状态,切回重载)。

fn hide_and_suspend_tab(app: &AppHandle, id: u64) {
    let got = with_chrome(|s| {
        let t = s.tabs.iter_mut().find(|t| t.id == id)?;
        if t.discarded {
            return None;
        }
        t.hide_token += 1;
        Some((t.label.clone(), t.hide_token))
    });
    let Some((label, token)) = got else {
        return;
    };
    let Some(wv) = app.get_webview(&label) else {
        return;
    };
    let _ = wv.hide();
    // 隐藏标签把内存目标档位也调到 Low(与挂起互补:挂起管渲染进程,档位管运行时策略)
    crate::embedded_browser::set_memory_low(&wv, true);
    tauri::async_runtime::spawn(maintain_hidden_tab(app.clone(), id, label, token));
}

/// 某个 webview 的页内探针是否报"正在出声"(WebAudio 一路;原生媒体元素另算)。
pub(crate) fn label_is_audio_playing(label: &str) -> bool {
    with_chrome(|s| {
        s.tabs
            .iter()
            .find(|t| t.label == label)
            .map(|t| t.audio)
            .unwrap_or(false)
    })
}

/// 隐藏标签的后台维护:挂起 → 可听不冻 → 安静够久就休眠。
async fn maintain_hidden_tab(app: AppHandle, id: u64, label: String, token: u64) {
    // 这一轮任务是否仍然有效:标签还在、token 没被下一轮顶掉、webview 没换、
    // 且此刻确实"不该被看见"(用户可能已经切回来)。
    let valid = || {
        with_chrome(|s| {
            s.tabs.iter().any(|t| {
                t.id == id && t.hide_token == token && !t.discarded && t.label == label
            }) && is_hidden(s, id)
        })
    };

    tokio::time::sleep(Duration::from_millis(250)).await;
    if !valid() {
        return;
    }
    if let Some(wv) = app.get_webview(&label) {
        crate::embedded_browser::set_memory_low(&wv, true);
        // 页内探针说正在出声(WebAudio 等原生探不到的音)⇒ 先别冻结;
        // 标签只是隐藏、没被挂起,页面 JS 还在跑,音频停了会自己回传 on=0。
        if !label_is_audio_playing(&label) {
            crate::embedded_browser::set_suspend(&wv, true);
        }
    }

    let threshold = idle_discard_threshold();
    // "安静"从隐藏那一刻算起;检测到出声就重置(正在放歌/通话的标签不休眠)。
    let mut silent_since = Instant::now();
    loop {
        tokio::time::sleep(Duration::from_secs(30)).await;
        if !valid() {
            return;
        }
        // webview 可能刚被上一轮丢弃/用户关掉:没有句柄就结束
        let Some(wv) = app.get_webview(&label) else {
            return;
        };
        // 探测最多阻塞 600ms(`with_webview` 投到 UI 线程 + recv_timeout),
        // 直接在 tokio 工作线程上等会把整个 runtime 卡住 —— 扔到 blocking 池。
        let probe = wv.clone();
        let playing = tokio::task::spawn_blocking(move || is_audio_playing(&probe))
            .await
            .ok()
            .flatten()
            .unwrap_or(false)
            || label_is_audio_playing(&label);
        if playing {
            silent_since = Instant::now();
            continue;
        }
        if silent_since.elapsed() >= threshold {
            discard_tab(&app, id);
            return;
        }
        // 补挂起:切走时页面可能还在导航,`TrySuspend` 那一次没生效且不会自动重试。
        crate::embedded_browser::set_memory_low(&wv, true);
        if !label_is_audio_playing(&label) {
            crate::embedded_browser::set_suspend(&wv, true);
        }
    }
}

/// 销毁一个隐藏标签的 webview,保留标签条目(切回按 url 重载)。
fn discard_tab(app: &AppHandle, id: u64) {
    let label = with_chrome(|s| {
        // 正在看的标签绝不休眠
        if s.visible && s.active == Some(id) {
            return None;
        }
        let t = s.tabs.iter_mut().find(|t| t.id == id)?;
        // 出声中的标签不休眠(WebAudio 探针报上来的也要算)
        if t.discarded || t.audio {
            return None;
        }
        t.discarded = true;
        t.hide_token += 1;
        Some(t.label.clone())
    });
    let Some(label) = label else {
        return;
    };
    if let Some(wv) = app.get_webview(&label) {
        let _ = wv.close();
    }
    log::debug!("[embedded-browser] 停靠标签 {id} 空闲超时,已休眠(切回按 url 重载)");
    emit_tabs(app);
}

fn resume_and_show_tab(webview: &Webview) {
    crate::embedded_browser::set_suspend(webview, false);
    crate::embedded_browser::set_memory_low(webview, false);
    let _ = webview.show();
    let _ = webview.set_focus();
}

/// 取标签的 webview;已被空闲休眠的按存的 url **重建**(新 label)。
async fn ensure_tab_webview(app: &AppHandle, id: u64) -> Result<Webview, IpcError> {
    if let Some(wv) = webview_of(app, id) {
        return Ok(wv);
    }
    let (url, discarded) = with_chrome(|s| {
        s.tabs
            .iter()
            .find(|t| t.id == id)
            .map(|t| (t.url.clone(), t.discarded))
    })
    .ok_or_else(|| IpcError::internal("标签不存在"))?;
    if !discarded {
        return Err(IpcError::internal("标签 webview 不存在"));
    }

    let parsed = Url::parse(&url).map_err(|e| IpcError::internal(format!("URL 解析失败: {e}")))?;
    let window = app
        .get_window("main")
        .ok_or_else(|| IpcError::internal("主窗口不存在(停靠浏览器只能挂在主窗上)"))?;
    let (label, rect) = with_chrome(|s| (alloc_label(s), s.rect));
    let (pos, size) = match rect {
        Some(r) => clamp_geometry(r.0, r.1, r.2, r.3),
        None => (LogicalPosition::new(0.0, 0.0), LogicalSize::new(1.0, 1.0)),
    };
    let builder = build_tab_builder(app, label.clone(), id, parsed);
    window
        .add_child(builder, pos, size)
        .map_err(|e| IpcError::internal(format!("重建停靠标签失败: {e}")))?;
    with_chrome(|s| {
        if let Some(t) = s.tabs.iter_mut().find(|t| t.id == id) {
            t.label = label.clone();
            t.discarded = false;
            t.hide_token += 1;
        }
    });
    log::debug!("[embedded-browser] 停靠标签 {id} 已从休眠恢复(按 {url} 重载)");
    app.get_webview(&label)
        .ok_or_else(|| IpcError::internal("重建后的停靠标签 webview 不存在"))
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

/// 矩形是否真的变了(半像素容差:前端已经取整,这里防重复命令)。
fn rect_differs(old: Option<(f64, f64, f64, f64)>, new: (f64, f64, f64, f64)) -> bool {
    match old {
        Some(r) => {
            (r.0 - new.0).abs() > 0.5
                || (r.1 - new.1).abs() > 0.5
                || (r.2 - new.2).abs() > 0.5
                || (r.3 - new.3).abs() > 0.5
        }
        None => true,
    }
}

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
fn build_tab_builder(app: &AppHandle, label: String, id: u64, url: Url) -> WebviewBuilder<tauri::Wry> {
    let app_for_nav = app.clone();
    let app_for_load = app.clone();
    let mut builder = WebviewBuilder::new(label, WebviewUrl::External(url))
        .user_agent(CHROME_UA)
        .devtools(true)
        .background_color(Color(0x24, 0x24, 0x24, 0xff))
        .initialization_script(PICK_JS)
        .initialization_script(DOCK_NAV_JS)
        .initialization_script(AUDIO_PROBE_JS)
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
                    SentinelAction::Audio(on) => {
                        // 页内音频探针:记到标签上,维护任务据此决定是否休眠
                        with_chrome(|s| {
                            if let Some(t) = s.tabs.iter_mut().find(|t| t.id == id) {
                                t.audio = on;
                            }
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
            // `payload` 是借用,不能进 'static 任务:先把是否「加载完成」拷出来
            let finished = payload.event() == tauri::webview::PageLoadEvent::Finished;
            tauri::async_runtime::spawn(async move {
                let (title, changed) = with_chrome(|s| {
                    if let Some(t) = s.tabs.iter_mut().find(|t| t.id == id) {
                        let changed = t.url != url;
                        t.url = url.clone();
                        if t.title.is_empty() {
                            t.title = url.clone();
                        }
                        (t.title.clone(), changed)
                    } else {
                        (String::new(), false)
                    }
                });
                if title.is_empty() {
                    return;
                }
                // 历史与独立窗口共用同一份 Rust 存储(2026-10-24):两种形态一个浏览器,
                // 在停靠档逛过的页面,弹出独立窗口后历史里也在。
                if finished {
                    crate::browser_store::record_visit(&app, &url, &title);
                }
                // Started 必须推:新文档里 BAR_JS/DOCK_NAV_JS 是重新注入的,页面内的
                // lastState 是空的,不推就整条工具条空白。Finished 只在落点变了时补推。
                // 推完再补挂起(补挂要等 800ms,不能拖慢 UI)。
                if !finished || changed {
                    emit_tabs(&app);
                }
                if finished {
                    suspend_if_still_inactive(&app, id).await;
                }
            });
        });
    // ⚠️ WebView2 的 Environment 全 App 共享:子 webview 的 additionalBrowserArgs
    // 必须与主窗逐字一致,否则 `add_child` 直接 `0x8007139F`。照抄主窗配置。
    if let Some(args) = crate::embedded_browser::main_window_browser_args(app) {
        builder = builder.additional_browser_args(&args);
    }
    builder
}

/// 后台标签加载完成后再补一次挂起。
///
/// 切走时页面若还在导航,`TrySuspend` 会返回 did_suspend=false 且**不会自动重试** ——
/// 不补这一下,后台标签就一直占着渲染进程(切得越快越容易命中)。加载完成后窗口已
/// 满足「不可见」条件,这里补挂一次;真正切回过了就不再挂。
async fn suspend_if_still_inactive(app: &AppHandle, id: u64) {
    if !with_chrome(|s| is_hidden(s, id)) {
        return;
    }
    tokio::time::sleep(std::time::Duration::from_millis(800)).await;
    if !with_chrome(|s| is_hidden(s, id)) {
        return;
    }
    if let Some(wv) = webview_of(app, id) {
        crate::embedded_browser::set_memory_low(&wv, true);
        crate::embedded_browser::set_suspend(&wv, true);
    }
}

fn update_tab_title(app: &AppHandle, id: u64, title: String) {
    if title.trim().is_empty() {
        return;
    }
    let changed = with_chrome(|s| {
        if let Some(t) = s.tabs.iter_mut().find(|t| t.id == id) {
            // 标题没变就不推:SPA 把未读数写进 title 时 MutationObserver 会高频触发
            if t.title == title {
                return false;
            }
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
    let (id, label, rect) = with_chrome(|s| {
        s.next_id = s.next_id.saturating_add(1);
        let label = alloc_label(s);
        (s.next_id, label, s.rect)
    });
    let (pos, size) = match rect {
        Some(r) => clamp_geometry(r.0, r.1, r.2, r.3),
        None => (LogicalPosition::new(0.0, 0.0), LogicalSize::new(1.0, 1.0)),
    };
    let builder = build_tab_builder(app, label.clone(), id, url.clone());
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
            label,
            discarded: false,
            hide_token: 0,
            audio: false,
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
                hide_and_suspend_tab(app, pid);
            }
        }
    } else {
        // 后台新建的标签:隐藏并冻结,不占渲染进程内存
        hide_and_suspend_tab(app, id);
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
    // 是否把 `url` 当导航目标。切回「浏览器」页面标签时前端传 false:
    // 会话还在,用户停在哪页就回哪页,不退回页面标签记的初始 URL。
    navigate: Option<bool>,
) -> Result<(), IpcError> {
    let parsed = Url::parse(&url).map_err(|e| IpcError::internal(format!("URL 解析失败: {e}")))?;
    // 面板重新可见:此前整个停靠层是隐藏的,所有标签都在冻结/休眠(见 close)。
    let (was_visible, rect_changed) = with_chrome(|s| {
        let changed = rect_differs(s.rect, (x, y, width, height));
        s.rect = Some((x, y, width, height));
        let was = s.visible;
        s.visible = true;
        (was, changed)
    });

    if let Some(id) = with_chrome(|s| if s.tabs.is_empty() { None } else { s.active }) {
        // 活动标签可能已被空闲休眠丢弃:这里按 url 重建(重建的那次也算一次导航)
        let wv = ensure_tab_webview(&app, id).await?;
        if !was_visible {
            resume_and_show_tab(&wv);
        }
        // 矩形没变且本来就可见 ⇒ 不碰原生窗口(每次 set_position/set_size 都是主线程布局)
        if !was_visible || rect_changed {
            apply_rect(&wv, (x, y, width, height))?;
        }
        let current = with_chrome(|s| {
            s.tabs.iter().find(|t| t.id == id).map(|t| t.url.clone())
        });
        if navigate.unwrap_or(true) && current.as_deref() != Some(url.as_str()) {
            wv.navigate(parsed)
                .map_err(|e| IpcError::internal(format!("停靠浏览器导航失败: {e}")))?;
            with_chrome(|s| {
                if let Some(t) = s.tabs.iter_mut().find(|t| t.id == id) {
                    t.url = url.clone();
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
///
/// 只对**活动**标签调用原生 `set_position/set_size`:隐藏标签摆了也看不见,而
/// 前端这个命令是 800ms 轮询兜底 —— 对 8 个隐藏 webview 反复摆矩形纯属原生空转。
/// 隐藏标签切回前由 `switch_tab` 用这里存下的矩形一次性摆正。
#[tauri::command]
pub async fn embedded_browser_dock_bounds(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), IpcError> {
    let (label, changed) = with_chrome(|s| {
        let changed = rect_differs(s.rect, (x, y, width, height));
        if changed {
            s.rect = Some((x, y, width, height));
        }
        (active_label(s), changed)
    });
    // 前端 800ms 轮询 + ResizeObserver 会重复送同一个矩形:没变就别再摆原生窗
    if !changed {
        return Ok(());
    }
    if let Some(label) = label {
        if let Some(wv) = app.get_webview(&label) {
            apply_rect(&wv, (x, y, width, height))?;
        }
    }
    Ok(())
}

/// 停靠层被前端收起(切到了工作区别的页面标签)。
///
/// **不销毁标签**:只把整个停靠层标记为不可见 + 隐藏全部 webview 并冻结,回来时
/// 由 `open` 恢复 —— 多标签、滚动位置、表单、登录态全都还在(用户要求「面板切换
/// 保留标签」)。真正销毁只在关掉「浏览器」页面标签(`closePanel`)时发生。
#[tauri::command]
pub async fn embedded_browser_dock_close(app: AppHandle) -> Result<(), IpcError> {
    let ids = with_chrome(|s| {
        s.visible = false;
        s.tabs.iter().map(|t| t.id).collect::<Vec<_>>()
    });
    // 走同一条维护链:立即隐藏并冻结,之后安静满阈值再休眠(面板一直收着也把内存还回去)
    for id in ids {
        hide_and_suspend_tab(&app, id);
    }
    Ok(())
}

/// 彻底销毁停靠浏览器(页面标签被关闭时由前端调用;再次使用会重建)。
#[tauri::command]
pub async fn embedded_browser_dock_destroy(app: AppHandle) -> Result<(), IpcError> {
    let labels = with_chrome(|s| {
        let labels = s.tabs.iter().map(|t| t.label.clone()).collect::<Vec<_>>();
        *s = DockChrome::default();
        labels
    });
    for label in labels {
        if let Some(wv) = app.get_webview(&label) {
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
            hide_and_suspend_tab(&app, pid);
        }
    }
    // 目标标签可能已被空闲休眠丢弃:先重建(按存的 url 重载)
    let wv = ensure_tab_webview(&app, id).await?;
    // 先摆正再显示:隐藏期间宿位可能变过(标签栏出现/消失)
    if let Some(r) = with_chrome(|s| s.rect) {
        apply_rect(&wv, r)?;
    }
    // 先 Resume 再显示:冻结期间页面状态仍在,不重载
    resume_and_show_tab(&wv);
    emit_tabs(&app);
    Ok(())
}

/// 关闭一个标签页;活动标签被关时自动切到剩下的最后一个。
#[tauri::command]
pub async fn embedded_browser_dock_close_tab(app: AppHandle, id: u64) -> Result<(), IpcError> {
    if let Some(wv) = webview_of(&app, id) {
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
        if let Ok(wv) = ensure_tab_webview(&app, nid).await {
            // 接任的标签可能正被冻结:先 Resume 再显示
            resume_and_show_tab(&wv);
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

async fn require_webview(app: &AppHandle) -> Result<Webview, IpcError> {
    let id = with_chrome(|s| if s.tabs.is_empty() { None } else { s.active })
        .ok_or_else(|| IpcError::internal("停靠浏览器未打开"))?;
    ensure_tab_webview(app, id).await
}

/// 地址栏回车:在停靠 webview 里导航(只允许 http/https)。
#[tauri::command]
pub async fn embedded_browser_dock_navigate(app: AppHandle, url: String) -> Result<(), IpcError> {
    if !crate::embedded_browser::is_browsable_url(&url) {
        return Err(IpcError::internal("只允许 http/https 地址"));
    }
    let parsed = Url::parse(&url).map_err(|e| IpcError::internal(format!("URL 解析失败: {e}")))?;
    require_webview(&app).await?
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
    require_webview(&app).await?
        .eval("history.back();")
        .map_err(|e| IpcError::internal(format!("停靠浏览器后退失败: {e}")))
}

#[tauri::command]
pub async fn embedded_browser_dock_forward(app: AppHandle) -> Result<(), IpcError> {
    require_webview(&app).await?
        .eval("history.forward();")
        .map_err(|e| IpcError::internal(format!("停靠浏览器前进失败: {e}")))
}

#[tauri::command]
pub async fn embedded_browser_dock_reload(app: AppHandle) -> Result<(), IpcError> {
    require_webview(&app).await?
        .reload()
        .map_err(|e| IpcError::internal(format!("停靠浏览器刷新失败: {e}")))
}

/// 停止加载(对齐独立窗口工具条「停止」:页内 `window.stop()`)。
#[tauri::command]
pub async fn embedded_browser_dock_stop(app: AppHandle) -> Result<(), IpcError> {
    require_webview(&app).await?
        .eval("window.stop();")
        .map_err(|e| IpcError::internal(format!("停靠浏览器停止失败: {e}")))
}

/// 回主页(对齐独立窗口工具条「主页」)。
#[tauri::command]
pub async fn embedded_browser_dock_home(app: AppHandle) -> Result<(), IpcError> {
    let parsed = Url::parse(HOME_URL).map_err(|e| IpcError::internal(format!("主页 URL 解析失败: {e}")))?;
    require_webview(&app).await?
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
    require_webview(&app).await?
        .eval(format!("if(window.__ihuiPick){{window.__ihuiPick({on});}}"))
        .map_err(|e| IpcError::internal(format!("停靠浏览器点选切换失败: {e}")))
}

#[tauri::command]
pub async fn embedded_browser_dock_devtools(app: AppHandle) -> Result<(), IpcError> {
    require_webview(&app).await?.open_devtools();
    Ok(())
}

/// 当前落点 URL(登录跳转后地址栏跟随);未打开返回 None。
#[tauri::command]
pub fn embedded_browser_dock_url(app: AppHandle) -> Option<String> {
    docked_webview(&app)
        .and_then(|wv| wv.url().ok())
        .map(|u| u.to_string())
}

// ---------------------------------------------------------------------------
// 收藏 / 历史(与独立窗口**共用** browser_store,2026-10-24 用户要求
// 「收藏 历史等两种形态都该有」)
// ---------------------------------------------------------------------------
//
// 同一份存储意味着:停靠档收藏的页面,弹出成独立窗口后收藏/历史里仍然在,
// 反之亦然 —— 用户看到的始终是"一个浏览器",不是两套。

/// 当前活动标签的 (url, title);优先取 webview 真实落点(重定向后可能领先会话)。
fn active_tab_meta(app: &AppHandle) -> Option<(String, String)> {
    let live = docked_webview(app).and_then(|wv| wv.url().ok()).map(|u| u.to_string());
    with_chrome(|s| {
        let id = s.active?;
        let t = s.tabs.iter().find(|t| t.id == id)?;
        let url = live.unwrap_or_else(|| t.url.clone());
        let title = if t.title.is_empty() { url.clone() } else { t.title.clone() };
        Some((url, title))
    })
}

/// 收藏 / 历史快照(停靠档工具条渲染用)。
#[tauri::command]
pub fn embedded_browser_dock_store(app: AppHandle) -> crate::browser_store::BrowserStoreData {
    crate::browser_store::snapshot(&app)
}

/// 切换当前标签的收藏状态,返回新快照。
#[tauri::command]
pub fn embedded_browser_dock_favorite_toggle(
    app: AppHandle,
) -> Result<crate::browser_store::BrowserStoreData, IpcError> {
    let (url, title) = active_tab_meta(&app).ok_or_else(|| IpcError::internal("停靠浏览器未打开"))?;
    if crate::browser_store::is_favorite(&app, &url) {
        crate::browser_store::remove_favorite(&app, &url);
    } else {
        crate::browser_store::add_favorite(&app, &url, &title);
    }
    Ok(crate::browser_store::snapshot(&app))
}

/// 从收藏夹移除一项(收藏夹下拉里的「删除」),返回新快照。
#[tauri::command]
pub fn embedded_browser_dock_favorite_remove(
    app: AppHandle,
    url: String,
) -> crate::browser_store::BrowserStoreData {
    crate::browser_store::remove_favorite(&app, &url);
    crate::browser_store::snapshot(&app)
}

/// 清空历史,返回新快照。
#[tauri::command]
pub fn embedded_browser_dock_history_clear(
    app: AppHandle,
) -> crate::browser_store::BrowserStoreData {
    crate::browser_store::clear_history(&app);
    crate::browser_store::snapshot(&app)
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
    let labels = with_chrome(|s| {
        let labels = s.tabs.iter().map(|t| t.label.clone()).collect::<Vec<_>>();
        *s = DockChrome::default();
        labels
    });
    for label in labels {
        if let Some(wv) = app.get_webview(&label) {
            let _ = wv.close();
        }
    }
    let _ = app.emit_to("main", "embedded-browser://dock-popped-out", ());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 前端 800ms 轮询会重复送同一个矩形:只有真变化才该去动原生窗。
    #[test]
    fn rect_differs_only_on_real_change() {
        let base = (10.0, 20.0, 300.0, 200.0);
        // 第一次总要摆
        assert!(rect_differs(None, base));
        assert!(!rect_differs(Some(base), base));
        // 半像素内抖动不算变化(前端取整 / DPI 舍入)
        assert!(!rect_differs(Some(base), (10.2, 19.8, 300.4, 200.1)));
        // 任一维真的变了都要摆
        assert!(rect_differs(Some(base), (12.0, 20.0, 300.0, 200.0)));
        assert!(rect_differs(Some(base), (10.0, 20.0, 300.0, 260.0)));
    }
}

