'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, ArrowLeft } from 'lucide-react'

import { RefundDetailInfo } from './RefundDetailInfo'
import { RefundDetailDialog } from './RefundDetailDialog'
import { api } from '../helpers'
import type { RefundDetail } from '../types'

export default function RefundDetailPage() {
  const t = useTranslations('admin.refund')
  const locale = useLocale()
  const params = useParams<{ id: string }>()

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const currencyFmt = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'refund', 'detail', params.id],
    queryFn: () => api<RefundDetail>(`/api/admin/refunds/${params.id}`),
    enabled: !!params.id,
  })

  const qc = useQueryClient()
  const [action, setAction] = React.useState<'audit' | 'reject' | null>(null)
  const [reason, setReason] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)

  const auditMut = useMutation({
    mutationFn: (act: 'approve' | 'reject') =>
      api(`/api/refunds/${params.id}/audit`, {
        method: 'POST',
        body: JSON.stringify({ action: act, reason: reason.trim() || undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'refund'] })
      setAction(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const rejectMut = useMutation({
    mutationFn: () =>
      api(`/api/refunds/${params.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'refund'] })
      setAction(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  function openAudit() {
    setAction('audit')
    setReason(data?.refund.processMessage ?? '')
    setErr(null)
  }
  function openReject() {
    setAction('reject')
    setReason('')
    setErr(null)
  }
  function close() {
    if (auditMut.isPending || rejectMut.isPending) return
    setAction(null)
    setErr(null)
  }

  const refund = data?.refund
  const order = data?.order ?? null
  const records = data?.auditRecords ?? []
  const canAct = refund && ['pending'].includes(refund.status)

  return (
    <div className="space-y-4">
      <Link
        href="/admin/refund"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-10 text-center text-destructive">
          {(error as Error).message}
        </div>
      ) : !refund ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">
          {t('noData')}
        </div>
      ) : (
        <RefundDetailInfo
          refund={refund}
          order={order}
          records={records}
          dateFmt={dateFmt}
          currencyFmt={currencyFmt}
          canAct={!!canAct}
          onAudit={openAudit}
          onReject={openReject}
        />
      )}

      <RefundDetailDialog
        action={action}
        refund={refund}
        reason={reason}
        err={err}
        isAuditPending={auditMut.isPending}
        isRejectPending={rejectMut.isPending}
        currencyFmt={currencyFmt}
        onReasonChange={setReason}
        onClose={close}
        onSubmit={(e) => {
          e.preventDefault()
          setErr(null)
          if (action === 'audit') auditMut.mutate('reject')
          else rejectMut.mutate()
        }}
        onApprove={() => {
          setErr(null)
          auditMut.mutate('approve')
        }}
      />
    </div>
  )
}
