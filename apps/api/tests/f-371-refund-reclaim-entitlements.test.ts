// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-371 回归测试:退款必须回收该订单已发放的 VIP / 订阅 / 配额权益。
 *
 * 纯 mock 事务,不连真实 PG。判据:
 *  1. 退款回收 API 配额 + 取消订阅 + 写冲减流水 + 审计;
 *  2. 重复退款幂等 —— 已有 `refund:` 冲减流水时不再二次回收;
 *  3. 已消耗(当前余额 < 发放量)时不把余额改负(GREATEST 兜到 0);
 *  4. 无限额度(发放 -1)且无其它生效订阅时收回到 0;
 *  5. VIP 退款取消卡 + 无其它有效卡时降级并复位免费档配额;
 *  6. 未发放权益时不误扣。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Order } from '@ihui/database'

type Row = Record<string, unknown>

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn(), transaction: vi.fn() },
  dbRead: { select: vi.fn() },
}))

vi.mock('../src/services/plan-entitlement-service.js', () => ({
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

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { revokeOrderEntitlements } from '../src/services/order-entitlement-revoke.js'
import type { DbTx } from '../src/db/payment-queries.js'

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

describe('F-371 退款回收已发放权益', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('API 订阅退款:按发放量扣回 Key 配额、取消订阅、写冲减流水与审计', async () => {
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
    expect(updates[0]?.values.status).toBe('cancelled')
    const flow = inserts.find((c) => c.values.relatedOrderNo === 'refund:ORD-1')
    expect(flow?.values.opType).toBe(6)
    expect(flow?.values.quantity).toBe(-500)
    expect(flow?.values.balanceAfter).toBe(0)
    expect(inserts.some((c) => c.values.action === 'order.refund.revoke')).toBe(true)
  })

  it('重复退款幂等:已有 refund: 冲减流水时不再二次回收', async () => {
    const { tx, updates, inserts } = createFakeTx([[{ id: 'flow-exists' }]], [])

    const result = await revokeOrderEntitlements(makeOrder({ orderType: 6 }), tx)

    expect(result.apiSubscription).toBe(false)
    expect(result.quotaRevoked).toBe(0)
    expect(updates).toHaveLength(0)
    expect(inserts).toHaveLength(0)
  })

  it('已消耗(余额<发放量)不把余额改负:扣回量钳到当前余额', async () => {
    const { tx, updates, inserts } = createFakeTx(
      [[], [{ quantity: 1000 }], [{ id: 'key-1', tokenBalance: 200 }]],
      [[{ id: 'sub-1' }], [{ tokenBalance: 0 }]],
    )

    const result = await revokeOrderEntitlements(makeOrder({ orderType: 6 }), tx)

    // 只扣当前还有的 200,不会扣到负数
    expect(result.quotaRevoked).toBe(200)
    const keyUpdate = updates.find((c) => c.values.tokenBalance !== undefined)
    expect(keyUpdate).toBeDefined()
    const flow = inserts.find((c) => c.values.relatedOrderNo === 'refund:ORD-1')
    expect(flow?.values.quantity).toBe(-200)
    expect(flow?.values.balanceAfter).toBe(0)
  })

  it('无限额度(发放 -1)且无其它生效订阅:收回到 0', async () => {
    const { tx, updates, inserts } = createFakeTx(
      [
        [], // 无冲减流水
        [{ quantity: -1 }], // 发放的是无限额度
        [{ id: 'key-1', tokenBalance: -1 }], // 当前无限
        [], // 无其它生效订阅
      ],
      [[{ id: 'sub-1' }], [{ tokenBalance: 0 }]],
    )

    const result = await revokeOrderEntitlements(makeOrder({ orderType: 6 }), tx)

    expect(result.apiSubscription).toBe(true)
    expect(result.quotaRevoked).toBe(-1)
    const keyUpdate = updates.find((c) => c.values.tokenBalance === 0)
    expect(keyUpdate).toBeDefined()
    const flow = inserts.find((c) => c.values.relatedOrderNo === 'refund:ORD-1')
    expect(flow?.values.quantity).toBe(-1)
    expect(flow?.values.balanceAfter).toBe(0)
  })

  it('VIP 退款:取消该订单的卡,用户无其它有效卡时降级并复位免费档配额', async () => {
    const { tx, updates, inserts } = createFakeTx(
      [[{ id: 'vip-1', userId: 'user-1', status: 1 }], [{ count: 0 }]],
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

  it('未发放权益:无发放流水时不误扣、不写流水', async () => {
    const { tx, updates, inserts } = createFakeTx([[], []], [])

    const result = await revokeOrderEntitlements(makeOrder({ orderType: 6 }), tx)

    expect(result.apiSubscription).toBe(false)
    expect(result.quotaRevoked).toBe(0)
    expect(updates).toHaveLength(0)
    expect(inserts).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
