// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-371 退款回收已发放权益(纯 mock,不连库)。
 *
 * 判据:
 *  1. 正例 —— 退款按订单撤销 VIP 卡 / 开发者订阅 / API 订阅配额,并写冲减流水 + 审计留痕;
 *  2. 反例 —— 已有冲减流水时重复回调不再扣;
 *  3. 反例 —— 没有发放记录(未走完激活)时一个字节都不写,不误扣。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Order } from '@ihui/database'

type Row = Record<string, unknown>

vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn(),
  },
  dbRead: { select: vi.fn() },
}))

vi.mock('../plan-entitlement-service.js', () => ({
  getEntitlementsByLevelValue: vi.fn(async () => ({
    apiQps: 10,
    maxConcurrency: 3,
    modelWhitelist: null,
    aiBudgetDefaults: {
      dailyTokenLimit: 100_000,
      monthlyTokenLimit: 1_000_000,
      dailyCostLimit: '10',
      monthlyCostLimit: '100',
    },
  })),
}))

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { revokeOrderEntitlements } from '../order-entitlement-revoke.js'
import type { DbTx } from '../../db/payment-queries.js'

type FakeCall = { table: unknown; values: Row }

/** 假事务:select 按脚本顺序吐行;update/insert 只记录不写库。 */
function createFakeTx(selectRows: Row[][], updateRows: Row[][]) {
  const selectQueue = [...selectRows]
  const updateQueue = [...updateRows]
  const updates: FakeCall[] = []
  const inserts: FakeCall[] = []

  const makeSelectChain = () => {
    const resolve = () => selectQueue.shift() ?? []
    const chain: Row = {}
    chain.from = () => chain
    chain.where = () => chain
    chain.orderBy = () => chain
    chain.limit = () => chain
    chain.for = () => chain
    chain.then = (ok: (v: unknown) => unknown, err?: (e: unknown) => unknown) =>
      Promise.resolve(resolve()).then(ok, err)
    return chain
  }

  const tx = {
    select: () => makeSelectChain(),
    update: (table: unknown) => {
      let values: Row = {}
      const chain: Row = {}
      chain.set = (v: Row) => {
        values = v
        return chain
      }
      chain.where = () => chain
      chain.returning = () => {
        updates.push({ table, values })
        return Promise.resolve(updateQueue.shift() ?? [])
      }
      return chain
    },
    insert: (table: unknown) => ({
      values: (v: Row) => {
        inserts.push({ table, values: v })
        const p = Promise.resolve([{ id: 'inserted' }]) as unknown as Row
        p.onConflictDoNothing = () => p
        p.returning = () => Promise.resolve([])
        return p
      },
    }),
  }
  return { tx: tx as unknown as DbTx, updates, inserts }
}

function makeOrder(partial: Partial<Order>): Order {
  return {
    id: 'order-id',
    orderNo: 'ORD-1',
    userId: 'user-1',
    orderType: 6,
    productId: null,
    amount: 9900,
    quantity: 1,
    status: 'paid',
    ...partial,
  } as unknown as Order
}

describe('F-371 revokeOrderEntitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('API 订阅退款:按发放量扣回 Key 配额、取消订阅实例、写冲减流水与审计留痕', async () => {
    const { tx, updates, inserts } = createFakeTx(
      [
        [], // 无冲减流水
        [{ quantity: 1000 }], // 发放流水
        [{ id: 'key-1', tokenBalance: 500 }], // 活跃 Key
      ],
      [[{ id: 'sub-1' }], [{ tokenBalance: 0 }]],
    )

    const result = await revokeOrderEntitlements(makeOrder({ orderType: 6 }), tx)

    expect(result.apiSubscription).toBe(true)
    expect(result.quotaRevoked).toBe(500)
    expect(updates).toHaveLength(2)
    expect(updates[0]?.values.status).toBe('cancelled')
    expect(updates[1]?.values.updatedAt).toBeInstanceOf(Date)

    const flow = inserts.find((c) => c.values.relatedOrderNo === 'refund:ORD-1')
    expect(flow?.values.opType).toBe(6)
    expect(flow?.values.quantity).toBe(-500)
    expect(flow?.values.balanceAfter).toBe(0)
    expect(inserts.some((c) => c.values.action === 'order.refund.revoke')).toBe(true)
  })

  it('重复回调:已有冲减流水时不再扣,也不再改任何状态', async () => {
    const { tx, updates, inserts } = createFakeTx(
      [[{ id: 'flow-exists' }]], // `refund:ORD-1` + op_type=6 已存在
      [],
    )

    const result = await revokeOrderEntitlements(makeOrder({ orderType: 6 }), tx)

    expect(result.apiSubscription).toBe(false)
    expect(result.quotaRevoked).toBe(0)
    expect(updates).toHaveLength(0)
    expect(inserts).toHaveLength(0)
  })

  it('未发放权益:无发放流水时不误扣(不扣 Key、不取消订阅、不写流水)', async () => {
    const { tx, updates, inserts } = createFakeTx(
      [[], []], // 无冲减流水、也无发放流水
      [],
    )

    const result = await revokeOrderEntitlements(makeOrder({ orderType: 6 }), tx)

    expect(result.apiSubscription).toBe(false)
    expect(result.quotaRevoked).toBe(0)
    expect(updates).toHaveLength(0)
    expect(inserts).toHaveLength(0)
  })

  it('VIP 退款:取消该订单的卡、用户无其它有效卡时降级并把配额复位免费档', async () => {
    const { tx, updates, inserts } = createFakeTx(
      [
        [{ id: 'vip-1', userId: 'user-1', status: 1 }],
        [{ count: 0 }], // 无其它有效 VIP
      ],
      [[{ id: 'vip-1' }], [{ id: 'user-1' }], [{ id: 'budget-1' }]],
    )

    const result = await revokeOrderEntitlements(
      makeOrder({ orderType: 2, productId: 'vip-level-1' }),
      tx,
    )

    expect(result.vip).toBe(true)
    expect(result.vipDowngraded).toBe(true)
    expect(updates[0]?.values.status).toBe(2)
    expect(updates[1]?.values.isVip).toBe(0)
    expect(updates[2]?.values.dailyTokenLimit).toBe(100_000)
    expect(inserts.some((c) => c.values.action === 'order.refund.revoke')).toBe(true)
  })

  it('VIP 退款:用户仍有其它有效卡时只撤本单的卡,不降级、不复位配额', async () => {
    const { tx, updates } = createFakeTx(
      [
        [{ id: 'vip-1', userId: 'user-1', status: 1 }],
        [{ count: 1 }], // 还有其它有效 VIP
      ],
      [[{ id: 'vip-1' }]],
    )

    const result = await revokeOrderEntitlements(
      makeOrder({ orderType: 2, productId: 'vip-level-1' }),
      tx,
    )

    expect(result.vip).toBe(true)
    expect(result.vipDowngraded).toBe(false)
    expect(updates).toHaveLength(1)
    expect(updates[0]?.values.status).toBe(2)
  })

  it('开发者订阅退款:取消该订单的订阅;未激活时 0 命中且不留痕', async () => {
    const hit = createFakeTx([], [[{ id: 'dev-sub-1' }]])
    const hitResult = await revokeOrderEntitlements(makeOrder({ orderType: 5 }), hit.tx)
    expect(hitResult.developerSubscription).toBe(true)
    expect(hit.inserts.some((c) => c.values.action === 'order.refund.revoke')).toBe(true)

    const miss = createFakeTx([], [[]])
    const missResult = await revokeOrderEntitlements(makeOrder({ orderType: 5 }), miss.tx)
    expect(missResult.developerSubscription).toBe(false)
    expect(miss.inserts).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
