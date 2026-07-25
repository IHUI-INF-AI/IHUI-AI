'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, ShieldX } from 'lucide-react'

import { Modal } from '@/components/feedback'
import { cn } from '@/lib/utils'

/** 首次启用高风险模式(bypass-permissions)确认弹窗(2026-07-25 深化,深度对标 Codex CLI safety guard)
 *
 * 触发场景:
 * - 用户从 default/accept-edits 切到 bypass-permissions(无论通过 Popover、Shift+Tab、还是 /permission full)
 * - 且从未在本浏览器中确认过("ihui:full-access-acknowledged" 标志)
 * - 且未勾选"不再提醒"("ihui:full-access-suppressed")
 *
 * UX 细节:
 * - 必须勾选"我了解上述风险"复选框才能点"继续启用"按钮(防止误点)
 * - 复选框状态用 useState(组件级,关闭即重置,避免下次直接通过)
 * - "不再提醒"复选框选择时,写入 localStorage.acknowledged = true(关弹窗即生效)
 * - 确认时调 onConfirm();取消时调 onCancel()(关弹窗,不写 localStorage)
 *
 * 持久化:
 * - acknowledged: 一次性确认标志(用于 toast 文案"已确认高风险模式")
 * - suppressed:   永久静默标志(用户在危险确认弹窗里勾"不再提醒")
 * - 单独 key,避免"已确认"被"已静默"覆盖导致下次仍弹
 *
 * 触发逻辑在调用方控制:本组件只负责 UI。
 */

const STORAGE_KEY_ACKNOWLEDGED = 'ihui:full-access-acknowledged'
const STORAGE_KEY_SUPPRESSED = 'ihui:full-access-suppressed'

/** 当前是否已被"不再提醒"静默(用于调用方在弹窗前先 fast-path) */
export function isFullAccessConfirmSuppressed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY_SUPPRESSED) === '1'
  } catch {
    return false
  }
}

/** 标记用户已确认(单次,用于 toast 文案) */
export function markFullAccessAcknowledged(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY_ACKNOWLEDGED, '1')
  } catch {
    // 静默
  }
}

/** 标记用户已选择"不再提醒"(永久静默) */
export function markFullAccessSuppressed(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY_SUPPRESSED, '1')
    window.localStorage.setItem(STORAGE_KEY_ACKNOWLEDGED, '1')
  } catch {
    // 静默
  }
}

/** 重置所有标志(供用户主动"重新提醒我"使用) */
export function resetFullAccessAcknowledgement(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY_ACKNOWLEDGED)
    window.localStorage.removeItem(STORAGE_KEY_SUPPRESSED)
  } catch {
    // 静默
  }
}

interface FullAccessConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function FullAccessConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: FullAccessConfirmDialogProps) {
  const t = useTranslations('chat.permission')
  const [acknowledged, setAcknowledged] = React.useState(false)
  const [neverShow, setNeverShow] = React.useState(false)

  // 弹窗打开时强制重置 acknowledged(避免上次勾选残留导致直接通过)
  React.useEffect(() => {
    if (open) {
      setAcknowledged(false)
      // neverShow 不重置:用户如果勾了"不再提醒"中途关掉弹窗,再开仍保留意愿
    }
  }, [open])

  const handleConfirm = () => {
    if (!acknowledged) return
    if (neverShow) {
      markFullAccessSuppressed()
    } else {
      markFullAccessAcknowledged()
    }
    onConfirm()
  }

  const bullets = [
    t('firstTimeConfirmBullet1'),
    t('firstTimeConfirmBullet2'),
    t('firstTimeConfirmBullet3'),
  ]

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
            <ShieldX className="h-4 w-4 text-amber-500" aria-hidden="true" />
          </div>
          <span>{t('firstTimeConfirmTitle')}</span>
        </div>
      }
      description={t('firstTimeConfirmDesc')}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border bg-foreground/5 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            {t('firstTimeConfirmCancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!acknowledged}
            data-testid="full-access-confirm-button"
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              acknowledged
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'cursor-not-allowed bg-muted text-muted-foreground/50',
            )}
          >
            {t('firstTimeConfirmProceed')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {/* 风险要点列表(2026-07-25 深化,Codex CLI 风格:逐条列出关键风险) */}
        <ul className="space-y-1.5 text-sm text-foreground/90">
          {bullets.map((line, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
                aria-hidden="true"
              />
              <span className="leading-snug">{line}</span>
            </li>
          ))}
        </ul>

        {/* 复选框区:必须勾选"我了解"才能继续 */}
        <div className="space-y-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-amber-500"
              data-testid="full-access-acknowledge-checkbox"
            />
            <span className="leading-snug">{t('firstTimeConfirmAcknowledge')}</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={neverShow}
              onChange={(e) => setNeverShow(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-amber-500"
              data-testid="full-access-never-show-checkbox"
            />
            <span className="leading-snug">{t('firstTimeConfirmNeverShow')}</span>
          </label>
        </div>
      </div>
    </Modal>
  )
}

export default FullAccessConfirmDialog

/** 暴露内部 storage key 供自验脚本引用(避免硬编码 2 处) */
export const __FULL_ACCESS_STORAGE_KEYS__ = {
  acknowledged: STORAGE_KEY_ACKNOWLEDGED,
  suppressed: STORAGE_KEY_SUPPRESSED,
} as const
