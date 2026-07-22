import { useEffect, useState } from 'react'
import { getOrders, type Order, type OrderStatus } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
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
  }, [])

  if (loading) return <div className="empty-state">{t('common.loading')}</div>
  if (error) return <div className="error-banner">{error}</div>

  return (
    <div className="sp-page">
      <div className="sp-page-header">
        <h3>{t('order.title')}</h3>
      </div>
      {orders.length === 0 ? (
        <div className="empty-state">{t('order.empty')}</div>
      ) : (
        orders.map((o) => (
          <Card key={o.id}>
            <CardHeader>
              <CardTitle>{o.targetTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="sp-order-meta">
                <span className="sp-status">{getStatusLabel(o.status)}</span>
                <span className="sp-time">
                  {new Intl.DateTimeFormat('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(o.createdAt))}
                </span>
              </div>
              <div className="sp-amount">¥ {fmt(o.payAmount)}</div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
