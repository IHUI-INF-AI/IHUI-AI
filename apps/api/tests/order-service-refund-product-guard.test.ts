// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-4: refundOrder 与充值侧共用 productId 守卫。
 * orderType=2 既是自定义金额充值(productId 空,支付时 rechargeToken),
 * 也是 VIP 购买(productId=vipLevelId,支付时不入账)。
 * 退款只扣回真正入过账的 token。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Order } from '@ihui/database'

const mocks = vi.hoisted(() => ({
  findOrderByNo: vi.fn<(orderNo: string) => Promise<Order | undefined>>(),
  updateOrderStatus:
    vi.fn<(orderNo: string, status: string, fromStatus?: string) => Promise<Order | undefined>>(),
  refundTokenDeduct:
    vi.fn<
      (userId: string, quantity: number, orderNo: string, remark?: string) => Promise<number>
    >(),
}))

vi.mock('../src/db/index.js', () => {
  const chain = (): Record<string, unknown> => {
    const c: Record<string, unknown> = {}
    for (const method of ['from', 'where', 'limit', 'orderBy', 'set', 'values', 'returning']) {
      c[method] = () => c
    }
    c.then = (resolve: (rows: unknown[]) => unknown) => Promise.resolve(resolve([]))
    return c
  }
  const stub: Record<string, unknown> = {
    select: () => chain(),
    insert: () => chain(),
    update: () => chain(),
    delete: () => chain(),
    execute: async () => [],
  }
  stub.transaction = async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => fn(stub)
  return { db: stub, dbRead: stub }
})

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../src/db/payment-queries.js', () => ({
  createOrder: vi.fn(),
  findOrderByNo: mocks.findOrderByNo,
  updateOrderStatus: mocks.updateOrderStatus,
  queryPendingOrders: vi.fn(),
  listPaidOrdersByDate: vi.fn(),
}))

vi.mock('../src/db/commission-queries.js', () => ({
  rechargeToken: vi.fn(),
  deductToken: vi.fn(),
  refundTokenDeduct: mocks.refundTokenDeduct,
}))

vi.mock('../src/services/points-service.js', () => ({
  earnPoints: vi.fn(),
  spendPoints: vi.fn(),
}))

vi.mock('../src/utils/outbox.js', () => ({
  writeToOutbox: vi.fn(),
}))

vi.mock('../src/services/topup-discount-service.js', () => ({
  calculateTopupBonus: vi.fn(),
}))

vi.mock('../src/services/edu-ledger.js', () => ({
  recordPayment: vi.fn(),
}))

import { refundOrder } from '../src/services/order-service.js'

const USER_ID = '00000000-0000-4000-8000-0000000000a1'

function paidOrder(
  over: Partial<Order> & Pick<Order, 'orderNo' | 'orderType' | 'productId'>,
): Order {
  const now = new Date('2026-11-10T10:00:00.000Z')
  return {
    id: '00000000-0000-4000-8000-0000000000b1',
    userId: USER_ID,
    planId: null,
    amount: 9900,
    currency: 'CNY',
    status: 'paid',
    paymentMethod: 'wechat',
    targetId: null,
    targetTitle: null,
    quantity: 1,
    originalPrice: 9900,
    discountAmount: 0,
    paidAt: now,
    cancelTime: null,
    refundTime: null,
    expiresAt: null,
    remark: null,
    createdBy: null,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  }
}

function stage(order: Order): void {
  let current = order
  mocks.findOrderByNo.mockImplementation(async (orderNo: string) => {
    if (orderNo !== current.orderNo) return undefined
    return { ...current }
  })
  mocks.updateOrderStatus.mockImplementation(
    async (orderNo: string, status: string, fromStatus?: string) => {
      if (orderNo !== current.orderNo) return undefined
      if (fromStatus !== undefined && current.status !== fromStatus) return undefined
      current = { ...current, status }
      return { ...current }
    },
  )
}

beforeEach(() => {
  mocks.findOrderByNo.mockReset()
  mocks.updateOrderStatus.mockReset()
  mocks.refundTokenDeduct.mockReset()
  mocks.refundTokenDeduct.mockResolvedValue(0)
})

describe('refundOrder 与充值侧对齐 productId 守卫', () => {
  it('VIP(orderType=2 且有 productId)退款不扣回从未入账的 token,订单仍改为 refunded', async () => {
    const order = paidOrder({
      orderNo: 'ORD-VIP-1',
      orderType: 2,
      productId: 'vip-level-1',
      amount: 19900,
    })
    stage(order)

    const result = await refundOrder(order.orderNo)

    expect(result.success).toBe(true)
    expect(result.order?.status).toBe('refunded')
    expect(mocks.refundTokenDeduct).not.toHaveBeenCalled()
    expect(mocks.updateOrderStatus).toHaveBeenCalledWith(order.orderNo, 'refunded', 'paid')
  })

  it('自定义金额充值(orderType=2 且 productId 为空)退款仍扣回已入账 token', async () => {
    const order = paidOrder({
      orderNo: 'ORD-TOPUP-1',
      orderType: 2,
      productId: null,
      amount: 5000,
    })
    stage(order)

    const result = await refundOrder(order.orderNo)

    expect(result.success).toBe(true)
    expect(result.order?.status).toBe('refunded')
    expect(mocks.refundTokenDeduct).toHaveBeenCalledTimes(1)
    expect(mocks.refundTokenDeduct).toHaveBeenCalledWith(USER_ID, 5000, order.orderNo, '退款')
  })

  it('活动充值(orderType=3 且 productId 为空)退款仍扣回', async () => {
    const order = paidOrder({
      orderNo: 'ORD-ACT-1',
      orderType: 3,
      productId: null,
      amount: 800,
    })
    stage(order)

    const result = await refundOrder(order.orderNo)

    expect(result.success).toBe(true)
    expect(mocks.refundTokenDeduct).toHaveBeenCalledWith(USER_ID, 800, order.orderNo, '退款')
  })

  it('带 productId 的活动订单与充值侧一样不入账,退款不扣回', async () => {
    const order = paidOrder({
      orderNo: 'ORD-ACT-SKU',
      orderType: 3,
      productId: 'activity-sku-1',
      amount: 800,
    })
    stage(order)

    const result = await refundOrder(order.orderNo)

    expect(result.success).toBe(true)
    expect(result.order?.status).toBe('refunded')
    expect(mocks.refundTokenDeduct).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
