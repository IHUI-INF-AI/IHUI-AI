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
//! ## 几何:唯一真相源是网页设计要求,不是 Win11 系统标题栏(2026-10-26 订正)
//! 原生自绘只是"把网页那套按钮提前画出来",**不是另立一套皮肤**。故尺寸/圆角/
//! 边距必须与 `GlobalTopBar` 的 `[data-window-controls]` 逐项等值:
//! 单钮 36×36、圆角 6px、钮间 2px、容器 112、右避让 8、顶偏移 8。
//! 旧口径抄的是系统标题栏(46×32 直角、右避让 7、最大化贴角 0),用户实拍
//! "长方形没圆角 + 关闭按钮贴右边"就是两套规格打架的表现。改动这几项数值时,
//! 必须同步核对 `apps/web/src/components/layout/GlobalTopBar.tsx` 与
//! `apps/web/e2e/desktop-window-controls-dim.spec.ts`。
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
    GetDC, GetPixel, HGDIOBJ, HDC, ReleaseDC, SelectObject, HBITMAP,
    // 【windows crate 归组坑,实测 E0432】`ClientToScreen` 挂在 `Graphics::Gdi`,
    // 而 `GetClientRect` 才在 `WindowsAndMessaging` —— 同一个 Win32 API 家族被 metadata
    // 拆到两处,一起写进 WindowsAndMessaging 就编不过。
    ClientToScreen,
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
    CreateWindowExW, DefWindowProcW, GetClientRect, GetForegroundWindow, GetWindowLongPtrW,
    GetWindowRect, IsWindowVisible, IsZoomed, KillTimer, LoadCursorW, RegisterClassW, SendMessageW,
    SetForegroundWindow, SetTimer,
    SetWindowLongPtrW, SetWindowPos, ShowWindow, UpdateLayeredWindow, GWLP_USERDATA, IDC_ARROW,
    SC_MAXIMIZE, SC_MINIMIZE, SC_RESTORE, SW_HIDE, SW_SHOWNOACTIVATE,
    SWP_NOACTIVATE, SWP_NOSIZE, SWP_NOZORDER, ULW_ALPHA, WINDOW_EX_STYLE, WINDOW_STYLE,
    WNDCLASSW, WM_ACTIVATE, WM_CAPTURECHANGED, WM_CLOSE, WM_DESTROY, WM_DPICHANGED,
    WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MOUSEMOVE, WM_SETCURSOR, WM_SHOWWINDOW, WM_SYSCOMMAND,
    WM_TIMER, WM_WINDOWPOSCHANGED, WS_CLIPSIBLINGS, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
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

// 100% DPI 基准几何(逻辑像素)。
//
// 【2026-10-26 订正:对齐项目设计要求,不再照抄 Win11 系统标题栏】
// 设计要求的唯一真相源 = 网页侧 `apps/web/src/components/layout/GlobalTopBar.tsx`
// 的 `[data-window-controls]`(窗口按钮容器的原始设计,守门 e2e
// `apps/web/e2e/desktop-window-controls-dim.spec.ts` 也按它断言):
//   · 单钮 36×36 正方形  ← `TOPBAR_BTN_BASE` h-full + `TOPBAR_BTN_W9` w-9,内层行 h-9=36
//   · 圆角 6px          ← `rounded-md`
//   · 钮间 2px          ← 容器 `gap-0.5`
//   · 容器总宽 112      ← 36×3 + 2×2(与 HTML 实测 getBoundingClientRect 112 逐字一致)
//   · 右避让 8px        ← 顶栏外层 `pr-2`,**最大化时同样 8px**(CSS padding 不随最大化消失)
//   · 顶偏移 8px        ← 顶栏外层 `pt-2`,按钮行占 y=8..44
// 此前这套原生参数写的是 Win11 系统标题栏口径(46×32 长方形、直角、右避让 7、
// 最大化归 0 贴角),与网页自绘设计要求是两套规格,用户实拍"长方形没圆角 + 关闭
// 按钮贴右边"即由此而来。原生自绘保留(用户要求按钮随壳即时出现、不等网页渲染),
// 但几何/圆角/边距必须与 HTML 设计规格逐项等值。
#[cfg(target_os = "windows")]
const BASE_BTN_W: i32 = 36;
#[cfg(target_os = "windows")]
const BASE_BTN_H: i32 = 36;
/// 钮间距(HTML `gap-0.5` = 2px)。该列在绘制上留空,但保持 1/255 alpha 以可命中。
#[cfg(target_os = "windows")]
const BASE_BTN_GAP: i32 = 2;
/// 容器右缘到窗口右缘(HTML 顶栏 `pr-2` = 8px)。**最大化态不归零**:
/// 网页侧 pr-2 在最大化时依然生效,归零会让原生按钮比 HTML 多贴 8px(用户可见跳变)。
#[cfg(target_os = "windows")]
const BASE_EDGE_GAP: i32 = 8;
/// 圆角半径(HTML `rounded-md` = 6px)。
#[cfg(target_os = "windows")]
const BASE_RADIUS: i32 = 6;
#[cfg(target_os = "windows")]
const BASE_GLYPH_PX: i32 = 10;
// 顶部 Y 偏移(逻辑像素)= 顶栏外层 pt-2。36px 盒顶落在 y=8,与 HTML 按钮盒
// (y=8..44)严格重合,故偏移直接取 8(旧口径 32px 盒要用 12 才能把字形顶到 y=26,
// 那是"盒矮一截、靠偏移凑中心"的补丁,盒高对齐后不再需要)。
#[cfg(target_os = "windows")]
const BASE_TOP_OFFSET: i32 = 8;
// 字形光学居中微调(逻辑像素):Segoe Fluent Icons 的 ink 在行盒内偏上约 1.5px
// (旧实现实测 32px 盒内 ink 中心 14.5 而非 16)。36px 盒内行盒中心 18 ⇒ ink 16.5,
// 下移 1.5 后 ink 中心 = 18 ⇒ 绝对 y = 8 + 18 = 26,与 HTML 14px 图标中心 26 重合。
#[cfg(target_os = "windows")]
const BASE_GLYPH_NUDGE_Y: f32 = 1.5;

#[cfg(target_os = "windows")]
struct OverlayState {
    owner: HWND,
    btn_w: i32,
    btn_h: i32,
    gap: i32,
    total_w: i32,
    hover: i32,
    pressed: i32,
    tracking: bool,
    /// 主题档:true=深底白字(暗色主题 / 壳离线占位页),false=浅底深字。
    dark_bg: bool,
    /// `dark_bg` 是不是**网页显式上报**来的。false 时绘制端改用顶栏像素实测
    /// (见 `sample_topbar_dark`)—— 线上旧 bundle 不会上报,不实测就永远看不见暗色。
    theme_reported: bool,
}

#[cfg(target_os = "windows")]
#[derive(Clone, Copy)]
struct Palette {
    /// 普通钮 hover 底。
    hover: u32,
    /// 普通钮按下底。
    pressed: u32,
    /// close 专用档(网页写死,与深浅主题无关)。
    close_hover: u32,
    close_pressed: u32,
    /// 未 hover 的"仅命中不可见"底(1/255,取底色同族色相,不影响观感)。
    hit_invisible: u32,
    /// 窗激活时字形。
    glyph_active: u32,
    /// 窗未激活时字形。
    glyph_inactive: u32,
    /// close hover/按下时的字形(红底上白字,深浅同值)。
    glyph_on_accent: u32,
}

#[cfg(target_os = "windows")]
impl Palette {
    /// 浅档 = 白底顶栏(`--color-shell-panel` 亮档 `#fff`);
    /// 暗档 = 深底顶栏(`dark:bg-shell-panel` = `hsl(220 12% 5%)`)。
    /// 逐档对齐 `packages/design-tokens/src/styles/tokens.css`:
    ///  · hover 取该主题 `--color-accent`(亮 hsl(0 0% 88) = `#E0E0E0` /
    ///    暗 hsl(0 0% 24) = `#3D3D3D`);网页侧按钮走 `TOPBAR_BTN_BASE` 的
    ///    `hover:bg-accent`,close 变体网页显式覆盖为 `hover:bg-red-600` /
    ///    `active:bg-red-700`,两档同值(深浅主题不换红)。
    ///  · 字形取该主题 `--color-primary-foreground` 的墨/纸翻转,非激活按网页
    ///    `[data-window-inactive='true']` 的 60% 衰减。
    /// 此前暗档写的是**半透明白**(0x1D/0x29 = 11%/16% 白),叠在深底上只有
    /// #2E2E2E/#3B3B3B,比网页实值淡两档(hover 几乎看不出来)—— 与本文件头注
    /// "两套规格各写一遍必然漂移"同型,故改成与浅档对称的**实底**色。
    const fn light() -> Self {
        Self {
            hover: 0xFF_E0E0E0_u32,
            pressed: 0xFF_D4D4D4_u32,
            close_hover: 0xFF_DC2626_u32,
            close_pressed: 0xFF_B91C1C_u32,
            hit_invisible: 0x01_000000_u32,
            glyph_active: 0xD9_00_00_00_u32,
            glyph_inactive: 0x99_00_00_00_u32,
            glyph_on_accent: 0xFF_FF_FF_FF_u32,
        }
    }

    const fn dark() -> Self {
        Self {
            hover: 0xFF_3D_3D_3D_u32,
            pressed: 0xFF_4D_4D_4D_u32,
            close_hover: 0xFF_DC2626_u32,
            close_pressed: 0xFF_B91C1C_u32,
            hit_invisible: 0x01_FF_FF_FF_u32,
            glyph_active: 0xF2_FA_FA_FA_u32,
            glyph_inactive: 0x99_FA_FA_FA_u32,
            glyph_on_accent: 0xFF_FF_FF_FF_u32,
        }
    }
}

/// overlay 主题实测的重估节拍(毫秒)。
///
/// **只在还没收到网页上报时挂着**:线上旧 bundle 不会上报,暗色只能靠实测顶栏像素看见;
/// 首次上报一到当场摘表,不留一张没人消费的定时器(§"工作队列必须有死亡机制")。
#[cfg(target_os = "windows")]
const THEME_PROBE_MS: u32 = 1_000;
#[cfg(target_os = "windows")]
const THEME_PROBE_TIMER: usize = 0x4948_5448; // 'IHTH'

#[cfg(target_os = "windows")]
impl OverlayState {
    /// 这一帧该用哪一档深浅。**取数只此一出口**,绘制路径不许再各自问一遍。
    ///
    /// 三档次序(2026-10-26 定):
    ///  1. **网页显式上报**(`set_caption_button_theme`)⇒ 直接用,网页是权威面;
    ///  2. 没上报过 ⇒ **实测顶栏像素**(`sample_topbar_dark`)。自绘钮压在网页顶栏上,
    ///     底色就是它背后那块像素;不实测就只能拿"按域名猜"的默认档,用户切暗色后
    ///     原生继续深字压深底(实拍"根本看不清")。
    ///     ⚠ 这一档**绝不许**改成"从远程页面 eval 一段脚本反查主题":那等于给远程域
    ///     开一条够得着 `__TAURI_INTERNALS__` 的原生口子(`embedded_browser.rs` 把
    ///     `__TAURI` / `invoke(` / `__TAURI_INTERNALS__` 列为禁用词正是为此)。
    ///     GetPixel 读的是**已经合成到屏幕上的像素**,不新增任何 IPC 面。
    ///  3. 实测也判不出(钮还没定位/采样全失败/亮度落在模糊带)⇒ 回落 slot 那档,
    ///     不猜第三值(§0.3)。
    fn dark_now(&self, dc: HDC, overlay: HWND) -> bool {
        if self.theme_reported {
            return self.dark_bg;
        }
        // SAFETY: 调用方(render_overlay)已持有屏幕 DC,且 overlay/owner 均为本模块创建的存活句柄。
        unsafe { sample_topbar_dark(dc, overlay, self.owner).unwrap_or(self.dark_bg) }
    }

    /// 深浅 → 配色档:两档成对,禁止在绘制循环里挑字面量。
    fn palette(&self, dc: HDC, overlay: HWND) -> Palette {
        if self.dark_now(dc, overlay) {
            Palette::dark()
        } else {
            Palette::light()
        }
    }
}

/// 实测顶栏底色是深是浅:在**自绘钮左侧**的顶栏带内取若干屏幕像素,按**中位数**判。
///
/// 为什么是中位数而不是均值:那一横条上除了顶栏底色还有网页自己的图标笔画
/// (白底上几笔深色就能把均值拖过阈值,深底同理反向),中位数对少量离群点免疫。
/// 三态(§0.3):中位数 < 80 ⇒ 深;> 175 ⇒ 浅;落在 80..=175 的模糊带(半深、渐变、
/// 图标密集)⇒ `None` **不判** —— 判不准时宁可沿用上一档,也不要画出一个"看不清"的档。
/// 采样左移让开钮缘 6 物理像素(别把自己画的像素算进样本),最多 8 点、步长 2 逻辑像素,
/// 越过客户区左缘即停;`CLR_INVALID`(全 F)= 采样失败,停止本轮。
#[cfg(target_os = "windows")]
unsafe fn sample_topbar_dark(dc: HDC, overlay: HWND, owner: HWND) -> Option<bool> {
    let mut o = RECT::default();
    if GetWindowRect(overlay, &mut o).is_err() {
        return None;
    }
    let (client_left, _client_top, _client_right) = client_bounds(owner)?;
    let dpi = GetDpiForWindow(owner).max(96);
    let y = o.top + (o.bottom - o.top) / 2;
    let step = scale(2, dpi).max(1);
    let mut x = o.left - scale(6, dpi);
    let mut lums: Vec<u64> = Vec::with_capacity(8);
    while x > client_left && lums.len() < 8 {
        let c = GetPixel(dc, x, y);
        if c.0 == u32::MAX {
            break;
        }
        let r = (c.0 & 0xFF) as u64;
        let g = ((c.0 >> 8) & 0xFF) as u64;
        let b = ((c.0 >> 16) & 0xFF) as u64;
        lums.push((r * 299 + g * 587 + b * 114) / 1000);
        x -= step;
    }
    if lums.is_empty() {
        return None;
    }
    lums.sort_unstable();
    let median = lums[lums.len() / 2];
    if median < 80 {
        Some(true)
    } else if median > 175 {
        Some(false)
    } else {
        None
    }
}

// 自定义消息(WM_APP+1):主题(深浅)变更,通知 overlay 重绘。
#[cfg(target_os = "windows")]
const WM_THEME_CHANGED: u32 = 0x8001;

#[cfg(target_os = "windows")]
struct Metrics {
    btn_w: i32,
    btn_h: i32,
    gap: i32,
    radius: i32,
    total_w: i32,
    edge_gap: i32,
    glyph_px: i32,
    glyph_nudge_y: f32,
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
    let gap = scale(BASE_BTN_GAP, dpi);
    let edge_gap = scale(BASE_EDGE_GAP, dpi);
    let glyph_px = scale(BASE_GLYPH_PX, dpi);
    let top_offset = scale(BASE_TOP_OFFSET, dpi);
    // 圆角至少 1px,且不得超过半边长(极端 DPI 下避免算出退化圆角)。
    let radius = scale(BASE_RADIUS, dpi).clamp(1, btn_h.min(btn_w) / 2);
    let glyph_nudge_y = BASE_GLYPH_NUDGE_Y * (dpi as f32 / 96.0);
    Metrics {
        btn_w,
        btn_h,
        gap,
        radius,
        // 与 HTML 容器逐字等宽:36×3 + 2×2 = 112 @96DPI。
        total_w: btn_w * 3 + gap * 2,
        edge_gap,
        glyph_px,
        glyph_nudge_y,
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

    // 深浅初值取 slot(不是 false):网页上报可能**早于**建窗(远端站点先渲染完),
    // 写死 false 会把已上报的暗档冲回浅档 ⇒ 首帧又是一张"看不清"的脸。
    let dark_bg = theme_slot(&label).load(std::sync::atomic::Ordering::Relaxed);
    let theme_reported = reported_slot(&label).load(std::sync::atomic::Ordering::Relaxed);
    let overlay = unsafe { create_overlay(owner, dark_bg, theme_reported) };
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

/// 该窗是否已被**网页侧显式上报过**深浅(前端 invoke `set_caption_button_theme`)。
///
/// 需要这一维的原因:`theme_is_dark_for_url` 只能按地址粗判,线上 `https://aizhs.top`
/// 恒判"浅顶栏";用户在应用内切暗色时粗判这一路**结构上看不到**。若每次页面加载
/// 都用粗判覆盖,上报的暗色会被冲掉(刷新即失效,实拍就是"暗色模式根本看不清")。
#[cfg(target_os = "windows")]
fn reported_slot(label: &str) -> &'static std::sync::atomic::AtomicBool {
    static MAIN: std::sync::OnceLock<std::sync::atomic::AtomicBool> = std::sync::OnceLock::new();
    static ADMIN: std::sync::OnceLock<std::sync::atomic::AtomicBool> = std::sync::OnceLock::new();
    match label {
        "admin" => ADMIN.get_or_init(|| std::sync::atomic::AtomicBool::new(false)),
        _ => MAIN.get_or_init(|| std::sync::atomic::AtomicBool::new(false)),
    }
}

/// 按加载 URL 判定顶栏深浅:离线兜底页 / 壳占位页为深色底(#242424),
/// 线上 https://aizhs.top 为浅色顶栏。
///
/// **只对壳自有页成立**(那些页面里没有任何前端会来上报主题);线上页的深浅一律以
/// 网页上报 / 顶栏像素实测为准,见 `apply_theme_on_page_load` 与 `OverlayState::dark_now`。
#[cfg(target_os = "windows")]
pub fn theme_is_dark_for_url(url: &str) -> bool {
    let u = url.to_ascii_lowercase();
    u.contains("offline.localhost") || u.starts_with("tauri://") || u.contains("tauri.localhost")
}

/// 网页侧显式上报深浅(前端切主题时调用):记为"上报过"并重绘。
#[cfg(target_os = "windows")]
pub fn set_caption_theme(label: &str, dark_bg: bool) {
    theme_slot(label).store(dark_bg, std::sync::atomic::Ordering::Relaxed);
    reported_slot(label).store(true, std::sync::atomic::Ordering::Relaxed);
    apply_theme_to_overlay(label, dark_bg, true);
}

/// 页面加载完成时的深浅判序。两条档位各有权威面,不能互相盖:
///  · **壳自有页**(离线兜底 / 占位页):页面里没人会上报,深底是页面本身的事实
///    ⇒ URL 判定权威,同时清掉 `reported`(回线上页后以新一轮上报为准);
///  · **线上页**:深浅由用户主题决定,URL 判不出来(恒同一域名)⇒ 以网页上报为准,
///    没上报过则留给绘制端的顶栏像素实测(见 `OverlayState::dark_now`)。
/// 此前这里是"每次 page_load 无条件按 URL 粗判覆盖",线上暗色被冲成浅档 ⇒
/// 原生侧把深字画在深底上。
#[cfg(target_os = "windows")]
pub fn apply_theme_on_page_load(label: &str, url: &str) {
    let reported = reported_slot(label).load(std::sync::atomic::Ordering::Relaxed);
    let dark = if theme_is_dark_for_url(url) {
        reported_slot(label).store(false, std::sync::atomic::Ordering::Relaxed);
        true
    } else if reported {
        theme_slot(label).load(std::sync::atomic::Ordering::Relaxed)
    } else {
        // 线上页且还没收到上报:这一档只当"实测取不到时"的兜底值(实测优先,见 dark_now)
        theme_slot(label).load(std::sync::atomic::Ordering::Relaxed)
    };
    theme_slot(label).store(dark, std::sync::atomic::Ordering::Relaxed);
    let from_report = reported_slot(label).load(std::sync::atomic::Ordering::Relaxed);
    apply_theme_to_overlay(label, dark, from_report);
}

#[cfg(target_os = "windows")]
fn apply_theme_to_overlay(label: &str, dark_bg: bool, reported: bool) {
    let raw = overlay_slot(label).load(std::sync::atomic::Ordering::Relaxed);
    if raw != 0 {
        let hwnd = HWND(raw as *mut core::ffi::c_void);
        unsafe {
            // wparam=深浅,lparam=是不是上报值:overlay 若建得比上报晚,
            // 这两个事实必须随消息一起带过去,不能只带一个。
            let _ = windows::Win32::UI::WindowsAndMessaging::PostMessageW(
                Some(hwnd),
                WM_THEME_CHANGED,
                WPARAM(dark_bg as usize),
                LPARAM(reported as isize),
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

#[cfg(not(target_os = "windows"))]
pub fn apply_theme_on_page_load(_label: &str, _url: &str) {}

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
unsafe fn create_overlay(owner: HWND, dark_bg: bool, theme_reported: bool) -> Option<HWND> {
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
        gap: m.gap,
        total_w: m.total_w,
        hover: -1,
        pressed: -1,
        tracking: false,
        dark_bg,
        theme_reported,
    });
    SetWindowLongPtrW(overlay, GWLP_USERDATA, Box::into_raw(state) as isize);
    // 还没收到网页上报 ⇒ 挂上实测节拍(上报一到在 WM_THEME_CHANGED 里当场摘表)。
    if !theme_reported {
        let _ = SetTimer(Some(overlay), THEME_PROBE_TIMER, THEME_PROBE_MS, None);
    }
    Some(overlay)
}

/// 宿主窗**客户区**在屏幕上的左缘 / 顶边 / 右缘(物理像素)。
///
/// 【为什么基准必须是客户区,而不是窗口矩形或显示器矩形(2026-10-26 实测订正)】
/// 原生三钮要对齐的是**网页视口**的右缘(顶栏 `pr-2` 从视口起算),而视口 == 客户区:
///  · 取 `GetWindowRect`:含 DWM 边框/投影,外缘比客户区更靠外,右缘多吃一截
///    ⇒ 实测 overlay 右缘距客户区右缘只剩 2 物理像素,而工作区卡片是 14(用户实拍
///    "关闭按钮容器的右侧跟工作区的右侧距屏幕右侧不一样");
///  · 取 `rcMonitor`(上一版专为最大化打的补丁):最大化时窗口 rect 确实溢出屏幕,
///    要绕开 rect,但拿显示器当基准在**还原态**又错回去,多屏/跨缩放边界再错一次。
/// 客户区一次覆盖三种形态(还原 / 最大化 / 跨屏),不必再按 `IsZoomed` 分支。
/// 任一 API 失败 ⇒ `None`:调用方保持原位,**不回落窗口矩形**(§0.3 取不到输入不得
/// 用另一套近似值冒判)。
#[cfg(target_os = "windows")]
unsafe fn client_bounds(owner: HWND) -> Option<(i32, i32, i32)> {
    let mut client = RECT::default();
    if GetClientRect(owner, &mut client).is_err() || client.right <= 0 {
        log::warn!("[window-chrome] sync_overlay GetClientRect 失败或宽度为 0");
        return None;
    }
    let mut origin = POINT { x: 0, y: 0 };
    // ClientToScreen 返回 BOOL(FALSE 才是失败;写成 .is_err() 直接编译不过,E0599 实测)。
    if !ClientToScreen(owner, &mut origin).as_bool() {
        log::warn!("[window-chrome] sync_overlay ClientToScreen 失败");
        return None;
    }
    Some((origin.x, origin.y, origin.x + client.right))
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
    state.gap = m.gap;
    state.total_w = m.total_w;

    let Some((_client_left, client_top, client_right)) = client_bounds(owner) else {
        return;
    };
    // 右避让恒定 = 顶栏 pr-2(8px)。**最大化不归零**:网页侧 padding 在最大化态
    // 依然存在,归零会让原生按钮比 HTML 多贴 8px(用户实拍"关闭按钮贴右侧程序的边")。
    let x = client_right - m.total_w - m.edge_gap;
    let y = client_top + m.top_offset;

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
            // 配色档在**循环外**取一次:深浅判定要不要读屏幕像素,不该按钮数重复采样。
            let p = state.palette(screen_dc, overlay);

            for i in 0..3i32 {
                // 钮间留 gap(HTML gap-0.5 = 2px),三钮 + 两道缝 = 容器总宽 112。
                let x = i * (m.btn_w + m.gap);
                let is_close = i == 2;
                let hovered = state.hover == i;
                let pressed = state.pressed == i;

                // 背景态。注意:UpdateLayeredWindow 下全透明像素会被
                // WindowFromPoint 视为穿透(点击落到下方网页),所以每个按钮
                // 矩形必须至少有 1/255 alpha 保证整块 36×36 都可命中;
                // 1/255 肉眼不可见。四角超出圆角的部分由下方圆角遮罩统一压到
                // 1/255(既保住命中,又不画出直角)。
                // 取值一律来自 `p`(深浅两档成对住在 Palette,见其头注与 `dark_now` 的三档取数次序)。
                let bg = if is_close && (hovered || pressed) {
                    if pressed {
                        p.close_pressed
                    } else {
                        p.close_hover
                    }
                } else if pressed {
                    p.pressed
                } else if hovered {
                    p.hover
                } else {
                    p.hit_invisible
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
                    p.glyph_on_accent
                } else if active {
                    p.glyph_active
                } else {
                    p.glyph_inactive
                };
                if !font.is_null()
                    && !format.is_null()
                    && gdi_ok(GdipCreateSolidFill(glyph_color, &mut brush))
                {
                    let mut buf = [glyph, 0];
                    let text = PCWSTR(buf.as_mut_ptr());
                    // Y 加光学微调:让 Segoe Fluent Icons 的 ink 中心落在 36px 盒
                    // 的几何中心(y=18),与 HTML 14px 图标中心逐像素重合。
                    let rect = RectF {
                        X: x as f32,
                        Y: m.glyph_nudge_y,
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

    // 圆角遮罩 + 预乘 alpha。
    // ① 圆角(2026-10-26 立):设计要求 `rounded-md` = 6px 圆角,GDI+ 这里用的是
    //    `GdipFillRectangle`(直角),故在提交前对像素做圆角裁剪 —— 四角落在
    //    「圆心到像素距离 > r」的像素按覆盖率衰减 alpha(0.5px 外扩做抗锯齿),
    //    视觉与 CSS border-radius 一致。遮罩按**每个按钮自己的盒子**算,不动钮间
    //    缝隙(gap 属于相邻按钮的命中区,不参与圆角)。
    // ② 命中兜底:任何像素 alpha 至少 1/255。UpdateLayeredWindow 下 alpha=0 会被
    //    WindowFromPoint 判为穿透,四角/缝隙若归零,点击会漏到下方网页。
    // ③ 预乘(实测 2026-10-18):GDI+ 对外部 scan0 的 PARGB 位图**不做**预乘
    //    (低 alpha 白色仍写 RGB=255,A=1);UpdateLayeredWindow(AC_SRC_ALPHA)
    //    按预乘值合成,会把它当不透明白块。黑色因为预乘后仍是 0 掩盖了这个问题。
    //    提交前统一把 BGRA 逐像素预乘,保证深浅两套配色都正确。
    {
        let total = (w * h) as usize;
        let base = bits as *mut u8;
        let premul = |c: u8, a: u8| ((c as u32 * a as u32 + 127) / 255) as u8;
        let bw = m.btn_w;
        let bh = m.btn_h;
        let stride = m.btn_w + m.gap;
        let r = m.radius as f32;
        // 盒内右/下边缘的最后一个像素坐标(圆角圆心所在)
        let max_x = (bw - 1) as f32 - r;
        let max_y = (bh - 1) as f32 - r;
        for n in 0..total {
            let px = (n as i32) % w;
            let py = (n as i32) / w;
            let p = base.add(n * 4);
            let mut a = *p.add(3) as f32;

            // 定位到所属按钮的局部坐标(缝隙列归左边按钮,与 hit_test 同口径)。
            let idx = (px / stride).min(2);
            let lx = (px - idx * stride) as f32;
            if lx < bw as f32 && py < bh {
                let fx = lx;
                let fy = py as f32;
                let dx = if fx < r {
                    r - fx
                } else if fx > max_x {
                    fx - max_x
                } else {
                    0.0
                };
                let dy = if fy < r {
                    r - fy
                } else if fy > max_y {
                    fy - max_y
                } else {
                    0.0
                };
                if dx > 0.0 && dy > 0.0 {
                    // 覆盖率:圆心距离在 r 处为 1,r+0.5 处为 0。
                    let dist = (dx * dx + dy * dy).sqrt();
                    let cov = (r + 0.5 - dist).clamp(0.0, 1.0);
                    a *= cov;
                }
            }

            let a: u8 = if a < 1.0 { 1 } else { a.round() as u8 };
            *p = premul(*p, a);
            *p.add(1) = premul(*p.add(1), a);
            *p.add(2) = premul(*p.add(2), a);
            *p.add(3) = a;
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
    let upd = UpdateLayeredWindow(
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

    // 2026-10-26 诊断:自绘链路每一步的实测返回值。沙箱/合成器环境下曾出现
    // 「窗口在位、内存参数全对、屏幕却一个像素都没有」—— 只有把 font/format/
    // UpdateLayeredWindow 的成败打出来,才能分清是"没画"还是"画了没提交"。
    log::debug!(
        "[window-chrome] render w={w} h={h} btn={}x{} gap={} radius={} glyph={} font_ok={} format_ok={} upd_ok={}",
        m.btn_w,
        m.btn_h,
        m.gap,
        m.radius,
        m.glyph_px,
        !font.is_null(),
        !format.is_null(),
        upd.is_ok()
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
    // 三钮之间有 gap(2px)。缝隙列归左边按钮:整块 caption 区都可点,
    // 与 Windows 原生标题栏"整条可点"的语义一致(点缝不会漏到网页)。
    let i = x / (state.btn_w + state.gap);
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
            state.theme_reported = lparam.0 != 0;
            // 上报到位 ⇒ 摘掉实测定时器(绝不留一张没人消费的表);
            // 退回"未上报"(切回壳自有页时 reported 被清)⇒ 重新挂上。
            if state.theme_reported {
                let _ = KillTimer(Some(hwnd), THEME_PROBE_TIMER);
            } else {
                let _ = SetTimer(Some(hwnd), THEME_PROBE_TIMER, THEME_PROBE_MS, None);
            }
            state.hover = -1;
            state.pressed = -1;
            render_overlay(hwnd);
            return LRESULT(0);
        }
        WM_TIMER => {
            // 只认自己那张表,别的计时器原样交回 DefWindowProc。
            if wparam.0 == THEME_PROBE_TIMER {
                if state.theme_reported {
                    let _ = KillTimer(Some(hwnd), THEME_PROBE_TIMER);
                } else {
                    // 重绘即重采样:深浅取数住在 `OverlayState::dark_now`,这里不另算一份。
                    render_overlay(hwnd);
                }
                return LRESULT(0);
            }
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
/// 滑到原生按钮下方被盖住。min-width = **112px**,与 HTML 容器自身设计宽度逐字
/// 等值(36×3 + gap-0.5×2 = 112,2026-10-26 订正:此前写 138 是旧原生 46×3 口径,
/// 比 HTML 容器宽 26px,会在顶栏右侧凭空多留一截空白);原生宿主按 DPI 缩放,
/// CSS 侧恒为 112。pointer-events:none 双保险。
/// 每次导航都重注(幂等,靠 __ihuiHtmlControlsHidden 去重)。
pub const HIDE_HTML_WINDOW_CONTROLS_JS: &str = r#"
(function(){
  try {
    if (window.__ihuiHtmlControlsHidden) return;
    var s = document.createElement('style');
    s.textContent = '[data-window-controls]{visibility:hidden !important;min-width:112px !important;pointer-events:none !important;}';
    document.head.appendChild(s);
    window.__ihuiHtmlControlsHidden = true;
  } catch(e) {}
})();
"#;
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
