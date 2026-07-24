import { useEffect, useState } from 'react'
import { getOrders, type Order, type OrderStatus } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

function fmt(n: number | undefined | null): string {
  if (typeof n !== 'number') return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function OrderPage() {
  const { t } = useI18n()
  const getStatusLabel = (status: OrderStatus) => {
    const map: Record<OrderStatus, string> = {
      pending: t('order.statusPending'),
      paid: t('order.statusPaid'),
      cancelled: t('order.statusCancelled'),
      refunding: t('order.statusRefunding'),
      refunded: t('order.statusRefunded'),
      completed: t('order.statusCompleted'),
      failed: t('order.statusFailed'),
    }
    return map[status] ?? status
  }
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getOrders({ page: 1, pageSize: 20 })
      if (cancelled) return
      if (res.success) setOrders(res.data.list)
      else setError(res.error || t('order.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8 px-4 text-sm">
        {t('common.loading')}
      </div>
    )
  }
  if (error) {
    return (
      <div className="bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive m-2 text-xs">
        {error}
      </div>
    )
  }

  return (
    <div className="p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('order.title')}</h3>
      </div>
      {orders.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('order.empty')}
        </div>
      ) : (
        orders.map((o) => (
          <Card key={o.id}>
            <CardHeader>
              <CardTitle>{o.targetTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{getStatusLabel(o.status)}</span>
                <span>
                  {new Intl.DateTimeFormat('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(o.createdAt))}
                </span>
              </div>
              <div className="text-sm font-semibold tabular-nums mt-1">¥ {fmt(o.payAmount)}</div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
