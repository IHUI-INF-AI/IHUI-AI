'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { PlanProgressStats } from '@ihui/shared/plan/index'

interface ProgressStatsProps {
  stats: PlanProgressStats
  className?: string
  /** compact 模式只显示进度条,不显示数字明细 */
  compact?: boolean
}

export function ProgressStats({ stats, className, compact = false }: ProgressStatsProps) {
  const { total, completed, inProgress, blocked, pending, completionPercent } = stats

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-sm bg-muted">
          <div
            className="h-full rounded-sm bg-emerald-500 transition-all"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {completionPercent}%
        </span>
      </div>
      {!compact && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <StatDot color="bg-emerald-500" label="已完成" value={completed} />
          <StatDot color="bg-blue-500" label="进行中" value={inProgress} />
          <StatDot color="bg-rose-500" label="阻塞" value={blocked} />
          <StatDot color="bg-slate-400" label="待处理" value={pending} />
          <span className="text-muted-foreground">共 {total} 步</span>
        </div>
      )}
    </div>
  )
}

function StatDot({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block h-2 w-2 rounded-full', color)} aria-hidden />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </span>
  )
}

export default ProgressStats
