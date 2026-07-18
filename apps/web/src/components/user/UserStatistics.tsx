'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface UserStatItem {
  label: string
  value: number | string
  unit?: string
  icon?: React.ReactNode
}

export interface UserStatisticsProps {
  items: UserStatItem[]
  className?: string
}

export default function UserStatistics({
  items,
  className,
}: UserStatisticsProps): React.JSX.Element {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border bg-card p-4 text-card-foreground shadow">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {it.icon}
            <span>{it.label}</span>
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {it.value}
            {it.unit && <span className="ml-0.5 text-sm text-muted-foreground">{it.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
