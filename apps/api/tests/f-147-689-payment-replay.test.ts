// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-147 + F-689 夹具:支付回调/主动查单重放时,订单状态迁移必须带 fromStatus 守卫,
// 发卡与开发者订阅必须按 order_id 唯一约束幂等,且 endTime 必须锚定支付时刻而非当前时间。
//
// 说明:这里用一个最小的内存查询构造器模拟 drizzle,只解析 where 里的参数:
// - orders 更新:只有条件里出现的状态值匹配当前行状态才命中(用于验证 pending→paid 守卫);
// - insert:调用 onConflictDoNothing 且 order_id 已存在时返回空行(模拟唯一约束)。
// 改前(无 fromStatus、无唯一约束、endTime 取 now)三条断言全红。

import { describe, it, expect, beforeEach, vi } from 'vitest'

const { store } = vi.hoisted(() => ({
  store: {
    orders: new Map<string, Record<string, unknown>>(),
    eduOrders: new Map<string, Record<string, unknown>>(),
    vipLevels: new Map<string, Record<string, unknown>>(),
    userVips: [] as Array<Record<string, unknown>>,
    developerSubscriptions: [] as Array<Record<string, unknown>>,
    userVipUpdates: 0,
    conflictTargets: [] as unknown[],
  },
}))

function collectParams(cond: unknown, out: unknown[] = []): unknown[] {
  if (!cond || typeof cond !== 'object') return out
  const chunks = (cond as { queryChunks?: unknown[] }).queryChunks
  if (Array.isArray(chunks)) {
    for (const ch of chunks) {
      if (!ch || typeof ch !== 'object') continue
      if ('value' in ch) {
        const v = (ch as { value: unknown }).value
        if (Array.isArray(v)) out.push(...v)
        else out.push(v)
      }
      collectParams(ch, out)
    }
  }
  return out
}

function condMatches(cond: unknown, row: Record<string, unknown>): boolean {
  const params = collectParams(cond).filter((v): v is string => typeof v === 'string')
  // 订单/订阅条件里必带业务键;状态参数出现时按状态过滤,模拟 SQL 的 AND 语义。
  if (typeof row.orderNo === 'string' && !params.includes(row.orderNo)) return false
  const statusParam = params.find((p) => ['pending', 'paid', 'cancelled', 'refunded'].includes(p))
  if (statusParam) return row.status === statusParam
  return true
}

vi.mock('../src/db/index.js', async () => {
  const { orders, eduOrders, vipLevels, userVips, developerSubscriptions, users } =
    await import('@ihui/database')

  function tableRows(table: unknown): Array<Record<string, unknown>> {
    if (table === orders) return [...store.orders.values()]
    if (table === eduOrders) return [...store.eduOrders.values()]
    if (table === vipLevels) return [...store.vipLevels.values()]
    if (table === userVips) return store.userVips
    if (table === developerSubscriptions) return store.developerSubscriptions
    return []
  }

  function makeUpdate(table: unknown) {
    let values: Record<string, unknown> = {}
    const builder: Record<string, unknown> = {
      set: (v: Record<string, unknown>) => {
        values = v
        return builder
      },
      where: (cond: unknown) => {
        builder._cond = cond
        return builder
      },
      returning: () => {
        const hits = tableRows(table).filter((r) => condMatches(builder._cond, r))
        if (table === users) {
          store.userVipUpdates += hits.length
          return Promise.resolve(hits.map((r) => ({ ...r, ...values })))
        }
        for (const row of hits) Object.assign(row, values)
        return Promise.resolve(hits.map((r) => ({ ...r })))
      },
      then: (resolve: (v: unknown) => unknown) => {
        if (table === users) {
          store.userVipUpdates += 1
          return Promise.resolve(undefined).then(resolve)
        }
        const hits = tableRows(table).filter((r) => condMatches(builder._cond, r))
        for (const row of hits) Object.assign(row, values)
        return Promise.resolve(undefined).then(resolve)
      },
    }
    return builder
  }

  function makeInsert(table: unknown) {
    let values: Record<string, unknown> = {}
    let conflictHandled = false
    const builder: Record<string, unknown> = {
      values: (v: Record<string, unknown>) => {
        values = v
        return builder
      },
      onConflictDoNothing: (opts?: unknown) => {
        conflictHandled = true
        store.conflictTargets.push(opts)
        return builder
      },
      returning: () => {
        const rows = tableRows(table)
        const orderId = values.orderId
        if (
          conflictHandled &&
          orderId !== null &&
          orderId !== undefined &&
          rows.some((r) => r.orderId === orderId)
        ) {
          return Promise.resolve([])
        }
        rows.push({ id: `row-${rows.length + 1}`, ...values })
        return Promise.resolve([rows[rows.length - 1]])
      },
      then: (resolve: (v: unknown) => unknown) => {
        const rows = tableRows(table)
        rows.push({ id: `row-${rows.length + 1}`, ...values })
        return Promise.resolve(undefined).then(resolve)
      },
    }
    return builder
  }

  function makeSelect() {
    const builder: Record<string, unknown> = {}
    builder.from = (table: unknown) => {
      builder._table = table
      return builder
    }
    builder.where = (cond: unknown) => {
      builder._cond = cond
      return builder
    }
    builder.limit = () => {
      const rows = tableRows(builder._table).filter((r) => condMatches(builder._cond, r))
      return Promise.resolve(rows.map((r) => ({ ...r })))
    }
    builder.then = (resolve: (v: unknown) => unknown) => {
      const rows = tableRows(builder._table).filter((r) => condMatches(builder._cond, r))
      return Promise.resolve(rows.map((r) => ({ ...r }))).then(resolve)
    }
    return builder
  }

  const db = {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    select: () => makeSelect(),
    insert: (table: unknown) => makeInsert(table),
    update: (table: unknown) => makeUpdate(table),
  }
  const dbRead = db
  return { db, dbRead, dbTx: db, pool: {}, checkDbHealth: async () => true }
})

import { updateOrderStatus } from '../src/db/payment-queries.js'
import { purchaseVip } from '../src/db/vip-queries.js'
import { activateDeveloperSubscription } from '../src/db/developer-queries.js'

const PAID_AT = new Date('2026-11-08T00:00:00.000Z')
const DAY = 86400_000

describe('F-147/F-689 支付重放幂等', () => {
  beforeEach(() => {
    store.orders.clear()
    store.eduOrders.clear()
    store.vipLevels.clear()
    store.userVips.length = 0
    store.developerSubscriptions.length = 0
    store.userVipUpdates = 0
    store.conflictTargets.length = 0
    store.vipLevels.set('L1', { id: 'L1', levelValue: 2, durationDays: 30 })
  })

  it('F-147 updateOrderStatus 只允许 pending→paid:已 paid 订单再次置 paid 返回 undefined', async () => {
    store.orders.set('NO1', { orderNo: 'NO1', status: 'paid' })

    const replay = await updateOrderStatus('NO1', 'paid')

    expect(replay).toBeUndefined()
    expect(store.orders.get('NO1')?.status).toBe('paid')
    // 改前无 fromStatus 守卫:重放会再次命中并返回订单行 ⇒ 本断言红。
  })

  it('F-147 pending→paid 正常放行,并写入 paidAt 作为权益起算点', async () => {
    store.orders.set('NO2', { orderNo: 'NO2', status: 'pending' })

    const paid = await updateOrderStatus('NO2', 'paid')

    expect(paid?.status).toBe('paid')
    expect(paid?.paidAt).toBeInstanceOf(Date)
  })

  it('F-689 同一 pending 订单并发两次发卡只落 1 条,且 endTime = 支付时刻 + 时长', async () => {
    await Promise.all([
      purchaseVip({ userId: 'U1', vipLevelId: 'L1', orderId: 'O1', paidAt: PAID_AT }),
      purchaseVip({ userId: 'U1', vipLevelId: 'L1', orderId: 'O1', paidAt: PAID_AT }),
    ])

    expect(store.userVips).toHaveLength(1)
    expect((store.userVips[0]?.endTime as Date).getTime()).toBe(PAID_AT.getTime() + 30 * DAY)
    expect(store.userVipUpdates).toBe(1)
    // 改前无 order_id 唯一约束且 endTime 取 now:这里会是 2 行、endTime≈now+30d ⇒ 断言红。
  })

  it('F-689 幂等 TTL 过期后重放(payinfo 再查单)仍只 1 条', async () => {
    for (let i = 0; i < 3; i++) {
      await purchaseVip({ userId: 'U1', vipLevelId: 'L1', orderId: 'O1', paidAt: PAID_AT })
    }

    expect(store.userVips).toHaveLength(1)
    expect(store.conflictTargets.length).toBe(3)
    expect(store.userVipUpdates).toBe(1)
  })

  it('F-689 开发者订阅并发两次只落 1 条,且 endTime = 支付时刻 + 时长', async () => {
    await Promise.all([
      activateDeveloperSubscription({
        userId: 'U1',
        pricingId: 'P1',
        period: 'monthly',
        orderId: 'O2',
        paidAt: PAID_AT,
      }),
      activateDeveloperSubscription({
        userId: 'U1',
        pricingId: 'P1',
        period: 'monthly',
        orderId: 'O2',
        paidAt: PAID_AT,
      }),
    ])

    expect(store.developerSubscriptions).toHaveLength(1)
    expect((store.developerSubscriptions[0]?.endTime as Date).getTime()).toBe(
      PAID_AT.getTime() + 30 * DAY,
    )
    // 改前无 order_id 唯一约束且 endTime 取 now:2 行且时长漂移 ⇒ 断言红。
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
