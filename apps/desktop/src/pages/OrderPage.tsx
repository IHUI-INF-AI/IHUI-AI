import { useEffect, useState } from 'react'
import { getOrders, type Order, type OrderStatus } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  cancelled: '已取消',
  refunding: '退款中',
  refunded: '已退款',
  completed: '已完成',
  failed: '失败',
}

const STATUS_CLASS: Record<OrderStatus, string> = {
  pending: 'status-pending',
  paid: 'status-paid',
  cancelled: 'status-cancelled',
  refunding: 'status-refunding',
  refunded: 'status-refunded',
  completed: 'status-completed',
  failed: 'status-failed',
}

function formatAmount(n: number | undefined | null): string {
  if (typeof n !== 'number') return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function OrderPage() {
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
      else setError(res.error || '加载失败')
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="page page-orders">
        <div className="empty-state">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page page-orders">
        <div className="error-banner">{error}</div>
      </div>
    )
  }

  return (
    <div className="page page-orders">
      <header className="page-header">
        <h2>我的订单</h2>
      </header>
      {orders.length === 0 ? (
        <div className="empty-state">暂无订单</div>
      ) : (
        <div className="order-list">
          {orders.map((o) => (
            <Card key={o.id}>
              <CardHeader>
                <div className="order-header">
                  <CardTitle className="order-title">{o.targetTitle}</CardTitle>
                  <span className={`status-badge ${STATUS_CLASS[o.status] ?? 'status-cancelled'}`}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="order-meta">
                  <span className="order-no">订单号:{o.orderNo}</span>
                  <span className="order-time">
                    {new Intl.DateTimeFormat('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(o.createdAt))}
                  </span>
                </div>
                <div className="order-amount">
                  <span className="amount-label">实付金额</span>
                  <span className={`amount-value ${o.status === 'refunded' ? 'refunded' : 'paid'}`}>
                    ¥ {formatAmount(o.payAmount)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
