// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L05/RP-8 桌面通道注册表(web 侧唯一取名字面量处),2026-11-26。
 *
 * 现状:16 处 `invoke('snake_case')` 把命令名写死在调用点。改一个 Rust 侧命令名,
 * 只能靠全局搜索,漏一处就是"点了没反应且不报错"(Tauri 对未知命令 reject 的是字符串,
 * 很容易被 `catch(() => {})` 吞掉)。
 *
 * 判据:`apps/web/src` 里除本文件外**不许**出现 `invoke('<字面量>'`;
 * 新命令必须先在这里登记(带 owner 与用途),再由 `scripts/check-desktop-invoke-registry.mjs` 守住。
 *
 * 说明:这里只登记 web → Rust 的**调用名**;参数与返回值类型仍由各调用点自己收敛
 * (Tauri 的 payload 是弱类型,强塞泛型会造出"看起来类型安全其实没校验"的假象)。
 */

export const DESKTOP_COMMANDS = {
  /** 关闭确认弹窗的选择回填(owner: desktop-prefs-bridge) */
  resolveCloseChoice: 'resolve_close_choice',
  /** 设置任务栏/托盘未读徽标(owner: desktop-prefs-bridge) */
  setDesktopBadge: 'set_desktop_badge',
  /** 打开浏览器画中画窗口(owner: tauri-bridge) */
  openBrowserPipWindow: 'open_browser_pip_window',
  /** 关闭浏览器画中画窗口(owner: tauri-bridge) */
  closeBrowserPipWindow: 'close_browser_pip_window',
  /** 把画中画窗口交还给系统浏览器(owner: tauri-bridge) */
  handoverBrowserPipWindow: 'handover_browser_pip_window',
  /** 托盘图标常驻开关(owner: tauri-bridge) */
  setTrayAlwaysVisible: 'set_tray_always_visible',
  /** 标题栏按钮明暗主题(owner: tauri-bridge) */
  setCaptionButtonTheme: 'set_caption_button_theme',
  /** 打开管理后台窗口(owner: tauri-bridge) */
  openAdminWindow: 'open_admin_window',
  /** 开/关开发者工具(owner: tauri-bridge) */
  toggleDevtools: 'toggle_devtools',
  /** 退出应用(owner: tauri-bridge) */
  quitApp: 'quit_app',
  /** 查询系统通知权限(owner: tauri-bridge) */
  queryNotificationPermission: 'query_notification_permission',
  /** 保存窗口位置/尺寸(owner: tauri-bridge) */
  saveWindowState: 'save_window_state',
  /** 恢复窗口位置/尺寸(owner: tauri-bridge) */
  restoreWindowState: 'restore_window_state',
  /** 重置窗口位置/尺寸(owner: tauri-bridge) */
  resetWindowState: 'reset_window_state',
  /** 托盘状态与未读数(owner: tauri-bridge) */
  setTrayStatus: 'set_tray_status',
  /** 阻止系统休眠开关(owner: wake-lock) */
  setSleepPrevention: 'set_sleep_prevention',
  /** 同步"开机自启"开关到更新器(owner: tauri-bridge) */
  updateV2SyncAutostart: 'update_v2_sync_autostart',
  /** 把已下载更新包置为待安装(owner: tauri-bridge) */
  updateV2Stage: 'update_v2_stage',
  /** 重启并安装更新(owner: tauri-bridge) */
  updateV2Restart: 'update_v2_restart',
  /** 启动握手:取 nativeBridge 版本 + 方法清单/摘要(owner: native-bridge-handshake) */
  getNativeBridgeManifest: 'get_native_bridge_manifest',
} as const

export type DesktopCommand = (typeof DESKTOP_COMMANDS)[keyof typeof DESKTOP_COMMANDS]
/** 通道名必须是注册表里的值,调用点写变量时用这个类型收口。 */
export type DesktopCommandName = keyof typeof DESKTOP_COMMANDS
/** 注册表里的全部 snake_case 命令值(握手比对与 CI 双向校验都读它,别再另抄一份)。 */
export const DESKTOP_COMMAND_VALUES = Object.values(DESKTOP_COMMANDS) as DesktopCommand[]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
