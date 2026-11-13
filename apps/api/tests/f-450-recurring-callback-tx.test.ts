// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-450 回归锁(2026-11-13)。
 *
 * 病灶:代扣成功回调在**外层事务**里调 placeOrder/completeOrder。二者若自行
 * `db.transaction`,内层会先独立提交/回滚 —— 外层后续失败时「订单已 paid、契约未
 * 标记 success」,微信重试会再建一单再履约一次(重复发权益),幂等与回滚双双失真。
 *
 * 本文件锁:
 *  ① 回调链上 placeOrder/completeOrder 收到的是**同一个外层 tx**,全程只有一次 db.transaction;
 *  ② 链上任一步失败 ⇒ 外层整体回滚,契约幂等键(lastChargeStatus/outTradeNo)保持未消费,
 *     下一次回调仍能完整履约(不丢单、不重复);
 *  ③ 重复回调只生效一次(同一 outTradeNo 不再建单);
 *  ④ 无外层事务的其它调用点仍自建事务(防误伤);completeOrder(tx) 内的 token 充值并入外层。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.WX_PAY_NOTIFY_URL ??= 'https://example.com/wx/notify'
})

const mocks = vi.hoisted(() => ({
  verifyCallbackSignature: vi.fn(() => true),
  consumeNotifyNonce: vi.fn(async () => 'ok' as 'ok' | 'replayed' | 'unavailable'),
  decryptCallback: vi.fn(),
  placeOrder: vi.fn(),
  completeOrder: vi.fn(),
  sendNoticeSmsToUser: vi.fn(async () => undefined),
}))

/** 极简世界状态库:按物理表名分桶,transaction 失败整包回滚。 */
vi.mock('../src/db/index.js', async () => {
  const { getTableName } = await import('drizzle-orm')
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()

  type Row = Record<string, unknown>
  type World = { tables: Record<string, Row[]> }

  const ctl = { transactions: 0, lastTx: null as unknown }
  let world: World = { tables: {} }

  const rowsOf = (name: string): Row[] => world.tables[name] ?? []
  const condParams = (cond: unknown): unknown[] => {
    try {
      return dialect.sqlToQuery(cond as never).params
    } catch {
      return []
    }
  }
  /** 谓词求值:测试场景每表 0~1 行,按「条件参数命中行值」判定,状态条件单独收紧。 */
  const hit = (row: Row, cond: unknown): boolean => {
    const scalars = condParams(cond).filter(
      (p) => typeof p === 'string' || typeof p === 'number' || typeof p === 'boolean',
    )
    if (scalars.length === 0) return true
    const statuses = scalars.filter(
      (p) => typeof p === 'string' && ['pending', 'paid', 'cancelled', 'refunded'].includes(p),
    )
    if (typeof row.status === 'string' && statuses.length > 0 && !statuses.includes(row.status)) {
      return false
    }
    const values = Object.values(row).filter(
      (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean',
    )
    return scalars.some((p) => values.includes(p))
  }

  const select = (_cols?: unknown) => {
    let name = ''
    const chain: Row = {
      from: (t: unknown) => {
        name = getTableName(t as never)
        return chain
      },
      where: () => chain,
      for: () => chain,
      orderBy: () => chain,
      limit: async (n?: number) =>
        rowsOf(name)
          .slice(0, n)
          .map((r) => ({ ...r })),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
        Promise.resolve(rowsOf(name).map((r) => ({ ...r }))).then(res, rej),
    }
    return chain
  }

  const insert = (t: unknown) => {
    const name = getTableName(t as never)
    let pending: Row = {}
    const push = () => {
      const table = world.tables[name] ?? (world.tables[name] = [])
      const row: Row = { id: `${name}-${table.length + 1}`, ...pending }
      table.push(row)
      return { ...row }
    }
    const chain: Row = {
      values: (v: Row) => {
        pending = v
        return chain
      },
      onConflictDoNothing: () => chain,
      returning: async () => [push()],
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
        Promise.resolve(push()).then(res, rej),
    }
    return chain
  }

  const update = (t: unknown) => {
    const name = getTableName(t as never)
    let patch: Row = {}
    let cond: unknown
    const apply = () => {
      const touched: Row[] = []
      for (const row of rowsOf(name)) {
        if (!hit(row, cond)) continue
        for (const [k, v] of Object.entries(patch)) {
          // SQL 表达式(如 token_quantity + n)不参与本夹具的数值演算,保留原值即可
          if (v && typeof v === 'object' && !(v instanceof Date)) continue
          row[k] = v
        }
        touched.push({ ...row })
      }
      return touched
    }
    const chain: Row = {
      set: (p: Row) => {
        patch = p
        return chain
      },
      where: (c: unknown) => {
        cond = c
        return chain
      },
      returning: async () => apply(),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
        Promise.resolve(apply()).then(res, rej),
    }
    return chain
  }

  const transaction = async (cb: (tx: unknown) => Promise<unknown>) => {
    ctl.transactions += 1
    const snapshot = structuredClone(world)
    const tx = { select, insert, update }
    ctl.lastTx = tx
    try {
      return await cb(tx)
    } catch (e) {
      // 真实 PG 语义:事务回调抛错 ⇒ 整包回滚
      world = snapshot
      throw e
    }
  }

  const reset = (init?: { contract?: Row; plan?: Row; orders?: Row[] }) => {
    ctl.transactions = 0
    ctl.lastTx = null
    world = {
      tables: {
        wechat_pay_contracts: [
          {
            id: 1,
            userId: 'user-450',
            planId: 'plan-450',
            contractId: 'C450',
            outTradeNo: 'PRE-450',
            status: 'active',
            lastChargeStatus: 'pending',
            lastChargeTime: null,
            nextChargeTime: new Date('2026-12-01T00:00:00Z'),
            trialEndAt: null,
            wechatPlanId: '1',
            ...(init?.contract ?? {}),
          },
        ],
        plans: [
          {
            id: 'plan-450',
            price: 9900,
            name: 'VIP 月卡',
            billingPeriod: 'monthly',
            ...(init?.plan ?? {}),
          },
        ],
        orders: [...(init?.orders ?? [])],
        wx_pay_notifications: [],
        user_margins: [],
        token_flows: [],
        edu_payment_record: [],
        edu_orders: [],
      },
    }
  }

  const db = { select, insert, update, transaction }

  return {
    db,
    dbRead: db,
    dbClient: {},
    __f450: {
      ctl,
      reset,
      setRows: (name: string, rows: Row[]) => {
        world.tables[name] = rows
      },
      contract: () => rowsOf('wechat_pay_contracts')[0],
      orders: () => rowsOf('orders'),
      tokenFlows: () => rowsOf('token_flows'),
      notifications: () => rowsOf('wx_pay_notifications'),
    },
  }
})

vi.mock('../src/services/wechat-pay.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    verifyCallbackSignature: mocks.verifyCallbackSignature,
    consumeNotifyNonce: mocks.consumeNotifyNonce,
    decryptCallback: mocks.decryptCallback,
  }
})

// 真实 placeOrder/completeOrder(验证 tx 透传与自开事务的分流),仅记录调用参数
vi.mock('../src/services/order-service.js', () => ({
  placeOrder: mocks.placeOrder,
  completeOrder: mocks.completeOrder,
}))

vi.mock('../src/services/sms-notify.js', () => ({
  sendNoticeSmsToUser: mocks.sendNoticeSmsToUser,
}))

type Handles = {
  ctl: { transactions: number; lastTx: unknown }
  reset: (init?: {
    contract?: Record<string, unknown>
    plan?: Record<string, unknown>
    orders?: Record<string, unknown>[]
  }) => void
  setRows: (name: string, rows: Record<string, unknown>[]) => void
  contract: () => Record<string, unknown>
  orders: () => Record<string, unknown>[]
  tokenFlows: () => Record<string, unknown>[]
  notifications: () => Record<string, unknown>[]
}

type RealOrderService = {
  placeOrder: (
    input: Record<string, unknown>,
    operatorId?: string | null,
    tx?: unknown,
  ) => Promise<{ orderNo: string }>
  completeOrder: (orderNo: string, tradeNo?: string, tx?: unknown) => Promise<{ success: boolean }>
}

const h = (await import('../src/db/index.js')).__f450 as unknown as Handles
const dbModule = (await import('../src/db/index.js')) as unknown as {
  db: { transaction: (cb: (tx: unknown) => Promise<unknown>) => Promise<unknown> }
}
const { placeOrder, completeOrder } =
  (await import('../src/services/order-service.js')) as unknown as RealOrderService
const { paymentRecurringRoutes } = await import('../src/routes/payment-recurring.js')

const TX_NO = 'WX450CHG1'

function chargeNotify(nonce = 'nonce-450') {
  return app.inject({
    method: 'POST',
    url: '/payments/recurring/wechat-notify',
    headers: {
      'content-type': 'application/json',
      'wechatpay-timestamp': '1700000000',
      'wechatpay-nonce': nonce,
      'wechatpay-signature': 'sig-450',
    },
    payload: JSON.stringify({
      event_type: 'TRANSACTION.SUCCESS',
      resource: { ciphertext: 'cipher-450', nonce: 'n-450', associated_data: 'a-450' },
    }),
  })
}

let app: FastifyInstance

describe('F-450 代扣回调全程共用外层事务', () => {
  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(paymentRecurringRoutes)
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(async () => {
    // 每次绑定**真实**实现:mock 只承担"记录参数 + 可单次篡改"的角色
    const real = (await vi.importActual(
      '../src/services/order-service.js',
    )) as unknown as RealOrderService
    mocks.placeOrder.mockReset()
    mocks.placeOrder.mockImplementation(real.placeOrder)
    mocks.completeOrder.mockReset()
    mocks.completeOrder.mockImplementation(real.completeOrder)
    h.reset()
    mocks.verifyCallbackSignature.mockReturnValue(true)
    mocks.consumeNotifyNonce.mockResolvedValue('ok')
    mocks.decryptCallback.mockReturnValue({
      out_trade_no: TX_NO,
      contract_id: 'C450',
      transaction_id: 'TX450',
    })
    mocks.sendNoticeSmsToUser.mockClear()
  })

  it('① 建单/完成收到同一个外层 tx,且全程只有一次 db.transaction', async () => {
    const res = await chargeNotify()

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ message: 'SUCCESS' })
    // 只有回调自身那一次外层事务:placeOrder/completeOrder 未再开内层事务
    expect(h.ctl.transactions).toBe(1)
    expect(mocks.placeOrder).toHaveBeenCalledTimes(1)
    expect(mocks.completeOrder).toHaveBeenCalledTimes(1)
    const outerTx = h.ctl.lastTx
    expect(mocks.placeOrder.mock.calls[0]?.[2]).toBe(outerTx)
    expect(mocks.completeOrder.mock.calls[0]?.[2]).toBe(outerTx)
    // 同一事务内落库:订单 paid + 契约幂等键置 success
    expect(h.orders()).toHaveLength(1)
    expect(h.orders()[0]).toMatchObject({ status: 'paid', userId: 'user-450' })
    expect(h.contract()).toMatchObject({ lastChargeStatus: 'success', outTradeNo: TX_NO })
  })

  it('② 内层失败 ⇒ 外层整体回滚,幂等键未消费,重试可完整履约', async () => {
    // 模拟 placeOrder 已写单、completeOrder 失败(内层一步失败)
    mocks.completeOrder.mockResolvedValueOnce({ success: false, reason: 'BROKEN' })

    const first = await chargeNotify()
    expect(first.statusCode).toBe(200)
    // 订单插入被外层回滚,契约仍停在 pending/success 之前 —— 幂等键未被消费
    expect(h.ctl.transactions).toBe(1)
    expect(h.orders()).toHaveLength(0)
    expect(h.contract()).toMatchObject({ lastChargeStatus: 'pending', outTradeNo: 'PRE-450' })

    // 微信重投:不做任何人工修复也能完整履约一次
    const second = await chargeNotify('nonce-450-retry')
    expect(second.statusCode).toBe(200)
    expect(h.orders()).toHaveLength(1)
    expect(h.orders()[0]).toMatchObject({ status: 'paid' })
    expect(h.contract()).toMatchObject({ lastChargeStatus: 'success', outTradeNo: TX_NO })
  })

  it('③ 重复回调只生效一次(同一 outTradeNo 不再建单)', async () => {
    await chargeNotify()
    const afterFirst = h.ctl.transactions

    const again = await chargeNotify('nonce-450-replay')

    expect(again.statusCode).toBe(200)
    // 第二次回调仍各用一次外层事务(无内层叠加),但因幂等键命中不再建单/履约
    expect(h.ctl.transactions - afterFirst).toBe(1)
    expect(mocks.placeOrder).toHaveBeenCalledTimes(1)
    expect(mocks.completeOrder).toHaveBeenCalledTimes(1)
    expect(h.orders()).toHaveLength(1)
  })

  it('④ 无外层事务的其它调用点仍自建事务', async () => {
    expect(h.ctl.transactions).toBe(0)

    const order = await placeOrder(
      { userId: 'user-other', amount: 100, orderType: 1, payType: 'wechat' },
      null,
    )
    expect(h.ctl.transactions).toBe(1)
    expect(mocks.placeOrder.mock.calls[0]?.[2]).toBeUndefined()

    const done = await completeOrder(order.orderNo, 'TX-OTHER')
    expect(done.success).toBe(true)
    expect(h.ctl.transactions).toBe(2)
  })

  it('⑤ completeOrder(tx) 内的 token 充值并入外层,不另开事务', async () => {
    h.setRows('orders', [
      {
        id: 'order-token-450',
        orderNo: 'WX450TOKEN',
        userId: 'user-token',
        amount: 500,
        status: 'pending',
        orderType: 3,
        paymentMethod: 'wechat',
        productId: null,
      },
    ])

    const result = await dbModule.db.transaction((tx) =>
      completeOrder('WX450TOKEN', 'TX-TOKEN', tx),
    )

    expect((result as { success: boolean }).success).toBe(true)
    // 只有测试自己开的那一次事务:rechargeToken 收到 tx 后不再 db.transaction
    expect(h.ctl.transactions).toBe(1)
    expect(h.tokenFlows()).toHaveLength(1)
    expect(h.tokenFlows()[0]).toMatchObject({ relatedOrderNo: 'WX450TOKEN', opType: 0 })
  })
})
