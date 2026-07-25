'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { RefundStatsCards } from './RefundStatsCards'
import { RefundFilter } from './RefundFilter'
import { RefundTable } from './RefundTable'
import { RefundDialog } from './RefundDialog'
import { PAGE_SIZE, api } from './helpers'
import { useRefundMachine } from '@/lib/workflows'
import type { ActionState, EduRefund, PageData } from './types'

export default function AdminRefundPage() {
  const t = useTranslations('admin.refund')
  const locale = useLocale()

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const currencyFmt = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <RefundStatsCards currencyFmt={currencyFmt} />
      <RefundList dateFmt={dateFmt} currencyFmt={currencyFmt} />
    </div>
  )
}

function RefundList({
  dateFmt,
  currencyFmt,
}: {
  dateFmt: Intl.DateTimeFormat
  currencyFmt: Intl.NumberFormat
}) {
  const t = useTranslations('admin.refund')
  const qc = useQueryClient()
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [searchInput, setSearchInput] = React.useState('')
  const [action, setAction] = React.useState<ActionState | null>(null)
  const [reason, setReason] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)
  const { state: refundState, can, send: dispatchRefund } = useRefundMachine()

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'refund', 'list', status, page, search],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (status !== 'all') qs.set('status', status)
      if (search) qs.set('orderNo', search)
      return api<PageData<EduRefund>>(`/api/refunds?${qs.toString()}`)
    },
  })

  const mut = useMutation({
    mutationFn: () => {
      const url =
        action!.mode === 'audit'
          ? `/api/refunds/${action!.refund.id}/audit`
          : `/api/refunds/${action!.refund.id}/reject`
      const body: Record<string, unknown> =
        action!.mode === 'audit'
          ? { action: 'reject', reason: reason.trim() || undefined }
          : { reason: reason.trim() || undefined }
      return api(url, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'refund'] })
      setAction(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const approveMut = useMutation({
    mutationFn: () =>
      api(`/api/refunds/${action!.refund.id}/audit`, {
        method: 'POST',
        body: JSON.stringify({ action: 'approve', reason: reason.trim() || undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'refund'] })
      setAction(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  function openAudit(r: EduRefund) {
    setAction({ refund: r, mode: 'audit' })
    setReason(r.processMessage ?? '')
    setErr(null)
  }
  function openReject(r: EduRefund) {
    setAction({ refund: r, mode: 'reject' })
    setReason('')
    setErr(null)
  }
  function close() {
    if (mut.isPending || approveMut.isPending) return
    setAction(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    mut.mutate()
  }
  function doSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const refunds = data?.list ?? []

  return (
    <div className="space-y-4">
      <RefundFilter
        status={status}
        searchInput={searchInput}
        onStatusChange={(v) => {
          setStatus(v)
          setPage(1)
        }}
        onSearchInputChange={setSearchInput}
        onSearch={doSearch}
      />

      <RefundTable
        refunds={refunds}
        isLoading={isLoading}
        error={error as Error | null}
        dateFmt={dateFmt}
        currencyFmt={currencyFmt}
        onAudit={openAudit}
        onReject={openReject}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(Math.max(1, page - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page', { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <RefundDialog
        action={action}
        reason={reason}
        err={err}
        isRejectPending={mut.isPending}
        isApprovePending={approveMut.isPending}
        currencyFmt={currencyFmt}
        canApprove={can({ type: 'APPROVE_REFUND' })}
        canReject={can({ type: 'REJECT' })}
        state={refundState}
        onReasonChange={setReason}
        onClose={close}
        onSubmit={submit}
        onApprove={() => {
          setErr(null)
          if (can({ type: 'REVIEW' })) dispatchRefund({ type: 'REVIEW', reviewerId: 'admin' })
          dispatchRefund({ type: 'APPROVE_REFUND' })
          approveMut.mutate()
        }}
        onReject={() => {
          setErr(null)
          if (can({ type: 'REVIEW' })) dispatchRefund({ type: 'REVIEW', reviewerId: 'admin' })
          dispatchRefund({ type: 'REJECT', reason: reason.trim() })
          mut.mutate()
        }}
      />
    </div>
  )
}
