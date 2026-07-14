'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Loader2, ChevronLeft, ChevronRight, ArrowLeft, Search } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Input,
  Button,
} from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface Order {
  id: string
  orderNo?: string
  orderId?: string
  userId?: string
  userNickname?: string
  productName?: string
  amount: number
  orderAmount?: number
  commissionAmount?: number
  rate?: number
  status: string
  createdAt: string
}

interface ListData {
  items?: Order[]
  list?: Order[]
  total?: number
}

const PAGE_SIZE = 20

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  settled: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  cancelled: 'bg-muted text-muted-foreground',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-500',
  refunded: 'bg-red-500/10 text-red-600 dark:text-red-500',
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待结算',
  paid: '已支付',
  settled: '已结算',
  approved: '已通过',
  cancelled: '已取消',
  rejected: '已拒绝',
  refunded: '已退款',
}

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetchApi<T>(url)
    return r.success ? r.data : fallback
  } catch {
    return fallback
  }
}

const fmtYuan = (n: number) => `¥${(n / 100).toFixed(2)}`

export default function AdminDistributionOrdersPage() {
  const locale = useLocale()
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const listQ = useQuery({
    queryKey: ['admin', 'distribution', 'orders', page, debounced],
    queryFn: () =>
      safeFetch<ListData>(
        `/commission/orders?page=${page}&pageSize=${PAGE_SIZE}${debounced ? `&keyword=${encodeURIComponent(debounced)}` : ''}`,
        { items: [], total: 0 },
      ),
  })

  const items = listQ.data?.items ?? listQ.data?.list ?? []
  const total = listQ.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmtDate = (v: string | null | undefined) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  return (
    <div className="space-y-4">
      <Link
        href="/admin/distribution"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回分销中心
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">分销订单</h1>
        <p className="mt-1 text-sm text-muted-foreground">查看佣金订单明细与状态</p>
      </div>

      {listQ.isError && (
        <Alert variant="danger" title="加载失败" description="无法获取分销订单列表" />
      )}

      <Card>
        <CardContent className="flex items-center gap-2 p-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索订单号 / 用户"
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="px-4 py-2.5">订单号</TableHead>
              <TableHead className="px-4 py-2.5">用户</TableHead>
              <TableHead className="px-4 py-2.5">商品</TableHead>
              <TableHead className="px-4 py-2.5 text-right">金额</TableHead>
              <TableHead className="px-4 py-2.5 text-right">佣金</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5">时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  暂无分销订单
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="px-4 py-2.5 font-medium">
                    {it.orderNo ?? it.orderId ?? it.id}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {it.userNickname ?? it.userId ?? '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {it.productName ?? '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    {fmtYuan(it.orderAmount ?? it.amount ?? 0)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'px-4 py-2.5 text-right font-medium',
                      (it.commissionAmount ?? 0) >= 0
                        ? 'text-emerald-600 dark:text-emerald-500'
                        : 'text-red-600 dark:text-red-500',
                    )}
                  >
                    {fmtYuan(it.commissionAmount ?? 0)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_CLS[it.status] ?? 'bg-muted text-muted-foreground',
                      )}
                    >
                      {STATUS_LABEL[it.status] ?? it.status}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {fmtDate(it.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">共 {total} 条</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
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
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
