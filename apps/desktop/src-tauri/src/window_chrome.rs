// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 原生窗控按钮:独立分层透明窗自绘(2026-10-18 定型)。
//!
//! ## 背景
//! main 窗 tauri.conf `decorations:false` 下,Windows 不画任何原生窗框,右上角
//! 最小化/最大化/关闭三个按钮全靠网页 `GlobalTopBar.tsx` 的 React 组件渲染。
//! 按钮门控 `useTauriIpcReady()` 轮询 `__TAURI_INTERNALS__` 注入(100~500ms),
//! 窗口亮了之后按钮还要等页面 JS/渲染才冒出来 —— 用户报"按钮跟壳一起出来,
//! 不要等渲染"。
//!
//! ## 为什么不用 DWM 原生按钮
//! 让 DWM 自己画标题栏按钮,必须先存在真实非客户区(NCCALCSIZE inset 顶部
//! 一条),真机实测那条就是标准标题栏(黑/白纯色、带窗口标题/图标,高 44
//! 物理 @133DPI)——用户明确拒绝任何额外条带。反过来"客户区铺满整窗 +
//! DwmExtendFrameIntoClientArea"的官方无条带形态,在 Win11 25H2 上 DWM 就
//! 是不画按钮(最小 Win32 原生程序同样复现,与 tao/WebView2 无关);
//! uxtheme 能画的只剩 Win7 Aero 旧样式。Chrome/Edge/Electron 也都是
//! Chromium views 自绘按钮,并非 DWM 绘制。
//!
//! ## 方案(与 Chromium 同款:自己画)
//! 创建一枚 WS_POPUP + WS_EX_LAYERED(per-pixel alpha)+ WS_EX_NOACTIVATE
//! + WS_EX_TOOLWINDOW 的透明宿主窗,owner 为主窗口,贴在主窗口右上角原
//! HTML 按钮位置;用 GDI+ 在 32bpp PARGB 位图上画系统自带 **Segoe Fluent
//! Icons** 字形(E921/E922/E923/E8BB,与系统标题栏同源字形),经
//! UpdateLayeredWindow 提交。宿主窗在 setup 阶段、网页加载之前就创建并
//! 显示,因此按钮随壳即刻出现,与网页渲染完全无关。
//!
//! - 主窗口 subclass 监听 WM_WINDOWPOSCHANGED(移动/缩放/最大化跟随)、
//!   WM_ACTIVATE(失焦灰态)、WM_SHOWWINDOW(随主窗显隐)、WM_DPICHANGED
//!   (跨 DPI 重建几何)。
//! - 点击:最小化/最大化发 WM_SYSCOMMAND(SC_MINIMIZE/SC_MAXIMIZE/SC_RESTORE);
//!   关闭发 WM_CLOSE,继续走 tao CloseRequested 拦截(询问弹窗/托盘)。
//! - 失败只 warn,不阻塞启动;原生按钮缺失时网页侧隐藏 CSS 不注入,
//!   HTML 按钮继续兜底。
//!
//! ## 平台
//! 仅 Windows。macOS 走 `titleBarStyle:Overlay`(tauri.conf 已配),Linux 无此 API。

#[cfg(target_os = "windows")]
use windows::core::{w, BOOL, PCWSTR};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{
    COLORREF, HINSTANCE, HMODULE, HWND, LPARAM, LRESULT, POINT, RECT, SIZE, WPARAM,
};
#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Gdi::{
    AC_SRC_ALPHA, AC_SRC_OVER, BI_RGB, BLENDFUNCTION, BITMAPINFO, BITMAPINFOHEADER,
    CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, DIB_RGB_COLORS,
    GetMonitorInfoW, GetDC, HGDIOBJ, MonitorFromWindow, MONITOR_DEFAULTTONEAREST, MONITORINFO,
    ReleaseDC, SelectObject, HBITMAP,
};
#[cfg(target_os = "windows")]
use windows::Win32::Graphics::GdiPlus::{
    GdipCreateBitmapFromScan0, GdipCreateFont, GdipCreateFontFamilyFromName,
    GdipCreateSolidFill, GdipCreateStringFormat, GdipDeleteBrush, GdipDeleteFont,
    GdipDeleteFontFamily, GdipDeleteGraphics, GdipDeleteStringFormat, GdipDisposeImage,
    GdipDrawString, GdipFillRectangle, GdipGetImageGraphicsContext, GdipGraphicsClear,
    GdipSetStringFormatAlign, GdipSetStringFormatLineAlign, GdipSetTextRenderingHint,
    GdiplusStartup, GdiplusStartupInput, RectF, StringAlignmentCenter, TextRenderingHintAntiAliasGridFit,
    UnitPixel, GpBitmap, GpBrush, GpFont, GpFontFamily, GpGraphics, GpImage, GpSolidFill,
    GpStringFormat, Status,
};

#[cfg(target_os = "windows")]
fn gdi_ok(s: Status) -> bool {
    s == Status(0)
}
#[cfg(target_os = "windows")]
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
#[cfg(target_os = "windows")]
use windows::Win32::UI::HiDpi::GetDpiForWindow;
#[cfg(target_os = "windows")]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    ReleaseCapture, SetCapture, TrackMouseEvent, TME_LEAVE, TRACKMOUSEEVENT,
};
#[cfg(target_os = "windows")]
use windows::Win32::UI::Shell::{DefSubclassProc, SetWindowSubclass};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, GetForegroundWindow, GetWindowLongPtrW, GetWindowRect,
    IsWindowVisible, IsZoomed, LoadCursorW, RegisterClassW, SendMessageW, SetForegroundWindow,
    SetWindowLongPtrW, SetWindowPos, ShowWindow, UpdateLayeredWindow, GWLP_USERDATA, IDC_ARROW,
    SC_MAXIMIZE, SC_MINIMIZE, SC_RESTORE, SW_HIDE, SW_SHOWNOACTIVATE,
    SWP_NOACTIVATE, SWP_NOSIZE, SWP_NOZORDER, ULW_ALPHA, WINDOW_EX_STYLE, WINDOW_STYLE,
    WNDCLASSW, WM_ACTIVATE, WM_CAPTURECHANGED, WM_CLOSE, WM_DESTROY, WM_DPICHANGED,
    WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MOUSEMOVE, WM_SETCURSOR, WM_SHOWWINDOW, WM_SYSCOMMAND,
    WM_WINDOWPOSCHANGED, WS_CLIPSIBLINGS, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    WS_POPUP,
};

// KeyboardAndMouse feature 下无 WM_MOUSELEAVE 常量,用数值(user32 固定值)。
#[cfg(target_os = "windows")]
const WM_MOUSELEAVE: u32 = 0x02A3;

#[cfg(target_os = "windows")]
const SUBCLASS_ID_BASE: usize = 0x4948_5543; // 'IHUC'

// Segoe Fluent Icons 标题栏字形(本机实测,2026-10-18)。
#[cfg(target_os = "windows")]
const GLYPH_MINIMIZE: u16 = 0xE921;
#[cfg(target_os = "windows")]
const GLYPH_MAXIMIZE: u16 = 0xE922; // 单方框
#[cfg(target_os = "windows")]
const GLYPH_RESTORE: u16 = 0xE923; // 双叠方框
#[cfg(target_os = "windows")]
const GLYPH_CLOSE: u16 = 0xE8BB;

// 100% DPI 基准几何(逻辑像素),与 Win11 系统标题栏一致:
// 单按钮 46×32,右侧圆角避让 7;字形 10px(实测 Chrome/系统标题栏
// 字形外接盒 10×10 @96DPI)。
#[cfg(target_os = "windows")]
const BASE_BTN_W: i32 = 46;
#[cfg(target_os = "windows")]
const BASE_BTN_H: i32 = 32;
#[cfg(target_os = "windows")]
const BASE_EDGE_GAP: i32 = 7;
#[cfg(target_os = "windows")]
const BASE_GLYPH_PX: i32 = 10;
// 顶部 Y 偏移(逻辑像素),把 32px 原生按钮的字形对回原 HTML 按钮的图标中心:
// apps/web GlobalTopBar 外层桌面端 pt-2=8,内层 h-9=36 的按钮行在 y=8..44;
// 14px 图标中心 y=26(实测物理像素与搜索/Plus/网格图标 cy=139.5 一致)。
// Segoe Fluent Icons 字形在 32px 盒内光学中心约在 14.5(非盒中心 16),故
// 偏移 = 26 - 14.5 ≈ 12(实测:偏移 10 时 max/close 字形 cy=137.5,差 2)。
// 最大化时窗口 rect.top=-8(8px 边框溢出),CSS 原点随之在 -8,同一公式仍成立。
#[cfg(target_os = "windows")]
const BASE_TOP_OFFSET: i32 = 12;

#[cfg(target_os = "windows")]
struct OverlayState {
    owner: HWND,
    btn_w: i32,
    btn_h: i32,
    total_w: i32,
    hover: i32,
    pressed: i32,
    tracking: bool,
    /// true=网页顶栏深色底(离线/壳占位页 #242424)→ 白字;
    /// false=线上浅色顶栏 → 深字。
    dark_bg: bool,
}

// 自定义消息(WM_APP+1):主题(深浅)变更,通知 overlay 重绘。
#[cfg(target_os = "windows")]
const WM_THEME_CHANGED: u32 = 0x8001;

#[cfg(target_os = "windows")]
struct Metrics {
    btn_w: i32,
    btn_h: i32,
    total_w: i32,
    edge_gap: i32,
    glyph_px: i32,
    top_offset: i32,
}

#[cfg(target_os = "windows")]
fn scale(base: i32, dpi: u32) -> i32 {
    ((base * dpi as i32) + 48) / 96
}

#[cfg(target_os = "windows")]
fn metrics_for(owner: HWND) -> Metrics {
    let dpi = unsafe { GetDpiForWindow(owner) }.max(96);
    let btn_w = scale(BASE_BTN_W, dpi);
    let btn_h = scale(BASE_BTN_H, dpi);
    let edge_gap = scale(BASE_EDGE_GAP, dpi);
    let glyph_px = scale(BASE_GLYPH_PX, dpi);
    let top_offset = scale(BASE_TOP_OFFSET, dpi);
    Metrics {
        btn_w,
        btn_h,
        total_w: btn_w * 3,
        edge_gap,
        glyph_px,
        top_offset,
    }
}

/// tauri::Window(on_window_event 给的)与 tauri::WebviewWindow(setup 里拿的)
/// 都有 label/hwnd/is_maximized,用同一套适配抽象掉,避免公开函数写两份。
#[cfg(target_os = "windows")]
pub(crate) trait CaptionWindowOps {
    fn cap_label(&self) -> &str;
    fn cap_hwnd(&self) -> Option<HWND>;
    fn cap_is_maximized(&self) -> bool;
}

#[cfg(target_os = "windows")]
macro_rules! impl_caption_window_ops {
    ($($t:ty),+ $(,)?) => {$(
        impl CaptionWindowOps for $t {
            fn cap_label(&self) -> &str { self.label() }
            fn cap_hwnd(&self) -> Option<HWND> {
                match self.hwnd() {
                    Ok(h) => Some(HWND(h.0)),
                    Err(e) => {
                        log::warn!("[window-chrome] 获取 HWND 失败: {e} ⇒ 原生窗控按钮跳过");
                        None
                    }
                }
            }
            fn cap_is_maximized(&self) -> bool { self.is_maximized().unwrap_or(false) }
        }
    )+}
}

#[cfg(target_os = "windows")]
impl_caption_window_ops!(tauri::WebviewWindow, tauri::Window);

#[cfg(target_os = "windows")]
pub fn enable_native_caption_buttons<W: CaptionWindowOps>(window: &W) {
    let label = window.cap_label().to_string();
    let Some(owner) = window.cap_hwnd() else {
        active_slot(&label).store(false, std::sync::atomic::Ordering::Relaxed);
        return;
    };

    if ensure_gdiplus().is_err() {
        log::warn!("[window-chrome] GDI+ 初始化失败 ⇒ 原生窗控按钮跳过,保留 HTML 按钮兜底");
        active_slot(&label).store(false, std::sync::atomic::Ordering::Relaxed);
        return;
    }

    let dark_bg = theme_slot(&label).load(std::sync::atomic::Ordering::Relaxed);
    let overlay = unsafe { create_overlay(owner, dark_bg) };
    let Some(overlay) = overlay else {
        active_slot(&label).store(false, std::sync::atomic::Ordering::Relaxed);
        return;
    };
    overlay_slot(&label)
        .store(overlay.0 as isize, std::sync::atomic::Ordering::Relaxed);

    // 主窗口 subclass:移动/激活/显隐/DPI 变化时同步宿主。
    let id = if label == "admin" {
        SUBCLASS_ID_BASE + 2
    } else {
        SUBCLASS_ID_BASE + 1
    };
    let ok_subclass = unsafe {
        SetWindowSubclass(
            owner,
            Some(owner_subclass_proc),
            id,
            overlay.0 as usize,
        )
    };
    log::debug!("[window-chrome] SetWindowSubclass owner={owner:?} id={id} overlay={overlay:?} ok={}", ok_subclass.as_bool());
    if !ok_subclass.as_bool() {
        log::warn!("[window-chrome] SetWindowSubclass 失败 ⇒ 原生窗控按钮不可用,保留 HTML 按钮兜底");
        active_slot(&label).store(false, std::sync::atomic::Ordering::Relaxed);
        return;
    }

    unsafe {
        sync_overlay(overlay, true);
        if IsWindowVisible(owner).as_bool() {
            let _ = ShowWindow(overlay, SW_SHOWNOACTIVATE);
        }
    }
    active_slot(&label).store(true, std::sync::atomic::Ordering::Relaxed);
    maximized_slot(&label)
        .store(window.cap_is_maximized(), std::sync::atomic::Ordering::Relaxed);
    log::info!("[window-chrome] 原生窗控按钮已启用(分层透明窗自绘 Segoe Fluent Icons)");
}

/// 原生窗控是否已确认可用(决定网页侧 HTML 按钮要不要隐藏)。
#[cfg(target_os = "windows")]
pub fn native_controls_active(label: &str) -> bool {
    active_slot(label).load(std::sync::atomic::Ordering::Relaxed)
}

#[cfg(not(target_os = "windows"))]
pub fn native_controls_active(_label: &str) -> bool {
    false
}

/// 几何/最大化态变化后重定位并重绘(供 tauri 事件兜底,subclass 已实时处理大部分)。
#[cfg(target_os = "windows")]
pub fn refresh_native_caption_buttons<W: CaptionWindowOps>(window: &W) {
    let raw = overlay_slot(window.cap_label())
        .load(std::sync::atomic::Ordering::Relaxed);
    if raw != 0 && window.cap_hwnd().is_some() {
        unsafe { sync_overlay(HWND(raw as *mut core::ffi::c_void), true) };
    }
}

/// Resized 事件入口:最大化态翻转才重绘(翻转字形 最大化↔还原)。
#[cfg(target_os = "windows")]
pub fn refresh_on_maximize_toggle<W: CaptionWindowOps>(window: &W) {
    let label = window.cap_label().to_string();
    let now = window.cap_is_maximized();
    let slot = maximized_slot(&label);
    if slot.swap(now, std::sync::atomic::Ordering::Relaxed) != now {
        let raw = overlay_slot(&label)
            .load(std::sync::atomic::Ordering::Relaxed);
        if raw != 0 {
            unsafe { sync_overlay(HWND(raw as *mut core::ffi::c_void), true) };
        }
    }
}

#[cfg(target_os = "windows")]
fn maximized_slot(label: &str) -> &'static std::sync::atomic::AtomicBool {
    static MAIN: std::sync::OnceLock<std::sync::atomic::AtomicBool> = std::sync::OnceLock::new();
    static ADMIN: std::sync::OnceLock<std::sync::atomic::AtomicBool> = std::sync::OnceLock::new();
    match label {
        "admin" => ADMIN.get_or_init(|| std::sync::atomic::AtomicBool::new(false)),
        _ => MAIN.get_or_init(|| std::sync::atomic::AtomicBool::new(false)),
    }
}

#[cfg(target_os = "windows")]
fn active_slot(label: &str) -> &'static std::sync::atomic::AtomicBool {
    static MAIN: std::sync::OnceLock<std::sync::atomic::AtomicBool> = std::sync::OnceLock::new();
    static ADMIN: std::sync::OnceLock<std::sync::atomic::AtomicBool> = std::sync::OnceLock::new();
    match label {
        "admin" => ADMIN.get_or_init(|| std::sync::atomic::AtomicBool::new(false)),
        _ => MAIN.get_or_init(|| std::sync::atomic::AtomicBool::new(false)),
    }
}

#[cfg(target_os = "windows")]
fn overlay_slot(label: &str) -> &'static std::sync::atomic::AtomicIsize {
    static MAIN: std::sync::OnceLock<std::sync::atomic::AtomicIsize> = std::sync::OnceLock::new();
    static ADMIN: std::sync::OnceLock<std::sync::atomic::AtomicIsize> = std::sync::OnceLock::new();
    match label {
        "admin" => ADMIN.get_or_init(|| std::sync::atomic::AtomicIsize::new(0)),
        _ => MAIN.get_or_init(|| std::sync::atomic::AtomicIsize::new(0)),
    }
}

#[cfg(target_os = "windows")]
fn theme_slot(label: &str) -> &'static std::sync::atomic::AtomicBool {
    static MAIN: std::sync::OnceLock<std::sync::atomic::AtomicBool> = std::sync::OnceLock::new();
    static ADMIN: std::sync::OnceLock<std::sync::atomic::AtomicBool> = std::sync::OnceLock::new();
    match label {
        "admin" => ADMIN.get_or_init(|| std::sync::atomic::AtomicBool::new(false)),
        _ => MAIN.get_or_init(|| std::sync::atomic::AtomicBool::new(false)),
    }
}

/// 按加载 URL 判定顶栏深浅:离线兜底页 / 壳占位页为深色底(#242424),
/// 线上 https://aizhs.top 为浅色顶栏。
#[cfg(target_os = "windows")]
pub fn theme_is_dark_for_url(url: &str) -> bool {
    let u = url.to_ascii_lowercase();
    u.contains("offline.localhost") || u.starts_with("tauri://") || u.contains("tauri.localhost")
}

/// 设置按钮深浅主题并触发重绘(主线程或 Tauri command 均可调用)。
#[cfg(target_os = "windows")]
pub fn set_caption_theme(label: &str, dark_bg: bool) {
    theme_slot(label).store(dark_bg, std::sync::atomic::Ordering::Relaxed);
    let raw = overlay_slot(label).load(std::sync::atomic::Ordering::Relaxed);
    if raw != 0 {
        let hwnd = HWND(raw as *mut core::ffi::c_void);
        unsafe {
            let _ = windows::Win32::UI::WindowsAndMessaging::PostMessageW(
                Some(hwnd),
                WM_THEME_CHANGED,
                WPARAM(dark_bg as usize),
                LPARAM(0),
            );
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub fn theme_is_dark_for_url(_url: &str) -> bool {
    false
}

#[cfg(not(target_os = "windows"))]
pub fn set_caption_theme(_label: &str, _dark_bg: bool) {}

/// GDI+ 进程级一次性初始化。
#[cfg(target_os = "windows")]
fn ensure_gdiplus() -> Result<(), String> {
    static TOKEN: std::sync::OnceLock<Result<usize, String>> = std::sync::OnceLock::new();
    TOKEN
        .get_or_init(|| unsafe {
            let mut token: usize = 0;
            let input = GdiplusStartupInput {
                GdiplusVersion: 1,
                DebugEventCallback: 0,
                SuppressBackgroundThread: BOOL(0),
                SuppressExternalCodecs: BOOL(0),
            };
            let status = GdiplusStartup(&mut token, &input, std::ptr::null_mut());
            if status == windows::Win32::Graphics::GdiPlus::Status(0) {
                Ok(token)
            } else {
                Err(format!("GdiplusStartup status={:?}", status))
            }
        })
        .as_ref()
        .map(|_| ())
        .map_err(|e| e.clone())
}

/// 注册宿主窗类(幂等)。
#[cfg(target_os = "windows")]
fn ensure_overlay_class() -> bool {
    static REGISTERED: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *REGISTERED.get_or_init(|| unsafe {
        let module = GetModuleHandleW(None).unwrap_or(HMODULE::default());
        let cursor = LoadCursorW(None, IDC_ARROW).unwrap_or_default();
        let class = WNDCLASSW {
            style: windows::Win32::UI::WindowsAndMessaging::WNDCLASS_STYLES(
                windows::Win32::UI::WindowsAndMessaging::CS_HREDRAW.0
                    | windows::Win32::UI::WindowsAndMessaging::CS_VREDRAW.0,
            ),
            lpfnWndProc: Some(overlay_wnd_proc),
            hInstance: HINSTANCE(module.0),
            hCursor: cursor,
            lpszClassName: w!("IhuiCaptionOverlay"),
            ..Default::default()
        };
        let atom = RegisterClassW(&class);
        if atom == 0 {
            log::warn!("[window-chrome] RegisterClassW 失败: {:?}", windows::Win32::Foundation::WIN32_ERROR(0));
            false
        } else {
            true
        }
    })
}

/// 创建分层透明宿主窗(初始定位,由主窗 WM_SHOWWINDOW 显示)。
#[cfg(target_os = "windows")]
unsafe fn create_overlay(owner: HWND, dark_bg: bool) -> Option<HWND> {
    if !ensure_overlay_class() {
        return None;
    }
    let m = metrics_for(owner);
    let ex = WINDOW_EX_STYLE(WS_EX_LAYERED.0 | WS_EX_TOOLWINDOW.0 | WS_EX_NOACTIVATE.0);
    let style = WINDOW_STYLE(WS_POPUP.0 | WS_CLIPSIBLINGS.0);
    let module = GetModuleHandleW(None).ok()?;
    let overlay = CreateWindowExW(
        ex,
        w!("IhuiCaptionOverlay"),
        w!(""),
        style,
        0,
        0,
        m.total_w,
        m.btn_h,
        Some(owner),
        None,
        Some(HINSTANCE(module.0)),
        None,
    )
    .map_err(|e| log::warn!("[window-chrome] CreateWindowExW 失败: {e}"))
    .ok()?;

    let state = Box::new(OverlayState {
        owner,
        btn_w: m.btn_w,
        btn_h: m.btn_h,
        total_w: m.total_w,
        hover: -1,
        pressed: -1,
        tracking: false,
        dark_bg,
    });
    SetWindowLongPtrW(overlay, GWLP_USERDATA, Box::into_raw(state) as isize);
    Some(overlay)
}

/// 重定位(必要时改尺寸)+ 重绘。
#[cfg(target_os = "windows")]
unsafe fn sync_overlay(overlay: HWND, resize: bool) {
    let state_ptr = GetWindowLongPtrW(overlay, GWLP_USERDATA) as *mut OverlayState;
    if state_ptr.is_null() {
        return;
    }
    let state = &mut *state_ptr;
    let owner = state.owner;
    let m = metrics_for(owner);
    state.btn_w = m.btn_w;
    state.btn_h = m.btn_h;
    state.total_w = m.total_w;

    let mut rect = RECT::default();
    if GetWindowRect(owner, &mut rect).is_err() {
        log::warn!("[window-chrome] sync_overlay GetWindowRect 失败");
        return;
    }
    let maximized = IsZoomed(owner).as_bool();
    let gap = if maximized { 0 } else { m.edge_gap };
    let x = rect.right - m.total_w - gap;
    // 对回原 HTML 按钮行,见 BASE_TOP_OFFSET。注意最大化时窗口 rect 会向上溢出一个
    // resize 边框(实测 rect.top=-8 物理 @96DPI),但 webview 可见内容从显示器顶边
    // rcMonitor.top 起算(实测最大化时 HTML 图标 cy=26,即可见顶边 +26);还原态
    // rect.top 即可见顶边。故 y 基准取"可见顶边",最大化用显示器顶边。
    let visible_top = if maximized {
        let mut mi = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            rcMonitor: RECT::default(),
            rcWork: RECT::default(),
            dwFlags: Default::default(),
        };
        let hmon = MonitorFromWindow(owner, MONITOR_DEFAULTTONEAREST);
        if GetMonitorInfoW(hmon, &mut mi).as_bool() {
            mi.rcMonitor.top
        } else {
            rect.top
        }
    } else {
        rect.top
    };
    let y = visible_top + m.top_offset;

    let flags = SWP_NOACTIVATE | SWP_NOZORDER;
    let flags = if resize {
        flags
    } else {
        flags | SWP_NOSIZE
    };
    let pos_result = SetWindowPos(
        overlay,
        None,
        x,
        y,
        if resize { m.total_w } else { 0 },
        if resize { m.btn_h } else { 0 },
        flags,
    );
    let _ = pos_result;
    render_overlay(overlay);
}

#[cfg(target_os = "windows")]
unsafe fn state_of(hwnd: HWND) -> Option<*mut OverlayState> {
    let p = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *mut OverlayState;
    if p.is_null() { None } else { Some(p) }
}

#[cfg(target_os = "windows")]
unsafe fn render_overlay(overlay: HWND) {
    let Some(state_ptr) = state_of(overlay) else {
        return;
    };
    let state = &*state_ptr;
    let owner = state.owner;
    let m = metrics_for(owner);
    let w = m.total_w;
    let h = m.btn_h;
    if w <= 0 || h <= 0 {
        return;
    }

    let screen_dc = GetDC(None);
    let mem_dc = CreateCompatibleDC(Some(screen_dc));
    if mem_dc.is_invalid() {
        let _ = ReleaseDC(None, screen_dc);
        return;
    }

    // 32bpp 自顶向下 DIB。
    let mut bmi = BITMAPINFO::default();
    bmi.bmiHeader = BITMAPINFOHEADER {
        biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
        biWidth: w,
        biHeight: -h,
        biPlanes: 1,
        biBitCount: 32,
        biCompression: BI_RGB.0,
        ..Default::default()
    };
    let mut bits: *mut core::ffi::c_void = std::ptr::null_mut();
    let hbm: HBITMAP = match CreateDIBSection(
        Some(mem_dc),
        &bmi,
        DIB_RGB_COLORS,
        &mut bits,
        None,
        0,
    ) {
        Ok(b) => b,
        Err(_) => {
            let _ = DeleteDC(mem_dc);
            let _ = ReleaseDC(None, screen_dc);
            return;
        }
    };
    if bits.is_null() {
        let _ = DeleteObject(HGDIOBJ(hbm.0));
        let _ = DeleteDC(mem_dc);
        let _ = ReleaseDC(None, screen_dc);
        return;
    }
    let old_obj = SelectObject(mem_dc, HGDIOBJ(hbm.0));

    // GDI+ 画到同一块 PARGB 内存。
    let pixel_format_pargb: i32 = 0x0026_200A;
    let mut bitmap: *mut GpBitmap = std::ptr::null_mut();
    let mut graphics: *mut GpGraphics = std::ptr::null_mut();
    let mut family: *mut GpFontFamily = std::ptr::null_mut();
    let mut font: *mut GpFont = std::ptr::null_mut();
    let mut format: *mut GpStringFormat = std::ptr::null_mut();
    let mut brush: *mut GpSolidFill = std::ptr::null_mut();

    if gdi_ok(GdipCreateBitmapFromScan0(
        w,
        h,
        w * 4,
        pixel_format_pargb,
        Some(bits as *const u8),
        &mut bitmap,
    )) {
        if gdi_ok(GdipGetImageGraphicsContext(bitmap as *mut GpImage, &mut graphics)) {
            let _ = GdipSetTextRenderingHint(graphics, TextRenderingHintAntiAliasGridFit);
            let _ = GdipGraphicsClear(graphics, 0); // 全透明

            if gdi_ok(GdipCreateFontFamilyFromName(
                w!("Segoe Fluent Icons"),
                std::ptr::null_mut(),
                &mut family,
            )) && gdi_ok(GdipCreateFont(family, m.glyph_px as f32, 0, UnitPixel, &mut font))
                && gdi_ok(GdipCreateStringFormat(0, 0, &mut format))
            {
                let _ = GdipSetStringFormatAlign(format, StringAlignmentCenter);
                let _ = GdipSetStringFormatLineAlign(format, StringAlignmentCenter);
            }

            let active = GetForegroundWindow() == owner;
            let maximized = IsZoomed(owner).as_bool();

            for i in 0..3i32 {
                let x = i * m.btn_w;
                let is_close = i == 2;
                let hovered = state.hover == i;
                let pressed = state.pressed == i;

                // 背景态。注意:UpdateLayeredWindow 下全透明像素会被
                // WindowFromPoint 视为穿透(点击落到下方网页),所以每个按钮
                // 矩形必须至少有 1/255 alpha 保证整块 46×32 都可命中;
                // 1/255 肉眼不可见。
                let bg = if is_close && (hovered || pressed) {
                    if pressed {
                        0xDC_C42B1C_u32
                    } else {
                        0xFF_C42B1C_u32
                    }
                } else if pressed {
                    if state.dark_bg {
                        0x23_FF_FF_FF_u32
                    } else {
                        0x1A_000000_u32
                    }
                } else if hovered {
                    if state.dark_bg {
                        0x1A_FF_FF_FF_u32
                    } else {
                        0x0D_000000_u32
                    }
                } else {
                    // 1/255 填充:肉眼不可见,但保证整块 46×32 可命中。
                    if state.dark_bg {
                        0x01_FF_FF_FF_u32
                    } else {
                        0x01_000000_u32
                    }
                };
                let mut bg_brush: *mut GpSolidFill = std::ptr::null_mut();
                if gdi_ok(GdipCreateSolidFill(bg, &mut bg_brush)) {
                    let _ = GdipFillRectangle(
                        graphics,
                        bg_brush as *mut GpBrush,
                        x as f32,
                        0.0,
                        m.btn_w as f32,
                        m.btn_h as f32,
                    );
                    let _ = GdipDeleteBrush(bg_brush as *mut GpBrush);
                }

                // 字形。
                let glyph = match i {
                    0 => GLYPH_MINIMIZE,
                    1 if maximized => GLYPH_RESTORE,
                    1 => GLYPH_MAXIMIZE,
                    _ => GLYPH_CLOSE,
                };
                let glyph_color = if is_close && (hovered || pressed) {
                    0xFF_FF_FF_FF_u32
                } else if state.dark_bg {
                    if active {
                        0xFF_FF_FF_FF_u32
                    } else {
                        0x99_FF_FF_FF_u32
                    }
                } else if active {
                    0xD9_00_00_00_u32
                } else {
                    0x66_00_00_00_u32
                };
                if !font.is_null()
                    && !format.is_null()
                    && gdi_ok(GdipCreateSolidFill(glyph_color, &mut brush))
                {
                    let mut buf = [glyph, 0];
                    let text = PCWSTR(buf.as_mut_ptr());
                    let rect = RectF {
                        X: x as f32,
                        Y: 0.0,
                        Width: m.btn_w as f32,
                        Height: m.btn_h as f32,
                    };
                    let _ = GdipDrawString(graphics, text, -1, font, &rect, format, brush as *mut GpBrush);
                    let _ = GdipDeleteBrush(brush as *mut GpBrush);
                    brush = std::ptr::null_mut();
                }
            }
        }
    }

    if !graphics.is_null() {
        let _ = GdipDeleteGraphics(graphics);
    }
    if !bitmap.is_null() {
        let _ = GdipDisposeImage(bitmap as *mut GpImage);
    }
    if !format.is_null() {
        let _ = GdipDeleteStringFormat(format);
    }
    if !font.is_null() {
        let _ = GdipDeleteFont(font);
    }
    if !family.is_null() {
        let _ = GdipDeleteFontFamily(family);
    }

    // 预乘 alpha(实测 2026-10-18):GDI+ 对外部 scan0 的 PARGB 位图**不做**
    // 预乘(低 alpha 白色仍写 RGB=255,A=1);UpdateLayeredWindow(AC_SRC_ALPHA)
    // 按预乘值合成,会把它当不透明白块。黑色因为预乘后仍是 0 掩盖了这个问题。
    // 提交前统一把 BGRA 逐像素预乘,保证深浅两套配色都正确。
    {
        let total = (w * h) as usize;
        let base = bits as *mut u8;
        let premul = |c: u8, a: u8| ((c as u32 * a as u32 + 127) / 255) as u8;
        for n in 0..total {
            let p = base.add(n * 4);
            let a = *p.add(3);
            *p = premul(*p, a);
            *p.add(1) = premul(*p.add(1), a);
            *p.add(2) = premul(*p.add(2), a);
        }
    }

    // 提交分层窗。注意:UpdateLayeredWindow 的 pptDst/psize 非空时会**重设**
    // 窗口位置与尺寸(每次渲染都重置),所以这里必须读 SetWindowPos 之后的
    // 真实窗口矩形回传,而不是写死 (0,0)。
    let mut win_rect = RECT::default();
    let _ = GetWindowRect(overlay, &mut win_rect);
    let dst = POINT {
        x: win_rect.left,
        y: win_rect.top,
    };
    let size = SIZE { cx: w, cy: h };
    let src = POINT { x: 0, y: 0 };
    let blend = BLENDFUNCTION {
        BlendOp: AC_SRC_OVER as u8,
        BlendFlags: 0,
        SourceConstantAlpha: 255,
        AlphaFormat: AC_SRC_ALPHA as u8,
    };
    let _ = UpdateLayeredWindow(
        overlay,
        Some(screen_dc),
        Some(&dst as *const POINT),
        Some(&size as *const SIZE),
        Some(mem_dc),
        Some(&src as *const POINT),
        COLORREF(0),
        Some(&blend as *const BLENDFUNCTION),
        ULW_ALPHA,
    );

    let _ = SelectObject(mem_dc, old_obj);
    let _ = DeleteObject(HGDIOBJ(hbm.0));
    let _ = DeleteDC(mem_dc);
    let _ = ReleaseDC(None, screen_dc);
}

/// 主窗口 subclass:同步宿主的位置、显隐、激活态、DPI。
#[cfg(target_os = "windows")]
unsafe extern "system" fn owner_subclass_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    ref_data: usize,
) -> LRESULT {
    let result = DefSubclassProc(hwnd, msg, wparam, lparam);
    if ref_data != 0 {
        let overlay = HWND(ref_data as *mut core::ffi::c_void);
        match msg {
            WM_WINDOWPOSCHANGED => sync_overlay(overlay, false),
            WM_ACTIVATE => render_overlay(overlay),
            WM_DPICHANGED => sync_overlay(overlay, true),
            WM_SHOWWINDOW => {
                if wparam.0 != 0 {
                    let _ = ShowWindow(overlay, SW_SHOWNOACTIVATE);
                    sync_overlay(overlay, true);
                } else {
                    let _ = ShowWindow(overlay, SW_HIDE);
                }
            }
            _ => {}
        }
    }
    result
}

#[cfg(target_os = "windows")]
unsafe fn hit_test(state: &OverlayState, x: i32, y: i32) -> i32 {
    if y < 0 || y >= state.btn_h || x < 0 || x >= state.total_w {
        return -1;
    }
    let i = x / state.btn_w;
    if (0..3).contains(&i) {
        i
    } else {
        -1
    }
}

#[cfg(target_os = "windows")]
unsafe fn request_hover_tracking(hwnd: HWND, state: &mut OverlayState) {
    if state.tracking {
        return;
    }
    let mut tme = TRACKMOUSEEVENT {
        cbSize: std::mem::size_of::<TRACKMOUSEEVENT>() as u32,
        dwFlags: TME_LEAVE,
        hwndTrack: hwnd,
        dwHoverTime: 0,
    };
    if TrackMouseEvent(&mut tme).is_ok() {
        state.tracking = true;
    }
}

#[cfg(target_os = "windows")]
unsafe fn invoke_button(owner: HWND, index: i32) {
    match index {
        0 => {
            let _ = SendMessageW(
                owner,
                WM_SYSCOMMAND,
                Some(WPARAM(SC_MINIMIZE as usize)),
                Some(LPARAM(0)),
            );
        }
        1 => {
            let cmd = if IsZoomed(owner).as_bool() {
                SC_RESTORE
            } else {
                SC_MAXIMIZE
            };
            let _ = SendMessageW(
                owner,
                WM_SYSCOMMAND,
                Some(WPARAM(cmd as usize)),
                Some(LPARAM(0)),
            );
        }
        2 => {
            // 与原生标题栏一致:点关闭前把主窗带到前台,tao 的 CloseRequested
            // 拦截(询问弹窗/托盘)仍由 WM_CLOSE 触发。
            let _ = SetForegroundWindow(owner);
            let _ = windows::Win32::UI::WindowsAndMessaging::PostMessageW(
                Some(owner),
                WM_CLOSE,
                WPARAM(0),
                LPARAM(0),
            );
        }
        _ => {}
    }
}

/// 宿主窗消息处理:仅负责 hover/按下/点击绘制与命中。
#[cfg(target_os = "windows")]
unsafe extern "system" fn overlay_wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    let Some(state_ptr) = state_of(hwnd) else {
        return DefWindowProcW(hwnd, msg, wparam, lparam);
    };
    let state = &mut *state_ptr;

    match msg {
        WM_MOUSEMOVE => {
            let x = (lparam.0 & 0xFFFF) as i16 as i32;
            let y = ((lparam.0 >> 16) & 0xFFFF) as i16 as i32;
            let idx = hit_test(state, x, y);
            request_hover_tracking(hwnd, state);
            if idx != state.hover {
                state.hover = idx;
                render_overlay(hwnd);
            }
            return LRESULT(0);
        }
        WM_LBUTTONDOWN => {
            let x = (lparam.0 & 0xFFFF) as i16 as i32;
            let y = ((lparam.0 >> 16) & 0xFFFF) as i16 as i32;
            let idx = hit_test(state, x, y);
            if idx >= 0 {
                let _ = SetForegroundWindow(state.owner);
                let _ = SetCapture(hwnd);
                state.pressed = idx;
                render_overlay(hwnd);
            }
            return LRESULT(0);
        }
        WM_LBUTTONUP => {
            let x = (lparam.0 & 0xFFFF) as i16 as i32;
            let y = ((lparam.0 >> 16) & 0xFFFF) as i16 as i32;
            let idx = hit_test(state, x, y);
            let fired = state.pressed;
            if state.pressed >= 0 {
                let _ = ReleaseCapture();
                state.pressed = -1;
            }
            if fired >= 0 && idx == fired {
                state.hover = -1;
                invoke_button(state.owner, fired);
            }
            render_overlay(hwnd);
            return LRESULT(0);
        }
        WM_MOUSELEAVE => {
            state.tracking = false;
            state.hover = -1;
            state.pressed = -1;
            render_overlay(hwnd);
            return LRESULT(0);
        }
        WM_CAPTURECHANGED => {
            state.pressed = -1;
            render_overlay(hwnd);
            return LRESULT(0);
        }
        WM_THEME_CHANGED => {
            state.dark_bg = wparam.0 != 0;
            state.hover = -1;
            state.pressed = -1;
            render_overlay(hwnd);
            return LRESULT(0);
        }
        WM_SETCURSOR => {
            // 鼠标在按钮区域保持箭头(默认即箭头)。
            return DefWindowProcW(hwnd, msg, wparam, lparam);
        }
        WM_DESTROY => {
            let _ = SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
            drop(Box::from_raw(state_ptr));
            return LRESULT(0);
        }
        _ => {}
    }
    DefWindowProcW(hwnd, msg, wparam, lparam)
}

#[cfg(not(target_os = "windows"))]
pub fn enable_native_caption_buttons<W>(_window: &W) {
    // macOS: tauri.conf titleBarStyle:Overlay 原生支持;Linux: 无对应 API。
}

#[cfg(not(target_os = "windows"))]
pub fn refresh_native_caption_buttons<W>(_window: &W) {}

#[cfg(not(target_os = "windows"))]
pub fn refresh_on_maximize_toggle<W>(_window: &W) {}

/// 注入网页侧 CSS:隐藏 HTML 窗控按钮(与原生按钮重叠)。
///
/// 在 on_page_load Finished 时 eval 执行(仅当 Rust 侧确认原生按钮已启用)。
/// 用 `visibility:hidden` 而非 `display:none`:容器保留占位,标签栏/搜索框不会
/// 滑到原生按钮下方被盖住。min-width 138px = Win11 三按钮总宽(46×3 逻辑像素,
/// 原生宿主按 DPI 缩放,CSS 侧恒为 138);pointer-events:none 双保险。
/// 每次导航都重注(幂等,靠 __ihuiHtmlControlsHidden 去重)。
pub const HIDE_HTML_WINDOW_CONTROLS_JS: &str = r#"
(function(){
  try {
    if (window.__ihuiHtmlControlsHidden) return;
    var s = document.createElement('style');
    s.textContent = '[data-window-controls]{visibility:hidden !important;min-width:138px !important;pointer-events:none !important;}';
    document.head.appendChild(s);
    window.__ihuiHtmlControlsHidden = true;
  } catch(e) {}
})();
"#;
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
