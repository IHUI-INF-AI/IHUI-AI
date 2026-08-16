'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { BarChart3, MousePointerClick, RefreshCw, Loader2, Users2 } from 'lucide-react'
import { eduApi } from '@/lib/edu'
import { StatCard } from '@/components/data'
import { BackButton } from '@/components/common'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@ihui/ui-react'

interface EventRankItem {
  event: string
  count: number
  uniqueUsers: number
}
interface HotPageItem {
  path: string
  pv: number
  uniqueUsers: number
}
interface TrendItem {
  day: string
  event: string
  count: number
}
interface AnalyticsSummary {
  summary?: { totalEvents: number; eventTypes: number; uniqueUsers: number }
  todayEvents?: number
  byEvent?: Array<{ event: string; count: number }>
}
interface EventRow {
  id: number
  event: string
  userId?: string
  properties?: Record<string, unknown>
  ip?: string
  createdAt: string
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  page_view: { label: '页面访问', color: 'text-blue-600 dark:text-blue-400' },
  page_time: { label: '页面停留', color: 'text-indigo-600 dark:text-indigo-400' },
  route_change: { label: '路由切换', color: 'text-cyan-600 dark:text-cyan-400' },
  click: { label: '点击', color: 'text-emerald-600 dark:text-emerald-400' },
  search: { label: '搜索', color: 'text-orange-600 dark:text-orange-400' },
  download: { label: '下载', color: 'text-rose-600 dark:text-rose-400' },
  form_submit: { label: '表单提交', color: 'text-violet-600 dark:text-violet-400' },
  link_out: { label: '站外跳转', color: 'text-amber-600 dark:text-amber-400' },
  login: { label: '登录', color: 'text-teal-600 dark:text-teal-400' },
}

function evLabel(name: string): string {
  return EVENT_LABELS[name]?.label ?? name
}
function evColor(name: string): string {
  return EVENT_LABELS[name]?.color ?? 'text-foreground'
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const inputCls =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function BehaviorAnalyticsPage() {
  const locale = useLocale()
  const [start, setStart] = React.useState(daysAgo(7))
  const [end, setEnd] = React.useState(daysAgo(0))
  const numFmt = new Intl.NumberFormat(locale)
  const qs = (extra = '') => `?startTime=${start}&endTime=${end}${extra}`

  const summaryQ = useQuery({
    queryKey: ['admin', 'analytics', 'summary', start, end],
    queryFn: async () => {
      const r = await eduApi<AnalyticsSummary>(`/api/admin/analytics/summary${qs()}`)
      return r ?? {}
    },
  })
  const rankQ = useQuery({
    queryKey: ['admin', 'analytics', 'rank', start, end],
    queryFn: async () => {
      const r = await eduApi<{ list: EventRankItem[] }>(`/api/admin/analytics/events/rank${qs()}`)
      return r.list ?? []
    },
  })
  const pagesQ = useQuery({
    queryKey: ['admin', 'analytics', 'hot-pages', start, end],
    queryFn: async () => {
      const r = await eduApi<{ list: HotPageItem[] }>(`/api/admin/analytics/hot-pages${qs()}`)
      return r.list ?? []
    },
  })
  const trendQ = useQuery({
    queryKey: ['admin', 'analytics', 'trend', start, end],
    queryFn: async () => {
      const r = await eduApi<{ list: TrendItem[] }>(`/api/admin/analytics/trend${qs()}`)
      return r.list ?? []
    },
  })
  const listQ = useQuery({
    queryKey: ['admin', 'analytics', 'list', start, end],
    queryFn: async () => {
      const r = await eduApi<{ list: EventRow[]; total: number }>(
        `/api/admin/analytics/events/list${qs()}&page=1&pageSize=15`,
      )
      return r ?? { list: [], total: 0 }
    },
  })

  const loading = summaryQ.isLoading || rankQ.isLoading || pagesQ.isLoading
  const summary = summaryQ.data as Partial<AnalyticsSummary> | undefined
  const rank = (rankQ.data ?? []) as EventRankItem[]
  const pages = (pagesQ.data ?? []) as HotPageItem[]
  const trend = (trendQ.data ?? []) as TrendItem[]
  // trend 数据保留供后续扩展(按天事件趋势图)
  const evList = (listQ.data as { list?: EventRow[] })?.list ?? []

  const maxRank = rank.length > 0 ? Math.max(...rank.map((r) => r.count)) : 1

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">行为埋点分析</h1>
          <p className="text-sm text-muted-foreground">
            用户行为事件统计:点击 / 搜索 / 下载 / 表单 / 停留
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={inputCls}
          />
          <span className="text-muted-foreground">至</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={inputCls}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              summaryQ.refetch()
              rankQ.refetch()
              pagesQ.refetch()
              trendQ.refetch()
              listQ.refetch()
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="事件总数"
          value={numFmt.format(summary?.summary?.totalEvents ?? 0)}
          icon={BarChart3}
        />
        <StatCard
          title="事件类型"
          value={numFmt.format(summary?.summary?.eventTypes ?? 0)}
          icon={MousePointerClick}
        />
        <StatCard
          title="今日事件"
          value={numFmt.format(summary?.todayEvents ?? 0)}
          icon={RefreshCw}
        />
        <StatCard
          title="活跃用户"
          value={numFmt.format(summary?.summary?.uniqueUsers ?? 0)}
          icon={Users2}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">事件类型排行</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rank.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    暂无数据(埋点自 08-10 起采集)
                  </p>
                )}
                {rank.slice(0, 12).map((r) => (
                  <div key={r.event} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-medium ${evColor(r.event)}`}>{evLabel(r.event)}</span>
                      <span className="text-muted-foreground">
                        {numFmt.format(r.count)} 次 / {numFmt.format(r.uniqueUsers)} 用户
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full rounded bg-primary/70"
                        style={{ width: `${(r.count / maxRank) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">页面行为热度 Top 10</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pages.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">暂无数据</p>
                )}
                {pages.slice(0, 10).map((p, i) => (
                  <div
                    key={p.path}
                    className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-xs font-semibold text-muted-foreground">{i + 1}</span>
                      <span className="truncate">{p.path}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">{numFmt.format(p.pv)} 次</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">按天事件趋势</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const byDay = new Map<string, number>()
                for (const t of trend) byDay.set(t.day, (byDay.get(t.day) ?? 0) + t.count)
                const days = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]))
                const max = Math.max(1, ...days.map(([, c]) => c))
                if (days.length === 0)
                  return (
                    <p className="py-4 text-center text-sm text-muted-foreground">暂无趋势数据</p>
                  )
                return (
                  <div className="flex items-end gap-1.5" style={{ height: 80 }}>
                    {days.map(([day, count]) => (
                      <div
                        key={day}
                        className="group relative flex flex-1 flex-col items-center justify-end gap-1"
                      >
                        <span className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                          {count}
                        </span>
                        <div
                          className="w-full rounded-t bg-primary/60 transition-colors hover:bg-primary"
                          style={{ height: `${Math.max(4, (count / max) * 100)}%` }}
                        />
                        <span className="text-[10px] text-muted-foreground">{day.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">最近事件明细</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>事件</TableHead>
                    <TableHead>标签/内容</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evList.slice(0, 10).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <span className={evColor(row.event)}>{evLabel(row.event)}</span>
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate text-muted-foreground">
                        {typeof row.properties?.label === 'string'
                          ? row.properties.label
                          : String(row.properties?.category ?? '')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.userId ? String(row.userId).slice(0, 8) : '匿名'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString('zh-CN')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {evList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                        暂无事件记录
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
