'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Loader2, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface Settlement {
  id: string
  settleNo?: string
  period?: string
  startDate?: string
  endDate?: string
  amount: number
  status: string
  processedAt?: string | null
  createdAt?: string
}

interface ListData {
  items?: Settlement[]
  list?: Settlement[]
  total?: number
}

const PAGE_SIZE = 20

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  processing: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  settled: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-500',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-500',
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待结算',
  processing: '结算中',
  settled: '已结算',
  approved: '已通过',
  failed: '结算失败',
  rejected: '已拒绝',
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

export default function AdminDistributionSettlementsPage() {
  const locale = useLocale()
  const [page, setPage] = React.useState(1)

  const listQ = useQuery({
    queryKey: ['admin', 'distribution', 'settlements', page],
    queryFn: () =>
      safeFetch<ListData>(`/commission/settlements?page=${page}&pageSize=${PAGE_SIZE}`, {
        items: [],
        total: 0,
      }),
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

  const fmtPeriod = (it: Settlement) => {
    if (it.period) return it.period
    const parts = [fmtDate(it.startDate), fmtDate(it.endDate)].filter((p) => p !== '-')
    return parts.length ? parts.join(' ~ ') : '-'
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
        <h1 className="text-2xl font-bold tracking-tight">结算记录</h1>
        <p className="mt-1 text-sm text-muted-foreground">佣金结算单与周期记录</p>
      </div>

      {listQ.isError && (
        <Alert variant="danger" title="加载失败" description="无法获取结算记录列表" />
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="px-4 py-2.5">结算单号</TableHead>
              <TableHead className="px-4 py-2.5">周期</TableHead>
              <TableHead className="px-4 py-2.5 text-right">金额</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5">操作时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  暂无结算记录
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="px-4 py-2.5 font-medium">{it.settleNo ?? it.id}</TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {fmtPeriod(it)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'px-4 py-2.5 text-right font-medium',
                      it.amount >= 0
                        ? 'text-emerald-600 dark:text-emerald-500'
                        : 'text-red-600 dark:text-red-500',
                    )}
                  >
                    {fmtYuan(it.amount)}
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
                    {fmtDate(it.processedAt ?? it.createdAt)}
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
