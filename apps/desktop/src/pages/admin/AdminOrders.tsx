/**
 * AdminOrders — 订单管理列表(只读)。
 * 数据源:`adminGetOrders({ page, pageSize, status, type, keyword })`。
 */
import { useEffect, useMemo, useState } from 'react'
import { adminGetOrders, type AdminOrder } from '@ihui/api-client'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ihui/ui'

const STATUS_LABEL: Record<string, string> = {
  pending: '待支付',
  paid: '已支付',
  completed: '已完成',
  cancelled: '已取消',
  refunding: '退款中',
  refunded: '已退款',
  failed: '失败',
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'admin-badge-warn',
  paid: 'admin-badge-ok',
  completed: 'admin-badge-ok',
  cancelled: 'admin-badge-muted',
  refunding: 'admin-badge-warn',
  refunded: 'admin-badge-muted',
  failed: 'admin-badge-error',
}

function formatAmount(n: number | null | undefined): string {
  if (typeof n !== 'number') return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const params = useMemo(
    () => ({
      page,
      pageSize,
      keyword: keyword.trim() || undefined,
    }),
    [page, pageSize, keyword],
  )

  const load = () => {
    setLoading(true)
    setError('')
    void (async () => {
      const res = await adminGetOrders(params)
      if (res.success) {
        setOrders(res.data.list)
        setTotal(res.data.total)
      } else {
        setError(res.error || '加载失败')
      }
      setLoading(false)
    })()
  }

  useEffect(() => {
    load()
  }, [params])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="admin-page" data-testid="admin-orders">
      <header className="admin-page-header">
        <h2>订单管理</h2>
        <div className="admin-toolbar">
          <input
            type="search"
            placeholder="搜索订单号/用户"
            value={keyword}
            onChange={(e) => {
              setPage(1)
              setKeyword(e.target.value)
            }}
            className="admin-search"
            data-testid="admin-orders-search"
          />
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>
            订单列表 <span className="admin-muted">共 {total} 条</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="empty-state">加载中...</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">暂无订单</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>订单号</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>标的</TableHead>
                  <TableHead className="admin-num">金额(元)</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="admin-mono">{o.orderNo}</TableCell>
                    <TableCell>{o.userNickname || '—'}</TableCell>
                    <TableCell>{o.type}</TableCell>
                    <TableCell>{o.targetTitle || '—'}</TableCell>
                    <TableCell className="admin-num">¥ {formatAmount(o.payAmount)}</TableCell>
                    <TableCell>
                      <span className={`admin-badge ${STATUS_CLASS[o.status] ?? 'admin-badge-muted'}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </TableCell>
                    <TableCell className="admin-muted">
                      {new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(o.createdAt))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          上一页
        </button>
        <span>
          第 {page} / {totalPages} 页
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  )
}
