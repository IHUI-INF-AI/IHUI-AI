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
  Globe,
  CheckCircle2,
  XCircle,
  CircleDot,
} from 'lucide-react'

import { apiOrThrow } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/date-utils'
import { BackButton } from '@/components/common'

interface ServiceItem {
  name: string
  /**
   * 后端 apps/api/src/routes/admin-monitoring-routes.ts 的 checkServiceHealth 实际只有三态:
   * · 'healthy' / 'unhealthy' = postgres(SELECT 1)/ redis(ping) **经探测验证**;
   * · 'running' = api / web / ai-service **进程自报**,未经探测,latency 恒为 0。
   * 后端声明为 string(非封闭联合),前端同样按字符串读、经下方谓词判定,
   * 不得再把 'running' 当 'healthy' 渲染成绿勾(那是撒谎),也不得判成红叉。
   */
  status: string
  latency: number
}

/** 「在跑」= 已探测健康 或 自报运行中;与「已探测健康」严格区分(头部读数用) */
function isServiceUp(s: Pick<ServiceItem, 'status'>): boolean {
  return s.status === 'healthy' || s.status === 'running'
}

/** 「经探测验证的状态」(postgres/redis);其余形态一律视为自报或未知 */
function isProbedStatus(status: string): boolean {
  return status === 'healthy' || status === 'unhealthy'
}

interface PerfItem {
  cpu: number
  memory: number
  qps: number
  avgResponse: number
  diskUsage: number
}

interface PerfCard {
  label: string
  value: number | undefined
  unit: string
  /** 后端是否有真实探测;diskUsage/qps/avgResponse 被 getPerf() 硬编码为 0(注释自认未接入)⇒ 未判定 */
  measured: boolean
  /** 百分比上限(仅 measured 时有意义) */
  max?: number
  cls: string
}

// 键必须是后端 checkServiceHealth 推的真 name(旧表键 API/DB/Redis/AI-Service 五枚全不命中,
// 每行都退成兜底 Server 图标)。
const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  api: Server,
  web: Globe,
  'ai-service': Brain,
  postgres: Database,
  redis: Cpu,
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

  const upCount = services.filter(isServiceUp).length
  const perfCards: PerfCard[] = [
    { label: 'CPU', value: perf?.cpu, unit: '%', max: 100, cls: 'text-primary', measured: true },
    {
      label: '内存',
      value: perf?.memory,
      unit: '%',
      max: 100,
      cls: 'text-primary',
      measured: true,
    },
    // 后端 getPerf() 把这三项硬编码为 0(源码注释自认"无跨平台磁盘检测库,保持 0"):
    // 渲染成 0 = 把没有探测的量冒充成"测到了 0",显式标「未判定」。
    {
      label: '磁盘',
      value: perf?.diskUsage,
      unit: '%',
      max: 100,
      cls: 'text-primary',
      measured: false,
    },
    { label: 'QPS', value: perf?.qps, unit: '', cls: 'text-success-text', measured: false },
    {
      label: '平均响应',
      value: perf?.avgResponse,
      unit: 'ms',
      cls: 'text-warning-text',
      measured: false,
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
          CPU / 内存实时探测 · QPS / 平均响应 / 磁盘未判定(探测未接入)
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
                {upCount}/{services.length} 在跑
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
                  const up = isServiceUp(s)
                  const probed = isProbedStatus(s.status)
                  // 三形视觉分家:healthy=绿勾 / unhealthy(及未知)=红叉 / running(自报未探测)=蓝调圆点
                  const tone =
                    s.status === 'healthy'
                      ? 'text-success-text'
                      : up
                        ? 'text-info-text'
                        : 'text-danger-text'
                  const StateIcon =
                    s.status === 'healthy' ? CheckCircle2 : up && !probed ? CircleDot : XCircle
                  return (
                    <div
                      key={s.name}
                      data-service={s.name}
                      className="flex items-center justify-between rounded-md border p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn('h-4 w-4', tone)} />
                        <span className="text-sm font-medium">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {up && !probed ? (
                          <Tooltip content="进程自报运行中:未经探测验证(latency 恒为 0)">
                            <span
                              className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium')}
                            >
                              自报
                            </span>
                          </Tooltip>
                        ) : null}
                        <StateIcon className={cn('h-3.5 w-3.5', tone)} />
                        <span className={cn('text-xs tabular-nums', tone)}>
                          {s.latency > 0 ? `${s.latency}ms` : '—'}
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
              {perfCards.map((c) => {
                const numValue = c.measured ? c.value : undefined
                const hasValue = typeof numValue === 'number'
                return (
                  <div key={c.label} className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">{c.label}</div>
                    <div className={cn('mt-1 text-xl font-bold tabular-nums', c.cls)}>
                      {hasValue ? `${formatNumber(numValue)}${c.unit}` : '—'}
                    </div>
                    {!c.measured ? (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        未判定(探测未接入)
                      </div>
                    ) : null}
                    {hasValue && c.max ? (
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-xs bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-md',
                            numValue > 90
                              ? 'bg-danger'
                              : numValue > 70
                                ? 'bg-warning'
                                : 'bg-success',
                          )}
                          style={{ width: `${Math.min(numValue, 100)}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            实时 QPS
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 旧实现柱高来自 Math.random(),而后端 getPerf() 的 qps 恒为硬编码 0 ——
              随机曲线 + 恒定 0 都是"把不存在的量渲染成存在的量"(参照 a2ecdb806a3
              消除 mock 数据冒充的定档),整卡显式标未判定,不画假曲线。 */}
          <div
            data-qps-unjudged
            className="flex h-32 items-center justify-center rounded-md border border-dashed px-4 text-center text-sm text-muted-foreground"
          >
            未判定:QPS 时序数据源未接入(后端 qps 为占位 0,非实测值)
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
