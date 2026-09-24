// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
'use client'

// D67 额度归属卡(G-90,与 D56 合并) —— 对话流内渲染件。
//
// **数据面纪律(台账 D72 同款)**:本卡**不取数**。归属四型判定 / 动作族 /
// 折扣倒计时一律走 `@ihui/shared/chat/quota-ownership` 纯函数,本卡只渲染
// 判定结果;动作回调由调用方注入(onAction,接 D39 QuotaActionFamily 既有的
// /models/usage · 会话内模型选择器 · /vip 通道),卡片自己不 fetch、不路由。
//
// **「不充值可用心智」边界(本票灵魂,判定层已机器化)**:
//   · 显示门槛 shouldShowOwnershipCard:仅**当次请求因额度被拒**才渲染,
//     预防性展示(rejectedByQuota=false)本卡直接返回 null;
//   · freeTierAvailable=true 时判定层已把付费动作(upgradeOrAdmin)从动作族
//     剔除,本卡改渲染降级建议(degradeHint)—— 与 D39 QuotaActionFamily
//     的 freeTierAvailable 付费诱导屏蔽同口径。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  discountCountdown,
  formatDurationHuman,
  isInducementRisk,
  quotaOwnershipView,
  shouldShowOwnershipCard,
  type DurationUnitLabels,
  type QuotaOwnershipAction,
  type QuotaOwnershipKind,
} from '@ihui/shared/chat/quota-ownership'

export interface QuotaOwnershipCardProps {
  /** 额度归属四型之一;null ⇒ 不渲染(归属未知不硬塞) */
  kind: QuotaOwnershipKind | null
  /** 当次请求是否因额度被拒;缺省 true(本卡只在被拒场景挂载,门槛仍显式判) */
  rejectedByQuota?: boolean
  /** 免费档仍可用 ⇒ 判定层剔除付费动作,本卡渲染降级建议 */
  freeTierAvailable?: boolean
  /** 低峰折扣窗口(epoch ms);不传则不渲染折扣行 */
  discountWindow?: { readonly windowStart: number; readonly windowEnd: number; readonly now?: number }
  /** 动作回调。**数据面在调用方**,本卡只负责触发;不传则不渲染动作行 */
  onAction?: (action: QuotaOwnershipAction) => void
  className?: string
  'data-testid'?: string
}

export function QuotaOwnershipCard({
  kind,
  rejectedByQuota = true,
  freeTierAvailable = false,
  discountWindow,
  onAction,
  className,
  'data-testid': testId,
}: QuotaOwnershipCardProps) {
  const t = useTranslations('ai.pane.quotaOwnership')

  const gate = { rejectedByQuota, kind }
  if (!shouldShowOwnershipCard(gate)) return null
  const ownershipKind: QuotaOwnershipKind = gate.kind

  const view = quotaOwnershipView(ownershipKind, { freeTierAvailable })
  const discount = discountWindow
    ? discountCountdown(discountWindow.now ?? Date.now(), discountWindow.windowStart, discountWindow.windowEnd)
    : null
  const units: DurationUnitLabels = { hour: t('duration.hour'), minute: t('duration.minute') }
  const actionLabel: Record<QuotaOwnershipAction, string> = {
    viewUsage: t('action.viewUsage'),
    switchFreeModel: t('action.switchFreeModel'),
    upgradeOrAdmin: t('action.upgradeOrAdmin'),
  }

  return (
    <div
      role="status"
      aria-label={t('ariaLabel')}
      className={cn('flex flex-col gap-2 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      data-quota-kind={view.kind}
      data-quota-escalate={String(view.escalate)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium" data-quota-title={view.kind}>
          {t(view.titleKey)}
        </span>
        {discount?.labelKey ? (
          <span
            className="text-[11px] tabular-nums text-amber-600 dark:text-amber-500"
            data-discount-phase={discount.phase}
            data-discount-remaining-ms={discount.remainingMs}
          >
            {discount.phase === 'upcoming'
              ? t('discount.upcoming', { time: formatDurationHuman(discount.remainingMs ?? 0, units) })
              : t('discount.active')}
          </span>
        ) : null}
      </div>

      {isInducementRisk({ kind: ownershipKind, freeTierAvailable }) ? (
        <p
          className="text-[11px] text-emerald-600 dark:text-emerald-400"
          data-quota-degrade-hint={view.kind}
        >
          {t('degradeHint')}
        </p>
      ) : null}

      {onAction ? (
        <div className="flex flex-wrap items-center gap-1" data-quota-actions={view.kind}>
          {view.actionKeys.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onAction(action)}
              data-action={action}
              className="rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {actionLabel[action]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
// [tail-watermark-placeholder]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
