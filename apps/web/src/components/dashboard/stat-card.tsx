'use client'

import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  trend?: number
  loading?: boolean
  locale?: string
}

/** 紧凑型统计卡片:图标 + 数值 + 标题 + 趋势百分比 */
export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  loading = false,
  locale = 'zh-CN',
}: StatCardProps) {
  const positive = (trend ?? 0) > 0
  const negative = (trend ?? 0) < 0
  const TrendIcon = positive ? TrendingUp : negative ? TrendingDown : Minus
  const fmt = new Intl.NumberFormat(locale)
  const display = typeof value === 'number' ? fmt.format(value) : value

  return (
    <Card className="transition-colors hover:border-primary/30">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <div className="text-2xl font-bold tracking-tight">{display}</div>
          )}
          <div className="truncate text-xs text-muted-foreground">{title}</div>
        </div>
        {trend !== undefined && !loading && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              positive && 'text-emerald-600 dark:text-emerald-500',
              negative && 'text-red-600 dark:text-red-500',
              !positive && !negative && 'text-muted-foreground',
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </CardContent>
    </Card>
  )
}
