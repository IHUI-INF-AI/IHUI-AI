'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowLeft, Loader2, CheckCircle, XCircle, Clock, Wallet } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'

type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded'

interface Order {
  id: string
  orderNo: string
  orderType: string
  targetTitle?: string | null
  quantity: number
  originalPrice: string
  discountAmount: string
  payAmount: string
  payType?: string | null
  status: OrderStatus
  payTime?: string | null
  cancelTime?: string | null
  refundTime?: string | null
  remark?: string | null
  createdAt: string
}

interface OrderDetailData {
  order: Order
}

const STATUS_CONFIG: Record<OrderStatus, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  pending: { icon: Clock, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500' },
  paid: { icon: CheckCircle, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
  cancelled: { icon: XCircle, cls: 'bg-red-500/10 text-red-600 dark:text-red-500' },
  refunded: { icon: Wallet, cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-500' },
}

async function fetchOrder(id: string): Promise<Order> {
  const res = await fetchApi<OrderDetailData>(`/api/orders/${id}`)
  if (!res.success) throw new Error(res.error)
  return res.data.order
}

export default function OrderDetailPage() {
  const t = useTranslations('orders')
  const tc = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const qc = useQueryClient()

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', params.id],
    queryFn: () => fetchOrder(params.id),
    enabled: !!params.id,
  })

  const cancelMut = useMutation({
    mutationFn: async () => {
      const res = await fetchApi(`/api/orders/${params.id}/cancel`, { method: 'POST' })
      if (!res.success) throw new Error(res.error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['order', params.id] }),
  })

  const currencyFmt = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {tc('back')}
        </Button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('empty')}
        </div>
      </div>
    )
  }

  const sc = STATUS_CONFIG[order.status]
  const StatusIcon = sc.icon

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        {tc('back')}
      </Button>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{order.orderNo}</p>
      </div>

      <div className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium', sc.cls)}>
        <StatusIcon className="h-4 w-4" />
        {t(`status.${order.status}`)}
      </div>

      <dl className="divide-y rounded-lg border">
        <div className="flex justify-between px-4 py-3 text-sm">
          <dt className="text-muted-foreground">{t('orderNo')}</dt>
          <dd className="font-mono">{order.orderNo}</dd>
        </div>
        <div className="flex justify-between px-4 py-3 text-sm">
          <dt className="text-muted-foreground">{t('target')}</dt>
          <dd className="font-medium">{order.targetTitle ?? '-'}</dd>
        </div>
        <div className="flex justify-between px-4 py-3 text-sm">
          <dt className="text-muted-foreground">{t('orderType')}</dt>
          <dd>{t(`type.${order.orderType}`, { default: order.orderType })}</dd>
        </div>
        <div className="flex justify-between px-4 py-3 text-sm">
          <dt className="text-muted-foreground">{t('createdAt')}</dt>
          <dd>{dateFmt.format(new Date(order.createdAt))}</dd>
        </div>
        {order.payTime && (
          <div className="flex justify-between px-4 py-3 text-sm">
            <dt className="text-muted-foreground">{tc('payTime')}</dt>
            <dd>{dateFmt.format(new Date(order.payTime))}</dd>
          </div>
        )}
        {order.cancelTime && (
          <div className="flex justify-between px-4 py-3 text-sm">
            <dt className="text-muted-foreground">{tc('cancelTime')}</dt>
            <dd>{dateFmt.format(new Date(order.cancelTime))}</dd>
          </div>
        )}
        {order.refundTime && (
          <div className="flex justify-between px-4 py-3 text-sm">
            <dt className="text-muted-foreground">{tc('refundTime')}</dt>
            <dd>{dateFmt.format(new Date(order.refundTime))}</dd>
          </div>
        )}
        {order.remark && (
          <div className="flex justify-between px-4 py-3 text-sm">
            <dt className="text-muted-foreground">{tc('remark')}</dt>
            <dd>{order.remark}</dd>
          </div>
        )}
      </dl>

      <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{tc('originalPrice')}</span>
          <span>{currencyFmt.format(Number(order.originalPrice))}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{tc('discountAmount')}</span>
          <span className="text-emerald-600 dark:text-emerald-500">-{currencyFmt.format(Number(order.discountAmount))}</span>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>{t('amount')}</span>
          <span>{currencyFmt.format(Number(order.payAmount))}</span>
        </div>
      </div>

      {order.status === 'pending' && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push(`/payment/checkout?order=${order.id}`)}>
            {t('pay')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => cancelMut.mutate()}
            disabled={cancelMut.isPending}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {cancelMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {tc('cancel')}
          </Button>
        </div>
      )}
    </div>
  )
}
