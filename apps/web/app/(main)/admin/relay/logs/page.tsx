'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import {
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { Skeleton } from '@/components/ui/skeleton'

const PAGE_SIZE = 20
const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface LogRow {
  id: number
  userId: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  latencyMs: number
  status: 'success' | 'error'
  errorMessage: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  username: string | null
  email: string | null
}
interface ListData {
  list: LogRow[]
  total: number
  page: number
  pageSize: number
}
interface StatsRow {
  groupKey: string
  callCount: number
  totalTokens: number
  promptTokens: number
  completionTokens: number
  successCount: number
  errorCount: number
  avgLatencyMs: number
  totalCostCents: number
}
interface StatsData {
  groupBy: 'model' | 'day' | 'user'
  rows: StatsRow[]
}

export default function AdminRelayLogsPage() {
  const locale = useLocale()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [model, setModel] = React.useState('')
  const [status, setStatus] = React.useState<'all' | 'success' | 'error'>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [groupBy, setGroupBy] = React.useState<'model' | 'day' | 'user'>('model')

  const qs = React.useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (search) p.set('search', search)
    if (model) p.set('model', model)
    if (status !== 'all') p.set('status', status)
    if (startDate) p.set('startDate', startDate)
    if (endDate) p.set('endDate', endDate)
    return p.toString()
  }, [page, search, model, status, startDate, endDate])

  const statsQs = React.useMemo(() => {
    const p = new URLSearchParams({ groupBy })
    if (startDate) p.set('startDate', startDate)
    if (endDate) p.set('endDate', endDate)
    return p.toString()
  }, [groupBy, startDate, endDate])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'relay', 'logs', qs],
    queryFn: async () => {
      const r = await fetchApi<ListData>(`/api/admin/relay/logs?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'relay', 'logs', 'stats', statsQs],
    queryFn: async () => {
      const r = await fetchApi<StatsData>(`/api/admin/relay/logs/stats?${statsQs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })
  const numFmt = new Intl.NumberFormat(locale)
  const statsRows = statsData?.rows ?? []
  const totalCalls = statsRows.reduce((s, r) => s + r.callCount, 0)
  const totalTokens = statsRows.reduce((s, r) => s + r.totalTokens, 0)
  const totalCostCents = statsRows.reduce((s, r) => s + r.totalCostCents, 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FileText className="h-6 w-6 text-primary" />
          调用日志
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">中转站请求日志与按维度聚合统计</p>
      </div>

      <div className="grid gap-3 min-[640px]:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>区间调用次数</span>
              <Clock className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold tabular-nums">{numFmt.format(totalCalls)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>区间 Token 总量</span>
              <Coins className="h-4 w-4 text-amber-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="text-2xl font-bold tabular-nums">{numFmt.format(totalTokens)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>区间成本(¥)</span>
              <Coins className="h-4 w-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="text-2xl font-bold tabular-nums">
                {(totalCostCents / 100).toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setPage(1)
              setSearch(e.target.value)
            }}
            placeholder="搜索 model / errorMessage"
            className="pl-8"
          />
        </div>
        <Input
          value={model}
          onChange={(e) => {
            setPage(1)
            setModel(e.target.value)
          }}
          placeholder="model 精确匹配"
          className="h-8 w-40 text-xs"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(1)
            setStatus(v as 'all' | 'success' | 'error')
          }}
        >
          <SelectTrigger className={selectClass} aria-label="状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="success">成功</SelectItem>
            <SelectItem value="error">错误</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-8 w-36 text-xs"
          aria-label="开始日期"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-8 w-36 text-xs"
          aria-label="结束日期"
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
          <span className="text-xs font-medium uppercase text-muted-foreground">聚合统计</span>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as 'model' | 'day' | 'user')}>
            <SelectTrigger className={selectClass} aria-label="分组">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="model">按模型</SelectItem>
              <SelectItem value="day">按日期</SelectItem>
              <SelectItem value="user">按用户</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">分组</th>
              <th className="px-3 py-2 text-right">调用</th>
              <th className="px-3 py-2 text-right">Tokens</th>
              <th className="px-3 py-2 text-right">成功</th>
              <th className="px-3 py-2 text-right">失败</th>
              <th className="px-3 py-2 text-right">均延迟(ms)</th>
              <th className="px-3 py-2 text-right">成本(¥)</th>
            </tr>
          </thead>
          <tbody>
            {statsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={`ss-${i}`} className="border-t border-border">
                  <td colSpan={7} className="px-3 py-2">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))
            ) : statsRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  暂无数据
                </td>
              </tr>
            ) : (
              statsRows.map((r) => (
                <tr key={r.groupKey} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.groupKey}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{numFmt.format(r.callCount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{numFmt.format(r.totalTokens)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {numFmt.format(r.successCount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                    {numFmt.format(r.errorCount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{numFmt.format(r.avgLatencyMs)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {(r.totalCostCents / 100).toFixed(4)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
          调用明细
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">时间</th>
              <th className="px-3 py-2 text-left">用户</th>
              <th className="px-3 py-2 text-left">模型</th>
              <th className="px-3 py-2 text-right">Tokens</th>
              <th className="px-3 py-2 text-right">延迟(ms)</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">错误</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-t border-border">
                  <td colSpan={7} className="px-3 py-2">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  暂无数据
                </td>
              </tr>
            ) : (
              list.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {fmt.format(new Date(l.createdAt))}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-xs">{l.username ?? l.userId.slice(0, 8)}</div>
                    {l.email && <div className="text-[10px] text-muted-foreground">{l.email}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">{l.model}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">
                    {numFmt.format(l.totalTokens)}
                    <div className="text-[10px] text-muted-foreground">
                      {l.promptTokens}/{l.completionTokens}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{l.latencyMs}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs ${
                        l.status === 'success'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}
                    >
                      {l.status === 'success' ? '成功' : '错误'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-red-600 dark:text-red-400">
                    {l.errorMessage ?? '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
