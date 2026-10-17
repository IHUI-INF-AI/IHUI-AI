// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 原生窗控按钮(DWM sheet-of-glass,2026-10-17 立)。
//!
//! ## 背景
//! main 窗 tauri.conf `decorations:false` 下,Windows 不画任何原生窗框,右上角
//! 最小化/最大化/关闭三个按钮全靠网页 `GlobalTopBar.tsx` 的 React 组件渲染。
//! 按钮门控 `useTauriIpcReady()` 轮询 `__TAURI_INTERNALS__` 注入(100~500ms),
//! 窗口亮了之后按钮还要等页面 JS/渲染才冒出来 —— 用户报"按钮跟壳一起出来,
//! 不要等渲染"。
//!
//! ## 方案
//! Win32 DWM `DwmExtendFrameIntoClientArea` + "sheet of glass" margins(-1 四边):
//! 1. 给窗体补回 `WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX`
//!    样式(DWM 需要这些位才会画原生按钮);
//! 2. `DwmExtendFrameIntoClientArea` 四边 -1 = 整片玻璃帧,DWM 把标题栏区域
//!    延伸进客户区(透明/无标题栏底色),但保留右上角原生三按钮。
//! 3. 按钮由 OS 绘制,窗口一亮就在,不等网页渲染。
//!
//! ## 配套
//! 网页侧 HTML 窗控(`[data-window-controls]`)必须隐藏,否则与原生按钮重叠 ——
//! 由 lib.rs `on_page_load` 注入 CSS 完成。
//!
//! ## 平台
//! 仅 Windows。macOS 走 `titleBarStyle:Overlay`(tauri.conf 已配),Linux 无此 API。

#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;
#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Dwm::DwmExtendFrameIntoClientArea;
#[cfg(target_os = "windows")]
use windows::Win32::UI::Controls::MARGINS;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_STYLE, SWP_FRAMECHANGED,
    SWP_NOZORDER, SWP_NOMOVE, SWP_NOSIZE, WS_CAPTION, WS_MAXIMIZEBOX, WS_MINIMIZEBOX,
    WS_SYSMENU,
};

/// 给指定窗口启用 DWM 原生窗控按钮(sheet-of-glass)。
///
/// 在 setup 期拿到 main 窗口后立即调用 —— 必须在窗口首次 show() 之前,
/// 这样窗口一亮原生按钮就在。失败只 warn,不阻塞启动(原生按钮缺失 =
/// 退回 HTML 按钮,不是致命错)。
#[cfg(target_os = "windows")]
pub fn enable_native_caption_buttons(window: &tauri::WebviewWindow) {
    let hwnd_raw = match window.hwnd() {
        Ok(h) => h,
        Err(e) => {
            log::warn!("[window-chrome] 获取 HWND 失败: {e} ⇒ 原生窗控按钮跳过");
            return;
        }
    };

    // Tauri 2 的 hwnd() 返回 windows 0.61 的 HWND(与本 crate 同版本),
    // 直接用 .0 取出裸指针构造我们自己的 HWND,避免跨 crate 类型不匹配。
    let hwnd = HWND(hwnd_raw.0);

    unsafe {
        // 1. 补回窗体样式:decorations:false 把 WS_CAPTION 等全删了,DWM 需要这些位画按钮。
        //    windows 0.61 的 WS_* 是 WINDOW_STYLE(u32 newtype),GetWindowLongPtrW 返回 isize,
        //    经 .0 取裸 u32 位再 as isize 做位或。
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        let needed = (WS_CAPTION.0 | WS_SYSMENU.0 | WS_MINIMIZEBOX.0 | WS_MAXIMIZEBOX.0) as isize;
        let new_style = style as isize | needed;
        if new_style != style {
            SetWindowLongPtrW(hwnd, GWL_STYLE, new_style);
            // SWP_FRAMECHANGED 让 Windows 重算非客户区;NOMOVE/NOSIZE/NOZORDER 不碰位置尺寸。
            let _ = SetWindowPos(
                hwnd,
                None,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED,
            );
        }

        // 2. sheet-of-glass:四边 -1,DWM 把整窗当帧,标题栏透明化但保留右上角三按钮。
        let margins = MARGINS {
            cxLeftWidth: -1,
            cxRightWidth: -1,
            cyTopHeight: -1,
            cyBottomHeight: -1,
        };
        match DwmExtendFrameIntoClientArea(hwnd, &margins) {
            Ok(()) => log::info!(
                "[window-chrome] DWM sheet-of-glass 原生窗控按钮已启用(最小化/最大化/关闭由 OS 绘制)"
            ),
            Err(e) => log::warn!("[window-chrome] DwmExtendFrameIntoClientArea 失败: {e} ⇒ 原生按钮不可用"),
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn enable_native_caption_buttons(_window: &tauri::WebviewWindow) {
    // macOS: tauri.conf titleBarStyle:Overlay 原生支持;Linux: 无对应 API。
}

/// 注入网页侧 CSS:隐藏 HTML 窗控按钮(与原生按钮重叠)。
///
/// 在 on_page_load Finished 时 eval 执行。每次页面导航都重新注入
/// (Next.js client-side navigation 会保留 head,但保险起见每次都注)。
pub const HIDE_HTML_WINDOW_CONTROLS_JS: &str = r#"
(function(){
  try {
    if (window.__ihuiHtmlControlsHidden) return;
    var s = document.createElement('style');
    s.textContent = '[data-window-controls]{display:none !important;}';
    document.head.appendChild(s);
    window.__ihuiHtmlControlsHidden = true;
  } catch(e) {}
})();
"#;
