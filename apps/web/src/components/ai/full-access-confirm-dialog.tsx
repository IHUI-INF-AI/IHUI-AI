// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * - 且当前没有一条**有效**的静默授权(见下方"持久化"与 `@/lib/full-access-suppression`)
 *
 * UX 细节:
 * - 必须勾选"我了解上述风险"复选框才能点"继续启用"按钮(防止误点)
 * - 复选框状态用 useState(组件级,关闭即重置,避免下次直接通过)
 * - "不再提醒"复选框选中时,写入一条有期限、绑档、绑风险说明版本的静默授权
 * - 确认时调 onConfirm();取消时调 onCancel()(关弹窗,不写授权)
 *
 * 持久化(2026-09-28 票 G-414 ② 收口,原先形态是"勾一次就永久不再问"):
 * - 授权记录 = { subject(哪个档) + policyVersion(哪一版风险说明) + acknowledgedAt + expiresAt }
 * - 到期 / 换风险说明版本 / 问的是另一个档 ⇒ 授权失效,重新问人
 * - 只勾"我了解"没勾"不再提醒" ⇒ 记 acknowledgedAt(expiresAt=null),下次仍问
 * - 旧版裸 '1' 记录(既没绑档也没期限)按"无法判定是否仍然同意"处理 ⇒ 重新问一次,问过即升级为新记录
 * - 判不出(localStorage 不可读 / SSR)fail-closed 照问,但状态单独点名,不写成"已静默"
 * - 唯一 key:`ihui:full-access-suppressed`(旧的第二把 key 从未被任何生产路径读过,已并入这一条)
 *
 * 触发逻辑在调用方控制:本组件只负责 UI 与读写这唯一一条授权记录。
 */

import {
  FULL_ACCESS_SUPPRESSION_KEY,
  clearFullAccessSuppression,
  evaluateFullAccessSuppression,
  grantFullAccessSuppression,
  recordFullAccessAcknowledgement,
} from '@/lib/full-access-suppression'

/** 本弹窗对应的守卫对象(封闭集见 FULL_ACCESS_GUARD_SUBJECTS)。 */
const GUARD_SUBJECT = 'bypass-permissions' as const

/**
 * 当前是否已被"不再提醒"静默(用于调用方在弹窗前先 fast-path)。
 *
 * 只有拿到一条**仍然有效**的授权才返回 true;过期、换档、换风险说明版本、判不出 ⇒ false(照问)。
 * 需要知道"为什么问"的调用方(历史面板/测试)直接用 `evaluateFullAccessSuppression(GUARD_SUBJECT)`。
 */
export function isFullAccessConfirmSuppressed(): boolean {
  return evaluateFullAccessSuppression(GUARD_SUBJECT).suppressed
}

/** 记录"用户确认过一次风险"(不产生静默效果,下次照问;用于把确认这件事记在同一条记录上) */
export function markFullAccessAcknowledged(): void {
  recordFullAccessAcknowledgement(GUARD_SUBJECT)
}

/** 记录"用户选择不再提醒"⇒ 写入一条有期限、绑档、绑版本的静默授权 */
export function markFullAccessSuppressed(): void {
  grantFullAccessSuppression(GUARD_SUBJECT)
}

/** 撤销静默与确认(供用户主动"重新提醒我"使用) */
export function resetFullAccessAcknowledgement(): void {
  clearFullAccessSuppression()
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

  const bullets = [t('firstTimeConfirmBullet1')]

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
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
            className="rounded-xl border border-border bg-foreground/5 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            {t('firstTimeConfirmCancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!acknowledged}
            data-testid="full-access-confirm-button"
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
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

/** 暴露内部 storage key 供自验脚本引用(避免硬编码;读侧只有 @/lib/full-access-suppression 一处) */
export const __FULL_ACCESS_STORAGE_KEYS__ = {
  suppressed: FULL_ACCESS_SUPPRESSION_KEY,
} as const
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
