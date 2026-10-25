// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, Loader2, MapPin, RefreshCw, Search, Users } from 'lucide-react'
import { eduApi, buildQs } from '@/lib/edu'
import { CHART_ORANGE } from '@ihui/design-tokens'
import { StatCard } from '@/components/data'
import { BarChart } from '@/components/charts'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  SearchInput,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ihui/ui-react'
import { TruncatedText, BackButton } from '@/components/common'

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
interface PageUsageRow {
  url: string
  scope: 'public' | 'admin' | 'auth'
  pv: number
  uv: number
}

type VisitScope = 'public' | 'admin' | 'auth' | 'all'
const SCOPE_OPTIONS: Array<{ value: VisitScope; label: string }> = [
  { value: 'public', label: '前台' },
  { value: 'admin', label: '后台' },
  { value: 'auth', label: '登录页' },
  { value: 'all', label: '全部' },
]
/** 端筛选:与 /ops-wallboard 的 platformSplit 同一分桶(web 裸路径 / rn / mp 前缀)。 */
type VisitPlatform = 'all' | 'web' | 'rn' | 'mp'
const PLATFORM_OPTIONS: Array<{ value: VisitPlatform; label: string }> = [
  { value: 'all', label: '全部端' },
  { value: 'web', label: '网站' },
  { value: 'rn', label: '移动端' },
  { value: 'mp', label: '小程序' },
]
const SCOPE_LABEL: Record<PageUsageRow['scope'], string> = {
  public: '前台',
  admin: '后台',
  auth: '登录',
}
const SCOPE_BADGE_CLASS: Record<PageUsageRow['scope'], string> = {
  public: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  admin: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  auth: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
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
  const [scope, setScope] = React.useState<VisitScope>('public')
  const [platform, setPlatform] = React.useState<VisitPlatform>('all')
  const [sort, setSort] = React.useState<'pv' | 'uv'>('pv')
  const pageSize = 15

  const qs = buildQs({ startTime: start, endTime: end, scope })
  const listQs = buildQs({
    startTime: start,
    endTime: end,
    scope,
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
    queryKey: ['visit-tracking', 'list', start, end, scope, keyword, page],
    queryFn: () => eduApi<PageList<VisitRow>>(`/api/admin/visit-tracking/log/list${listQs}`),
  })
  const { data: pageUsage, isLoading: lp } = useQuery({
    queryKey: ['visit-tracking', 'pages', start, end, scope, platform, sort],
    queryFn: () =>
      eduApi<{ list: PageUsageRow[]; total: number; totalPv: number }>(
        `/api/admin/visit-tracking/stats/page${buildQs({
          startTime: start,
          endTime: end,
          scope,
          platform,
          sort,
          page: 1,
          pageSize: 10,
        })}`,
      ),
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
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">访问追踪统计</h1>
        <p className="text-xs text-muted-foreground">
          日期范围筛选 · 前台/后台/登录页口径切换 · 排行可按端(网站/移动端/小程序)筛选 · PV/UV 趋势
          · 页面使用排行 · 访问明细
        </p>
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
        <span className="ml-2 text-sm text-muted-foreground">访问面：</span>
        {SCOPE_OPTIONS.map((o) => (
          <Button
            key={o.value}
            size="sm"
            variant={scope === o.value ? 'default' : 'outline'}
            onClick={() => {
              setScope(o.value)
              setPage(1)
            }}
          >
            {o.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
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

      <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
        {(
          [
            { title: '浏览量趋势 (PV)', series: pvSeries, color: 'var(--primary)' },
            { title: '访客数趋势 (UV)', series: uvSeries, color: CHART_ORANGE },
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
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle className="text-base">页面使用排行 TOP 10</CardTitle>
            <div className="flex flex-wrap items-center gap-1">
              {PLATFORM_OPTIONS.map((o) => (
                <Button
                  key={o.value}
                  size="sm"
                  variant={platform === o.value ? 'default' : 'outline'}
                  onClick={() => setPlatform(o.value)}
                >
                  {o.label}
                </Button>
              ))}
              <span className="mx-1 text-xs text-muted-foreground">排序</span>
              {(
                [
                  { value: 'pv' as const, label: '按次数' },
                  { value: 'uv' as const, label: '按人数' },
                ] as const
              ).map((o) => (
                <Button
                  key={o.value}
                  size="sm"
                  variant={sort === o.value ? 'default' : 'outline'}
                  onClick={() => setSort(o.value)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
            {pageUsage && (
              <span className="text-xs text-muted-foreground">
                共 {pageUsage.total} 个页面 · 区间总 PV {pageUsage.totalPv}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {lp ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              加载中...
            </div>
          ) : (pageUsage?.list.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="px-3 py-2">页面</TableHead>
                    <TableHead className="px-3 py-2">访问面</TableHead>
                    <TableHead className="px-3 py-2 text-right">PV</TableHead>
                    <TableHead className="px-3 py-2 text-right">UV</TableHead>
                    <TableHead className="w-1/3 px-3 py-2">占区间 PV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pageUsage?.list ?? []).map((row) => {
                    const pct =
                      pageUsage && pageUsage.totalPv > 0 ? (row.pv / pageUsage.totalPv) * 100 : 0
                    return (
                      <TableRow key={row.url} className="hover:bg-muted/30">
                        <TableCell className="px-3 py-2">
                          <TruncatedText value={row.url} className="max-w-[320px]" />
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <span
                            className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium ${SCOPE_BADGE_CLASS[row.scope]}`}
                          >
                            {SCOPE_LABEL[row.scope]}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right font-mono tabular-nums">
                          {row.pv}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right font-mono tabular-nums">
                          {row.uv}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted">
                              <div
                                className="h-full rounded-sm bg-primary/60"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">访问明细</CardTitle>
            <div className="flex items-center gap-2">
              <SearchInput
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && refreshAll()}
                placeholder="输入 IP / 路径搜索"
                className="{`${inputCls} w-56`}"
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
              <TableBody>
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
