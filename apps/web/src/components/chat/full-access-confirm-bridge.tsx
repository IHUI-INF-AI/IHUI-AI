// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { FullAccessConfirmDialog } from '@/components/ai/full-access-confirm-dialog'
import { useAiPanelStore } from '@/stores/ai-panel'
import { updateLatestRecordSource } from '@/lib/permission-mode-history'
import { recordModeChange } from '@/lib/permission-mode-history'

/** 撤销 toast 持续时间(ms)。与 PermissionModePopover 保持一致 */
const UNDO_TOAST_DURATION = 5000

/** 首次启用高风险模式确认弹窗桥接组件(2026-07-25 深化,深度对标 Codex CLI safety guard)
 *  - 监听 ai-panel store.pendingFullAccess 控制 Dialog open
 *  - confirm:FullAccessConfirmDialog 内部已写 localStorage(suppressed 或 acknowledged),
 *    此处只关弹窗 + 触发实际切模式 + 弹 5s 撤销 toast
 *  - cancel:只 setPendingFullAccess(false),不动 activeWorkspace.mode
 * 单独抽组件是避免污染主组件 useEffect deps + 减少主函数重渲染 */
export function FullAccessConfirmBridge() {
  const t = useTranslations('chat.permission')
  const pendingFullAccess = useAiPanelStore((s) => s.pendingFullAccess)
  const setPendingFullAccess = useAiPanelStore((s) => s.setPendingFullAccess)

  const handleConfirm = React.useCallback(() => {
    setPendingFullAccess(false)
    // 不在这里做乐观更新，完全交给 switchPermissionMode 处理，
    // 避免与它内部的乐观更新/回滚逻辑重复，也避免 stale closure。
    void (async () => {
      const { switchPermissionMode } = await import('@/components/ai/permission-mode-popover')
      const { toast } = await import('sonner')
      // 从 store 实时读取，避免闭包陈旧
      // 2026-08-31:未绑定工作区时 previousMode 从暂存模式读取
      const store = useAiPanelStore.getState()
      const previousMode = store.activeWorkspace?.mode ?? store.pendingPermissionMode
      const result = await switchPermissionMode('bypass-permissions')
      if (!result.ok) {
        // switchPermissionMode 内部已做乐观回滚，这里只补 toast
        toast.error(t('switchedToFullError', { error: result.error ?? '未知错误' }))
        return
      }
      // 补一条历史记录（confirm-dialog 来源），并覆盖 message-input useEffect 默认写入的 'popover'
      try {
        const wsPath = store.activeWorkspace?.path ?? ''
        recordModeChange({
          mode: 'bypass-permissions',
          workspacePath: wsPath,
          timestamp: Date.now(),
          source: 'confirm-dialog',
        })
        updateLatestRecordSource('confirm-dialog', (e) => e.mode === 'bypass-permissions')
      } catch {
        // 历史模块不可用时静默
      }
      // 切到完全访问 → 5s 撤销 toast(与 popover 一致体验)
      toast(t('switchedToFull'), {
        description: t('switchedToFullDesc', { prev: previousMode ?? 'default' }),
        duration: UNDO_TOAST_DURATION,
        action: {
          label: t('undo'),
          onClick: async () => {
            // 2026-08-31:未绑定工作区时也检查暂存模式
            const currentStore = useAiPanelStore.getState()
            const nowMode = currentStore.activeWorkspace?.mode ?? currentStore.pendingPermissionMode
            if (nowMode === 'bypass-permissions') {
              await switchPermissionMode(previousMode ?? 'default')
            }
          },
        },
      })
    })()
  }, [setPendingFullAccess, t])

  const handleCancel = React.useCallback(() => {
    setPendingFullAccess(false)
  }, [setPendingFullAccess])

  return (
    <FullAccessConfirmDialog
      open={pendingFullAccess}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
