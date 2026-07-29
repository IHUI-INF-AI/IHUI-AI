'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { FullAccessConfirmDialog } from '@/components/ai/full-access-confirm-dialog'
import { useAiPanelStore } from '@/stores/ai-panel'

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
  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)
  const setActiveWorkspace = useAiPanelStore((s) => s.setActiveWorkspace)

  const handleConfirm = React.useCallback(() => {
    setPendingFullAccess(false)
    if (!activeWorkspace) return
    const previousMode = activeWorkspace.mode
    // 乐观更新 + 落库(动态 import 避免循环依赖)
    setActiveWorkspace({ ...activeWorkspace, mode: 'bypass-permissions' })
    void (async () => {
      const { switchPermissionMode } = await import('@/components/ai/permission-mode-popover')
      const { toast } = await import('sonner')
      const result = await switchPermissionMode('bypass-permissions')
      if (!result.ok) {
        if (previousMode !== undefined) {
          setActiveWorkspace({ ...activeWorkspace, mode: previousMode })
        }
        return
      }
      // 切到完全访问 → 5s 撤销 toast(与 popover 一致体验)
      toast(t('switchedToFull'), {
        description: t('switchedToFullDesc', {
          prev: previousMode ?? 'default',
        }),
        duration: 5000,
        action: {
          label: t('undo'),
          onClick: async () => {
            await switchPermissionMode(previousMode ?? 'default')
          },
        },
      })
    })()
  }, [activeWorkspace, setActiveWorkspace, setPendingFullAccess, t])

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
