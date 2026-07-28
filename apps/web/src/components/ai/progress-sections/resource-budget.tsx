'use client'

/**
 * ResourceBudget — Trae Work 风格"资源预算"指示器(2026-07-28 立,Phase 18.4)
 *
 * 截图特征:
 * - 底部灰色小字 "Current usage: 3 / 60 step budget"
 * - 可选进度条(0% → 100%,超限时变红)
 *
 * 用途:在 AI 消息流头部或底部显示"上下文 step 预算使用情况",
 * 让用户了解对话的进度预算,避免 agent 在长对话中无限制扩张。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface ResourceBudgetProps {
  used: number
  total: number
  /** 显示模式:compact=仅文字(标题栏) / full=文字+进度条(消息流底部) */
  variant?: 'compact' | 'full'
  className?: string
}

export const ResourceBudget = React.memo(function ResourceBudget({
  used,
  total,
  variant = 'compact',
  className,
}: ResourceBudgetProps) {
  const t = useTranslations('ai.budget')
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const overLimit = used > total * 0.8
  const overLimitDanger = used > total

  const text = `${used} / ${total}`

  if (variant === 'compact') {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-0.5 text-[10px] tabular-nums',
          overLimitDanger
            ? 'text-red-500'
            : overLimit
              ? 'text-amber-500'
              : 'text-muted-foreground/70',
          className,
        )}
        title={t('tooltip', { used, total })}
        aria-label={t('label', { used, total })}
        data-testid="resource-budget-compact"
      >
        <span>{text}</span>
        <span className="text-muted-foreground/60">step budget</span>
      </span>
    )
  }

  return (
    <div
      className={cn(
        'space-y-0.5 rounded-sm bg-muted/30 px-2 py-1 text-[10px]',
        className,
      )}
      data-testid="resource-budget-full"
    >
      <div className="flex items-center justify-between text-muted-foreground/80">
        <span>{t('label', { used, total })}</span>
        <span className="tabular-nums">{text}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full transition-all duration-300',
            overLimitDanger
              ? 'bg-red-500'
              : overLimit
                ? 'bg-amber-500'
                : 'bg-primary/60',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
})
