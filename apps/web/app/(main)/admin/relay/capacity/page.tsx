// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 容量与趋势看板(2026-09-16 立,补强 X,对标竞品 /capacity-summary + /api-keys-trend)。
 * 数据源 /api/admin/relay/capacity/*(实测聚合,无新表)。
 * 交互:7/14/30 天切换、刷新、柱状趋势(div 高度映射,无图表库依赖)。
 */
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, RefreshCw } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { BackButton } from '@/components/common'
import { cn } from '@/lib/utils'

interface CapacitySummary {
  keys: {
    total: number
    active: number
    revoked: number
    infiniteBalance: number
    lowBalance: number
  }
  pool: {
    totalTokenBalance: number
    avgLatency7d: number
    errorRate7d: number
    calls7d: number
  }
  generatedAt: string
}

interface TrendPoint {
  date: string
  calls?: number
  failed?: number
  created?: number
  active?: number
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-medium tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** 柱状趋势(div 高度映射,最大值归一;空数据显示占位线)。 */
function BarChart({ points, valueKey }: { points: TrendPoint[]; valueKey: 'calls' | 'created' }) {
  const max = Math.max(1, ...points.map((p) => Number(p[valueKey] ?? 0)))
  return (
    <div className="flex h-28 items-end gap-1">
      {points.length === 0 ? (
        <p className="w-full text-center text-xs text-muted-foreground">暂无数据</p>
      ) : (
        points.map((p) => (
          <div
            key={p.date}
            className="flex-1 rounded-sm bg-primary/70"
            style={{ height: `${(Number(p[valueKey] ?? 0) / max) * 100}%` }}
            title={`${p.date}: ${p[valueKey] ?? 0}`}
          />
        ))
      )}
    </div>
  )
}

export default function CapacityPage() {
  const [days, setDays] = React.useState(30)

  const summaryQ = useQuery({
    queryKey: ['admin', 'relay', 'capacity', 'summary'],
    queryFn: async () => {
      const r = await fetchApi<CapacitySummary>('/api/admin/relay/capacity/summary')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const keyTrendQ = useQuery({
    queryKey: ['admin', 'relay', 'capacity', 'key-trend', days],
    queryFn: async () => {
      const r = await fetchApi<{ points: TrendPoint[] }>(
        `/api/admin/relay/capacity/key-trend?days=${days}`,
      )
      if (!r.success) throw new Error(r.error)
      return r.data.points
    },
  })
  const callTrendQ = useQuery({
    queryKey: ['admin', 'relay', 'capacity', 'call-trend', days],
    queryFn: async () => {
      const r = await fetchApi<{ points: TrendPoint[] }>(
        `/api/admin/relay/capacity/call-trend?days=${days}`,
      )
      if (!r.success) throw new Error(r.error)
      return r.data.points
    },
  })

  const s = summaryQ.data
  const busy = summaryQ.isFetching
  const err = summaryQ.error ?? keyTrendQ.error ?? callTrendQ.error

  return (
    <div className="px-4 py-4 space-y-4">
      <BackButton />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">容量与趋势</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Key 池容量汇总与增长/调用趋势,实测聚合,辅助容量规划。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v) || 30)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">近 7 天</SelectItem>
              <SelectItem value="14">近 14 天</SelectItem>
              <SelectItem value="30">近 30 天</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void summaryQ.refetch()
              void keyTrendQ.refetch()
              void callTrendQ.refetch()
            }}
            disabled={busy}
          >
            <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} aria-hidden />
            <span>刷新</span>
          </Button>
        </div>
      </div>

      {err && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {(err as Error).message}
        </p>
      )}

      {summaryQ.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          加载中...
        </div>
      ) : s ? (
        <>
          <div className="grid grid-cols-2 gap-3 min-[1024px]:grid-cols-5">
            <StatCard label="Key 总数" value={String(s.keys.total)} />
            <StatCard label="活跃" value={String(s.keys.active)} />
            <StatCard label="无限额度" value={String(s.keys.infiniteBalance)} />
            <StatCard label="低余额告警" value={String(s.keys.lowBalance)} hint="成本余额 < ¥10" />
            <StatCard
              label="池内 token 余额"
              value={formatTokens(s.pool.totalTokenBalance)}
              hint="active Key 求和"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-3">
            <StatCard label="7 天调用" value={String(s.pool.calls7d)} />
            <StatCard label="7 天平均延迟" value={`${s.pool.avgLatency7d}ms`} />
            <StatCard label="7 天错误率" value={`${(s.pool.errorRate7d * 100).toFixed(2)}%`} />
          </div>

          <div className="grid grid-cols-1 gap-3 min-[1024px]:grid-cols-2">
            <Card>
              <CardContent className="min-[640px]:p-3 space-y-2 p-3">
                <p className="text-sm font-medium">Key 增长(新建/日)</p>
                <BarChart points={keyTrendQ.data ?? []} valueKey="created" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="min-[640px]:p-3 space-y-2 p-3">
                <p className="text-sm font-medium">调用趋势(次/日)</p>
                <BarChart points={callTrendQ.data ?? []} valueKey="calls" />
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
