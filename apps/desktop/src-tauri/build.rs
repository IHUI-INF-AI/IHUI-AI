// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-10-10 根治:「远程页所有自定义命令 Plugin not found」。
// 病根(实锤于 tauri-build-2.6.3/src/acl.rs + tauri-2.11.5/src/ipc/authority.rs):
//   `tauri_build::build()` 默认 AppManifest::commands=&[] ⇒ 不生成 __app__ ACL 清单 ⇒
//   远程页(https://aizhs.top,薄壳化后主窗口加载它)调任何应用命令都解析不到授权条目,
//   报 "not allowed. Plugin not found"。本地 origin(应用内占位页)不受此限,故 dev 期
//   看不出问题;线上所有页面侧自定义命令(含 2026-10-09 签到捕获 WP-C 的 7 条)全灭。
// 修法:try_build + AppManifest::commands(全量命令表)⇒ 自动生成 allow-<命令>/deny-<命令>
//   权限;再在 capabilities/default.json 里对这些 allow-* 放行(远程 origin 生效)。
// 维护约定:在 lib.rs 的 invoke_handler 增删命令时,必须同步维护下面这张表与
//   capabilities/default.json 的 allow-* 清单(两处缺一即远程页该命令失效)。

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "get_app_info",
            "git_authorize_workspace",
            "git_workspace_status",
            "git_channel_info",
            "open_in_chrome",
            "get_admin_window_info",
            "toggle_devtools",
            "quit_app",
            "restart_app",
            "open_admin_window",
            "start_resize",
            "toggle_fullscreen",
            "toggle_always_on_top",
            "screenshot_screen",
            "mouse_move",
            "mouse_click",
            "keyboard_type",
            "mouse_scroll",
            "keyboard_press",
            "keyboard_hotkey",
            "active_window",
            "clipboard_get",
            "clipboard_set",
            "read_text_file",
            "read_binary_file",
            "write_text_file",
            "list_dir",
            "stat_file",
            "save_window_state",
            "restore_window_state",
            "reset_window_state",
            "clear_webview_cache",
            "set_tray_status",
            "get_tray_always_visible",
            "set_tray_always_visible",
            "get_desktop_prefs",
            "set_desktop_prefs",
            "resolve_close_choice",
            "set_desktop_badge",
            "take_pending_deep_links",
            "checkin_detect_trae_dir",
            "checkin_capture_jwts",
            "checkin_reset_device_ids",
            "checkin_get_public_ip",
            "checkin_one_click_reset",
            "checkin_audit_trae_residual",
            "checkin_snapshot_backup",
            "checkin_snapshot_restore",
            "checkin_snapshot_list",
            "checkin_snapshot_delete",
            "workbuddy_reset_probe",
            "workbuddy_reset_maintenance",
            "workbuddy_reset_logout",
            "workbuddy_reset_plan",
            "workbuddy_quarantine_list",
            "workbuddy_quarantine_restore",
            "workbuddy_quarantine_delete",
            "workbuddy_reset_history",
            "workbuddy_reset_factory",
        ])),
    )
    .expect("failed to run tauri-build");
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
