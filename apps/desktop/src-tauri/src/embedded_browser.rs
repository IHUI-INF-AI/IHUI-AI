// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 项目内嵌浏览器 —— 2026-10-16 立。
//!
//! ## 形态演进(与 `checkin_web_login.rs` 同一条链路)
//!
//! - 2026-10-12:内嵌 WebView2 弹窗(小窗形态),探针读弹窗 cookie jar。
//! - 2026-10-15:用户拍板「弹窗形式不对,应该打开浏览器去扫码」,改外部真 Chrome
//!   窗口 + CDP 回收登录态,内嵌三件套废弃。
//! - **2026-10-16 本版**:用户再拍板「要项目里内嵌的浏览器(参照 Trae/Qoder 的内嵌
//!   浏览器)」,内嵌形态回归,但**形态升级为完整浏览器窗口**(不再是当年那个小弹窗):
//!   自绘工具条(拖动区 + 地址栏 + 后退/刷新/关闭)+ 完整窗口尺寸 + Chrome UA。
//!
//! ## 内核事实(写给后来人,避免重复踩坑)
//!
//! 本项目桌面端是 **Tauri** 而非 Electron:
//! - Electron(Trae / Qoder / Codex 那类 VS Code 系)自带完整 Chromium 引擎,能"真内嵌";
//! - Tauri 刻意不带浏览器引擎,Windows 上内嵌只有系统 WebView2 一条路。
//! **但 WebView2 的内核就是 Chromium**(Edge 自 2020 起即 Chromium 套壳,与 Chrome
//! 同源),差异只在品牌外壳与 UA 标识 —— 本窗显式设 Chrome UA ⇒ 站点识别为 Chrome。
//! 当年否掉内嵌时把「Edge 壳」误当成「Edge 内核」;本版据此把两件事分开看:
//! **形态(内嵌 / 外置)是产品选择,内核(Chromium)两边同源**。
//!
//! ## 为什么工具条用注入脚本,不用「一窗多 webview」
//!
//! Tauri 2 的 multi-webview(`Window::add_child`)仍挂在 `unstable` feature 上
//! (docs.rs 原文:"Available on crate feature unstable only"),生产不引不稳定开关。
//! 故工具条走 `initialization_script` 注入,且**全部用纯 JS 实现、零 IPC 调用**:
//! 第三方站点 CSP 不放行 ipc.localhost(历史:CSP 只在 aizhs.top 本域放行过 IPC),
//! 纯 JS 不受影响 ——
//!   - 后退 = `history.back()`、刷新 = `location.reload()`、关闭 = `window.close()`
//!     (label 不在 `on_window_event` 的 main/admin 特判里 ⇒ 走默认关窗,无 prevent_close);
//!   - 拖动 = `data-tauri-drag-region`(Tauri 自绘标题栏标准机制);
//!   - 地址栏 = `location.href`,SPA 跳转靠 pushState/replaceState 钩子 + popstate 同步。
//!
//! ## 建窗时序铁律
//!
//! Windows 上 WebView2 建窗在**同步命令 / 事件处理器**里会死锁(官方 known issue;
//! 本仓 2026-10-13 白屏事故同一根因:`build()` 同步等 WebView2 初始化,完成回调需
//! 主线程泵事件循环 ⇒ 主线程自锁死)。故 open 命令**必须是 async**(跑 tokio 线程池),
//! 与已验证的 `open_admin_window` 同范式。

use tauri::webview::Color;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};

use crate::IpcError;

/// 内嵌浏览器窗口 label(全仓唯一)。
pub const BROWSER_LABEL: &str = "embedded-browser";

/// Chrome UA。WebView2 默认 UA 带 `Edg/` 标识,登录类站点可能据 UA 走不同分支
/// (也会把"内嵌"这件事暴露给站点);显式伪装成 Chrome,与内核事实自洽。
pub const CHROME_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/// 内嵌浏览器工具条注入脚本(纯 JS、零 IPC,理由见模块头)。
///
/// 形态:左侧后退/刷新 + 中间地址栏(只读,显示当前地址)+ 右侧关闭;
/// 整条为拖动区(`data-tauri-drag-region`)⇒ 无系统装饰条也能拖窗口。
const BROWSER_TOOLBAR_JS: &str = r#"(function () {
  if (document.getElementById('__ihui_browser_toolbar')) return;
  var BAR_H = 40;
  var css = function (el, props) { for (var k in props) { el.style.setProperty(k, props[k]); } };

  var bar = document.createElement('div');
  bar.id = '__ihui_browser_toolbar';
  bar.setAttribute('data-tauri-drag-region', '');
  css(bar, {
    position: 'fixed', top: '0px', left: '0px', right: '0px',
    height: BAR_H + 'px', 'z-index': '2147483647',
    display: 'flex', 'align-items': 'center', gap: '8px', padding: '0 10px',
    'box-sizing': 'border-box', background: '#1c1c1c', color: '#e8e8e8',
    'border-bottom': '1px solid #2f2f2f', 'font-size': '13px',
    'font-family': '-apple-system, "Segoe UI", "Microsoft YaHei", sans-serif',
    'user-select': 'none', '-webkit-user-select': 'none'
  });

  function mkBtn(label, title, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = title;
    css(b, {
      width: '28px', height: '28px', 'line-height': '26px', flex: '0 0 auto',
      background: 'transparent', color: '#cfcfcf', padding: '0',
      border: '1px solid #333333', 'border-radius': '6px',
      cursor: 'pointer', 'font-size': '14px'
    });
    b.addEventListener('mouseenter', function () { b.style.setProperty('background', '#2f2f2f'); });
    b.addEventListener('mouseleave', function () { b.style.setProperty('background', 'transparent'); });
    b.addEventListener('click', onClick);
    return b;
  }

  var urlBox = document.createElement('div');
  css(urlBox, {
    flex: '1 1 auto', height: '26px', 'line-height': '26px',
    background: '#111111', color: '#b0b0b0', 'border-radius': '6px',
    padding: '0 10px', 'font-size': '12px',
    overflow: 'hidden', 'white-space': 'nowrap', 'text-overflow': 'ellipsis'
  });
  urlBox.textContent = location.href;
  var syncUrl = function () { urlBox.textContent = location.href; };
  var _push = history.pushState;
  history.pushState = function () { _push.apply(history, arguments); setTimeout(syncUrl, 0); };
  var _replace = history.replaceState;
  history.replaceState = function () { _replace.apply(history, arguments); setTimeout(syncUrl, 0); };
  window.addEventListener('popstate', syncUrl);
  window.addEventListener('hashchange', syncUrl);

  bar.appendChild(mkBtn('\u2190', '后退', function () { history.back(); }));
  bar.appendChild(mkBtn('\u21bb', '刷新', function () { location.reload(); }));
  bar.appendChild(urlBox);
  bar.appendChild(mkBtn('\u2715', '关闭', function () { window.close(); }));

  function mount() {
    if (document.body && !document.getElementById('__ihui_browser_toolbar')) {
      document.body.appendChild(bar);
      // 内容下移,避免被固定工具条压住顶部(box-sizing 一并设,免得撑出滚动条)
      css(document.documentElement, { 'padding-top': BAR_H + 'px', 'box-sizing': 'border-box' });
    }
  }
  if (document.body) {
    mount();
  } else {
    // 注入脚本在 document_start 跑,body 还没到 —— 等 DOMContentLoaded 再挂
    document.addEventListener('DOMContentLoaded', mount);
  }
})();"#;

/// 地址是否允许在内嵌浏览器里打开(纯函数,单测覆盖)。
///
/// 只放行 http/https:前端不可借本命令把 `file:`/`tauri:` 之类的内部协议带进窗口,
/// 也不接受空白或畸形串。
pub fn is_browsable_url(url: &str) -> bool {
    let t = url.trim();
    t.starts_with("http://") || t.starts_with("https://")
}

/// 内嵌浏览器窗口状态(前端契约)。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserState {
    /// 窗口是否存在(用户点工具条关闭后即为 false)。
    pub open: bool,
    /// 窗口当前地址(用于前端展示/诊断)。
    pub url: Option<String>,
}

/// 打开(或复用)内嵌浏览器窗口。
///
/// 复用分支会顺带导航到新地址:同一 label 只建一次窗,避免 WebView2 拒建
/// (0x8007139F 一类"同 UDF 第二环境 options 不一致"的坑,见 2026-10-13 记录)。
#[tauri::command]
pub async fn embedded_browser_open(
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
    if let Some(win) = app.get_webview_window(BROWSER_LABEL) {
        let _ = win.navigate(parsed);
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, BROWSER_LABEL, WebviewUrl::External(parsed))
        .title(title.unwrap_or_else(|| "智汇AI 浏览器".to_string()))
        // 内核是 Chromium,UA 显式声明为 Chrome(见模块头"内核事实")
        .user_agent(CHROME_UA)
        .initialization_script(BROWSER_TOOLBAR_JS)
        .inner_size(1280.0, 860.0)
        .min_inner_size(900.0, 640.0)
        .resizable(true)
        .center()
        // 工具条自绘 ⇒ 关掉系统装饰条;背景色与主窗口一致,SPA 加载期不画白
        .decorations(false)
        .background_color(Color(0x24, 0x24, 0x24, 0xff))
        .build()
        .map_err(|e| IpcError::internal(format!("内嵌浏览器窗口创建失败: {e}")))?;
    Ok(())
}

/// 关闭(并销毁)内嵌浏览器窗口。label 不在 `on_window_event` 的 main/admin
/// 特判里 ⇒ close() 走默认路径,不会被 prevent_close 拦住。
#[tauri::command]
pub async fn embedded_browser_close(app: AppHandle) -> Result<(), IpcError> {
    if let Some(win) = app.get_webview_window(BROWSER_LABEL) {
        win.close()
            .map_err(|e| IpcError::internal(format!("关闭内嵌浏览器窗口失败: {e}")))?;
    }
    Ok(())
}

/// 查询内嵌浏览器窗口状态(窗口在不在、当前地址)。
#[tauri::command]
pub fn embedded_browser_state(app: AppHandle) -> BrowserState {
    match app.get_webview_window(BROWSER_LABEL) {
        Some(win) => BrowserState {
            open: true,
            url: win.url().ok().map(|u| u.to_string()),
        },
        None => BrowserState {
            open: false,
            url: None,
        },
    }
}

// ================== 单测(纯判据区) ==================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn browsable_url_allowlist() {
        assert!(is_browsable_url("https://www.workbuddy.cn/login/"));
        assert!(is_browsable_url("http://example.com"));
        assert!(is_browsable_url("  https://a.b  ")); // 前后空白容忍
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
            "www.workbuddy.cn", // 缺 scheme
        ] {
            assert!(!is_browsable_url(bad), "不该放行: {bad}");
        }
    }

    #[test]
    fn toolbar_js_is_self_contained_and_idempotent() {
        // 零 IPC:不得出现任何 Tauri invoke 面(第三方站点 CSP 不放行 ipc.localhost)
        for forbidden in ["__TAURI", "invoke(", "ipc.localhost", "__TAURI_INTERNALS__"] {
            assert!(
                !BROWSER_TOOLBAR_JS.contains(forbidden),
                "注入脚本不该依赖 IPC: {forbidden}"
            );
        }
        // 幂等:重复注入不叠第二条(靠 DOM id 守卫,导航重建文档后也成立)
        assert!(BROWSER_TOOLBAR_JS.contains("__ihui_browser_toolbar"));
        // 拖动区 + 三个按钮 + 地址栏同步
        assert!(BROWSER_TOOLBAR_JS.contains("data-tauri-drag-region"));
        assert!(BROWSER_TOOLBAR_JS.contains("history.back()"));
        assert!(BROWSER_TOOLBAR_JS.contains("location.reload()"));
        assert!(BROWSER_TOOLBAR_JS.contains("window.close()"));
        assert!(BROWSER_TOOLBAR_JS.contains("popstate"));
    }

    #[test]
    fn chrome_ua_has_no_edge_marker() {
        assert!(CHROME_UA.contains("Chrome/"));
        assert!(!CHROME_UA.contains("Edg/"));
        assert!(CHROME_UA.contains("AppleWebKit/537.36"));
    }
}
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
