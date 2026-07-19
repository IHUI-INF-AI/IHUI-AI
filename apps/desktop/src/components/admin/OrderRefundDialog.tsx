/**
 * OrderRefundDialog — 订单退款弹窗。
 *
 * 输入:订单 + 退款原因(必填,≥5 字)
 */
import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { AdminDialog, AdminDialogActions } from './AdminDialog'
import type { AdminOrder } from '@ihui/api-client'

export interface OrderRefundDialogProps {
  open: boolean
  order: AdminOrder | null
  submitting?: boolean
  onClose: () => void
  onSubmit: (reason: string) => void | Promise<void>
}

export function OrderRefundDialog({ open, order, submitting, onClose, onSubmit }: OrderRefundDialogProps) {
  const { t } = useI18n()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setReason('')
      setError('')
    }
  }, [open])

  const submit = () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      setError(t('admin.orders.refundReasonRequired'))
      return
    }
    if (trimmed.length < 5) {
      setError(t('admin.orders.refundReasonTooShort'))
      return
    }
    setError('')
    void onSubmit(trimmed)
  }

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title={t('admin.orders.refundDialogTitle')}
      testId="order-refund-dialog"
      size="sm"
      footer={
        <AdminDialogActions
          onCancel={onClose}
          onSubmit={submit}
          submitLabel={t('admin.orders.refund')}
          cancelLabel={t('common.cancel')}
          submitting={submitting}
          submitTestId="order-refund-dialog-submit"
          cancelTestId="order-refund-dialog-cancel"
        />
      }
    >
      <div className="admin-form">
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.orders.colOrderNo')}</label>
          <div className="admin-mono" data-testid="order-refund-dialog-orderno">
            {order?.orderNo ?? '—'}
          </div>
        </div>
        <div className="admin-form-field">
          <label className="admin-form-label">{t('admin.orders.refundReason')}</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('admin.orders.refundReasonPlaceholder')}
            data-testid="order-refund-dialog-reason"
            rows={4}
          />
          {error ? <div className="admin-form-error">{error}</div> : null}
        </div>
      </div>
    </AdminDialog>
  )
}
