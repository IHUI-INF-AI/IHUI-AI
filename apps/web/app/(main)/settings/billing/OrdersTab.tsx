'use client'

import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import type { useTranslations } from 'next-intl'
import { StatusBadge } from './StatusBadge'
import { thCls, tdCls } from './helpers'
import type { Order } from '@/lib/order-api'

type Translator = ReturnType<typeof useTranslations<'settings'>>

interface Props {
  t: Translator
  list: Order[]
  isLoading: boolean
  error: Error | null
  page: number
  total: number
  pageSize: number
  currencyFmt: Intl.NumberFormat
  dateFmt: Intl.DateTimeFormat
  onPageChange: (p: number) => void
}

export function OrdersTab({
  t,
  list,
  isLoading,
  error,
  page,
  total,
  pageSize,
  currencyFmt,
  dateFmt,
  onPageChange,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className={thCls}>{t('billingOrderNo')}</th>
            <th className={thCls}>{t('billingAmount')}</th>
            <th className={thCls}>{t('billingStatus')}</th>
            <th className={thCls}>{t('billingCreatedAt')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                {t('billingLoading')}
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-destructive">
                {error.message}
              </td>
            </tr>
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                {t('billingNoData')}
              </td>
            </tr>
          ) : (
            list.map((o) => (
              <tr key={o.id} className="transition-colors hover:bg-muted/30">
                <td className={cn(tdCls, 'font-mono text-xs')}>{o.orderNo}</td>
                <td className={cn(tdCls, 'font-medium')}>
                  {currencyFmt.format(Number(o.payAmount))}
                </td>
                <td className={tdCls}>
                  <StatusBadge status={o.status} prefix="billingOrderStatus" t={t} />
                </td>
                <td className={cn(tdCls, 'text-muted-foreground')}>
                  {dateFmt.format(new Date(o.createdAt))}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-1 pt-3">
        <span className="text-sm text-muted-foreground">{t('billingTotal', { count: total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('billingPrev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('billingPageInfo', { page, totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {t('billingNext')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
