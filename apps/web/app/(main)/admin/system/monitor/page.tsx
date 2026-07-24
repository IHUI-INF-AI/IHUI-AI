'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Loader2,
  MonitorCog,
  Server,
  Database,
  Cpu,
  Activity,
  HardDrive,
  Network,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/date-utils'

interface SystemMetrics {
  cpu: number
  memory: number
  disk: number
  network: { in: number; out: number }
  uptime: number
  loadAvg: [number, number, number]
  processes: number
}

interface ServiceStatus {
  name: string
  status: 'running' | 'stopped' | 'error'
  pid: number
  memory: number
  cpu: number
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const SERVICE_STYLE: Record<ServiceStatus['status'], { dot: string; text: string; label: string }> =
  {
    running: { dot: 'bg-emerald-500', text: 'text-emerald-600', label: '运行中' },
    stopped: { dot: 'bg-muted-foreground', text: 'text-muted-foreground', label: '已停止' },
    error: { dot: 'bg-red-500', text: 'text-red-600', label: '异常' },
  }

export default function AdminSystemMonitorPage() {
  const { data: metrics } = useQuery({
    queryKey: ['admin', 'system', 'monitor', 'metrics'],
    queryFn: () => api<SystemMetrics>('/api/admin/system/monitor/metrics'),
    refetchInterval: 5000,
  })
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['admin', 'system', 'monitor', 'services'],
    queryFn: () =>
      api<{ list: ServiceStatus[] }>('/api/admin/system/monitor/services').then(
        (d) => d.list ?? [],
      ),
    refetchInterval: 5000,
  })

  const cards = [
    { label: 'CPU', value: metrics?.cpu ?? 0, unit: '%', icon: Cpu, max: 100 },
    { label: '内存', value: metrics?.memory ?? 0, unit: '%', icon: Activity, max: 100 },
    { label: '磁盘', value: metrics?.disk ?? 0, unit: '%', icon: HardDrive, max: 100 },
    { label: '进程数', value: metrics?.processes ?? 0, unit: '', icon: Server, max: 0, raw: true },
  ]

  const uptime = metrics?.uptime ?? 0
  const uptimeStr = `${Math.floor(uptime / 86400)}天 ${Math.floor((uptime % 86400) / 3600)}小时`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MonitorCog className="h-6 w-6 text-primary" />
          系统监控
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">系统资源与服务运行状态</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.label}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(c.value)}
                  {c.unit}
                </div>
                {!c.raw && c.max > 0 && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-md',
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
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Network className="h-4 w-4" />
              系统信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">运行时长</div>
                <div className="mt-0.5 font-medium">{uptimeStr}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">负载（1/5/15分钟）</div>
                <div className="mt-0.5 font-medium">
                  {(metrics?.loadAvg ?? [0, 0, 0]).join(' / ')}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">网络入站</div>
                <div className="mt-0.5 font-medium">
                  {((metrics?.network.in ?? 0) / 1024).toFixed(1)} KB/s
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">网络出站</div>
                <div className="mt-0.5 font-medium">
                  {((metrics?.network.out ?? 0) / 1024).toFixed(1)} KB/s
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" />
              服务进程
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              </div>
            ) : services.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">暂无服务数据</p>
            ) : (
              <div className="space-y-2">
                {services.map((s) => {
                  const st = SERVICE_STYLE[s.status]
                  return (
                    <div
                      key={s.name}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 rounded-full', st.dot)} />
                        <span className="font-medium">{s.name}</span>
                        <span className="text-xs text-muted-foreground">PID: {s.pid}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>CPU {s.cpu}%</span>
                        <span>内存 {s.memory}%</span>
                        <span className={st.text}>{st.label}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
