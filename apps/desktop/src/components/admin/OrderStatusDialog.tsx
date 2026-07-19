/**
 * OrderStatusDialog — 订单状态变更弹窗。
 *
 * 输入:
 *  - 当前订单(展示订单号 + 当前状态)
 *  - 目标 status(可切换 7 个状态值)
 *  - 可选 remark(管理员备注)
 */
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { AdminDialog, AdminDialogActions } from './AdminDialog'
import type { AdminOrder } from '@ihui/api-client'

export const ORDER_STATUSES = [
  'pending',
  'paid',
  'completed',
  'cancelled',
  'refunding',
  'refunded',
  'failed',
] as const

export type OrderStatusValue = (typeof ORDER_STATUSES)[number]

export interface OrderStatusDialogProps {
  open: boolean
  order: AdminOrder | null
  submitting?: boolean
  onClose: () => void
  onSubmit: (input: { status: OrderStatusValue; remark: string }) => void | Promise<void>
}

function statusLabelKey(s: string): string {
  return `admin.orders.status${s.charAt(0).toUpperCase()}${s.slice(1)}`
}

export function OrderStatusDialog({ open, order, submitting, onClose, onSubmit }: OrderStatusDialogProps) {
  const { t } = useI18n()
  const [status, setStatus] = useState<OrderStatusValue>('paid')
  const [remark, setRemark] = useState('')

  useEffect(() => {
    if (open && order) {
      const next: OrderStatusValue = (ORDER_STATUSES as readonly string[]).includes(order.status)
        ? (order.status as OrderStatusValue)
        : 'paid'
      setStatus(next)
      setRemark('')
    }
  }, [open, order])

  const submit = () => {
    void onSubmit({ status, remark: remark.trim() })
  }

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title={t('admin.orders.statusDialogTitle')}
      testId="order-status-dialog"
      size="sm"
      footer={
        <AdminDialogActions
          onCancel={onClose}
          onSubmit={submit}
          submitLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          submitting={submitting}
          submitTestId="order-status-dialog-submit"
          cancelTestId="order-status-dialog-cancel"
        />
      }
    >
      <div className="admin-form">
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.orders.colOrderNo')}</label>
          <div className="admin-mono" data-testid="order-status-dialog-orderno">
            {order?.orderNo ?? '—'}
          </div>
        </div>
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.orders.colStatus')}</label>
          <div>
            <span
              className={`admin-badge ${order?.status === 'paid' || order?.status === 'completed' ? 'admin-badge-ok' : order?.status === 'pending' || order?.status === 'refunding' ? 'admin-badge-warn' : 'admin-badge-muted'}`}
            >
              {order ? t(statusLabelKey(order.status)) : '—'}
            </span>
          </div>
        </div>
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.orders.statusNew')}</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatusValue)}
            data-testid="order-status-dialog-status"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(statusLabelKey(s))}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.orders.statusRemark')}</label>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder={t('admin.orders.statusRemarkPlaceholder')}
            data-testid="order-status-dialog-remark"
            rows={3}
          />
        </div>
      </div>
    </AdminDialog>
  )
}
