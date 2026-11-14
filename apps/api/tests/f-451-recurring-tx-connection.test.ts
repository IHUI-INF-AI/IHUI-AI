// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-451 回归锁(2026-11-13)。
 *
 * 病灶:签约/解约回调的事务块里,辅助函数仍用模块级 `db` 读写:
 *   - `getPlanBillingPeriod(planId)` 在事务内用全局连接读 plans;
 *   - `setUserVipAutoRenew(userId, autoRenew)` 在事务内用全局连接写 user_vips。
 * 于是外层 tx 回滚时,autoRenew / 计费周期读取已独立提交(或读到跨连接快照),
 * 合同状态与用户自动续费状态分裂。
 *
 * 本文件锁:
 *  ① PAPAY.SIGN:事务期间全局 db 的 select/update 调用次数为 0,plans 读取与
 *     user_vips 更新全部落在同一个 tx;
 *  ② PAPAY.TERMINATE:同上,解约的 autoRenew=0 与合同状态同事务;
 *  ③ TRANSACTION.SUCCESS:计费周期读取同样走 tx(不再回落全局 db)。
 *
 * 只 mock db / 微信支付服务 / 订单服务,不触达真实 PG。
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
}))

/** 桩替身世界:按物理表名分桶,分别统计「全局 db」与「事务 tx」的读写次数。 */
vi.mock('../src/db/index.js', async () => {
  const { getTableName } = await import('drizzle-orm')

  type Row = Record<string, unknown>
  type World = Record<string, Row[]>

  const ctl = {
    transactions: 0,
    inTx: false,
    dbSelect: 0,
    dbUpdate: 0,
    dbInsert: 0,
    dbSelectInTx: 0,
    dbUpdateInTx: 0,
    txSelect: 0,
    txUpdate: 0,
    txPlanReads: 0,
  }

  let world: World = {}
  const rowsOf = (name: string): Row[] => world[name] ?? (world[name] = [])

  const makeOps = (kind: 'db' | 'tx'): { select: unknown; insert: unknown; update: unknown } => {
    const select = () => {
      if (kind === 'db') {
        ctl.dbSelect += 1
        if (ctl.inTx) ctl.dbSelectInTx += 1
      } else {
        ctl.txSelect += 1
      }
      let name = ''
      const chain: Row = {
        from: (t: unknown) => {
          name = getTableName(t as never)
          if (kind === 'tx' && name === 'plans') ctl.txPlanReads += 1
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
      if (kind === 'db') ctl.dbInsert += 1
      const name = getTableName(t as never)
      let pending: Row = {}
      const push = () => {
        const table = rowsOf(name)
        const row: Row = { id: table.length + 1, ...pending }
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
      if (kind === 'db') {
        ctl.dbUpdate += 1
        if (ctl.inTx) ctl.dbUpdateInTx += 1
      } else {
        ctl.txUpdate += 1
      }
      const name = getTableName(t as never)
      let patch: Row = {}
      const apply = () => {
        const touched: Row[] = []
        for (const row of rowsOf(name)) {
          for (const [k, v] of Object.entries(patch)) {
            // SQL 表达式不参与本夹具演算
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
        where: () => chain,
        returning: async () => apply(),
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
          Promise.resolve(apply()).then(res, rej),
      }
      return chain
    }

    return { select, insert, update }
  }

  const transaction = async (cb: (tx: unknown) => Promise<unknown>) => {
    ctl.transactions += 1
    ctl.inTx = true
    const snapshot = structuredClone(world)
    try {
      return await cb(makeOps('tx'))
    } catch (e) {
      world = snapshot
      throw e
    } finally {
      ctl.inTx = false
    }
  }

  const db = { ...makeOps('db'), transaction }

  const reset = (init?: { contract?: Row; plan?: Row; userVip?: Row }) => {
    ctl.transactions = 0
    ctl.inTx = false
    ctl.dbSelect = 0
    ctl.dbUpdate = 0
    ctl.dbInsert = 0
    ctl.dbSelectInTx = 0
    ctl.dbUpdateInTx = 0
    ctl.txSelect = 0
    ctl.txUpdate = 0
    ctl.txPlanReads = 0
    world = {
      wechat_pay_contracts: [
        {
          id: 1,
          userId: 'user-451',
          planId: 'plan-451',
          contractId: 'C451',
          outContractCode: 'SC451',
          outTradeNo: 'PRE-451',
          status: 'pending',
          lastChargeStatus: 'pending',
          lastChargeTime: null,
          nextChargeTime: null,
          trialEndAt: null,
          wechatPlanId: '1',
          ...(init?.contract ?? {}),
        },
      ],
      plans: [
        {
          id: 'plan-451',
          price: 9900,
          name: 'VIP 月卡',
          billingPeriod: 'monthly',
          ...(init?.plan ?? {}),
        },
      ],
      user_vips: [
        { id: 1, userId: 'user-451', status: 1, autoRenew: 0, ...(init?.userVip ?? {}) },
      ],
      orders: [],
      wx_pay_notifications: [],
    }
  }

  return {
    db,
    dbRead: db,
    dbClient: {},
    __f451: {
      ctl,
      reset,
      contract: () => rowsOf('wechat_pay_contracts')[0] ?? {},
      userVip: () => rowsOf('user_vips')[0] ?? {},
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

vi.mock('../src/services/order-service.js', () => ({
  placeOrder: mocks.placeOrder,
  completeOrder: mocks.completeOrder,
}))

type Handles = {
  ctl: {
    transactions: number
    inTx: boolean
    dbSelect: number
    dbUpdate: number
    dbInsert: number
    dbSelectInTx: number
    dbUpdateInTx: number
    txSelect: number
    txUpdate: number
    txPlanReads: number
  }
  reset: (init?: {
    contract?: Record<string, unknown>
    plan?: Record<string, unknown>
    userVip?: Record<string, unknown>
  }) => void
  contract: () => Record<string, unknown>
  userVip: () => Record<string, unknown>
  notifications: () => Record<string, unknown>[]
}

const h = (await import('../src/db/index.js')).__f451 as unknown as Handles
const { paymentRecurringRoutes } = await import('../src/routes/payment-recurring.js')

let app: FastifyInstance

function notify(eventType: string, nonce = 'nonce-451') {
  return app.inject({
    method: 'POST',
    url: '/payments/recurring/wechat-notify',
    headers: {
      'content-type': 'application/json',
      'wechatpay-timestamp': '1700000000',
      'wechatpay-nonce': nonce,
      'wechatpay-signature': 'sig-451',
    },
    payload: JSON.stringify({
      event_type: eventType,
      resource: { ciphertext: 'cipher-451', nonce: 'n-451', associated_data: 'a-451' },
    }),
  })
}

/** 事务期间不得回落模块级 db:全局 select/update 计数必须为 0。 */
function expectAllIoOnTx(): void {
  expect(h.ctl.dbSelectInTx).toBe(0)
  expect(h.ctl.dbUpdateInTx).toBe(0)
  expect(h.ctl.dbSelect).toBe(0)
  expect(h.ctl.dbUpdate).toBe(0)
}

describe('F-451 签约/解约事务内不得混用全局连接', () => {
  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(paymentRecurringRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    h.reset()
    mocks.verifyCallbackSignature.mockReturnValue(true)
    mocks.consumeNotifyNonce.mockResolvedValue('ok')
    mocks.decryptCallback.mockReset()
    mocks.placeOrder.mockReset()
    mocks.completeOrder.mockReset()
  })

  it('① PAPAY.SIGN:计费周期读取与 autoRenew=1 全部落在 tx', async () => {
    mocks.decryptCallback.mockReturnValue({
      contract_id: 'C451',
      out_contract_code: 'SC451',
    })

    const res = await notify('PAPAY.SIGN')

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ message: 'SUCCESS' })
    expect(h.ctl.transactions).toBe(1)
    expectAllIoOnTx()
    // plans 的计费周期由 tx 读取(而非回落全局 db)
    expect(h.ctl.txPlanReads).toBe(1)
    // 合同状态 + user_vips.autoRenew 两次写均落在 tx
    expect(h.ctl.txUpdate).toBe(2)
    expect(h.contract()).toMatchObject({ status: 'active' })
    expect(h.contract().nextChargeTime).toBeInstanceOf(Date)
    expect((h.contract().nextChargeTime as Date).getTime()).toBeGreaterThan(Date.now())
    expect(h.userVip()).toMatchObject({ autoRenew: 1 })
  })

  it('② PAPAY.TERMINATE:解约状态与 autoRenew=0 同事务,不碰全局连接', async () => {
    h.reset({ contract: { status: 'active', lastChargeStatus: 'success' } })
    mocks.decryptCallback.mockReturnValue({ contract_id: 'C451' })

    const res = await notify('PAPAY.TERMINATE')

    expect(res.statusCode).toBe(200)
    expect(h.ctl.transactions).toBe(1)
    expectAllIoOnTx()
    expect(h.ctl.txUpdate).toBe(2)
    expect(h.contract()).toMatchObject({ status: 'cancelled', contractState: 'TERMINATED' })
    expect(h.userVip()).toMatchObject({ autoRenew: 0 })
  })

  it('③ TRANSACTION.SUCCESS:计费周期读取同样走 tx,无全局读写', async () => {
    h.reset({ contract: { status: 'active', outTradeNo: 'PRE-451' } })
    mocks.decryptCallback.mockReturnValue({
      out_trade_no: 'WX451CHG',
      contract_id: 'C451',
      transaction_id: 'TX451',
    })
    mocks.placeOrder.mockResolvedValue({ id: 1, orderNo: 'WX451ORD' })
    mocks.completeOrder.mockResolvedValue({ success: true })

    const res = await notify('TRANSACTION.SUCCESS')

    expect(res.statusCode).toBe(200)
    expect(h.ctl.transactions).toBe(1)
    expectAllIoOnTx()
    // 一次来自 getPlanBillingPeriod,一次来自事务内取完整 plan
    expect(h.ctl.txPlanReads).toBe(2)
    expect(h.contract()).toMatchObject({ lastChargeStatus: 'success', outTradeNo: 'WX451CHG' })
  })
})
