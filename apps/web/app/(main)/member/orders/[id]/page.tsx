'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { ArrowLeft, Loader2, Clock, CheckCircle, XCircle, Wallet } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'
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

const STATUS_CONFIG: Record<OrderStatus, { icon: typeof Clock; cls: string; label: string }> = {
  pending: {
    icon: Clock,
    cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
    label: '待支付',
  },
  paid: {
    icon: CheckCircle,
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
    label: '已支付',
  },
  cancelled: {
    icon: XCircle,
    cls: 'bg-red-500/10 text-red-600 dark:text-red-500',
    label: '已取消',
  },
  refunded: { icon: Wallet, cls: 'bg-primary/10 text-primary', label: '已退款' },
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between px-4 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-right', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  )
}

export default function MemberOrderDetailPage() {
  const locale = useLocale()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const qc = useQueryClient()

  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['member', 'order', params.id],
    queryFn: async () => {
      const r = await fetchApi<{ order: Order }>(`/api/orders/${params.id}`)
      if (!r.success) throw new Error(r.error)
      return r.data.order
    },
    enabled: !!params.id,
  })

  const cancelMut = useMutation({
    mutationFn: async () => {
      const r = await fetchApi(`/api/orders/${params.id}/cancel`, { method: 'POST' })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member', 'order', params.id] }),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const currencyFmt = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          返回
        </Button>
        <Alert variant="danger" description={(error as Error)?.message ?? '订单不存在'} />
      </div>
    )
  }

  const sc = STATUS_CONFIG[order.status]
  const StatusIcon = sc.icon

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        返回
      </Button>

      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">订单详情</h1>
        <p className="font-mono text-xs text-muted-foreground">{order.orderNo}</p>
      </div>

      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium',
          sc.cls,
        )}
      >
        <StatusIcon className="h-4 w-4" />
        {sc.label}
      </span>

      <dl className="divide-y rounded-lg border">
        <Row label="订单号" value={order.orderNo} mono />
        <Row label="商品名称" value={order.targetTitle ?? '-'} />
        <Row label="订单类型" value={order.orderType} />
        <Row label="数量" value={order.quantity} />
        <Row label="创建时间" value={dateFmt.format(new Date(order.createdAt))} />
        {order.payTime && <Row label="支付时间" value={dateFmt.format(new Date(order.payTime))} />}
        {order.cancelTime && (
          <Row label="取消时间" value={dateFmt.format(new Date(order.cancelTime))} />
        )}
        {order.refundTime && (
          <Row label="退款时间" value={dateFmt.format(new Date(order.refundTime))} />
        )}
        {order.payType && <Row label="支付方式" value={order.payType} />}
        {order.remark && <Row label="备注" value={order.remark} />}
      </dl>

      <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">原价</span>
          <span>{currencyFmt.format(Number(order.originalPrice))}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">优惠</span>
          <span className="text-emerald-600 dark:text-emerald-500">
            -{currencyFmt.format(Number(order.discountAmount))}
          </span>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>实付</span>
          <span>{currencyFmt.format(Number(order.payAmount))}</span>
        </div>
      </div>

      {order.status === 'pending' && (
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push(`/payment/checkout?order=${order.id}`)}
          >
            去支付
          </Button>
          <Button
            variant="ghost"
            onClick={() => cancelMut.mutate()}
            disabled={cancelMut.isPending}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {cancelMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            取消订单
          </Button>
        </div>
      )}
    </div>
  )
}
