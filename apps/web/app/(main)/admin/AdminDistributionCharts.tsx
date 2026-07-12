'use client'

import { useTranslations } from 'next-intl'
import { FileText, ShoppingCart, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { DetailedStats } from './types'

interface Props {
  stats: DetailedStats
  numFmt: Intl.NumberFormat
  curFmt: Intl.NumberFormat
}

export function AdminDistributionCharts({ stats, numFmt, curFmt }: Props) {
  const t = useTranslations('dashboard.admin')
  const fileItems = stats.fileTypes.map((f) => ({
    label: t(`fileTypes.${f.key}`),
    value: f.value,
  }))
  const fileMax = Math.max(...fileItems.map((f) => f.value), 1)
  const orderItems = [
    { icon: ShoppingCart, label: t('orderCount'), value: stats.orderStats.totalCount, cls: '' },
    {
      icon: TrendingUp,
      label: t('paidCount'),
      value: stats.orderStats.paidCount,
      cls: 'text-emerald-600 dark:text-emerald-500',
    },
    {
      icon: TrendingDown,
      label: t('pendingCount'),
      value: stats.orderStats.pendingCount,
      cls: 'text-amber-600 dark:text-amber-500',
    },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            {t('fileTypesTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {fileItems.map((f) => (
            <div key={f.label}>
              <div className="mb-1 flex justify-between text-xs">
                <span>{f.label}</span>
                <span className="text-muted-foreground">{numFmt.format(f.value)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70 transition-colors hover:bg-primary"
                  style={{ width: `${(f.value / fileMax) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4 text-primary" />
            {t('orderStatsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <span className="text-3xl font-bold tracking-tight">
              {curFmt.format(stats.orderStats.totalAmount)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t('totalAmountLabel')}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4">
            {orderItems.map((o) => {
              const Icon = o.icon
              return (
                <div key={o.label}>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon className="h-3 w-3" />
                    {o.label}
                  </div>
                  <div className={cn('mt-1 text-lg font-semibold', o.cls)}>
                    {numFmt.format(o.value)}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
