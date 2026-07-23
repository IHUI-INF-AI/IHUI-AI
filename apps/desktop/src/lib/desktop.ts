import { invoke } from '@tauri-apps/api/core'

// ================== 自动启动 ==================

/** 启用开机自启(参数 --minimized 已在 Rust 端 plugin init 配置)。 */
export async function enableAutostart(): Promise<void> {
  await invoke('plugin:autostart|enable')
}

/** 禁用开机自启。 */
export async function disableAutostart(): Promise<void> {
  await invoke('plugin:autostart|disable')
}

/** 查询当前开机自启状态。 */
export async function isAutostartEnabled(): Promise<boolean> {
  return await invoke<boolean>('plugin:autostart|is_enabled')
}

// ================== 窗口控制 ==================

/** 显示主窗口(用于 TS 侧主动唤起,如托盘菜单的 TS 调用)。 */
export async function showMainWindow(): Promise<void> {
  await invoke('plugin:window|show', { label: 'main' })
}

/** 隐藏主窗口(最小化到托盘)。 */
export async function hideMainWindow(): Promise<void> {
  await invoke('plugin:window|hide', { label: 'main' })
}

/** 切换主窗口显示/隐藏(用于全局快捷键的 TS 侧调用,如果需要)。 */
export async function toggleMainWindow(): Promise<boolean> {
  const visible = await invoke<boolean>('plugin:window|is_visible', { label: 'main' })
  if (visible) {
    await invoke('plugin:window|hide', { label: 'main' })
  } else {
    await invoke('plugin:window|show', { label: 'main' })
    await invoke('plugin:window|set_focus', { label: 'main' })
  }
  return !visible
}
