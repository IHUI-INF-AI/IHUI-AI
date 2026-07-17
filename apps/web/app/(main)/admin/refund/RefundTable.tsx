'use client'

import Link from 'next/link'
import { Loader2, RotateCcw, Check, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui'
import { REFUND_STATUS_CFG } from './helpers'
import type { EduRefund } from './types'

interface RefundTableProps {
  refunds: EduRefund[]
  isLoading: boolean
  error: Error | null
  dateFmt: Intl.DateTimeFormat
  currencyFmt: Intl.NumberFormat
  onAudit: (r: EduRefund) => void
  onReject: (r: EduRefund) => void
}

export function RefundTable({
  refunds,
  isLoading,
  error,
  dateFmt,
  currencyFmt,
  onAudit,
  onReject,
}: RefundTableProps) {
  const t = useTranslations('admin.refund')

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">{t('orderNo')}</th>
            <th className="px-4 py-2.5 font-medium">{t('refundAmount')}</th>
            <th className="px-4 py-2.5 font-medium">{t('refundType')}</th>
            <th className="px-4 py-2.5 font-medium">{t('reason')}</th>
            <th className="px-4 py-2.5 font-medium">{t('status')}</th>
            <th className="px-4 py-2.5 font-medium">{t('applyTime')}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t('actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('loading')}
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </td>
            </tr>
          ) : refunds.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                <RotateCcw className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {t('noData')}
              </td>
            </tr>
          ) : (
            refunds.map((r) => {
              const sc = REFUND_STATUS_CFG[r.status]
              return (
                <tr key={r.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link href={`/admin/refund/${r.id}`} className="hover:underline">
                      {r.orderNo}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-medium">
                    {currencyFmt.format(Number(r.refundAmount))}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t(`refundType_${r.refundType}`)}
                  </td>
                  <td className="max-w-xs break-words px-4 py-2.5 text-muted-foreground">
                    {r.reason ?? '-'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                        sc.cls,
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                      {t(`status_${r.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.applyTime ? dateFmt.format(new Date(r.applyTime)) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === 'pending' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => onAudit(r)}>
                            <Check className="mr-1 h-3.5 w-3.5" />
                            {t('approve')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onReject(r)}>
                            <X className="mr-1 h-3.5 w-3.5" />
                            {t('reject')}
                          </Button>
                        </>
                      )}
                      <Link href={`/admin/refund/${r.id}`}>
                        <Button size="sm" variant="ghost">
                          {t('view')}
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
