/**
 * AdminOrders — 订单管理(列表 + 状态变更 + 退款)。
 *
 * 数据源:`adminGetOrders`(GET) + `updateAdminOrder`/`adminRefundOrder`(本地 lib/api 扩展)。
 */
import { useMemo, useState } from 'react'
import {
  adminGetOrders,
  type AdminOrder,
  type PageData,
} from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'
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
import { useAdminCrud } from '../../hooks/use-admin-crud'
import { useI18n } from '../../i18n'
import { updateAdminOrder, adminRefundOrder } from '../../lib/api/admin-orders'
import { OrderStatusDialog, type OrderStatusValue } from '../../components/admin/OrderStatusDialog'
import { OrderRefundDialog } from '../../components/admin/OrderRefundDialog'

const DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' })

interface OrderListParams {
  page: number
  pageSize: number
  keyword: string | undefined
  [key: string]: string | number | undefined | null
}

function formatAmount(n: number | null | undefined): string {
  if (typeof n !== 'number') return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function statusLabelKey(s: string): string {
  return `admin.orders.status${s.charAt(0).toUpperCase()}${s.slice(1)}`
}

function statusClass(s: string): string {
  if (s === 'paid' || s === 'completed') return 'admin-badge-ok'
  if (s === 'pending' || s === 'refunding') return 'admin-badge-warn'
  if (s === 'failed') return 'admin-badge-error'
  return 'admin-badge-muted'
}

export default function AdminOrders() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [statusOrder, setStatusOrder] = useState<AdminOrder | null>(null)
  const [refundOrderState, setRefundOrder] = useState<AdminOrder | null>(null)
  const [actionError, setActionError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const params = useMemo<OrderListParams>(
    () => ({
      page,
      pageSize,
      keyword: keyword.trim() || undefined,
    }),
    [page, pageSize, keyword],
  )

  const { rows, total, loading, error, reload, mutate } = useAdminCrud<OrderListParams, AdminOrder>({
    fetcher: async (p) => {
      const res: ApiResult<PageData<AdminOrder>> = await adminGetOrders(p)
      if (!res.success) throw new Error(res.error || t('admin.common.loadFailed'))
      return { list: res.data.list, total: res.data.total }
    },
    params,
  })

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const openStatus = (o: AdminOrder) => {
    setStatusOrder(o)
    setActionError('')
  }

  const openRefund = (o: AdminOrder) => {
    setRefundOrder(o)
    setActionError('')
  }

  const handleStatusSubmit = async (input: { status: OrderStatusValue; remark: string }) => {
    if (!statusOrder) return
    setActionError('')
    setSuccessMessage('')
    try {
      const res = await updateAdminOrder(statusOrder.orderNo, input)
      if (!res.success) {
        setActionError(res.error || t('admin.orders.changeStatusSuccess').replace('已更新', '失败'))
        return
      }
      setSuccessMessage(t('admin.orders.changeStatusSuccess'))
      setStatusOrder(null)
      await mutate(async () => Promise.resolve())
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '操作失败')
    }
  }

  const handleRefundSubmit = async (reason: string) => {
    if (!refundOrderState) return
    setActionError('')
    setSuccessMessage('')
    try {
      const res = await adminRefundOrder(refundOrderState.orderNo, reason)
      if (!res.success) {
        setActionError(res.error || t('admin.orders.refundSuccess').replace('成功', '失败'))
        return
      }
      setSuccessMessage(t('admin.orders.refundSuccess'))
      setRefundOrder(null)
      await mutate(async () => Promise.resolve())
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '操作失败')
    }
  }

  return (
    <div className="admin-page" data-testid="admin-orders">
      <header className="admin-page-header">
        <h2>{t('admin.orders.title')}</h2>
        <div className="admin-toolbar">
          <input
            type="search"
            placeholder={t('admin.orders.searchPlaceholder')}
            value={keyword}
            onChange={(e) => {
              setPage(1)
              setKeyword(e.target.value)
            }}
            className="admin-search"
            data-testid="admin-orders-search"
          />
          <button type="button" className="admin-refresh-btn" onClick={reload} data-testid="admin-orders-refresh">
            {t('admin.common.refresh')}
          </button>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}
      {actionError ? <div className="error-banner" data-testid="admin-orders-action-error">{actionError}</div> : null}
      {successMessage ? (
        <div className="admin-muted" data-testid="admin-orders-success" style={{ marginLeft: 0 }}>
          {successMessage}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            {t('admin.orders.title')}{' '}
            <span className="admin-muted">{t('admin.common.totalCount', { count: total })}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="empty-state">{t('common.loading')}</div>
          ) : rows.length === 0 ? (
            <div className="empty-state">{t('admin.common.noData')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.orders.colOrderNo')}</TableHead>
                  <TableHead>{t('admin.orders.colUser')}</TableHead>
                  <TableHead>{t('admin.orders.colType')}</TableHead>
                  <TableHead>{t('admin.orders.colTarget')}</TableHead>
                  <TableHead className="admin-num">{t('admin.orders.colAmount')}</TableHead>
                  <TableHead>{t('admin.orders.colStatus')}</TableHead>
                  <TableHead>{t('admin.orders.colCreatedAt')}</TableHead>
                  <TableHead>{t('admin.orders.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => (
                  <TableRow key={o.id} data-testid={`admin-orders-row-${o.id}`}>
                    <TableCell className="admin-mono">{o.orderNo}</TableCell>
                    <TableCell>{o.userNickname || '—'}</TableCell>
                    <TableCell>{o.type}</TableCell>
                    <TableCell>{o.targetTitle || '—'}</TableCell>
                    <TableCell className="admin-num">¥ {formatAmount(o.payAmount)}</TableCell>
                    <TableCell>
                      <span className={`admin-badge ${statusClass(o.status)}`}>
                        {t(statusLabelKey(o.status))}
                      </span>
                    </TableCell>
                    <TableCell className="admin-muted">{DATE_FORMATTER.format(new Date(o.createdAt))}</TableCell>
                    <TableCell>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          onClick={() => openStatus(o)}
                          data-testid={`admin-orders-status-${o.id}`}
                        >
                          {t('admin.orders.changeStatus')}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => openRefund(o)}
                          data-testid={`admin-orders-refund-${o.id}`}
                          disabled={o.status === 'refunded' || o.status === 'refunding'}
                        >
                          {t('admin.orders.refund')}
                        </button>
                      </div>
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
          {t('admin.common.prevPage')}
        </button>
        <span>{t('admin.common.pageIndicator', { page, total: totalPages })}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          {t('admin.common.nextPage')}
        </button>
      </div>

      <OrderStatusDialog
        open={statusOrder !== null}
        order={statusOrder}
        onClose={() => setStatusOrder(null)}
        onSubmit={handleStatusSubmit}
      />
      <OrderRefundDialog
        open={refundOrderState !== null}
        order={refundOrderState}
        onClose={() => setRefundOrder(null)}
        onSubmit={handleRefundSubmit}
      />
    </div>
  )
}
