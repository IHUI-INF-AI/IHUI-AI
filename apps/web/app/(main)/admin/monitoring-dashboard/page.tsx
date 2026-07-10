'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Server, Database, Cpu, Brain, Activity, AlertTriangle, CheckCircle2, XCircle, Loader2, ScrollText } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface ServiceItem {
  name: string
  status: 'healthy' | 'unhealthy'
  latency: number
}

interface PerfItem {
  cpu: number
  memory: number
  qps: number
  avgResponse: number
}

interface AlertItem {
  id: string
  level: 'critical' | 'warning' | 'info'
  message: string
  time: string
}

interface LogSummary {
  total: number
  errors: number
  warnings: number
  recent: { id: string; level: string; message: string; time: string }[]
}

const MOCK_SERVICES: ServiceItem[] = [
  { name: 'API', status: 'healthy', latency: 32 },
  { name: 'DB', status: 'healthy', latency: 8 },
  { name: 'Redis', status: 'healthy', latency: 2 },
  { name: 'AI-Service', status: 'unhealthy', latency: 1200 },
]
const MOCK_PERF: PerfItem = { cpu: 42, memory: 68, qps: 1280, avgResponse: 86 }
const MOCK_ALERTS: AlertItem[] = [
  { id: '1', level: 'critical', message: 'AI-Service 响应超时 (1200ms)', time: '2026-07-10 09:12' },
  { id: '2', level: 'warning', message: 'Redis 内存使用率 78%', time: '2026-07-10 08:58' },
  { id: '3', level: 'warning', message: 'DB 连接数接近上限 (80/100)', time: '2026-07-10 08:30' },
  { id: '4', level: 'info', message: '每日健康检查完成', time: '2026-07-10 08:00' },
]
const MOCK_LOGS: LogSummary = {
  total: 128420,
  errors: 18,
  warnings: 42,
  recent: [
    { id: '1', level: 'error', message: 'AI service timeout', time: '09:12:30' },
    { id: '2', level: 'info', message: 'Health check passed', time: '09:10:00' },
    { id: '3', level: 'warn', message: 'High memory usage', time: '08:58:44' },
    { id: '4', level: 'info', message: 'Order created #20260710001', time: '08:40:12' },
  ],
}

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  API: Server,
  DB: Database,
  Redis: Cpu,
  'AI-Service': Brain,
}
const ALERT_STYLE: Record<AlertItem['level'], { bg: string; text: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-600' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-600' },
  info: { bg: 'bg-blue-500/10', text: 'text-blue-600' },
}

export default function MonitoringDashboardPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  const { data: services = MOCK_SERVICES, isLoading } = useQuery({
    queryKey: ['admin', 'monitoring', 'services'],
    queryFn: () => Promise.resolve(MOCK_SERVICES),
  })
  const { data: perf = MOCK_PERF } = useQuery({
    queryKey: ['admin', 'monitoring', 'perf'],
    queryFn: () => Promise.resolve(MOCK_PERF),
  })
  const { data: alerts = MOCK_ALERTS } = useQuery({
    queryKey: ['admin', 'monitoring', 'alerts'],
    queryFn: () => Promise.resolve(MOCK_ALERTS),
  })
  const { data: logs = MOCK_LOGS } = useQuery({
    queryKey: ['admin', 'monitoring', 'logs'],
    queryFn: () => Promise.resolve(MOCK_LOGS),
  })

  const healthyCount = services.filter((s) => s.status === 'healthy').length
  const perfCards = [
    { label: t('monitor.cpu'), value: `${perf.cpu}%`, color: 'text-primary' },
    { label: t('monitor.memory'), value: `${perf.memory}%`, color: 'text-blue-600' },
    { label: t('monitor.qps'), value: perf.qps, color: 'text-emerald-600' },
    { label: t('monitor.avgResponse'), value: `${perf.avgResponse}ms`, color: 'text-purple-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          {t('monitor.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('monitor.subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />{tc('search')}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 服务状态 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2"><Server className="h-4 w-4" />{t('monitor.services')}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {t('monitor.healthyCount', { healthy: healthyCount, total: services.length })}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {services.map((s) => {
                  const Icon = SERVICE_ICONS[s.name] ?? Server
                  const ok = s.status === 'healthy'
                  return (
                    <div key={s.name} className="flex items-center justify-between rounded-md border p-2.5">
                      <div className="flex items-center gap-2">
                        <Icon className={cn('h-4 w-4', ok ? 'text-emerald-600' : 'text-red-600')} />
                        <span className="text-sm font-medium">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-red-600" />}
                        <span className={cn('text-xs', ok ? 'text-emerald-600' : 'text-red-600')}>{s.latency}ms</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* 性能指标 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                {t('monitor.perf')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {perfCards.map((c) => (
                  <div key={c.label} className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">{c.label}</div>
                    <div className={cn('mt-1 text-xl font-bold', c.color)}>{c.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 告警 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4" />
                {t('monitor.alerts')}
                {alerts.filter((a) => a.level === 'critical').length > 0 && (
                  <span className="inline-flex rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-600">
                    {alerts.filter((a) => a.level === 'critical').length} critical
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t('monitor.noAlerts')}</p>
              ) : (
                <div className="space-y-2">
                  {alerts.map((a) => {
                    const st = ALERT_STYLE[a.level]
                    return (
                      <div key={a.id} className={cn('flex items-start gap-2 rounded-md px-3 py-2 text-sm', st.bg, st.text)}>
                        {a.level === 'critical' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : a.level === 'warning' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                        <span className="flex-1">{a.message}</span>
                        <span className="shrink-0 text-xs opacity-70">{a.time}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 日志摘要 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ScrollText className="h-4 w-4" />
                {t('monitor.logSummary')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 grid grid-cols-3 gap-2">
                <div className="rounded-md border p-2 text-center">
                  <div className="text-xs text-muted-foreground">{t('monitor.logTotal')}</div>
                  <div className="mt-0.5 text-lg font-bold">{logs.total.toLocaleString()}</div>
                </div>
                <div className="rounded-md border p-2 text-center">
                  <div className="text-xs text-muted-foreground">{t('monitor.logErrors')}</div>
                  <div className="mt-0.5 text-lg font-bold text-red-600">{logs.errors}</div>
                </div>
                <div className="rounded-md border p-2 text-center">
                  <div className="text-xs text-muted-foreground">{t('monitor.logWarnings')}</div>
                  <div className="mt-0.5 text-lg font-bold text-amber-600">{logs.warnings}</div>
                </div>
              </div>
              <div className="space-y-1">
                {logs.recent.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/30">
                    <span
                      className={cn(
                        'inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                        l.level === 'error' ? 'bg-red-500/10 text-red-600' : l.level === 'warn' ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600',
                      )}
                    >
                      {l.level}
                    </span>
                    <span className="flex-1 truncate text-muted-foreground">{l.message}</span>
                    <span className="shrink-0 font-mono text-muted-foreground">{l.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
