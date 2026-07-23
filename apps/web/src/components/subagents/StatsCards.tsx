'use client'

import * as React from 'react'
import { Activity, CheckCircle2, XCircle, Layers } from 'lucide-react'
import { Card } from '@ihui/ui'
import type { SubagentGlobalStats } from '@ihui/shared/subagents/index'

interface StatsCardsProps {
  stats: SubagentGlobalStats | undefined
  isLoading: boolean
}

interface StatItem {
  key: 'total' | 'active' | 'completed' | 'failed'
  label: string
  value: number
  icon: typeof Activity
  iconClass: string
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  const items: StatItem[] = [
    {
      key: 'total',
      label: '总派单',
      value: stats?.totalDispatches ?? 0,
      icon: Layers,
      iconClass: 'text-slate-600 dark:text-slate-400',
    },
    {
      key: 'active',
      label: '活跃中',
      value: stats?.active ?? 0,
      icon: Activity,
      iconClass: 'text-blue-600 dark:text-blue-400',
    },
    {
      key: 'completed',
      label: '已完成',
      value: stats?.completed ?? 0,
      icon: CheckCircle2,
      iconClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'failed',
      label: '失败',
      value: stats?.failed ?? 0,
      icon: XCircle,
      iconClass: 'text-rose-600 dark:text-rose-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((it) => {
        const Icon = it.icon
        return (
          <Card key={it.key} className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{it.label}</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {isLoading ? '—' : it.value}
                </p>
              </div>
              <Icon className={`h-5 w-5 ${it.iconClass}`} />
            </div>
          </Card>
        )
      })}
    </div>
  )
}
