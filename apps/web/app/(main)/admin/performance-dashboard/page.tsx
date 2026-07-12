'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Gauge, Cpu, MemoryStick, Activity, Timer, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Stats {
  cpu: number
  memory: number
  qps: number
  avgResponse: number
}

interface EndpointPerf {
  id: string
  endpoint: string
  method: string
  avgLatency: number
  calls: number
  errorRate: number
}

const METHOD_COLOR: Record<string, string> = {
  GET: 'bg-primary/10 text-primary',
  POST: 'bg-emerald-500/10 text-emerald-600',
  PATCH: 'bg-amber-500/10 text-amber-600',
  DELETE: 'bg-red-500/10 text-red-600',
}

export default function PerformanceDashboardPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'performance-dashboard', 'stats'],
    queryFn: async () => {
      const r = await fetchApi<Stats>('/api/admin/performance-dashboard/stats')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const { data: endpoints } = useQuery({
    queryKey: ['admin', 'performance-dashboard', 'endpoints'],
    queryFn: async () => {
      const r = await fetchApi<EndpointPerf[]>('/api/admin/performance-dashboard/endpoints')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const endpointsList = endpoints ?? []
  const cards = stats
    ? [
        {
          label: t('performance.cpu'),
          value: `${stats.cpu}%`,
          icon: Cpu,
          color: 'text-primary',
          progress: stats.cpu,
        },
        {
          label: t('performance.memory'),
          value: `${stats.memory}%`,
          icon: MemoryStick,
          color: 'text-primary',
          progress: stats.memory,
        },
        {
          label: t('performance.qps'),
          value: stats.qps,
          icon: Activity,
          color: 'text-emerald-600',
          progress: Math.min(100, (stats.qps / 2000) * 100),
        },
        {
          label: t('performance.avgResponse'),
          value: `${stats.avgResponse}ms`,
          icon: Timer,
          color: 'text-purple-600',
          progress: Math.min(100, (stats.avgResponse / 500) * 100),
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Gauge className="h-6 w-6 text-primary" />
          {t('performance.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('performance.subtitle')}</p>
      </div>

      {/* 统计卡片 */}
      <section>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {tc('search')}
          </div>
        ) : !stats ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('performance.noData')}
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
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 接口性能列表 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('performance.endpointPerf')}</h2>
        {endpointsList.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('performance.noData')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t('performance.colEndpoint')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('performance.colMethod')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('performance.colAvgLatency')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('performance.colCalls')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('performance.colErrorRate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {endpointsList.map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-muted/30">
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
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'font-medium',
                          e.avgLatency > 500
                            ? 'text-red-600'
                            : e.avgLatency > 200
                              ? 'text-amber-600'
                              : 'text-emerald-600',
                        )}
                      >
                        {e.avgLatency}ms
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{e.calls.toLocaleString()}</td>
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
