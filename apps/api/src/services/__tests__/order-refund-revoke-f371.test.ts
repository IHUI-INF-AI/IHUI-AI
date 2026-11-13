// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-371 接线回归(纯 mock,不连库)。
 *
 * 判据:
 *  1. refundOrder 把「订单置 refunded」与「回收已发放权益」放进同一个事务,且只调一次回收;
 *  2. 订单已是 refunded 时重复退款直接返回失败,既不进事务也不调回收(重复回调不再扣);
 *  3. 抢占路径回收失败 ⇒ 解除抢占回到 paid 后再抛出,不留「钱已退、权益还在」的半状态。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Order } from '@ihui/database'

const mocks = vi.hoisted(() => ({
  findOrderByNo: vi.fn(),
  updateOrderStatus: vi.fn(),
  revokeOrderEntitlements: vi.fn(),
  transaction: vi.fn(),
  refundTokenDeduct: vi.fn(),
  recordPaymentRefund: vi.fn(),
  recordOrderSample: vi.fn(),
  recordPaymentSample: vi.fn(),
}))

vi.mock('../../db/payment-queries.js', () => ({
  createOrder: vi.fn(),
  findOrderByNo: mocks.findOrderByNo,
  updateOrderStatus: mocks.updateOrderStatus,
  queryPendingOrders: vi.fn(),
  listPaidOrdersByDate: vi.fn(),
}))

vi.mock('../db/commission-queries.js', () => ({
  rechargeToken: vi.fn(),
  deductToken: vi.fn(),
  refundTokenDeduct: mocks.refundTokenDeduct,
}))

vi.mock('../order-entitlement-revoke.js', () => ({
  revokeOrderEntitlements: mocks.revokeOrderEntitlements,
}))

vi.mock('../../db/index.js', () => ({
  db: {
    // 退款链路里的佣金冲减(F-407)会先查 commission_flows;本测试只判 F-371 接线,
    // 让它查到空集直接跳过,不干扰权益回收的断言。
    select: vi.fn(() => {
      const chain: Record<string, unknown> = {}
      chain.from = () => chain
      chain.where = () => Promise.resolve([])
      return chain
    }),
    update: vi.fn(),
    insert: vi.fn(),
    transaction: mocks.transaction,
  },
  dbRead: { select: vi.fn() },
}))

vi.mock('../distributed-transaction.js', () => ({ executeSaga: vi.fn() }))
vi.mock('../points-service.js', () => ({ earnPoints: vi.fn(), spendPoints: vi.fn() }))
vi.mock('../utils/outbox.js', () => ({ writeToOutbox: vi.fn() }))
vi.mock('../utils/biz-day.js', () => ({ bizDayKey: vi.fn(() => '2026-11-13') }))
vi.mock('../edu-ledger.js', () => ({ recordPayment: vi.fn() }))
vi.mock('../topup-discount-service.js', () => ({ calculateTopupBonus: vi.fn() }))
vi.mock('../../config/index.js', () => ({ config: { CORS_ORIGIN: 'https://aizhs.top' } }))
vi.mock('../../plugins/business-metrics.js', () => ({
  recordPaymentAttempt: vi.fn(),
  recordPaymentSuccess: vi.fn(),
  recordPaymentRefund: mocks.recordPaymentRefund,
  recordPaymentAmount: vi.fn(),
  recordOrderSample: mocks.recordOrderSample,
  recordPaymentSample: mocks.recordPaymentSample,
}))

import { refundOrder } from '../order-service.js'

function makeOrder(partial: Partial<Order>): Order {
  return {
    id: 'order-id',
    orderNo: 'ORD-1',
    userId: 'user-1',
    orderType: 6,
    productId: 'plan-1',
    amount: 9900,
    quantity: 1,
    status: 'paid',
    paymentMethod: 'alipay',
    ...partial,
  } as unknown as Order
}

describe('F-371 refundOrder 接线', () => {
  const txStub = { __fakeTx: true }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(txStub),
    )
    mocks.updateOrderStatus.mockResolvedValue(makeOrder({ status: 'refunded' }))
    mocks.revokeOrderEntitlements.mockResolvedValue({
      vip: false,
      vipDowngraded: false,
      developerSubscription: false,
      apiSubscription: true,
      quotaRevoked: 1000,
    })
  })

  it('退款成功:同一事务内先置 refunded 再回收权益,只调一次', async () => {
    const order = makeOrder({ orderType: 6 })
    mocks.findOrderByNo
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce(makeOrder({ orderType: 6, status: 'refunded' }))

    const result = await refundOrder('ORD-1')

    expect(result.success).toBe(true)
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    expect(mocks.updateOrderStatus).toHaveBeenCalledWith('ORD-1', 'refunded', 'paid', null, txStub)
    expect(mocks.revokeOrderEntitlements).toHaveBeenCalledTimes(1)
    expect(mocks.revokeOrderEntitlements).toHaveBeenCalledWith(order, txStub)
    expect(mocks.recordPaymentRefund).toHaveBeenCalledTimes(1)
  })

  it('重复回调:订单已 refunded 时直接失败,不进事务、不回收', async () => {
    mocks.findOrderByNo.mockResolvedValue(makeOrder({ status: 'refunded' }))

    const result = await refundOrder('ORD-1')

    expect(result.success).toBe(false)
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.revokeOrderEntitlements).not.toHaveBeenCalled()
    expect(mocks.recordPaymentRefund).not.toHaveBeenCalled()
  })

  it('抢占路径回收失败:解除抢占(refunded→paid)后抛出,不留半状态', async () => {
    mocks.findOrderByNo.mockResolvedValue(makeOrder({ orderType: 6, status: 'refunded' }))
    mocks.revokeOrderEntitlements.mockRejectedValue(new Error('revoke failed'))

    await expect(refundOrder('ORD-1', { alreadyClaimed: true })).rejects.toThrow('revoke failed')

    expect(mocks.updateOrderStatus).toHaveBeenCalledWith('ORD-1', 'paid', 'refunded')
    expect(mocks.recordPaymentRefund).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
