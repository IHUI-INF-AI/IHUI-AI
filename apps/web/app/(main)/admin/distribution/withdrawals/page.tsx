'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'

import { WithdrawalsFilter } from './WithdrawalsFilter'
import { WithdrawalsTable } from './WithdrawalsTable'
import { PAGE_SIZE, fetchWithdrawals } from './helpers'

export default function AdminDistributionWithdrawalsPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [status, setStatus] = React.useState('all')

  const listQ = useQuery({
    queryKey: ['admin', 'distribution', 'withdrawals', page, status],
    queryFn: () => fetchWithdrawals(page, status),
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

      <WithdrawalsFilter
        status={status}
        onStatusChange={(v) => {
          setStatus(v)
          setPage(1)
        }}
      />

      <WithdrawalsTable
        items={items}
        isLoading={listQ.isLoading}
        reviewPending={reviewMut.isPending}
        onReview={(id, action) => reviewMut.mutate({ id, action })}
        fmtDate={fmtDate}
      />

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
