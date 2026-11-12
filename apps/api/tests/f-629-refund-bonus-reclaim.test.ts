// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-629 回归:充值退款必须同时回收「充值赠送」token。
 *
 * 原缺陷:支付成功发两笔流水 —— 本金 related_order_no=orderNo、赠送 `bonus:${orderNo}`;
 * 退款只按 refundTokenDeduct(order.amount, orderNo) 扣本金,赠送流水无人冲销 ⇒
 * 用户「充值→退款」可无限白嫖赠送额度(充 ¥100 到账 16000,退款只扣 10000)。
 *
 * 不连 DB/Redis:db 与 commission-queries 全部替身。替身按 `refund:<单号>` 记录已用幂等键,
 * 模拟 (related_order_no, op_type) unique 索引,用来断言重复退款不二次扣减。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Order } from '@ihui/database'

type Row = Record<string, unknown>

interface DeductAttempt {
  userId: string
  quantity: number
  orderNo: string
  remark?: string
  idempotencyKey: string
}

const mocks = vi.hoisted(() => ({
  findOrderByNo: vi.fn<(orderNo: string) => Promise<Order | undefined>>(),
  updateOrderStatus:
    vi.fn<(orderNo: string, status: string, fromStatus?: string) => Promise<Order | undefined>>(),
  refundTokenDeduct:
    vi.fn<
      (userId: string, quantity: number, orderNo: string, remark?: string) => Promise<number>
    >(),
  /** 赠送流水查询结果(related_order_no=`bonus:${orderNo}`、op_type=0 的行) */
  bonusFlowRows: [] as Row[],
  /** 所有扣回调用(含幂等命中被拦截的尝试) */
  attempts: [] as DeductAttempt[],
  /** 真实生效的扣回(幂等键首次出现才计入) */
  applied: [] as DeductAttempt[],
}))

function chain(rows: Row[]): Record<string, unknown> {
  const c: Record<string, unknown> = {}
  for (const method of ['from', 'where', 'limit', 'orderBy', 'set', 'values', 'returning']) {
    c[method] = () => c
  }
  c.then = (resolve: (value: Row[]) => unknown) => Promise.resolve(resolve(rows))
  return c
}

vi.mock('../src/db/index.js', () => {
  const stub: Record<string, unknown> = {
    select: () => chain(mocks.bonusFlowRows),
    insert: () => chain([]),
    update: () => chain([]),
    delete: () => chain([]),
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
  recordPaymentRefund: vi.fn(),
  recordPaymentAmount: vi.fn(),
  recordOrderSample: vi.fn(),
  recordPaymentSample: vi.fn(),
}))

import { refundOrder } from '../src/services/order-service.js'

const USER_ID = '00000000-0000-4000-8000-0000000000a1'
const ORDER_NO = 'ORD-F629-TOPUP-1'

function paidOrder(over: Partial<Order> = {}): Order {
  const now = new Date('2026-11-10T10:00:00.000Z')
  return {
    id: '00000000-0000-4000-8000-0000000000b1',
    orderNo: ORDER_NO,
    userId: USER_ID,
    orderType: 2,
    productId: null,
    planId: null,
    amount: 10000,
    currency: 'CNY',
    status: 'paid',
    paymentMethod: 'wechat',
    targetId: null,
    targetTitle: null,
    quantity: 1,
    originalPrice: 10000,
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
  mocks.bonusFlowRows = []
  mocks.attempts = []
  mocks.applied = []
  // 模拟 refundTokenDeduct 的幂等语义:related_order_no=`refund:${orderNo}` 上 unique 索引,
  // 同键第二次调用不产生新的扣减流水(真实实现返回当前余额)。
  mocks.refundTokenDeduct.mockImplementation(
    async (userId: string, quantity: number, orderNo: string, remark?: string) => {
      const attempt: DeductAttempt = {
        userId,
        quantity,
        orderNo,
        remark,
        idempotencyKey: `refund:${orderNo}`,
      }
      mocks.attempts.push(attempt)
      if (mocks.applied.some((a) => a.idempotencyKey === attempt.idempotencyKey)) return 0
      mocks.applied.push(attempt)
      return 0
    },
  )
})

describe('F-629 退款回收充值赠送 token', () => {
  it('充 ¥100 赠 6000:退款扣回本金 10000 + 赠送 6000,两笔幂等键互不冲突', async () => {
    const order = paidOrder()
    stage(order)
    mocks.bonusFlowRows = [{ quantity: 6000 }]

    const result = await refundOrder(ORDER_NO)

    expect(result.success).toBe(true)
    expect(result.order?.status).toBe('refunded')
    expect(mocks.refundTokenDeduct).toHaveBeenCalledTimes(2)
    expect(mocks.refundTokenDeduct).toHaveBeenNthCalledWith(1, USER_ID, 10000, ORDER_NO, '退款')
    expect(mocks.refundTokenDeduct).toHaveBeenNthCalledWith(
      2,
      USER_ID,
      6000,
      `bonus:${ORDER_NO}`,
      '退款扣回赠送',
    )
    expect(mocks.applied.map((a) => a.idempotencyKey)).toEqual([
      `refund:${ORDER_NO}`,
      `refund:bonus:${ORDER_NO}`,
    ])
  })

  it('未命中赠送档位(无赠送流水):只扣回本金,不报错', async () => {
    const order = paidOrder()
    stage(order)
    mocks.bonusFlowRows = []

    const result = await refundOrder(ORDER_NO)

    expect(result.success).toBe(true)
    expect(mocks.refundTokenDeduct).toHaveBeenCalledTimes(1)
    expect(mocks.refundTokenDeduct).toHaveBeenCalledWith(USER_ID, 10000, ORDER_NO, '退款')
  })

  it('赠送流水量为 0(发放失败/未入账):同样跳过,只扣回本金', async () => {
    const order = paidOrder()
    stage(order)
    mocks.bonusFlowRows = [{ quantity: 0 }]

    const result = await refundOrder(ORDER_NO)

    expect(result.success).toBe(true)
    expect(mocks.refundTokenDeduct).toHaveBeenCalledTimes(1)
  })

  it('重复退款(重试/alreadyClaimed 重放)按幂等键拦截,不产生二次扣减', async () => {
    const order = paidOrder()
    stage(order)
    mocks.bonusFlowRows = [{ quantity: 6000 }]

    await refundOrder(ORDER_NO)
    // 重试:订单已是 refunded,走 alreadyClaimed 分支重放退款副作用
    const retried = await refundOrder(ORDER_NO, { alreadyClaimed: true })

    expect(retried.success).toBe(true)
    // 两次执行各调用两次(本金+赠送),但真正生效的扣减只有两笔
    expect(mocks.attempts).toHaveLength(4)
    expect(mocks.applied).toHaveLength(2)
    expect(mocks.applied.map((a) => a.idempotencyKey)).toEqual([
      `refund:${ORDER_NO}`,
      `refund:bonus:${ORDER_NO}`,
    ])
    expect(mocks.applied.map((a) => a.quantity)).toEqual([10000, 6000])
  })

  it('活动订单(orderType=3)与 VIP 订单(有 productId)不回收赠送', async () => {
    const activity = paidOrder({ orderNo: 'ORD-F629-ACT-1', orderType: 3 })
    stage(activity)
    mocks.bonusFlowRows = [{ quantity: 6000 }]

    await refundOrder(activity.orderNo)

    expect(mocks.refundTokenDeduct).toHaveBeenCalledTimes(1)
    expect(mocks.refundTokenDeduct).toHaveBeenCalledWith(USER_ID, 10000, activity.orderNo, '退款')

    mocks.refundTokenDeduct.mockClear()
    mocks.attempts = []
    mocks.applied = []
    const vip = paidOrder({ orderNo: 'ORD-F629-VIP-1', productId: 'vip-level-1' })
    stage(vip)

    await refundOrder(vip.orderNo)

    expect(mocks.refundTokenDeduct).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
