'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { BarChart3, Activity, AlertTriangle, Timer, Loader2, TrendingUp } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/date-utils'

interface UsageStats {
  totalCalls: number
  todayCalls: number
  errorRate: number
  avgLatency: number
}

interface DayUsage {
  date: string
  calls: number
}

interface TopEndpoint {
  id: string
  endpoint: string
  method: string
  calls: number
  errorRate: number
}

const METHOD_COLOR: Record<string, string> = {
  GET: 'bg-primary/10 text-primary',
  POST: 'bg-emerald-500/10 text-emerald-600',
  PATCH: 'bg-amber-500/10 text-amber-600',
  DELETE: 'bg-red-500/10 text-red-600',
}

export default function ApiUsagePage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'api-usage', 'stats'],
    queryFn: async () => {
      const r = await fetchApi<UsageStats>('/api/admin/api-usage/stats')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const { data: dayUsage } = useQuery({
    queryKey: ['admin', 'api-usage', 'day'],
    queryFn: async () => {
      const r = await fetchApi<DayUsage[]>('/api/admin/api-usage/day')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const { data: top } = useQuery({
    queryKey: ['admin', 'api-usage', 'top'],
    queryFn: async () => {
      const r = await fetchApi<TopEndpoint[]>('/api/admin/api-usage/top')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const dayUsageList = dayUsage ?? []
  const topList = top ?? []

  const cards = stats
    ? [
        {
          label: t('apiUsage.totalCalls'),
          value: formatNumber(stats.totalCalls),
          icon: BarChart3,
          color: 'text-primary',
        },
        {
          label: t('apiUsage.todayCalls'),
          value: formatNumber(stats.todayCalls),
          icon: Activity,
          color: 'text-primary',
        },
        {
          label: t('apiUsage.errorRate'),
          value: `${stats.errorRate}%`,
          icon: AlertTriangle,
          color: 'text-amber-600',
        },
        {
          label: t('apiUsage.avgLatency'),
          value: `${stats.avgLatency}ms`,
          icon: Timer,
          color: 'text-purple-600',
        },
      ]
    : []

  const maxCalls = dayUsageList.length > 0 ? Math.max(...dayUsageList.map((d) => d.calls)) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BarChart3 className="h-6 w-6 text-primary" />
          {t('apiUsage.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('apiUsage.subtitle')}</p>
      </div>

      {/* 统计卡 */}
      <section>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {tc('search')}
          </div>
        ) : !stats ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('apiUsage.noData')}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {c.label}
                  </CardTitle>
                  <c.icon className={cn('h-4 w-4', c.color)} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{c.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 用量趋势 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <TrendingUp className="h-5 w-5" />
          {t('apiUsage.trend')}
        </h2>
        <Card>
          <CardContent className="pt-4">
            {dayUsageList.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('apiUsage.noData')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t('apiUsage.colDate')}</th>
                      <th className="px-3 py-2 font-medium">{t('apiUsage.colCalls')}</th>
                      <th className="px-3 py-2 font-medium">{t('apiUsage.colTrend')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayUsageList.map((d) => (
                      <tr key={d.date} className="border-t">
                        <td className="px-3 py-2 text-muted-foreground">{d.date}</td>
                        <td className="px-3 py-2 font-medium">{formatNumber(d.calls)}</td>
                        <td className="px-3 py-2">
                          <div className="h-2 w-40 overflow-hidden rounded-2xl bg-muted">
                            <div
                              className="h-full rounded-md bg-primary"
                              style={{ width: `${(d.calls / maxCalls) * 100}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Top 端点 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('apiUsage.topEndpoints')}</h2>
        {topList.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('apiUsage.noData')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">#</th>
                  <th className="px-4 py-2.5 font-medium">{t('apiUsage.colEndpoint')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('apiUsage.colMethod')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('apiUsage.colCalls')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('apiUsage.colErrorRate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topList.map((e, i) => (
                  <tr key={e.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{e.endpoint}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex rounded px-2 py-0.5 text-xs font-medium',
                          METHOD_COLOR[e.method] ?? 'bg-muted text-muted-foreground',
                        )}
                      >
                        {e.method}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium">{formatNumber(e.calls)}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'font-medium',
                          e.errorRate > 1
                            ? 'text-red-600'
                            : e.errorRate > 0.3
                              ? 'text-amber-600'
                              : 'text-emerald-600',
                        )}
                      >
                        {e.errorRate.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
