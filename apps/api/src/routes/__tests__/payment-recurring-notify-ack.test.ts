// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const h = vi.hoisted(() => ({
  verify: vi.fn(() => true),
  consume: vi.fn(async (): Promise<'ok' | 'replayed' | 'unavailable' | 'absent'> => 'ok'),
  release: vi.fn(async () => undefined),
  decrypt: vi.fn((): Record<string, unknown> => {
    throw new Error('kaboom: 模拟解密/业务处理失败')
  }),
  placeOrder: vi.fn(async () => ({ id: 1, orderNo: 'ORD-1' })),
  completeOrder: vi.fn(async () => undefined),
  // 扣款成功路径需要状态化 db:契约行会被事务内 UPDATE 改写,
  // 这样第二次重投才能命中「lastChargeStatus=success + 幂等键相同」的闸门。
  state: {
    contract: null as Record<string, unknown> | null,
    plan: { id: 'P1', price: 9.9, name: '月卡' } as Record<string, unknown>,
    notifications: 0,
    orderPatches: 0,
  },
}))

vi.mock('../../services/wechat-pay.js', () => ({
  signContract: vi.fn(),
  cancelContract: vi.fn(),
  queryContract: vi.fn(),
  verifyCallbackSignature: h.verify,
  consumeNotifyNonce: h.consume,
  releaseNotifyNonce: h.release,
  decryptCallback: h.decrypt,
  generateOutTradeNo: vi.fn(() => 'TEST-ORDER-NO'),
  parseContractExpiredTime: vi.fn(() => null),
}))

vi.mock('../../services/order-service.js', () => ({
  placeOrder: h.placeOrder,
  completeOrder: h.completeOrder,
}))

vi.mock('../../services/subscription-service.js', () => ({
  scanAndChargeDueContracts: vi.fn(),
  chargeOneContractNow: vi.fn(),
}))

vi.mock('../../db/index.js', async () => {
  const { wechatPayContracts, plans } = await import('@ihui/database')

  const selectChain = (arg?: unknown) => {
    let table: unknown
    const rows = (): unknown[] => {
      if (table === wechatPayContracts) {
        return h.state.contract ? [{ ...h.state.contract }] : []
      }
      if (table === plans) {
        // getPlanBillingPeriod 传 { billingPeriod } 投影;事务内查方案传整行
        return arg ? [{ billingPeriod: 'month' }] : [h.state.plan]
      }
      return []
    }
    const chain = {
      from: (t: unknown) => {
        table = t
        return chain
      },
      where: () => chain,
      for: () => chain,
      limit: async () => rows(),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(rows()).then(res, rej),
    }
    return chain
  }

  const makeTx = () => ({
    select: (arg?: unknown) => selectChain(arg),
    update: () => ({
      set: (patch: Record<string, unknown>) => {
        if ('lastChargeStatus' in patch) {
          if (h.state.contract) Object.assign(h.state.contract, patch)
        } else {
          h.state.orderPatches++
        }
        return { where: async () => undefined }
      },
    }),
    insert: () => ({
      values: async () => {
        h.state.notifications++
      },
    }),
  })

  return {
    db: {
      select: (arg?: unknown) => selectChain(arg),
      insert: () => ({
        values: async () => {
          h.state.notifications++
        },
      }),
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(makeTx()),
    },
  }
})

vi.mock('../../plugins/auth.js', () => ({ authenticate: vi.fn() }))

vi.mock('../../utils/swagger.js', () => ({
  buildSchema: () => ({}),
  swaggerSchemas: { callback: {} },
}))

import {
  paymentRecurringRoutes,
  addMonthsClamped,
  calculateNextChargeTime,
  resolveChargeIdempotencyKey,
} from '../payment-recurring.js'

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('POST /payments/recurring/wechat-notify — 失败必须可重试', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(paymentRecurringRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    h.verify.mockReturnValue(true)
    h.consume.mockResolvedValue('ok')
  })

  const notify = () =>
    app.inject({
      method: 'POST',
      url: '/api/payments/recurring/wechat-notify',
      headers: {
        'wechatpay-timestamp': '1762400000',
        'wechatpay-nonce': 'nonce-abc',
        'wechatpay-signature': 'sig',
      },
      // 必须携带密文才会进入 decryptCallback;原用例靠 db 缺失抛错才返 500,
      // 现 db 已状态化,改为让解密本身抛错,才真正覆盖「业务失败必须可重试」。
      payload: {
        event_type: 'TRANSACTION.SUCCESS',
        resource: { ciphertext: 'cipher', nonce: 'rnonce' },
      },
    })

  it('业务处理抛错:回 500 FAIL 并释放已占位 nonce(不得静默 200 SUCCESS)', async () => {
    const res = await notify()
    expect(res.statusCode).toBe(500)
    expect(res.json().code).toBe('FAIL')
    expect(h.release).toHaveBeenCalledTimes(1)
    expect(h.release).toHaveBeenCalledWith('recurring', '1762400000', 'nonce-abc')
  })

  it('重放通知(replayed):200 SUCCESS 且不得重复处理/释放', async () => {
    h.consume.mockResolvedValue('replayed')
    const res = await notify()
    expect(res.statusCode).toBe(200)
    expect(h.release).not.toHaveBeenCalled()
    expect(h.decrypt).not.toHaveBeenCalled()
  })

  it('去重库不可用(unavailable):500 FAIL,不放行业务', async () => {
    h.consume.mockResolvedValue('unavailable')
    const res = await notify()
    expect(res.statusCode).toBe(500)
    expect(h.decrypt).not.toHaveBeenCalled()
  })
})

// =============================================================================
// T-2 续费日期推进
// =============================================================================

describe('T-2 续费日期:月末夹取 + 锚点稳定', () => {
  it('1/31 +1 月 → 2/28(平年,不得溢出到 3/3)', () => {
    expect(ymd(addMonthsClamped(new Date(2026, 0, 31), 1))).toBe('2026-02-28')
  })

  it('8/31 +1 月 → 9/30(目标月只有 30 天)', () => {
    expect(ymd(addMonthsClamped(new Date(2026, 7, 31), 1))).toBe('2026-09-30')
  })

  it('12/31 +1 月 → 次年 1/31(跨年且目标月足够长)', () => {
    expect(ymd(addMonthsClamped(new Date(2026, 11, 31), 1))).toBe('2027-01-31')
  })

  it('闰年:1/31 +1 月 → 2/29;2/29 +1 月 → 3/29', () => {
    expect(ymd(addMonthsClamped(new Date(2024, 0, 31), 1))).toBe('2024-02-29')
    expect(ymd(addMonthsClamped(new Date(2024, 1, 29), 1))).toBe('2024-03-29')
  })

  it('按年续费:2024-02-29 +1 年 → 2025-02-28(不得溢出到 3/1)', () => {
    expect(ymd(calculateNextChargeTime('year', new Date(2024, 1, 29)))).toBe('2025-02-28')
  })

  it('延迟回调不改变锚点:基数取契约已有 nextChargeTime,而非回调到达时间', () => {
    const anchor = new Date(2026, 0, 31)
    // 若以「回调到达时间」为基数,延迟到 2/3 才回调会算出 3/3,续费日逐月漂移
    const delayedArrival = new Date(2026, 1, 3)
    expect(ymd(calculateNextChargeTime('month', anchor))).toBe('2026-02-28')
    expect(ymd(addMonthsClamped(delayedArrival, 1))).toBe('2026-03-03')
  })
})

// =============================================================================
// T-1 扣款幂等键判定表
// =============================================================================

describe('T-1 扣款幂等键判定表', () => {
  it('仅 trade_no → out_trade_no', () => {
    expect(resolveChargeIdempotencyKey({ outTradeNo: 'T1' })).toEqual({
      kind: 'outTradeNo',
      value: 'T1',
    })
  })

  it('仅 contract_code + transaction_id → transaction_id', () => {
    expect(resolveChargeIdempotencyKey({ outContractCode: 'OC1', transactionId: 'TX1' })).toEqual({
      kind: 'transactionId',
      value: 'TX1',
    })
  })

  it('trade_no 与 contract_code 同时存在 → 优先 out_trade_no', () => {
    expect(
      resolveChargeIdempotencyKey({
        outTradeNo: 'T1',
        outContractCode: 'OC1',
        transactionId: 'TX1',
      }),
    ).toEqual({ kind: 'outTradeNo', value: 'T1' })
  })

  it('仅 contract_code(无 transaction_id)→ 不可判定,需真实报文验证', () => {
    expect(resolveChargeIdempotencyKey({ outContractCode: 'OC1' })).toEqual({
      kind: 'undetermined',
    })
  })

  it('三者皆无 → 不可判定', () => {
    expect(resolveChargeIdempotencyKey({})).toEqual({ kind: 'undetermined' })
  })

  it('out_contract_code 永不作为扣款幂等键(会跨期复用导致漏发)', () => {
    const key = resolveChargeIdempotencyKey({ outContractCode: 'OC1', transactionId: 'TX1' })
    expect(key.kind).not.toBe('outTradeNo')
    expect(key).not.toEqual({ kind: 'outTradeNo', value: 'OC1' })
  })
})

// =============================================================================
// T-1 路由级:首次必入账 + 重投不双写
// =============================================================================

describe('T-1 扣款回调:首次入账且重投不双写', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(paymentRecurringRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    h.verify.mockReturnValue(true)
    h.consume.mockResolvedValue('ok')
    h.state.contract = {
      id: 1,
      userId: 'U1',
      planId: 'P1',
      contractId: 'C1',
      outContractCode: 'OC1',
      outTradeNo: null,
      lastChargeStatus: null,
      nextChargeTime: null,
      trialEndAt: null,
    }
    h.state.notifications = 0
    h.state.orderPatches = 0
  })

  const notifyWith = (nonce: string) =>
    app.inject({
      method: 'POST',
      url: '/api/payments/recurring/wechat-notify',
      headers: {
        'wechatpay-timestamp': '1762400000',
        'wechatpay-nonce': nonce,
        'wechatpay-signature': 'sig',
      },
      payload: {
        event_type: 'TRANSACTION.SUCCESS',
        resource: { ciphertext: 'cipher', nonce: 'rnonce' },
      },
    })

  it('仅 trade_no:首次入账,重投(新 nonce)不双写', async () => {
    h.decrypt.mockReturnValue({ contract_id: 'C1', out_trade_no: 'T1' })

    const first = await notifyWith('n1')
    expect(first.statusCode).toBe(200)
    expect(h.placeOrder).toHaveBeenCalledTimes(1)
    expect(h.completeOrder).toHaveBeenCalledTimes(1)

    const replay = await notifyWith('n2')
    expect(replay.statusCode).toBe(200)
    expect(h.placeOrder).toHaveBeenCalledTimes(1)
    expect(h.state.contract?.outTradeNo).toBe('T1')
  })

  it('仅 contract_code + transaction_id:首次入账,重投不双写(键存 transaction_id)', async () => {
    h.decrypt.mockReturnValue({
      contract_id: 'C1',
      out_contract_code: 'OC1',
      transaction_id: 'TX1',
    })

    const first = await notifyWith('n1')
    expect(first.statusCode).toBe(200)
    expect(h.placeOrder).toHaveBeenCalledTimes(1)

    const replay = await notifyWith('n2')
    expect(replay.statusCode).toBe(200)
    expect(h.placeOrder).toHaveBeenCalledTimes(1)
    expect(h.state.contract?.outTradeNo).toBe('TX1')
  })

  it('两者都有:首次入账,重投不双写(优先 out_trade_no)', async () => {
    h.decrypt.mockReturnValue({
      contract_id: 'C1',
      out_contract_code: 'OC1',
      out_trade_no: 'T1',
      transaction_id: 'TX1',
    })

    const first = await notifyWith('n1')
    expect(first.statusCode).toBe(200)
    expect(h.placeOrder).toHaveBeenCalledTimes(1)

    const replay = await notifyWith('n2')
    expect(replay.statusCode).toBe(200)
    expect(h.placeOrder).toHaveBeenCalledTimes(1)
    expect(h.state.contract?.outTradeNo).toBe('T1')
  })

  it('仅 contract_id(无 trade_no / transaction_id):无法判定幂等,已列为需真实报文验证', async () => {
    // 该组合真实报文是否携带 transaction_id 尚未验证;当前只有 nonce 15 分钟兜底,
    // 超出窗口的重投仍会二次入账 —— 用断言把这个残余风险钉住,不宣称已完全幂等。
    h.decrypt.mockReturnValue({ contract_id: 'C1' })

    await notifyWith('n1')
    expect(h.placeOrder).toHaveBeenCalledTimes(1)

    await notifyWith('n2')
    expect(h.placeOrder).toHaveBeenCalledTimes(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
