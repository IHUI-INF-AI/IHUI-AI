'use client'

import * as React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UsageTopItem {
  label: string
  value: number | string
  unit?: string
  delta?: number
  icon?: React.ReactNode
}

export interface UsageTopStatsProps {
  items?: UsageTopItem[]
  className?: string
}

const DEFAULT_ITEMS: UsageTopItem[] = [
  { label: '今日调用', value: 0, unit: '次' },
  { label: '本月消费', value: 0, unit: '元' },
  { label: '成功率', value: '0%', delta: 0 },
  { label: '平均延迟', value: 0, unit: 'ms' },
]

export default function UsageTopStats({
  items = DEFAULT_ITEMS,
  className,
}: UsageTopStatsProps): React.JSX.Element {
  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      {items.map((it, i) => {
        const up = (it.delta ?? 0) >= 0
        return (
          <div key={i} className="rounded-xl border bg-card p-4 text-card-foreground shadow">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {it.icon}
              <span>{it.label}</span>
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {it.value}
              {it.unit && <span className="ml-1 text-sm text-muted-foreground">{it.unit}</span>}
            </div>
            {it.delta !== undefined && (
              <div
                className={cn(
                  'mt-1 flex items-center gap-0.5 text-xs',
                  up ? 'text-emerald-500' : 'text-destructive',
                )}
              >
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>
                  {up ? '+' : ''}
                  {it.delta}%
                </span>
                <span className="text-muted-foreground">较昨日</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
