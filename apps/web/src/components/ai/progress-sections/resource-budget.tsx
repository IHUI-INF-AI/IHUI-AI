'use client'

import * as React from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * ResourceBudget — 资源预算指示器(2026-07-28 立,Trae Work 对齐)
 *
 * 用途:展示"Current usage: X / 60 step budget"等资源消耗
 * - 文字模式:纯文字"X / Y" + 比例
 * - 进度条模式:进度条 + 文字
 *
 * 配 Trae Work:任务卡片底部"X / Y step budget"显示
 */

export type ResourceBudgetVariant = 'inline' | 'block'

interface ResourceBudgetProps {
  /** 已使用量 */
  used: number
  /** 总预算 */
  total: number
  /** 资源名(如 "step budget" / "tokens" / "tools") */
  label: string
  /** 展示模式:inline(单行)/ block(进度条+文字) */
  variant?: ResourceBudgetVariant
  /** 当前是否活跃(活跃时显示动画) */
  active?: boolean
  className?: string
  'data-testid'?: string
}

export const ResourceBudget = React.memo(function ResourceBudget({
  used,
  total,
  label,
  variant = 'inline',
  active = false,
  className,
  'data-testid': testId,
}: ResourceBudgetProps) {
  const safeTotal = Math.max(0, total)
  const safeUsed = Math.max(0, Math.min(used, safeTotal))
  const pct = safeTotal > 0 ? Math.round((safeUsed / safeTotal) * 100) : 0
  const Icon = active ? Loader2 : Sparkles

  if (variant === 'block') {
    const fillCls =
      pct >= 90 ? 'bg-destructive/60' : pct >= 70 ? 'bg-amber-500/60' : 'bg-primary/60'
    return (
      <div
        className={cn('space-y-1', className)}
        data-testid={testId ?? 'resource-budget-block'}
        aria-label={`Current usage: ${safeUsed} / ${safeTotal} ${label}`}
      >
        <div className="flex items-center justify-between gap-1.5 text-[10px] text-muted-foreground/70">
          <span className="inline-flex items-center gap-0.5">
            <Icon
              className={cn('h-2.5 w-2.5', pct >= 70 ? 'text-amber-500' : 'text-primary', active && 'animate-spin')}
              aria-hidden
            />
            <span>
              Current usage: <span className="font-medium text-foreground/80">{safeUsed}</span>
              {' / '}
              {safeTotal} {label}
            </span>
          </span>
          <span className="shrink-0 tabular-nums">{pct}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted/40" aria-hidden>
          <div
            className={cn('h-full transition-all duration-300', fillCls)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] text-muted-foreground/60',
        className,
      )}
      data-testid={testId ?? 'resource-budget-inline'}
      aria-label={`Current usage: ${safeUsed} / ${safeTotal} ${label}`}
    >
      <Icon
        className={cn(
          'h-2.5 w-2.5',
          pct >= 70 ? 'text-amber-500' : 'text-primary',
          active && 'animate-spin',
        )}
        aria-hidden
      />
      <span className="tabular-nums">
        Current usage: {safeUsed} / {safeTotal} {label}
      </span>
    </span>
  )
})

export default ResourceBudget
