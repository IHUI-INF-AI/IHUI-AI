import * as React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  icon?: React.ComponentType<{ className?: string }>
  trend?: number
  trendLabel?: string
  loading?: boolean
  className?: string
}

export function StatCard({ title, value, icon: Icon, trend, trendLabel, loading = false, className }: StatCardProps) {
  const positive = (trend ?? 0) >= 0
  return (
    <div className={cn('rounded-xl border bg-card p-4 text-card-foreground shadow', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{title}</span>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">
        {loading ? <span className="inline-block h-7 w-20 animate-pulse rounded bg-muted" /> : value}
      </div>
      {trend !== undefined && !loading && (
        <div className="mt-1 flex items-center gap-1 text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              positive ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500',
            )}
          >
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
          {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
        </div>
      )}
    </div>
  )
}
