'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, CheckCircle2, XCircle, Clock, ArrowLeft } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface OrderInfo {
  orderNo: string
  type: string
  targetTitle: string
  payAmount: number
  status: string
  payMethod: string | null
  paidAt: string | null
  createdAt: string
}

interface PayStatus {
  status?: string
  paid?: boolean
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function PaymentConfirmContent() {
  const tCommon = useTranslations('common')
  const t = useTranslations('learnPaymentConfirmPage')
  const locale = useLocale()
  const router = useRouter()
  const sp = useSearchParams()
  const orderNo = sp.get('orderNo') ?? ''

  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ['order', orderNo],
    queryFn: () => api<OrderInfo>(`/api/orders/${orderNo}`),
    enabled: !!orderNo,
    retry: false,
  })

  const [payState, setPayState] = React.useState<'pending' | 'paid' | 'failed' | 'cancelled'>(
    'pending',
  )
  const [polling, setPolling] = React.useState(true)

  // 已完成订单(从订单列表跳过来)直接进入终态,跳过轮询
  const initialOrderStatus = order?.status
  React.useEffect(() => {
    if (!order) return
    if (initialOrderStatus === 'paid' || initialOrderStatus === 'completed') {
      setPayState('paid')
      setPolling(false)
    } else if (initialOrderStatus === 'failed') {
      setPayState('failed')
      setPolling(false)
    } else if (initialOrderStatus === 'cancelled') {
      setPayState('cancelled')
      setPolling(false)
    }
  }, [order, initialOrderStatus])

  React.useEffect(() => {
    if (!orderNo || !polling) return
    let cancelled = false
    const poll = async () => {
      try {
        const r = await fetchApi<PayStatus>(`/api/payments/wechat/status/${orderNo}`)
        if (cancelled || !r.success || !r.data) return
        const s = (r.data.status ?? '').toLowerCase()
        if (r.data.paid || s === 'paid' || s === 'completed') {
          setPayState('paid')
          setPolling(false)
        } else if (s === 'failed' || s === 'cancelled') {
          setPayState(s as 'failed' | 'cancelled')
          setPolling(false)
        }
      } catch {
        // ignore transient polling errors
      }
    }
    poll()
    const tm = setInterval(poll, 3000)
    return () => {
      cancelled = true
      clearInterval(tm)
    }
  }, [orderNo, polling])

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  if (!orderNo)
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {t('missingOrderNo')}
        </div>
        <Link
          href="/learn"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('back')}
        </Link>
      </div>
    )

  if (orderLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loadingOrder')}
      </div>
    )

  const isPaid = payState === 'paid' || order?.status === 'paid' || order?.status === 'completed'
  const isFailed = payState === 'failed' || order?.status === 'failed'
  const isCancelled = payState === 'cancelled' || order?.status === 'cancelled'
  const isPending = !isPaid && !isFailed && !isCancelled

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/learn"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tCommon('back')}
      </Link>

      <Card>
        <CardHeader className="text-center">
          <div
            className={cn(
              'mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl',
              isPaid
                ? 'bg-emerald-500/10 text-emerald-600'
                : isPending
                  ? 'bg-primary/10 text-primary'
                  : 'bg-destructive/10 text-destructive',
            )}
          >
            {isPaid ? (
              <CheckCircle2 className="h-7 w-7" />
            ) : isPending ? (
              <Clock className="h-7 w-7 animate-pulse" />
            ) : (
              <XCircle className="h-7 w-7" />
            )}
          </div>
          <CardTitle className="text-xl">
            {isPaid
              ? t('statusPaid')
              : isFailed
                ? t('statusFailed')
                : isCancelled
                  ? t('statusCancelled')
                  : t('statusPending')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isPaid
              ? t('descPaid')
              : isPending
                ? t('descPending')
                : t('descFailed')}
          </p>
        </CardHeader>

        {order && (
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('fields.orderNo')}</span>
              <span className="font-mono text-xs">{order.orderNo}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('fields.product')}</span>
              <span className="max-w-[60%] truncate text-right">{order.targetTitle || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('fields.payMethod')}</span>
              <span>{order.payMethod ?? '-'}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="font-medium">{t('fields.payAmount')}</span>
              <span className="text-lg font-semibold text-primary">¥{order.payAmount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('fields.createdAt')}</span>
              <span>{fmt(order.createdAt)}</span>
            </div>
            {order.paidAt && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t('fields.paidAt')}</span>
                <span>{fmt(order.paidAt)}</span>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <div className="flex items-center justify-center gap-3">
        {isPaid ? (
          <>
            <Button onClick={() => router.push('/learn')}>{t('actions.backToLearn')}</Button>
            <Button variant="outline" onClick={() => router.push('/orders')}>
              {t('actions.viewOrders')}
            </Button>
          </>
        ) : isPending ? (
          <Button variant="outline" onClick={() => setPolling(false)}>
            {t('actions.cancelPolling')}
          </Button>
        ) : (
          <>
            <Button onClick={() => router.push('/learn')}>{t('actions.repurchase')}</Button>
            <Button variant="outline" onClick={() => router.push('/orders')}>
              {t('actions.viewOrders')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default function PaymentConfirmPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" />
        </div>
      }
    >
      <PaymentConfirmContent />
    </React.Suspense>
  )
}
