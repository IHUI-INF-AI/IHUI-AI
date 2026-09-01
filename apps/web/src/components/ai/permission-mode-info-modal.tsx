// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

/**
 * 权限模式详细说明 modal(2026-07-25 立,可解释性增强)
 *
 * 触发场景:
 * - 只在高风险模式(bypass-permissions)显示 ⓘ 按钮时唤起
 * - 由 message-input 的 infoMode 状态控制显隐
 *
 * UI 组成:
 * - 标题栏:图标 + "权限模式说明" + 关闭按钮
 * - 4 条该模式详细行为 bullet
 * - 底部"知道了"关闭按钮
 *
 * 数据流:
 * - 受控:mode + onClose 双向绑定
 * - 不持久化 React 状态(防 SSR hydration mismatch)
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { X, ShieldAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@ihui/ui-react'

export interface PermissionModeInfoModalProps {
  /** 当前权限模式,为 null 时不显示 */
  mode: string | null
  onClose: () => void
}

export function PermissionModeInfoModal({ mode, onClose }: PermissionModeInfoModalProps) {
  const t = useTranslations('chat.permission')
  const open = mode === 'bypass-permissions'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md" data-testid="permission-mode-info-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            {t('infoModalTitle')}
          </DialogTitle>
          <DialogDescription>{t('infoModalDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
              <span>{t('infoModalBullet1')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
              <span>{t('infoModalBullet2')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
              <span>{t('infoModalBullet3')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
              <span>{t('infoModalBullet4')}</span>
            </li>
          </ul>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            data-testid="permission-mode-info-close"
          >
            {t('infoModalClose')}
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PermissionModeInfoModal
