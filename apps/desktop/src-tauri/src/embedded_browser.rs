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

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::webview::Color;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Url, WebviewBuilder, WebviewUrl,
};

use crate::checkin_web_login::{WebLoginProbe, WB_WEB_LOGIN_URL, checkin_workbuddy_web_login_probe};
use crate::IpcError;

/// 浏览器窗口 label(全仓唯一)。
pub const BROWSER_WINDOW_LABEL: &str = "embedded-browser";

/// 主页(点「主页」按钮去这里)。
pub const HOME_URL: &str = "https://aizhs.top/";

/// 内容 webview label 前缀;完整 label = `browser-tab-<id>`。
pub(crate) const TAB_LABEL_PREFIX: &str = "browser-tab-";

/// 哨兵导航 host(RFC 2606 保留 `.invalid`,永不解析;仅作页面→宿主的信号)。
const SENTINEL_HOST: &str = "browser.ihui.invalid";

/// 工具条总高(标签栏 34 + 工具栏 38);注入脚本内 `${BAR_H}` 语义同值。
/// 保留为设计常量:工具条高度由注入脚本的 TAB_H+TOOL_H 决定,此处仅作文档锚点。
#[allow(dead_code)]
const BAR_HEIGHT: u32 = 72;

/// 独立窗口同时存在的标签数上限。取自设置项 `browser-settings.json` 的 `max_tabs`
/// (默认 12,允许 4..=16);每次判定现读,改完立即生效。防御性上限,避免无限建 webview。
fn max_tabs() -> usize {
    crate::browser_settings::current().max_tabs as usize
}

/// `wb-checkin-login` 看护轮询的防重入闸(2026-10-17):进行中再触发直接忽略,
/// 用户在签到页狂点按钮不叠加看护任务。所有退出路径(ok/超时/关窗)都复位。
static WB_LOGIN_POLLING: AtomicBool = AtomicBool::new(false);

/// Chrome UA。WebView2 默认 UA 带 `Edg/` 标识,登录类站点可能据 UA 走不同分支
/// (也会把"内嵌"这件事暴露给站点);显式伪装成 Chrome,与内核事实自洽。
pub const CHROME_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/// 取主窗配置里的 `additional_browser_args`(WebView2 Environment 必须**逐字一致**)。
///
/// ⚠️ **必须全 App 一致**:WebView2 同一 user-data-folder 下只有一套共享 Environment,
/// 各 webview 的 options 一旦不一致就 `0x8007139F` 拒建(2026-10-13 白屏事故根因)。
/// 而 Environment 由**第一个**建起来的 webview(主窗)定义,所以子 webview
/// (停靠档 / 独立窗)只能**照抄主窗实际值**:主窗没配就什么都不传(传空串也算不一致)。
/// 2026-10-24 实测:独立窗此前写死一份自己压内存的参数,`add_child` 失败后整个浏览器
/// 被降级成单 webview 窗(多标签、工具条全丢),根因就是比主窗多了一段参数。
///
/// 想调 WebView2 启动参数(压内存等)只有一个入口:改主窗的
/// `tauri.conf.json → app.windows[main].additionalBrowserArgs`,不要在各处另写常量 ——
/// 那份参数只要显式传就会**整体覆盖** wry 默认值,因此必须原样保留 wry 默认的
/// `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`。
/// 反面清单(实测/官方明说会变差,禁止加):`--disable-background-timer-throttling`
/// (增加后台 CPU 与内存)、`--disable-gpu`(丢 GPU 合成)、
/// `--enable-features=msWebView2MemoryUsageTargetLevel:low`(该开关不存在,
/// 官方机制是 API `SetMemoryUsageTargetLevel`,见 [`set_memory_low`])。
///
/// 现行值(2026-10-25 A/B 实测,6 标签 / 20s 稳定态):
/// - 不带 `--process-per-site`:渲染进程 8 个,合计私用 1153MB
/// - 带 `--process-per-site`:渲染进程 5 个,合计 838MB(**-27%**)
/// 代价是同站点的多个标签共用一个渲染进程(一个卡死会连带同站其它标签),
/// 对本 App(最多 6~12 个标签、绝大多不同站)是划算的取舍。
pub(crate) fn main_window_browser_args(app: &AppHandle) -> Option<String> {
    app.config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .and_then(|w| w.additional_browser_args.clone())
}

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
  // 收藏 / 历史(2026-10-24 用户要求「两种形态都该有」):独立窗口是裸 webview,
  // 拿不到 web 端 store,数据来自宿主进程的 browser_store,由 __ihuiBarRender 推送。
  var favBtn = btn('\u2606', '收藏', 'favorite-toggle');
  favBtn.id = '__ihui_fav_btn';
  toolbar.appendChild(favBtn);
  // 「收藏夹 / 历史」是**本地下拉面板**,不走哨兵导航(不能用 btn:那个必然导航)。
  function plainBtn(label, title, id) {
    var b = el('button', {
      width: '28px', height: '28px', 'line-height': '26px', flex: '0 0 auto',
      background: 'transparent', color: '#cfcfcf', padding: '0',
      border: '1px solid #333333', 'border-radius': '6px',
      cursor: 'pointer', 'font-size': '14px'
    }, label);
    b.type = 'button';
    b.title = title;
    b.id = id;
    b.addEventListener('mouseenter', function () { b.style.setProperty('background', '#2f2f2f'); });
    b.addEventListener('mouseleave', function () { b.style.setProperty('background', 'transparent'); });
    return b;
  }
  var favListBtn = plainBtn('\u2630', '收藏夹', '__ihui_fav_list_btn');
  toolbar.appendChild(favListBtn);
  var histBtn = plainBtn('\u231a', '历史', '__ihui_hist_btn');
  toolbar.appendChild(histBtn);
  toolbar.appendChild(btn('\u2699', '开发者工具', 'devtools'));
  var pickBtn = btn('\u25ce', '元素点选', 'pick', 'on=1');
  toolbar.appendChild(pickBtn);
  toolbar.appendChild(btn('\u2715', '关闭窗口', 'close-window'));

  // 下拉面板(收藏夹 / 历史共用;绝对定位在工具条下方)。注意本脚本在
  // document-start 执行,document.body 可能还没有 —— 挂载统一放到 mount()。
  var panel = el('div', {
    position: 'fixed', top: TOTAL + 'px', right: '8px', width: '320px',
    'max-height': '60vh', overflow: 'auto', background: '#1b1b1b',
    border: '1px solid #333333', 'border-radius': '8px', 'box-shadow': '0 8px 24px rgba(0,0,0,0.5)',
    display: 'none', 'z-index': '2147483647', padding: '6px', 'box-sizing': 'border-box'
  });
  panel.id = '__ihui_bar_panel';
  function hidePanel() { panel.style.setProperty('display', 'none'); }
  function renderList(kind) {
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    var items = (kind === 'favorites') ? (lastState.favorites || []) : (lastState.history || []);
    var head = el('div', {
      display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
      padding: '2px 6px 6px', color: '#9a9a9a', 'font-size': '12px'
    });
    head.appendChild(el('span', {}, kind === 'favorites' ? '收藏夹' : '历史记录'));
    if (kind !== 'favorites') {
      var clear = el('span', { cursor: 'pointer', color: '#7aa2f7', 'font-size': '12px' }, '清空');
      clear.addEventListener('click', function () { window.__ihuiNav('history-clear'); });
      head.appendChild(clear);
    }
    panel.appendChild(head);
    if (!items.length) {
      panel.appendChild(el('div', { padding: '10px 6px', color: '#777777', 'font-size': '12px' }, '暂无记录'));
    }
    items.forEach(function (it) {
      var row = el('div', {
        display: 'flex', 'align-items': 'center', gap: '6px', padding: '6px',
        'border-radius': '6px', cursor: 'pointer', 'font-size': '12px', color: '#dcdcdc'
      });
      row.addEventListener('mouseenter', function () { row.style.setProperty('background', '#2a2a2a'); });
      row.addEventListener('mouseleave', function () { row.style.setProperty('background', 'transparent'); });
      var label = el('span', { flex: '1 1 auto', overflow: 'hidden', 'white-space': 'nowrap', 'text-overflow': 'ellipsis' }, it.title || it.url);
      row.appendChild(label);
      if (kind === 'favorites') {
        var del = el('span', { 'flex': '0 0 auto', color: '#888888', cursor: 'pointer' }, '\u2715');
        del.addEventListener('click', function (e) {
          e.stopPropagation();
          window.__ihuiNav('favorite-remove', 'u=' + encodeURIComponent(it.url));
        });
        row.appendChild(del);
      }
      row.addEventListener('click', function () {
        hidePanel();
        window.__ihuiNav('navigate', 'u=' + encodeURIComponent(it.url));
      });
      panel.appendChild(row);
    });
    panel.style.setProperty('display', 'block');
  }
  favListBtn.addEventListener('click', function () {
    if (panel.style.getPropertyValue('display') === 'block' && panel.dataset.kind === 'favorites') { hidePanel(); return; }
    panel.dataset.kind = 'favorites';
    renderList('favorites');
  });
  histBtn.addEventListener('click', function () {
    if (panel.style.getPropertyValue('display') === 'block' && panel.dataset.kind === 'history') { hidePanel(); return; }
    panel.dataset.kind = 'history';
    renderList('history');
  });

  var newTabBtn = btn('+', '新建标签页', 'new-tab', 'u=' + encodeURIComponent('about:blank'));
  bar.appendChild(tabStrip);
  bar.appendChild(toolbar);

  function mount() {
    if (document.body && !document.getElementById('__ihui_browser_bar')) {
      document.body.appendChild(bar);
      if (!document.getElementById('__ihui_bar_panel')) document.body.appendChild(panel);
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

  var lastState = { tabs: [], picking: false, favorites: [], history: [] };
  window.__ihuiBarRender = function (s) {
    lastState = s || lastState;
    // 收藏按钮:当前页已收藏 ⇒ 实心星
    favBtn.textContent = s.favorited ? '\u2605' : '\u2606';
    favBtn.title = s.favorited ? '取消收藏' : '收藏';
    // 面板还开着就当数据旧了,重绘一次(收藏/历史刚被操作过)
    if (panel.style.getPropertyValue('display') === 'block' && panel.dataset.kind) {
      renderList(panel.dataset.kind);
    }
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
///
/// `pub(crate)`(2026-10-24):右侧工作区停靠浏览器复用同一份脚本,保证两档
/// 点选行为/回传格式完全一致。
pub(crate) const PICK_JS: &str = r#"(function () {
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

/// 页内音频探针(2026-10-25)。
///
/// `IsDocumentPlayingAudio` 只认 `<audio>/<video>` 媒体元素:纯 WebAudio 的应用
/// (在线白噪音、网页音乐播放器、游戏)在原生侧完全探测不到 ⇒ 切走后一冻结就没声。
/// 本脚本补上这一段。
///
/// 做法:钩 `AudioScheduledSourceNode.prototype.start/stop`(OscillatorNode /
/// AudioBufferSourceNode / ConstantSourceNode 的共同基类,覆盖绝大多数实际发声),
/// 用 `ended` 事件维护"正在出声的源"计数;状态变化经哨兵导航回传(`audio?on=1|0`),
/// 由 Rust 按标签记账(不再做 COM 探测,零阻塞)。
///
/// 三条守则:
/// - 只在 `document.readyState === 'complete'` 后回传 —— 否则这次哨兵导航会打断
///   正在加载的文档;
/// - 状态没变不回传,且 800ms 去抖 —— 游戏每秒几十个音效不能变成哨兵洪水;
/// - 全程 try/catch,且**先调用原方法再记账**:探针出问题绝不能拖垮页面自己的音频。
///
/// 盲区(已记录):AudioWorklet 自行合成的音频、WebAudio 之外的插件音频不计入。
pub(crate) const AUDIO_PROBE_JS: &str = r##"(function () {
  if (window.__ihuiAudioProbe) return;
  window.__ihuiAudioProbe = true;
  var SENTINEL = 'https://browser.ihui.invalid/audio?on=';
  var ctxs = [];
  var playing = 0;
  var last = null;
  var timer = 0;

  function addCtx(ctx) {
    if (!ctx) return;
    for (var i = 0; i < ctxs.length; i++) if (ctxs[i] === ctx) return;
    // 页面可能高频新建上下文:只留最近的 32 个,避免探针自己漏内存
    if (ctxs.length >= 32) ctxs.shift();
    ctxs.push(ctx);
  }

  function sounding() {
    if (playing <= 0) return false;
    for (var i = 0; i < ctxs.length; i++) {
      try { if (ctxs[i].state === 'running') return true; } catch (e) {}
    }
    return false;
  }

  function send() {
    try {
      if (document.readyState !== 'complete') { schedule(); return; }
      var now = sounding() ? '1' : '0';
      if (now === last) return;
      last = now;
      location.href = SENTINEL + now;
    } catch (e) {}
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(function () { timer = 0; send(); }, 800);
  }

  function release(node) {
    try {
      if (!node.__ihuiCounted) return;
      node.__ihuiCounted = false;
      playing = Math.max(0, playing - 1);
      schedule();
    } catch (e) {}
  }

  try {
    var P = window.AudioScheduledSourceNode && window.AudioScheduledSourceNode.prototype;
    if (P && P.start) {
      var start = P.start;
      var stop = P.stop;
      P.start = function () {
        var r = start.apply(this, arguments);
        try {
          var self = this;
          if (!self.__ihuiCounted) {
            self.__ihuiCounted = true;
            addCtx(self.context);
            playing += 1;
            self.addEventListener('ended', function () { release(self); }, { once: true });
            schedule();
          }
        } catch (e) {}
        return r;
      };
      if (stop) {
        P.stop = function () {
          var r = stop.apply(this, arguments);
          try { release(this); } catch (e) {}
          return r;
        };
      }
    }
  } catch (e) {}

  // 页面从后台恢复定时器后补报一次(用户手动点播放之类)
  try { document.addEventListener('visibilitychange', schedule); } catch (e) {}
})();"##;

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
    /// 收藏/取消收藏当前页(2026-10-24:独立窗口与停靠档功能对齐)。
    FavoriteToggle,
    /// 删除一条收藏(u=url)。
    FavoriteRemove(String),
    /// 清空历史。
    ClearHistory,
    /// 页面标题回传(停靠档的标签栏是 React 的,拿不到 DOM,只能由页内脚本带回)。
    Title(String),
    /// 页内音频探针回传:`true` = 该标签正在出声(WebAudio 也算)。
    Audio(bool),
    CloseWindow,
    /// 签到页(内嵌 tab 里的 aizhs.top/checkin)请求「浏览器登录 WorkBuddy」:
    /// 内容页无 IPC,只能借哨兵导航把意图带出来(2026-10-17 立)。
    WbCheckinLogin,
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
        "favorite-toggle" => SentinelAction::FavoriteToggle,
        "favorite-remove" => SentinelAction::FavoriteRemove(q("u").unwrap_or_default()),
        "history-clear" => SentinelAction::ClearHistory,
        "picked" => SentinelAction::Picked(q("d").unwrap_or_default()),
        "title" => SentinelAction::Title(q("t").unwrap_or_default()),
        "audio" => SentinelAction::Audio(q("on").as_deref() == Some("1")),
        "close-window" => SentinelAction::CloseWindow,
        "wb-checkin-login" => SentinelAction::WbCheckinLogin,
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
///
/// `label` / `discarded` / `hide_token` 是宿主内部账本,不进前端契约(serde skip):
/// 前端只要 id/url/title,这三个字段只服务「空闲休眠后按 url 重建」。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TabInfo {
    pub id: u64,
    pub url: String,
    pub title: String,
    /// 当前 webview 的 label。**带世代号**:休眠丢弃后重建会换新 label,
    /// Tauri 不允许同一个 label 二次注册(与停靠档同款做法)。
    #[serde(skip)]
    label: String,
    /// 已空闲休眠:webview 已销毁、页面状态不保留;切回按 `url` 重载。
    #[serde(skip)]
    discarded: bool,
    /// 每次切走 +1。后台维护任务拿自己那一轮的 token,过期即退出 ——
    /// 否则「切走→切回→再切走」会让两轮任务同时盯同一个标签。
    #[serde(skip)]
    hide_token: u64,
    /// 页内探针报上来的出声状态(WebAudio 等原生 API 探不到的音频)。
    #[serde(skip)]
    audio: bool,
}

#[derive(Default, Clone)]
struct Session {
    next_id: u64,
    /// webview label 的世代号(**不是**标签 id):休眠重建必须换 label。
    next_label: u64,
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

fn alloc_label(s: &mut Session) -> String {
    s.next_label = s.next_label.saturating_add(1);
    format!("{TAB_LABEL_PREFIX}{}", s.next_label)
}

/// 标签 id → 当前 webview label(休眠重建会换 label,不能从 id 反推)。
fn label_of(app: &AppHandle, id: u64) -> Option<String> {
    app.state::<BrowserManager>()
        .with(|s| s.tabs.iter().find(|t| t.id == id).map(|t| t.label.clone()))
}

/// 某个 label 是不是独立窗口**当前活动**标签(焦点挂起循环用)。
pub(crate) fn is_active_tab_label(app: &AppHandle, label: &str) -> bool {
    app.state::<BrowserManager>().with(|s| {
        s.active
            .and_then(|id| s.tabs.iter().find(|t| t.id == id))
            .map(|t| t.label == label)
            .unwrap_or(false)
    })
}

/// 取当前活动标签页的 webview(供签到探针读 cookie / url 用)。
/// 降级模式(单 webview 窗)下,窗口 label 本身就是 webview label,直接取它。
pub fn active_webview(app: &AppHandle) -> Option<tauri::webview::Webview> {
    let (label, degraded) = app.state::<BrowserManager>().with(|s| {
        if s.degraded {
            return (Some(BROWSER_WINDOW_LABEL.to_string()), true);
        }
        let label = s
            .active
            .and_then(|id| s.tabs.iter().find(|t| t.id == id))
            .map(|t| t.label.clone());
        (label, false)
    });
    if degraded {
        return app.get_webview(BROWSER_WINDOW_LABEL);
    }
    app.get_webview(&label?)
}

/// 隐藏标签「安静」满这么久就休眠丢弃(销毁 webview,切回按 url 重载)。
///
/// 停靠档与独立窗口**共用**同一阈值,三层优先级(高 → 低):
/// ①环境变量 `IHUI_TAB_IDLE_DISCARD_SECS`(验收脚本用,最小 5s;`0` = 关闭);
/// ②设置项 `browser-settings.json` 的 `idle_discard_secs`(`0` = 关闭空闲休眠);
/// ③默认 15 分钟 —— 比 Chrome 的 Memory Saver 保守,但足够把"开一堆标签忘了关"
/// 的内存还回去。
///
/// `None` = 用户关了空闲休眠:调用方只冻结不销毁。每次判定都现读设置,
/// 改完下一轮维护即生效(不必重启)。
pub(crate) fn idle_discard_threshold() -> Option<Duration> {
    if let Some(secs) = std::env::var("IHUI_TAB_IDLE_DISCARD_SECS")
        .ok()
        .and_then(|v| v.trim().parse::<u64>().ok())
    {
        return if secs == 0 { None } else { Some(Duration::from_secs(secs.max(5))) };
    }
    let secs = crate::browser_settings::current().idle_discard_secs;
    if secs == 0 { None } else { Some(Duration::from_secs(u64::from(secs))) }
}

/// 把某个 webview 的内存目标档位切到 Low / Normal(Windows / WebView2)。
///
/// 官方机制(不是命令行开关):`CoreWebView2.MemoryUsageTargetLevel`,
/// 需要 Runtime ≥ 114.0.1823.32;更旧的运行时调用是 no-op(不报错)。
/// wry 有 `WebViewExtWindows::set_memory_usage_level` 但 Tauri 没转出来,
/// 而 `PlatformWebview::controller()` 直接给 `ICoreWebView2Controller`,
/// 所以这里自己调 COM。用法:**窗口失焦 ⇒ Low,回到前台 ⇒ Normal**。
pub fn set_memory_low(webview: &tauri::webview::Webview, low: bool) {
    #[cfg(windows)]
    {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
            COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
        };
        use windows_core::Interface;
        let _ = webview.with_webview(move |pw| {
            // COM 链:controller → CoreWebView2 → cast 到版本化接口 _19
            // (SetMemoryUsageTargetLevel 只在 ICoreWebView2_19 上;Runtime < 114 时
            //  cast 失败 ⇒ 直接跳过,不强求)。
            let controller = pw.controller();
            let core = match unsafe { controller.CoreWebView2() } {
                Ok(c) => c,
                Err(_) => return,
            };
            let v19: ICoreWebView2_19 = match core.cast() {
                Ok(v) => v,
                Err(_) => return,
            };
            let level = if low {
                COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
            } else {
                COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
            };
            unsafe {
                let _ = v19.SetMemoryUsageTargetLevel(level);
            }
        });
    }
    #[cfg(not(windows))]
    {
        let _ = (webview, low);
    }
}

/// 把某个 webview 真正挂起 / 恢复(Windows / WebView2)。
///
/// 与 [`set_memory_low`] 互补:`set_memory_low` 只是把内存**目标档位**调低(告诉
/// 运行时"优先省内存",webview 仍活着);本函数用 WebView2 官方挂起 API
/// `CoreWebView2.TrySuspend` / `Resume` 把 webview **真正冻结** —— 释放渲染进程
/// 占用、暂停 JS/定时器,保留页面状态,回前台 `Resume` 无重载闪烁。
///
/// 失焦 ⇒ suspend=true,回到前台 ⇒ false。用法同 `set_memory_low`:**窗口失焦 ⇒ 挂起,
/// 回前台 ⇒ 恢复**。
///
/// 安全要点(2026-10-16 立):本 binding(webview2-com 0.38)里没有 `TrySuspendAsync`,
/// 而是 handler 形态的 `TrySuspend(handler)` —— 立即返回,结果经 completion handler
/// 回投到 WebView2 UI 线程。绝不能用 `wait_for_async_operation`(内部 wait_with_pump
/// 会在 `with_webview` 闭包内重入 UI 线程消息循环 → 死锁);只用
/// `TrySuspendCompletedHandler::create(closure)`(fire-and-forget,闭包只记日志)。
/// `Resume()` 无 handler,直接调即可。Runtime < ~88 时 `cast::<ICoreWebView2_3>()`
/// 失败 ⇒ 直接跳过(no-op),与 `set_memory_low` 一致。TrySuspend 是 best-effort:页面
/// 正在导航/播放媒体等会返回 did_suspend=false,属正常,不强制。
pub fn set_suspend(webview: &tauri::webview::Webview, suspend: bool) {
    #[cfg(windows)]
    {
        use webview2_com::Microsoft::Web::WebView2::Win32::{ICoreWebView2_3, ICoreWebView2_8};
        use webview2_com::TrySuspendCompletedHandler;
        use windows_core::Interface;
        let _ = webview.with_webview(move |pw| {
            // 与 set_memory_low 完全一致的 COM 链:controller → CoreWebView2 →
            // cast 到版本化接口 _3(TrySuspend/Resume 只在 ICoreWebView2_3 上;
            // Runtime < ~88 时 cast 失败 ⇒ 直接跳过)。
            let controller = pw.controller();
            let core = match unsafe { controller.CoreWebView2() } {
                Ok(c) => c,
                Err(_) => return,
            };
            let v3: ICoreWebView2_3 = match core.cast() {
                Ok(v) => v,
                Err(_) => return,
            };
            if suspend {
                // 可听标签不冻结(2026-10-25,用户要求「后台音乐/视频不被掐断」):
                // Chrome 同样不冻结正在放声音的标签。音频停了之后由停靠档的后台
                // 维护任务再次尝试(见 embedded_browser_dock::maintain_hidden_tab)。
                if let Ok(v8) = core.cast::<ICoreWebView2_8>() {
                    // 这个属性是 out 参数式 API(`*mut BOOL`),不是返回值式
                    let mut flag = windows_core::BOOL(0);
                    let playing = unsafe { v8.IsDocumentPlayingAudio(&mut flag) }
                        .map(|_| flag.as_bool())
                        .unwrap_or(false);
                    if playing {
                        log::debug!("[embedded-browser] 标签正在播放声音,跳过挂起");
                        return;
                    }
                }
                let handler = TrySuspendCompletedHandler::create(Box::new(|hr, did_suspend: bool| {
                    if let Err(e) = hr {
                        log::debug!("[embedded-browser] TrySuspend 报错: {e}");
                    } else if !did_suspend {
                        log::debug!("[embedded-browser] TrySuspend 未实际挂起(页面导航/媒体等,best-effort)");
                    }
                    Ok(())
                }));
                // TrySuspend 要的是 &handler(借引用);直接传 handler 不满足 Param bound。
                unsafe {
                    let _ = v3.TrySuspend(&handler);
                }
            } else {
                unsafe {
                    let _ = v3.Resume();
                }
            }
        });
    }
    #[cfg(not(windows))]
    {
        let _ = (webview, suspend);
    }
}

/// 页面是否正在播放声音(`ICoreWebView2_8`;Runtime 太旧 cast 失败 ⇒ None)。
///
/// 用途只有一个:**决定能不能冻结/休眠**。可听标签被冻结 = 后台音乐、视频、
/// 语音通话被掐断,所以停靠档的后台维护任务每轮先问这里。
///
/// `with_webview` 是把闭包投到 WebView2 UI 线程执行(`Send + 'static`,拿不到返回值),
/// 故用一次性 channel 把结果带回(最多等 600ms)。**只能在非主线程调用** ——
/// 本函数唯一调用方是 tokio 上的维护任务。
pub fn is_audio_playing(webview: &tauri::webview::Webview) -> Option<bool> {
    #[cfg(windows)]
    {
        use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_8;
        use windows_core::Interface;
        let (tx, rx) = std::sync::mpsc::channel();
        webview
            .with_webview(move |pw| {
                let controller = pw.controller();
                let playing = unsafe { controller.CoreWebView2() }
                    .ok()
                    .and_then(|core| core.cast::<ICoreWebView2_8>().ok())
                    .and_then(|v8| {
                        let mut flag = windows_core::BOOL(0);
                        unsafe { v8.IsDocumentPlayingAudio(&mut flag) }
                            .ok()
                            .map(|_| flag.as_bool())
                    });
                let _ = tx.send(playing);
            })
            .ok()?;
        rx.recv_timeout(Duration::from_millis(600)).ok().flatten()
    }
    #[cfg(not(windows))]
    {
        let _ = webview;
        None
    }
}

/// 对整个内嵌浏览器(当前活动标签页)设置内存档位。
#[allow(dead_code)]
pub fn set_active_memory_low(app: &AppHandle, low: bool) {
    if let Some(wv) = active_webview(app) {
        set_memory_low(&wv, low);
    }
}

// ---------------------------------------------------------------------------
// 标签级冻结(2026-10-24 用户要求「按第一种方案加标签冻结」)
// ---------------------------------------------------------------------------
//
// 背景:隐藏标签用 `hide()` 只保活、不省内存 —— 它的渲染进程照样占着(和 Chrome
// 后台标签同理),开满 8 个标签就是 8 份内存。这里在切走后把隐藏 webview 用
// WebView2 官方 `TrySuspend` **真正冻结**(渲染进程挂起、JS/定时器停摆,页面状态保留),
// 切回来 `Resume` 无重载闪烁。
//
// 两个必须注意的点:
// 1. `TrySuspend` 只在 webview **不可见**时才会真正生效,所以顺序是先 `hide()` 再挂起;
//    且隐藏/可见切换由 UI 线程异步落地,这里延迟 250ms 再挂起(best-effort,失败只记 debug)。
// 2. 用户可能很快切回:延迟任务在挂起前再确认一次「这个标签现在仍不是活动标签」,
//    否则会把刚展示出来的页面冻住。恢复则必须**先 Resume 再 show**,否则窗口会白一帧。

/// 切走标签:隐藏 + 冻结,并起后台维护链(安静满阈值 ⇒ 空闲休眠丢弃)。
///
/// 2026-10-25 与停靠档对齐:此前独立窗口只有冻结、没有丢弃 —— 12 个标签开一天,
/// 闲置的渲染进程一直占着。现在同一套策略:隐藏 ⇒ TrySuspend ⇒ 安静够久 close()。
fn hide_and_suspend_tab(app: &AppHandle, id: u64) {
    let got = app.state::<BrowserManager>().with(|s| {
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
    set_memory_low(&wv, true);
    tauri::async_runtime::spawn(maintain_hidden_tab(app.clone(), id, label, token));
}

/// 隐藏标签的后台维护:挂起 → 可听不冻 → 安静够久就休眠(销毁 webview)。
async fn maintain_hidden_tab(app: AppHandle, id: u64, label: String, token: u64) {
    // 这一轮任务是否仍然有效:标签还在、token 没被下一轮顶掉、webview 没换 label、
    // 且此刻确实不是活动标签(用户可能已经切回来)。
    let valid = || {
        app.state::<BrowserManager>().with(|s| {
            s.tabs.iter().any(|t| {
                t.id == id && t.hide_token == token && !t.discarded && t.label == label
            }) && s.active != Some(id)
        })
    };

    tokio::time::sleep(Duration::from_millis(250)).await;
    if !valid() {
        return;
    }
    if let Some(wv) = app.get_webview(&label) {
        set_memory_low(&wv, true);
        // 页内探针说正在出声(WebAudio 等原生探不到的音)⇒ 先别冻结;
        // 隐藏不等于挂起,页面 JS 还会跑,音频停下会自己回传 on=0。
        if !label_is_audio_playing(&app, &label) {
            set_suspend(&wv, true);
        }
    }

    // `None` = 用户在设置里关了空闲休眠:仍然每 30s 补一次挂起(冻结),
    // 但永不走 discard 分支 —— 内存还一半,页面状态不丢。
    let threshold = idle_discard_threshold();
    // "安静"从隐藏那一刻算起;检测到出声就重置(正在放歌/通话的标签不休眠)。
    let mut silent_since = Instant::now();
    loop {
        tokio::time::sleep(Duration::from_secs(30)).await;
        if !valid() {
            return;
        }
        let Some(wv) = app.get_webview(&label) else {
            return;
        };
        if is_audio_playing(&wv).unwrap_or(false) || label_is_audio_playing(&app, &label) {
            silent_since = Instant::now();
            continue;
        }
        if let Some(t) = threshold {
            if silent_since.elapsed() >= t {
                discard_tab(&app, id);
                return;
            }
        }
        // 补挂起:切走时页面可能还在导航,那一次 `TrySuspend` 没生效且不会自动重试。
        set_memory_low(&wv, true);
        set_suspend(&wv, true);
    }
}

/// 销毁一个隐藏标签的 webview,保留标签条目(切回按 url 重载)。
fn discard_tab(app: &AppHandle, id: u64) {
    let label = app.state::<BrowserManager>().with(|s| {
        // 正在看的标签绝不休眠
        if s.active == Some(id) {
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
    log::debug!("[embedded-browser] 独立窗口标签 {id} 空闲超时,已休眠(切回按 url 重载)");
}

/// 切回标签:先 Resume 再显示(页面状态保留,不重载)。
fn resume_and_show_tab(webview: &tauri::webview::Webview) {
    set_suspend(webview, false);
    set_memory_low(webview, false);
    let _ = webview.show();
    let _ = webview.set_focus();
}

/// 取标签的 webview;已被空闲休眠的按存的 url **重建**(新 label)。
///
/// 不存在且未标记 discarded ⇒ None(webview 意外丢失,调用方按"没东西可显示"处理)。
fn ensure_tab_webview(app: &AppHandle, id: u64) -> Option<tauri::webview::Webview> {
    let (label, discarded, url) = app.state::<BrowserManager>().with(|s| {
        let t = s.tabs.iter().find(|t| t.id == id)?;
        Some((t.label.clone(), t.discarded, t.url.clone()))
    })?;
    if let Some(wv) = app.get_webview(&label) {
        return Some(wv);
    }
    if !discarded {
        return None;
    }
    let window = app.get_window(BROWSER_WINDOW_LABEL)?;
    let parsed = url.parse::<Url>().ok()?;
    let size = window.inner_size().ok()?;
    let new_label = app.state::<BrowserManager>().with(alloc_label);
    let builder = build_tab_builder(app, new_label.clone(), id, parsed).auto_resize();
    spawn_tab_webview(&window, builder, size).ok()?;
    app.state::<BrowserManager>().with(|s| {
        if let Some(t) = s.tabs.iter_mut().find(|t| t.id == id) {
            t.label = new_label.clone();
            t.discarded = false;
            t.hide_token += 1;
        }
    });
    log::debug!("[embedded-browser] 独立窗口标签 {id} 已从休眠恢复(按 {url} 重载)");
    app.get_webview(&new_label)
}

/// 后台标签加载完成后再补一次挂起。
///
/// 切走时页面若还在导航,`TrySuspend` 会返回 did_suspend=false 且**不会自动重试** ——
/// 不补这一下,后台标签就一直占着渲染进程。降级档(单 webview 窗)没有后台标签,跳过。
async fn suspend_tab_if_inactive(app: &AppHandle, tab_id: u64, label: &str) {
    let inactive = || {
        app.state::<BrowserManager>()
            .with(|s| s.active != Some(tab_id) && !s.degraded)
    };
    if !inactive() {
        return;
    }
    tokio::time::sleep(std::time::Duration::from_millis(800)).await;
    if !inactive() {
        return;
    }
    if let Some(wv) = app.get_webview(label) {
        set_memory_low(&wv, true);
        set_suspend(&wv, true);
    }
}

/// 工具条是否显示标签栏(降级单 webview 窗没有多标签可言)。
///
/// 抽成纯函数是为了单测:构造 `AppHandle` 需要真跑一个 Tauri 应用。
fn multi_tab(s: &Session) -> bool {
    !s.degraded
}

/// 生成推给页面工具条的状态 JSON。
/// 工具条状态(标签 + 地址 + 收藏/历史)。收藏/历史由 `browser_store` 提供,
/// 独立窗口是裸 webview,拿不到 web 端 store(见 browser_store 模块头)。
fn bar_state_json(app: &AppHandle, s: &Session) -> serde_json::Value {
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
    // 一次取快照(带缓存),收藏列表与"当前页是否已收藏"同源,避免两把锁两次 clone
    let store = crate::browser_store::snapshot_arc(app);
    let favorited = !url.is_empty() && store.favorites.iter().any(|f| f.url == url);
    serde_json::json!({
        "tabs": tabs,
        "url": url,
        "picking": false,
        "multiTab": multi_tab(s),
        "favorites": store.favorites,
        "history": store.history,
        "favorited": favorited,
    })
}

/// 把状态渲染进某个 webview 的工具条。
fn push_bar_state(app: &AppHandle, webview_label: &str, s: &Session) {
    if let Some(wv) = app.get_webview(webview_label) {
        let js = format!(
            "if(window.__ihuiBarRender){{window.__ihuiBarRender({});}}",
            bar_state_json(app, s)
        );
        let _ = wv.eval(js);
    }
}

/// 按标签 id 改标题(`title` 哨兵回传用;BAR_JS 直读 DOM,这里保持会话一致)。
/// 返回是否真的变了。
fn update_tab_title(app: &AppHandle, id: u64, title: &str) -> bool {
    app.state::<BrowserManager>().with(|s| {
        let Some(t) = s.tabs.iter_mut().find(|t| t.id == id) else {
            return false;
        };
        if t.title == title {
            return false;
        }
        t.title = title.to_string();
        true
    })
}

/// 记下某个标签的出声状态(页内探针回传)。
fn set_tab_audio(app: &AppHandle, id: u64, on: bool) -> bool {
    app.state::<BrowserManager>().with(|s| {
        let Some(t) = s.tabs.iter_mut().find(|t| t.id == id) else {
            return false;
        };
        if t.audio == on {
            return false;
        }
        t.audio = on;
        true
    })
}

/// 该 webview 的页内探针是否报"正在出声"(只看 WebAudio 一路,媒体元素见
/// [`is_audio_playing`])。维护任务与焦点挂起循环都读这里,零 COM 开销。
pub fn label_is_audio_playing(app: &AppHandle, label: &str) -> bool {
    app.state::<BrowserManager>()
        .with(|s| s.tabs.iter().find(|t| t.label == label).map(|t| t.audio).unwrap_or(false))
}

fn update_active_tab_title(app: &AppHandle, title: String) -> bool {
    app.state::<BrowserManager>().with(|s| {
        let Some(id) = s.active else {
            return false;
        };
        let Some(t) = s.tabs.iter_mut().find(|t| t.id == id) else {
            return false;
        };
        // 标题没变就不刷工具条:SPA 常把未读数写进 title,几十毫秒一次,
        // 每来一次都重推全量状态(含收藏/历史)并重建标签栏 DOM,纯属烧 CPU。
        if t.title == title {
            return false;
        }
        t.title = title;
        true
    })
}

/// 把状态推给当前活动标签页(不持锁调用,避免在锁内做 eval)。
fn refresh_active_bar(app: &AppHandle) {
    let snapshot = app.state::<BrowserManager>().with(|s| s.clone());
    if snapshot.degraded {
        // 降级:窗口 label == webview label
        push_bar_state(app, BROWSER_WINDOW_LABEL, &snapshot);
        return;
    }
    if let Some(label) = snapshot
        .active
        .and_then(|id| snapshot.tabs.iter().find(|t| t.id == id))
        .map(|t| t.label.clone())
    {
        push_bar_state(app, &label, &snapshot);
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
    let label_for_load = label.clone();
    let mut builder = WebviewBuilder::new(label, WebviewUrl::External(url))
        .user_agent(CHROME_UA)
        .devtools(true)
        .background_color(Color(0x24, 0x24, 0x24, 0xff))
        .initialization_script(BAR_JS)
        .initialization_script(PICK_JS)
        .initialization_script(AUDIO_PROBE_JS)
        .on_navigation(move |url| {
            if let Some(action) = parse_sentinel(url) {
                let a = app_for_nav.clone();
                tauri::async_runtime::spawn(async move {
                    handle_sentinel(a, action, Some(tab_id)).await;
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
            // payload 是借用,不能进 'static 任务:先把是否「加载完成」拷出来
            let finished = payload.event() == tauri::webview::PageLoadEvent::Finished;
            let label = label_for_load.clone();
            tauri::async_runtime::spawn(async move {
                let title = app.state::<BrowserManager>().with(|s| {
                    let t = s.tabs.iter_mut().find(|t| t.id == tab_id);
                    match t {
                        Some(tab) => {
                            tab.url = url.clone();
                            if tab.title.is_empty() {
                                tab.title = url.clone();
                            }
                            tab.title.clone()
                        }
                        None => String::new(),
                    }
                });
                // 历史(2026-10-24):独立窗口的访问记录存宿主进程,供工具条「历史」用
                if finished {
                    crate::browser_store::record_visit(&app, &url, &title);
                }
                // 先刷工具条,再补挂起(补挂要等 800ms,不能拖慢 UI)。
                // 后台标签加载完不必推:活动页的 lastState 没变,推一次等于白跑
                // 一包 JSON 序列化 + 一次 eval;切回去时 switch_tab 会重推。
                if is_active_tab_label(&app, &label) {
                    refresh_active_bar(&app);
                }
                if finished {
                    suspend_tab_if_inactive(&app, tab_id, &label).await;
                }
            });
        });
    // Environment 参数照抄主窗,见 [`main_window_browser_args`]
    if let Some(args) = main_window_browser_args(app) {
        builder = builder.additional_browser_args(&args);
    }
    builder
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
    let mut builder = tauri::WebviewWindowBuilder::new(
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
                // 降级档只有一个 webview,来源就是它自己
                handle_sentinel(a, action, Some(id)).await;
            });
            false
        } else {
            true
        }
    });
    if let Some(args) = main_window_browser_args(app) {
        builder = builder.additional_browser_args(&args);
    }
    builder
        .build()
        .map_err(|e| IpcError::internal(format!("内嵌浏览器窗口创建失败: {e}")))?;
    app.state::<BrowserManager>().with(|s| {
        s.tabs.push(TabInfo {
            id,
            url: parsed.to_string(),
            title: parsed.to_string(),
            // 降级窗:窗口 label 就是 webview label
            label: BROWSER_WINDOW_LABEL.to_string(),
            discarded: false,
            hide_token: 0,
            audio: false,
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
    label: String,
    url: &Url,
) -> Result<(), IpcError> {
    let size = window
        .inner_size()
        .map_err(|e| IpcError::internal(format!("取窗口尺寸失败: {e}")))?;
    // 内容 webview 随窗口缩放(auto_resize);降级路不需要(webview 即窗口)。
    let builder = build_tab_builder(app, label, id, url.clone()).auto_resize();
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

    let (id, label) = app.state::<BrowserManager>().with(|s| {
        s.next_id += 1;
        let label = alloc_label(s);
        (s.next_id, label)
    });
    if let Err(e) = add_tab_webview(&window, &app, id, label.clone(), &parsed) {
        log::warn!("[embedded-browser] add_child 失败,降级单 webview: {e}");
        let _ = window.close();
        return spawn_degraded_window(&app, title, parsed);
    }
    app.state::<BrowserManager>().with(|s| {
        s.tabs.push(TabInfo {
            id,
            url: parsed.to_string(),
            title: parsed.to_string(),
            label,
            discarded: false,
            hide_token: 0,
            audio: false,
        });
        s.active = Some(id);
        s.degraded = false;
    });
    Ok(())
}

// ==================== 哨兵动作处理 ====================

/// 处理工具条动作。跑在工作线程上(可安全调用 `add_child`/`hide`/`show`)。
///
/// `source_tab` = 发这个哨兵的 webview 属于哪个标签。标题回传必须认来源:
/// 后台标签也会改 document.title(未读数之类),一律写到"活动标签"上是错的。
async fn handle_sentinel(app: AppHandle, action: SentinelAction, source_tab: Option<u64>) {
    let Some(window) = app.get_window(BROWSER_WINDOW_LABEL) else {
        return;
    };
    let active_wv = || -> Option<tauri::webview::Webview> {
        let (label, degraded) = app.state::<BrowserManager>().with(|s| {
            if s.degraded {
                return (Some(BROWSER_WINDOW_LABEL.to_string()), true);
            }
            let label = s
                .active
                .and_then(|id| s.tabs.iter().find(|t| t.id == id))
                .map(|t| t.label.clone());
            (label, false)
        });
        if degraded {
            // 降级:窗口 label == webview label
            return app.get_webview(BROWSER_WINDOW_LABEL);
        }
        app.get_webview(&label?)
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
        SentinelAction::Title(t) => {
            // 独立窗口的标签栏在页内(BAR_JS 直接读 document.title),不需要这个;
            // 真正用到的是停靠档(React 标签栏)。这里只更新会话标题保持两套一致。
            let title = percent_decode(&t);
            if title.trim().is_empty() {
                return;
            }
            let changed = match source_tab {
                Some(id) => update_tab_title(&app, id, &title),
                None => update_active_tab_title(&app, title.clone()),
            };
            // 后台标签报标题只记账,不重推工具条(它此刻根本看不见);切回去时
            // switch_tab 会重推一次。只有活动标签才值得 eval 一整包 JSON。
            let active = source_tab
                .map(|id| app.state::<BrowserManager>().with(|s| s.active == Some(id)))
                .unwrap_or(true);
            if changed && active {
                refresh_active_bar(&app);
            }
        }
        SentinelAction::Audio(on) => {
            // 页内探针只回传状态,不改 UI:记到来源标签上即可(切走时由维护任务读)
            let target = source_tab
                .or_else(|| app.state::<BrowserManager>().with(|s| s.active));
            if let Some(id) = target {
                set_tab_audio(&app, id, on);
            }
        }
        SentinelAction::FavoriteToggle => {
            // 收藏 / 取消收藏当前页(独立窗口)。当前 URL 取活动 webview 的真实落点。
            let (url, title) = active_wv()
                .and_then(|wv| wv.url().ok())
                .map(|u| {
                    let title = app
                        .state::<BrowserManager>()
                        .with(|s| {
                            s.active
                                .and_then(|id| s.tabs.iter().find(|t| t.id == id))
                                .map(|t| t.title.clone())
                        })
                        .unwrap_or_default();
                    (u.to_string(), title)
                })
                .unwrap_or_default();
            if !url.is_empty() {
                if crate::browser_store::is_favorite(&app, &url) {
                    crate::browser_store::remove_favorite(&app, &url);
                } else {
                    crate::browser_store::add_favorite(&app, &url, &title);
                }
                refresh_active_bar(&app);
            }
        }
        SentinelAction::FavoriteRemove(url) => {
            if !url.is_empty() {
                crate::browser_store::remove_favorite(&app, &url);
                refresh_active_bar(&app);
            }
        }
        SentinelAction::ClearHistory => {
            crate::browser_store::clear_history(&app);
            refresh_active_bar(&app);
        }
        SentinelAction::WbCheckinLogin => {
            // 签到页(内容页无 IPC)请求「浏览器登录 WorkBuddy」(2026-10-17 立):
            // 建登录页标签 + 起看护轮询,结果经 #wb_import= 导航回签到页
            // (见 run_wb_checkin_login_watch)。防重入:进行中再触发直接忽略。
            if WB_LOGIN_POLLING.swap(true, Ordering::SeqCst) {
                return;
            }
            let Ok(login_url) = WB_WEB_LOGIN_URL.parse::<Url>() else {
                WB_LOGIN_POLLING.store(false, Ordering::SeqCst);
                return;
            };
            // 回跳地址 = 发起页当前 URL 去 fragment(2026-10-18):跟随发起页而不是
            // 硬编码线上签到页,本地/测试环境的登录结果才回得了家。
            let return_base = active_wv()
                .and_then(|wv| wv.url().ok())
                .map(|u| {
                    let mut u = u;
                    u.set_fragment(None);
                    u.to_string()
                })
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| "https://aizhs.top/checkin".to_string());
            // 降级窗(单 webview)没有"新标签"可开:当前页直接导航去登录页 ——
            // 签到页会被顶掉,但登录完成后看护会把这一页导航回带 #wb_import=
            // 的签到页自然恢复。标签满时同走此退化路。
            let login_tab: Option<u64> = if app.state::<BrowserManager>().with(|s| s.degraded) {
                if let Some(wv) = active_wv() {
                    let _ = wv.navigate(login_url.clone());
                }
                None
            } else {
                let count = app.state::<BrowserManager>().with(|s| s.tabs.len());
                if count >= max_tabs() {
                    if let Some(wv) = active_wv() {
                        let _ = wv.navigate(login_url.clone());
                    }
                    None
                } else {
                    let (id, label) = app.state::<BrowserManager>().with(|s| {
                        s.next_id += 1;
                        let label = alloc_label(s);
                        (s.next_id, label)
                    });
                    if let Err(e) = add_tab_webview(&window, &app, id, label.clone(), &login_url) {
                        log::warn!("[embedded-browser] wb-checkin-login 建登录标签失败: {e}");
                        WB_LOGIN_POLLING.store(false, Ordering::SeqCst);
                        return;
                    }
                    let prev = app.state::<BrowserManager>().with(|s| {
                        s.tabs.push(TabInfo {
                            id,
                            url: login_url.to_string(),
                            title: login_url.to_string(),
                            label,
                            discarded: false,
                            hide_token: 0,
                            audio: false,
                        });
                        let prev = s.active;
                        s.active = Some(id);
                        prev
                    });
                    if let Some(prev_id) = prev {
                        // 切走登录前的标签:隐藏并冻结,省下它的渲染进程内存
                        hide_and_suspend_tab(&app, prev_id);
                    }
                    refresh_active_bar(&app);
                    Some(id)
                }
            };
            run_wb_checkin_login_watch(app, login_tab, return_base).await;
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
            if count >= max_tabs() {
                return;
            }
            let target = match u {
                Some(u) if is_browsable_url(&u) => u,
                _ => HOME_URL.to_string(),
            };
            let Ok(parsed) = target.parse::<Url>() else { return };
            let (id, label) = app.state::<BrowserManager>().with(|s| {
                s.next_id += 1;
                let label = alloc_label(s);
                (s.next_id, label)
            });
            if add_tab_webview(&window, &app, id, label.clone(), &parsed).is_err() {
                return;
            }
            // 隐藏当前,激活新标签
            let prev = app.state::<BrowserManager>().with(|s| {
                s.tabs.push(TabInfo {
                    id,
                    url: parsed.to_string(),
                    title: parsed.to_string(),
                    label,
                    discarded: false,
                    hide_token: 0,
                    audio: false,
                });
                let prev = s.active;
                s.active = Some(id);
                prev
            });
            if let Some(prev_id) = prev {
                // 切走旧标签:隐藏并冻结(见 hide_and_suspend_tab)
                hide_and_suspend_tab(&app, prev_id);
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
            let (closing_label, remaining, new_active) = app.state::<BrowserManager>().with(|s| {
                // label 要在 retain 前取 —— 移除后会话里就查不到了
                let closing_label = s.tabs.iter().find(|t| t.id == i).map(|t| t.label.clone());
                s.tabs.retain(|t| t.id != i);
                if s.active == Some(i) {
                    s.active = s.tabs.last().map(|t| t.id);
                }
                (closing_label, s.tabs.len(), s.active)
            });
            if let Some(label) = closing_label {
                if let Some(wv) = app.get_webview(&label) {
                    let _ = wv.close();
                }
            }
            if remaining == 0 {
                let _ = window.close();
                app.state::<BrowserManager>().with(|s| {
                    *s = Session::default();
                });
                return;
            }
            if let Some(id) = new_active {
                // 接任的标签可能已被空闲休眠:先按 url 重建,再 Resume + 显示
                if let Some(wv) = ensure_tab_webview(&app, id) {
                    resume_and_show_tab(&wv);
                    refresh_active_bar(&app);
                }
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
                    // 切走的标签隐藏并冻结(见 hide_and_suspend_tab)
                    hide_and_suspend_tab(&app, pid);
                }
            }
            // 目标标签可能已被空闲休眠:先按 url 重建(重建的那次也算一次导航)
            if let Some(wv) = ensure_tab_webview(&app, i) {
                resume_and_show_tab(&wv);
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

/// `wb-checkin-login` 哨兵的登录看护(2026-10-17)。
///
/// 为什么轮询在 Rust 而不是前端:签到页跑在内嵌浏览器内容 webview 里,
/// **没有 IPC**(见模块头「安全边界」)—— 既调不了 probe 命令,也收不到事件。
/// 「浏览器登录 WorkBuddy」这条流程只能在 Rust 侧闭环:轮询共享 cookie jar 的
/// 登录态;ok 后把**登录标签**导航回签到页,URL fragment 充当结果通道
/// (`#wb_import=<percent-encoded JSON>`;fragment 不发往服务端,纯页面内消费),
/// 页面解析后入库并清 hash。超时静默放弃:不打断可能正在登录的用户,签到页
/// 自己的时钟(6.5 分钟)负责复位按钮态。
///
/// `return_base` = 发起页地址(登录前活动 webview 的当前 URL 去 fragment)。
/// **为什么不能硬编码 `https://aizhs.top/checkin`**(2026-10-18 修):内嵌浏览器
/// 里打开的不一定是线上签到页 —— 桌面端本地打包页(`tauri://localhost/...`)、
/// 测试环境地址都在同一窗口里跑;硬编码会把本地会话的登录结果导航去线上,
/// 用户看到的是「登录成功却跳到了另一个站点」= 没跳回我们程序。回跳地址
/// 一律跟随发起页,拿不到才退常量兜底。
async fn run_wb_checkin_login_watch(app: AppHandle, login_tab: Option<u64>, return_base: String) {
    /// 轮询节奏(与主窗口流程的 2.5s 前端轮询同拍)。
    const INTERVAL: Duration = Duration::from_millis(2500);
    /// 总超时:登录超过 6 分钟按放弃处理(登录页留在原地,用户可继续用浏览器)。
    const TIMEOUT: Duration = Duration::from_secs(360);
    let started = Instant::now();
    loop {
        tokio::time::sleep(INTERVAL).await;
        if started.elapsed() >= TIMEOUT {
            WB_LOGIN_POLLING.store(false, Ordering::SeqCst);
            return;
        }
        let probe = match checkin_workbuddy_web_login_probe(app.clone()).await {
            Ok(p) => p,
            Err(_) => continue, // IPC 层错误视为瞬态,下一轮再试
        };
        match probe {
            WebLoginProbe::Ok {
                cookie,
                accounts,
                cookie_checkin_ok,
            } => {
                WB_LOGIN_POLLING.store(false, Ordering::SeqCst);
                // 负载与主窗口流程消费的 probe 契约同形,签到页两条路共用一个入库函数
                let payload = serde_json::json!({
                    "cookie": cookie,
                    "accounts": accounts,
                    "cookie_checkin_ok": cookie_checkin_ok,
                });
                let Ok(parsed) = Url::parse(&format!(
                    "{}#wb_import={}",
                    return_base,
                    percent_encode(&payload.to_string())
                )) else {
                    return;
                };
                // 登录标签没了(用户关了它):退回活动标签;降级窗登录页就占着
                // 窗体 webview,`get_webview(BROWSER_WINDOW_LABEL)` 直接命中。
                let wv = match login_tab {
                    Some(id) => label_of(&app, id)
                        .and_then(|label| app.get_webview(&label))
                        .or_else(|| active_webview(&app)),
                    None => app
                        .get_webview(BROWSER_WINDOW_LABEL)
                        .or_else(|| active_webview(&app)),
                };
                if let Some(wv) = wv {
                    let _ = wv.navigate(parsed);
                }
                return;
            }
            // 窗口被整个关掉:签到页同样没了,本轮流程结束
            WebLoginProbe::NoWindow => {
                WB_LOGIN_POLLING.store(false, Ordering::SeqCst);
                return;
            }
            // 未登录/暂态错误:继续等
            _ => {}
        }
    }
}

/// 最小 percent-decode(`%XX` + `+`),用于解点选负载。
pub(crate) fn percent_decode(s: &str) -> String {
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

/// 最小 percent-encode(非 unreserved 字节全编码),用于 `#wb_import=` 负载
/// (2026-10-17)。为什么从紧编码:负载是 JSON(cookie 串含 `;`/空格,昵称可含
/// CJK/引号),fragment 里 `#` 会提前截断、`%` 会被误当转义,全量编码最不易
/// 踩坑;接收端(签到页)用 `decodeURIComponent` 一把解回。
fn percent_encode(s: &str) -> String {
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    let mut out = String::with_capacity(s.len() * 3);
    for &b in s.as_bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'.' | b'_' | b'~') {
            out.push(b as char);
        } else {
            out.push('%');
            out.push(HEX[(b >> 4) as usize] as char);
            out.push(HEX[(b & 0x0F) as usize] as char);
        }
    }
    out
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
    // IPC 入口,不是页面里的 webview 报上来的:没有"来源标签",按活动标签处理
    handle_sentinel(app, action, None).await;
    Ok(())
}

/// 打开当前标签页的开发者工具。
#[tauri::command]
pub async fn embedded_browser_devtools(app: AppHandle) -> Result<(), IpcError> {
    handle_sentinel(app, SentinelAction::Devtools, None).await;
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
        // 页内音频探针:on=1/0 两个方向都要认
        assert_eq!(
            parse_sentinel(&u("https://browser.ihui.invalid/audio?on=1")),
            Some(SentinelAction::Audio(true))
        );
        assert_eq!(
            parse_sentinel(&u("https://browser.ihui.invalid/audio?on=0")),
            Some(SentinelAction::Audio(false))
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
        // 2026-10-17:签到页借哨兵发起「浏览器登录 WorkBuddy」
        assert_eq!(
            parse_sentinel(&u("https://browser.ihui.invalid/wb-checkin-login")),
            Some(SentinelAction::WbCheckinLogin)
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
    fn percent_encode_roundtrip_with_decode() {
        // #wb_import= 负载往返:JSON 里的关键字符(`#` 截断 / `%` 转义歧义 /
        // `+` 被解码成空格的歧义 / CJK)全部编码,且能被 percent_decode 解回。
        // 编码器把 `+` 也编码 ⇒ 解码端"裸 + → 空格"的规则不会误伤负载。
        let raw = r#"{"cookie":"a=b; c+d","accounts":[{"uid":"u1","nickname":"李总#1%"}]}"#;
        let enc = percent_encode(raw);
        assert!(!enc.contains('#'));
        assert!(!enc.contains('+'));
        assert_eq!(percent_decode(&enc), raw);
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
        assert_eq!(multi_tab(&s), true);
        // 降级单 webview:multiTab = false(工具条据此隐藏标签栏)
        let mut d = Session::default();
        d.degraded = true;
        assert_eq!(multi_tab(&d), false);
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
