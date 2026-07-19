'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface UserStudyBarProps {
  label?: string
  current?: number
  total?: number
  unit?: string
  className?: string
}

export default function UserStudyBar({
  label = '学习进度',
  current = 0,
  total = 100,
  unit = '%',
  className,
}: UserStudyBarProps): React.JSX.Element {
  const safeTotal = total > 0 ? total : 100
  const percent = Math.min(100, Math.max(0, (current / safeTotal) * 100))
  return (
    <div className={cn('rounded-xl border bg-card p-4 shadow', className)}>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {current}
          {unit !== '%' ? ` / ${total} ${unit}` : ` ${unit}`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-sm bg-muted">
        <div
          className="h-full rounded-sm bg-primary transition-all"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
