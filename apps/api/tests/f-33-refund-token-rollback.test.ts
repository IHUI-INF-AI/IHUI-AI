// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-33 回归:refundOrder 不得先落 refunded 再吞掉 token 扣回失败。
 * 改前实现:先 updateOrderStatus('refunded'),随后 refundTokenDeduct 抛错只 logger.error
 * 并 return success:true —— 用户全额退款且保留 token,任何重试都在 status !== 'paid' 处退出。
 * 现在:先扣回 token,失败则抛出(订单保持 paid 可重试);alreadyClaimed(支付宝已抢占)分支
 * 失败时先 abortRefund 回 paid 再抛出,同样不吞错。
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
  recordPaymentRefund: vi.fn(),
  recordOrderSample: vi.fn(),
  recordPaymentSample: vi.fn(),
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

vi.mock('../src/plugins/business-metrics.js', () => ({
  recordPaymentAttempt: vi.fn(),
  recordPaymentSuccess: vi.fn(),
  recordPaymentRefund: mocks.recordPaymentRefund,
  recordPaymentAmount: vi.fn(),
  recordOrderSample: mocks.recordOrderSample,
  recordPaymentSample: mocks.recordPaymentSample,
}))

import { refundOrder } from '../src/services/order-service.js'

const USER_ID = '00000000-0000-4000-8000-0000000000a1'
const ORDER_NO = 'ORD-F33-TOPUP-1'

function tokenTopupOrder(over: Partial<Order> = {}): Order {
  const now = new Date('2026-11-10T10:00:00.000Z')
  return {
    id: '00000000-0000-4000-8000-0000000000b1',
    orderNo: ORDER_NO,
    userId: USER_ID,
    orderType: 2,
    productId: null,
    planId: null,
    amount: 5000,
    currency: 'CNY',
    status: 'paid',
    paymentMethod: 'alipay',
    targetId: null,
    targetTitle: null,
    quantity: 1,
    originalPrice: 5000,
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
  mocks.recordPaymentRefund.mockReset()
  mocks.recordOrderSample.mockReset()
  mocks.recordPaymentSample.mockReset()
})

describe('F-33 refundOrder 扣回 token 失败不得吞错', () => {
  it('扣回抛错时 refundOrder 抛错,订单仍为 paid 且不记退款指标', async () => {
    const order = tokenTopupOrder()
    stage(order)
    mocks.refundTokenDeduct.mockRejectedValue(new Error('db connection lost'))

    await expect(refundOrder(ORDER_NO)).rejects.toThrow('db connection lost')

    const latest = await mocks.findOrderByNo(ORDER_NO)
    expect(latest?.status).toBe('paid')
    expect(mocks.updateOrderStatus).not.toHaveBeenCalledWith(ORDER_NO, 'refunded', 'paid')
    expect(mocks.recordPaymentRefund).not.toHaveBeenCalled()
    expect(mocks.recordOrderSample).not.toHaveBeenCalled()
    expect(mocks.recordPaymentSample).not.toHaveBeenCalled()
  })

  it('扣回失败后重试:第二次扣回成功才落 refunded,返回 success', async () => {
    const order = tokenTopupOrder()
    stage(order)
    mocks.refundTokenDeduct.mockRejectedValueOnce(new Error('transient failure'))

    await expect(refundOrder(ORDER_NO)).rejects.toThrow('transient failure')
    expect((await mocks.findOrderByNo(ORDER_NO))?.status).toBe('paid')

    const retried = await refundOrder(ORDER_NO)

    expect(retried.success).toBe(true)
    expect(retried.order?.status).toBe('refunded')
    expect(mocks.refundTokenDeduct).toHaveBeenCalledTimes(2)
    expect(mocks.refundTokenDeduct).toHaveBeenLastCalledWith(USER_ID, 5000, ORDER_NO, '退款')
    expect(mocks.recordPaymentRefund).toHaveBeenCalledTimes(1)
  })

  it('alreadyClaimed 分支扣回抛错时回滚到 paid 并抛错,不返回 success', async () => {
    // F-09:支付宝已在调渠道前把订单抢占为 refunded
    const order = tokenTopupOrder({ status: 'refunded' })
    stage(order)
    mocks.refundTokenDeduct.mockRejectedValue(new Error('insufficient balance source'))

    await expect(refundOrder(ORDER_NO, { alreadyClaimed: true })).rejects.toThrow(
      'insufficient balance source',
    )

    const latest = await mocks.findOrderByNo(ORDER_NO)
    expect(latest?.status).toBe('paid')
    expect(mocks.recordPaymentRefund).not.toHaveBeenCalled()
  })

  it('alreadyClaimed 分支扣回成功时保持 refunded 并返回 success', async () => {
    const order = tokenTopupOrder({ status: 'refunded' })
    stage(order)

    const result = await refundOrder(ORDER_NO, { alreadyClaimed: true })

    expect(result.success).toBe(true)
    expect(result.order?.status).toBe('refunded')
    expect(mocks.refundTokenDeduct).toHaveBeenCalledWith(USER_ID, 5000, ORDER_NO, '退款')
    expect(mocks.recordPaymentRefund).toHaveBeenCalledTimes(1)
  })

  it('非抢占路径扣回成功时行为不变:先扣回再落 refunded', async () => {
    const order = tokenTopupOrder()
    stage(order)
    const callOrder: string[] = []
    mocks.refundTokenDeduct.mockImplementation(async () => {
      callOrder.push('deduct')
      return 5000
    })
    const baseUpdate = mocks.updateOrderStatus.getMockImplementation()
    mocks.updateOrderStatus.mockImplementation(
      async (orderNo: string, status: string, fromStatus?: string) => {
        callOrder.push(`status:${status}`)
        return baseUpdate?.(orderNo, status, fromStatus)
      },
    )

    const result = await refundOrder(ORDER_NO)

    expect(result.success).toBe(true)
    expect(result.order?.status).toBe('refunded')
    expect(callOrder).toEqual(['deduct', 'status:refunded'])
  })

  it('带 productId 的 VIP 订单不扣回 token,直接落 refunded 不受影响', async () => {
    const order = tokenTopupOrder({ orderNo: 'ORD-F33-VIP-1', productId: 'vip-level-1' })
    stage(order)

    const result = await refundOrder(order.orderNo)

    expect(result.success).toBe(true)
    expect(result.order?.status).toBe('refunded')
    expect(mocks.refundTokenDeduct).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
