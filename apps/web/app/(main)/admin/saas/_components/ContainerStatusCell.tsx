/**
 * P1-2.2: 容器运行状态单元格
 * - 全停 → danger
 * - 部分运行 → warning
 * - 全运行 → success
 */
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContainerStatusCellProps {
  running: number
  total: number
}

export function ContainerStatusCell({ running, total }: ContainerStatusCellProps) {
  const allDown = total === 0 || running === 0
  const allUp = total > 0 && running === total
  const colorClass = allDown
    ? 'text-rose-600 dark:text-rose-400'
    : allUp
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-amber-600 dark:text-amber-400'
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono text-sm', colorClass)}>
      {!allUp && !allDown ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      {running} / {total}
    </span>
  )
}
