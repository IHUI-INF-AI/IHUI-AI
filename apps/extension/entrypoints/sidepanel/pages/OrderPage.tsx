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

function fmt(n: number | undefined | null): string {
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

  if (loading) return <div className="empty-state">加载中...</div>
  if (error) return <div className="error-banner">{error}</div>

  return (
    <div className="sp-page">
      <div className="sp-page-header">
        <h3>我的订单</h3>
      </div>
      {orders.length === 0 ? (
        <div className="empty-state">暂无订单</div>
      ) : (
        orders.map((o) => (
          <Card key={o.id}>
            <CardHeader>
              <CardTitle>{o.targetTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="sp-order-meta">
                <span className="sp-status">{STATUS_LABEL[o.status] ?? o.status}</span>
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
