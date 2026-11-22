// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// WebView2 Runtime 版本守门(启动期一次性检查)。
//
// 背景:`bundle.windows.webviewInstallMode` 的 embedBootstrapper 只保证「装上」Runtime,
// 不保证版本;前端若用了较新 CSS/JS 特性,老 Runtime 会静默渲染错。本模块读系统默认
// Runtime 版本并与最低门槛比较,给出明确日志/提示。
// 纪律:任何一步读不到/比较不了 ⇒ 判「未判定」(Unknown),既不记绿也不冒红(仓库 §0.3)。
// 本文件整体只在 Windows 编译(lib.rs 的 mod 声明亦带 cfg,双保险),避免 macOS/Linux CI 失败。

#![cfg(target_os = "windows")]

use std::cmp::Ordering;
use webview2_com::Microsoft::Web::WebView2::Win32::{
    CompareBrowserVersions, GetAvailableCoreWebView2BrowserVersionString,
};
use windows_core::{PCWSTR, PWSTR};

/// WebView2 Runtime 最低门槛(单一真相源,不另立门槛)。
/// 出处:`apps/desktop/src-tauri/src/embedded_browser.rs:496` 注释
/// 「Runtime ≥ 114.0.1823.32」(`SetMemoryUsageTargetLevel` 失焦降内存 API 的最低版本);
/// `Cargo.toml` 同段 `[target.'cfg(windows)'.dependencies]` 注释亦点名该值。
pub const MIN_WEBVIEW2_RUNTIME: &str = "114.0.1823.32";

/// 启动期对 WebView2 Runtime 版本的判定结果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuntimeStatus {
    /// 已读到版本且 ≥ 门槛。
    Ok { current: String },
    /// 已读到版本但 < 门槛。
    BelowMinimum { current: String, minimum: &'static str },
    /// 读不到版本或比较失败 ⇒ 未判定(既不记绿也不冒红)。
    Unknown { reason: String },
}

/// 读系统默认安装的 WebView2 Runtime 版本;任何失败返回 None(判未判定,不 panic)。
fn read_runtime_version() -> Option<String> {
    let mut version_ptr: PWSTR = PWSTR::null();
    // SAFETY: `&mut version_ptr` 指向本栈帧内的 out 参数,生命周期仅覆盖本次 FFI 调用;
    // 成功时系统用 CoTaskMemAlloc 分配的 PWSTR 缓冲区所有权交还调用方,紧接着由
    // `webview2_com::take_pwstr` 接管(CoTaskMemPWSTR 的 Drop 负责 CoTaskMemFree);
    // 失败时契约上指针保持 null,`take_pwstr(null)` 安全返回空串 —— 不泄漏、不二次释放。
    let hr = unsafe {
        GetAvailableCoreWebView2BrowserVersionString(PCWSTR::null(), &mut version_ptr)
    };
    // 无论 HRESULT 成败都消费一次指针:成功取字符串并释放,失败取空串。
    let version = webview2_com::take_pwstr(version_ptr);
    if hr.is_err() || version.is_empty() {
        return None;
    }
    Some(version)
}

/// 用系统 FFI 比较两个版本字符串;`Less/Equal/Greater`,失败或其它值返回 None(未判定)。
fn compare_to_minimum(current: &str, minimum: &str) -> Option<Ordering> {
    // UTF-16 + NUL 结尾,交给 CompareBrowserVersions 判定(不用字符串字典序)。
    let mut v1: Vec<u16> = current.encode_utf16().collect();
    v1.push(0);
    let mut v2: Vec<u16> = minimum.encode_utf16().collect();
    v2.push(0);

    let p1 = PCWSTR::from_raw(v1.as_ptr());
    let p2 = PCWSTR::from_raw(v2.as_ptr());
    let mut result: i32 = 0;
    // SAFETY: `v1`/`v2` 是本函数内的 Vec<u16>,在 FFI 调用期间保持存活且不被改动,
    // 均以 0 收尾;`PCWSTR::from_raw` 仅作只读裸指针包装,不接管所有权、不释放内存,
    // 指针生命周期由这两个 Vec 保证;`&mut result` 指向本栈帧 i32,只在调用期有效。
    let hr = unsafe { CompareBrowserVersions(p1, p2, &mut result) };
    if hr.is_err() {
        return None;
    }
    // 契约只给 -1 / 0 / 1;其它值视为「没判出来」,不猜、不判绿。
    match result {
        -1 => Some(Ordering::Less),
        0 => Some(Ordering::Equal),
        1 => Some(Ordering::Greater),
        _ => None,
    }
}

/// 组合读取与比较;任何一步失败 ⇒ `Unknown`(不 panic、不 unwrap、不判绿)。
pub fn runtime_status() -> RuntimeStatus {
    let current = match read_runtime_version() {
        Some(v) => v,
        None => {
            return RuntimeStatus::Unknown {
                reason: "读取系统 WebView2 Runtime 版本失败(GetAvailableCoreWebView2BrowserVersionString 未给出有效版本)".into(),
            }
        }
    };
    match compare_to_minimum(&current, MIN_WEBVIEW2_RUNTIME) {
        Some(Ordering::Less) => RuntimeStatus::BelowMinimum {
            current,
            minimum: MIN_WEBVIEW2_RUNTIME,
        },
        Some(Ordering::Equal | Ordering::Greater) => RuntimeStatus::Ok { current },
        None => RuntimeStatus::Unknown {
            reason: format!(
                "比较版本 {} 与门槛 {} 失败(CompareBrowserVersions 未返回可判定的 -1/0/1)",
                current, MIN_WEBVIEW2_RUNTIME
            ),
        },
    }
}

/// 启动期入口(Lane B 在 setup 里调):按判定结果记日志,过旧档额外给用户发系统通知。
pub fn check_and_report(app: &tauri::AppHandle) {
    use tauri_plugin_notification::NotificationExt;

    match runtime_status() {
        RuntimeStatus::Ok { current } => log::info!(
            "[webview2-runtime] WebView2 Runtime 版本满足门槛: current={}, minimum={}",
            current,
            MIN_WEBVIEW2_RUNTIME
        ),
        RuntimeStatus::BelowMinimum { current, minimum } => {
            log::warn!(
                "[webview2-runtime] WebView2 Runtime 过旧: current={}, minimum={}; 前端可能渲染异常, 请升级 WebView2 Runtime",
                current,
                minimum
            );
            // 不能只躺在日志里:过旧档给用户一条系统通知。插件已在 lib.rs 的
            // `.plugin(tauri_plugin_notification::init())` 注册, notification() 不会 panic;
            // show() 失败一律静默忽略(let _), 不得影响启动。
            let _ = app
                .notification()
                .builder()
                .title("WebView2 Runtime 过旧")
                .body(format!(
                    "当前 {}, 最低要求 {}; 前端可能渲染异常, 请升级 WebView2 Runtime",
                    current, minimum
                ))
                .show();
        }
        RuntimeStatus::Unknown { reason } => log::warn!(
            "[webview2-runtime] 未能判定 WebView2 Runtime 版本是否满足门槛(未判定, 既不记绿也不冒红): {}",
            reason
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 真机实证:调用真实系统 FFI,判据是「不 panic 且落在三档之一」。
    ///
    /// 刻意不断言「必须 >= 门槛」—— 那等于要求每台跑测试的机器都装了新版 Runtime,
    /// 没装时 rightful 地落 `Unknown`,这仍应是通过(本模块的承诺是"不崩、不误判绿")。
    /// 想看在跑的是哪个版本:`cargo test -p ihui-desktop --lib -- --nocapture`。
    #[test]
    fn runtime_probe_never_panics_and_reports_one_of_three() {
        let status = runtime_status();
        match &status {
            RuntimeStatus::Ok { current } => {
                println!(
                    "[webview2-runtime][test] 满足门槛: current={} minimum={}",
                    current, MIN_WEBVIEW2_RUNTIME
                );
            }
            RuntimeStatus::BelowMinimum { current, minimum } => {
                println!("[webview2-runtime][test] 低于门槛: current={} minimum={}", current, minimum);
            }
            RuntimeStatus::Unknown { reason } => {
                println!("[webview2-runtime][test] 未判定: {}", reason);
            }
        }
        if let RuntimeStatus::Ok { current } | RuntimeStatus::BelowMinimum { current, .. } = &status {
            // 读到版本还必须是版本串的形状(a.b.c.d 至少三段),防止把乱码当成版本。
            assert!(
                current.split('.').count() >= 3 && current.chars().all(|c| c.is_ascii_digit() || c == '.'),
                "Runtime 版本串形状异常: {:?}",
                current
            );
        }
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
