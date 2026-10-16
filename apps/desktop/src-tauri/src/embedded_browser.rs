// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 项目内嵌浏览器(2026-10-16 升级为 Trae 形态)。
//!
//! ## 形态演进
//!
//! - 2026-10-12:内嵌 WebView2 小弹窗(只读工具条)。
//! - 2026-10-15:用户拍板改外部真 Chrome + CDP。
//! - 2026-10-16(前版):内嵌回归,单窗 + 自绘只读工具条。
//! - **2026-10-16(本版,用户拍板「要跟 Trae 一致」)**:升级为
//!   **单窗多 webview 的 Chrome 式浏览器** —— 真·多标签、可编辑地址栏、
//!   前进/后退/刷新/停止/主页、DevTools、元素点选(自有 + 第三方站点)。
//!
//! ## 架构(为什么这么做)
//!
//! 1. **单窗多 webview**:窗口 `embedded-browser` 由 [`tauri::window::WindowBuilder`]
//!    建成(不带 webview),再用 `Window::add_child` 挂 N 个内容 webview
//!    (`browser-tab-<id>`),每个 webview = 一个标签页。切换标签 = `hide()`/`show()`,
//!    **页面状态不丢**(对标 Trae/Chrome)。`add_child` 挂在 tauri 的 `unstable`
//!    feature 下,用户 2026-10-16 拍板启用(见 Cargo.toml 注释)。
//!
//! 2. **工具条为什么注入,而不是另开一个工具条 webview**:Tauri 2 里"窗口内第二个
//!    常驻 webview 做工具条"要额外维护布局/层叠/焦点三套状态,而工具条注入到内容页
//!    只需一份 CSSOM 样式,且天然随窗口缩放。**代价**:注入脚本必须用
//!    `element.style.setProperty`(CSSOM)而非 `<style>` 元素 —— 第三方站点 CSP 的
//!    `style-src` 会拦 `<style>`/`style=` 属性,但不拦 CSSOM。
//!
//! 3. **工具条怎么和 Rust 通信**:内容 webview 加载的是第三方站点,没有 IPC
//!    (CSP 不放行 `ipc.localhost`,且 capability 也不给它们放行 origin)。故工具条的
//!    所有动作都走 **哨兵导航**:`location.href = 'https://browser.ihui.invalid/<动作>?<参数>'`,
//!    由每个 webview 的 [`tauri::webview::WebviewBuilder::on_navigation`] 拦截
//!    (返回 `false` 取消真实导航)并转交 Rust 处理。这条通道**与站点 CSP 无关**,
//!    是跨站点唯一可靠的"页面 → 宿主"回路。
//!
//! 4. **元素点选回传**同上:点选脚本采集到元素信息后,同样走哨兵导航
//!    (`/picked?d=<base64url(json)>`),Rust 拦截后 `emit_to("main", ...)` 给宿主应用。
//!
//! ## 安全边界
//!
//! - 内容 webview 加载第三方站点,**不授予任何 IPC**;capability `browser-chrome`
//!   只对本地 origin 生效(无 `remote` 字段)⇒ 第三方页即便猜到命令名也调不动。
//! - `is_browsable_url` 只放行 http/https,杜绝 `file:`/`tauri:`/`javascript:` 注入。
//! - 哨兵导航只认 `browser.ihui.invalid` 这一个 host,其它一律放行给真实导航。
//!
//! ## 建窗时序铁律(沿用)
//!
//! Windows 上 WebView2 建窗在**同步命令 / 事件处理器**里会死锁(官方 known issue)。
//! 故:①open 命令必须 `async`;②哨兵处理器在 `on_navigation`(主线程)里**只做派发**,
//! 真正的建窗/关窗在 `async_runtime::spawn` 出来的工作线程上跑 —— 因为
//! `Window::add_child` 内部是 `run_on_main_thread` + 阻塞等待,主线程直接调必自锁。
//!
//! ## 降级兜底(2026-10-16 补)
//!
//! `unstable` 多 webview 是 Tauri 官方标注的实验特性,极端环境可能建不出来。
//! 故 `open_or_navigate` 有两条降级路:**①裸窗 `WindowBuilder::build` 失败**;
//! **②裸窗建起来但 `add_child` 失败** —— 都退到 `spawn_degraded_window`:
//! 用 `WebviewWindowBuilder` 建「窗口自带 webview」的单窗(label 仍是
//! `embedded-browser`,于是窗口 label == webview label),**多标签不可用,但
//! 浏览/工具条/点选/DevTools 全部照常**。会话里 `degraded = true` 标记,工具条
//! 据此隐藏标签栏(`multiTab:false`),`Switch`/`CloseTab` 哨兵在降级下退化为
//! 空操作 / 关窗,`active_webview` 改取窗口自身的 webview。
//!
//! ## WebView2 运行时
//!
//! `tauri.conf.json` 设 `bundle.windows.webviewInstallMode = offlineInstaller`
//! (内嵌完整 WebView2 运行时,离线可装;安装包 +~127MB)。想瘦身可改
//! `embedBootstrapper`(+1.8MB,装时联网下运行时)或 `downloadBootstrapper`(默认,最小)。

use std::sync::Mutex;

use tauri::webview::Color;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Url, WebviewBuilder, WebviewUrl,
};

use crate::IpcError;

/// 浏览器窗口 label(全仓唯一)。
pub const BROWSER_WINDOW_LABEL: &str = "embedded-browser";

/// 主页(点「主页」按钮去这里)。
pub const HOME_URL: &str = "https://aizhs.top/";

/// 内容 webview label 前缀;完整 label = `browser-tab-<id>`。
const TAB_LABEL_PREFIX: &str = "browser-tab-";

/// 哨兵导航 host(RFC 2606 保留 `.invalid`,永不解析;仅作页面→宿主的信号)。
const SENTINEL_HOST: &str = "browser.ihui.invalid";

/// 工具条总高(标签栏 34 + 工具栏 38);注入脚本内 `${BAR_H}` 语义同值。
/// 保留为设计常量:工具条高度由注入脚本的 TAB_H+TOOL_H 决定,此处仅作文档锚点。
#[allow(dead_code)]
const BAR_HEIGHT: u32 = 72;

/// 单窗最多标签数(防御性上限,避免无限建 webview)。
const MAX_TABS: usize = 12;

/// Chrome UA。WebView2 默认 UA 带 `Edg/` 标识,登录类站点可能据 UA 走不同分支
/// (也会把"内嵌"这件事暴露给站点);显式伪装成 Chrome,与内核事实自洽。
pub const CHROME_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ==================== 工具条注入脚本(纯 CSSOM,零 IPC) ====================

/// 工具条注入脚本。定义 `window.__ihuiNav(action, params)`(哨兵导航出口)与
/// `window.__ihuiBarRender(state)`(Rust 通过 `eval` 推状态)。
///
/// **只允许 CSSOM**(`style.setProperty`),不得出现 `<style>`/`style="..."`,
/// 否则被第三方站点 CSP `style-src` 拦掉(见模块头 §2)。
const BAR_JS: &str = r#"(function () {
  if (window.__ihuiBarInstalled) return;
  window.__ihuiBarInstalled = true;
  var TAB_H = 34, TOOL_H = 38, TOTAL = TAB_H + TOOL_H;
  var SENTINEL = 'https://browser.ihui.invalid/';

  function el(tag, props, text) {
    var e = document.createElement(tag);
    if (props) for (var k in props) e.style.setProperty(k, props[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  window.__ihuiNav = function (action, params) {
    location.href = SENTINEL + action + (params ? ('?' + params) : '');
  };
  function btn(label, title, action, params) {
    var b = el('button', {
      width: '28px', height: '28px', 'line-height': '26px', flex: '0 0 auto',
      background: 'transparent', color: '#cfcfcf', padding: '0',
      border: '1px solid #333333', 'border-radius': '6px',
      cursor: 'pointer', 'font-size': '14px'
    }, label);
    b.type = 'button';
    b.title = title;
    b.addEventListener('mouseenter', function () { b.style.setProperty('background', '#2f2f2f'); });
    b.addEventListener('mouseleave', function () { b.style.setProperty('background', 'transparent'); });
    b.addEventListener('click', function (e) { e.preventDefault(); window.__ihuiNav(action, params); });
    return b;
  }

  var bar = el('div', {
    position: 'fixed', top: '0', left: '0', right: '0', height: TOTAL + 'px',
    'z-index': '2147483647', background: '#1c1c1c', color: '#e8e8e8',
    'font-family': '-apple-system, "Segoe UI", "Microsoft YaHei", sans-serif',
    'font-size': '13px', 'user-select': 'none', '-webkit-user-select': 'none',
    'box-sizing': 'border-box', 'border-bottom': '1px solid #2f2f2f',
    display: 'flex', 'flex-direction': 'column'
  });
  bar.id = '__ihui_browser_bar';
  bar.setAttribute('data-tauri-drag-region', '');

  var tabStrip = el('div', {
    display: 'flex', 'align-items': 'center', gap: '4px', height: TAB_H + 'px',
    padding: '0 8px', 'box-sizing': 'border-box', overflow: 'hidden',
    'border-bottom': '1px solid #262626'
  });
  var toolbar = el('div', {
    display: 'flex', 'align-items': 'center', gap: '6px', height: TOOL_H + 'px',
    padding: '0 8px', 'box-sizing': 'border-box'
  });

  var urlInput = el('input', {
    flex: '1 1 auto', height: '26px', 'line-height': '26px', background: '#111111',
    color: '#e0e0e0', 'border-radius': '6px', padding: '0 10px', 'font-size': '12px',
    border: '1px solid #333333', outline: 'none', 'box-sizing': 'border-box'
  });
  urlInput.type = 'text';
  urlInput.spellcheck = false;
  urlInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); window.__ihuiNav('navigate', 'u=' + encodeURIComponent(urlInput.value)); urlInput.blur(); }
  });

  toolbar.appendChild(btn('\u2190', '后退', 'back'));
  toolbar.appendChild(btn('\u2192', '前进', 'forward'));
  toolbar.appendChild(btn('\u21bb', '刷新', 'reload'));
  toolbar.appendChild(btn('\u2715', '停止', 'stop'));
  toolbar.appendChild(btn('\u2302', '主页', 'home'));
  toolbar.appendChild(urlInput);
  toolbar.appendChild(btn('\u2699', '开发者工具', 'devtools'));
  var pickBtn = btn('\u25ce', '元素点选', 'pick', 'on=1');
  toolbar.appendChild(pickBtn);
  toolbar.appendChild(btn('\u2715', '关闭窗口', 'close-window'));

  var newTabBtn = btn('+', '新建标签页', 'new-tab', 'u=' + encodeURIComponent('about:blank'));
  bar.appendChild(tabStrip);
  bar.appendChild(toolbar);

  function mount() {
    if (document.body && !document.getElementById('__ihui_browser_bar')) {
      document.body.appendChild(bar);
      document.documentElement.style.setProperty('padding-top', TOTAL + 'px');
      document.documentElement.style.setProperty('box-sizing', 'border-box');
    }
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  // SPA 导航同步地址栏
  try {
    var _push = history.pushState;
    history.pushState = function () { _push.apply(history, arguments); syncUrl(); };
    var _replace = history.replaceState;
    history.replaceState = function () { _replace.apply(history, arguments); syncUrl(); };
    window.addEventListener('popstate', syncUrl);
    window.addEventListener('hashchange', syncUrl);
  } catch (e) {}
  function syncUrl() { if (document.activeElement !== urlInput) urlInput.value = location.href; }

  var lastState = { tabs: [], picking: false };
  window.__ihuiBarRender = function (s) {
    lastState = s || lastState;
    // 标签栏(降级单 webview 模式整条隐藏 —— 没有多标签可言)
    var multi = (s.multiTab !== false);
    tabStrip.style.setProperty('display', multi ? 'flex' : 'none');
    while (tabStrip.firstChild) tabStrip.removeChild(tabStrip.firstChild);
    if (multi) {
      (s.tabs || []).forEach(function (t) {
        var tab = el('div', {
          display: 'flex', 'align-items': 'center', gap: '6px', flex: '0 0 auto',
          'max-width': '200px', height: '24px', padding: '0 8px', 'border-radius': '6px',
          background: t.active ? '#2f2f2f' : 'transparent', color: t.active ? '#ffffff' : '#b0b0b0',
          cursor: 'pointer', 'font-size': '12px', 'box-sizing': 'border-box'
        });
        var titleText = (t.active && document.title) ? document.title : (t.title || t.url || '新标签页');
        var title = el('span', { overflow: 'hidden', 'white-space': 'nowrap', 'text-overflow': 'ellipsis', 'max-width': '160px' }, titleText);
        var x = el('span', { 'flex': '0 0 auto', color: '#888888', cursor: 'pointer', 'font-size': '13px' }, '\u2715');
        x.addEventListener('click', function (e) { e.stopPropagation(); window.__ihuiNav('close-tab', 'i=' + t.id); });
        tab.appendChild(title);
        tab.appendChild(x);
        tab.addEventListener('click', function () { window.__ihuiNav('switch', 'i=' + t.id); });
        tabStrip.appendChild(tab);
      });
      tabStrip.appendChild(newTabBtn);
    }
    // 地址栏
    if (document.activeElement !== urlInput) urlInput.value = s.url || location.href;
    // 点选态
    pickBtn.style.setProperty('background', s.picking ? '#3b3b7a' : 'transparent');
    pickBtn.title = s.picking ? '退出点选' : '元素点选';
  };
  window.__ihuiBarRender(lastState);
})();"#;

// ==================== 元素点选脚本 ====================

/// 元素点选安装/卸载脚本。`window.__ihuiPick(on)` 开关;点选命中后走哨兵
/// `/picked?d=<encodeURIComponent(json)>` 回传(见模块头 §4)。同样只用 CSSOM。
const PICK_JS: &str = r#"(function () {
  window.__ihuiPick = function (on) {
    if (!on) { if (window.__ihuiPickOff) { window.__ihuiPickOff(); } return; }
    if (window.__ihuiPickActive) return;
    window.__ihuiPickActive = true;
    var hl = document.createElement('div');
    var hlProps = {
      position: 'fixed', 'pointer-events': 'none', 'z-index': '2147483646',
      border: '2px solid #6366f1', background: 'rgba(99,102,241,0.12)',
      'border-radius': '2px', display: 'none', 'box-sizing': 'border-box'
    };
    for (var k in hlProps) hl.style.setProperty(k, hlProps[k]);
    document.documentElement.appendChild(hl);
    var prevCursor = document.documentElement.style.cursor;
    document.documentElement.style.setProperty('cursor', 'crosshair');
    function collect(t) {
      function sel(node) {
        if (!node || node.nodeType !== 1) return '';
        if (node.id) return '#' + node.id;
        var path = [];
        while (node && node.nodeType === 1 && path.length < 6) {
          var tag = node.tagName.toLowerCase(), idx = 1, sib = node;
          while ((sib = sib.previousElementSibling)) { if (sib.tagName === node.tagName) idx++; }
          path.unshift(tag + ':nth-of-type(' + idx + ')');
          node = node.parentElement;
        }
        return path.join(' > ');
      }
      var r = t.getBoundingClientRect();
      return {
        selector: sel(t), tag: t.tagName.toLowerCase(), id: t.id || '',
        cls: (t.className && typeof t.className === 'string') ? t.className : '',
        text: (t.textContent || '').trim().slice(0, 200),
        rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
        url: location.href, title: document.title
      };
    }
    function onMove(e) {
      var t = e.target;
      if (!t || t === hl) return;
      var r = t.getBoundingClientRect();
      hl.style.setProperty('display', 'block');
      hl.style.setProperty('left', r.left + 'px');
      hl.style.setProperty('top', r.top + 'px');
      hl.style.setProperty('width', r.width + 'px');
      hl.style.setProperty('height', r.height + 'px');
    }
    function onClick(e) {
      e.preventDefault(); e.stopPropagation();
      var info = collect(e.target);
      if (window.__ihuiNav) window.__ihuiNav('picked', 'd=' + encodeURIComponent(JSON.stringify(info)));
      off();
    }
    function off() {
      document.removeEventListener('mouseover', onMove, true);
      document.removeEventListener('click', onClick, true);
      if (hl.parentNode) hl.parentNode.removeChild(hl);
      document.documentElement.style.setProperty('cursor', prevCursor || '');
      window.__ihuiPickActive = false;
    }
    window.__ihuiPickOff = off;
    document.addEventListener('mouseover', onMove, true);
    document.addEventListener('click', onClick, true);
  };
})();"#;

// ==================== 哨兵动作解析(纯函数,单测覆盖) ====================

/// 工具条通过哨兵导航发来的动作。
#[derive(Debug, Clone, PartialEq)]
pub enum SentinelAction {
    NewTab(Option<String>),
    CloseTab(u64),
    Switch(u64),
    Navigate(String),
    Back,
    Forward,
    Reload,
    Stop,
    Home,
    Devtools,
    Pick(bool),
    Picked(String),
    CloseWindow,
}

/// 把哨兵 URL 解析成动作;非哨兵(host 不符)返回 `None`。
pub fn parse_sentinel(url: &Url) -> Option<SentinelAction> {
    if url.host_str() != Some(SENTINEL_HOST) {
        return None;
    }
    let action = url.path().trim_start_matches('/');
    let q = |key: &str| -> Option<String> {
        url.query_pairs()
            .find(|(k, _)| k == key)
            .map(|(_, v)| v.into_owned())
    };
    let num = |key: &str| -> u64 { q(key).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0) };
    Some(match action {
        "new-tab" => {
            let u = q("u").filter(|s| !s.is_empty() && s != "about:blank");
            SentinelAction::NewTab(u)
        }
        "close-tab" => SentinelAction::CloseTab(num("i")),
        "switch" => SentinelAction::Switch(num("i")),
        "navigate" => SentinelAction::Navigate(q("u").unwrap_or_default()),
        "back" => SentinelAction::Back,
        "forward" => SentinelAction::Forward,
        "reload" => SentinelAction::Reload,
        "stop" => SentinelAction::Stop,
        "home" => SentinelAction::Home,
        "devtools" => SentinelAction::Devtools,
        "pick" => SentinelAction::Pick(q("on").as_deref() == Some("1")),
        "picked" => SentinelAction::Picked(q("d").unwrap_or_default()),
        "close-window" => SentinelAction::CloseWindow,
        _ => return None,
    })
}

/// 地址是否允许在内嵌浏览器里打开(纯函数,单测覆盖)。
///
/// 只放行 http/https:前端不可借本命令把 `file:`/`tauri:` 之类的内部协议带进窗口,
/// 也不接受空白或畸形串。
pub fn is_browsable_url(url: &str) -> bool {
    let t = url.trim();
    t.starts_with("http://") || t.starts_with("https://")
}

// ==================== 会话状态 ====================

/// 一个标签页的元数据。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TabInfo {
    pub id: u64,
    pub url: String,
    pub title: String,
}

#[derive(Default, Clone)]
struct Session {
    next_id: u64,
    tabs: Vec<TabInfo>,
    active: Option<u64>,
    /// true = `Window::add_child`(unstable 多 webview)建窗失败,已降级为
    /// **单 webview 窗**(窗口 label 即 webview label,无多标签)。见 `open_or_navigate`。
    degraded: bool,
}

/// 浏览器会话状态(窗口在不在、标签列表、当前标签)。
#[derive(Default)]
pub struct BrowserManager {
    inner: Mutex<Session>,
}

impl BrowserManager {
    fn with<R>(&self, f: impl FnOnce(&mut Session) -> R) -> R {
        let mut g = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        f(&mut g)
    }

    /// 复位会话(窗口被系统关闭时清账,见 lib.rs `WindowEvent::Destroyed`)。
    pub fn reset(&self) {
        self.with(|s| *s = Session::default());
    }
}

/// 前端契约(与旧 `embedded_browser_state` 向后兼容:`open` / `url` 保留)。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserStateDto {
    pub open: bool,
    pub url: Option<String>,
    pub tabs: Vec<TabInfo>,
    pub active: Option<u64>,
    /// true = 走了单 webview 降级路径(多标签不可用)。
    pub degraded: bool,
}

fn tab_label(id: u64) -> String {
    format!("{TAB_LABEL_PREFIX}{id}")
}

/// 取当前活动标签页的 webview(供签到探针读 cookie / url 用)。
///
/// 2026-10-16 多标签升级后,窗口本身是不带 webview 的 [`tauri::Window`],真正的
/// 页面在 `browser-tab-<id>` 子 webview 里 —— 所以"读内嵌窗 cookie"必须落在
/// **活动标签页 webview** 上,而不是窗口上。
///
/// 降级模式(单 webview 窗)下,窗口 label 本身就是 webview label,直接取它。
pub fn active_webview(app: &AppHandle) -> Option<tauri::webview::Webview> {
    let (id, degraded) = app.state::<BrowserManager>().with(|s| (s.active, s.degraded));
    if degraded {
        return app.get_webview(BROWSER_WINDOW_LABEL);
    }
    let id = id?;
    app.get_webview(&tab_label(id))
}

/// 生成推给页面工具条的状态 JSON。
fn bar_state_json(s: &Session) -> serde_json::Value {
    let tabs: Vec<serde_json::Value> = s
        .tabs
        .iter()
        .map(|t| {
            serde_json::json!({
                "id": t.id,
                "title": t.title,
                "url": t.url,
                "active": Some(t.id) == s.active,
            })
        })
        .collect();
    let url = s
        .active
        .and_then(|id| s.tabs.iter().find(|t| t.id == id))
        .map(|t| t.url.clone())
        .unwrap_or_default();
    serde_json::json!({ "tabs": tabs, "url": url, "picking": false, "multiTab": !s.degraded })
}

/// 把状态渲染进某个 webview 的工具条。
fn push_bar_state(app: &AppHandle, webview_label: &str, s: &Session) {
    if let Some(wv) = app.get_webview(webview_label) {
        let js = format!(
            "if(window.__ihuiBarRender){{window.__ihuiBarRender({});}}",
            bar_state_json(s)
        );
        let _ = wv.eval(js);
    }
}

/// 把状态推给当前活动标签页(不持锁调用,避免在锁内做 eval)。
fn refresh_active_bar(app: &AppHandle) {
    let snapshot = app.state::<BrowserManager>().with(|s| s.clone());
    if snapshot.degraded {
        // 降级:窗口 label == webview label
        push_bar_state(app, BROWSER_WINDOW_LABEL, &snapshot);
        return;
    }
    if let Some(id) = snapshot.active {
        push_bar_state(app, &tab_label(id), &snapshot);
    }
}

/// 构建一个内容 webview builder(多标签与降级两条路共用)。
///
/// - `label` = 该 webview 的 label(多标签下是 `browser-tab-<id>`;降级下是窗口 label)
/// - `tab_id` = 用于 `on_page_load` 时定位会话里的标签行
fn build_tab_builder(
    app: &AppHandle,
    label: String,
    tab_id: u64,
    url: Url,
) -> WebviewBuilder<tauri::Wry> {
    let app_for_nav = app.clone();
    let app_for_load = app.clone();
    WebviewBuilder::new(label, WebviewUrl::External(url))
        .user_agent(CHROME_UA)
        .devtools(true)
        .background_color(Color(0x24, 0x24, 0x24, 0xff))
        .initialization_script(BAR_JS)
        .initialization_script(PICK_JS)
        .on_navigation(move |url| {
            if let Some(action) = parse_sentinel(url) {
                let a = app_for_nav.clone();
                tauri::async_runtime::spawn(async move {
                    handle_sentinel(a, action).await;
                });
                false // 取消真实导航
            } else {
                true
            }
        })
        .on_page_load(move |_wv, payload| {
            // 导航完成/开始时同步标签 URL 并刷新工具条(标题由注入脚本对活动标签
            // 直接用 document.title 呈现,见 BAR_JS),否则标签栏/地址栏停在建窗初值。
            let app = app_for_load.clone();
            let url = payload.url().to_string();
            tauri::async_runtime::spawn(async move {
                app.state::<BrowserManager>().with(|s| {
                    if let Some(tab) = s.tabs.iter_mut().find(|t| t.id == tab_id) {
                        tab.url = url.clone();
                        if tab.title.is_empty() {
                            tab.title = url.clone();
                        }
                    }
                });
                refresh_active_bar(&app);
            });
        })
}

/// 一个标签页的内容 webview,建好并按父窗口尺寸铺满。
fn spawn_tab_webview(
    window: &tauri::Window,
    builder: WebviewBuilder<tauri::Wry>,
    size: PhysicalSize<u32>,
) -> Result<(), IpcError> {
    window
        .add_child(
            builder,
            PhysicalPosition::new(0i32, 0i32),
            PhysicalSize::new(size.width, size.height),
        )
        .map(|_| ())
        .map_err(|e| IpcError::internal(format!("创建标签页失败: {e}")))
}

/// 降级:用 `WebviewWindowBuilder` 建「窗口自带 webview」的单窗(不依赖 unstable
/// `add_child`)。只在裸窗 `WindowBuilder::build` 于该环境不可用时走这条路 ——
/// 代价是多标签不可用,但浏览/工具条/点选/DevTools 照常。
fn spawn_degraded_window(
    app: &AppHandle,
    title: Option<String>,
    parsed: Url,
) -> Result<(), IpcError> {
    let id = app.state::<BrowserManager>().with(|s| {
        s.next_id += 1;
        s.next_id
    });
    let app_for_nav = app.clone();
    tauri::WebviewWindowBuilder::new(
        app,
        BROWSER_WINDOW_LABEL,
        WebviewUrl::External(parsed.clone()),
    )
    .title(title.unwrap_or_else(|| "智汇AI 浏览器".to_string()))
    .inner_size(1280.0, 860.0)
    .min_inner_size(900.0, 640.0)
    .resizable(true)
    .center()
    .decorations(true)
    .background_color(Color(0x24, 0x24, 0x24, 0xff))
    .user_agent(CHROME_UA)
    .initialization_script(BAR_JS)
    .initialization_script(PICK_JS)
    .on_navigation(move |url| {
        if let Some(action) = parse_sentinel(url) {
            let a = app_for_nav.clone();
            tauri::async_runtime::spawn(async move {
                handle_sentinel(a, action).await;
            });
            false
        } else {
            true
        }
    })
    .build()
    .map_err(|e| IpcError::internal(format!("内嵌浏览器窗口创建失败: {e}")))?;
    app.state::<BrowserManager>().with(|s| {
        s.tabs.push(TabInfo {
            id,
            url: parsed.to_string(),
            title: parsed.to_string(),
        });
        s.active = Some(id);
        s.degraded = true;
    });
    Ok(())
}

// ==================== 建窗 / 建标签 ====================

/// 为一个 URL 建内容 webview 并挂到窗口上。返回 webview label。
///
/// 注意:必须在**非主线程**调用(`add_child` 内部 `run_on_main_thread` 阻塞等待,
/// 主线程直接调会自锁,见模块头「建窗时序铁律」)。
fn add_tab_webview(
    window: &tauri::Window,
    app: &AppHandle,
    id: u64,
    url: &Url,
) -> Result<(), IpcError> {
    let size = window
        .inner_size()
        .map_err(|e| IpcError::internal(format!("取窗口尺寸失败: {e}")))?;
    // 内容 webview 随窗口缩放(auto_resize);降级路不需要(webview 即窗口)。
    let builder = build_tab_builder(app, tab_label(id), id, url.clone()).auto_resize();
    spawn_tab_webview(window, builder, size)
}

/// 打开(或复用)浏览器窗口。已存在则让当前标签导航到 `url`。
pub async fn open_or_navigate(
    app: AppHandle,
    url: String,
    title: Option<String>,
) -> Result<(), IpcError> {
    if !is_browsable_url(&url) {
        return Err(IpcError::permission(
            "内嵌浏览器只支持 http/https 地址".to_string(),
        ));
    }
    let parsed: Url = url
        .trim()
        .parse()
        .map_err(|e| IpcError::internal(format!("地址解析失败: {e}")))?;

    // 复用:窗口在 ⇒ 当前标签导航(降级窗也走 active_webview)
    if let Some(window) = app.get_window(BROWSER_WINDOW_LABEL) {
        if let Some(wv) = active_webview(&app) {
            let _ = wv.navigate(parsed.clone());
        }
        let active = app.state::<BrowserManager>().with(|s| s.active);
        app.state::<BrowserManager>().with(|s| {
            if let Some(t) = active.and_then(|id| s.tabs.iter_mut().find(|t| t.id == id)) {
                t.url = parsed.to_string();
            }
        });
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    // 新建:裸窗 + 第一个内容 webview(unstable 多 webview)。两条降级路:
    // ①裸窗建不起来;②裸窗建起来但 add_child 失败 —— 都退到「窗口自带 webview」的单窗。
    let bare = tauri::window::WindowBuilder::new(&app, BROWSER_WINDOW_LABEL)
        .title(title.clone().unwrap_or_else(|| "智汇AI 浏览器".to_string()))
        .inner_size(1280.0, 860.0)
        .min_inner_size(900.0, 640.0)
        .resizable(true)
        .center()
        // 原生装饰条保留:工具条是注入进第三方页面的,`data-tauri-drag-region`
        // 需要 IPC(Tauri 注入层)才能拖动,而第三方站点 CSP 不放行 IPC ⇒ 自绘
        // 标题栏拖不动窗口。保留系统标题栏换取可靠的移动/最小化/关闭。
        .decorations(true)
        .background_color(Color(0x24, 0x24, 0x24, 0xff))
        .build();
    let window = match bare {
        Ok(w) => w,
        Err(e) => {
            log::warn!("[embedded-browser] 裸窗创建失败,降级单 webview: {e}");
            return spawn_degraded_window(&app, title, parsed);
        }
    };

    let id = app.state::<BrowserManager>().with(|s| {
        s.next_id += 1;
        s.next_id
    });
    if let Err(e) = add_tab_webview(&window, &app, id, &parsed) {
        log::warn!("[embedded-browser] add_child 失败,降级单 webview: {e}");
        let _ = window.close();
        return spawn_degraded_window(&app, title, parsed);
    }
    app.state::<BrowserManager>().with(|s| {
        s.tabs.push(TabInfo {
            id,
            url: parsed.to_string(),
            title: parsed.to_string(),
        });
        s.active = Some(id);
        s.degraded = false;
    });
    Ok(())
}

// ==================== 哨兵动作处理 ====================

/// 处理工具条动作。跑在工作线程上(可安全调用 `add_child`/`hide`/`show`)。
async fn handle_sentinel(app: AppHandle, action: SentinelAction) {
    let Some(window) = app.get_window(BROWSER_WINDOW_LABEL) else {
        return;
    };
    let active_wv = || -> Option<tauri::webview::Webview> {
        let (id, degraded) = app.state::<BrowserManager>().with(|s| (s.active, s.degraded));
        if degraded {
            // 降级:窗口 label == webview label
            return app.get_webview(BROWSER_WINDOW_LABEL);
        }
        let id = id?;
        app.get_webview(&tab_label(id))
    };

    match action {
        SentinelAction::Navigate(u) => {
            if is_browsable_url(&u) {
                if let Some(wv) = active_wv() {
                    if let Ok(parsed) = u.parse::<Url>() {
                        let _ = wv.navigate(parsed.clone());
                        let active = app.state::<BrowserManager>().with(|s| s.active);
                        app.state::<BrowserManager>().with(|s| {
                            if let Some(t) = active.and_then(|id| s.tabs.iter_mut().find(|t| t.id == id)) {
                                t.url = parsed.to_string();
                            }
                        });
                    }
                }
            }
        }
        SentinelAction::Back => {
            if let Some(wv) = active_wv() {
                let _ = wv.eval("history.back();");
            }
        }
        SentinelAction::Forward => {
            if let Some(wv) = active_wv() {
                let _ = wv.eval("history.forward();");
            }
        }
        SentinelAction::Reload => {
            if let Some(wv) = active_wv() {
                let _ = wv.reload();
            }
        }
        SentinelAction::Stop => {
            if let Some(wv) = active_wv() {
                let _ = wv.eval("window.stop();");
            }
        }
        SentinelAction::Home => {
            if let Some(wv) = active_wv() {
                if let Ok(parsed) = HOME_URL.parse::<Url>() {
                    let _ = wv.navigate(parsed);
                }
            }
        }
        SentinelAction::Devtools => {
            if let Some(wv) = active_wv() {
                wv.open_devtools();
            }
        }
        SentinelAction::Pick(on) => {
            if let Some(wv) = active_wv() {
                let js = format!("if(window.__ihuiPick){{window.__ihuiPick({});}}", on);
                let _ = wv.eval(js);
            }
        }
        SentinelAction::Picked(payload) => {
            // 点选结果:转发给宿主应用(main 窗口,有 IPC)
            let decoded = percent_decode(&payload);
            let _ = app.emit_to("main", "embedded-browser://element-picked", decoded);
        }
        SentinelAction::NewTab(u) => {
            // 降级模式(单 webview 窗)无多标签可言:把"新建标签"退化为"当前页导航"。
            let degraded = app.state::<BrowserManager>().with(|s| s.degraded);
            if degraded {
                let target = match u {
                    Some(u) if is_browsable_url(&u) => u,
                    _ => HOME_URL.to_string(),
                };
                if let Some(wv) = active_wv() {
                    if let Ok(parsed) = target.parse::<Url>() {
                        let _ = wv.navigate(parsed);
                    }
                }
                return;
            }
            let count = app.state::<BrowserManager>().with(|s| s.tabs.len());
            if count >= MAX_TABS {
                return;
            }
            let target = match u {
                Some(u) if is_browsable_url(&u) => u,
                _ => HOME_URL.to_string(),
            };
            let Ok(parsed) = target.parse::<Url>() else { return };
            let id = app.state::<BrowserManager>().with(|s| {
                s.next_id += 1;
                s.next_id
            });
            if add_tab_webview(&window, &app, id, &parsed).is_err() {
                return;
            }
            // 隐藏当前,激活新标签
            let prev = app.state::<BrowserManager>().with(|s| {
                s.tabs.push(TabInfo {
                    id,
                    url: parsed.to_string(),
                    title: parsed.to_string(),
                });
                let prev = s.active;
                s.active = Some(id);
                prev
            });
            if let Some(prev_id) = prev {
                if let Some(wv) = app.get_webview(&tab_label(prev_id)) {
                    let _ = wv.hide();
                }
            }
            refresh_active_bar(&app);
        }
        SentinelAction::CloseTab(i) => {
            // 降级模式:没有真标签可关,当"关窗"处理。
            let degraded = app.state::<BrowserManager>().with(|s| s.degraded);
            if degraded {
                let _ = window.close();
                app.state::<BrowserManager>().with(|s| {
                    *s = Session::default();
                });
                return;
            }
            let (remaining, new_active) = app.state::<BrowserManager>().with(|s| {
                s.tabs.retain(|t| t.id != i);
                if s.active == Some(i) {
                    s.active = s.tabs.last().map(|t| t.id);
                }
                (s.tabs.len(), s.active)
            });
            if let Some(wv) = app.get_webview(&tab_label(i)) {
                let _ = wv.close();
            }
            if remaining == 0 {
                let _ = window.close();
                app.state::<BrowserManager>().with(|s| {
                    *s = Session::default();
                });
                return;
            }
            if let Some(id) = new_active {
                if let Some(wv) = app.get_webview(&tab_label(id)) {
                    let _ = wv.show();
                    let _ = wv.set_focus();
                }
                refresh_active_bar(&app);
            }
        }
        SentinelAction::Switch(i) => {
            // 降级模式:只有一个 webview,切换无意义(工具条也已不显示标签栏)。
            let degraded = app.state::<BrowserManager>().with(|s| s.degraded);
            if degraded {
                return;
            }
            let prev = app.state::<BrowserManager>().with(|s| {
                if !s.tabs.iter().any(|t| t.id == i) {
                    return None;
                }
                let prev = s.active;
                s.active = Some(i);
                Some(prev)
            });
            let Some(prev) = prev else { return };
            if let Some(pid) = prev {
                if pid != i {
                    if let Some(wv) = app.get_webview(&tab_label(pid)) {
                        let _ = wv.hide();
                    }
                }
            }
            if let Some(wv) = app.get_webview(&tab_label(i)) {
                let _ = wv.show();
                let _ = wv.set_focus();
            }
            refresh_active_bar(&app);
        }
        SentinelAction::CloseWindow => {
            let _ = window.close();
            app.state::<BrowserManager>().with(|s| {
                *s = Session::default();
            });
        }
    }
}

/// 最小 percent-decode(`%XX` + `+`),用于解点选负载。
fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                let h = (bytes[i + 1] as char).to_digit(16);
                let l = (bytes[i + 2] as char).to_digit(16);
                if let (Some(h), Some(l)) = (h, l) {
                    out.push((h * 16 + l) as u8);
                    i += 3;
                } else {
                    out.push(bytes[i]);
                    i += 1;
                }
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

// ==================== Tauri 命令 ====================

/// 打开(或复用)内嵌浏览器窗口。
#[tauri::command]
pub async fn embedded_browser_open(
    app: AppHandle,
    url: String,
    title: Option<String>,
) -> Result<(), IpcError> {
    open_or_navigate(app, url, title).await
}

/// 关闭(并销毁)内嵌浏览器窗口及其全部标签页。
#[tauri::command]
pub async fn embedded_browser_close(app: AppHandle) -> Result<(), IpcError> {
    if let Some(window) = app.get_window(BROWSER_WINDOW_LABEL) {
        window
            .close()
            .map_err(|e| IpcError::internal(format!("关闭内嵌浏览器窗口失败: {e}")))?;
    }
    app.state::<BrowserManager>().with(|s| {
        *s = Session::default();
    });
    Ok(())
}

/// 查询内嵌浏览器窗口状态(窗口在不在、当前地址、标签列表)。
#[tauri::command]
pub fn embedded_browser_state(app: AppHandle) -> BrowserStateDto {
    if app.get_window(BROWSER_WINDOW_LABEL).is_none() {
        return BrowserStateDto {
            open: false,
            url: None,
            tabs: vec![],
            active: None,
            degraded: false,
        };
    }
    app.state::<BrowserManager>().with(|s| {
        let url = s
            .active
            .and_then(|id| s.tabs.iter().find(|t| t.id == id))
            .map(|t| t.url.clone());
        BrowserStateDto {
            open: true,
            url,
            tabs: s.tabs.clone(),
            active: s.active,
            degraded: s.degraded,
        }
    })
}

/// 新建标签页(可指定 URL;不合法则去主页)。
#[tauri::command]
pub async fn embedded_browser_new_tab(app: AppHandle, url: Option<String>) -> Result<(), IpcError> {
    if app.get_window(BROWSER_WINDOW_LABEL).is_none() {
        return open_or_navigate(app, url.unwrap_or_else(|| HOME_URL.to_string()), None).await;
    }
    let action = SentinelAction::NewTab(url.filter(|u| is_browsable_url(u)));
    handle_sentinel(app, action).await;
    Ok(())
}

/// 打开当前标签页的开发者工具。
#[tauri::command]
pub async fn embedded_browser_devtools(app: AppHandle) -> Result<(), IpcError> {
    handle_sentinel(app, SentinelAction::Devtools).await;
    Ok(())
}

// ==================== 单测(纯判据区) ====================

#[cfg(test)]
mod tests {
    use super::*;

    fn u(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn browsable_url_allowlist() {
        assert!(is_browsable_url("https://www.workbuddy.cn/login/"));
        assert!(is_browsable_url("http://example.com"));
        assert!(is_browsable_url("  https://a.b  "));
    }

    #[test]
    fn browsable_url_denies_internal_schemes() {
        for bad in [
            "file:///C:/secret.txt",
            "tauri://localhost",
            "javascript:alert(1)",
            "data:text/html,<h1>x</h1>",
            "",
            "   ",
            "ftp://a.b",
            "www.workbuddy.cn",
        ] {
            assert!(!is_browsable_url(bad), "不该放行: {bad}");
        }
    }

    #[test]
    fn sentinel_parses_actions() {
        assert_eq!(
            parse_sentinel(&u("https://browser.ihui.invalid/back")),
            Some(SentinelAction::Back)
        );
        assert_eq!(
            parse_sentinel(&u("https://browser.ihui.invalid/forward")),
            Some(SentinelAction::Forward)
        );
        assert_eq!(
            parse_sentinel(&u("https://browser.ihui.invalid/switch?i=7")),
            Some(SentinelAction::Switch(7))
        );
        assert_eq!(
            parse_sentinel(&u("https://browser.ihui.invalid/close-tab?i=3")),
            Some(SentinelAction::CloseTab(3))
        );
        assert_eq!(
            parse_sentinel(&u("https://browser.ihui.invalid/pick?on=1")),
            Some(SentinelAction::Pick(true))
        );
        assert_eq!(
            parse_sentinel(&u("https://browser.ihui.invalid/pick?on=0")),
            Some(SentinelAction::Pick(false))
        );
        assert_eq!(
            parse_sentinel(&u("https://browser.ihui.invalid/navigate?u=https%3A%2F%2Fa.b%2F")),
            Some(SentinelAction::Navigate("https://a.b/".to_string()))
        );
        // new-tab 无 url / about:blank ⇒ None
        assert_eq!(
            parse_sentinel(&u("https://browser.ihui.invalid/new-tab")),
            Some(SentinelAction::NewTab(None))
        );
        assert_eq!(
            parse_sentinel(&u("https://browser.ihui.invalid/new-tab?u=about%3Ablank")),
            Some(SentinelAction::NewTab(None))
        );
        assert_eq!(
            parse_sentinel(&u("https://browser.ihui.invalid/new-tab?u=https%3A%2F%2Fx.y")),
            Some(SentinelAction::NewTab(Some("https://x.y".to_string())))
        );
        assert_eq!(
            parse_sentinel(&u("https://browser.ihui.invalid/close-window")),
            Some(SentinelAction::CloseWindow)
        );
    }

    #[test]
    fn sentinel_ignores_other_hosts_and_unknown() {
        assert_eq!(parse_sentinel(&u("https://aizhs.top/back")), None);
        assert_eq!(parse_sentinel(&u("https://browser.ihui.invalid/nope")), None);
        assert_eq!(parse_sentinel(&u("https://example.com/")), None);
    }

    #[test]
    fn percent_decode_handles_utf8() {
        // "元素" 的 UTF-8 percent 编码
        assert_eq!(percent_decode("%E5%85%83%E7%B4%A0"), "元素");
        assert_eq!(percent_decode("a+b"), "a b");
        assert_eq!(percent_decode("plain"), "plain");
        assert_eq!(percent_decode("%ZZ"), "%ZZ");
    }

    #[test]
    fn bar_js_is_cssom_only_and_zero_ipc() {
        // 零 IPC:不得出现任何 Tauri invoke 面(第三方站点 CSP 不放行 ipc.localhost)
        for forbidden in ["__TAURI", "invoke(", "ipc.localhost", "__TAURI_INTERNALS__"] {
            assert!(!BAR_JS.contains(forbidden), "注入脚本不该依赖 IPC: {forbidden}");
            assert!(!PICK_JS.contains(forbidden), "点选脚本不该依赖 IPC: {forbidden}");
        }
        // 只用 CSSOM:不得出现 <style> 元素或 style="..." 属性写法
        assert!(!BAR_JS.contains("createElement('style')"));
        assert!(!BAR_JS.contains("style=\""));
        assert!(BAR_JS.contains("setProperty"));
        // 关键控件与动作在册(动作全部经 __ihuiNav 哨兵导航发出;真正的
        // history.back/forward、window.stop 在 Rust 侧对活动 webview eval,不在本脚本)
        for needle in [
            "__ihui_browser_bar",
            "__ihuiBarRender",
            "__ihuiNav",
            "data-tauri-drag-region",
            "'back'",
            "'forward'",
            "'reload'",
            "'stop'",
            "'home'",
            "'navigate'",
            "'close-tab'",
            "'switch'",
            "'new-tab'",
            "'devtools'",
            "'pick'",
            "'close-window'",
        ] {
            assert!(BAR_JS.contains(needle), "工具条脚本缺: {needle}");
        }
        assert!(PICK_JS.contains("__ihuiPick"));
        assert!(PICK_JS.contains("picked"));
        assert!(PICK_JS.contains("crosshair"));
    }

    #[test]
    fn bar_state_json_reflects_degraded_flag() {
        // 正常多标签:multiTab = true
        let s = Session::default();
        assert_eq!(bar_state_json(&s)["multiTab"], serde_json::json!(true));
        // 降级单 webview:multiTab = false(工具条据此隐藏标签栏)
        let mut d = Session::default();
        d.degraded = true;
        assert_eq!(bar_state_json(&d)["multiTab"], serde_json::json!(false));
        // 工具条脚本里确实有这条分支
        assert!(BAR_JS.contains("multiTab"));
        assert!(BAR_JS.contains("'display', multi ? 'flex' : 'none'"));
    }

    #[test]
    fn chrome_ua_has_no_edge_marker() {
        assert!(CHROME_UA.contains("Chrome/"));
        assert!(!CHROME_UA.contains("Edg/"));
        assert!(CHROME_UA.contains("AppleWebKit/537.36"));
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
