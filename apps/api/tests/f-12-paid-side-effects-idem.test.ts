// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-12:支付回调(胜利方 saga)与管理员 complete-saga 并发时,重放侧积分/Outbox
 * 「事务外先查后插」与胜利方未提交的写入交错 ⇒双发。
 *
 * 修法:replayPaidSideEffects 与 saga 的 award-points / write-outbox 两步都收进
 * db.transaction,并先对 orders 行 FOR UPDATE 抢同一把行锁,锁内二次查重恰好一次
 * (工单首选唯一索引需新增迁移,本单禁迁移 ⇒ 按工单第二修法「事务内」应用层幂等)。
 *
 * 夹具用「排队事务 + 内存行表」模拟 PG 行锁语义:同一时刻只跑一个事务,
 * 后到者等先行者提交后才查 —— 若回归成事务外 check-then-insert,并发双开会各发一次,断言翻红。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Order } from '@ihui/database'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { findOrderByNoMock, f12 } = vi.hoisted(() => ({
  findOrderByNoMock: vi.fn(),
  f12: {
    store: {
      points: [] as Array<{ referenceId: string; type: string }>,
      outbox: [] as Array<{ type: string; orderNo: string }>,
    },
    events: [] as string[],
    earnCalls: [] as Array<{ userId: string; amount: number; referenceId: string; inTx: boolean }>,
    outboxCalls: [] as Array<{ type: string; inTx: boolean }>,
  },
}))

vi.mock('../src/db/payment-queries.js', () => ({
  findOrderByNo: findOrderByNoMock,
  updateOrderStatus: vi.fn(async () => ({ id: 'o1' })),
  queryPendingOrders: vi.fn(async () => []),
  listPaidOrdersByDate: vi.fn(async () => []),
  createOrder: vi.fn(),
}))

vi.mock('../src/services/points-service.js', () => ({
  earnPoints: vi.fn(
    async (
      userId: string,
      amount: number,
      _source: string,
      _description: string,
      referenceId: string,
      tx?: unknown,
    ) => {
      f12.earnCalls.push({ userId, amount, referenceId, inTx: Boolean(tx) })
      f12.events.push(`earn:${referenceId}`)
      f12.store.points.push({ referenceId, type: 'earn' })
      return { balance: 100, delta: amount, transaction: { id: `ptx-${f12.earnCalls.length}` } }
    },
  ),
  spendPoints: vi.fn(async () => ({ balance: 90, delta: -1, transaction: { id: 'sp-1' } })),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../src/utils/biz-day.js', () => ({ bizDayKey: vi.fn(() => '2026-11-12') }))

vi.mock('../src/utils/outbox.js', () => ({
  writeToOutbox: vi.fn(
    async (event: { type: string; payload?: { orderNo?: string } }, tx?: unknown) => {
      f12.outboxCalls.push({ type: event.type, inTx: Boolean(tx) })
      f12.events.push(`outbox:${event.payload?.orderNo ?? ''}`)
      f12.store.outbox.push({ type: event.type, orderNo: event.payload?.orderNo ?? '' })
      return `ob-${f12.outboxCalls.length}`
    },
  ),
}))

vi.mock('../src/db/commission-queries.js', () => ({
  rechargeToken: vi.fn(async () => 100),
  deductToken: vi.fn(async () => 90),
  refundTokenDeduct: vi.fn(async () => 90),
}))

vi.mock('../src/services/edu-ledger.js', () => ({
  recordPayment: vi.fn(async () => 'TEST-RECEIPT'),
}))

vi.mock('../src/services/topup-discount-service.js', () => ({
  calculateTopupBonus: vi.fn(async () => ({
    applied: false,
    bonus: 0,
    source: 'none' as const,
    description: '',
  })),
}))

// 假 db:排队式事务模拟 PG 行锁 —— 同一时刻只执行一个事务;select 按 drizzle 条件
// 里的 Param 值在内存行表上做等值过滤,orders 行锁查询本身不改数据只记事件。
vi.mock('../src/db/index.js', async () => {
  const { orders, pointTransactions, outboxEvents } = await import('@ihui/database')

  const collectParams = (node: unknown, out: unknown[] = []): unknown[] => {
    if (node == null) return out
    if (Array.isArray(node)) {
      for (const n of node) collectParams(n, out)
      return out
    }
    if (typeof node !== 'object') {
      out.push(node)
      return out
    }
    const obj = node as Record<string, unknown>
    if ('encoder' in obj) {
      out.push(obj.value) // drizzle Param
      return out
    }
    if ('queryChunks' in obj) {
      collectParams(obj.queryChunks, out)
      return out
    }
    return out // StringChunk / Column 等非参数节点
  }

  const makeSelect = () => {
    let table: unknown
    let cond: unknown
    let max: number | undefined
    const chain = {} as Record<string, unknown>
    const rowsNow = (): Array<Record<string, unknown>> => {
      if (table === pointTransactions) {
        const [refId, type] = collectParams(cond) as [string | undefined, string | undefined]
        return f12.store.points
          .filter((p) => p.referenceId === refId && p.type === type)
          .map((_, i) => ({ id: `pt-${i}` }))
      }
      if (table === outboxEvents) {
        const [eventType, orderNo] = collectParams(cond) as [string | undefined, string | undefined]
        return f12.store.outbox
          .filter((e) => e.type === eventType && e.orderNo === orderNo)
          .map((_, i) => ({ id: `ob-${i}` }))
      }
      return [] // orders 行锁查询等:锁本身才是语义,行内容不参与断言
    }
    const resolve = async (): Promise<unknown> => {
      // 微让步:若查重退回事务外(check-then-insert),并发双方会在这里交错双双查空
      await new Promise((r) => setTimeout(r, 0))
      const rows = rowsNow()
      return max === undefined ? rows : rows.slice(0, max)
    }
    Object.assign(chain, {
      from: (t: unknown) => {
        table = t
        return chain
      },
      where: (c: unknown) => {
        cond = c
        return chain
      },
      limit: (n: number) => {
        max = n
        return resolve()
      },
      for: (mode: string) => {
        if (mode === 'update' && table === orders) f12.events.push('lock:orders')
        return chain
      },
      then: (onFulfilled: (v: unknown) => unknown, onRejected: (e: unknown) => unknown) =>
        resolve().then(onFulfilled, onRejected),
    })
    return chain
  }

  let txQueue: Promise<unknown> = Promise.resolve()
  const txApi = { select: () => makeSelect() }
  const api = {
    select: () => makeSelect(),
    transaction: (cb: (tx: unknown) => Promise<unknown>) => {
      const run = txQueue.then(() => cb(txApi))
      txQueue = run.then(
        () => undefined,
        () => undefined,
      )
      return run
    },
  }
  return { db: api, dbRead: api, dbWrite: api }
})

import { completeOrderWithSaga } from '../src/services/order-service.js'
import { earnPoints } from '../src/services/points-service.js'
import { writeToOutbox } from '../src/utils/outbox.js'

const ORDER_NO = 'ORD-F12-00001'

const paidOrder = {
  id: 'ord-f12-1',
  orderNo: ORDER_NO,
  userId: 'user-1',
  amount: 1000, // 10 元 ⇒ 10 积分
  orderType: 1,
  paymentMethod: 'wechat',
  productId: 'prod-1',
  status: 'paid',
  tradeNo: 'PAY-F12-TRADE',
  paidAt: new Date('2026-11-12T08:00:00.000Z'),
  createdAt: new Date('2026-11-12T07:59:00.000Z'),
  updatedAt: new Date('2026-11-12T08:00:00.000Z'),
} as unknown as Order

describe('F-12 已支付订单副作用重放幂等(事务 + orders 行锁)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    f12.store.points.length = 0
    f12.store.outbox.length = 0
    f12.events.length = 0
    f12.earnCalls.length = 0
    f12.outboxCalls.length = 0
    findOrderByNoMock.mockResolvedValue({ ...paidOrder })
  })

  it('单次重放:先锁 orders 行再查重,积分与 Outbox 各恰好一次且都写在事务内', async () => {
    const r = await completeOrderWithSaga(ORDER_NO)
    expect(r.success).toBe(true)
    expect(f12.earnCalls).toHaveLength(1)
    expect(f12.earnCalls[0]!.inTx).toBe(true)
    expect(f12.outboxCalls).toHaveLength(1)
    expect(f12.outboxCalls[0]!.inTx).toBe(true)
    // 行锁先于任何查重/写入
    expect(f12.events[0]).toBe('lock:orders')
  })

  it('并发双开(回调与 complete-saga 同时进重放):行锁串行,积分/Outbox 只发一次', async () => {
    const [a, b] = await Promise.all([
      completeOrderWithSaga(ORDER_NO),
      completeOrderWithSaga(ORDER_NO),
    ])
    expect(a.success).toBe(true)
    expect(b.success).toBe(true)
    expect(f12.earnCalls).toHaveLength(1)
    expect(f12.outboxCalls).toHaveLength(1)
    // 两个重放方各抢一次行锁
    expect(f12.events.filter((e) => e === 'lock:orders')).toHaveLength(2)
  })

  it('已有同单积分流水与 order.paid 事件的重放:两项都跳过', async () => {
    f12.store.points.push({ referenceId: ORDER_NO, type: 'earn' })
    f12.store.outbox.push({ type: 'order.paid', orderNo: ORDER_NO })
    const r = await completeOrderWithSaga(ORDER_NO)
    expect(r.success).toBe(true)
    expect(f12.earnCalls).toHaveLength(0)
    expect(f12.outboxCalls).toHaveLength(0)
  })

  it('事务内查重契约:earnPoints/writeToOutbox 的 mock 透传收到 tx 上下文', async () => {
    await completeOrderWithSaga(ORDER_NO)
    expect(vi.mocked(earnPoints).mock.calls[0]![5]).toBeTruthy()
    expect(vi.mocked(writeToOutbox).mock.calls[0]![1]).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
