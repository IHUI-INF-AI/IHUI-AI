// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-09-17 薄壳化配套:线上前端自动刷新 + 断网兜底守卫(详见模块文档)
mod auto_refresh;
// 2026-10-09 立(WP-C 第一步):签到账号本地捕获——TRAE 目录探测/JWT 提取/设备标识重置/9 类快照。
// 分层同 desktop_prefs.rs:判据纯函数 + 执行层 + 薄胶水,测试在模块内真跑。
mod checkin_capture;
// 2026-10-12 立:WorkBuddy「网页登录自动添加账号」——内嵌 WebView 登录 + cookie jar
// 读取(含 HttpOnly)+ /console/accounts 登录态验证,普通用户零 token 体验。
mod checkin_web_login;
// 2026-10-16 立:项目内嵌浏览器(自绘工具条 + 地址栏 + Chrome UA 的 WebView2 窗口)。
// 签到网页登录、SSO 兜底窗等"需要在浏览器里走一趟"的场景统一用它,不再外部拉 Chrome。
mod embedded_browser;
// 2026-10-17 立:内嵌浏览器「完整浏览器」能力——书签管理/最近历史/从 Chrome/Edge 导入书签。
// 数据落 app_data_dir(持久化,区别于内存标签会话);纯函数(Chrome 书签解析/去重/历史)
// 判据可单测,I/O 走薄 Tauri 命令胶水。
mod browser_bookmarks;
// 2026-09-28 立:托盘/关窗/启动/角标的「行为偏好」——判定与持久化都在模块内,本文件只做接线。
mod desktop_prefs;
// 本地 git/diff 通道（2026-09-27）：纯判据 / 执行层 / tauri 胶水三件套。
// 前两个文件只依赖 std，可用 `rustc --test` 单独跑单测；胶水层只映射 DTO。
mod git_channel_ipc;
mod git_local_status;
mod git_status_core;
// 2026-10-18 立(票72②):本地 diff 文本通道执行层(只用 std,三态同 git_local_status 纪律)。
mod git_local_diff;
// 2026-10-18 立(票72②):工作区增量索引执行层(只用 std;目录不下降符号链接/junction=票72④的索引侧收口)。
mod workspace_index;
// G-379/G-407/G-774,2026-10-07:桌面日志保留期——政策常量唯一出处 + setup 期裁剪历史档案。
mod log_retention;
mod startup_guard;
// 2026-10-10 立:WorkBuddy 程序一键重置——维护清理/登出重置/出厂重置(隔离区搬移可逆)。
// 分层同 checkin_capture.rs:判据纯函数 + 执行层 + 薄胶水,测试用临时夹具(绝不触碰真实 ~/.workbuddy)。
mod qoder_reset;
mod workbuddy_reset;
// 2026-10-16 立:MiniMax 程序一键重置——补齐第四平台风控面(此前 MiniMax 只有捕获、零重置零审计)。
// 双根 ~/.minimax + %APPDATA%/MiniMax;架构与 qoder_reset 同构(维护/登出/出厂 + 隔离区可逆 + 残留审计)。
mod minimax_reset;
// 2026-10-17 立:Windows DWM sheet-of-glass 原生窗控按钮——让右上角最小化/最大化/
// 关闭随窗口壳即时出现(OS 绘制),不再等网页 React 渲染。配套注入 CSS 隐藏 HTML 窗控。
mod window_chrome;
// 2026-10-26 立:屏幕即手(Hands)operator——截屏 → 界面状态 → 纯决策 → 键鼠执行的最小可用回路。
// 判据纯函数(decide_actions)可独立单测,执行层才碰 enigo/screenshots;Tauri 胶水只注册两条命令。
mod operator;

use serde::{Deserialize, Serialize};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent, TrayIconId};
use tauri::{Emitter, Manager};
// 行为偏好的判定与持久化住在 desktop_prefs.rs,这里只引它已有的出口(不开第二份判据)。
use desktop_prefs::{
    decide_close_action, desktop_prefs_path, load_desktop_prefs, normalize_prefs, save_desktop_prefs,
    should_migrate_launch_minimized, should_start_hidden, tray_menu_item, CloseBehavior,
    CloseDecision, DesktopPrefs, DesktopPrefsPatch, TraySingleClick,
};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use std::io::Cursor;
use std::collections::{HashMap, VecDeque};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};
use base64::Engine;
use enigo::{Axis, Button, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings};
use screenshots::Screen;

// ================== 桌面 IPC 错误契约(G-715,2026-09-30 立)==================

/// 跨进程错误体的**身份档**。渲染层按这一档分派处置。
///
/// 为什么要它:此前命令一律 `map_err(|e| format!("…: {e}"))` 把失败压成纯字符串,渲染层
/// 只能拿文案猜;而本仓的错误判序是 `errorCode → HTTP status → 文案正则`,桌面端第一档
/// 永远为空 ⇒ 判序整条退化成文案正则。四档由**发送方显式给出**,不得由文案反推。
///
/// 词汇与 `packages/types/src/api.ts` 的 `ApiFailure.errorCode` 同族但**刻意不合并**:
/// HTTP 面还带 `status/retryAfter`,IPC 面没有传输层状态码可言,两面含义不同形。
/// 档名的对端契约在 `apps/web/src/lib/tauri-bridge.ts` 的 `IPC_ERROR_CODES`,
/// 由 `apps/web/tests/g-715-ipc-error-contract.test.ts` 逐档对账(两侧任一处漂了就红)。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum IpcErrorCode {
    /// 目标不存在:文件/窗口/可执行程序。
    NotFound,
    /// 宿主按策略拒绝:路径越出应用数据目录、窗口状态不允许(最大化/全屏)、配额超限。
    Permission,
    /// 网络栈失败:端口分配、连接。
    Network,
    /// 其余一律 internal。这一档的含义是"宿主没能给出身份",不是"没事"——不许拿来兜好消息。
    Internal,
}

/// 高危命令的原生确认闸(2026-10-27)。
///
/// 威胁模型:default capability 的 remote 授权让 aizhs.top 页面(即线上前端)能调用
/// 全部命令 —— 一次 XSS 即可无交互执行破坏性命令。前端传的 confirm 参数由调用方
/// 自报,XSS 直接传 true 绕过(minimax_quarantine_delete 旧形态),不构成闸。
/// 本闸在 Rust 侧弹**原生对话框**:人不在场就点不了「确认」,脚本物理上无法通过。
/// 适用 = 低频、破坏性/持久性命令(出厂重置/登出重置/隔离区删除/维护清理);
/// 高频自动化命令(打卡截图/键鼠)刻意不加 —— 每次都弹窗等于毁掉产品。
pub fn require_native_confirm(
    app: &tauri::AppHandle,
    title: &str,
    body: &str,
) -> Result<(), IpcError> {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
    let confirmed = app
        .dialog()
        .message(body)
        .title(title)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "确认执行".to_string(),
            "取消".to_string(),
        ))
        .blocking_show();
    if confirmed {
        Ok(())
    } else {
        Err(IpcError::permission("用户在原生确认窗中取消(或无人应答)"))
    }
}

impl IpcErrorCode {
    /// wire 上的字面量(与 serde 的 `rename_all = "snake_case"` 逐字同形,由契约测试钉住)。
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::NotFound => "not_found",
            Self::Permission => "permission",
            Self::Network => "network",
            Self::Internal => "internal",
        }
    }
}

/// 桌面 IPC 命令的失败分支。序列化后的 wire 形状是 `{ "code": "<档>", "message": "<原因>" }`。
#[derive(Debug, Clone, Serialize)]
pub struct IpcError {
    pub code: IpcErrorCode,
    pub message: String,
}

impl IpcError {
    pub fn new(code: IpcErrorCode, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(IpcErrorCode::NotFound, message)
    }

    pub fn permission(message: impl Into<String>) -> Self {
        Self::new(IpcErrorCode::Permission, message)
    }

    pub fn network(message: impl Into<String>) -> Self {
        Self::new(IpcErrorCode::Network, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(IpcErrorCode::Internal, message)
    }

    /// io 失败 → IpcError,并把"是哪个动作/哪条路径"补进 message。
    /// 归类只看 `ErrorKind`(`From<io::Error>` 那一条),**不碰 `to_string()` 的文案** ——
    /// 按文案猜档正是本票要消灭的形态。
    pub fn from_io(action: &str, target: &std::path::Path, e: std::io::Error) -> Self {
        let mut err = Self::from(e);
        err.message = format!("{} {}: {}", action, target.display(), err.message);
        err
    }
}

impl std::fmt::Display for IpcError {
    /// 日志面保留档位名:落盘失败只写"permission: …"才答得出是谁拒的、为什么拒的。
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code.as_str(), self.message)
    }
}

impl std::error::Error for IpcError {}

impl From<std::io::Error> for IpcError {
    fn from(e: std::io::Error) -> Self {
        let code = match e.kind() {
            std::io::ErrorKind::NotFound => IpcErrorCode::NotFound,
            std::io::ErrorKind::PermissionDenied => IpcErrorCode::Permission,
            std::io::ErrorKind::ConnectionRefused
            | std::io::ErrorKind::ConnectionReset
            | std::io::ErrorKind::ConnectionAborted
            | std::io::ErrorKind::AddrInUse
            | std::io::ErrorKind::AddrNotAvailable
            | std::io::ErrorKind::TimedOut
            | std::io::ErrorKind::UnexpectedEof => IpcErrorCode::Network,
            // 判不出来就明说判不出来:这一档是"未归类",不是"没问题"。
            _ => IpcErrorCode::Internal,
        };
        Self::new(code, e.to_string())
    }
}

#[cfg(test)]
mod ipc_error_contract_tests {
    use super::*;

    /// 1. wire 形状必须是 `{ "code": "<档>", "message": "<原因>" }` —— 渲染层就是按这个字段取档的。
    ///    这条断言是"身份到端"的正证:若 Serialize 漂移(比如退化成 Display 的字符串),
    ///    前端拿到的就只有文案,本票的病灶原样复活。
    #[test]
    fn serializes_as_object_with_code_and_message() {
        let err = IpcError::permission("路径不在应用数据目录内(拒绝): C:\\Windows\\x");
        let json = serde_json::to_value(&err).expect("serialize IpcError");
        assert_eq!(json["code"].as_str(), Some("permission"));
        assert!(json["message"].as_str().unwrap().contains("拒绝"));
        // 反向对照:序列化结果不得是字符串(那正是改之前的形态)。
        assert!(json.is_object(), "wire 必须是对象,实际是 {:?}", json);
    }

    /// 2. `as_str()` 与 serde 的 snake_case 必须同形 —— 前端 IPC_ERROR_CODES 拿字面量比对,
    ///    两处任改其一就会对不上(档名漂了而两侧各自都自洽)。
    #[test]
    fn code_literals_match_serde_output() {
        for (code, wire) in [
            (IpcErrorCode::NotFound, "not_found"),
            (IpcErrorCode::Permission, "permission"),
            (IpcErrorCode::Network, "network"),
            (IpcErrorCode::Internal, "internal"),
        ] {
            assert_eq!(code.as_str(), wire);
            assert_eq!(
                serde_json::to_value(code).unwrap().as_str(),
                Some(wire),
                "档名与 serde 输出分叉:{}",
                wire
            );
        }
    }

    /// 3. io 失败按 **ErrorKind** 归类,不按 to_string() 的文案。
    ///    (Windows/中文系统的 io 文案措辞不稳,按文案猜档就是本票要消灭的形态。)
    #[test]
    fn io_error_is_classified_by_kind_not_by_text() {
        // 同一句话、不同 kind ⇒ 档必须不同 ⇒ 证明归类看的不是文案。
        let denied = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "boom");
        let missing = std::io::Error::new(std::io::ErrorKind::NotFound, "boom");
        let other = std::io::Error::new(std::io::ErrorKind::Other, "boom");
        assert_eq!(IpcError::from(denied).code, IpcErrorCode::Permission);
        assert_eq!(IpcError::from(missing).code, IpcErrorCode::NotFound);
        assert_eq!(IpcError::from(other).code, IpcErrorCode::Internal);
        let refused = std::io::Error::new(std::io::ErrorKind::ConnectionRefused, "boom");
        assert_eq!(IpcError::from(refused).code, IpcErrorCode::Network);
    }

    /// 4. from_io 保留"是哪个动作/哪条路径"的量级信息,同时不改变档位。
    #[test]
    fn from_io_keeps_context_and_code() {
        let e = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "拒绝访问。");
        let err = IpcError::from_io("write", std::path::Path::new("C:\\Users\\x\\a.json"), e);
        assert_eq!(err.code, IpcErrorCode::Permission);
        assert!(err.message.starts_with("write C:\\Users\\x\\a.json: "));
        // 日志面(Display)必须带档名,否则"落盘失败(拒绝访问。)"这种行答不出是谁拒的。
        assert_eq!(
            format!("{}", err),
            format!("permission: {}", err.message)
        );
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct AppInfo {
    name: String,
    version: String,
    platform: String,
}

/// admin 窗口元数据,前端用于决定窗口尺寸/标题。
#[derive(Debug, Serialize, Deserialize)]
struct AdminWindowInfo {
    label: String,
    title: String,
    width: f64,
    height: f64,
    min_width: f64,
    min_height: f64,
}

// ================== Computer Control 返回类型 ==================

#[derive(Serialize)]
struct ScreenshotResult {
    screenshot: String,
}

#[derive(Serialize)]
struct OkResult {
    ok: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowInfo {
    title: String,
    app_name: String,
    window_id: String,
    /// 窗口在屏幕上的 [x, y, width, height](物理像素),2026-08-16 立。
    /// 此前前端收到占位 [0,0,0,0],LLM 无法据此判断窗口位置/大小。
    bounds: [i32; 4],
}

#[derive(Serialize)]
struct ActiveWindowResult {
    window: WindowInfo,
}

#[derive(Serialize)]
struct ClipboardResult {
    clipboard: String,
}

/// 检测系统 UI 语言是否为中文(Windows: GetUserDefaultUILanguage)。
/// 支持的语言代码(与 web 端 i18n 5 语言对齐:zh-CN/zh-TW/ko/ja/en)。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AppLocale {
    ZhCn,
    ZhTw,
    Ko,
    Ja,
    En,
}

#[cfg(windows)]
fn get_system_locale() -> AppLocale {
    use winapi::um::winnls::GetUserDefaultLocaleName;
    let mut buf = [0u16; 85]; // LOCALE_NAME_MAX_LENGTH
    let len = unsafe { GetUserDefaultLocaleName(buf.as_mut_ptr(), buf.len() as i32) };
    if len <= 0 {
        return AppLocale::En;
    }
    let locale: String = String::from_utf16_lossy(&buf[..len as usize - 1])
        .to_lowercase()
        .replace('-', "-");
    // 精确匹配 5 语言,其他降级为 En
    if locale.starts_with("zh-cn") || locale.starts_with("zh-sg") || locale.starts_with("zh-hans") {
        AppLocale::ZhCn
    } else if locale.starts_with("zh-tw") || locale.starts_with("zh-hk") || locale.starts_with("zh-mo") || locale.starts_with("zh-hant") {
        AppLocale::ZhTw
    } else if locale.starts_with("ko") {
        AppLocale::Ko
    } else if locale.starts_with("ja") {
        AppLocale::Ja
    } else {
        AppLocale::En
    }
}

/// 检测系统 UI 语言(非 Windows: LANG 环境变量)。
#[cfg(not(windows))]
fn get_system_locale() -> AppLocale {
    let locale = std::env::var("LANG")
        .unwrap_or_default()
        .to_lowercase()
        .replace('_', "-");
    if locale.starts_with("zh-cn") || locale.starts_with("zh-sg") || locale.starts_with("zh-hans") {
        AppLocale::ZhCn
    } else if locale.starts_with("zh-tw") || locale.starts_with("zh-hk") || locale.starts_with("zh-hant") {
        AppLocale::ZhTw
    } else if locale.starts_with("ko") {
        AppLocale::Ko
    } else if locale.starts_with("ja") {
        AppLocale::Ja
    } else {
        AppLocale::En
    }
}

/// 根据系统 UI 语言返回本地化应用名称:中文(简/繁)→ 智汇AI,其他 → IHUI AI。
fn localized_app_name() -> &'static str {
    match get_system_locale() {
        AppLocale::ZhCn | AppLocale::ZhTw => "智汇AI",
        AppLocale::Ko => "IHUI AI",
        AppLocale::Ja => "IHUI AI",
        AppLocale::En => "IHUI AI",
    }
}

#[tauri::command]
fn get_app_info(app: tauri::AppHandle) -> AppInfo {
    AppInfo {
        name: localized_app_name().to_string(),
        // 版本以 tauri.conf.json 的 version 为准(运行时动态读取,勿在此硬编码版本号),
        // 不再用 Cargo.toml 的 CARGO_PKG_VERSION(0.1.0,二者会漂移)。
        version: app.package_info().version.to_string(),
        platform: std::env::consts::OS.to_string(),
    }
}

// 2026-10-16:`pick_free_port` 随外部 Chrome 方案(CDP 端口分配)一并删除 ——
// 内嵌浏览器不需要调试端口,登录态直读窗口自己的 cookie jar。

#[tauri::command]
fn start_resize(
    direction: String,
    label: Option<String>,
    app: tauri::AppHandle,
) -> Result<(), IpcError> {
    let dir_name = match direction.as_str() {
        "n" => "North",
        "s" => "South",
        "e" => "East",
        "w" => "West",
        "ne" => "NorthEast",
        "nw" => "NorthWest",
        "se" => "SouthEast",
        "sw" => "SouthWest",
        // 调用方给的档位不在登记表里 = 前端与宿主的契约漂了,属内部缺陷而非策略拒绝。
        _ => return Err(IpcError::internal(format!("unknown direction: {}", direction))),
    };
    let label = label.as_deref().unwrap_or("main");
    let webview = app
        .get_webview_window(label)
        .ok_or_else(|| IpcError::not_found(format!("window {} not found", label)))?;
    let win = webview.as_ref().window();
    // 2026-07-28 立:最大化/全屏状态下拒绝 resize(Windows 原生行为)
    // G-715:这一拒绝此前只能靠前端"整块静默吞掉",现在有档 ⇒ 前端按 permission 分派。
    if win.is_maximized().unwrap_or(false) {
        return Err(IpcError::permission("window is maximized"));
    }
    if win.is_fullscreen().unwrap_or(false) {
        return Err(IpcError::permission("window is fullscreen"));
    }
    let dir = serde_json::from_value(serde_json::Value::String(dir_name.to_string()))
        .map_err(|e| IpcError::internal(format!("resize direction: {e}")))?;
    win.start_resize_dragging(dir)
        .map_err(|e| IpcError::internal(format!("start_resize_dragging: {e}")))
}

/// 切换窗口全屏状态(P2:桌面端标配,2026-07-27 立)。
/// 返回切换后的全屏状态(true=全屏,false=窗口模式)。
#[tauri::command]
fn toggle_fullscreen(window: tauri::WebviewWindow) -> Result<bool, IpcError> {
    let fs = window.is_fullscreen().unwrap_or(false);
    window
        .set_fullscreen(!fs)
        .map_err(|e| IpcError::internal(format!("set_fullscreen: {e}")))?;
    Ok(!fs)
}

/// 切换窗口置顶状态(P2:AI 对话悬浮场景,2026-07-27 立)。
/// 返回切换后的置顶状态(true=置顶,false=普通)。
#[tauri::command]
fn toggle_always_on_top(window: tauri::WebviewWindow) -> Result<bool, IpcError> {
    let current = window.is_always_on_top().unwrap_or(false);
    window
        .set_always_on_top(!current)
        .map_err(|e| IpcError::internal(format!("set_always_on_top: {e}")))?;
    Ok(!current)
}

#[tauri::command]
fn get_admin_window_info() -> AdminWindowInfo {
    AdminWindowInfo {
        label: "admin".to_string(),
        title: "IHUI AI 管理后台".to_string(),
        width: 1280.0,
        height: 820.0,
        min_width: 1200.0,
        min_height: 720.0,
    }
}

/// 2026-07-25 修订:**已删除原 build_app_menu 函数 + 移除 app.set_menu() 调用**。
///
/// 原因:HTML 顶栏(NativeTopBar.tsx)已自绘菜单 UI,再显示系统原生菜单
/// 会出现"两层菜单栏",体验割裂。原菜单的快捷键(Ctrl+R/F12/Ctrl+Shift+A/Ctrl+Q)
/// 移到 web 端 keydown 监听(见 use-native-shortcuts.ts useNativeShortcuts),
/// 真正需要 Rust 的能力(F12 devtools / Ctrl+Shift+A 唤起 admin / Ctrl+Q 退出)
/// 通过 invoke 命令调用,逻辑保持不变。
///
/// 此位置预留,如未来需恢复原生菜单可参照之前版本。

/// 切换 webview 开发者工具(前端 menu dispatcher 调用,2026-07-25 立)。
/// Tauri 2 没有 JS 端 toggle API,必须在 Rust 端做。
#[tauri::command]
fn toggle_devtools(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.is_devtools_open() {
        window.close_devtools();
    } else {
        window.open_devtools();
    }
    Ok(())
}

/// 真正退出应用(供前端 menu dispatcher 调用,2026-07-25 立)。
/// 绕过 closeWindow 的"隐藏到托盘"语义,直接走 `app.exit(0)`。
/// 2026-07-27 立:退出时持久化所有窗口状态(main + admin)。
/// 2026-09-27 立:补"到点必然终止"兜底。`app.exit(0)` 只是向事件循环投递
/// `Message::RequestExit`,runtime 侧处理它时仅把控制流设成 `ControlFlow::Exit`
/// (实测 tauri-runtime-wry 2.11.4 `Message::RequestExit` 分支)——事件循环一旦被
/// 任何主线程工作占住,这条退出请求就永不消费;而当时前端 quit 链与退出遮罩都没有出口
/// (QuitUpdateOverlay 四态无按钮/无取消/无超时,该遮罩已于 2026-09-27 随整条链移除),
/// 用户侧表现就是"正在退出..."永久转圈、进程不终止。宽限期在独立线程计时,不与事件循环争资源。
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    // 2026-09-28:退出序列抽成 exit_application(),与托盘「退出」、「关闭窗口→退出」
    // (close_behavior=quit)、resolve_close_choice 共用同一份实现 —— 四处算同一件事,
    // 各写一遍必然漂移(兜底武装顺序就是其中最容易漂的一步)。
    exit_application(&app);
}

/// 前端显式设置原生窗控按钮深浅主题(2026-10-18):
/// dark_bg=true=网页顶栏深底(白字),false=浅顶栏(深字)。
/// 多数情况由 Rust 按加载 URL 自动判定;前端切换暗色模式时可主动调用。
#[tauri::command]
fn set_caption_button_theme(label: String, dark_bg: bool) {
    window_chrome::set_caption_theme(&label, dark_bg);
}

/// 真正终止进程的**唯一**序列,由 quit_app / tray.quit / 关窗决策 / resolve_close_choice 共用。
///
/// 兜底必须**先武装、后干活**。2026-09-27 真机复现:遮罩停在「正在退出...」而本函数新增的
/// 那条 ERROR 计数为 0 ⇒ 执行流从未走到 arm_forced_exit 那一行,即它被上面某个
/// save_window_state 卡住了(store 访问 / 窗口几何取值 / 落盘都可能阻塞)。兜底写在会被卡住
/// 的代码之后,等于没有兜底。
fn exit_application(app: &tauri::AppHandle) {
    arm_forced_exit(app, QUIT_FORCED_EXIT_GRACE_SECS);
    let _ = save_window_state(Some("main".to_string()), app.clone());
    let _ = save_window_state(Some("admin".to_string()), app.clone());
    app.exit(0);
}

/// 退出的强制终止宽限期(秒):留给正常事件循环走完的时间,到点即强杀。
/// 托盘「退出」与 `quit_app` 共用这一把表。
const QUIT_FORCED_EXIT_GRACE_SECS: u64 = 3;

/// 装上"到点必然终止进程"的兜底,**只在用户已明确要求退出**时调用。
///
/// 2026-09-27 简化:此前是一块**可续期租约**(`renew_quit_lease` + 前端续租),用来给
/// "托盘退出 → 交给前端查更新/装更新"那条链留时间。那条链同日整条撤掉(见 tray.quit
/// 分支注释)—— 更新能力并没有丢:启动有静默检查,托盘另有独立「检查更新」项且会报结果。
/// 留着租约等于给一条不存在的通路留出口,故退回一把固定计时器。
fn arm_forced_exit(app: &tauri::AppHandle, grace_secs: u64) {
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(grace_secs));
        log::error!(
            "[desktop] app.exit(0) 未在 {}s 内终止进程(事件循环未消费退出请求),强制退出",
            grace_secs
        );
        handle.cleanup_before_exit();
        std::process::exit(0);
    });
}

/// 启动健康门的等待档(毫秒)与轮询步长。
///
/// 60s 不是"随手比 15s 大一点":这一档的动作是**不可逆的退出**,而旧那 15s 档的动作
/// 只是一次多余的 `show()` —— 判错的代价不同量级,阈值就不能沿用。取 60s 的依据是
/// 本机现读的现场:并发构建把机器压满时首屏可慢到十几秒,而离线冷启动那一支在
/// ≈24–30s(`auto_refresh` 启动探活最多 2 次 × 12s)就已经把窗口导航到离线兜底页,
/// 那次导航同样会置位 `MAIN_PAGE_READY` ⇒ 正常慢启动不会被误杀。
const STARTUP_HEALTH_GATE_TIMEOUT_MS: u64 = 60_000;
const STARTUP_HEALTH_GATE_POLL_MS: u64 = 200;

/// 票 L7220 P3(2026-10-21 立):把"webview 到底建出来没有"这条判据**后置到事件循环
/// 之后**的执行体 —— 它就是旧 15s 兜底线程的替身。
///
/// 为什么要替身(取证摘要,细节见 `MAIN_PAGE_READY` 头注与 `startup_guard.rs` 模块头注):
/// 旧守卫写成 `app.get_webview_window("main").is_none()` ⇒ 判,而 tauri 2.11 的
/// `CreateWebview` 是异步投递、立即返回 Ok,真失败只在事件循环里写一行 `log::error!`,
/// 窗口仍以 `webviews: []` 注册 ⇒ 这条判据在**目标失效型**下结构上打不中(实测 40 次
/// 启动开火 0 次);而旧兜底线程用 `is_visible()` 问"亮没亮",同一个失效型下那个阻塞
/// getter 永不返回 ⇒ 也静默。两处都判不到的那一段,就是"静默半启动"。
///
/// 现在判据换成唯一还活着的那一头:**主文档加载完成过没有**(`on_page_load` 的 Finished
/// 回调置位)。超时仍为 false ⇒ 这一轮界面永远不会有任何东西可看,按"僵尸实例"处理:
/// 报名 ERROR → 经同一枚通知出口喊到人 → 停掉常驻循环 → 走全仓唯一退出序列。
///
/// ⚠️ 本函数体内**只允许读原子标志**:不得出现任何阻塞式窗口 getter(取 URL 那个
/// `url()` 与取可见性那个 `is_visible()`)。理由不是洁癖:本门要抓的正是"事件循环/
/// 渲染端已经不在"那一型,而在同一型下这两个 getter 永不返回 —— 一个"检测卡死"的探测器
/// 自己卡在卡本身上,等于没有检测。这条由 lib.rs 测试
/// `兜底线程体内不得出现阻塞式窗口getter` 按"从函数签名起做括号配平取体、在体内搜
/// 带前导点的两者"钉住(反向对照:在体内加一处取 URL 的调用即红)。
///
/// 如实登记取舍:摘掉 `show()` 那一腿之后,"页面卡住但窗口在位"那一型不再得到一个
/// 黑窗可看,而是在 60s 后得到一条系统通知 + 进程退出。判据换成不可逆动作,代价就必须
/// 换方向 —— 旧那一腿的语义(绝不黑窗)由 `on_page_load` 点亮那一支单独保住。
fn startup_health_gate(app: tauri::AppHandle) {
    let start = std::time::Instant::now();
    loop {
        if main_page_ready() {
            return;
        }
        if start.elapsed().as_millis() as u64 >= STARTUP_HEALTH_GATE_TIMEOUT_MS {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(
            STARTUP_HEALTH_GATE_POLL_MS,
        ));
    }
    log::error!(
        "[desktop] 启动健康门:{}ms 内主文档从未加载完成(webview 未建成 / 事件循环未消费建窗消息);\
         本进程既不显示也没有可投递的对象,按僵尸实例收口:通知 + 停常驻循环 + 退出。\
         同型判据的历史见 MAIN_PAGE_READY 头注与 startup_guard.rs 模块头注第 1/6 条",
        STARTUP_HEALTH_GATE_TIMEOUT_MS / 1000
    );
    auto_refresh::notify(
        &app,
        "智汇AI",
        "本次启动未能加载界面,已自动退出 —— 请再双击一次图标",
    );
    auto_refresh::request_shutdown();
    exit_application(&app);
}

/// 重启应用(2026-07-31 立,updater 安装完成后调用)。
/// Tauri 2 标准 API `app.restart()`:终止当前进程并以新进程拉起同路径可执行文件。
/// 用于 updater 下载安装完毕后让新版本立即生效,无需用户手动关闭再打开。
#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    // 持久化窗口状态后再重启,避免重启后窗口位置丢失
    let _ = save_window_state(Some("main".to_string()), app.clone());
    let _ = save_window_state(Some("admin".to_string()), app.clone());
    app.restart();
}

/// 唤起 / 创建 admin 窗口(2026-07-25 立,供前端 menu dispatcher 调用)。
/// admin 已存在则 show + focus;否则按 tauri.conf.json admin 配置新建。
/// 2026-07-27 立:新建后恢复 admin 窗口上次位置/尺寸(若有保存)+ 添加窗口阴影。
#[tauri::command]
async fn open_admin_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("admin") {
        log::info!("[window-show] site=admin_existing trigger=前端 menu dispatcher 调 open_admin_window(admin 已存在分支,label=admin)");
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    let app_name = localized_app_name();
    // 2026-09-17 薄壳化配套修复:admin 窗口原用 WebviewUrl::App("admin"),
    // 薄壳后 frontendDist 改为 src-tauri/shell(仅占位页),App 路径会解析为不存在的
    // shell/admin → 空白窗口。改为加载线上管理后台同源页面。
    let admin_url = std::env::var("IHUI_ADMIN_URL")
        .unwrap_or_else(|_| "https://aizhs.top/admin".to_string());
    let _admin_window = WebviewWindowBuilder::new(&app, "admin", WebviewUrl::External(
        admin_url.parse().map_err(|e| format!("admin url: {e}"))?,
    ))
    .title(&format!("{} 管理后台", app_name))
    .inner_size(1280.0, 820.0)
    .min_inner_size(1200.0, 720.0)
    .resizable(true)
    .center()
    .decorations(false)
    .shadow(true)
    // HTML 窗控按钮的隐藏 CSS 改由 app 级 on_page_load 动态注入:只有 Rust 侧确认
    // DWM 原生按钮启用成功后才隐藏,避免 DWM 失败时网页按钮也被无条件藏掉(2026-10-18)。
    .build()
    .map_err(|e| e.to_string())?;
    // 先恢复 admin 窗口上次位置/尺寸(若有保存),几何稳定后再启用原生窗控 ——
    // 顺序反了 DWM 会把按钮几何绑在初始 1280x820 上,restore 后按钮错位不绘制
    // (2026-10-18 真机实测,见 window_chrome 模块头)。
    let _ = restore_window_state(Some("admin".to_string()), app.clone());
    // 2026-10-17:admin 窗同样启用 DWM 原生窗控按钮(与 main 窗一致)。
    window_chrome::enable_native_caption_buttons(&_admin_window);
    Ok(())
}

/// 返回托盘菜单 7 项的本地化文案(5 语言全配,与 web 端 i18n 对齐)。
/// 2026-07-29 扩充:新增对话/切换主题/打开设置/检查更新,emit 事件给前端处理。
fn tray_menu_labels() -> [&'static str; 7] {
    match get_system_locale() {
        AppLocale::ZhCn => [
            "新建对话", "显示主窗口", "隐藏主窗口", "切换主题", "打开设置", "检查更新", "退出",
        ],
        AppLocale::ZhTw => [
            "新建對話", "顯示主視窗", "隱藏主視窗", "切換主題", "開啟設定", "檢查更新", "結束",
        ],
        AppLocale::Ko => [
            "새 대화", "메인 창 표시", "메인 창 숨기기", "테마 전환", "설정 열기", "업데이트 확인", "종료",
        ],
        AppLocale::Ja => [
            "新規会話", "メインウィンドウを表示", "メインウィンドウを隠す", "テーマ切替", "設定を開く", "更新確認", "終了",
        ],
        AppLocale::En => [
            "New Chat", "Show Main Window", "Hide Main Window", "Toggle Theme", "Open Settings", "Check for Updates", "Quit",
        ],
    }
}

/// 构建系统托盘(菜单项与分隔线由 `desktop-behavior.json` 的 `tray_menu_items` 决定;
/// 默认 7 项 = 新建对话/显示/隐藏/切换主题/设置/检查更新/退出,与历史逐字同形)。
/// 2026-07-29 扩充:emit 事件给前端处理业务逻辑(新建对话/主题/设置),检查更新调 updater。
/// 2026-09-28 改版:菜单按偏好顺序从登记表 `TRAY_MENU_ITEMS` 构建,不再手列 7 个 builder;
/// 左键语义按 `tray_single_click`。判据(哪些 id 合法、quit 必须在)只有一份,在 desktop_prefs。
fn build_tray(app: &tauri::AppHandle) -> Result<(), String> {
    let labels = tray_menu_labels();
    let prefs = load_desktop_prefs(app);
    let mut menu_builder = MenuBuilder::new(app);
    let mut previous_group: Option<u8> = None;
    for id in &prefs.tray_menu_items {
        let Some(item) = tray_menu_item(id) else {
            // normalize 已把未知 id 丢掉,走到这里说明登记表与判据漂了 —— 喊出来,
            // 而不是静默少一项(菜单少一项在托盘上是看不出来的)。
            log::error!("[desktop] 托盘菜单项 {id} 查不到登记项,已跳过(不应发生)");
            continue;
        };
        let menu_item =
            MenuItemBuilder::with_id(format!("tray.{}", item.id), labels[item.label_index])
                .build(app)
                .map_err(|e| e.to_string())?;
        // 分隔线只插在分组变化处:默认档下产出的正是历史那三条(0|1|2|3 组之间)。
        if matches!(previous_group, Some(group) if group != item.group) {
            menu_builder = menu_builder.separator();
        }
        previous_group = Some(item.group);
        menu_builder = menu_builder.item(&menu_item);
    }
    let menu = menu_builder.build().map_err(|e| e.to_string())?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| "no default window icon".to_string())?;
    TrayIconBuilder::with_id(TrayIconId::new("main"))
        .icon(icon)
        .tooltip(localized_app_name())
        .menu(&menu)
        // 左键语义:Menu(默认档)让托盘层自己弹菜单(tauri 侧默认就是 true,这里显式写出来
        // 是为了让这个字段真的被消费到,而不是靠"不调用 setter"来表达);
        // ToggleWindow 关掉左键弹菜单,改由下面的 Click 处理器切窗口显隐。
        .show_menu_on_left_click(matches!(prefs.tray_single_click, TraySingleClick::Menu))
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray.new_chat" => {
                // emit 事件给前端,前端处理新建对话(切到 /agents + 重置 chat store)
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = window.emit("desktop-tray-action", "new_chat") {
                        log::warn!("[desktop-event] emit desktop-tray-action failed: {}", e);
                    }
                    log::info!("[window-show] site=tray_menu_new_chat trigger=用户点托盘菜单「新建对话」");
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "tray.show" => {
                if let Some(window) = app.get_webview_window("main") {
                    log::info!("[window-show] site=tray_menu_show trigger=用户点托盘菜单「显示主窗口」");
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "tray.hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "tray.theme" => {
                // emit 事件给前端,前端切换主题(light/dark)
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = window.emit("desktop-tray-action", "toggle_theme") {
                        log::warn!("[desktop-event] emit desktop-tray-action failed: {}", e);
                    }
                    log::info!("[window-show] site=tray_menu_theme trigger=用户点托盘菜单「切换主题」");
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "tray.settings" => {
                // emit 事件给前端,前端跳转 /settings
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = window.emit("desktop-tray-action", "open_settings") {
                        log::warn!("[desktop-event] emit desktop-tray-action failed: {}", e);
                    }
                    log::info!("[window-show] site=tray_menu_settings trigger=用户点托盘菜单「设置」");
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "tray.update" => {
                // G-698:托盘→前端检查链发起前推进更新检查世代 —— 静默链
                // (auto_refresh::check_app_update)若有在飞的下载/结果回调,
                // 按 checkId 作废;新检查一旦开始,旧回调没有消费价值。
                auto_refresh::invalidate_inflight_update_checks();
                // emit 事件给前端,前端调 updater plugin 检查更新(带 UI 反馈)
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = window.emit("desktop-tray-action", "check_update") {
                        log::warn!("[desktop-event] emit desktop-tray-action failed: {}", e);
                    }
                    log::info!("[window-show] site=tray_menu_update trigger=用户点托盘菜单「检查更新」");
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "tray.quit" => {
                // 2026-09-27 改:托盘「退出」= **立即退出**,不再把决定权交给前端。
                //
                // 原设计(2026-07-31)是"emit 给前端 → 前端查更新/装更新 → 回头调 quit_app"。
                // 它的代价被真机量出来两次:① 前端那条链可以完全不被接住(监听注册竞态),
                // 而 Rust 单方面在等 —— 先是无上限地等(用户报「永远退不掉」),改成 120s
                // 又被驳回「点了退出还得等 128 秒?那这按钮的意义是什么」;② 遮罩写着
                // 「检查更新」却从不报有没有更新,是一个不给答案的中间步骤。
                //
                // 撤掉这条链**不丢更新能力**:启动有静默检查(use-updater 的 silent check),
                // 托盘另有独立「检查更新」项,那条会明确报 已是最新 / 失败 / 可安装。
                //
                // 兜底仍然"先武装、后干活":save_window_state 会访问 store 与窗口几何,
                // 任一卡住都不该把"退出"这件事一起带走 —— 这条顺序由 exit_application 保证。
                exit_application(app);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            let app = tray.app_handle();
            match event {
                TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                } => {
                    // 双击:切换显示/隐藏(仅非 Windows 平台)
                    // 2026-08-16 修复:Windows 双击会先派发 Click(已显示窗口),再派发
                    // DoubleClick,若在此 hide 会把"单击唤起"的窗口隐藏 → 双击永远=隐藏,
                    // 与预期相反。Windows 上保留单击显示行为,双击不额外处理。
                    #[cfg(not(target_os = "windows"))]
                    {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                log::info!("[window-show] site=tray_double_click trigger=用户双击托盘图标(非 Windows 平台分支)");
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                }
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    ..
                } => {
                    // 现读偏好而不是缓存一份:托盘只在建/拆时重建,而偏好可能已被另一个窗口改掉;
                    // 为省一次 <1KB 的 JSON 读引入第二份真相不值得(点一次托盘才读一次)。
                    match load_desktop_prefs(app).tray_single_click {
                        TraySingleClick::Menu => {
                            // 默认档 = 历史行为逐字不动:菜单由托盘层左键弹出;
                            // Windows 习惯再补一步"显示主窗口并聚焦"
                            // macOS 已通过 menu 显示菜单,不重复处理
                            #[cfg(target_os = "windows")]
                            {
                                if let Some(window) = app.get_webview_window("main") {
                                    if window.is_visible().unwrap_or(false) {
                                        let _ = window.set_focus();
                                    } else {
                                        log::info!("[window-show] site=tray_single_click_menu trigger=用户左键单击托盘(左键=弹菜单档,Windows 补一步显示主窗口)");
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                            }
                        }
                        TraySingleClick::ToggleWindow => {
                            // 用户显式选了"左键当窗口开关"⇒ 全平台生效(这一档的语义就是
                            // 不弹菜单、只切显隐),不再按平台分叉。
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    log::info!("[window-show] site=tray_single_click_toggle trigger=用户左键单击托盘(左键=窗口开关档)");
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        })
        .build(app)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 托盘常驻本地配置(2026-09-02 #2 立,存于 <app_config_dir>/tray-settings.json)。
/// - always_visible:用户开关,"托盘图标常驻任务栏"(默认开)。
/// - promoted_keys:已处理过的 NotifyIconSettings 注册表键名(hash,纯数字字符串)。
///   每个键只在首次出现时自动写一次 IsPromoted=1;之后用户在任务栏设置里
///   手动隐藏该图标的选择会被永久尊重(不再每次启动强制拉回)。
///   键级粒度优于 exe 级:同一 exe 可能同时存在多条历史/当前身份键,
///   exe 级记录会把"另一条新键"误判为已处理而永远跳过(2026-09-02 修复)。
///   旧版 exe 尾段记录(promoted_identities)反序列化时被 serde 忽略作废,自动迁移。
#[cfg(target_os = "windows")]
#[derive(serde::Deserialize, serde::Serialize, Clone)]
#[serde(default)]
struct TraySettings {
    always_visible: bool,
    #[serde(default)]
    promoted_keys: Vec<String>,
}

// 手写 Default:bool 的派生 Default 是 false,会导致默认开关被静默关闭(2026-09-02 修复)
#[cfg(target_os = "windows")]
impl Default for TraySettings {
    fn default() -> Self {
        Self { always_visible: true, promoted_keys: Vec::new() }
    }
}

#[cfg(target_os = "windows")]
fn tray_config_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("tray-settings.json"))
}

/// 读取托盘常驻配置,缺失/损坏时回退默认值(always_visible=true)。
#[cfg(target_os = "windows")]
fn load_tray_settings(app: &tauri::AppHandle) -> TraySettings {
    let Some(path) = tray_config_path(app) else { return TraySettings::default() };
    std::fs::read(&path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

/// 写回托盘常驻配置(目录不存在则创建,失败仅记日志,不影响主流程)。
#[cfg(target_os = "windows")]
fn save_tray_settings(app: &tauri::AppHandle, settings: &TraySettings) {
    let Some(path) = tray_config_path(app) else { return };
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    match serde_json::to_vec_pretty(settings) {
        Ok(bytes) => {
            if let Err(e) = std::fs::write(&path, bytes) {
                log::warn!("[desktop] save tray settings failed: {}", e);
            }
        }
        Err(e) => log::warn!("[desktop] serialize tray settings failed: {}", e),
    }
}

/// 扫描 Win11 注册表 NotifyIconSettings,按 ExecutablePath 尾段匹配本应用托盘身份
/// (dev 的 ihui-desktop.exe 与安装版 IHUI AI.exe 都算),把 IsPromoted 写为 target
/// (1=任务栏常驻 / 0=收入右下角隐藏溢出区)。
///
/// 机制(2026-09-02 #2 立):Win11 22H2+ 把"新出现的托盘图标"默认塞进隐藏溢出区,
/// 用户"拖拽出来常驻"的记忆按图标身份存于 `HKCU\Control Panel\NotifyIconSettings\
/// <hash>\IsPromoted`。AUMID + NIF_GUID 已稳定图标身份,但身份首次出现(dev↔安装版、
/// 首次安装、系统清理)时默认仍是隐藏,用户被迫反复手动拖拽——本函数自动补写。
///
/// force=false(启动自动路径):仅处理 promoted_keys 里未记录的新键,
///   每个键只写一次,此后尊重用户手动调整(含手动隐藏)。
/// force=true(设置开关显式操作):忽略记录,全部匹配键强制写 target。
///
/// 返回是否有注册表写盘 —— 有则在主线程移除并重建托盘图标(NIM_DELETE+NIM_ADD),
/// Explorer 在 NIM_ADD 时读取 IsPromoted,立即生效,无需重启 Explorer。
/// Windows 10 / Win11 22H2 之前无此键,静默跳过(仅靠 GUID 身份记忆,拖拽一次即持久)。
#[cfg(target_os = "windows")]
fn apply_tray_promotion(app: &tauri::AppHandle, target: u32, force: bool) -> bool {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_SET_VALUE};
    use winreg::RegKey;

    // 0) 开关关闭且非显式强制 → 不做任何事
    let mut settings = load_tray_settings(app);
    if !force && !settings.always_visible {
        return false;
    }

    // 1) 候选身份 = dev/安装版二进制名 ∪ 当前进程 exe 名(仅尾段精确匹配,防误伤同名前缀应用)
    let exe = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return false,
    };
    let mut candidates: Vec<String> = vec!["ihui-desktop.exe".into(), "ihui ai.exe".into()];
    if let Some(name) = exe.file_name() {
        let n = name.to_string_lossy().to_lowercase();
        if !candidates.contains(&n) {
            candidates.push(n);
        }
    }

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let Ok(root) =
        hkcu.open_subkey_with_flags("Control Panel\\NotifyIconSettings", KEY_READ | KEY_SET_VALUE)
    else {
        log::info!("[desktop] NotifyIconSettings not present, skip tray promote (pre-Win11 22H2)");
        return false;
    };

    let mut changed = false;
    for sub in root.enum_keys().flatten() {
        let Ok(entry) = root.open_subkey_with_flags(&sub, KEY_READ | KEY_SET_VALUE) else {
            continue;
        };
        let path = entry
            .get_value::<String, _>("ExecutablePath")
            .map(|p| p.replace('/', "\\").to_lowercase())
            .unwrap_or_default();
        let last_segment = path.rsplit('\\').next().unwrap_or("");
        if !candidates.iter().any(|c| c == last_segment) {
            continue;
        }
        // 尊重用户选择:该注册表键已处理过且非显式强制 → 跳过
        if !force && settings.promoted_keys.iter().any(|k| k == &sub) {
            continue;
        }
        if entry.get_value::<u32, _>("IsPromoted").unwrap_or(0) != target
            && entry.set_value("IsPromoted", &target).is_ok()
        {
            changed = true;
            log::info!("[desktop] tray icon IsPromoted={} written: {} ({})", target, sub, path);
        }
        // 记录已处理键名(幂等去重)
        if !settings.promoted_keys.iter().any(|k| k == &sub) {
            settings.promoted_keys.push(sub.clone());
        }
    }

    if !settings.promoted_keys.is_empty() {
        save_tray_settings(app, &settings);
    }
    changed
}

/// 让「托盘图标存在与否」与 `show_tray_icon` 对齐的唯一出口(2026-09-28 立)。
///
/// 拆掉/重建都必须走主线程:托盘是宿主 UI 对象(Windows 上要建在有消息循环的线程上)。
/// `run_on_main_thread` 是**投递**不是阻塞等待,所以从同步命令(它们自己就跑在主线程)里调用
/// 不会自锁 —— 与 `rebuild_tray_on_main_thread` 历史上同一条路径。
/// show=false 时只移除不重建;菜单变化(show=true)也走这里,因为重建会重新读偏好。
fn apply_tray_visibility(app: &tauri::AppHandle, show: bool) {
    let app = app.clone();
    let result = app.clone().run_on_main_thread(move || {
        let _ = app.remove_tray_by_id("main");
        if !show {
            log::warn!("[desktop-prefs] show_tray_icon=false:已移除托盘图标(关窗语义按 quit)");
            return;
        }
        if let Err(e) = build_tray(&app) {
            log::error!("[desktop] tray rebuild failed: {}", e);
        }
    });
    if let Err(e) = result {
        log::error!("[desktop] 无法在主线程上应用托盘显隐(show={show}): {e}");
    }
}

/// 在主线程移除并重建托盘图标,使注册表 IsPromoted 变更即时生效(2026-09-02 #2 立)。
/// 菜单/事件处理器由 build_tray 全量重建,与启动时行为一致。
/// 2026-09-28:实现并入 apply_tray_visibility(同一件事只留一份)。
#[cfg(target_os = "windows")]
fn rebuild_tray_on_main_thread(app: &tauri::AppHandle) {
    apply_tray_visibility(app, true);
}

/// 后台延迟触发托盘常驻写入(2026-09-02 #2 立,target=1,尊重身份记录与开关)。
/// Explorer 在托盘图标注册后才创建 NotifyIconSettings 条目,首次安装时启动瞬间
/// 条目尚不存在,故延迟扫描两次(1.5s / 6s)覆盖;后续启动条目已存在,首次扫描即命中。
#[cfg(target_os = "windows")]
fn schedule_tray_promote(app: &tauri::AppHandle) {
    let handle = app.clone();
    std::thread::spawn(move || {
        for delay in [Duration::from_millis(1500), Duration::from_millis(6000)] {
            std::thread::sleep(delay);
            if apply_tray_promotion(&handle, 1, false) {
                rebuild_tray_on_main_thread(&handle);
            }
        }
    });
}

// ================== Computer Control 命令(10 个)==================

/// 将字符串键名解析为 enigo Key 枚举。
fn parse_key(key: &str) -> Result<Key, String> {
    match key {
        "Enter" | "Return" => Ok(Key::Return),
        "Tab" => Ok(Key::Tab),
        "Escape" | "Esc" => Ok(Key::Escape),
        "Space" => Ok(Key::Space),
        "Backspace" | "BackSpace" => Ok(Key::Backspace),
        "Delete" | "Del" => Ok(Key::Delete),
        "Control" | "Ctrl" => Ok(Key::Control),
        "Shift" => Ok(Key::Shift),
        "Alt" | "Option" => Ok(Key::Alt),
        "Meta" | "Super" | "Win" | "Command" | "Cmd" => Ok(Key::Meta),
        "Home" => Ok(Key::Home),
        "End" => Ok(Key::End),
        "PageUp" => Ok(Key::PageUp),
        "PageDown" => Ok(Key::PageDown),
        "ArrowUp" | "Up" => Ok(Key::UpArrow),
        "ArrowDown" | "Down" => Ok(Key::DownArrow),
        "ArrowLeft" | "Left" => Ok(Key::LeftArrow),
        "ArrowRight" | "Right" => Ok(Key::RightArrow),
        "F1" => Ok(Key::F1),
        "F2" => Ok(Key::F2),
        "F3" => Ok(Key::F3),
        "F4" => Ok(Key::F4),
        "F5" => Ok(Key::F5),
        "F6" => Ok(Key::F6),
        "F7" => Ok(Key::F7),
        "F8" => Ok(Key::F8),
        "F9" => Ok(Key::F9),
        "F10" => Ok(Key::F10),
        "F11" => Ok(Key::F11),
        "F12" => Ok(Key::F12),
        _ if key.chars().count() == 1 => {
            // 2026-07-22 P0 Round 5:显式 match 防 panic(虽有 count==1 守护,但 unwrap 写法不安全)
            match key.chars().next() {
                Some(ch) => Ok(Key::Unicode(ch)),
                None => Err(format!("Empty key: {}", key)),
            }
        }
        _ => Err(format!("Unknown key: {}", key)),
    }
}

#[tauri::command]
async fn screenshot_screen(
    display_index: Option<usize>,
    region: Option<Vec<f64>>,
) -> Result<ScreenshotResult, String> {
    let screens = Screen::all().map_err(|e| e.to_string())?;
    let idx = display_index.unwrap_or(0);
    let screen = screens
        .get(idx)
        .ok_or(format!("Display index {} not found", idx))?;
    let img = if let Some(r) = region {
        if r.len() < 4 {
            return Err("region must be [x, y, w, h]".to_string());
        }
        // 2026-08-16 防御:负值/零尺寸会被截断成 u32 导致回绕成巨大区域,加显式校验
        if r[2] <= 0.0 || r[3] <= 0.0 || r[0] < 0.0 || r[1] < 0.0 {
            return Err(format!(
                "region 必须为屏幕内非负坐标且宽高为正,got [{}, {}, {}, {}]",
                r[0], r[1], r[2], r[3]
            ));
        }
        screen
            .capture_area(r[0] as i32, r[1] as i32, r[2] as u32, r[3] as u32)
            .map_err(|e| e.to_string())?
    } else {
        screen.capture().map_err(|e| e.to_string())?
    };
    let dyn_img = image::DynamicImage::ImageRgba8(img);
    let mut buf = Cursor::new(Vec::new());
    dyn_img
        .write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    let screenshot = base64::engine::general_purpose::STANDARD.encode(buf.into_inner());
    Ok(ScreenshotResult { screenshot })
}

#[tauri::command]
async fn mouse_move(x: f64, y: f64, absolute: Option<bool>) -> Result<OkResult, String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    let coord = if absolute.unwrap_or(true) {
        Coordinate::Abs
    } else {
        Coordinate::Rel
    };
    enigo
        .move_mouse(x as i32, y as i32, coord)
        .map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

#[tauri::command]
async fn mouse_click(
    x: f64,
    y: f64,
    button: Option<String>,
    count: Option<u32>,
) -> Result<OkResult, String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo
        .move_mouse(x as i32, y as i32, Coordinate::Abs)
        .map_err(|e| e.to_string())?;
    let btn = match button.as_deref().unwrap_or("left") {
        "left" => Button::Left,
        "right" => Button::Right,
        "middle" => Button::Middle,
        other => return Err(format!("Unknown button: {}", other)),
    };
    // 2026-07-22 P1 鲁棒性加固:count 上限 10,防止恶意调用方传 1000000 长时间点击
    let n = count.unwrap_or(1).min(10);
    for _ in 0..n {
        enigo
            .button(btn, Direction::Click)
            .map_err(|e| e.to_string())?;
    }
    Ok(OkResult { ok: true })
}

#[tauri::command]
async fn keyboard_type(text: String, delay: Option<u64>) -> Result<OkResult, String> {
    // 2026-07-22 P1 鲁棒性加固:防止超长 text 卡死 UI
    const MAX_TEXT_LEN: usize = 10000;
    if text.chars().count() > MAX_TEXT_LEN {
        return Err(format!("text too long: max {} chars", MAX_TEXT_LEN));
    }
    // 2026-08-16 加固:delay 无上限 + 同步命令在主线程执行,大 delay(如 5000ms)
    // 可让 UI 假死数小时。单字符间隔上限 100ms,总耗时上限 10s,超出后停止输入
    // (返回成功,避免调用方收到 Err 后重试造成重复输入)。
    const MAX_DELAY_MS: u64 = 100;
    const MAX_TOTAL_MS: u64 = 10_000;
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    if let Some(ms) = delay {
        let ms = ms.min(MAX_DELAY_MS);
        if ms > 0 {
            let mut elapsed = 0u64;
            for ch in text.chars() {
                enigo
                    .text(&ch.to_string())
                    .map_err(|e| e.to_string())?;
                if elapsed + ms > MAX_TOTAL_MS {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(ms));
                elapsed += ms;
            }
            return Ok(OkResult { ok: true });
        }
    }
    enigo.text(&text).map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

#[tauri::command]
async fn mouse_scroll(
    delta_y: f64,
    x: Option<f64>,
    y: Option<f64>,
) -> Result<OkResult, String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    if let (Some(x), Some(y)) = (x, y) {
        enigo
            .move_mouse(x as i32, y as i32, Coordinate::Abs)
            .map_err(|e| e.to_string())?;
    }
    enigo
        .scroll(delta_y as i32, Axis::Vertical)
        .map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

#[tauri::command]
async fn keyboard_press(key: String) -> Result<OkResult, String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    let k = parse_key(&key)?;
    enigo.key(k, Direction::Click).map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

#[tauri::command]
async fn keyboard_hotkey(keys: Vec<String>) -> Result<OkResult, String> {
    // 2026-07-22 P1 鲁棒性加固:防止超多 keys 长时间占用
    if keys.len() > 10 {
        return Err("too many keys: max 10".to_string());
    }
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    let parsed: Vec<Key> = keys
        .iter()
        .map(|k| parse_key(k))
        .collect::<Result<_, _>>()?;
    for k in &parsed {
        enigo
            .key(k.clone(), Direction::Press)
            .map_err(|e| e.to_string())?;
    }
    for k in parsed.iter().rev() {
        enigo
            .key(k.clone(), Direction::Release)
            .map_err(|e| e.to_string())?;
    }
    Ok(OkResult { ok: true })
}

/// Windows: winapi(GetForegroundWindow + GetWindowTextW + GetWindowRect + 进程映像名);其他平台未实现。
#[cfg(windows)]
mod active_window_impl {
    use winapi::shared::windef::RECT;
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::winbase::QueryFullProcessImageNameW;
    use winapi::um::winuser::{
        GetForegroundWindow, GetWindowRect, GetWindowTextLengthW, GetWindowTextW,
        GetWindowThreadProcessId,
    };

    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

    pub fn get() -> Result<super::WindowInfo, String> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return Err("No foreground window".to_string());
            }
            let len = GetWindowTextLengthW(hwnd);
            let mut title_buf: Vec<u16> = vec![0u16; len as usize + 1];
            let written = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), title_buf.len() as i32);
            let title = String::from_utf16_lossy(&title_buf[..written.max(0) as usize]);

            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);
            let app_name = if pid != 0 {
                process_name(pid).unwrap_or_default()
            } else {
                String::new()
            };

            // 2026-08-16:获取前台窗口在屏幕上的矩形 [x, y, width, height]。
            // GetWindowRect 返回屏幕坐标(left/top/right/bottom);最小化窗口的坐标是 -32000,
            // 且 width/height 非正,此时返回占位 [0,0,0,0],避免前端拿到异常坐标。
            let mut rect: RECT = std::mem::zeroed();
            let bounds = if GetWindowRect(hwnd, &mut rect) != 0 {
                let w = rect.right - rect.left;
                let h = rect.bottom - rect.top;
                if w > 0 && h > 0 {
                    [rect.left, rect.top, w, h]
                } else {
                    [0, 0, 0, 0]
                }
            } else {
                [0, 0, 0, 0]
            };

            Ok(super::WindowInfo {
                title,
                app_name,
                window_id: format!("{}", hwnd as usize),
                bounds,
            })
        }
    }

    /// 通过进程映像路径提取可执行文件名(去 .exe 后缀)。
    fn process_name(pid: u32) -> Result<String, String> {
        unsafe {
            let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if h.is_null() {
                return Err("OpenProcess failed".to_string());
            }
            let mut size: u32 = 1024;
            let mut buf: Vec<u16> = vec![0u16; 1024];
            let ok = QueryFullProcessImageNameW(h, 0, buf.as_mut_ptr(), &mut size);
            CloseHandle(h);
            if ok == 0 {
                return Err("QueryFullProcessImageNameW failed".to_string());
            }
            let path = String::from_utf16_lossy(&buf[..size as usize]);
            let base = path.rsplit(|c| c == '\\' || c == '/').next().unwrap_or(&path);
            if base.len() > 4 && base[base.len() - 4..].eq_ignore_ascii_case(".exe") {
                Ok(base[..base.len() - 4].to_string())
            } else {
                Ok(base.to_string())
            }
        }
    }
}

#[cfg(not(windows))]
mod active_window_impl {
    pub fn get() -> Result<super::WindowInfo, String> {
        Err("active_window only implemented on Windows".to_string())
    }
}

#[tauri::command]
fn active_window() -> Result<ActiveWindowResult, String> {
    Ok(ActiveWindowResult {
        window: active_window_impl::get()?,
    })
}

// ================== 本地文件访问 ==================

#[derive(Serialize)]
struct FileInfo {
    path: String,
    name: String,
    size: u64,
    is_dir: bool,
    extension: String,
}

#[derive(Serialize)]
struct ReadTextResult {
    content: String,
    size: u64,
}

#[derive(Serialize)]
struct ReadBinaryResult {
    base64: String,
    size: u64,
    mime: String,
}

#[derive(Serialize)]
struct DirListResult {
    entries: Vec<FileInfo>,
}

/// 词法规范化路径:解析 `.` / `..`,不做 IO(不存在的路径也能规范化)。
fn normalize_path(p: &std::path::Path) -> std::path::PathBuf {
    use std::path::Component;
    let mut out = std::path::PathBuf::new();
    for comp in p.components() {
        match comp {
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// 2026-08-16 安全加固:自定义文件命令不受 capabilities 约束(仅约束插件命令),
/// 此前 read/write/list/stat 接受任意路径,webview 被 XSS(应用渲染 LLM 内容)
/// 后可读写/外带用户任意文件。统一限制在 app_data_dir 内。
fn ensure_in_app_data(
    app: &tauri::AppHandle,
    path: &str,
) -> Result<std::path::PathBuf, IpcError> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| IpcError::internal(format!("app_data_dir 解析失败: {}", e)))?;
    let p = std::path::Path::new(path);
    if !p.is_absolute() {
        // 这两支都是宿主的策略拒绝(安全边界),归 permission 而不是 internal:
        // 前端据此才能区分"这条路径被沙箱挡了"与"宿主坏了"。
        return Err(IpcError::permission(format!("路径必须是绝对路径(拒绝): {}", path)));
    }
    let p_norm = normalize_path(p);
    let app_data_norm = normalize_path(&app_data);
    if !p_norm.starts_with(&app_data_norm) {
        return Err(IpcError::permission(format!(
            "路径不在应用数据目录内(拒绝): {}",
            path
        )));
    }
    Ok(p_norm)
}

/// 读取文本文件(UTF-8)。路径仅允许 app_data_dir 内。
#[tauri::command]
async fn read_text_file(app: tauri::AppHandle, path: String) -> Result<ReadTextResult, IpcError> {
    let path = ensure_in_app_data(&app, &path)?;
    let metadata = std::fs::metadata(&path).map_err(|e| IpcError::from_io("metadata", &path, e))?;
    let size = metadata.len();
    let content =
        std::fs::read_to_string(&path).map_err(|e| IpcError::from_io("read_to_string", &path, e))?;
    Ok(ReadTextResult { content, size })
}

/// 读取二进制文件,返回 base64 + MIME(用于图片/附件预览)。路径仅允许 app_data_dir 内。
/// 2026-08-16 加固:限制文件大小上限 50MB,防止大文件 OOM
/// (base64 编码会膨胀约 4/3,GB 级文件会把内存直接打爆)。
const MAX_BINARY_FILE_SIZE: u64 = 50 * 1024 * 1024;

#[tauri::command]
async fn read_binary_file(app: tauri::AppHandle, path: String) -> Result<ReadBinaryResult, IpcError> {
    let path = ensure_in_app_data(&app, &path)?;
    let metadata = std::fs::metadata(&path).map_err(|e| IpcError::from_io("metadata", &path, e))?;
    let size = metadata.len();
    if size > MAX_BINARY_FILE_SIZE {
        // 配额拒绝也是宿主拒的,不是宿主坏 ⇒ permission。
        return Err(IpcError::permission(format!(
            "file too large: max 50MB ({} bytes), got {} bytes",
            MAX_BINARY_FILE_SIZE, size
        )));
    }
    let bytes = std::fs::read(&path).map_err(|e| IpcError::from_io("read", &path, e))?;
    let base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let mime = mime_from_extension(&path.to_string_lossy());
    Ok(ReadBinaryResult { base64, size, mime })
}

/// 写入文本文件(覆盖)。父目录不存在时自动创建。路径仅允许 app_data_dir 内。
#[tauri::command]
async fn write_text_file(
    app: tauri::AppHandle,
    path: String,
    content: String,
) -> Result<OkResult, IpcError> {
    let path = ensure_in_app_data(&app, &path)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| IpcError::from_io("create_dir_all", parent, e))?;
    }
    std::fs::write(&path, content).map_err(|e| IpcError::from_io("write", &path, e))?;
    Ok(OkResult { ok: true })
}

/// 列出目录下的文件/子目录(非递归)。路径仅允许 app_data_dir 内。
#[tauri::command]
async fn list_dir(app: tauri::AppHandle, path: String) -> Result<DirListResult, IpcError> {
    let path = ensure_in_app_data(&app, &path)?;
    let mut entries = Vec::new();
    let dir = std::fs::read_dir(&path).map_err(|e| IpcError::from_io("read_dir", &path, e))?;
    for entry in dir {
        let entry = entry.map_err(|e| IpcError::from_io("read_dir entry", &path, e))?;
        let metadata = entry
            .metadata()
            .map_err(|e| IpcError::from_io("entry metadata", &entry.path(), e))?;
        let path_str = entry.path().to_string_lossy().to_string();
        let name = entry.file_name().to_string_lossy().to_string();
        let extension = entry
            .path()
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default();
        entries.push(FileInfo {
            path: path_str,
            name,
            size: metadata.len(),
            is_dir: metadata.is_dir(),
            extension,
        });
    }
    // 文件在前,目录在后,各自按名称排序
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .reverse()
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(DirListResult { entries })
}

/// 获取单个文件/目录的元信息。路径仅允许 app_data_dir 内。
#[tauri::command]
async fn stat_file(app: tauri::AppHandle, path: String) -> Result<FileInfo, IpcError> {
    let path = ensure_in_app_data(&app, &path)?;
    let metadata = std::fs::metadata(&path).map_err(|e| IpcError::from_io("metadata", &path, e))?;
    let path_obj = std::path::Path::new(&path);
    let name = path_obj
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let extension = path_obj
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();
    Ok(FileInfo {
        path: path.to_string_lossy().to_string(),
        name,
        size: metadata.len(),
        is_dir: metadata.is_dir(),
        extension,
    })
}

/// 从文件扩展名推断 MIME 类型(常用类型)。
fn mime_from_extension(path: &str) -> String {
    let ext = std::path::Path::new(path)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "png" => "image/png".to_string(),
        "jpg" | "jpeg" => "image/jpeg".to_string(),
        "gif" => "image/gif".to_string(),
        "webp" => "image/webp".to_string(),
        "svg" => "image/svg+xml".to_string(),
        "bmp" => "image/bmp".to_string(),
        "pdf" => "application/pdf".to_string(),
        "txt" | "md" | "log" | "csv" | "json" | "xml" | "yml" | "yaml" | "toml" => {
            "text/plain".to_string()
        }
        "mp3" | "wav" | "ogg" | "m4a" => "audio/mpeg".to_string(),
        "mp4" | "webm" | "mov" | "avi" | "mkv" => "video/mp4".to_string(),
        "zip" | "gz" | "tar" | "rar" | "7z" => "application/zip".to_string(),
        _ => "application/octet-stream".to_string(),
    }
}

// ================== 窗口状态持久化 ==================

use tauri_plugin_store::StoreExt;

const WINDOW_STORE_FILE: &str = "window-state.json";

/// 窗口状态写盘节流:Resized/Moved 事件每帧触发,记录 label → 上次写盘时刻,
/// 同一窗口 300ms 内最多合并写一次盘(注释与实现一致:避免拖动过程中高频写盘)。
static WINDOW_STATE_LAST_SAVE: LazyLock<Mutex<HashMap<String, Instant>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// 节流保存窗口状态:300ms 内同一窗口的 Resized/Moved 重复事件直接忽略。
fn debounce_save_window_state(label: String, app: tauri::AppHandle) {
    const DEBOUNCE: Duration = Duration::from_millis(300);
    let now = Instant::now();
    {
        let mut last = WINDOW_STATE_LAST_SAVE.lock().unwrap();
        if let Some(prev) = last.get(&label) {
            if now.duration_since(*prev) < DEBOUNCE {
                return;
            }
        }
        last.insert(label.clone(), now);
    }
    let _ = save_window_state(Some(label), app);
}

/// 生成窗口状态 store key(格式: window.<label>.<field>),区分 main/admin 窗口。
/// 2026-07-27 立:支持多窗口独立持久化位置/尺寸/最大化状态。
fn win_key(label: &str, field: &str) -> String {
    format!("window.{}.{}", label, field)
}

/// 保存指定窗口当前位置 / 尺寸 / 最大化状态到 store。
/// label: 窗口标签(main/admin),默认 "main"。2026-07-27 立:支持多窗口独立持久化。
#[tauri::command]
fn save_window_state(label: Option<String>, app: tauri::AppHandle) -> Result<OkResult, String> {
    let label = label.as_deref().unwrap_or("main");
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("window {} not found", label))?;
    let store = app.store(WINDOW_STORE_FILE).map_err(|e| e.to_string())?;
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let maximized = window.is_maximized().unwrap_or(false);
    store.set(win_key(label, "x"), pos.x);
    store.set(win_key(label, "y"), pos.y);
    store.set(win_key(label, "width"), size.width);
    store.set(win_key(label, "height"), size.height);
    store.set(win_key(label, "maximized"), maximized);
    store.save().map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

/// 从 store 恢复指定窗口位置 / 尺寸 / 最大化状态(应用启动时调用)。
/// label: 窗口标签(main/admin),默认 "main"。
/// 多显示器校验:若窗口中心点不在任何显示器内(外接显示器已断开),fallback 到 center()。
#[tauri::command]
fn restore_window_state(label: Option<String>, app: tauri::AppHandle) -> Result<OkResult, String> {
    let label = label.as_deref().unwrap_or("main");
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("window {} not found", label))?;
    let store = app.store(WINDOW_STORE_FILE).map_err(|e| e.to_string())?;
    // 优先恢复最大化状态
    if let Some(true) = store
        .get(win_key(label, "maximized"))
        .and_then(|v| v.as_bool())
    {
        // 观测点(G-1038429 采样归因用,非 show 调用):持久化的"上次是最大化"会在启动恢复时
        // 被重放,而 tao 的 set_maximized 在 Windows 上是带显示语义的窗口操作 —— 它属于
        // "谁把窗口弄可见了"的候选,必须能在日志里被看见或被排除。
        log::info!("[window-show] site=restore_state_maximize trigger=非 show 调用——恢复持久化最大化(set_maximized 在 Windows 有显示语义),label={}", label);
        let _ = window.maximize();
        return Ok(OkResult { ok: true });
    }
    let x = store.get(win_key(label, "x")).and_then(|v| v.as_i64());
    let y = store.get(win_key(label, "y")).and_then(|v| v.as_i64());
    let w = store.get(win_key(label, "width")).and_then(|v| v.as_u64());
    let h = store
        .get(win_key(label, "height"))
        .and_then(|v| v.as_u64());
    if let (Some(x), Some(y), Some(w), Some(h)) = (x, y, w, h) {
        use tauri::PhysicalPosition;
        use tauri::PhysicalSize;
        // 2026-09-01 修复"窗口过窄":旧版本遗留的 window-state.json 可能保存过
        // 比当前 minWidth 还小的尺寸,直接恢复会让窗口异常窄;同时屏幕分辨率变化
        // 后旧尺寸可能超屏。统一 clamp 到 [min_inner_size, 屏幕可用区 92%]。
        let (cw, ch) = clamp_window_size(&window, w as u32, h as u32);
        if cw != w as u32 || ch != h as u32 {
            log::info!(
                "[desktop] restore window state clamped: {}x{} -> {}x{}",
                w, h, cw, ch
            );
        }
        // 先设置 size,再设置 position,避免最大化状态下 set_position 失效
        let _ = window.set_size(PhysicalSize::new(cw, ch));
        let _ = window.set_position(PhysicalPosition::new(x as i32, y as i32));
        // 多显示器校验:窗口中心点不在任何显示器内时 fallback 到 center()
        // 场景:上次关闭时窗口在外接显示器,本次启动未接外接显示器
        if !is_window_visible_on_any_monitor(&window) {
            let _ = window.center();
        }
    } else {
        // 无持久化记录(首次安装 / reset_window_state 后):按屏幕可用区
        // clamp tauri.conf.json 默认尺寸,避免 2700x900 在低分辨率屏幕上超屏。
        // 2026-09-01 接入:此前 adapt_window_to_screen 仅定义未调用。
        let _ = adapt_window_to_screen(&window);
    }
    Ok(OkResult { ok: true })
}

/// 校验窗口中心点是否在任意一个显示器可见区域内。
/// 用于 restore_window_state 时防止窗口恢复到已断开的外接显示器坐标。
fn is_window_visible_on_any_monitor(window: &tauri::WebviewWindow) -> bool {
    // Manager trait 提供 available_monitors()(已 use tauri::Manager)
    let monitors = match window.available_monitors() {
        Ok(m) => m,
        Err(_) => return true, // 无法获取显示器列表时不拦截,保持原行为
    };
    if monitors.is_empty() {
        return true;
    }
    let win_pos = match window.outer_position() {
        Ok(p) => p,
        Err(_) => return true,
    };
    let win_size = match window.outer_size() {
        Ok(s) => s,
        Err(_) => return true,
    };
    // 窗口中心点
    let center_x = win_pos.x + (win_size.width as i32) / 2;
    let center_y = win_pos.y + (win_size.height as i32) / 2;
    // 中心点在任意显示器范围内即视为可见
    for monitor in monitors {
        let mon_pos = monitor.position();
        let mon_size = monitor.size();
        if center_x >= mon_pos.x
            && center_x <= mon_pos.x + mon_size.width as i32
            && center_y >= mon_pos.y
            && center_y <= mon_pos.y + mon_size.height as i32
        {
            return true;
        }
    }
    false
}

/// 重置指定窗口状态(清除 store 中的窗口记录,下次启动用默认尺寸)。
/// label: 窗口标签(main/admin),默认 "main"。2026-07-27 立:支持多窗口独立重置。
#[tauri::command]
fn reset_window_state(label: Option<String>, app: tauri::AppHandle) -> Result<OkResult, String> {
    let label = label.as_deref().unwrap_or("main");
    let store = app.store(WINDOW_STORE_FILE).map_err(|e| e.to_string())?;
    store.delete(win_key(label, "x"));
    store.delete(win_key(label, "y"));
    store.delete(win_key(label, "width"));
    store.delete(win_key(label, "height"));
    store.delete(win_key(label, "maximized"));
    store.save().map_err(|e| e.to_string())?;
    Ok(OkResult { ok: true })
}

/// 将窗口尺寸限制在 [窗口最小尺寸, 屏幕可用区 92%] 之间(2026-09-01 立)。
///
/// 背景:用户反馈"安装后初始打开的尺寸太窄"——(a) 默认 1200 宽在侧边栏 160px +
/// AI 面板 380px 的布局下内容区仅 ~660px;(b) 旧版本遗留的 window-state.json 可能
/// 保存过更窄的尺寸,升级后 restore 直接恢复导致窗口过窄;(c) 低分辨率屏幕(如
/// 1366x768)上默认 2700x900 会超出屏幕。统一在此 clamp:
/// - 下限:窗口 min_inner_size(tauri.conf.json 的 minWidth/minHeight)
/// - 上限:窗口所在显示器可用区的 92%(去掉任务栏/缩放余量)
/// 返回 clamp 后的物理像素尺寸。
fn clamp_window_size(
    window: &tauri::WebviewWindow,
    w: u32,
    h: u32,
) -> (u32, u32) {
    // 下限:窗口 min 尺寸(逻辑像素)→ 物理像素。
    // 优先读 tauri.conf.json 的 minWidth/minHeight(单一来源,避免硬编码漂移);
    // 若当前窗口不在 conf 定义(如 admin 由 builder 创建)则 fallback 主窗口默认值。
    let scale = window.scale_factor().unwrap_or(1.0);
    let min = window
        .app_handle()
        .config()
        .app
        .windows
        .iter()
        .find(|c| c.label == window.label())
        .and_then(|c| match (c.min_width, c.min_height) {
            (Some(mw), Some(mh)) => Some(tauri::PhysicalSize::new(
                (mw * scale) as u32,
                (mh * scale) as u32,
            )),
            _ => None,
        })
        .unwrap_or(tauri::PhysicalSize::new(1100, 720));
    // 上限:窗口所在显示器(优先 current,fallback primary)可用区 92%
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());
    if let Some(m) = monitor {
        let msize = m.size();
        let max_w = ((msize.width as f64) * 0.92) as u32;
        let max_h = ((msize.height as f64) * 0.92) as u32;
        let cw = w.clamp(min.width, max_w.max(min.width));
        let ch = h.clamp(min.height, max_h.max(min.height));
        return (cw, ch);
    }
    (w.max(min.width), h.max(min.height))
}

/// 启动时把窗口尺寸适配到屏幕(2026-09-01 立)。
/// 无持久化窗口状态(首次安装/重置后)时,tauri.conf.json 的默认尺寸
/// (2700x900)在低分辨率屏幕上会超出可见区,这里按屏幕可用区 clamp。
/// 有持久化状态时由 restore_window_state 恢复(其内部同样 clamp)。
fn adapt_window_to_screen(window: &tauri::WebviewWindow) -> Result<(), String> {
    let current = window.outer_size().map_err(|e| e.to_string())?;
    let (cw, ch) = clamp_window_size(window, current.width, current.height);
    if cw != current.width || ch != current.height {
        window.set_size(tauri::PhysicalSize::new(cw, ch)).map_err(|e| e.to_string())?;
        log::info!("[desktop] window adapted to screen: {}x{} -> {}x{}", current.width, current.height, cw, ch);
    }
    Ok(())
}

/// WebView2 数据目录里**删了就丢用户数据**的名字(2026-09-25 立)。
/// 起因:旧实现把整棵 `EBWebView` 目录 `remove_dir_all` 当作"清理缓存"——用户在设置页点一次
/// "清理缓存",或谁跑一次 `tauri dev`(下面的 dev 分支同样曾经整树删),登录态、本地会话、
/// 已加密的 `ihui-chat` 信封就一起没了。清理缓存不该等于注销并清空本机数据。
const WEBVIEW_DATA_NAMES: [&str; 6] = [
    "Local Storage",
    "Session Storage",
    "IndexedDB",
    "Network",
    "Local State",
    "leveldb",
];

/// 可安全删除的缓存目录(相对 `EBWebView`;`Default/` 下的与根级的都列出)。
/// 只列**重新访问站点就会自动重建**的东西;拿不准的不列(宁可少清,不可误删)。
const WEBVIEW_CACHE_NAMES: [&str; 8] = [
    "Default/Cache",
    "Default/Code Cache",
    "Default/GPUCache",
    "Default/blob_storage",
    "Default/Service Worker/CacheStorage",
    "Default/Service Worker/ScriptCache",
    "GrShaderCache",
    "ShaderCache",
];

/// 白名单与数据名单有任何一段重名 ⇒ 该条整条剔除(配置错误的默认结论是"不删")。
fn webview_cache_paths(root: &std::path::Path) -> Vec<std::path::PathBuf> {
    WEBVIEW_CACHE_NAMES
        .iter()
        .filter(|rel| {
            !rel.split('/')
                .any(|seg| WEBVIEW_DATA_NAMES.contains(&seg))
        })
        .map(|rel| root.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR)))
        .filter(|p| p.is_dir())
        .collect()
}

/// 只删缓存类目录,数据类目录一律保留;返回 (删除数, 在场且被保留的数据目录名)。
fn clear_webview_caches(root: &std::path::Path) -> Result<(usize, Vec<&'static str>), String> {
    // 根目录名不是 EBWebView 就拒删:拼错路径的后果应该是"什么也没清",不是"抹掉一棵树"
    let is_ebwebview = root
        .file_name()
        .map(|n| n.to_string_lossy().eq_ignore_ascii_case("EBWebView"))
        .unwrap_or(false);
    if !is_ebwebview {
        return Err(format!(
            "拒绝清理:目标末段不是 EBWebView({})",
            root.display()
        ));
    }
    let mut cleared = 0usize;
    for p in webview_cache_paths(root) {
        std::fs::remove_dir_all(&p).map_err(|e| format!("{}: {}", p.display(), e))?;
        cleared += 1;
    }
    let skipped = WEBVIEW_DATA_NAMES
        .iter()
        .filter(|n| root.join("Default").join(n).is_dir() || root.join(n).is_dir())
        .copied()
        .collect();
    Ok((cleared, skipped))
}

/// 清理 WebView2 缓存(Windows)。
/// 2026-07-29 #6:prod 模式缓存子目录会无限增长(几个月可达数百 MB),供前端设置项"清理缓存"调用。
/// 2026-09-25:由"整树删"改为"只删缓存白名单"——清理动作不再可能带走登录态与本地会话。
#[tauri::command]
fn clear_webview_cache(app: tauri::AppHandle) -> Result<OkResult, String> {
    #[cfg(target_os = "windows")]
    {
        // identifier 取运行期配置(与 single-instance 锁名、预检等的取源同一枚),
        // 清理动作因此永远只作用于本实例自己的数据目录,不会跨配置误清。
        let identifier = app.config().identifier.clone();
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let webview_root = std::path::Path::new(&local_app_data)
                .join(&identifier)
                .join("EBWebView");
            if webview_root.is_dir() {
                let (cleared, skipped) = clear_webview_caches(&webview_root)?;
                log::info!(
                    "[desktop] WebView2 缓存已由用户清理:删除 {} 个缓存目录,保留 {} 个数据目录({})",
                    cleared,
                    skipped.len(),
                    skipped.join(", ")
                );
            }
        }
    }
    Ok(OkResult { ok: true })
}

#[cfg(test)]
mod webview_cache_tests {
    use super::{clear_webview_caches, webview_cache_paths, WEBVIEW_CACHE_NAMES, WEBVIEW_DATA_NAMES};
    use std::fs;
    use std::path::{Path, PathBuf};

    /// 造一棵最小 WebView2 树:每个名字一个目录,里面各放一个文件,便于事后判"还在不在"。
    fn fixture(tag: &str, dirs: &[&str]) -> PathBuf {
        let root = std::env::temp_dir()
            .join(format!("ihui-wvcache-{}", tag))
            .join("EBWebView");
        let _ = fs::remove_dir_all(root.parent().unwrap());
        for d in dirs {
            let p = root.join(d.replace('/', std::path::MAIN_SEPARATOR_STR));
            fs::create_dir_all(&p).expect("建夹具目录失败");
            fs::write(p.join("payload.bin"), b"must-survive-or-be-deleted-as-a-whole")
                .expect("写夹具文件失败");
        }
        root
    }

    fn exists(root: &Path, rel: &str) -> bool {
        root.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR)).exists()
    }

    fn child_names(dir: &Path) -> Vec<String> {
        let mut v: Vec<String> = fs::read_dir(dir)
            .expect("夹具目录应可读")
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        v.sort();
        v
    }

    #[test]
    fn 配置不变量_缓存白名单里不得有任何数据段() {
        for rel in WEBVIEW_CACHE_NAMES.iter() {
            for seg in rel.split('/') {
                assert!(
                    !WEBVIEW_DATA_NAMES.contains(&seg),
                    "缓存白名单 {} 里出现了数据目录段 {},清理会连带删掉用户数据",
                    rel,
                    seg
                );
            }
        }
    }

    #[test]
    fn 清缓存必须保住登录态与本地会话() {
        let root = fixture(
            "keep-data",
            &[
                "Default/Cache",
                "Default/Code Cache",
                "Default/GPUCache",
                "Default/Local Storage",
                "Default/IndexedDB",
                "Default/Network",
                "GrShaderCache",
            ],
        );
        let (cleared, skipped) = clear_webview_caches(&root).expect("清理应成功");
        assert_eq!(cleared, 4, "应删掉 4 个缓存目录");
        assert!(exists(&root, "Default/Local Storage"), "登录态被删了");
        assert!(exists(&root, "Default/IndexedDB"), "本地会话被删了");
        assert!(exists(&root, "Default/Network"), "Cookie 被删了");
        assert!(!exists(&root, "Default/Cache"), "缓存没被删掉");
        assert_eq!(skipped.len(), 3, "保留清单应如实报出在场的 3 个数据目录");
        let _ = fs::remove_dir_all(root.parent().unwrap());
    }

    #[test]
    fn 目标根目录名不对就整条拒删() {
        let misplaced = std::env::temp_dir().join("ihui-wvcache-wrong-root").join("Default");
        let _ = fs::remove_dir_all(misplaced.parent().unwrap());
        fs::create_dir_all(misplaced.join("Local Storage")).expect("建夹具失败");
        let before = child_names(&misplaced);
        let err = clear_webview_caches(&misplaced).expect_err("末段不是 EBWebView 必须被拒");
        assert!(err.contains("拒绝清理"), "报错文案要能看出是被拒,不是被删:{}", err);
        let after = child_names(&misplaced);
        assert_eq!(before, after, "被拒的同时一个子项都不许少");
        let _ = fs::remove_dir_all(misplaced.parent().unwrap());
    }

    #[test]
    fn 白名单筛出的路径只含在场的目录() {
        let root = fixture("paths", &["Default/Cache", "Default/Session Storage"]);
        let picked = webview_cache_paths(&root);
        assert_eq!(picked.len(), 1, "只应挑中在场的缓存目录: {:?}", picked);
        assert!(picked[0].ends_with("Cache"));
        let _ = fs::remove_dir_all(root.parent().unwrap());
    }
}

/// 根据状态返回本地化托盘 tooltip(2026-07-29 #10)。
/// status: "idle" | "new_message" | "thinking"
fn tray_status_tooltip(status: &str) -> String {
    let base = localized_app_name();
    match get_system_locale() {
        AppLocale::ZhCn => match status {
            "new_message" => format!("{} · 有新消息", base),
            "thinking" => format!("{} · AI 思考中…", base),
            _ => base.to_string(),
        },
        AppLocale::ZhTw => match status {
            "new_message" => format!("{} · 有新訊息", base),
            "thinking" => format!("{} · AI 思考中…", base),
            _ => base.to_string(),
        },
        AppLocale::Ko => match status {
            "new_message" => format!("{} · 새 메시지", base),
            "thinking" => format!("{} · AI 생각 중…", base),
            _ => base.to_string(),
        },
        AppLocale::Ja => match status {
            "new_message" => format!("{} · 新着メッセージ", base),
            "thinking" => format!("{} · AI 思考中…", base),
            _ => base.to_string(),
        },
        AppLocale::En => match status {
            "new_message" => format!("{} · New message", base),
            "thinking" => format!("{} · AI thinking…", base),
            _ => base.to_string(),
        },
    }
}

/// 设置托盘状态(2026-07-29 #10):切换 tooltip 表示新消息/AI 思考中。
/// status: "idle" | "new_message" | "thinking"
#[tauri::command]
fn set_tray_status(app: tauri::AppHandle, status: String) -> Result<(), String> {
    let tray = app
        .tray_by_id("main")
        .ok_or_else(|| "tray icon not found".to_string())?;
    let tooltip = tray_status_tooltip(&status);
    tray.set_tooltip(Some(&tooltip))
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 查询"托盘图标常驻任务栏"开关状态(2026-09-02 #2 立)。
/// 非 Windows 平台无 NotifyIconSettings 概念,恒返回 true(开关显示为开、操作为 no-op)。
#[tauri::command]
fn get_tray_always_visible(app: tauri::AppHandle) -> bool {
    #[cfg(target_os = "windows")]
    {
        load_tray_settings(&app).always_visible
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = &app;
        true
    }
}

/// 设置"托盘图标常驻任务栏"开关(2026-09-02 #2 立)。
/// enabled=true:立即把本应用全部托盘身份 IsPromoted 置 1 并重建托盘(即时常驻),
///   同时记录身份,后续启动不再重复打扰;
/// enabled=false:置 0 并重建托盘(收入溢出区),且后续启动不再强制常驻。
#[tauri::command]
fn set_tray_always_visible(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let mut settings = load_tray_settings(&app);
        settings.always_visible = enabled;
        save_tray_settings(&app, &settings);
        if apply_tray_promotion(&app, if enabled { 1 } else { 0 }, true) {
            rebuild_tray_on_main_thread(&app);
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&app, enabled);
    }
    Ok(())
}

// ================== 行为偏好命令 + 关窗决策(2026-09-28 立)==================

/// 关窗「询问我」这一档的等待闸门(managed state)。
///
/// 为什么要有 `generation`:用户连点两次关闭(或前端慢到上一次还没答完又来了第二次),
/// 若只看 `pending`,旧看门狗会在新询问还没答完时就冲进来落兜底动作。每次询问递增代数,
/// 看门狗只对自己那一代生效。
#[derive(Default)]
struct CloseGate {
    state: Mutex<CloseGateState>,
    answered: std::sync::Condvar,
}

#[derive(Default)]
struct CloseGateState {
    /// 有一次询问挂着;看门狗与 `resolve_close_choice` **各自把它置 false 来认领**,
    /// 保证一次询问只落一个终态(不会出现"兜底 hide 完又跟着答一次 quit")。
    pending: bool,
    /// 前端给的选择原文("hide"/"quit"/"cancel"),仅用于把状态交代清楚,判定不读它。
    answer: Option<String>,
    generation: u64,
}

/// 等前端答复的上限:超过就按「有托盘→hide / 无托盘→quit」兜底,并喊一行 warn。
/// 关窗询问的兜底时限。这条**不是**人的决策时间预算,而是"前端根本没接住这条事件"
/// (webview 卡死 / 监听没注册)的机器故障兜底 —— 3s 会让正常Speed的用户点慢一点就被
/// 兜底顶掉,而迟到的答复按 pending 已认领只能记一笔,用户视角是"弹框自己消失了、
/// 我点什么用没有"(2026-09-28 真机走这一路时实测到的体感)。取 30s:仍然有界,
/// 但人在 30 秒内不可能没注意到一个居中的模态。
const CLOSE_ASK_TIMEOUT_MS: u64 = 30_000;

fn lock_close_gate(gate: &CloseGate) -> std::sync::MutexGuard<'_, CloseGateState> {
    // 事件循环里绝不因为别人 panic 过就再 panic 一次(锁中毒取内值继续)。
    gate.state
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// 开一次询问,返回它的代数。
fn begin_close_ask(app: &tauri::AppHandle) -> u64 {
    let gate = app.state::<CloseGate>();
    let mut st = lock_close_gate(&gate);
    st.generation += 1;
    st.answer = None;
    st.pending = true;
    st.generation
}

/// 命令侧认领这次询问并记下答案。返回 None = 已经没有挂账(超时兜底先认领走了)。
fn submit_close_answer(app: &tauri::AppHandle, choice: &str) -> Option<u64> {
    let gate = app.state::<CloseGate>();
    let mut st = lock_close_gate(&gate);
    if !st.pending {
        log::warn!(
            "[desktop-prefs] 收到关窗答复 {choice},但已无挂起的询问(多半是 {}ms 超时兜底先落了);\
             仍按用户的选择执行,不再另判一次",
            CLOSE_ASK_TIMEOUT_MS
        );
        return None;
    }
    st.pending = false;
    st.answer = Some(choice.to_string());
    let generation = st.generation;
    drop(st);
    gate.answered.notify_all();
    Some(generation)
}

/// 起一个看门狗线程等前端回答,超时才落兜底终态。
///
/// **为什么不能原地等**:`on_window_event` 与同步 `#[tauri::command]` 跑在同一条主线程上,
/// 主线程一停,前端的 `resolve_close_choice` 连进 Rust 的机会都没有 ⇒ 每次必然走超时,
/// 「询问」这一档就成了死代码。等这件事必须离开主线程(与 `arm_forced_exit` 同一条理由)。
/// 用 condvar 等,不忙等、不自旋。
fn spawn_close_ask_watchdog(app: tauri::AppHandle, generation: u64) {
    std::thread::spawn(move || {
        let gate = app.state::<CloseGate>();
        let deadline = Instant::now() + Duration::from_millis(CLOSE_ASK_TIMEOUT_MS);
        // Rust 1.97 起 wait_timeout_while 返回 Result(锁中毒在这一层给出);
        // 中毒时取内值继续判定 —— 事件循环里绝不因为别人 panic 过就把自己也 panic 掉。
        let waited = gate.answered.wait_timeout_while(
            lock_close_gate(&gate),
            deadline.saturating_duration_since(Instant::now()),
            |s| s.generation == generation && s.pending && s.answer.is_none(),
        );
        let mut st = match waited {
            Ok((guard, _timed_out)) => guard,
            Err(poisoned) => poisoned.into_inner().0,
        };
        if st.generation != generation {
            return; // 已被更新的一次询问顶替
        }
        if !st.pending {
            return; // 前端已答复,动作由 resolve_close_choice 落,这里不重复
        }
        st.pending = false; // 认领掉这次决策,此后迟到的答复只会被记一笔
        drop(st);
        // 与本仓「不得有静默无终态路径」同一条禁令:兜底要落,而且要说清为什么落。
        let tray_present = app.tray_by_id("main").is_some();
        log::warn!(
            "[desktop-prefs] 关窗询问 {}ms 内前端未答复 ⇒ 兜底 {}(web 层没接住这条事件?)",
            CLOSE_ASK_TIMEOUT_MS,
            if tray_present { "hide" } else { "quit" }
        );
        if tray_present {
            apply_close_hide(&app);
        } else {
            exit_application(&app);
        }
    });
}

/// 隐藏主窗口 + 持久化状态 —— 与历史「关闭即隐藏到托盘」那条路径逐字同形。
fn apply_close_hide(app: &tauri::AppHandle) {
    match app.get_webview_window("main") {
        Some(window) => {
            let _ = window.hide();
        }
        None => log::warn!("[desktop-prefs] 关窗去向=hide 但 main 窗口不在,无事可做"),
    }
    let _ = save_window_state(Some("main".to_string()), app.clone());
}

/// 落盘 + 托盘副作用 + 广播,`set_desktop_prefs` 与 `resolve_close_choice(remember)` 共用。
/// 顺序固定:合并 → **归一** → 落盘 → 托盘对齐 → 广播 → 回 effective 值。
fn write_desktop_prefs(app: &tauri::AppHandle, patch: DesktopPrefsPatch) -> DesktopPrefs {
    let current = load_desktop_prefs(app);
    let next = normalize_prefs(patch.merge_into(current.clone()));

    if let Err(e) = save_desktop_prefs(app, &next) {
        // 契约把这两个命令的返回类型钉成 DesktopPrefs(不带 Result),所以落盘失败只能在这里喊。
        log::error!("[desktop-prefs] 落盘失败({e}):本次改动只对本次会话生效,重启会回到盘上那份");
    }

    // 托盘只在"形状变了"或"实际存在性与期望不一致"时重建 —— 否则改个角标开关不该让图标闪一下。
    // 顺带自愈:启动时 build_tray 失败(托盘没建出来)也会在这一格被补回来。
    let tray_present = app.tray_by_id("main").is_some();
    let tray_shape_changed = current.tray_menu_items != next.tray_menu_items
        || current.tray_single_click != next.tray_single_click;
    if tray_shape_changed || tray_present != next.show_tray_icon {
        apply_tray_visibility(app, next.show_tray_icon);
    }

    if let Err(e) = app.emit("desktop-prefs-changed", &next) {
        log::warn!("[desktop-event] emit desktop-prefs-changed failed: {}", e);
    }
    next
}

/// 读桌面端行为偏好。返回的一直是**归一后**的 effective 值,前端不需要重算不变量。
#[tauri::command]
fn get_desktop_prefs(app: tauri::AppHandle) -> DesktopPrefs {
    load_desktop_prefs(&app)
}

/// 写桌面端行为偏好(patch 语义:只覆盖带过来的那几档)。
#[tauri::command]
fn set_desktop_prefs(app: tauri::AppHandle, patch: DesktopPrefsPatch) -> DesktopPrefs {
    write_desktop_prefs(&app, patch)
}

/// 前端对 `desktop-close-requested` 的答复。choice ∈ {"hide","quit","cancel"}。
/// `remember=true` 时先把这一档选择落成 `close_behavior`(下次不再问),再执行本次动作。
#[tauri::command]
fn resolve_close_choice(
    app: tauri::AppHandle,
    choice: String,
    remember: bool,
) -> Result<(), String> {
    let normalized = choice.trim().to_lowercase();
    // "记住"必须落在执行**之前**:quit 这一支会把进程带走,顺序反了就永远记不上。
    if remember {
        let behavior = match normalized.as_str() {
            "hide" => Some(CloseBehavior::Hide),
            "quit" => Some(CloseBehavior::Quit),
            // cancel 不是一种"以后都这样"的偏好;非法 choice 交给下面统一报错。
            _ => None,
        };
        if let Some(behavior) = behavior {
            write_desktop_prefs(&app, DesktopPrefsPatch { close_behavior: Some(behavior), ..DesktopPrefsPatch::default() });
        }
    }
    // 先认领挂账(让看门狗退出),再执行 —— 两条都幂等,但顺序反了会短暂出现两个决定者。
    match normalized.as_str() {
        "hide" => {
            submit_close_answer(&app, "hide");
            apply_close_hide(&app);
            Ok(())
        }
        "quit" => {
            submit_close_answer(&app, "quit");
            exit_application(&app);
            Ok(())
        }
        "cancel" => {
            submit_close_answer(&app, "cancel");
            Ok(())
        }
        other => Err(format!("choice 只能是 hide/quit/cancel,收到: {other}")),
    }
}

/// 任务栏红点直径(物理像素):overlay 会被缩到图标一角,画大了只是浪费字节。
const BADGE_DIAMETER_PX: u32 = 16;

/// 画一枚实心红点 RGBA(纯像素运算,不依赖窗口/宿主,因此可单测)。
/// 外缘 1px 线性淡出 —— 16px 下不淡出就是一颗锯齿方块。
fn build_unread_badge_rgba() -> (Vec<u8>, u32, u32) {
    use image::{Rgba, RgbaImage};
    let d = BADGE_DIAMETER_PX;
    let radius = (d as f32 - 1.0) / 2.0;
    let mut img = RgbaImage::from_pixel(d, d, Rgba([0, 0, 0, 0]));
    for y in 0..d {
        for x in 0..d {
            let dx = x as f32 - radius;
            let dy = y as f32 - radius;
            let coverage = (radius + 0.5 - (dx * dx + dy * dy).sqrt()).clamp(0.0, 1.0);
            if coverage <= 0.0 {
                continue;
            }
            img.put_pixel(
                x,
                y,
                Rgba([220, 38, 38, (coverage * 255.0) as u8]),
            );
        }
    }
    (img.into_raw(), d, d)
}

/// 未读红点(Windows 任务栏 overlay icon)。
/// `unread_badge=false` 或 `unread == 0` ⇒ 清掉 overlay;否则盖上红点。
/// 与 `set_tray_status` **刻意不耦合**:角标关掉时 tooltip 仍要照常工作。
#[tauri::command]
fn set_desktop_badge(app: tauri::AppHandle, unread: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let prefs = load_desktop_prefs(&app);
        let window = app.get_webview_window("main").ok_or("main window not found")?;
        if !prefs.unread_badge || unread == 0 {
            return window.set_overlay_icon(None).map_err(|e| e.to_string());
        }
        let (rgba, width, height) = build_unread_badge_rgba();
        window
            .set_overlay_icon(Some(tauri::image::Image::new_owned(rgba, width, height)))
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&app, unread);
        log::info!(
            "[desktop-prefs] set_overlay_icon 是 Windows 专属 API,本平台按 no-op 处理(unread={unread})"
        );
        Ok(())
    }
}

#[tauri::command]
async fn clipboard_get(format: Option<String>) -> Result<ClipboardResult, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let fmt = format.as_deref().unwrap_or("text");
    let result = match fmt {
        "text" => clipboard.get_text().map_err(|e| e.to_string())?,
        "image" => {
            let img = clipboard.get_image().map_err(|e| e.to_string())?;
            let rgba_img = image::RgbaImage::from_raw(
                img.width as u32,
                img.height as u32,
                img.bytes.to_vec(),
            )
            .ok_or("Failed to convert clipboard image")?;
            let dyn_img = image::DynamicImage::ImageRgba8(rgba_img);
            let mut buf = Cursor::new(Vec::new());
            dyn_img
                .write_to(&mut buf, image::ImageFormat::Png)
                .map_err(|e| e.to_string())?;
            base64::engine::general_purpose::STANDARD.encode(buf.into_inner())
        }
        other => return Err(format!("Unknown format: {}", other)),
    };
    Ok(ClipboardResult { clipboard: result })
}

#[tauri::command]
async fn clipboard_set(
    content: String,
    format: Option<String>,
) -> Result<OkResult, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let fmt = format.as_deref().unwrap_or("text");
    match fmt {
        "text" => {
            clipboard
                .set_text(&content)
                .map_err(|e| e.to_string())?;
        }
        "image" => {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(&content)
                .map_err(|e| e.to_string())?;
            let rgba_img = image::load_from_memory_with_format(&bytes, image::ImageFormat::Png)
                .map_err(|e| e.to_string())?
                .to_rgba8();
            let (w, h) = (rgba_img.width() as usize, rgba_img.height() as usize);
            let img_data = arboard::ImageData {
                width: w,
                height: h,
                bytes: std::borrow::Cow::Owned(rgba_img.into_raw()),
            };
            clipboard
                .set_image(img_data)
                .map_err(|e| e.to_string())?;
        }
        other => return Err(format!("Unknown format: {}", other)),
    };
    Ok(OkResult { ok: true })
}

// ================== 深链就绪闸门(2026-09-26 立 · A10C-1「未就绪不丢,就绪后补投」)==================
//
// 立因(冷启动必丢登录码,用户表现"从浏览器/IM 点链接回 App,登录转圈或无反应"):
// 外部协议 `ihui://sso?sso_code=…` 抵达 Rust 的时刻,早于 webview 里
// `listen('desktop-deep-link')` 注册的时刻 —— Tauri 先按 tauri.conf.json 建好 main 窗口,
// 再派发 on_open_url,而前端要等页面加载 + hydration + 动态 chunk 才订阅。
// 旧实现是 `if let Some(window) = … { emit(…) }`(无 else)且只取 `urls().first()`,于是:
//   ① 窗口不存在 ⇒ 整条回调静默蒸发,连一行日志都没有(违 §5e「失败必须响」同一条禁令);
//   ② 窗口在但渲染端还没订阅 ⇒ emit 返回 Ok 而无人接收,同样蒸发(emit 成功不等于送达);
//   ③ 一批多条 URL ⇒ 第 2 条起无人认领,既不投递也不计数。
// 机制(三条硬要求对应下面三处):未投递出去的 URL 一律进**有上限、按 URL 去重**的 pending
// 队列并打日志;渲染端注册完监听后调 `take_pending_deep_links` 一次性取回(取即清 ⇒ 同一个
// code 不会被换两次 token),这次调用同时把闸门标成"已就绪",此后抵达才走直投;
// 溢出丢弃必须 warn + 计数,目标窗口销毁必须清账(不得留跨会话残留把旧码投给下一次冷启动)。
// 与 `chain: continuous` 的分界:队列住在 Rust 侧且**上限/去重/丢弃/清账四处都喊**,
// 不是往实时链里塞"看不见补发"—— 那正是 scripts/check-desktop-event-wiring.mjs 规则 E1 拦的形态。

/// 深链的唯一投递目标窗口 label。take 命令按它绑定,别的窗口取不走(防串号)。
const DEEP_LINK_TARGET_LABEL: &str = "main";
/// 事件名 —— 与 use-desktop.ts 的 `listen('desktop-deep-link')` 逐字同名,守门 G 组按字面量对账。
const DEEP_LINK_EVENT: &str = "desktop-deep-link";
/// 前端取回积压的命令名 —— 与 `invoke_handler!` 注册项、use-desktop.ts 的 `invoke(...)` 逐字同名。
const DEEP_LINK_TAKE_COMMAND: &str = "take_pending_deep_links";
/// pending 队列上限。溢出丢最旧并计数:SSO code 是一次性凭据,留着的最有用的是最新那条。
const DEEP_LINK_PENDING_CAP: usize = 8;
/// 进日志前必须掩掉取值的查询键 —— 深链本体就是一次性登录凭据,不得原样落进日志(§5e 同族要求)。
const DEEP_LINK_SENSITIVE_KEYS: [&str; 4] = ["sso_code", "auth_code", "code", "token"];

/// 日志形态的 URL:结构保留、敏感参数的**取值**换成 `***`。
/// 只掩值不掩键,是因为排查时"带没带 code、还带了哪些参数"正是需要的信息。
fn deep_link_log_form(url: &str) -> String {
    let (head, query) = match url.split_once('?') {
        Some((h, q)) => (h, Some(q)),
        None => (url, None),
    };
    let Some(query) = query else {
        return head.to_string();
    };
    let masked: Vec<String> = query
        .split('&')
        .map(|pair| {
            let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
            if value.is_empty() || !DEEP_LINK_SENSITIVE_KEYS.contains(&key.to_ascii_lowercase().as_str())
            {
                pair.to_string()
            } else {
                format!("{}=***", key)
            }
        })
        .collect();
    format!("{}?{}", head, masked.join("&"))
}

/// 一条 URL 抵达时的去向 —— 刻意只有两个出口,"什么都不做"不是一种出口。
#[derive(Debug, PartialEq, Eq)]
enum DeepLinkDelivery {
    /// 渲染端已就绪:直接 emit
    Emit(String),
    /// 窗口不在 / 渲染端未就绪 / 直投失败回填:暂存等前端取回
    Queue(String),
}

/// 纯函数:由闸门状态决定去向。契约是**输入 N 条 ⇒ 输出必 N 条**(既不丢也不复制)。
/// 变异对照:把"未就绪 ⇒ Queue"改回"未就绪 ⇒ 丢弃",`未就绪时每条都必须入队` 那条用例即红 ——
/// 判据有牙的证明落在这里,而不是"运行时恰好没丢"。
fn decide_deep_link_deliveries(target_ready: bool, urls: &[String]) -> Vec<DeepLinkDelivery> {
    urls
        .iter()
        .map(|url| {
            if target_ready {
                DeepLinkDelivery::Emit(url.clone())
            } else {
                DeepLinkDelivery::Queue(url.clone())
            }
        })
        .collect()
}

/// 有上限、按 URL 去重的待补投队列。两个计数器都存在的意义:丢弃与去重都是"少做了事",
/// 不数出来的话,下游读到的队列长度就无法区分"没有新链接"与"链接被扔了"。
#[derive(Default)]
struct DeepLinkPending {
    urls: VecDeque<String>,
    /// 因重复(已在队里)被跳过的条数
    deduped: usize,
    /// 因溢出被丢弃的条数 —— 静默变短等于伪造完整性
    dropped: usize,
}

impl DeepLinkPending {
    /// 入队:同 URL 去重、超上限丢最旧。返回 true 表示这次真的收下了。
    fn push(&mut self, url: &str) -> bool {
        if self.urls.iter().any(|existing| existing == url) {
            self.deduped += 1;
            log::info!("[deep-link] 同一 URL 已在 pending 队列中,跳过重复入队(累计去重 {} 次)", self.deduped);
            return false;
        }
        self.urls.push_back(url.to_string());
        while self.urls.len() > DEEP_LINK_PENDING_CAP {
            // 只可能弹出刚入队之外的那一条(队首 = 最旧),不存在"把刚收到的丢掉"
            let lost = self.urls.pop_front().unwrap_or_default();
            self.dropped += 1;
            log::warn!(
                "[deep-link] pending 超上限 {} ⇒ 丢弃最旧一条(累计丢弃 {} 条): {}",
                DEEP_LINK_PENDING_CAP,
                self.dropped,
                deep_link_log_form(&lost)
            );
        }
        true
    }

    /// 取回并清空。取即清是幂等的来源:同一条 URL 结构上不可能被补投两次。
    fn take_all(&mut self) -> Vec<String> {
        std::mem::take(&mut self.urls).into_iter().collect()
    }

    /// 清账(目标窗口销毁时调用),返回清掉的条数。
    fn clear(&mut self) -> usize {
        let n = self.urls.len();
        self.urls.clear();
        n
    }
}

#[derive(Default)]
struct DeepLinkGateState {
    /// 渲染端是否已注册监听 —— 由 take_pending_deep_links 置真;目标窗口销毁**或导航发起**时复位。
    /// 未就绪期间(冷启动窗口期 / location.href·reload 造成的渲染端暂存期)抵达的 URL 只进队列,
    /// 不做"发了就当作收到了"的假设。
    target_ready: bool,
    pending: DeepLinkPending,
}

/// 主窗点亮是否被用户"先进托盘/--minimized"压住(setup 写入,on_page_load 回调读取)。
static STARTUP_START_HIDDEN: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// 票 L7220 P3(2026-10-21 立):main 窗的**主文档加载完成**标记,由 `on_page_load`
/// 的 `PageLoadEvent::Finished` 回调置位,由启动健康门(`startup_health_gate`)读。
///
/// 为什么必须另立这一枚,而不是沿用"窗口在不在/看得见看不见":
/// tauri 2.11 把 `CreateWebview` 作为 `send_user_message` **异步投递**并立即返回 `Ok`,
/// 真正的失败只在事件循环里 `log::error!("failed to create webview: …")` —— 窗口仍以
/// `webviews: []` 注册,setup 照跑、`auto_refresh` 常驻循环照起。于是"窗口没建出来"
/// 这件事从外面**读不出来**:`get_webview_window("main")` 回 Some、`is_visible()` 这类
/// 阻塞 getter 在没有渲染端时干脆永不返回。取证实测 40 次启动 / `failed to create
/// webview` 2 次 / 旧守卫"main 窗口未创建"开火 **0 次** —— 判据结构上打不中。
/// 唯一活着的那一头是"页面到底加载完过没有",所以健康门判的就是这一枚原子标志。
static MAIN_PAGE_READY: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// 读主文档加载完成标记(启动健康门与 `auto_refresh` 常驻循环准入共用的唯一输入)。
///
/// 2026-10-22(票 P1 僵尸实例):`auto_refresh::start` 的常驻循环准入也读这一枚 ——
/// 它是全仓唯一能区分"窗口注册了"与"渲染端真的活了"的判据(见 `MAIN_PAGE_READY` 头注),
/// 常驻循环若另立一份判据,两者必然在"创建失败"这一型上给出相反结论。
pub(crate) fn main_page_ready() -> bool {
    MAIN_PAGE_READY.load(std::sync::atomic::Ordering::SeqCst)
}

/// 应用日志主文件名(**不含扩展名**)—— 唯一出处。
///
/// 它同时喂两个地方:①日志插件 `TargetKind::LogDir { file_name }`;②`startup_guard::preflight`
/// 的落账那一行(预检阶段没有 AppHandle,拿不到 `app.path().app_log_dir()`,只能按同一个根
/// 自己拼路径)。写成第二份字面量就等于允许两处各写各的(AGENTS §0.6),所以从这里注入。
const APP_LOG_FILE_STEM: &str = "ihui-desktop";
static DEEP_LINK_GATE: LazyLock<Mutex<DeepLinkGateState>> =
    LazyLock::new(|| Mutex::new(DeepLinkGateState::default()));

/// 取闸门。投递路径上不得因锁中毒而 panic —— 那会把"这一次抵达"变成真的丢掉,
/// 正是本机制要修的那一型;中毒后继续用同一份内容,并把中毒本身喊出来。
fn deep_link_gate() -> std::sync::MutexGuard<'static, DeepLinkGateState> {
    match DEEP_LINK_GATE.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            log::warn!("[deep-link] 闸门锁中毒(前一持有者 panic),仍取回其内容继续投递");
            poisoned.into_inner()
        }
    }
}

/// on_open_url 的唯一投递入口:逐条按闸门状态决定去向。绝不只取 first,绝不静默返回。
fn dispatch_deep_links(app: &tauri::AppHandle, urls: &[String]) {
    if urls.is_empty() {
        log::warn!("[deep-link] on_open_url 抵达但 URL 列表为空 —— 无内容可投递,留这一行而不是静默返回");
        return;
    }
    if urls.len() > 1 {
        log::info!(
            "[deep-link] 一次抵达 {} 条 URL,逐条走闸门(旧实现只取 first,其余静默丢弃)",
            urls.len()
        );
    }

    let window = app.get_webview_window(DEEP_LINK_TARGET_LABEL);
    // 先只读判据、马上放锁:emit 会同步派发 IPC,若在前端回调里再 invoke take,
    // 持锁跨 emit 就是一次自死锁(std Mutex 不可重入)。
    let target_ready = { deep_link_gate().target_ready && window.is_some() };
    let block_reason = match (window.is_some(), target_ready) {
        (false, _) => Some("main 窗口尚未创建"),
        (true, false) => Some("渲染端尚未注册监听(冷启动窗口期)"),
        (true, true) => None,
    };

    let mut emitted = 0usize;
    let mut queued = 0usize;
    let mut deduped = 0usize;
    for delivery in decide_deep_link_deliveries(target_ready, urls) {
        match delivery {
            DeepLinkDelivery::Emit(url) => {
                let Some(w) = window.as_ref() else {
                    // 结构上不可达(target_ready 已含 window.is_some()),仍转入队而不是 panic
                    let mut gate = deep_link_gate();
                    if gate.pending.push(&url) {
                        queued += 1;
                    }
                    continue;
                };
                match w.emit(DEEP_LINK_EVENT, &url) {
                    Ok(_) => emitted += 1,
                    Err(e) => {
                        log::warn!(
                            "[deep-link] emit 失败 ⇒ 回填 pending 等前端取回(不丢弃): {} —— {}",
                            deep_link_log_form(&url),
                            e
                        );
                        let mut gate = deep_link_gate();
                        if gate.pending.push(&url) {
                            queued += 1;
                        } else {
                            deduped += 1;
                        }
                    }
                }
            }
            DeepLinkDelivery::Queue(url) => {
                log::warn!(
                    "[deep-link] {} ⇒ 暂存待补投(未就绪不丢,前端就绪后经 {} 取回): {}",
                    block_reason.unwrap_or("投递条件不成立"),
                    DEEP_LINK_TAKE_COMMAND,
                    deep_link_log_form(&url)
                );
                let mut gate = deep_link_gate();
                if gate.pending.push(&url) {
                    queued += 1;
                } else {
                    deduped += 1;
                }
            }
        }
    }

    let pending_now = deep_link_gate().pending.urls.len();
    log::info!(
        "[deep-link] 本次 {} 条:直投 {} / 入队 {} / 重复跳过 {} / 队列现有 {}",
        urls.len(),
        emitted,
        queued,
        deduped,
        pending_now
    );

    // 唤起动作与投递解耦:即便全部进了 pending,窗口该露脸还是要露脸(用户点了链接就该看到 App)
    if let Some(w) = window {
        log::info!("[window-show] site=deep_link_dispatch trigger=ihui:// 深链抵达 on_open_url(外部浏览器/其他应用唤起,非用户在本机点托盘)");
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// 前端在 `listen('desktop-deep-link')` 注册成功之后立刻调用:一次性取回积压并清账,
/// 同时把闸门标为"已就绪"(此后抵达才允许直投)。
/// 语义:①**取即清** ⇒ 同一 URL 结构上不会被补投两次(第二次取回为空);
/// ②按 label 绑定 ⇒ 非目标窗口(admin)一律空手而归,不会把别人的登录码取走。
#[tauri::command]
fn take_pending_deep_links(window: tauri::WebviewWindow) -> Vec<String> {
    let mut gate = deep_link_gate();
    if window.label() != DEEP_LINK_TARGET_LABEL {
        log::warn!(
            "[deep-link] 窗口 {} 试图取回目标窗口 {} 的深链积压 —— 已拒绝(防投错窗口)",
            window.label(),
            DEEP_LINK_TARGET_LABEL
        );
        return Vec::new();
    }
    let (first_take, backlog) = apply_take_ready(&mut gate);
    log::info!(
        "[deep-link] 渲染端就绪(本次取回点亮就绪标记: {}) —— 补投 {} 条,队列已清空",
        first_take,
        backlog.len()
    );
    backlog
}

/// 目标窗口销毁 ⇒ 闸门清账并复位就绪标记。
/// 不清的后果就是本机制立项时的那一型:残留的 sso_code 活到下一次冷启动,
/// 被投给"另一次会话的渲染端"(凭据串到别人的会话里)。
fn reset_deep_link_gate_on_destroy(label: &str) {
    if label != DEEP_LINK_TARGET_LABEL {
        return;
    }
    let mut gate = deep_link_gate();
    let cleared = gate.pending.clear();
    gate.target_ready = false;
    if cleared > 0 {
        log::warn!(
            "[deep-link] {} 窗口销毁:清掉 {} 条未消费的深链积压(不留跨会话残留),就绪标记已复位",
            DEEP_LINK_TARGET_LABEL,
            cleared
        );
    }
}

/// 导航发起时的状态迁移(纯函数,供单测直接断言):
/// 就绪标记拉回 false,**pending 队列原样保留**。
/// 与 destroy 路径(reset_deep_link_gate_on_destroy)的差别是两条,且都是刻意的:
///  - destroy = 会话终结 ⇒ 清账,旧 code 不得活到下一次冷启动;
///  - 导航 = 同一会话里渲染端短暂不在 ⇒ 已入队的条目是**未兑现的补投债务**,
///    由新页面注册监听后的 take_pending_deep_links 一次取走;导航时清账反而把
///    "未就绪不丢"这条立命之本弄丢。
fn apply_navigation_reset(gate: &mut DeepLinkGateState) -> (bool, usize) {
    let was_ready = gate.target_ready;
    gate.target_ready = false;
    (was_ready, gate.pending.urls.len())
}

/// 渲染端取回时的状态迁移(纯函数):点亮就绪 + 一次性取回积压(取即清)。
/// "就绪"只由这一处置真 —— take 被调用结构上意味着 listen 已注册成功,
/// 这比任何页面加载事件(如 Tauri 的 on_page_load Finished)都强:
/// Finished 只保证文档加载完,不保证监听已挂上,拿它点亮就复刻本机制立项的那一型。
fn apply_take_ready(gate: &mut DeepLinkGateState) -> (bool, Vec<String>) {
    let first_take = !gate.target_ready;
    gate.target_ready = true;
    (first_take, gate.pending.take_all())
}

/// **导航发起处(auto_refresh.rs 的 `location.href` / `location.reload` 各站点)必须先调用本函数**。
/// 页面重载期间渲染端不存在,此时抵达的深链若按"曾经就绪过"直投,emit 会打在一个没有监听者的
/// webview 上静默消失(既不入队也没人消费)—— 与冷启动丢码同型,只是换了触发面。
/// 复位后新 URL 一律走"未就绪 ⇒ 入队";就绪由新页面的 take_pending_deep_links 重新点亮。
/// 若新页面始终没能加载(断网/崩溃),闸门保持"未就绪"——这是正确的保守态:
/// 链接继续留在队列(上限 8 + 丢弃计数),而不是点亮一个不存在监听者的"就绪"。
pub(crate) fn reset_deep_link_gate_for_navigation(label: &str) {
    if label != DEEP_LINK_TARGET_LABEL {
        return;
    }
    let (was_ready, kept_pending) = apply_navigation_reset(&mut deep_link_gate());
    log::info!(
        "[deep-link] 导航发起:就绪标记已复位(原值 {}) —— 导航期间抵达的链接转入队,既有 {} 条补投债务保留待新页取回",
        was_ready,
        kept_pending
    );
}

#[cfg(test)]
mod deep_link_gate_tests {
    use super::{
        apply_navigation_reset, apply_take_ready, decide_deep_link_deliveries, deep_link_log_form,
        DeepLinkDelivery, DeepLinkGateState, DeepLinkPending, DEEP_LINK_PENDING_CAP,
    };

    fn urls(n: usize) -> Vec<String> {
        (0..n).map(|i| format!("ihui://sso?sso_code=c{}", i)).collect()
    }

    /// 核心不变量:决策函数不得让任何一条 URL 蒸发 —— 输入 N 条 ⇒ 输出 N 条去向。
    /// 变异对照:把"未就绪 ⇒ Queue"改回"未就绪 ⇒ 丢弃",下面三条用例立刻红(0 条去向)。
    #[test]
    fn 未就绪时每条都必须有去向且一律入队() {
        for n in 1..=4usize {
            let got = decide_deep_link_deliveries(false, &urls(n));
            assert_eq!(got.len(), n, "{} 条输入必须产出 {} 条去向,少一条就是静默丢弃", n, n);
            assert!(
                got.iter().all(|d| matches!(d, DeepLinkDelivery::Queue(_))),
                "未就绪时不允许出现直投: {:?}",
                got
            );
        }
    }

    #[test]
    fn 就绪时每条都走直投且条数守恒() {
        let got = decide_deep_link_deliveries(true, &urls(3));
        assert_eq!(got.len(), 3);
        assert!(got
            .iter()
            .all(|d| matches!(d, DeepLinkDelivery::Emit(_))));
    }

    #[test]
    fn 空批次不伪造去向() {
        assert!(decide_deep_link_deliveries(false, &[]).is_empty());
    }

    #[test]
    fn 入队顺序保持原始到达顺序() {
        let mut q = DeepLinkPending::default();
        for u in urls(3) {
            assert!(q.push(&u));
        }
        assert_eq!(q.take_all(), urls(3));
    }

    /// 取即清 = 补投幂等的来源:同一批积压不可能被前端取到第二次
    /// (否则同一个一次性 sso_code 会被拿去换两次 token)。
    #[test]
    fn 取回即清空_第二次取回必须为空() {
        let mut q = DeepLinkPending::default();
        q.push("ihui://sso?sso_code=only");
        assert_eq!(q.take_all(), vec!["ihui://sso?sso_code=only".to_string()]);
        assert!(q.take_all().is_empty(), "取回后仍留条目 ⇒ 补投会重复消费同一个 code");
    }

    #[test]
    fn 同一链接重复入队只留一份并计数() {
        let mut q = DeepLinkPending::default();
        assert!(q.push("ihui://sso?sso_code=dup"));
        assert!(!q.push("ihui://sso?sso_code=dup"), "重复入队必须返回 false");
        assert_eq!(q.urls.len(), 1);
        assert_eq!(q.deduped, 1, "去重必须计数,否则队列长度读不出'少了'");
    }

    /// 溢出必须"丢最旧 + 计数 + 不静默":丢弃计数是这条路径唯一的可见出口。
    #[test]
    fn 超上限丢最旧并计数_保留的是最新几条() {
        let mut q = DeepLinkPending::default();
        for u in urls(DEEP_LINK_PENDING_CAP + 2) {
            q.push(&u);
        }
        assert_eq!(q.urls.len(), DEEP_LINK_PENDING_CAP);
        assert_eq!(q.dropped, 2, "溢出丢弃必须计数(累计 2 条)");
        // 丢的是最旧两条(c0、c1),队首应为 c2
        let kept = q.take_all();
        assert_eq!(kept.first().map(|s| s.as_str()), Some("ihui://sso?sso_code=c2"));
        assert_eq!(kept.last().map(|s| s.as_str()), Some("ihui://sso?sso_code=c9"));
    }

    #[test]
    fn 清账返回被清条数且不留残留() {
        let mut q = DeepLinkPending::default();
        q.push("ihui://sso?sso_code=a");
        q.push("ihui://sso?sso_code=b");
        assert_eq!(q.clear(), 2);
        assert_eq!(q.clear(), 0, "已空的队列再清不得报数,否则'清账'读起来像一直在丢");
        assert!(q.take_all().is_empty());
    }

    /// 深链本体就是一次性登录凭据:日志只留结构,掩掉敏感参数的取值(键名保留以便排查)。
    #[test]
    fn 日志形态掩掉凭据取值但保留结构与键名() {
        assert_eq!(
            deep_link_log_form("ihui://sso?sso_code=secret123&from=im"),
            "ihui://sso?sso_code=***&from=im"
        );
        assert_eq!(deep_link_log_form("ihui://sso/callback"), "ihui://sso/callback");
        assert_eq!(
            deep_link_log_form("ihui://oauth?AUTH_CODE=abc"),
            "ihui://oauth?AUTH_CODE=***",
            "大小写不同的敏感键同样要掩"
        );
        assert!(
            !deep_link_log_form("ihui://sso?sso_code=secret123").contains("secret123"),
            "掩完不得残留原取值"
        );
    }

    /// 本票(2026-09-26 补"导航期间直投丢失"窗口)的核心正例,走完整状态序列:
    /// 冷启动入队 → take 点亮 → 就绪期入队一条债务 → **导航复位** →
    /// 新 URL 必须入队而不是直投(复位缺失时这里是 Emit,即原缺陷形态)→
    /// 再 take 点亮且把债务与新链一并交回 → 此后恢复直投。
    /// 变异对照:把 apply_navigation_reset 里 `target_ready = false` 删掉(模拟"导航处不复位"),
    /// ③ 之后的 Queue 断言与 `kept==1` 之外还会让"新链入队"变"新链直投"立刻红。
    #[test]
    fn 就绪后导航复位_新链接必入队_重新点亮后恢复直投() {
        let mut gate = DeepLinkGateState::default();

        // ① 冷启动未就绪:两条全进队列,一条都不许直投
        let cold = urls(2);
        for d in decide_deep_link_deliveries(gate.target_ready, &cold) {
            match d {
                DeepLinkDelivery::Queue(u) => {
                    gate.pending.push(&u);
                }
                DeepLinkDelivery::Emit(_) => panic!("冷启动未就绪时不得出现直投分支"),
            }
        }
        assert_eq!(gate.pending.urls.len(), 2);

        // ② 渲染端注册完成,第一次 take:点亮就绪并一次取回(取即清)
        let (first_take, backlog) = apply_take_ready(&mut gate);
        assert!(first_take, "第一次 take 必须报告'首次点亮'");
        assert_eq!(backlog, cold);
        assert!(gate.target_ready);
        assert!(gate.pending.urls.is_empty(), "取即清:取回后队列必须为空");

        // 就绪期有一条 emit 失败回填(模拟 dispatch 的失败回填入队路径),导航前它是欠账
        gate.pending.push("ihui://sso?sso_code=debt");

        // ③ 导航发起:就绪拉回 false,**债务保留**(这是与 destroy 清账的刻意分野)
        let (was_ready, kept) = apply_navigation_reset(&mut gate);
        assert!(was_ready, "复位前是就绪态");
        assert_eq!(kept, 1, "导航复位不得清账 —— 队列里的补投债务归新页取");
        assert!(!gate.target_ready);

        // ④ 导航期间新 URL 抵达:必须走"未就绪 ⇒ 入队",绝不能直投给已不存在的渲染端
        let arrived: Vec<String> = vec!["ihui://sso?sso_code=nav".to_string()];
        let got = decide_deep_link_deliveries(gate.target_ready, &arrived);
        assert!(
            matches!(got[0], DeepLinkDelivery::Queue(_)),
            "导航复位后仍直投 = 本票要修的缺陷: {:?}",
            got
        );
        gate.pending.push(&arrived[0]);
        assert_eq!(gate.pending.urls.len(), 2, "债务 + 新链都必须在队");

        // ⑤ 新页面注册完监听、再次 take:重新点亮,债务与新链一并交回
        let (relit_first, backlog2) = apply_take_ready(&mut gate);
        assert!(
            relit_first,
            "导航复位后就绪标记已是 false,这次的 take 就是重新点亮那一次(first_take 必为 true)"
        );
        assert_eq!(
            backlog2,
            vec!["ihui://sso?sso_code=debt".to_string(), "ihui://sso?sso_code=nav".to_string()],
            "积压按到达顺序全量交回"
        );
        assert!(gate.target_ready, "take 之后恢复就绪");

        // ⑥ 此后抵达恢复直投(对照:若不点亮则永远是队列,把 take 变成唯一通路)
        let after = decide_deep_link_deliveries(gate.target_ready, &arrived);
        assert!(matches!(after[0], DeepLinkDelivery::Emit(_)));
    }

    /// 复位对"本来就未就绪"的状态是幂等的(启动早期/连续两次导航都不该报错或清账)。
    #[test]
    fn 未就绪时导航复位幂等且不动队列() {
        let mut gate = DeepLinkGateState::default();
        gate.pending.push("ihui://sso?sso_code=keep");
        let (was_ready, kept) = apply_navigation_reset(&mut gate);
        assert!(!was_ready);
        assert_eq!(kept, 1);
        let (was_ready2, kept2) = apply_navigation_reset(&mut gate);
        assert!(!was_ready2);
        assert_eq!(kept2, 1, "二次复位不得吞队列");
        assert_eq!(gate.pending.take_all(), vec!["ihui://sso?sso_code=keep".to_string()]);
    }

    /// "导航发起处必须调用复位函数"的源码级棘轮 —— 单元测试只能证明纯函数分支正确,
    /// 真正会让运行时丢链接的是**调用点被摘掉**(本仓最高频的"修好但没人看守"一型)。
    /// 判据:auto_refresh.rs 里每一处发起整页导航的 eval(`location.href=` / `location.reload()`)
    /// 之前 ≤8 行内必须出现 reset_deep_link_gate_for_navigation。
    /// 变异对照:删掉 auto_refresh.rs 任一处的复位调用 ⇒ 本用例红;新增导航站点不复位 ⇒ 同样红。
    /// (守门 scripts/check-desktop-event-wiring.mjs 的 G 组按同一判据在提交链上再看一遍。)
    #[test]
    fn 导航发起处无一例外必须先复位闸门() {
        let src = include_str!("auto_refresh.rs");
        let lines: Vec<&str> = src.lines().collect();
        let mut nav_sites = 0usize;
        for (i, line) in lines.iter().enumerate() {
            let is_nav = line.contains(".eval(")
                && (line.contains("location.href=") || line.contains("location.reload()"));
            if !is_nav {
                continue;
            }
            nav_sites += 1;
            let start = i.saturating_sub(8);
            let window = &lines[start..=i];
            assert!(
                window.iter().any(|l| l.contains("reset_deep_link_gate_for_navigation")),
                "auto_refresh.rs 第 {} 行发起整页导航却没有先复位深链闸门(导航期间抵达的链接会被直投丢失): {}",
                i + 1,
                line.trim()
            );
        }
        assert_eq!(
            nav_sites, 6,
            "导航发起处数量与登记的 6 处不符(启动离线/切离线/恢复/挂起热刷/热刷新/\
             chrome-error 落点自愈)—— 若确属新增或删除导航站点,先在本断言处同步数字并在提交信息说明依据。\
             计数 5→6:0.1.58(commit 01b3cd5cfb)新增的 webview 落点自愈导航点当时漏登记,本次同步"
        );
    }
}

/// 票 L7220 P3 的形状锁(2026-10-21 立)。
///
/// 判的是**源码形状**,不是运行时行为:单元测试只能证明纯函数分支对,而本票真正的失效型
/// 是"判据写对了却没接在该接的位置"(旧守卫 `get_webview_window().is_none()` 就是这一型 ——
/// 它在,却结构上打不中)。三格各自一条用例,每格都有对应的**反证**(改坏必红):
/// ① 摘掉 `on_page_load` 里的置位 ⇒ `置位点必须落在…` 红 + 运行时那条红;
/// ② 把 `auto_refresh::start` 挪回健康门之前 ⇒ `健康门排在…` 红;
/// ③ 在兜底门体内加一处取 URL 的调用 ⇒ `兜底线程体内不得出现阻塞式窗口getter` 红;
/// ④ 删掉 `startup_guard::decide` 的启动相位那一臂 ⇒ 该文件内 `启动相位档永不清理旧实例` 红
///    (不在本模块,列在这里是为了四条反证同批可查)。
#[cfg(test)]
mod startup_health_gate_tests {
    use super::main_page_ready;
    use super::MAIN_PAGE_READY;

    /// 取材面 = 本文件自身的源码(与 `导航发起处无一例外必须先复位闸门` 同一种器物:
    /// 判调用点的锁只能读源码,读不到就别装锁)。
    const SRC: &str = include_str!("lib.rs");

    // ⚠️ 标记一律用 `concat!` 拼出来,不写成一整串字面量。理由是本模块被 `include_str!`
    // 一起读了进来:写成整串 ⇒ 每个标记在 SRC 里至少出现两次(被测处 + 本测试里那一串),
    // 而下面那条"标记必须唯一命中"的自检会当场红 —— 实测第一次就是这么红的。
    // 拆开写之后,源码文本里再没有出现连续的标记,唯一性判据才只判被测代码本身。
    const M_ON_PAGE_LOAD: &str = concat!(".on_page_", "load(");
    const M_GATE_FN: &str = concat!("fn startup_", "health_gate(");
    const M_GATE_SPAWN: &str = concat!("|| startup_", "health_gate(");
    const M_SETUP: &str = concat!(".setup(|a", "pp| {");
    const M_LOOP_START: &str = concat!("auto_refresh:", ":start(");
    const M_SET_FLAG: &str = concat!("MAIN_PAGE_READY.", "store(true");
    /// 取"可见性早退"那一处的**代码**位置:带上取引用的 `&`,这样注释里提到常量名
    /// 不会被算成早退点(实测踩过:注释写了裸常量名 ⇒ 顺序锁读到的"早退"其实是注释)。
    const M_HIDDEN_REF: &str = concat!("&STARTUP_START_", "HIDDEN");
    const M_EXIT: &str = concat!("std::process:", ":exit(0)");
    const M_READINESS_FN: &str = concat!("main_page_", "ready()");
    const M_FORBIDDEN_URL: &str = concat!(".", "url()");
    const M_FORBIDDEN_VIS: &str = concat!(".", "is_visible()");
    const M_OLD_REVEAL: &str = concat!("site=startup_", "timeout_reveal");

    /// 从 `marker` 之后第一个 `{` 起做**括号配平**,返回该块(含首尾括号)的字节区间。
    ///
    /// ⚠️ 刻意不做注释/字符串遮蔽:被测这几处代码里字符串内的花括号都成对。这条前提
    /// 不是"应该没事",由 `取材面形状自检` 量出来 —— 一旦有人在门体内写进不配平的括号,
    /// 配平会一路跑到文件尾并返回 None,那条用例立刻红,不会静默放过。
    fn block_after(marker: &str) -> Option<(usize, usize)> {
        let occurrences = SRC.matches(marker).count();
        if occurrences != 1 {
            return None;
        }
        let at = SRC.find(marker)?;
        let open = at + SRC[at..].find('{')?;
        let bytes = SRC.as_bytes();
        let mut depth: i64 = 0;
        let mut i = open;
        while i < bytes.len() {
            match bytes[i] {
                b'{' => depth += 1,
                b'}' => {
                    depth -= 1;
                    if depth == 0 {
                        return Some((open, i + 1));
                    }
                }
                _ => {}
            }
            i += 1;
        }
        None
    }

    #[test]
    fn 取材面形状自检() {
        // 空枚举判死不记绿(§0.3):五个标记都必须**唯一命中**,否则下面三条锁全在判空气。
        for marker in [
            M_ON_PAGE_LOAD,
            M_GATE_FN,
            M_SETUP,
            M_GATE_SPAWN,
            M_LOOP_START,
        ] {
            let hits = SRC.matches(marker).count();
            assert_eq!(
                hits, 1,
                "标记 {marker:?} 命中 {hits} 处(应为 1)⇒ 形状锁失去唯一锚点,下面的区间判定不可信"
            );
        }
        // 括号配平必须真收得回来(前提被破坏时这里红,而不是悄悄判绿)。
        for marker in [M_ON_PAGE_LOAD, M_GATE_FN, M_SETUP] {
            assert!(block_after(marker).is_some(), "{marker:?} 的块配平不收口");
        }
    }

    #[test]
    fn 置位点必须落在on_page_load的finished分支内() {
        let (s, e) = block_after(M_ON_PAGE_LOAD).expect("on_page_load 块取不到");
        let body = &SRC[s..e];
        assert!(
            body.contains(M_SET_FLAG),
            "置位被摘掉或改写 ⇒ 健康门永远读不到就绪 ⇒ 判据形同虚设(反证①)"
        );
        assert!(
            body.contains("PageLoadEvent::Finished"),
            "置位必须挂在主文档加载完成那一支,不是任意一次回调"
        );
        // 反证①之外的另一半:置位必须**早于**可见性早退,
        // 否则"启动后进托盘"的用户整批落在门的外面(同一条失效型换个人群重演)。
        let store = body.find(M_SET_FLAG).unwrap();
        let hidden = body
            .find(M_HIDDEN_REF)
            .expect("on_page_load 内不再取用 STARTUP_START_HIDDEN ⇒ 早退那一条被挪走了,本锁射程需重裁");
        assert!(
            store < hidden,
            "置位排在可见性早退之后 ⇒ 先进托盘的启动永远不会置位(健康门会被误判成半启动)"
        );
        assert!(
            body.contains("if label == \"main\""),
            "置位必须只认 main 窗:admin/其它窗与主窗就绪与否不是同一件事"
        );
    }

    #[test]
    fn 健康门排在常驻循环与退出兜底之前() {
        let spawn_at = SRC.find(M_GATE_SPAWN).expect("健康门的派生点不见了");
        let start_at = SRC.find(M_LOOP_START).expect("auto_refresh::start 调用点不见了");
        assert!(
            spawn_at < start_at,
            "健康门排在 auto_refresh::start 之后 ⇒ 判出半启动时循环已经起来,正是要防的那一型(反证②)"
        );
        // 同一轮 setup 里那条 (a) 出口的 process::exit 也必须排在门之后:门先武装,
        // 才有资格说"这一轮不会再有界面"。(取 setup 块内的第一处 process::exit。)
        let (s, e) = block_after(M_SETUP).expect("setup 块取不到");
        let setup_body = &SRC[s..e];
        let exit_rel = setup_body
            .find(M_EXIT)
            .expect("setup 内的 (a) 出口不见了");
        let gate_rel = setup_body
            .find(M_GATE_SPAWN)
            .expect("setup 内的健康门派生点不见了");
        assert!(
            gate_rel < exit_rel,
            "健康门必须早于 setup 内第一处 process::exit —— 兜底顺序写反就又是「先退再说没建好」"
        );
        assert!(e > s, "setup 块区间为空 ⇒ 取材面判定失效");
    }

    /// 票 L7220 方向 (a) 的三格 = ERROR + **提示** + process::exit(ERROR 与 exit 由上面那条
    /// 顺序锁兼看)。本锁补第三格的前半:退出之前必须先经 `auto_refresh::notify` 喊到人 ——
    /// 进程自己知道自己退了,用户只会看到图标点了一下没反应。反证:摘掉 (a) 出口里的通知调用
    /// ⇒ 本条红(计数 0);在 (a) 出口之前再加第二处通知 ⇒ 同样红(计数 2),射程需重裁。
    #[test]
    fn a出口在退出之前必须先提示用户() {
        let (s, e) = block_after(M_SETUP).expect("setup 块取不到");
        let setup_body = &SRC[s..e];
        let exit_rel = setup_body.find(M_EXIT).expect("setup 内的 (a) 出口不见了");
        let hits = setup_body[..exit_rel]
            .matches(concat!("auto_refresh:", ":notify("))
            .count();
        assert_eq!(
            hits, 1,
            "(a) 出口之前应恰有一处通知提示(现命中 {hits} 处)—— 0 = 票面 (a) 的「提示」格被摘,>1 = 本锁射程需重裁"
        );
    }

    #[test]
    fn 兜底线程体内不得出现阻塞式窗口getter() {
        let (s, e) = block_after(M_GATE_FN).expect("健康门函数体取不到");
        let body = &SRC[s..e];
        // 旧兜底线程的整条形状也必须已经不在(加回来即红):它当年就是用第二个被禁
        // 字符串点名的那个 getter 问"亮没亮",在同一失效型下永不返回。
        for forbidden in [M_FORBIDDEN_URL, M_FORBIDDEN_VIS, M_OLD_REVEAL] {
            assert!(
                !body.contains(forbidden),
                "健康门体内出现 {forbidden} ⇒ 探测器会卡在被探测的失效型本身上,等于没有检测(反证③)"
            );
        }
        assert!(
            body.contains(M_READINESS_FN),
            "健康门不再读原子标志 ⇒ 上面两条禁令失去意义,本锁必须跟着重裁"
        );
    }

    /// 运行时那一半(与形状锁分两条用例的理由:形状对但标志读不到,也是没有门)。
    #[test]
    fn 健康门读的原子标志初始为未就绪置位后必须读得回() {
        assert!(
            !main_page_ready(),
            "初值必须为 false:否则本用例与真实启动路径都读不到「从未就绪」这一态"
        );
        MAIN_PAGE_READY.store(true, std::sync::atomic::Ordering::SeqCst);
        assert!(main_page_ready(), "置位后读不回 ⇒ 判据与置位点不是同一枚标志");
        // 本用例是这一枚标志在测试进程内唯一的置位者(取走/复位都不做:标志语义是
        // 单向闩锁)。若将来有第二处置位或第二处断言初值,这条初值断言会先红。
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // G-921(2026-10-19 立):identifier 一律取运行期配置,不得再写死任何一份。
    // `generate_context!()` 携带的就是 tauri-build 编译期合并好的那一份配置
    // (base `tauri.conf.json` ⊕ CLI 经 `TAURI_CONFIG` 传来的 `--config` 覆盖,见
    // tauri-build 2.6.3 `try_build` 里的 `json_patch::merge`),与 single-instance 插件
    // setup 里 `app.config().identifier` 是同一枚值 ⇒ 预检锁名 `{id}-sim`、AppUserModelID、
    // WebView2 目录三者与插件同锁;写死一份的话,给 dev 配独立 identifier 会让预检与插件
    // 劈叉成两把锁(模块头注警告的"守护整体失效")。
    let context = tauri::generate_context!();
    let app_identifier = context.config().identifier.clone();
    // 2026-09-02 修复:显式固定进程级 AppUserModelID,使 Windows 通知区(系统托盘)
    // 图标的"显示/隐藏"记忆在 dev 重编译 / 发布更新 / 安装版之间保持一致。
    // 根因:Tauri 2.11 不会为进程设置 AppUserModelID,Windows 改用 exe 路径自动派生,
    // dev(target/debug/ihui-desktop.exe) 与安装版/更新版路径不同 → 被当成不同应用
    // → 托盘显隐记忆每次重置、图标被丢进隐藏溢出区。
    // 2026-09-02 修订:从 setup 前移到 run() 顶部——MS 要求该调用早于进程内任何窗口
    // 创建,而 Tauri 在 setup 之前就已按 tauri.conf.json 创建 main 窗口。
    // 注:winapi 0.3.9 与 Tauri 2.11 均未导出该 API,改用已在依赖树中的 windows-sys 调用。
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;

        let wide: Vec<u16> = std::ffi::OsStr::new(&app_identifier)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        unsafe {
            let _ = SetCurrentProcessExplicitAppUserModelID(wide.as_ptr());
        }
    }
    // 2026-09-27 立:启动守护——在 Builder 之前探测/清理挂死或僵尸的旧实例,
    // 根治"双击打不开"(tauri-plugin-single-instance 2.4.3 无超时 SendMessage +
    // 隐藏窗口缺失时放行两个缺陷的组合,详见 startup_guard.rs 模块头注)。
    // 必须早于 tauri::Builder:此刻本进程还没建任何窗口,清理旧实例不会误伤自己。
    // 2026-10-21(票 L7220 P1)补第二枚入参:落账那一行要写进**插件那本日志**,而预检
    // 阶段没有 AppHandle、拿不到 `app.path().app_log_dir()`,只能由这里把同一枚文件名
    // 常量注入下去 —— 在 startup_guard 里再写一遍字面量就是第二个真相源。
    startup_guard::preflight(&app_identifier, APP_LOG_FILE_STEM);
    // 2026-07-26 立:启动时清理 WebView2 缓存(Windows),彻底杜绝桌面端样式不同步问题
    // - 用户反馈"样式没同步":web dev 已更新,但 Tauri WebView2 缓存了旧 CSS chunk
    // - 2026-09-25 收窄:旧写法是 `remove_dir_all(EBWebView)`,而 `cfg(dev)` **确实会被编译**
    //   (`tauri-build` 输出 `cargo:rustc-cfg=dev`,已在构建日志里回读到),所以每次 `tauri dev`
    //   启动都在删用户的 WebView2 数据树(登录态 / 本地会话 / 已加密的 ihui-chat 信封一并没了)。
    //   现在只删缓存白名单,样式同步所需的"重新取 chunk"照样成立,数据目录一律保留。
    // - 仅 dev 模式生效(release 模式加载 frontendDist 静态产物,不需要清缓存)
    #[cfg(all(dev, target_os = "windows"))]
    {
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            let webview_root = std::path::Path::new(&local_app_data)
                .join(&app_identifier)
                .join("EBWebView");
            if webview_root.is_dir() {
                match clear_webview_caches(&webview_root) {
                    Ok((cleared, skipped)) => log::info!(
                        "[desktop] dev 启动清理 WebView2 缓存:删除 {} 个缓存目录,保留 {} 个数据目录",
                        cleared,
                        skipped.len()
                    ),
                    Err(e) => log::warn!("[desktop] dev 启动清理缓存被拒:{}", e),
                }
            }
        }
    }
    tauri::Builder::default()
        // ⚠️ 2026-10-16 修「启动后左上 logo / 右上窗控隔好久才出来」(用户报):
        // 主窗 visible:false 创建,点亮原先挂在 auto_refresh 探活落定 —— 探活只证后端
        // 活,此刻远程首页往往才开始加载,窗口亮起后网页 chrome(logo/窗控,
        // decorations:false 下全部由网页绘制)还要等页面 JS/渲染,慢则数秒。
        // 改为「主文档加载完成(PageLoadEvent::Finished)即亮」—— DOM 就绪,chrome
        // 第一帧可见。配套:①auto_refresh 在线分支的 show 已摘除(探活只落在线态);
        // ②setup 15s 硬超时兜底,页面卡死/探活挂起也绝不黑窗;③离线分支切本地兜底页
        // 后照旧 show,双保险。三路都尊重 STARTUP_START_HIDDEN(先进托盘/--minimized)。
        // on_page_load 是 app 级 Builder API(2.11 实例侧无此方法),须按 label 过滤主窗。
        .on_page_load(|wv, payload| {
            let label = wv.label().to_string();
            if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                // 2026-10-21 立(票 L7220 P3):主文档加载完成 ⇒ 置位"这一轮界面真的渲染过"。
                // 置位点必须在下面那条 `STARTUP_START_HIDDEN` 早退**之前**:先进托盘的启动
                // 一样会加载页面,而健康门判的是"webview 活着没有",与可见性无关 —— 放在
                // 早退之后,等于让所有"启动后进托盘"的用户永远处在无门状态(那正是本票要
                // 消灭的静默半启动人群)。第二次及以后的导航(离线兜底页/热刷新/错误页自愈)
                // 同样置位:判据是"加载完成过",不是"首次加载成功",后者在断网冷启动下会
                // 把健康应用误杀(实测离线那一支约 24–30s 导航到 offline 页,同样落这里)。
                if label == "main" {
                    MAIN_PAGE_READY.store(true, std::sync::atomic::Ordering::SeqCst);
                }
                if label == "main" || label == "admin" {
                    // 2026-10-18 立 / 2026-10-26 改判序:深浅以**网页上报**为准(前端切主题会
                    // invoke set_caption_button_theme),没上报过才按 URL 粗判(离线兜底页 /
                    // 壳占位页深底白字、线上首帧浅顶栏深字),在窗口点亮前完成首帧即正确。
                    // 改判序的因:此前每次 page_load 都无条件按 URL 粗判覆盖,而线上
                    // https://aizhs.top 恒被判成浅顶栏 ⇒ 用户切暗色后原生侧仍把深字画在深底上
                    // (实拍"暗色模式下这几个按钮根本看不清"),且刷新会把自己上报过的值冲掉。
                    window_chrome::apply_theme_on_page_load(&label, payload.url().as_str());
                    // 仅在 Rust 侧确认原生窗控(自绘 overlay)已启用时隐藏
                    // HTML 按钮(创建失败则保留网页按钮兜底,不能两边都没有)。
                    if window_chrome::native_controls_active(&label) {
                        let _ = wv.eval(window_chrome::HIDE_HTML_WINDOW_CONTROLS_JS);
                    }
                }
            }
            if std::sync::atomic::AtomicBool::load(
                &STARTUP_START_HIDDEN,
                std::sync::atomic::Ordering::SeqCst,
            ) {
                return;
            }
            if label != "main" {
                return;
            }
            if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                if let Some(win) = wv.app_handle().get_webview_window("main") {
                    log::info!("[window-show] site=page_load_finished trigger=主文档加载完成 ⇒ 点亮(chrome 第一帧可见,替代探活点亮)");
                    let _ = win.show();
                }
            }
        })
        // 结构化日志(写文件 %LOCALAPPDATA%\com.ihui.desktop\logs\ + 控制台)
        // 2026-07-29: 替代裸 println!/eprintln!,线上问题可追溯 + 设置项可一键导出
        // 12546(2026-09-28):上一版只有 .level(Info) 而**没声明任何 target** —— 本行注释
        // 说的"写文件"从未成立(实测本机无任何 desktop 日志文件),"卡死但不退出"这类事后
        // 只能靠读 runtime 源码定性(台账 12546 的立因)。现把注释兑现:显式三 target,
        // Stdout(壳进程 stdout,保留插件原默认面)+ Webview(开发控制台)+
        // LogDir(插件原生写文件 target,append 打开)。
        // 落点与依据:LogDir = tauri app_log_dir ⇒ Windows 解析为
        // %LOCALAPPDATA%\com.ihui.desktop\logs\ihui-desktop.log(identifier 见
        // tauri.conf.json)。§15b 复核(2026-10-25/票 L7645):该目录在本机是 junction,
        // 实落 G:\IHUI-AI\.DevEnv\cache\userhome\appdata-local-com.ihui.desktop\logs,
        // 即 §15b 批准的 DevEnv 缓存根(2026-09-30 由 G:\DevEnv 同卷搬入仓内 .DevEnv,
        // G-50/G-158;.gitignore:593 已整根忽略),不新增项目外落点。
        // 插件 2.9.0 源码考据详见 log_retention.rs 头注。2026-10-07 勘误:旧注
        // "与崩溃现场 crash-*.log 同根(com.ihui.ai/logs)"是误读 —— crash handler 落
        // %APPDATA%\com.ihui.ai\logs,与本日志根分属两个 hive + 两个 identifier,不同根。
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        // 2026-10-21(票 L7220 P1):文件名取 `APP_LOG_FILE_STEM` 单源 ——
                        // 预检那一行落账写的是同一本册子,两处各写一遍字面量必然漂移。
                        file_name: Some(APP_LOG_FILE_STEM.into()),
                    }),
                ])
                // G-379/G-407/G-774,2026-10-07:默认 KeepOne 在文件超限时直接
                // remove_file 主日志(插件源码 :237-239),历史=0、无保留期。改
                // KeepSome:超限走 fs::rename 把整卷改名 ihui-desktop_<时间戳>.log
                // (rename 保留 mtime,避开上游 copyFileSync 改 mtime 的陷阱);
                // 保留份数唯一出处是 log_retention::KEEP_ARCHIVES,年龄/总量裁剪
                // 在 log_retention 模块(setup 期跑一次)。
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(
                    log_retention::KEEP_ARCHIVES,
                ))
                .build(),
        )
        // 2026-09-17 薄壳化配套:离线兜底页协议。断网时 auto_refresh 模块将 main 窗口
        // 导航到 http://offline.localhost/index.html(此 handler 返回内嵌 HTML),
        // 恢复后自动切回线上前端。Windows 自定义协议 URL 形如 http://<scheme>.localhost/。
        .register_uri_scheme_protocol("offline", |_uri, _request| {
            tauri::http::Response::builder()
                .status(200)
                .header("Content-Type", "text/html; charset=utf-8")
                .header("Cache-Control", "no-store")
                .body(include_str!("../offline/index.html").as_bytes().to_vec())
                .expect("offline protocol: static html")
        })
        // single-instance 必须在 plugin chain 最前,防止多开 + 唤起已有窗口
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // 2026-10-13 立(用户实测:浏览器授权完,桌面端永远"没反应"):壳在运行时,浏览器的
            // ihui:// 回跳由 OS 拉起第二实例转发 argv —— deep-link 插件 2.4.9 的 on_open_url
            // 只覆盖冷启动/自身注册路径,**不会**消费第二实例的 argv;旧实现把 _argv 原样丢弃,
            // 运行中收到的所有深链全被吞(日志只见 single_instance 唤起,无一条 deep-link 抵达)。
            // 现把 ihui:// 条目喂给与 on_open_url 同一个 dispatch_deep_links(闸门/去重/pending
            // 队列/唤起全复用);非深链参数维持只唤起。
            let deep_links: Vec<String> = argv
                .iter()
                .filter(|a| a.starts_with("ihui://"))
                .cloned()
                .collect();
            if !deep_links.is_empty() {
                log::info!(
                    "[deep-link] 单实例转发:第二实例 argv 携带 {} 条深链,走 dispatch_deep_links",
                    deep_links.len()
                );
                dispatch_deep_links(app, &deep_links);
                return;
            }
            if let Some(window) = app.get_webview_window("main") {
                log::info!("[window-show] site=single_instance trigger=第二个实例被拉起 ⇒ 插件把已有主窗口唤起(可由双击图标/自启重复触发)");
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        // 开机自启(macOS 用 LaunchAgent,其他平台原生,启动参数 --minimized)
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        // 全局快捷键 plugin(handler 在 setup 中通过 on_shortcut 注册)
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .on_window_event(|window, event| {
            let label = window.label().to_string();
            // main 窗口关闭的去向由 desktop-behavior.json 的 close_behavior 决定
            // (hide=隐藏到托盘 / quit=退出进程 / ask=问前端);admin 只持久化状态后直接关。
            // 2026-09-28 之前这里是硬编码的"一律隐藏到托盘"。
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if label == "main" {
                    // 先无条件 prevent_close:前端慢/没接住时,窗口也绝不能在这次决策期间消失
                    // (2026-09-28 立;此前 hide 是硬编码的,新加"询问"这一档后这条顺序更要紧)。
                    api.prevent_close();
                    // 2026-07-29 #12:emit before-close 事件给前端,前端保存正在编辑的消息。
                    // 这条与去向无关(隐藏/退出/询问都需要先存草稿),所以三种去向都照发,
                    // 保持 web 端已监听的这条事件向后兼容。
                    if let Err(e) = window.emit("desktop-before-close", ()) {
                        log::warn!("[desktop-event] emit desktop-before-close failed: {}", e);
                    }
                    let app = window.app_handle().clone();
                    // 托盘在不在取**运行时事实**:偏好里 show_tray_icon 可能仍是 true,
                    // 而 build_tray 当时失败了 —— 那时"隐藏"同样无处可去。
                    let tray_present = app.tray_by_id("main").is_some();
                    let prefs = load_desktop_prefs(&app);
                    match decide_close_action(&prefs, tray_present) {
                        // 两种确定去向都**不依赖 web 层**:Rust 直接执行。
                        CloseDecision::Hide => apply_close_hide(&app),
                        CloseDecision::Quit => exit_application(&app),
                        CloseDecision::Ask => {
                            // 顺序要紧:先挂账,**再** emit。反过来的话前端若在两者之间答完,
                            // 挂账还没建立 ⇒ 答复被当成"无挂起",而随后建好的账会在 3s 后
                            // 落一次兜底动作 —— 用户刚点的「取消」会被一次凭空 hide 顶掉。
                            let generation = begin_close_ask(&app);
                            if let Err(e) = window.emit("desktop-close-requested", ()) {
                                log::warn!("[desktop-event] emit desktop-close-requested failed: {}", e);
                            }
                            spawn_close_ask_watchdog(app.clone(), generation);
                        }
                    }
                } else if label == "admin" {
                    // 2026-08-16 修复:admin 在 CloseRequested 时就持久化窗口状态。
                    // 此前依赖 Destroyed 事件,但销毁后 get_webview_window 可能返回 None,
                    // 且 debounce 300ms 窗口内最后一次 Moved 位置可能被跳过 → 落点漏存。
                    let app = window.app_handle().clone();
                    let _ = save_window_state(Some(label.clone()), app);
                }
            }
            // 窗口焦点变化推给前端(2026-09-22 立):窗口 decorations:false,标题栏与
            // Min/Max/Close 三按钮全由前端自绘,DWM 不会替我们画"非活动窗口"的灰态。
            // 内核自带的 tauri://focus|blur 在远程 URL 页面实测收不到(真机聚焦/失焦两态
            // 像素逐字相同),所以走与 desktop-tray-action 同一条已被生产验证可用的应用层通道。
            if let tauri::WindowEvent::Focused(focused) = event {
                if label == "main" || label == "admin" {
                    if let Err(e) = window.emit("desktop-window-focus", focused) {
                        log::warn!("[desktop-event] emit desktop-window-focus failed: {}", e);
                    }
                }
                // 2026-10-16 省内存(两层):① 内存目标档位切 Low/Normal(官方机制,
                // 非活动态可降 ~95%);② WebView2 官方挂起/恢复 TrySuspend/Resume(真正
                // 冻结 webview、释放渲染进程,保留页面状态无重载)。两层都在「窗口失焦 ⇒
                // 挂起+Low;回前台 ⇒ 恢复+Normal」。
                // main/admin 各自只有一个 webview(main 是薄壳主窗,内存最大头);
                // 内嵌浏览器窗要遍历它的全部标签 webview。
                if label == "main" || label == "admin" || label == embedded_browser::BROWSER_WINDOW_LABEL {
                    let app = window.app_handle().clone();
                    for (wl, wv) in app.webviews() {
                        if wl == label
                            || wl.starts_with(embedded_browser::TAB_LABEL_PREFIX)
                            || wl == embedded_browser::BROWSER_WINDOW_LABEL
                        {
                            embedded_browser::set_memory_low(&wv, !focused);
                            embedded_browser::set_suspend(&wv, !focused);
                        }
                    }
                }
            }
            // 窗口移动 / 缩放过程中防抖持久化(300ms 内合并,避免每次拖动都写盘)
            // 2026-07-27 立:扩展 admin 窗口也持久化位置/尺寸
            if let tauri::WindowEvent::Resized(_) = event {
                if label == "main" || label == "admin" {
                    let app = window.app_handle().clone();
                    debounce_save_window_state(label.clone(), app);
                    // 原生窗控:最大化/还原翻转后 DWM 按钮几何需重算,否则按钮位置
                    // 停留在旧状态(2026-10-18 实测)。内部只在翻转时真正重应用。
                    window_chrome::refresh_on_maximize_toggle(window);
                }
            }
            // 跨 DPI 显示器移动:帧扩展的顶部条带按物理像素给,必须按新 DPI 重应用。
            if let tauri::WindowEvent::ScaleFactorChanged { .. } = event {
                if label == "main" || label == "admin" {
                    window_chrome::refresh_native_caption_buttons(window);
                }
            }
            if let tauri::WindowEvent::Moved(_) = event {
                if label == "main" || label == "admin" {
                    let app = window.app_handle().clone();
                    debounce_save_window_state(label.clone(), app);
                }
            }
            if let tauri::WindowEvent::Destroyed = event {
                if label == "main" || label == "admin" {
                    let app = window.app_handle().clone();
                    let _ = save_window_state(Some(label.clone()), app);
                }
                // 2026-10-16 内嵌浏览器多标签:窗口被系统关闭(Alt+F4 / 任务栏)时,
                // 子 webview 已随窗销毁,但会话状态还留着标签表 ⇒ 复位,免得下次
                // open 时 active 指向已不存在的 webview。
                if label == embedded_browser::BROWSER_WINDOW_LABEL {
                    let app = window.app_handle().clone();
                    use tauri::Manager;
                    app.state::<embedded_browser::BrowserManager>()
                        .reset();
                }
                // 2026-09-26 A10C-1:深链闸门的目标窗口销毁 ⇒ 清账 + 复位就绪标记,
                // 否则积压的 sso_code 会活到下一次冷启动、被投给另一次会话的渲染端。
                reset_deep_link_gate_on_destroy(&label);
            }
        })
        // 本地 git/diff 通道：授权根/允许基目录/git 候选都存在这份宿主状态里，
        // 前端永远不能自报 root（见 git_channel_ipc.rs 头注）。
        .manage(git_channel_ipc::GitChannelState::from_env())
        // 2026-10-16 内嵌浏览器升级:多标签会话状态(窗口/标签/当前标签),命令与
        // 工具条哨兵处理器共用这一份。
        .manage(embedded_browser::BrowserManager::default())
        // 关窗「询问我」的等待闸门(2026-09-28 立):窗口事件与命令共用这一份挂账状态。
        .manage(CloseGate::default())
        .setup(|app| {
            // AUMID 已前移到 run() 顶部(2026-09-02,须早于任何窗口创建)
            // 启动守护在 Builder 之前跑,那时日志插件还没初始化,计数在这里补记。
            let killed_stale = startup_guard::take_killed_stale_count();
            if killed_stale > 0 {
                log::warn!(
                    "[desktop] 启动守护:终止了 {} 个挂死/僵尸的旧实例(隐藏消息窗口缺失或 2s 不应答);\
                     根因与判据见 startup_guard.rs",
                    killed_stale
                );
            }
            let preflight_reading = startup_guard::take_last_reading();
            // 2026-10-21 立(票 L7220 P1/P3):预检读数**逐条**报名,一条一行。
            // 不拼成一行是刻意的:半启动那一型下,事后能拿到的往往只有其中几行,
            // 拼成一行就只剩"有一行 WARN"这一条信息,量不出判据当时看到了什么。
            match preflight_reading {
                None => log::warn!(
                    "[desktop] 启动守护读数:本次预检**未落账**(非 Windows 平台没有这套预检,\
                     或 `preflight()` 未执行)⇒ 未判定,不猜"
                ),
                Some(r) => {
                    log::warn!("[desktop] 启动守护读数 1/6 mutex_exists={:?}", r.mutex_exists);
                    log::warn!("[desktop] 启动守护读数 2/6 siw_found={}", r.siw_found);
                    log::warn!("[desktop] 启动守护读数 3/6 siw_responsive={}", r.responsive);
                    log::warn!("[desktop] 启动守护读数 4/6 other_instances={:?}", r.other);
                    log::warn!(
                        "[desktop] 启动守护读数 5/6 other_has_visible={}",
                        r.other_has_visible
                    );
                    log::warn!("[desktop] 启动守护读数 6/6 waited_lock_ms={}", r.waited_lock_ms);
                    if r.waited_lock_ms > 0 {
                        log::warn!(
                            "[desktop] 启动守护:等旧实例遗留的孤儿 WebView2 释放 EBWebView 数据目录用了 {}ms(这段时间未建窗口属预期等待)",
                            r.waited_lock_ms
                        );
                    }
                }
            }
            // 2026-10-21 立(票 L7220 P3):启动健康门。必须排在 `auto_refresh::start`
            // **与下面那条 (a) 出口的 `process::exit` 之前**(顺序由 lib.rs 测试
            // 「健康门排在常驻循环与退出兜底之前」钉住):门判的是"这一轮界面到底会不会
            // 出现东西",而一旦常驻循环起来了,半启动的进程就会一边探活一边占着数据目录,
            // 下一次启动跟着撞锁 —— 越晚收口,污染面越大。
            {
                let gate_app = app.handle().clone();
                std::thread::spawn(move || startup_health_gate(gate_app));
            }

            // G-379/G-407/G-774,2026-10-07:日志保留期。此刻日志插件自己的 setup 已跑完
            // (活跃文件句柄在插件手里、超限历史已按 KeepSome rename 成档案),这里只裁
            // 历史档案(mtime 年龄/份数/总量),活跃主文件结构性不碰 —— 详见模块头注。
            log_retention::enforce_on_startup(app);

            // 2026-09-27 立:main 窗口没建出来,进程就不该继续活着。
            // 实测形态(09-27 桌面端日志):两实例并存时,第二个实例的 WebView2 因用户数据
            // 目录被第一个占住而创建失败 —— `tauri_runtime_wry][ERROR] failed to create
            // webview: ... 0x800700AA 请求的资源在使用中`,**但进程不退出**:它只剩
            // single-instance 的隐藏消息窗口(标题 `com.ihui.desktop-siw`),却照常往下启动
            // auto_refresh 常驻循环(同一份日志紧接着就是「启动探活成功 → 显示前端页」)。
            // 后果是任务栏/托盘多出一个既看不见界面、又没人会去关的进程,并且它会继续占住
            // 数据目录,使下一次启动同样失败 —— 用户侧表现为"杀一个还剩一个、永远退不干净"。
            // 必须挡在 auto_refresh::start 之前(它在本闭包更下方),否则循环已经起来了。
            // ⚠️ 2026-10-21(票 L7220)如实登记这一格的射程:它判的是**窗口注册表**,而
            // tauri 2.11 把建 webview 作为异步消息投递、立即返回 Ok,真失败只在事件循环里
            // 写一行 ERROR,窗口仍以 `webviews: []` 注册 ⇒ 目标失效型下这条判据打不中
            // (本机 40 次启动实测开火 0 次)。它留着是因为还能抓住"配置里就没建出 main 窗"
            // 那一型;而异步失败那一型由上面那枚 `startup_health_gate` 后置判定(判据 =
            // 主文档加载完成过没有),两者不互相替代。
            if app.get_webview_window("main").is_none() {
                log::error!(
                    "[desktop] main 窗口未创建成功(最常见原因:另一实例正占住 WebView2 用户数据目录);\
                     不启动后台常驻循环,直接退出本进程。已有实例的窗口不受影响。"
                );
                // 票 L7220 方向 (a) 的「提示」格(2026-10-21 补):进程知道自己退了,
                // 用户只会看到图标点了一下没反应 —— 与启动健康门同一枚通知出口喊一声再走。
                // 必须排在 cleanup_before_exit 之前:插件清理跑完之后,通知未必还发得出去。
                auto_refresh::notify(
                    app.handle(),
                    "智汇AI",
                    "本次启动未能创建界面,已自动退出 —— 请再双击一次图标",
                );
                app.cleanup_before_exit();
                std::process::exit(0);
            }

            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    // 观测点(G-1038429 采样归因用,非 show 调用):debug 构建独有路径,
                    // release 编译期即消失。WebView2 的 OpenDevToolsWindow 是异步挂到
                    // webview 就绪之后的,若它把宿主窗口一起带可见,时间戳会落在启动后数秒——
                    // 与票面「11 秒后自行转可见」同形,所以必须能一眼排除。
                    //
                    // 2026-10-14 加开关:dev 构建**无条件**弹 DevTools 会盖住主窗口并抢走输入
                    // (实测「啥也点击不了」——用户点到的其实是 DevTools 而不是应用本体)。
                    // 设 IHUI_DESKTOP_OPEN_DEVTOOLS=0 即不弹;未设或设为其他值时保持原行为,
                    // G-1038429 的观测点语义不变。联调脚本 desktop-dev-saas.mjs 默认置 0。
                    let open_devtools = std::env::var("IHUI_DESKTOP_OPEN_DEVTOOLS")
                        .map(|v| v != "0")
                        .unwrap_or(true);
                    if open_devtools {
                        log::info!("[window-show] site=debug_open_devtools trigger=非 show 调用——debug 构建 setup 期 open_devtools(cfg(debug_assertions),release 无此路径)");
                        window.open_devtools();
                    } else {
                        log::info!("[window-show] site=debug_open_devtools trigger=IHUI_DESKTOP_OPEN_DEVTOOLS=0 ⇒ 本次不自动弹 DevTools(避免遮挡主窗口/抢走输入)");
                    }
                }
            }
            // 2026-08-01 立:注册 deep-link scheme + 监听 ihui:// 回调
            // - on_open_url 监听外部浏览器 / 其他应用打开的 ihui://sso?sso_code=xxx
            // - emit "desktop-deep-link" 事件给前端 webview,前端 useDesktopDeepLink 完成 SSO 闭环
            // 2026-08-16 修复:此前 cfg 排除 Windows release(仅 debug 注册),
            // 生产版 Windows 不写注册表 → ihui:// SSO 扫码登录闭环失效。
            #[cfg(any(target_os = "linux", windows))]
            {
                let _ = app.deep_link().register_all();
            }
            app.deep_link().on_open_url({
                let app = app.handle().clone();
                move |event| {
                    // 2026-09-26 A10C-1:整批 URL 交给闸门逐条决定去向(旧实现在这里
                    // `if let Some(window)` + 只取 first,窗口未就绪/不存在时静默吞掉整条回调)。
                    let urls: Vec<String> = event
                        .urls()
                        .iter()
                        .map(|url| url.as_str().to_string())
                        .collect();
                    dispatch_deep_links(&app, &urls);
                }
            });
            // 2026-07-25 修订:不再调用 build_app_menu(已删除),菜单全部走 web 端 HTML 顶栏
            // let _ = build_app_menu(app.handle().clone());
            // 2026-09-28:托盘是否创建由 `show_tray_icon` 决定。false ⇒ 全程没有托盘,
            // 而"关窗=隐藏"这条语义已被 normalize 归一成 quit,不会出现"窗口藏进一个
            // 不存在的地方、再也唤不出来"这种死态。
            // 2026-09-28 老用户迁移:此前"开机自启即最小化"是唯一表现,而 `--minimized` 是
            // autostart 插件注册启动项时**写死**的参数(见 tauri_plugin_autostart::init),
            // 开过自启的机器每次开机都带着它。新开关默认 false ⇒ 不迁移的话,装过自启的老用户
            // 升级后开机突然弹一个窗口 —— 那是会被当故障报回来的行为回归,不是"新默认值"能盖过去的。
            // 判据三条同时成立才迁:偏好文件此前不存在(= 该功能上线后的首次启动)∧ 带 --minimized
            // ∧ 迁前值为 false。手动双击启动不带该参数 ⇒ 不迁(默认仍弹窗)。迁移结果落盘,
            // 因此在设置界面里看得见、可改 —— 不藏成只有代码知道的隐式状态。
            let mut startup_prefs = load_desktop_prefs(app.handle());
            let prefs_absent_before = desktop_prefs_path(app.handle()).map(|p| !p.exists()).unwrap_or(false);
            let argv_has_minimized = std::env::args().any(|a| a == "--minimized");
            if should_migrate_launch_minimized(
                prefs_absent_before,
                startup_prefs.launch_minimized,
                argv_has_minimized,
            ) {
                startup_prefs.launch_minimized = true;
                log::info!(
                    "[desktop-prefs] 迁移:首次启动即带 --minimized(开机自启旧表现)⇒ launch_minimized=true\
                     (旧行为原样保留,可在设置里关掉)"
                );
                if let Err(e) = save_desktop_prefs(app.handle(), &startup_prefs) {
                    log::warn!("[desktop-prefs] 迁移写盘失败({e})⇒ 本次仍按迁移后的值执行,但下次启动会重判");
                }
            }
            if startup_prefs.show_tray_icon {
                // 建不出来必须喊:托盘不在 ⇒ `close_behavior=hide` 会被归一成 quit、`ask` 直接 quit,
                // 用户勾的是"收进托盘",实际得到"退出"。旧写法 `let _ =` 把这个分歧整条吞掉。
                if let Err(e) = build_tray(app.handle()) {
                    log::warn!(
                        "[desktop-prefs] show_tray_icon=true 但托盘创建失败({e})\
                         ⇒ 本次「隐藏到托盘/每次询问」都会退化成直接退出"
                    );
                }
                // 2026-09-02 #2:托盘图标写入 Win11 任务栏常驻(IsPromoted=1),
                // 解决"新身份图标默认被丢进右下角隐藏溢出区、需反复手动拖拽"的问题。
                // 2026-09-28:挪进本分支 —— 它在命中变更时会**重建**托盘,用户明确不要托盘时
                // 不能由它把图标拉回来(那就等于这个开关不生效)。
                #[cfg(target_os = "windows")]
                schedule_tray_promote(app.handle());
            } else {
                log::warn!("[desktop-prefs] show_tray_icon=false:本次启动不创建托盘图标");
            }
            // 启动时设置本地化窗口标题(中文系统 → 智汇AI,其他 → IHUI AI)
            // admin 窗口已改为 lazy create(2026-07-29),启动时不存在,
            // 标题在 open_admin_window 中通过 WebviewWindowBuilder::title 设置
            let app_name = localized_app_name();
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title(app_name);
            }
            // 应用启动时恢复上次窗口状态(位置/尺寸/最大化)
            // 2026-07-27 立:仅恢复 main 窗口,admin 窗口在 open_admin_window 时恢复
            let _ = restore_window_state(Some("main".to_string()), app.handle().clone());
            // 2026-10-18 立:Windows 原生窗控按钮(分层透明窗自绘 Segoe Fluent Icons,
            // 见 window_chrome.rs)。必须在 restore_window_state **之后**(几何稳定)、
            // 首次 show() 之前调 —— 窗口一亮右上角三按钮就在(OS 壳直接绘制),
            // 不等网页 React 渲染 / __TAURI_INTERNALS__ 门控。
            if let Some(window) = app.get_webview_window("main") {
                window_chrome::enable_native_caption_buttons(&window);
            }
            // 2026-09-17 薄壳化配套:启动线上前端自动刷新(3min 构建指纹轮询)+ 断网兜底守卫(30s 健康检查)
            // ⚠️ 2026-09-28:守卫在启动探活落定时会 `w.show()`(窗口以 visible:false 创建,历史上
            // 靠这一次点亮)。用户勾了「启动后先进托盘」就必须把它按住,否则 8~11 秒后窗口自己冒出来
            // (真机实测过一遍)。判据只留这一份,不许 auto_refresh 自己再读一遍偏好。
            // ⚠️ 2026-10-13 修订:判据从「只看 launch_minimized」改为 `should_start_hidden`
            //   (开关 ∧ 带 --minimized)。用户实报「双击桌面快捷方式只有托盘图标、界面不弹」——
            //   双击不带参数,是明确的"打开界面"意图,不能再被开关按住;开关只管开机自启。
            let start_hidden =
                should_start_hidden(startup_prefs.launch_minimized, argv_has_minimized);
            STARTUP_START_HIDDEN.store(start_hidden, std::sync::atomic::Ordering::SeqCst);
            auto_refresh::start(app.handle().clone(), !start_hidden);
            // 2026-10-21 撤(票 L7220 P3):这里原来是一枚"15s 硬超时仍不可见 ⇒ 盲调
            // show()"的兜底线程。它用取可见性那个 getter(is_visible)问"亮没亮",而本票要抓的那个
            // 失效型下 webview 列表是空的、阻塞 getter 永不返回 ⇒ 线程自己也静默(取证:
            // 40 次启动里守卫开火 0 次,兜底也没留下任何一行)。判据已被上面那枚
            // `startup_health_gate` 取代(排在 `auto_refresh::start` 之前),它只读原子标志;
            // "绝不黑窗"那一语义由 `on_page_load` 的点亮支单独保住(同一次置位)。
            // 2026-08-16 修复:autostart 插件透传 --minimized(开机自启最小化到托盘),
            // 此前无任何 args 解析,开机自启会直接弹出主窗口。须在恢复窗口状态后执行。
            // 2026-09-28 立:**用户开关压过命令行参数** —— 这条反直觉,所以把理由写全:
            // - 契约的字面写法是「带 `--minimized` 或 launch_minimized=true ⇒ 隐藏」;
            // - 同一份契约又规定「带 `--minimized` 而 launch_minimized=false ⇒ 显示窗口」。
            //   两条同时成立的唯一自洽解就是"只看 launch_minimized",参数不再改变结果。
            // - 为什么必须这样:`--minimized` 是 autostart 插件注册启动项时**写死**的
            //   (见上面 tauri_plugin_autostart::init 的 Some(vec!["--minimized"])),用户只要
            //   开过一次自启,每次开机就都带着它。让参数说了算,等于"启动后进后台"这个开关
            //   一旦关掉就再也打不开 —— 持久化的用户选择被一条他改不动的命令行参数覆盖。
            // ⚠️ 如实登记行为变更:此前"开机自启即最小化"是默认表现,现在默认档
            //   launch_minimized=false ⇒ 自启也会弹窗口;要老表现请把该开关打开。
            // ⚠️ 2026-10-13 再修订(判据全文见 should_start_hidden):开关不再压制手动启动 ——
            //   launch_minimized=true 但**不带** --minimized(双击桌面快捷方式)⇒ 照常显示窗口。
            // 观测点(G-1038429 采样归因用,非 show 调用):把"本次到底是哪一档配置"落进日志,
            // 否则 5 趟采样只有外部读数、没有同一趟的配置自证。
            log::info!(
                "[window-show] site=startup_tray_gate trigger=非 show 调用——本次启动可见性闸门读数:\
                 launch_minimized={} ∧ argv_has_minimized={} ⇒ start_hidden={} ⇒ reveal_on_probe={}",
                startup_prefs.launch_minimized,
                argv_has_minimized,
                start_hidden,
                !start_hidden
            );
            if start_hidden {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            } else if argv_has_minimized {
                // 参数被盖掉这件事必须看得见,不能静默(否则下次没人知道为什么"自启不最小化了")。
                log::info!(
                    "[desktop-prefs] 带了 --minimized 但 launch_minimized=false ⇒ 按用户开关显示窗口\
                     (开关优先于参数,理由见上)"
                );
            } else if startup_prefs.launch_minimized {
                // 反向也一样要留痕:否则下次排查"明明勾着开关怎么还弹窗"会以为开关失效。
                log::info!(
                    "[desktop-prefs] 手动启动(无 --minimized)但 launch_minimized=true ⇒ 照常显示窗口\
                     (双击是明确的打开界面意图,开关只管开机自启)"
                );
            }
            // 注册全局快捷键(2026-07-29 扩充:3 个系统级快捷键)
            // 系统级 = 窗口失焦也能触发(与浏览器内 keydown 互补)
            // Ctrl+K 不注册(浏览器内 use-global-shortcuts.ts 已处理,窗口聚焦时用)
            // Ctrl+Shift+I:唤起/隐藏主窗口(原有,浏览器内无法监听)
            let _ = app.global_shortcut().on_shortcut("Ctrl+Shift+I", |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            log::info!("[window-show] site=shortcut_ctrl_shift_i trigger=用户按全局快捷键 Ctrl+Shift+I");
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            });
            // Ctrl+Shift+N:新建对话(系统级,窗口失焦也能触发;窗口聚焦时浏览器内也会触发,前端去重)
            let _ = app.global_shortcut().on_shortcut("Ctrl+Shift+N", |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if let Some(window) = app.get_webview_window("main") {
                        if let Err(e) = window.emit("desktop-shortcut", "new_chat") {
                            log::warn!("[desktop-event] emit desktop-shortcut failed: {}", e);
                        }
                        log::info!("[window-show] site=shortcut_ctrl_shift_n trigger=用户按全局快捷键 Ctrl+Shift+N(新建对话)");
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            });
            // Ctrl+Shift+S:快速截图(复用 Computer Control 的 capture_screen,emit 给前端)
            let _ = app.global_shortcut().on_shortcut("Ctrl+Shift+S", |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if let Some(window) = app.get_webview_window("main") {
                        if let Err(e) = window.emit("desktop-shortcut", "quick_screenshot") {
                            log::warn!("[desktop-event] emit desktop-shortcut failed: {}", e);
                        }
                        log::info!("[window-show] site=shortcut_ctrl_shift_s trigger=用户按全局快捷键 Ctrl+Shift+S(快速截图)");
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            });
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            git_channel_ipc::git_authorize_workspace,
            git_channel_ipc::git_workspace_status,
            git_channel_ipc::git_workspace_diff,
            git_channel_ipc::workspace_index_scan,
            git_channel_ipc::git_channel_info,
            embedded_browser::embedded_browser_open,
            embedded_browser::embedded_browser_close,
            embedded_browser::embedded_browser_state,
            embedded_browser::embedded_browser_new_tab,
            embedded_browser::embedded_browser_devtools,
            browser_bookmarks::embedded_browser_data,
            browser_bookmarks::embedded_browser_add_bookmark,
            browser_bookmarks::embedded_browser_delete_bookmark,
            browser_bookmarks::embedded_browser_clear_history,
            browser_bookmarks::embedded_browser_import_system_bookmarks,
            browser_bookmarks::embedded_browser_record_history,
            get_admin_window_info,
            toggle_devtools,
            quit_app,
            set_caption_button_theme,
            restart_app,
            open_admin_window,
            start_resize,
            toggle_fullscreen,
            toggle_always_on_top,
            screenshot_screen,
            mouse_move,
            mouse_click,
            keyboard_type,
            mouse_scroll,
            keyboard_press,
            keyboard_hotkey,
            active_window,
            clipboard_get,
            clipboard_set,
            read_text_file,
            read_binary_file,
            write_text_file,
            list_dir,
            stat_file,
            save_window_state,
            restore_window_state,
            reset_window_state,
            clear_webview_cache,
            set_tray_status,
            get_tray_always_visible,
            set_tray_always_visible,
            get_desktop_prefs,
            set_desktop_prefs,
            resolve_close_choice,
            set_desktop_badge,
            take_pending_deep_links,
            // 2026-10-09 签到捕获(WP-C):7 条命令,判据与执行都在 checkin_capture.rs,这里只注册。
            checkin_capture::checkin_detect_trae_dir,
            checkin_capture::checkin_capture_jwts,
            checkin_capture::checkin_capture_qoder,
            checkin_capture::checkin_capture_workbuddy,
            checkin_capture::checkin_capture_minimax,
            // 2026-10-16 内嵌浏览器版:窗口开/关统一走 embedded_browser(注册在上方),
            // 这里只留 probe(读内嵌窗 cookie jar + 服务端验证,见 checkin_web_login.rs)。
            checkin_web_login::checkin_workbuddy_web_login_probe,
            checkin_web_login::checkin_workbuddy_web_login_probe_cookie,
            checkin_capture::checkin_reset_device_ids,
            checkin_capture::checkin_get_public_ip,
            checkin_capture::checkin_one_click_reset,
            checkin_capture::checkin_audit_trae_residual,
            checkin_capture::checkin_snapshot_backup,
            checkin_capture::checkin_snapshot_restore,
    checkin_capture::checkin_snapshot_list,
    checkin_capture::checkin_snapshot_delete,
    workbuddy_reset::workbuddy_reset_probe,
    workbuddy_reset::workbuddy_reset_maintenance,
    workbuddy_reset::workbuddy_reset_logout,
    workbuddy_reset::workbuddy_reset_plan,
    workbuddy_reset::workbuddy_quarantine_list,
    workbuddy_reset::workbuddy_quarantine_restore,
    workbuddy_reset::workbuddy_quarantine_delete,
    workbuddy_reset::workbuddy_reset_history,
    qoder_reset::qoder_reset_probe,
    qoder_reset::qoder_reset_plan,
    qoder_reset::qoder_reset_maintenance,
    qoder_reset::qoder_reset_logout,
    qoder_reset::qoder_reset_factory,
    qoder_reset::qoder_quarantine_list,
    qoder_reset::qoder_quarantine_restore,
    qoder_reset::qoder_quarantine_delete,
    qoder_reset::qoder_reset_history,
    qoder_reset::checkin_audit_qoder_residual,
    workbuddy_reset::checkin_audit_workbuddy_residual,
    minimax_reset::minimax_reset_probe,
    minimax_reset::minimax_reset_plan,
    minimax_reset::minimax_reset_maintenance,
    minimax_reset::minimax_reset_logout,
    minimax_reset::minimax_reset_factory,
    minimax_reset::minimax_quarantine_list,
    minimax_reset::minimax_quarantine_restore,
    minimax_reset::minimax_quarantine_delete,
    minimax_reset::minimax_reset_history,
    minimax_reset::checkin_audit_minimax_residual,
    checkin_capture::checkin_one_click_reset_all,
    workbuddy_reset::workbuddy_reset_factory,
    // 2026-10-26 立:屏幕即手 operator。operator_decide=纯决策预览(不碰屏幕);
    // operator_execute=真实截屏→决策→键鼠执行。判据纯函数见 operator.rs。
    operator::operator_decide,
    operator::operator_execute
        ])
        .run(context)
        .unwrap_or_else(|e| {
            // 2026-07-22 P0 Round 5 鲁棒性加固:主入口 panic → 写 crash log + exit(1)
            // 原:.expect() 会 panic 导致"应用已停止运行"弹窗,无 crash log 落盘
            // 新:尝试写 crash log 到 APPDATA/LOCALAPPDATA(不依赖额外 crate),失败也 exit(1)
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let log_content = format!(
                "IHUI Desktop crash report\nTimestamp: {}\nError: {}\n\n{:?}",
                ts, e, e
            );
            // 尝试写 crash log(Windows: %APPDATA%,macOS/Linux: $HOME)
            let written = (|| {
                let base = std::env::var_os("APPDATA")
                    .or_else(|| std::env::var_os("XDG_DATA_HOME"))
                    .or_else(|| std::env::var_os("HOME"))?;
                let log_dir = std::path::Path::new(&base).join("com.ihui.ai").join("logs");
                std::fs::create_dir_all(&log_dir).ok()?;
                let log_path = log_dir.join(format!("crash-{}.log", ts));
                std::fs::write(&log_path, &log_content).ok()?;
                Some(log_path)
            })();
            match &written {
                // crash handler 在 tauri_plugin_log 初始化之前触发,log::error! 会丢失,
                // 用 eprintln! 保证 stderr 至少有输出(父进程可捕获),crash log 文件已落盘
                Some(p) => eprintln!("[crash] IHUI Desktop error log written to: {:?}", p),
                None => eprintln!("[crash] IHUI Desktop error (log write failed): {}", log_content),
            }
            std::process::exit(1);
        });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
