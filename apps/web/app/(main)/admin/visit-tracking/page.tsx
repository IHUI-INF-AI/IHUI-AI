'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, Users, RefreshCw, MapPin, Loader2, Search } from 'lucide-react'
import { eduApi, buildQs } from '@/lib/edu'
import { StatCard } from '@/components/data'
import { BarChart } from '@/components/charts'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@ihui/ui'
import { TruncatedText } from '@/components/common'

interface VisitStats {
  pv?: number
  uv?: number
  ipCount?: number
  memberCount?: number
  [k: string]: unknown
}
interface TrendItem {
  visitDate?: string
  date?: string
  pv?: number
  uv?: number
  [k: string]: unknown
}
interface VisitRow {
  id?: string | number
  ip?: string
  ipCityName?: string
  city?: string
  url?: string
  referer?: string
  userAgent?: string
  visitDate?: string
  createTime?: string
  [k: string]: unknown
}
interface PageList<T> {
  list?: T[]
  total?: number
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const inputCls =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function VisitTrackingPage() {
  const [start, setStart] = React.useState(daysAgo(7))
  const [end, setEnd] = React.useState(daysAgo(0))
  const [keyword, setKeyword] = React.useState('')
  const [page, setPage] = React.useState(1)
  const pageSize = 15

  const qs = buildQs({ startTime: start, endTime: end })
  const listQs = buildQs({
    startTime: start,
    endTime: end,
    url: keyword || undefined,
    page,
    pageSize,
  })

  const { data: statsResp, isLoading: ls } = useQuery({
    queryKey: ['visit-tracking', 'stats', start, end],
    queryFn: () => eduApi<{ summary: VisitStats }>(`/api/admin/visit-tracking/summary${qs}`),
  })
  const { data: pvTrend, isLoading: lt } = useQuery({
    queryKey: ['visit-tracking', 'pv', start, end],
    queryFn: () => eduApi<{ list: TrendItem[] }>(`/api/admin/visit-tracking/day/pv/list${qs}`),
  })
  const { data: uvTrend } = useQuery({
    queryKey: ['visit-tracking', 'uv', start, end],
    queryFn: () => eduApi<{ list: TrendItem[] }>(`/api/admin/visit-tracking/day/uv/list${qs}`),
  })
  const { data: listData, isLoading: ll } = useQuery({
    queryKey: ['visit-tracking', 'list', start, end, keyword, page],
    queryFn: () => eduApi<PageList<VisitRow>>(`/api/admin/visit-tracking/log/list${listQs}`),
  })

  const trendArr = React.useMemo(() => {
    const pvList = pvTrend?.list ?? []
    const uvList = uvTrend?.list ?? []
    const uvMap = new Map(uvList.map((u) => [u.visitDate ?? u.date ?? '', u.uv ?? 0]))
    return pvList.map((p) => ({
      visitDate: p.visitDate ?? p.date,
      pv: p.pv ?? 0,
      uv: uvMap.get(p.visitDate ?? p.date ?? '') ?? 0,
    }))
  }, [pvTrend, uvTrend])
  const stats = statsResp?.summary
  const trendLabels = trendArr.map((t) => (t.visitDate ?? '').slice(5))
  const pvSeries = trendArr.map((t) => Number(t.pv ?? 0))
  const uvSeries = trendArr.map((t) => Number(t.uv ?? 0))

  const list = listData?.list ?? []
  const total = listData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const cards = [
    { title: '总浏览量 PV', value: stats?.pv ?? 0, icon: Eye, loading: ls },
    { title: '总访客数 UV', value: stats?.uv ?? 0, icon: Users, loading: ls },
    { title: 'IP 数', value: stats?.ipCount ?? 0, icon: MapPin, loading: ls },
    { title: '会员数', value: stats?.memberCount ?? 0, icon: RefreshCw, loading: ls },
  ]

  function setRecent(days: number) {
    setStart(daysAgo(days))
    setEnd(daysAgo(0))
    setPage(1)
  }
  function refreshAll() {
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">访问追踪统计</h1>
        <p className="text-sm text-muted-foreground">日期范围筛选 · PV/UV 概览 · 趋势与来源明细</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">日期范围：</span>
        <Input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className={`${inputCls} w-40`}
        />
        <span className="text-sm text-muted-foreground">至</span>
        <Input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className={`${inputCls} w-40`}
        />
        <Button size="sm" onClick={refreshAll}>
          查询
        </Button>
        <Button variant="outline" size="sm" onClick={() => setRecent(7)}>
          近 7 天
        </Button>
        <Button variant="outline" size="sm" onClick={() => setRecent(30)}>
          近 30 天
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <StatCard
            key={c.title}
            title={c.title}
            value={c.loading ? '—' : Number(c.value)}
            icon={c.icon}
            loading={c.loading}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(
          [
            { title: '浏览量趋势 (PV)', series: pvSeries, color: 'var(--primary)' },
            { title: '访客数趋势 (UV)', series: uvSeries, color: '#f97316' },
          ] as const
        ).map((c) => (
          <Card key={c.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{c.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {lt ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  加载中...
                </div>
              ) : c.series.length ? (
                <BarChart data={c.series} xAxis={trendLabels} height={240} color={c.color} />
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">暂无数据</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">访问明细</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && refreshAll()}
                placeholder="输入 IP / 路径搜索"
                className={`${inputCls} w-56`}
              />
              <Button size="sm" variant="outline" onClick={refreshAll}>
                <Search className="h-4 w-4" />
                搜索
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-3 py-2">IP 地址</TableHead>
                  <TableHead className="px-3 py-2">所在城市</TableHead>
                  <TableHead className="px-3 py-2">访问路径</TableHead>
                  <TableHead className="px-3 py-2">来源</TableHead>
                  <TableHead className="px-3 py-2">访问日期</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {ll ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((row, i) => (
                    <TableRow key={row.id ?? i} className="hover:bg-muted/30">
                      <TableCell className="px-3 py-2 font-mono text-xs">{row.ip ?? '-'}</TableCell>
                      <TableCell className="px-3 py-2">
                        {row.ipCityName ?? row.city ?? '-'}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-muted-foreground">
                        <TruncatedText value={row.url ?? '-'} className="max-w-[220px]" />
                      </TableCell>
                      <TableCell className="px-3 py-2 text-muted-foreground">
                        {row.referer ?? '-'}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                        {row.visitDate ?? row.createTime ?? '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
