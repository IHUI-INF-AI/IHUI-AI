// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//! L07 桥版本握手(壳侧真源),2026-11-26。
//!
//! web 侧启动时调 `get_native_bridge_manifest`,拿协议版本、包版本、支持的命令清单
//! 与清单摘要,与自己的注册表比对。缺命令/摘要不符就整体禁用桌面入口。
//!
//! 摘要算法必须与 `apps/web/src/lib/native-bridge-handshake.ts` 一致:
//! FNV-1a 32-bit,输入排序后的命令名,名字之间一个 `\n`。
//! 清单这里手工维护一份 —— CI 的 `check-desktop-invoke-registry.mjs` 会拿它和
//! web 注册表逐名比对,任何一侧漏更新都会红。

use serde::Serialize;

/// 协议版本:web 与壳必须同时改、同时发;单边改即视为不兼容。
pub const NATIVE_BRIDGE_PROTOCOL_VERSION: u32 = 1;

/// web → Rust 的全部命令(与 `apps/web/src/lib/desktop-commands.ts` 一一对应)。
pub const BRIDGE_COMMANDS: &[&str] = &[
    "resolve_close_choice",
    "set_desktop_badge",
    "open_browser_pip_window",
    "close_browser_pip_window",
    "handover_browser_pip_window",
    "set_tray_always_visible",
    "set_caption_button_theme",
    "open_admin_window",
    "toggle_devtools",
    "quit_app",
    "query_notification_permission",
    "save_window_state",
    "restore_window_state",
    "reset_window_state",
    "set_tray_status",
    "set_sleep_prevention",
    "update_v2_sync_autostart",
    "update_v2_stage",
    "update_v2_restart",
    "get_native_bridge_manifest",
];

#[derive(Debug, Serialize)]
pub struct NativeBridgeManifest {
    pub protocol_version: u32,
    pub version: String,
    pub methods: Vec<&'static str>,
    pub method_digest: String,
}

/// FNV-1a 32-bit,输出 8 位小写十六进制。与 web 侧逐字节同构。
pub fn bridge_method_digest(methods: &[&str]) -> String {
    let mut sorted: Vec<&str> = methods.to_vec();
    sorted.sort_unstable();
    let mut hash: u32 = 0x811c_9dc5;
    for (i, name) in sorted.iter().enumerate() {
        if i > 0 {
            hash ^= 0x0a;
            hash = hash.wrapping_mul(0x0100_0193);
        }
        for byte in name.as_bytes() {
            hash ^= *byte as u32;
            hash = hash.wrapping_mul(0x0100_0193);
        }
    }
    format!("{hash:08x}")
}

#[tauri::command]
pub fn get_native_bridge_manifest(app: tauri::AppHandle) -> NativeBridgeManifest {
    NativeBridgeManifest {
        protocol_version: NATIVE_BRIDGE_PROTOCOL_VERSION,
        version: app.package_info().version.to_string(),
        methods: BRIDGE_COMMANDS.to_vec(),
        method_digest: bridge_method_digest(BRIDGE_COMMANDS),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn digest_matches_web_contract() {
        // 这个常量由 web 侧同名算法算出;两边任何一侧改算法/改清单都会在这里红。
        assert_eq!(bridge_method_digest(BRIDGE_COMMANDS), "7547ee14");
    }

    #[test]
    fn manifest_lists_every_command_once() {
        let mut seen = std::collections::HashSet::new();
        for name in BRIDGE_COMMANDS {
            assert!(seen.insert(*name), "重复命令: {name}");
        }
        assert_eq!(seen.len(), BRIDGE_COMMANDS.len());
    }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
