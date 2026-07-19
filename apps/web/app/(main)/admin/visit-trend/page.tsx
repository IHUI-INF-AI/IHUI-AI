'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { TrendingUp, Users, Eye, Timer, Globe, FileText, ArrowDownUp } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { StatCard } from '@/components/data'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { TrendGranularity, VisitTrendResponse } from './types'

const FALLBACK: VisitTrendResponse = {
  granularity: 'day',
  range: { start: '', end: '' },
  totalPv: 0,
  totalUv: 0,
  avgDuration: 0,
  bounceRate: 0,
  trend: [],
  bySource: [],
  topPages: [],
}

const GRANULARITY_OPTS: { value: TrendGranularity; label: string }[] = [
  { value: 'day', label: '按日' },
  { value: 'week', label: '按周' },
  { value: 'month', label: '按月' },
]

export default function VisitTrendPage() {
  const locale = useLocale()
  const [granularity, setGranularity] = React.useState<TrendGranularity>('day')
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stats', 'visit-trend', granularity],
    queryFn: async () => {
      const r = await fetchApi<VisitTrendResponse>(
        `/api/v1/admin/stats/visit-trend?granularity=${granularity}`,
      )
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    retry: false,
  })
  const numFmt = new Intl.NumberFormat(locale)
  const stats = data ?? FALLBACK
  const peak = Math.max(1, ...stats.trend.map((p) => p.pv))
  const totalSrc = stats.bySource.reduce((s, x) => s + x.pv, 0) || 1

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <TrendingUp className="h-6 w-6 text-primary" />
            访问趋势
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">PV / UV 趋势、来源与热门页面</p>
        </div>
        <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5">
          <ArrowDownUp className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
          {GRANULARITY_OPTS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGranularity(g.value)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                granularity === g.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="总 PV" value={numFmt.format(stats.totalPv)} icon={Eye} loading={isLoading} />
        <StatCard title="总 UV" value={numFmt.format(stats.totalUv)} icon={Users} loading={isLoading} />
        <StatCard title="平均时长" value={`${stats.avgDuration}s`} icon={Timer} loading={isLoading} />
        <StatCard title="跳出率" value={`${stats.bounceRate}%`} icon={ArrowDownUp} loading={isLoading} />
      </div>

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">PV 趋势</h2>
        </div>
        {isLoading ? (
          <div className="grid grid-flow-col gap-2" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={`sk-${i}`} className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
        ) : stats.trend.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">暂无数据</div>
        ) : (
          <div className="grid grid-flow-col gap-2" style={{ gridTemplateColumns: `repeat(${stats.trend.length}, minmax(0, 1fr))` }}>
            {stats.trend.map((p) => (
              <div key={p.date} className="flex flex-col items-center gap-1.5">
                <div className="flex h-32 w-full items-end rounded-md bg-muted/30 px-1">
                  <div
                    className="w-full rounded-md bg-primary/70 transition-all"
                    style={{ height: `${(p.pv / peak) * 100}%` }}
                    title={`${p.date} PV ${p.pv} UV ${p.uv}`}
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{p.date.slice(5)}</span>
                <span className="text-xs font-semibold tabular-nums">{numFmt.format(p.pv)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Globe className="h-4 w-4 text-primary" />
            来源占比
          </h2>
          {stats.bySource.length === 0 ? (
            <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">暂无数据</div>
          ) : (
            <div className="space-y-2">
              {stats.bySource.map((s) => (
                <div key={s.source} className="space-y-1">
                  <div className="flex items-center justify-between text-sm tabular-nums">
                    <span>{s.source}</span>
                    <span className="text-muted-foreground">
                      {numFmt.format(s.pv)} PV · {numFmt.format(s.uv)} UV
                    </span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded bg-muted/40">
                    <div
                      className="h-full rounded-md bg-emerald-500/70"
                      style={{ width: `${(s.pv / totalSrc) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <FileText className="h-4 w-4 text-primary" />
            热门页面
          </h2>
          {stats.topPages.length === 0 ? (
            <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">暂无数据</div>
          ) : (
            <div className="space-y-1.5">
              {stats.topPages.slice(0, 8).map((p, i) => (
                <div
                  key={p.path}
                  className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="truncate font-mono text-xs">{p.path}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground tabular-nums">
                    <span>{numFmt.format(p.pv)} PV</span>
                    <span>{p.avgDuration}s</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
