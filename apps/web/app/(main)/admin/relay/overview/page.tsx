'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Activity, Coins, AlertTriangle, Timer, ArrowUp, ArrowDown } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@ihui/ui-react'
import { Skeleton } from '@/components/ui/skeleton'
import { BackButton } from '@/components/common'
import { TruncatedText } from '@/components/common'

interface PeriodAgg {
  callCount: number
  totalTokens: number
  totalCostCents: number
  errorCount: number
  errorRate: number
  avgLatencyMs: number
  p95LatencyMs: number
}
interface RangeAgg {
  callCount: number
  totalCostCents: number
  errorRate: number
}
interface OverviewData {
  today: PeriodAgg
  yesterday: PeriodAgg
  delta: { callCountDelta: number; totalCostCentsDelta: number; errorRateDelta: number }
  last7d: RangeAgg
  last30d: RangeAgg
}
interface ModelDist {
  model: string
  callCount: number
  totalTokens: number
  totalCostCents: number
  percentage: number
}
interface TrendDay {
  date: string
  callCount: number
  totalCostCents: number
  errorRate: number
  avgLatencyMs: number
}
interface TopUser {
  userId: string
  username: string | null
  callCount: number
  totalCostCents: number
}

type Range = 'today' | '7d' | '30d'

const DONUT_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#64748b',
]

function Delta({
  value,
  positiveIsGood = true,
}: {
  value: number
  positiveIsGood?: boolean
}): React.ReactElement {
  if (!Number.isFinite(value) || value === 0)
    return <span className="text-xs text-muted-foreground">环比 —</span>
  const up = value > 0
  const good = positiveIsGood ? up : !up
  return (
    <span
      className={`flex items-center gap-0.5 text-xs ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
    >
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      环比 {(Math.abs(value) * 100).toFixed(1)}%
    </span>
  )
}

function Donut({ data }: { data: ModelDist[] }): React.ReactElement {
  const size = 168
  const stroke = 24
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {data.map((d, i) => {
          const len = d.percentage * c
          const seg = (
            <circle
              key={d.model}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          )
          offset += len
          return seg
        })}
      </g>
    </svg>
  )
}

export default function AdminRelayOverviewDashboardPage(): React.ReactElement {
  const locale = useLocale()
  const [range, setRange] = React.useState<Range>('today')
  const trendDays = range === 'today' ? 1 : range === '7d' ? 7 : 30
  const numFmt = new Intl.NumberFormat(locale)

  const overviewQ = useQuery({
    queryKey: ['admin', 'relay', 'stats', 'overview'],
    queryFn: async (): Promise<OverviewData> => {
      const r = await fetchApi<OverviewData>('/api/admin/relay/stats/overview')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    refetchInterval: 30_000,
  })
  const distQ = useQuery({
    queryKey: ['admin', 'relay', 'stats', 'model-distribution'],
    queryFn: async (): Promise<ModelDist[]> => {
      const r = await fetchApi<{ models: ModelDist[] }>('/api/admin/relay/stats/model-distribution')
      if (!r.success) throw new Error(r.error)
      return r.data.models
    },
    refetchInterval: 30_000,
  })
  const trendQ = useQuery({
    queryKey: ['admin', 'relay', 'stats', 'trend', trendDays],
    queryFn: async (): Promise<TrendDay[]> => {
      const r = await fetchApi<{ days: TrendDay[] }>(
        `/api/admin/relay/stats/trend?days=${trendDays}`,
      )
      if (!r.success) throw new Error(r.error)
      return r.data.days
    },
    refetchInterval: 30_000,
  })
  const topQ = useQuery({
    queryKey: ['admin', 'relay', 'stats', 'top-users'],
    queryFn: async (): Promise<TopUser[]> => {
      const r = await fetchApi<{ users: TopUser[] }>('/api/admin/relay/stats/top-users?limit=10')
      if (!r.success) throw new Error(r.error)
      return r.data.users
    },
    refetchInterval: 30_000,
  })

  const ov = overviewQ.data
  const isToday = range === 'today'
  const rangeAgg: RangeAgg | undefined =
    range === '7d' ? ov?.last7d : range === '30d' ? ov?.last30d : undefined
  const callCount = isToday ? ov?.today.callCount : rangeAgg?.callCount
  const totalCostCents = isToday ? ov?.today.totalCostCents : rangeAgg?.totalCostCents
  const errorRate = isToday ? ov?.today.errorRate : rangeAgg?.errorRate
  const p95LatencyMs = isToday ? ov?.today.p95LatencyMs : undefined
  const dist = distQ.data ?? []
  const trend = trendQ.data ?? []
  const topUsers = topQ.data ?? []
  const maxCall = Math.max(1, ...trend.map((d) => d.callCount))
  const totalTopCost = topUsers.reduce((s, x) => s + x.totalCostCents, 0)
  const rangeLabel = range === 'today' ? '今日' : range === '7d' ? '近 7 天' : '近 30 天'

  const kpis = [
    {
      label: `${rangeLabel}调用数`,
      value: callCount !== undefined ? numFmt.format(callCount) : undefined,
      icon: Activity,
      color: 'text-primary',
      delta: isToday && ov ? <Delta value={ov.delta.callCountDelta} /> : null,
    },
    {
      label: `${rangeLabel}消费(¥)`,
      value: totalCostCents !== undefined ? (totalCostCents / 100).toFixed(2) : undefined,
      icon: Coins,
      color: 'text-amber-600 dark:text-amber-400',
      delta: isToday && ov ? <Delta value={ov.delta.totalCostCentsDelta} /> : null,
    },
    {
      label: `${rangeLabel}错误率`,
      value: errorRate !== undefined ? `${(errorRate * 100).toFixed(2)}%` : undefined,
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-400',
      delta:
        isToday && ov ? <Delta value={ov.delta.errorRateDelta} positiveIsGood={false} /> : null,
    },
    {
      label: '今日 P95 耗时(ms)',
      value: p95LatencyMs !== undefined ? numFmt.format(p95LatencyMs) : '—',
      icon: Timer,
      color: 'text-violet-600 dark:text-violet-400',
      delta: null,
    },
  ]

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Activity className="h-6 w-6 text-primary" />
            实时监控
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            中转站调用 / 消费 / 错误率 / 模型分布(每 30s 自动刷新)
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
          {(['today', '7d', '30d'] as const).map((r) => (
            <Button
              key={r}
              type="button"
              variant={range === r ? 'default' : 'ghost'}
              size="sm"
              className="h-9 px-3 text-xs"
              onClick={() => setRange(r)}
            >
              {r === 'today' ? '今日' : r === '7d' ? '7d' : '30d'}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                <span className="min-w-0 truncate">{k.label}</span>
                <k.icon className={`h-4 w-4 shrink-0 ${k.color}`} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overviewQ.isLoading || k.value === undefined ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <div className={`text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</div>
              )}
              {k.delta && <div className="mt-1">{k.delta}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 min-[1024px]:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">今日模型分布</CardTitle>
          </CardHeader>
          <CardContent>
            {distQ.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : dist.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">暂无数据</p>
            ) : (
              <div className="flex items-center gap-4">
                <Donut data={dist} />
                <ul className="flex-1 min-w-0 space-y-1.5">
                  {dist.map((d, i) => (
                    <li key={d.model} className="flex items-center gap-2 text-xs">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0"
                        style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                      />
                      <TruncatedText value={d.model} className="flex-1" />
                      <span className="tabular-nums text-muted-foreground">
                        {(d.percentage * 100).toFixed(1)}%
                      </span>
                      <span className="w-14 text-right tabular-nums">
                        {numFmt.format(d.callCount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{rangeLabel}调用趋势</CardTitle>
          </CardHeader>
          <CardContent>
            {trendQ.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : trend.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">暂无数据</p>
            ) : (
              <div className="flex h-40 items-end gap-1">
                {trend.map((d) => (
                  <div
                    key={d.date}
                    className="flex flex-1 flex-col items-center justify-end gap-1"
                    title={`${d.date} · 调用 ${d.callCount} · 错误率 ${(d.errorRate * 100).toFixed(1)}%`}
                  >
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {d.callCount > 0 ? numFmt.format(d.callCount) : ''}
                    </span>
                    <div
                      className="flex w-full items-end justify-center"
                      style={{ height: '110px' }}
                    >
                      <div
                        className="w-full bg-primary/80"
                        style={{
                          height: `${(d.callCount / maxCall) * 100}%`,
                          minHeight: d.callCount > 0 ? '2px' : '0',
                        }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {d.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">今日高消费用户 Top 10</CardTitle>
        </CardHeader>
        <CardContent>
          {topQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : topUsers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">用户</th>
                      <th className="px-3 py-2 text-right">调用次数</th>
                      <th className="px-3 py-2 text-right">消费(¥)</th>
                      <th className="px-3 py-2 text-right">占比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topUsers.map((u, i) => (
                      <tr key={u.userId}>
                        <td className="px-3 py-2">
                          <span className="mr-2 text-xs text-muted-foreground">#{i + 1}</span>
                          <span className="text-xs">{u.username ?? u.userId.slice(0, 8)}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {numFmt.format(u.callCount)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {(u.totalCostCents / 100).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {totalTopCost > 0
                            ? `${((u.totalCostCents / totalTopCost) * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
