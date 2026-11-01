// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

import { apiOrThrow } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/date-utils'
import { BackButton } from '@/components/common'

/**
 * 系统监控概览(admin 监控子页)。
 *
 * 读数纪律(2026-10-31,admin 监控崩溃族 ⑤):
 *   - 服务灯认 `running`(后端对 api/web/ai-service 自报 running、只认 healthy ⇒ 三盏灯恒红、
 *     头部恒 2/5);`unhealthy`/`stopped` 才是异常。
 *   - **取不到就写「未判定」**:后端对未测量的项回 null(延迟、QPS、平均响应、磁盘占用),
 *     页面不得拿 0 冒充读数,也不得用 Math.random() 画一条假曲线。
 */
interface ServiceItem {
  name: string
  status: 'healthy' | 'running' | 'unhealthy' | 'stopped'
  /** 毫秒;null = 后端未做延迟测量(不是 0ms)。 */
  latency: number | null
}

interface PerfItem {
  /** CPU / 内存:真实测量值(os.cpus / os.totalmem)。 */
  cpu: number
  memory: number
  /** QPS / 平均响应 / 磁盘占用:后端无数据源 ⇒ null(未判定),不是 0。 */
  qps: number | null
  avgResponse: number | null
  diskUsage: number | null
}

/** 服务是否正常:healthy(实测通过)与 running(进程存活)都算正常。 */
function isServiceOk(status: ServiceItem['status']): boolean {
  return status === 'healthy' || status === 'running'
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
      apiOrThrow<{ list: ServiceItem[] }>('/api/admin/monitor/services').then((d) => d.list ?? []),
  })
  const { data: perf } = useQuery({
    queryKey: ['admin', 'monitor', 'dashboard', 'perf'],
    queryFn: () => apiOrThrow<PerfItem>('/api/admin/monitor/perf'),
  })

  const okCount = services.filter((s) => isServiceOk(s.status)).length
  const perfCards = [
    { label: 'CPU', value: perf?.cpu ?? null, unit: '%', max: 100, cls: 'text-primary' },
    { label: '内存', value: perf?.memory ?? null, unit: '%', max: 100, cls: 'text-primary' },
    { label: '磁盘', value: perf?.diskUsage ?? null, unit: '%', max: 100, cls: 'text-primary' },
    {
      label: 'QPS',
      value: perf?.qps ?? null,
      unit: '',
      max: 0,
      cls: 'text-success-text',
      raw: true,
    },
    {
      label: '平均响应',
      value: perf?.avgResponse ?? null,
      unit: 'ms',
      max: 0,
      cls: 'text-warning-text',
      raw: true,
    },
  ]

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          系统监控概览
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CPU / 内存 / 请求 监控(无数据源的项标未判定)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex min-w-0 items-center gap-2">
                <Server className="h-4 w-4 shrink-0" />
                <span className="truncate">服务状态</span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-xs font-normal text-muted-foreground tabular-nums">
                {okCount}/{services.length} 正常
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
              <div className="grid grid-cols-1 gap-2 min-[768px]:grid-cols-2">
                {services.map((s) => {
                  const Icon = SERVICE_ICONS[s.name] ?? Server
                  const ok = isServiceOk(s.status)
                  return (
                    <div
                      key={s.name}
                      className="flex items-center justify-between rounded-md border p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          className={cn('h-4 w-4', ok ? 'text-success-text' : 'text-danger-text')}
                        />
                        <span className="text-sm font-medium">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success-text" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-danger-text" />
                        )}
                        <span
                          className={cn('text-xs', ok ? 'text-success-text' : 'text-danger-text')}
                        >
                          {s.latency === null ? '未判定' : `${s.latency}ms`}
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
                    {c.value === null ? (
                      <span className="text-base font-medium text-muted-foreground">未判定</span>
                    ) : (
                      <>
                        {formatNumber(c.value)}
                        {c.unit}
                      </>
                    )}
                  </div>
                  {!c.raw && c.max > 0 && c.value !== null && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-xs bg-muted">
                      <div
                        className={cn(
                          'h-full rounded-md',
                          c.value > 90 ? 'bg-danger' : c.value > 70 ? 'bg-warning' : 'bg-success',
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
          {/* 旧实现是 Math.random() 画的 48 根假柱子(读数恒随机、与后端无关)。
              后端至今没有 QPS 时序数据源 ⇒ 这里显式「未判定」,不画假曲线。 */}
          <div className="py-6 text-center">
            <div className="text-2xl font-bold text-muted-foreground">未判定</div>
            <p className="mt-1 text-xs text-muted-foreground">
              后端暂无 QPS 时序数据源,此处不冒充读数(旧实现为随机生成的假曲线)。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
