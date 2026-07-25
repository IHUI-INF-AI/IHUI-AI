'use client'

import { toast } from 'sonner'
import {
  openAdminWindow,
  quitApp,
  toggleDevtools,
  getDesktopAppInfo,
  type MenuActionId,
} from '@/lib/tauri-bridge'

/**
 * dispatchMenuAction — 菜单动作统一调度器(2026-07-25 立)
 *
 * 所有菜单项行为集中在这一处,避免散落在各组件。
 * 行为映射(与 Rust 端 build_app_menu ID 一致):
 * - file.open_admin → 唤起/创建 admin 窗口
 * - view.reload     → 刷新当前 webview
 * - view.devtools   → 切换 devtools
 * - help.about      → toast 显示版本信息
 * - file.quit       → 真正退出(不走 closeWindow 的"隐藏到托盘")
 *
 * @param id 菜单 ID
 */
export async function dispatchMenuAction(id: MenuActionId): Promise<void> {
  switch (id) {
    case 'file.open_admin':
      try {
        await openAdminWindow()
      } catch (e) {
        toast.error('打开管理后台失败')
        console.error('[menu] open_admin failed', e)
      }
      break

    case 'view.reload':
      window.location.reload()
      break

    case 'view.devtools':
      try {
        await toggleDevtools()
      } catch {
        toast.error('切换开发者工具失败')
      }
      break

    case 'help.about': {
      try {
        const info = await getDesktopAppInfo()
        toast.info(
          `${info?.name ?? '智汇AI'} v${info?.version ?? '0.0.0'} (${info?.platform ?? 'unknown'})`,
          { duration: 4000 },
        )
      } catch {
        toast.info('智汇AI', { duration: 3000 })
      }
      break
    }

    case 'file.quit':
      await quitApp()
      break

    default:
      // unknown id 静默忽略(未来菜单新增时不会崩)
      break
  }
}
