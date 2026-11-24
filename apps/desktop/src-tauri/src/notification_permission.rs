// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! 通知权限状态查询(B3-05;只读,零副作用)。
//!
//! 病灶:本仓只有 `tauri-plugin-notification` 的**发送**面 —— 通知没弹出来时,前端无法区分
//! 「用户在系统里关了通知」与「发送链路故障」,只能给一句"通知失败"。
//!
//! 判据三条:
//! - 三态封闭:``allowed`` / ``denied`` / ``unjudged``(键缺失、读失败、非 Windows 一律未判定);
//! - **不冒充**:取不到就是 ``unjudged`` + 点名原因,绝不默认 ``allowed``(否则会把"没判"当"允许");
//! - 只读注册表值,不写、不改、不请求权限(改权限是用户的事,代码只能如实报告)。

use serde::Serialize;

/// 通知总开关所在的注册表键(HKCU 下)。
pub const NOTIFICATION_SETTINGS_PATH: &str =
    r"Software\Microsoft\Windows\CurrentVersion\Notifications\Settings";
/// 总开关值名(Win10/11 的 toast 总开关)。
pub const NOTIFICATION_TOAST_VALUE: &str = "NOC_GLOBAL_SETTING_TOASTS_ENABLED";

/// 一次权限探测的结论(可直接穿过 Tauri 边界)。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionReport {
    /// `allowed` / `denied` / `unjudged`
    pub state: String,
    /// 判定的依据或未判定的原因(不含用户数据)。
    pub reason: String,
    /// `registry` / `platform`
    pub source: String,
}

fn report(state: &str, reason: impl Into<String>, source: &str) -> PermissionReport {
    PermissionReport {
        state: state.to_string(),
        reason: reason.into(),
        source: source.to_string(),
    }
}

/// 纯判据:注册表值 → 三态。0=用户关闭,1=允许,缺失=未判定,其他值=未判定(并点名值)。
pub fn classify_notification_permission(value: Option<u32>) -> PermissionReport {
    match value {
        Some(1) => report("allowed", "registry-value-enabled", "registry"),
        Some(0) => report("denied", "registry-value-disabled", "registry"),
        Some(other) => report(
            "unjudged",
            format!("unexpected-registry-value-{other}"),
            "registry",
        ),
        None => report("unjudged", "registry-value-absent", "registry"),
    }
}

/// Windows 读取实现:只读打开,键或值缺失都落未判定(不 panic、不写)。
#[cfg(windows)]
pub fn read_notification_permission() -> PermissionReport {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = match hkcu.open_subkey(NOTIFICATION_SETTINGS_PATH) {
        Ok(key) => key,
        // 键不存在 ⇒ 系统从未写过该开关 ⇒ 未判定(不是"允许")。
        Err(_) => return classify_notification_permission(None),
    };
    match key.get_value::<u32, _>(NOTIFICATION_TOAST_VALUE) {
        Ok(value) => classify_notification_permission(Some(value)),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            classify_notification_permission(None)
        }
        Err(err) => report(
            "unjudged",
            format!("registry-read-failed-{err}"),
            "registry",
        ),
    }
}

/// 非 Windows:如实报未判定,不伪造 `allowed`。
#[cfg(not(windows))]
pub fn read_notification_permission() -> PermissionReport {
    report("unjudged", "platform-unsupported", "platform")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enabled_value_is_allowed() {
        let r = classify_notification_permission(Some(1));
        assert_eq!(
            (r.state.as_str(), r.reason.as_str()),
            ("allowed", "registry-value-enabled")
        );
    }

    #[test]
    fn disabled_value_is_denied() {
        let r = classify_notification_permission(Some(0));
        assert_eq!(
            (r.state.as_str(), r.reason.as_str()),
            ("denied", "registry-value-disabled")
        );
    }

    #[test]
    fn absent_value_is_unjudged_not_allowed() {
        let r = classify_notification_permission(None);
        assert_eq!(r.state, "unjudged");
        assert_ne!(r.state, "allowed");
        assert_eq!(r.reason, "registry-value-absent");
    }

    #[test]
    fn unexpected_value_is_unjudged_with_named_value() {
        let r = classify_notification_permission(Some(7));
        assert_eq!(r.state, "unjudged");
        assert!(r.reason.contains('7'));
    }

    #[test]
    fn non_windows_platform_is_unjudged() {
        #[cfg(not(windows))]
        assert_eq!(
            read_notification_permission().reason,
            "platform-unsupported"
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_read_never_panics_and_never_claims_allowed_without_evidence() {
        let r = read_notification_permission();
        assert!(matches!(
            r.state.as_str(),
            "allowed" | "denied" | "unjudged"
        ));
        if r.reason == "registry-value-absent" || r.reason == "registry-read-failed" {
            assert_eq!(r.state, "unjudged");
        }
        assert!(r.reason.starts_with("registry-") || r.reason.starts_with("unexpected-"));
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
