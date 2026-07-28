'use client'

import * as React from 'react'
import { Coins } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * ResourceBudget — 资源预算指示器(2026-07-28 立,深度对标 Trae Work)
 *
 * 设计目标:
 * - 显示 step budget 使用情况 "Current usage: X / 60 step budget"
 * - 支持文字模式和文字+进度条模式
 * - 进度条颜色根据使用比例(绿/黄/红)
 * - 完成后折叠为单行文字
 *
 * 用途:
 * - 在 SubAgentActivityFeed 完成后展示资源消耗
 * - 在主对话流中可作为 inline 提示
 */

interface ResourceBudgetProps {
  used: number
  total: number
  /** 文字模式 | 进度条模式 */
  mode?: 'text' | 'bar'
  label?: string
  className?: string
  testId?: string
}

export const ResourceBudget = React.memo(function ResourceBudget({
  used,
  total,
  mode = 'text',
  label,
  className,
  testId,
}: ResourceBudgetProps) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const colorCls =
    pct >= 90
      ? 'text-red-500 bg-red-500/20'
      : pct >= 70
        ? 'text-amber-500 bg-amber-500/20'
        : 'text-emerald-500 bg-emerald-500/20'

  if (mode === 'bar') {
    return (
      <div
        className={cn('flex items-center gap-1.5', className)}
        data-testid={testId ?? 'resource-budget-bar'}
      >
        <Coins className="h-3 w-3 shrink-0 text-amber-500" aria-hidden />
        <span className="shrink-0 text-[10px] text-muted-foreground/80">
          {label ?? 'Current usage'}
        </span>
        <span className="shrink-0 text-[10px] tabular-nums font-medium text-foreground/90">
          {used} / {total}
        </span>
        <div className="relative h-1 flex-1 overflow-hidden rounded-sm bg-muted/60" aria-hidden>
          <div
            className={cn('h-full transition-all duration-300', colorCls)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">{pct}%</span>
      </div>
    )
  }

  return (
    <div
      className={cn('flex items-center gap-1 text-[10px] text-muted-foreground/70', className)}
      data-testid={testId ?? 'resource-budget-text'}
    >
      <Coins className="h-2.5 w-2.5 shrink-0 text-amber-500" aria-hidden />
      <span>
        Current usage: <span className="tabular-nums font-medium text-foreground/90">{used}</span> /{' '}
        {total} step budget
      </span>
    </div>
  )
})
