'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, ShoppingCart, CheckCircle, XCircle, Clock, Wallet } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Timeline } from '@/components/data/Timeline'

type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded'

interface Order {
  id: string
  orderNo: string
  orderType: string
  targetTitle?: string | null
  payAmount: string
  status: OrderStatus
  createdAt: string
}

interface OrdersData {
  list: Order[]
  total: number
}

async function fetchOrders(status: string): Promise<OrdersData> {
  const qs = new URLSearchParams()
  if (status !== 'all') qs.set('status', status)
  const res = await fetchApi<OrdersData>(`/api/orders/me?${qs.toString()}`)
  if (!res.success) throw new Error(res.error)
  return res.data
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { icon: React.ComponentType<{ className?: string }>; cls: string; color: string }
> = {
  pending: {
    icon: Clock,
    cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
    color: '#f59e0b',
  },
  paid: {
    icon: CheckCircle,
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
    color: '#10b981',
  },
  cancelled: {
    icon: XCircle,
    cls: 'bg-red-500/10 text-red-600 dark:text-red-500',
    color: '#ef4444',
  },
  refunded: { icon: Wallet, cls: 'bg-primary/10 text-primary', color: '#3b82f6' },
}

const TABS: { value: string; labelKey: 'all' | 'pending' | 'paid' | 'cancelled' | 'refunded' }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'pending', labelKey: 'pending' },
  { value: 'paid', labelKey: 'paid' },
  { value: 'cancelled', labelKey: 'cancelled' },
  { value: 'refunded', labelKey: 'refunded' },
]

export default function OrdersPage() {
  const t = useTranslations('user.orders')
  const locale = useLocale()
  const router = useRouter()
  const [status, setStatus] = React.useState('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['user', 'orders', status],
    queryFn: () => fetchOrders(status),
  })

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
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* 状态筛选 */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.value}
            onClick={() => setStatus(tabItem.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              status === tabItem.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`status.${tabItem.labelKey}`)}
          </button>
        ))}
      </div>

      {/* 订单列表 */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t('orderNo')}</th>
              <th className="px-4 py-2.5 font-medium">{t('plan')}</th>
              <th className="px-4 py-2.5 font-medium">{t('amount')}</th>
              <th className="px-4 py-2.5 font-medium">{t('status')}</th>
              <th className="px-4 py-2.5 font-medium">{t('createdAt')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const sc = STATUS_CONFIG[o.status]
                const StatusIcon = sc.icon
                return (
                  <tr key={o.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">{o.orderNo}</td>
                    <td className="px-4 py-2.5 font-medium">{o.targetTitle ?? o.orderType}</td>
                    <td className="px-4 py-2.5 font-medium">
                      {currencyFmt.format(Number(o.payAmount))}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          sc.cls,
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {t(`status.${o.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {dateFmt.format(new Date(o.createdAt))}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {o.status === 'pending' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/payment/checkout?order=${o.id}`)}
                        >
                          {t('pay')}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/orders/${o.id}`)}
                        >
                          {t('view')}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {orders.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('timelineTitle')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('timelineHint')}</p>
          </CardHeader>
          <CardContent>
            <Timeline
              items={orders.slice(0, 5).map((o) => {
                const sc = STATUS_CONFIG[o.status]
                return {
                  title: `${o.orderNo} · ${o.targetTitle ?? o.orderType}`,
                  description: `${currencyFmt.format(Number(o.payAmount))} · ${t(`status.${o.status}`)}`,
                  time: dateFmt.format(new Date(o.createdAt)),
                  icon: sc.icon,
                  color: sc.color,
                }
              })}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
