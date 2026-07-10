'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Activity, Server, Database, Cpu, Brain, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface ServiceStatus {
  name: string
  status: 'healthy' | 'unhealthy'
  latency: number
  message?: string
}

interface HealthEvent {
  id: string
  service: string
  level: 'info' | 'warning' | 'error'
  message: string
  time: string
}

const MOCK_SERVICES: ServiceStatus[] = [
  { name: 'API', status: 'healthy', latency: 32 },
  { name: 'DB', status: 'healthy', latency: 8 },
  { name: 'Redis', status: 'healthy', latency: 2 },
  { name: 'AI-Service', status: 'unhealthy', latency: 1200, message: '连接超时' },
]

const MOCK_EVENTS: HealthEvent[] = [
  { id: '1', service: 'AI-Service', level: 'error', message: '上游响应超时 (1200ms)', time: '2026-07-10 09:12:30' },
  { id: '2', service: 'API', level: 'info', message: '健康检查通过', time: '2026-07-10 09:10:00' },
  { id: '3', service: 'DB', level: 'info', message: '连接池正常 (24/100)', time: '2026-07-10 09:05:12' },
  { id: '4', service: 'Redis', level: 'warning', message: '内存使用率 78%', time: '2026-07-10 08:58:44' },
  { id: '5', service: 'API', level: 'info', message: '健康检查通过', time: '2026-07-10 08:40:00' },
]

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  API: Server,
  DB: Database,
  Redis: Cpu,
  'AI-Service': Brain,
}

export default function BackendHealthPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  const { data: services = MOCK_SERVICES, isLoading } = useQuery({
    queryKey: ['admin', 'backend-health'],
    queryFn: async () => {
      try {
        return await api<ServiceStatus[]>('/api/health')
      } catch {
        return MOCK_SERVICES
      }
    },
  })
  const { data: events = MOCK_EVENTS } = useQuery({
    queryKey: ['admin', 'backend-health', 'events'],
    queryFn: async () => {
      const r = await fetchApi<HealthEvent[]>('/api/admin/backend-health/events')
      if (r.success && r.data) return r.data
      return MOCK_EVENTS
    },
  })

  const healthyCount = services.filter((s) => s.status === 'healthy').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Activity className="h-6 w-6 text-primary" />
          {t('backendHealth.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('backendHealth.subtitle')}</p>
      </div>

      {/* 服务状态卡片 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('backendHealth.services')}</h2>
          <span className="text-sm text-muted-foreground">
            {t('backendHealth.healthyCount', { healthy: healthyCount, total: services.length })}
          </span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {tc('search')}
          </div>
        ) : services.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('backendHealth.noData')}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => {
              const Icon = ICONS[s.name] ?? Server
              const ok = s.status === 'healthy'
              return (
                <Card key={s.name}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{s.name}</CardTitle>
                    <Icon className={cn('h-4 w-4', ok ? 'text-emerald-600' : 'text-red-600')} />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {ok ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className={cn('text-lg font-bold', ok ? 'text-emerald-600' : 'text-red-600')}>
                        {ok ? t('backendHealth.healthy') : t('backendHealth.unhealthy')}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {s.latency}ms
                    </div>
                    {s.message && <div className="mt-1 text-xs text-red-600">{s.message}</div>}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* 响应时间 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('backendHealth.responseTime')}</h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('backendHealth.responseTimeDesc')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {services.map((s) => (
                <div key={s.name} className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">{s.name}</div>
                  <div className="mt-1 text-xl font-bold">{s.latency}ms</div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        s.latency < 100 ? 'bg-emerald-500' : s.latency < 500 ? 'bg-amber-500' : 'bg-red-500',
                      )}
                      style={{ width: `${Math.min(100, (s.latency / 1500) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 最近事件 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('backendHealth.recentEvents')}</h2>
        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
            {t('backendHealth.noData')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t('backendHealth.colService')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('backendHealth.colLevel')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('backendHealth.colMessage')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('backendHealth.colTime')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {events.map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{e.service}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          e.level === 'error'
                            ? 'bg-red-500/10 text-red-600'
                            : e.level === 'warning'
                              ? 'bg-amber-500/10 text-amber-600'
                              : 'bg-emerald-500/10 text-emerald-600',
                        )}
                      >
                        {e.level}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.message}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.time}</td>
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
