'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Loader2,
  LayoutDashboard,
  Server,
  Cpu,
  Activity,
  Database,
  Brain,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/date-utils'

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
  diskUsage: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  API: Server,
  DB: Database,
  Redis: Cpu,
  'AI-Service': Brain,
}

export default function AdminMonitorDashboardPage() {
  const { data: services = [], isLoading: svcLoading } = useQuery({
    queryKey: ['admin', 'monitor', 'dashboard', 'services'],
    queryFn: () =>
      api<{ list: ServiceItem[] }>('/api/admin/monitor/services').then((d) => d.list ?? []),
  })
  const { data: perf } = useQuery({
    queryKey: ['admin', 'monitor', 'dashboard', 'perf'],
    queryFn: () => api<PerfItem>('/api/admin/monitor/perf'),
  })

  const healthyCount = services.filter((s) => s.status === 'healthy').length
  const perfCards = [
    { label: 'CPU', value: perf?.cpu ?? 0, unit: '%', max: 100, cls: 'text-primary' },
    { label: '内存', value: perf?.memory ?? 0, unit: '%', max: 100, cls: 'text-primary' },
    { label: '磁盘', value: perf?.diskUsage ?? 0, unit: '%', max: 100, cls: 'text-purple-600' },
    { label: 'QPS', value: perf?.qps ?? 0, unit: '', max: 0, cls: 'text-emerald-600', raw: true },
    {
      label: '平均响应',
      value: perf?.avgResponse ?? 0,
      unit: 'ms',
      max: 0,
      cls: 'text-amber-600',
      raw: true,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          系统监控总览
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">CPU / 内存 / 请求 / QPS 实时监控</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                服务状态
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {healthyCount}/{services.length} 健康
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {svcLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              </div>
            ) : services.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">暂无服务数据</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {services.map((s) => {
                  const Icon = SERVICE_ICONS[s.name] ?? Server
                  const ok = s.status === 'healthy'
                  return (
                    <div
                      key={s.name}
                      className="flex items-center justify-between rounded-md border p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn('h-4 w-4', ok ? 'text-emerald-600' : 'text-red-600')} />
                        <span className="text-sm font-medium">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-600" />
                        )}
                        <span className={cn('text-xs', ok ? 'text-emerald-600' : 'text-red-600')}>
                          {s.latency}ms
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              性能指标
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {perfCards.map((c) => (
                <div key={c.label} className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                  <div className={cn('mt-1 text-xl font-bold', c.cls)}>
                    {formatNumber(c.value)}
                    {c.unit}
                  </div>
                  {!c.raw && c.max > 0 && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          c.value > 90
                            ? 'bg-red-500'
                            : c.value > 70
                              ? 'bg-amber-500'
                              : 'bg-emerald-500',
                        )}
                        style={{ width: `${Math.min(c.value, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4" />
            实时 QPS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-end gap-1">
            {Array.from({ length: 48 }).map((_, i) => {
              const h = 20 + Math.sin(i / 3) * 30 + Math.random() * 40
              return (
                <div
                  key={`bar-${i}`}
                  className="flex-1 rounded-t bg-primary/60 transition-colors hover:bg-primary"
                  style={{ height: `${Math.max(5, Math.min(100, h))}%` }}
                  title={`${Math.round(h * (perf?.qps ? perf.qps / 100 : 1))} req/s`}
                />
              )
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>48 秒前</span>
            <span>当前</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
