// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-17:提现回调(POST /api/payments/withdrawal/notify)的失败路径不得 ACK SUCCESS,
 * 且报文级去重标记(nonce)必须在业务事务成功之后才消费,保证微信重投可重放。
 *
 * 缺陷(修复前):
 *  - 先 consumeNotifyNonce('withdrawal', timestamp, nonce),再跑业务事务;
 *  - 事务抛错(死锁/连接中断/frozen_quantity 不足)时 catch 只 log 并回 { code: 'SUCCESS' };
 *  ⇒ 微信停止重投,withdrawalFlows 停在 pending、frozen_quantity 永不释放;
 *  ⇒ 即便重投,同头 nonce 已被消费,会被判 'replayed' 直接 SUCCESS,业务永不重放。
 *
 * 本文件钉四格(全部用 fastify inject + mock db/nonce,不连真实 DB/Redis):
 *  ① 事务抛错 ⇒ 500 + FAIL,且 nonce 一次都没消费(没有去重标记 ⇒ 天然可重放);
 *  ② 失败后同头重投 ⇒ 事务重放成功,SUCCESS,且 nonce 只消费一次;
 *  ③ 成功后重复投递 ⇒ nonce 判 'replayed' 回 SUCCESS,但冻结不再二次释放(幂等);
 *  ④ 事务成功但 nonce 存储不可用 ⇒ 500 + FAIL(不吞成 SUCCESS)。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { withdrawalFlows } from '@ihui/database'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

const { mockTransaction, mockVerifyCallbackSignature, mockConsumeNotifyNonce } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockVerifyCallbackSignature: vi.fn(),
  mockConsumeNotifyNonce: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: { transaction: mockTransaction },
}))

vi.mock('../src/services/wechat-pay.js', () => ({
  verifyCallbackSignature: mockVerifyCallbackSignature,
  consumeNotifyNonce: mockConsumeNotifyNonce,
  isWechatPayConfigured: vi.fn().mockReturnValue(false),
  jsapiPrepay: vi.fn(),
  buildJsapiSign: vi.fn(),
  deductRecurring: vi.fn(),
  generateOutTradeNo: vi.fn(),
}))

vi.mock('../src/services/alipay.js', () => ({
  isAlipayConfigured: vi.fn().mockReturnValue(false),
  buildSignedUrl: vi.fn(),
}))

vi.mock('../src/services/order-service.js', () => ({ placeOrder: vi.fn() }))

import { paymentExtendedRoutes } from '../src/routes/payment-extended.js'

const NOTIFY_URL = '/api/payments/withdrawal/notify'
const TS = '1730000000'
const NONCE = 'nonce-f17'
const BODY = '{"out_bill_no":"BILL-F17","state":"SUCCESS","transfer_bill_no":"TR-F17"}'

function notifyHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    'wechatpay-timestamp': TS,
    'wechatpay-nonce': NONCE,
    'wechatpay-signature': 'sig-f17',
  }
}

interface FlowRow {
  id: string
  status: number
  amount: number
  userId: string | null
}

interface TxState {
  flow: FlowRow | null
  flowUpdates: number
  marginUpdates: number
}

/** 记录「事务回调完成」与「nonce 消费」的先后,用于钉住 nonce 后置 */
const events: string[] = []
/** 模拟 Redis SET NX:同一 (endpoint, timestamp, nonce) 只成功一次 */
const consumedNonces = new Set<string>()
let txState: TxState

interface TxChain {
  from: () => TxChain
  where: () => TxChain
  for: () => TxChain
  limit: () => Promise<FlowRow[]>
}

/** drizzle 链式查询替身:select…for('update').limit(1) 返回当前流水行 */
function makeTx(state: TxState) {
  const selectChain: TxChain = {
    from: () => selectChain,
    where: () => selectChain,
    for: () => selectChain,
    limit: async () => (state.flow ? [state.flow] : []),
  }
  return {
    select: () => selectChain,
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          if (table === withdrawalFlows) {
            state.flowUpdates += 1
            if (state.flow && typeof values.status === 'number') state.flow.status = values.status
          } else {
            state.marginUpdates += 1
          }
        },
      }),
    }),
  }
}

function defaultTransactionImpl() {
  return async (cb: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
    const result = await cb(makeTx(txState))
    events.push('tx-commit')
    return result
  }
}

describe('F-17 提现回调:失败不 ACK SUCCESS 且 nonce 可重放', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(paymentExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    events.length = 0
    consumedNonces.clear()
    txState = {
      flow: { id: 'flow-f17', status: 0, amount: 100, userId: 'user-f17' },
      flowUpdates: 0,
      marginUpdates: 0,
    }

    mockVerifyCallbackSignature.mockReset().mockReturnValue(true)
    mockConsumeNotifyNonce.mockReset().mockImplementation(
      async (endpoint: string, timestamp: string, nonce: string) => {
        if (!endpoint || !timestamp || !nonce) return 'absent'
        const key = `${endpoint}|${timestamp}|${nonce}`
        if (consumedNonces.has(key)) return 'replayed'
        consumedNonces.add(key)
        events.push('nonce-consume')
        return 'ok'
      },
    )
    mockTransaction.mockReset().mockImplementation(defaultTransactionImpl())
  })

  it('① 事务抛错 ⇒ 500 FAIL,nonce 未消费(可重放),流水仍为 pending', async () => {
    mockTransaction.mockRejectedValueOnce(new Error('deadlock detected, tx rolled back'))

    const res = await app.inject({
      method: 'POST',
      url: NOTIFY_URL,
      headers: notifyHeaders(),
      payload: BODY,
    })

    // 旧行为:{ code: 'SUCCESS' } ⇒ 微信停止重投,资金永久冻结。
    expect(res.statusCode).toBe(500)
    expect(res.json().code).toBe('FAIL')
    // 变异自证:把 consumeNotifyNonce 移回事务之前(修复前顺序),这里会变成已消费 ⇒ 翻红。
    expect(mockConsumeNotifyNonce).not.toHaveBeenCalled()
    expect(consumedNonces.size).toBe(0)
    expect(txState.flowUpdates).toBe(0)
    expect(txState.marginUpdates).toBe(0)
    expect(txState.flow?.status).toBe(0)
  })

  it('② 失败后同头重投 ⇒ 重放成功 SUCCESS,nonce 仅消费一次', async () => {
    mockTransaction.mockRejectedValueOnce(new Error('connection terminated unexpectedly'))

    const first = await app.inject({
      method: 'POST',
      url: NOTIFY_URL,
      headers: notifyHeaders(),
      payload: BODY,
    })
    expect(first.statusCode).toBe(500)
    expect(first.json().code).toBe('FAIL')

    // 微信按重试曲线原样重投同一份报文(同 timestamp/nonce/signature)。
    const second = await app.inject({
      method: 'POST',
      url: NOTIFY_URL,
      headers: notifyHeaders(),
      payload: BODY,
    })

    expect(second.statusCode).toBe(200)
    expect(second.json()).toMatchObject({ code: 'SUCCESS', message: 'OK' })
    // 若首次失败时已消费 nonce,第二次会走 'replayed' 分支回「重复通知」而不再执行业务 ⇒ 这里翻红。
    expect(second.json().message).not.toBe('重复通知')
    expect(mockConsumeNotifyNonce).toHaveBeenCalledTimes(1)
    expect(mockConsumeNotifyNonce).toHaveBeenCalledWith('withdrawal', TS, NONCE)
    expect(txState.flow?.status).toBe(2)
    expect(txState.flowUpdates).toBe(1)
    expect(txState.marginUpdates).toBe(1)
    expect(events).toEqual(['tx-commit', 'nonce-consume'])
  })

  it('③ 成功后重复投递 ⇒ SUCCESS 但不二次释放冻结,nonce 只成功消费一次', async () => {
    const first = await app.inject({
      method: 'POST',
      url: NOTIFY_URL,
      headers: notifyHeaders(),
      payload: BODY,
    })
    expect(first.statusCode).toBe(200)
    expect(first.json()).toMatchObject({ code: 'SUCCESS', message: 'OK' })
    expect(txState.flow?.status).toBe(2)
    expect(txState.flowUpdates).toBe(1)
    expect(txState.marginUpdates).toBe(1)

    const replay = await app.inject({
      method: 'POST',
      url: NOTIFY_URL,
      headers: notifyHeaders(),
      payload: BODY,
    })

    expect(replay.statusCode).toBe(200)
    expect(replay.json()).toMatchObject({ code: 'SUCCESS', message: '重复通知' })
    // 第二次事务命中 status=2 ⇒ 提前返回,不再 update 流水/保证金(frozen 不会被扣两次)。
    expect(txState.flowUpdates).toBe(1)
    expect(txState.marginUpdates).toBe(1)
    // nonce 被两次询问,但 SET NX 只成功一次。
    expect(mockConsumeNotifyNonce).toHaveBeenCalledTimes(2)
    expect(consumedNonces.size).toBe(1)
    expect(events).toEqual(['tx-commit', 'nonce-consume', 'tx-commit'])
  })

  it('④ 事务成功但 nonce 存储不可用 ⇒ 500 FAIL(不吞成 SUCCESS)', async () => {
    mockConsumeNotifyNonce.mockResolvedValueOnce('unavailable')

    const res = await app.inject({
      method: 'POST',
      url: NOTIFY_URL,
      headers: notifyHeaders(),
      payload: BODY,
    })

    expect(res.statusCode).toBe(500)
    expect(res.json().code).toBe('FAIL')
    // 业务已提交 ⇒ 后续重投会命中 status=2 幂等空转,不会重复释放。
    expect(txState.flow?.status).toBe(2)
    expect(txState.marginUpdates).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
