'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  Loader2,
  Check,
  X,
  ArrowLeft,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Label } from '@ihui/ui'
import { cn } from '@/lib/utils'

// =============================================================================
// 类型定义
// =============================================================================

type RefundStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed'
type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded'

interface EduRefund {
  id: string
  orderId: string
  orderType: string
  orderNo: string
  userId: string
  reason?: string | null
  refundAmount: string
  refundType: string
  status: RefundStatus
  applyTime?: string | null
  processTime?: string | null
  completeTime?: string | null
  processMessage?: string | null
  handleMessage?: string | null
  createdAt: string
  updatedAt: string
}

interface EduOrder {
  id: string
  orderNo: string
  userId: string
  orderType: string
  targetTitle?: string | null
  payAmount: string
  payType?: string | null
  status: OrderStatus
  createdAt: string
}

interface AuditRecord {
  id: string
  orderId: string
  refundId: string
  auditorId: string
  action: 'approve' | 'reject'
  reason?: string | null
  createdAt: string
}

interface RefundDetail {
  refund: EduRefund
  order: EduOrder | null
  auditRecords: AuditRecord[]
}

// =============================================================================
// 辅助
// =============================================================================

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const REFUND_STATUS_CFG: Record<RefundStatus, { cls: string; dot: string }> = {
  pending: { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500', dot: 'bg-amber-500' },
  approved: { cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-500', dot: 'bg-blue-500' },
  rejected: { cls: 'bg-red-500/10 text-red-600 dark:text-red-500', dot: 'bg-red-500' },
  processing: { cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-500', dot: 'bg-purple-500' },
  completed: { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500', dot: 'bg-emerald-500' },
  failed: { cls: 'bg-red-500/10 text-red-600 dark:text-red-500', dot: 'bg-red-500' },
}

const textareaClass = 'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

// =============================================================================
// 主组件
// =============================================================================

export default function RefundDetailPage() {
  const t = useTranslations('admin.refund')
  const tc = useTranslations('common')
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

  function openAudit() { setAction('audit'); setReason(data?.refund.processMessage ?? ''); setErr(null) }
  function openReject() { setAction('reject'); setReason(''); setErr(null) }
  function close() { if (auditMut.isPending || rejectMut.isPending) return; setAction(null); setErr(null) }

  const refund = data?.refund
  const order = data?.order
  const records = data?.auditRecords ?? []
  const canAct = refund && ['pending'].includes(refund.status)

  return (
    <div className="space-y-4">
      {/* 返回 */}
      <Link href="/admin/refund" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />{t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-10 text-center text-destructive">
          {(error as Error).message}
        </div>
      ) : !refund ? (
        <div className="rounded-lg border px-4 py-10 text-center text-muted-foreground">{t('noData')}</div>
      ) : (
        <>
          {/* 退款信息 + 操作 */}
          <div className="rounded-lg border p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('detailTitle')}</h2>
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', REFUND_STATUS_CFG[refund.status].cls)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', REFUND_STATUS_CFG[refund.status].dot)} />
                {t(`status_${refund.status}`)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailItem label={t('orderNo')} value={refund.orderNo} mono />
              <DetailItem label={t('refundAmount')} value={currencyFmt.format(Number(refund.refundAmount))} highlight />
              <DetailItem label={t('refundType')} value={t(`refundType_${refund.refundType}`)} />
              <DetailItem label={t('reason')} value={refund.reason ?? '-'} />
              <DetailItem label={t('applyTime')} value={refund.applyTime ? dateFmt.format(new Date(refund.applyTime)) : '-'} />
              <DetailItem label={t('processTime')} value={refund.processTime ? dateFmt.format(new Date(refund.processTime)) : '-'} />
              <DetailItem label={t('completeTime')} value={refund.completeTime ? dateFmt.format(new Date(refund.completeTime)) : '-'} />
              <DetailItem label={t('createdAt')} value={dateFmt.format(new Date(refund.createdAt))} />
              {refund.processMessage && (
                <DetailItem label={t('processMessage')} value={refund.processMessage} full />
              )}
              {refund.handleMessage && (
                <DetailItem label={t('handleMessage')} value={refund.handleMessage} full />
              )}
            </div>

            {canAct && (
              <div className="mt-5 flex items-center gap-2 border-t pt-4">
                <Button size="sm" onClick={openAudit}>
                  <Check className="mr-1 h-4 w-4" />{t('approve')}
                </Button>
                <Button size="sm" variant="destructive" onClick={openReject}>
                  <X className="mr-1 h-4 w-4" />{t('reject')}
                </Button>
              </div>
            )}
          </div>

          {/* 订单信息 */}
          {order && (
            <div className="rounded-lg border p-5">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('orderInfo')}</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailItem label={t('orderNo')} value={order.orderNo} mono />
                <DetailItem label={t('orderType')} value={order.orderType} />
                <DetailItem label={t('payAmount')} value={currencyFmt.format(Number(order.payAmount))} />
                <DetailItem label={t('orderStatus')} value={t(`status_${order.status === 'refunded' ? 'completed' : 'pending'}`)} />
                <DetailItem label={t('userId')} value={order.userId} mono />
                <DetailItem label={t('createdAt')} value={dateFmt.format(new Date(order.createdAt))} />
              </div>
            </div>
          )}

          {/* 审核记录 */}
          <div className="rounded-lg border p-5">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('auditRecords')}</h3>
            {records.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t('noAuditRecords')}</p>
            ) : (
              <div className="space-y-3">
                {records.map((rec) => (
                  <div key={rec.id} className="flex items-start gap-3 rounded-md bg-muted/30 px-3 py-2.5">
                    <span className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      rec.action === 'approve'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                        : 'bg-red-500/10 text-red-600 dark:text-red-500',
                    )}>
                      {rec.action === 'approve' ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {t(`auditAction_${rec.action}`)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">
                        {t('auditor')}: <span className="font-mono">{rec.auditorId}</span> · {dateFmt.format(new Date(rec.createdAt))}
                      </div>
                      {rec.reason && <div className="mt-1 text-sm">{rec.reason}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* 审核/驳回弹窗 */}
      <Dialog open={!!action} onOpenChange={(o) => (!o && !auditMut.isPending && !rejectMut.isPending ? close() : null)}>
        <DialogContent>
          <form onSubmit={(e) => { e.preventDefault(); setErr(null); if (action === 'audit') auditMut.mutate('reject'); else rejectMut.mutate() }} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{action === 'audit' ? t('auditTitle') : t('rejectTitle')}</DialogTitle>
              <DialogDescription>{action === 'audit' ? t('auditDesc') : t('rejectDesc')}</DialogDescription>
            </DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            {refund && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <div className="font-mono text-xs">{refund.orderNo}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {currencyFmt.format(Number(refund.refundAmount))} · {t(`status_${refund.status}`)}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="d-reason">{t('fieldReason')}</Label>
              <textarea
                id="d-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('reasonPlaceholder')}
                rows={3}
                className={textareaClass}
              />
            </div>
            <DialogFooter>
              {action === 'audit' ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={close}
                    disabled={auditMut.isPending}
                  >
                    {tc('cancel')}
                  </Button>
                  <Button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setErr(null); auditMut.mutate('approve') }}
                    disabled={auditMut.isPending}
                  >
                    {auditMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Check className="mr-1 h-4 w-4" />{t('approve')}
                  </Button>
                  <Button type="submit" variant="destructive" disabled={auditMut.isPending}>
                    {auditMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <X className="mr-1 h-4 w-4" />{t('reject')}
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={close} disabled={rejectMut.isPending}>
                    {tc('cancel')}
                  </Button>
                  <Button type="submit" variant="destructive" disabled={rejectMut.isPending}>
                    {rejectMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('reject')}
                  </Button>
                </>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =============================================================================
// 详情项组件
// =============================================================================

function DetailItem({
  label,
  value,
  mono,
  highlight,
  full,
}: {
  label: string
  value: string
  mono?: boolean
  highlight?: boolean
  full?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-1', full && 'sm:col-span-2')}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn(
        'text-sm font-medium',
        mono && 'font-mono text-xs',
        highlight && 'text-lg font-bold text-primary',
      )}>
        {value}
      </span>
    </div>
  )
}
