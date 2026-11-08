// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

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

function notifyHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    'wechatpay-timestamp': '1700000000',
    'wechatpay-nonce': 'nonce-raw',
    'wechatpay-signature': 'sig-raw',
  }
}

// 空 tx:select 链返回 0 行(流水不存在,事务空转成功),update 链可 await
const emptyTx = {
  select: () => ({
    from: () => ({ where: () => ({ for: () => ({ limit: async () => [] }) }) }),
  }),
  update: () => ({ set: () => ({ where: async () => undefined }) }),
}

describe('提现回调 rawBody 与失败重投(F-16/F-17)', () => {
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
    mockTransaction.mockReset()
    mockVerifyCallbackSignature.mockReset().mockReturnValue(true)
    mockConsumeNotifyNonce.mockReset().mockResolvedValue('ok')
  })

  it('F-16:验签使用原始报文字节,而不是 JSON.stringify 后的规范化文本', async () => {
    const raw = '{"out_bill_no":"BILL-RAW","state":"SUCCESS", "amount":1.10}'
    mockTransaction.mockRejectedValueOnce(new Error('db down'))
    const res = await app.inject({
      method: 'POST',
      url: NOTIFY_URL,
      headers: notifyHeaders(),
      payload: raw,
    })

    expect(res.statusCode).toBe(500)
    expect(mockVerifyCallbackSignature).toHaveBeenCalledTimes(1)
    const [ts, nonce, signedRaw, sig] = mockVerifyCallbackSignature.mock.calls[0]!
    expect(ts).toBe('1700000000')
    expect(nonce).toBe('nonce-raw')
    // 变异自证:改回 JSON.stringify(request.body) 会得到
    // {"out_bill_no":"BILL-RAW","state":"SUCCESS","amount":1.1}(空格丢失、1.10 变 1.1)。
    expect(signedRaw).toBe(raw)
    expect(sig).toBe('sig-raw')
  })

  it('F-17:事务失败回 FAIL/500,且不消费 nonce(保证重投可重放)', async () => {
    mockTransaction.mockRejectedValueOnce(new Error('db down'))
    const res = await app.inject({
      method: 'POST',
      url: NOTIFY_URL,
      headers: notifyHeaders(),
      payload: '{"out_bill_no":"BILL-FAIL","state":"SUCCESS"}',
    })

    expect(res.statusCode).toBe(500)
    expect(res.json().code).toBe('FAIL')
    // 变异自证:把 consumeNotifyNonce 移回事务之前,本断言翻红
    expect(mockConsumeNotifyNonce).not.toHaveBeenCalled()
  })

  it('F-17:事务成功但 nonce 存储不可用 → 500 FAIL(不吞成 SUCCESS)', async () => {
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(emptyTx))
    mockConsumeNotifyNonce.mockResolvedValueOnce('unavailable')
    const res = await app.inject({
      method: 'POST',
      url: NOTIFY_URL,
      headers: notifyHeaders(),
      payload: '{"out_bill_no":"BILL-QUAR","state":"SUCCESS"}',
    })

    expect(res.statusCode).toBe(500)
    expect(res.json().code).toBe('FAIL')
  })

  it('F-17:事务成功后 nonce=ok → SUCCESS(正常路径不回退)', async () => {
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(emptyTx))
    const res = await app.inject({
      method: 'POST',
      url: NOTIFY_URL,
      headers: notifyHeaders(),
      payload: '{"out_bill_no":"BILL-OK","state":"SUCCESS"}',
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().code).toBe('SUCCESS')
    expect(mockConsumeNotifyNonce).toHaveBeenCalledWith('withdrawal', '1700000000', 'nonce-raw')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
