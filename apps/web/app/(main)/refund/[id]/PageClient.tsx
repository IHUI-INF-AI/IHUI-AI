'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, ArrowLeft, RotateCcw, Clock, CheckCircle, XCircle, Wallet } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

interface RefundDetail {
  id: string
  orderId: string
  orderType: string
  orderNo: string
  userId: string
  reason: string | null
  refundAmount: string
  refundType: string
  status: string
  applyTime: string | null
  processTime: string | null
  completeTime: string | null
  processMessage: string | null
  handleMessage: string | null
  createdAt: string
  updatedAt: string
}

interface AuditRecord {
  id: string
  refundId: string
  auditorId: string
  action: string
  reason: string | null
  createdAt: string
}

interface RefundFullData {
  refund: RefundDetail
  order: unknown | null
  auditRecords: AuditRecord[]
}

interface RefundListData {
  list: RefundDetail[]
  total: number
}

const STATUS_CONFIG: Record<string, { labelKey: string; icon: typeof Clock; cls: string }> = {
  pending: {
    labelKey: 'status.pending',
    icon: Clock,
    cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  },
  approved: {
    labelKey: 'status.approved',
    icon: CheckCircle,
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  rejected: { labelKey: 'status.rejected', icon: XCircle, cls: 'bg-destructive/10 text-destructive' },
  completed: {
    labelKey: 'status.completed',
    icon: Wallet,
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  },
}

const PENDING_CLS = 'bg-amber-500/10 text-amber-600 dark:text-amber-500'

export default function RefundDetailPage() {
  const params = useParams<{ id: string }>()
  const locale = useLocale()
  const t = useTranslations('refundDetailPage')

  const { data, isLoading, error } = useQuery({
    queryKey: ['refund', params.id],
    queryFn: async (): Promise<RefundFullData> => {
      const detailRes = await fetchApi<RefundFullData>(`/api/refunds/${params.id}`)
      if (detailRes.success) return detailRes.data

      const listRes = await fetchApi<RefundListData>(`/api/refunds/me?page=1&pageSize=100`)
      if (listRes.success && listRes.data) {
        const found = listRes.data.list?.find((r) => r.id === params.id)
        if (found) return { refund: found, order: null, auditRecords: [] }
      }
      throw new Error(detailRes.error || t('notFound'))
    },
    enabled: !!params.id,
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const refund = data?.refund
  const auditRecords = data?.auditRecords ?? []
  const statusKey = refund ? (STATUS_CONFIG[refund.status] ?? STATUS_CONFIG.pending) : null
  const StatusIcon = statusKey?.icon

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (error || !refund) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/refund"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('notFound')}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/refund"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <RotateCcw className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="font-mono text-sm text-muted-foreground">{refund.orderNo}</p>
      </div>

      {statusKey && StatusIcon && (
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium',
            statusKey.cls,
          )}
        >
          <StatusIcon className="h-4 w-4" />
          {t(statusKey.labelKey)}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <dl className="divide-y">
            <Row label={t('fields.refundNo')} value={refund.id} mono />
            <Row label={t('fields.orderNo')} value={refund.orderNo} mono />
            <Row label={t('fields.orderType')} value={refund.orderType} />
            <Row
              label={t('fields.refundAmount')}
              value={
                <span className="font-semibold text-primary">
                  ¥{Number(refund.refundAmount).toFixed(2)}
                </span>
              }
            />
            <Row
              label={t('fields.refundType')}
              value={refund.refundType === 'original' ? t('refundType.original') : refund.refundType}
            />
            <Row label={t('fields.applyTime')} value={fmt(refund.applyTime ?? refund.createdAt)} />
            <Row label={t('fields.processTime')} value={fmt(refund.processTime)} />
            <Row label={t('fields.completeTime')} value={fmt(refund.completeTime)} />
            {refund.reason && <Row label={t('fields.reason')} value={refund.reason} />}
            {refund.processMessage && <Row label={t('fields.processMessage')} value={refund.processMessage} />}
            {refund.handleMessage && <Row label={t('fields.handleMessage')} value={refund.handleMessage} />}
          </dl>
        </CardContent>
      </Card>

      {auditRecords.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t('auditRecords')}</h2>
          <div className="space-y-2">
            {auditRecords.map((record) => {
              const cfg =
                record.action === 'approve'
                  ? STATUS_CONFIG.approved
                  : record.action === 'reject'
                    ? STATUS_CONFIG.rejected
                    : (STATUS_CONFIG.pending ?? null)
              const RecIcon = cfg?.icon
              return (
                <div key={record.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      cfg?.cls ?? PENDING_CLS,
                    )}
                  >
                    {RecIcon && <RecIcon className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {record.action === 'approve'
                          ? t('auditAction.approve')
                          : record.action === 'reject'
                            ? t('auditAction.reject')
                            : record.action}
                      </span>
                      <span className="text-xs text-muted-foreground">{fmt(record.createdAt)}</span>
                    </div>
                    {record.reason && (
                      <p className="text-sm text-muted-foreground">{record.reason}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between px-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-right', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  )
}
