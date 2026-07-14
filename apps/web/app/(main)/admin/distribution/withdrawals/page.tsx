'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, ChevronRight, ArrowLeft, Check, X } from 'lucide-react'

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
  Button,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface Withdrawal {
  id: string
  amount: number
  account: string
  accountType?: string
  status: string
  remark?: string | null
  userNickname?: string
  userId?: string
  createdAt: string
  processedAt?: string | null
}

interface ListData {
  items?: Withdrawal[]
  list?: Withdrawal[]
  total?: number
}

const PAGE_SIZE = 20

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-500',
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-500',
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  paid: '已打款',
  failed: '失败',
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

export default function AdminDistributionWithdrawalsPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [status, setStatus] = React.useState('all')

  const listQ = useQuery({
    queryKey: ['admin', 'distribution', 'withdrawals', page, status],
    queryFn: () =>
      safeFetch<ListData>(
        `/commission/withdrawals?page=${page}&pageSize=${PAGE_SIZE}${status !== 'all' ? `&status=${status}` : ''}`,
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

  const reviewMut = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      const r = await fetchApi<{ success: boolean }>(`/commission/withdrawals/${id}/${action}`, {
        method: 'POST',
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: (_d, v) => {
      toast.success(v.action === 'approve' ? '已通过提现申请' : '已拒绝提现申请')
      qc.invalidateQueries({ queryKey: ['admin', 'distribution', 'withdrawals'] })
    },
    onError: (e: Error) => toast.error(e.message || '操作失败'),
  })

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
        <h1 className="text-2xl font-bold tracking-tight">提现申请</h1>
        <p className="mt-1 text-sm text-muted-foreground">审核用户提现请求</p>
      </div>

      {listQ.isError && (
        <Alert variant="danger" title="加载失败" description="无法获取提现申请列表" />
      )}

      <Card>
        <CardContent className="flex items-center gap-3 p-3">
          <span className="text-sm text-muted-foreground">状态</span>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="pending">待审核</SelectItem>
              <SelectItem value="approved">已通过</SelectItem>
              <SelectItem value="rejected">已拒绝</SelectItem>
              <SelectItem value="paid">已打款</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="px-4 py-2.5">用户</TableHead>
              <TableHead className="px-4 py-2.5 text-right">金额</TableHead>
              <TableHead className="px-4 py-2.5">收款账户</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5">申请时间</TableHead>
              <TableHead className="px-4 py-2.5">处理时间</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
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
                  暂无提现申请
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="px-4 py-2.5 font-medium">
                    {it.userNickname ?? it.userId ?? '-'}
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
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {it.account}
                    {it.accountType ? ` (${it.accountType})` : ''}
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
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {fmtDate(it.processedAt)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    {it.status === 'pending' ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={reviewMut.isPending}
                          onClick={() => reviewMut.mutate({ id: it.id, action: 'approve' })}
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          通过
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={reviewMut.isPending}
                          onClick={() => reviewMut.mutate({ id: it.id, action: 'reject' })}
                        >
                          <X className="h-3.5 w-3.5 text-red-600" />
                          拒绝
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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
