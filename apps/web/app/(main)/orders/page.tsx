'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { ShoppingCart, Loader2, Clock, CheckCircle, XCircle, Wallet, ChevronLeft, ChevronRight } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { cn } from '@/lib/utils'

type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded'

interface OrderItem {
  id: string
  orderNo: string
  orderType: string
  targetTitle: string | null
  payAmount: string
  status: OrderStatus
  createdAt: string
}

interface OrdersData {
  list: OrderItem[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function fetchOrders(params: { page: number; status: string; orderType: string }): Promise<OrdersData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.status !== 'all') qs.set('status', params.status)
  if (params.orderType !== 'all') qs.set('orderType', params.orderType)
  return api<OrdersData>(`/api/orders/me?${qs.toString()}`)
}

const STATUS_CONFIG: Record<OrderStatus, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  pending: { icon: Clock, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500' },
  paid: { icon: CheckCircle, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  cancelled: { icon: XCircle, cls: 'bg-red-500/10 text-red-600 dark:text-red-500' },
  refunded: { icon: Wallet, cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-500' },
}

const STATUS_TABS: { value: string; labelKey: 'all' | 'pending' | 'paid' | 'cancelled' | 'refunded' }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'pending', labelKey: 'pending' },
  { value: 'paid', labelKey: 'paid' },
  { value: 'cancelled', labelKey: 'cancelled' },
  { value: 'refunded', labelKey: 'refunded' },
]

const TYPE_TABS: { value: string; labelKey: 'all' | 'course' | 'card' }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'course', labelKey: 'course' },
  { value: 'card', labelKey: 'card' },
]

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function OrdersPage() {
  const t = useTranslations('orders')
  const locale = useLocale()
  const [status, setStatus] = React.useState('all')
  const [orderType, setOrderType] = React.useState('all')
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', 'me', status, orderType, page],
    queryFn: () => fetchOrders({ page, status, orderType }),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const orders = data?.list ?? []
  const currencyFmt = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <ShoppingCart className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={orderType} onValueChange={(v) => { setOrderType(v); setPage(1) }}>
          <SelectTrigger className={selectClass} aria-label={t('orderType')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_TABS.map((tab) => (
              <SelectItem key={tab.value} value={tab.value}>{t(`type.${tab.labelKey}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatus(tab.value); setPage(1) }}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                status === tab.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`status.${tab.labelKey}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t('orderNo')}</th>
              <th className="px-4 py-2.5 font-medium">{t('target')}</th>
              <th className="px-4 py-2.5 font-medium">{t('amount')}</th>
              <th className="px-4 py-2.5 font-medium">{t('statusLabel')}</th>
              <th className="px-4 py-2.5 font-medium">{t('createdAt')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('empty')}
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const sc = STATUS_CONFIG[o.status]
                const StatusIcon = sc.icon
                return (
                  <tr key={o.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">{o.orderNo}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{o.targetTitle ?? '-'}</div>
                      <div className="text-xs text-muted-foreground">{t(`type.${o.orderType === 'course' ? 'course' : 'card'}`)}</div>
                    </td>
                    <td className="px-4 py-2.5 font-medium">{currencyFmt.format(Number(o.payAmount))}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', sc.cls)}>
                        <StatusIcon className="h-3 w-3" />
                        {t(`status.${o.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{dateFmt.format(new Date(o.createdAt))}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
