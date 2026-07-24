'use client'

import { Check, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { REFUND_STATUS_CFG } from '../helpers'
import type { EduRefund, EduOrder, AuditRecord } from '../types'

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
      <span
        className={cn(
          'text-sm font-medium',
          mono && 'font-mono text-xs',
          highlight && 'text-lg font-bold text-primary',
        )}
      >
        {value}
      </span>
    </div>
  )
}

interface RefundDetailInfoProps {
  refund: EduRefund
  order: EduOrder | null
  records: AuditRecord[]
  dateFmt: Intl.DateTimeFormat
  currencyFmt: Intl.NumberFormat
  canAct: boolean
  onAudit: () => void
  onReject: () => void
}

export function RefundDetailInfo({
  refund,
  order,
  records,
  dateFmt,
  currencyFmt,
  canAct,
  onAudit,
  onReject,
}: RefundDetailInfoProps) {
  const t = useTranslations('admin.refund')

  return (
    <>
      <div className="rounded-lg border p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('detailTitle')}</h2>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-medium',
              REFUND_STATUS_CFG[refund.status].cls,
            )}
          >
            <span
              className={cn('h-1.5 w-1.5 rounded-full', REFUND_STATUS_CFG[refund.status].dot)}
            />
            {t(`status_${refund.status}`)}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DetailItem label={t('orderNo')} value={refund.orderNo} mono />
          <DetailItem
            label={t('refundAmount')}
            value={currencyFmt.format(Number(refund.refundAmount))}
            highlight
          />
          <DetailItem label={t('refundType')} value={t(`refundType_${refund.refundType}`)} />
          <DetailItem label={t('reason')} value={refund.reason ?? '-'} />
          <DetailItem
            label={t('applyTime')}
            value={refund.applyTime ? dateFmt.format(new Date(refund.applyTime)) : '-'}
          />
          <DetailItem
            label={t('processTime')}
            value={refund.processTime ? dateFmt.format(new Date(refund.processTime)) : '-'}
          />
          <DetailItem
            label={t('completeTime')}
            value={refund.completeTime ? dateFmt.format(new Date(refund.completeTime)) : '-'}
          />
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
            <Button size="sm" onClick={onAudit}>
              <Check className="mr-1 h-4 w-4" />
              {t('approve')}
            </Button>
            <Button size="sm" variant="destructive" onClick={onReject}>
              <X className="mr-1 h-4 w-4" />
              {t('reject')}
            </Button>
          </div>
        )}
      </div>

      {order && (
        <div className="rounded-lg border p-5">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('orderInfo')}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailItem label={t('orderNo')} value={order.orderNo} mono />
            <DetailItem label={t('orderType')} value={order.orderType} />
            <DetailItem
              label={t('payAmount')}
              value={currencyFmt.format(Number(order.payAmount))}
            />
            <DetailItem
              label={t('orderStatus')}
              value={t(`status_${order.status === 'refunded' ? 'completed' : 'pending'}`)}
            />
            <DetailItem label={t('userId')} value={order.userId} mono />
            <DetailItem label={t('createdAt')} value={dateFmt.format(new Date(order.createdAt))} />
          </div>
        </div>
      )}

      <div className="rounded-lg border p-5">
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('auditRecords')}</h3>
        {records.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('noAuditRecords')}</p>
        ) : (
          <div className="space-y-3">
            {records.map((rec) => (
              <div
                key={rec.id}
                className="flex items-start gap-3 rounded-md bg-muted/30 px-3 py-2.5"
              >
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                    rec.action === 'approve'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
                      : 'bg-red-500/10 text-red-600 dark:text-red-500',
                  )}
                >
                  {rec.action === 'approve' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                  {t(`auditAction_${rec.action}`)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">
                    {t('auditor')}: <span className="font-mono">{rec.auditorId}</span> ·{' '}
                    {dateFmt.format(new Date(rec.createdAt))}
                  </div>
                  {rec.reason && <div className="mt-1 text-sm">{rec.reason}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
