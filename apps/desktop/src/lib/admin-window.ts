/**
 * Tauri admin 窗口管理 + 浏览器降级。
 *
 * - Tauri 2 runtime:通过 `getAllWebviewWindows()` 找到 label=admin 的窗口并 show/setFocus;
 *   若不存在则提示用户该窗口未配置(由 tauri.conf.json 静态声明)。
 * - 浏览器/dev/vitest:`<a target="_blank">` 降级。
 */
import { getAllWebviewWindows } from '@tauri-apps/api/webviewWindow'

const ADMIN_WINDOW_LABEL = 'admin'
const ADMIN_URL = '/admin'

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export interface OpenAdminWindowResult {
  opened: boolean
  label: string
  via: 'tauri' | 'browser'
}

/** 打开 admin 窗口;在浏览器环境用新标签页兜底。 */
export async function openAdminWindow(): Promise<OpenAdminWindowResult> {
  if (!isTauriRuntime()) {
    if (typeof window !== 'undefined') {
      window.open(ADMIN_URL, '_blank', 'noopener,noreferrer')
    }
    return { opened: true, label: ADMIN_WINDOW_LABEL, via: 'browser' }
  }
  const windows = await getAllWebviewWindows()
  const target = windows.find((w) => w.label === ADMIN_WINDOW_LABEL)
  if (!target) {
    return { opened: false, label: ADMIN_WINDOW_LABEL, via: 'tauri' }
  }
  await target.show()
  await target.setFocus()
  return { opened: true, label: ADMIN_WINDOW_LABEL, via: 'tauri' }
}

export async function isAdminWindow(): Promise<boolean> {
  if (!isTauriRuntime()) {
    return typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
  }
  try {
    const windows = await getAllWebviewWindows()
    return Boolean(windows.find((w) => w.label === ADMIN_WINDOW_LABEL))
  } catch {
    return false
  }
}
