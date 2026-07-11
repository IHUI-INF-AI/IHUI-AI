'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ShoppingCart } from 'lucide-react'
import type { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  type EduOrder,
  type OrderStatus,
  type PageData,
  api,
  PAGE_SIZE,
  ORDER_STATUS_CFG,
} from './types'
import { Pagination } from './Pagination'

const ORDER_STATUS_TABS: { value: string; labelKey: 'all' | OrderStatus }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'pending', labelKey: 'pending' },
  { value: 'paid', labelKey: 'paid' },
  { value: 'cancelled', labelKey: 'cancelled' },
  { value: 'refunded', labelKey: 'refunded' },
]

export function OrdersTab({
  t,
  dateFmt,
  currencyFmt,
}: {
  t: ReturnType<typeof useTranslations<'admin.orders'>>
  dateFmt: Intl.DateTimeFormat
  currencyFmt: Intl.NumberFormat
}) {
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'orders', status, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (status !== 'all') qs.set('status', status)
      return api<PageData<EduOrder>>(`/api/admin/orders?${qs.toString()}`)
    },
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const orders = data?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {ORDER_STATUS_TABS.map((tb) => (
          <button
            key={tb.value}
            onClick={() => {
              setStatus(tb.value)
              setPage(1)
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              status === tb.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`status_${tb.labelKey}`)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t('orderNo')}</th>
              <th className="px-4 py-2.5 font-medium">{t('orderType')}</th>
              <th className="px-4 py-2.5 font-medium">{t('target')}</th>
              <th className="px-4 py-2.5 font-medium">{t('amount')}</th>
              <th className="px-4 py-2.5 font-medium">{t('payType')}</th>
              <th className="px-4 py-2.5 font-medium">{t('status')}</th>
              <th className="px-4 py-2.5 font-medium">{t('createdAt')}</th>
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
                  {(error as Error).message}
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const sc = ORDER_STATUS_CFG[o.status]
                return (
                  <tr key={o.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">{o.orderNo}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {t(`type_${o.orderType === 'course' ? 'course' : 'card'}`)}
                      </span>
                    </td>
                    <td className="max-w-xs break-words px-4 py-2.5">{o.targetTitle ?? '-'}</td>
                    <td className="px-4 py-2.5 font-medium">
                      {currencyFmt.format(Number(o.payAmount))}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{o.payType ?? '-'}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          sc.cls,
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                        {t(`status_${o.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {dateFmt.format(new Date(o.createdAt))}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} setPage={setPage} t={t} />
    </div>
  )
}
