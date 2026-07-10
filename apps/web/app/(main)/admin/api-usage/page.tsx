'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { BarChart3, Activity, AlertTriangle, Timer, Loader2, TrendingUp } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

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

const MOCK_STATS: UsageStats = { totalCalls: 1280420, todayCalls: 32104, errorRate: 0.42, avgLatency: 86 }
const MOCK_DAY_USAGE: DayUsage[] = [
  { date: '2026-07-04', calls: 28410 },
  { date: '2026-07-05', calls: 31200 },
  { date: '2026-07-06', calls: 26450 },
  { date: '2026-07-07', calls: 33890 },
  { date: '2026-07-08', calls: 35120 },
  { date: '2026-07-09', calls: 30180 },
  { date: '2026-07-10', calls: 32104 },
]
const MOCK_TOP: TopEndpoint[] = [
  { id: '1', endpoint: '/api/chat/messages', method: 'POST', calls: 128420, errorRate: 0.4 },
  { id: '2', endpoint: '/api/agents', method: 'GET', calls: 98210, errorRate: 0.1 },
  { id: '3', endpoint: '/api/health', method: 'GET', calls: 86400, errorRate: 0.0 },
  { id: '4', endpoint: '/api/admin/users', method: 'GET', calls: 54120, errorRate: 0.0 },
  { id: '5', endpoint: '/api/orders', method: 'POST', calls: 32100, errorRate: 1.2 },
]

const METHOD_COLOR: Record<string, string> = {
  GET: 'bg-blue-500/10 text-blue-600',
  POST: 'bg-emerald-500/10 text-emerald-600',
  PATCH: 'bg-amber-500/10 text-amber-600',
  DELETE: 'bg-red-500/10 text-red-600',
}

export default function ApiUsagePage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  const { data: stats = MOCK_STATS, isLoading } = useQuery({
    queryKey: ['admin', 'api-usage', 'stats'],
    queryFn: () => Promise.resolve(MOCK_STATS),
  })
  const { data: dayUsage = MOCK_DAY_USAGE } = useQuery({
    queryKey: ['admin', 'api-usage', 'day'],
    queryFn: () => Promise.resolve(MOCK_DAY_USAGE),
  })
  const { data: top = MOCK_TOP } = useQuery({
    queryKey: ['admin', 'api-usage', 'top'],
    queryFn: () => Promise.resolve(MOCK_TOP),
  })

  const cards = [
    { label: t('apiUsage.totalCalls'), value: stats.totalCalls.toLocaleString(), icon: BarChart3, color: 'text-primary' },
    { label: t('apiUsage.todayCalls'), value: stats.todayCalls.toLocaleString(), icon: Activity, color: 'text-blue-600' },
    { label: t('apiUsage.errorRate'), value: `${stats.errorRate}%`, icon: AlertTriangle, color: 'text-amber-600' },
    { label: t('apiUsage.avgLatency'), value: `${stats.avgLatency}ms`, icon: Timer, color: 'text-purple-600' },
  ]

  const maxCalls = Math.max(...dayUsage.map((d) => d.calls))

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
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />{tc('search')}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
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
            {dayUsage.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('apiUsage.noData')}</p>
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
                    {dayUsage.map((d) => (
                      <tr key={d.date} className="border-t">
                        <td className="px-3 py-2 text-muted-foreground">{d.date}</td>
                        <td className="px-3 py-2 font-medium">{d.calls.toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${(d.calls / maxCalls) * 100}%` }} />
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
        {top.length === 0 ? (
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
                {top.map((e, i) => (
                  <tr key={e.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{e.endpoint}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-medium', METHOD_COLOR[e.method] ?? 'bg-muted text-muted-foreground')}>
                        {e.method}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium">{e.calls.toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('font-medium', e.errorRate > 1 ? 'text-red-600' : e.errorRate > 0.3 ? 'text-amber-600' : 'text-emerald-600')}>
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
