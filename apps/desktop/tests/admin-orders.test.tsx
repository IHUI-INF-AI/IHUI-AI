import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { I18nProvider } from '../src/i18n'

const mocks = vi.hoisted(() => ({
  adminGetOrders: vi.fn(),
  updateAdminOrder: vi.fn(),
  adminRefundOrder: vi.fn(),
}))

vi.mock('@ihui/api-client', () => ({
  adminGetOrders: mocks.adminGetOrders,
}))

vi.mock('../src/lib/api/admin-orders', () => ({
  updateAdminOrder: mocks.updateAdminOrder,
  adminRefundOrder: mocks.adminRefundOrder,
}))

vi.mock('../src/components/admin/OrderStatusDialog', () => ({
  OrderStatusDialog: ({ open, onSubmit, onClose }: { open: boolean; onSubmit: (v: { status: string; remark: string }) => void; onClose: () => void }) => {
    if (!open) return null
    return createElement(
      'div',
      { 'data-testid': 'order-status-dialog-stub' },
      createElement(
        'button',
        { 'data-testid': 'order-status-dialog-stub-submit', onClick: () => onSubmit({ status: 'completed', remark: 'ok' }) },
        'submit',
      ),
      createElement('button', { 'data-testid': 'order-status-dialog-stub-close', onClick: onClose }, 'close'),
    )
  },
}))

vi.mock('../src/components/admin/OrderRefundDialog', () => ({
  OrderRefundDialog: ({ open, onSubmit, onClose }: { open: boolean; onSubmit: (reason: string) => void; onClose: () => void }) => {
    if (!open) return null
    return createElement(
      'div',
      { 'data-testid': 'order-refund-dialog-stub' },
      createElement(
        'button',
        { 'data-testid': 'order-refund-dialog-stub-submit', onClick: () => onSubmit('客户主动取消') },
        'submit',
      ),
      createElement('button', { 'data-testid': 'order-refund-dialog-stub-close', onClick: onClose }, 'close'),
    )
  },
}))

import AdminOrders from '../src/pages/admin/AdminOrders'

function wrap(ui: ReactNode) {
  return createElement(I18nProvider, null, ui)
}

const SAMPLE_ORDERS = [
  {
    id: 'o-1',
    orderNo: 'ORD-2026-0001',
    userId: 'u-1',
    userNickname: 'Alice',
    type: 'course',
    targetTitle: 'Vue 3 入门',
    amount: 100,
    payAmount: 100,
    status: 'paid',
    payMethod: 'wechat',
    paidAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'o-2',
    orderNo: 'ORD-2026-0002',
    userId: 'u-2',
    userNickname: 'Bob',
    type: 'vip',
    targetTitle: 'VIP 月卡',
    amount: 30,
    payAmount: 30,
    status: 'refunded',
    payMethod: 'alipay',
    paidAt: '2026-02-01T00:00:00Z',
    createdAt: '2026-02-01T00:00:00Z',
  },
]

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mocks.adminGetOrders.mockResolvedValue({
    success: true,
    data: { list: SAMPLE_ORDERS, total: SAMPLE_ORDERS.length },
  })
})

describe('AdminOrders', () => {
  it('renders the order list with both rows', async () => {
    render(wrap(createElement(AdminOrders)))
    await waitFor(() => expect(screen.getByTestId('admin-orders')).toBeTruthy())
    expect(screen.getByText('ORD-2026-0001')).toBeTruthy()
    expect(screen.getByText('ORD-2026-0002')).toBeTruthy()
  })

  it('opens status dialog and submits updateAdminOrder', async () => {
    mocks.updateAdminOrder.mockResolvedValue({ success: true, data: SAMPLE_ORDERS[0] })
    render(wrap(createElement(AdminOrders)))
    await waitFor(() => expect(screen.getByTestId('admin-orders-row-o-1')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-orders-status-o-1'))
    expect(screen.getByTestId('order-status-dialog-stub')).toBeTruthy()
    fireEvent.click(screen.getByTestId('order-status-dialog-stub-submit'))
    await waitFor(() => expect(mocks.updateAdminOrder).toHaveBeenCalledWith('ORD-2026-0001', { status: 'completed', remark: 'ok' }))
  })

  it('opens refund dialog and submits adminRefundOrder', async () => {
    mocks.adminRefundOrder.mockResolvedValue({ success: true, data: { success: true, orderNo: 'ORD-2026-0001' } })
    render(wrap(createElement(AdminOrders)))
    await waitFor(() => expect(screen.getByTestId('admin-orders-row-o-1')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-orders-refund-o-1'))
    expect(screen.getByTestId('order-refund-dialog-stub')).toBeTruthy()
    fireEvent.click(screen.getByTestId('order-refund-dialog-stub-submit'))
    await waitFor(() => expect(mocks.adminRefundOrder).toHaveBeenCalledWith('ORD-2026-0001', '客户主动取消'))
  })

  it('disables refund button for already refunded orders', async () => {
    render(wrap(createElement(AdminOrders)))
    await waitFor(() => expect(screen.getByTestId('admin-orders-row-o-2')).toBeTruthy())
    const refundBtn = screen.getByTestId('admin-orders-refund-o-2') as HTMLButtonElement
    expect(refundBtn.disabled).toBe(true)
  })

  it('shows an action error when update fails', async () => {
    mocks.updateAdminOrder.mockResolvedValue({ success: false, error: '权限不足' })
    render(wrap(createElement(AdminOrders)))
    await waitFor(() => expect(screen.getByTestId('admin-orders-row-o-1')).toBeTruthy())
    fireEvent.click(screen.getByTestId('admin-orders-status-o-1'))
    fireEvent.click(screen.getByTestId('order-status-dialog-stub-submit'))
    await waitFor(() => expect(screen.getByTestId('admin-orders-action-error').textContent).toContain('权限不足'))
  })
})
