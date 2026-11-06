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
  decrypt: vi.fn(() => {
    throw new Error('kaboom: 模拟解密/业务处理失败')
  }),
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
  placeOrder: vi.fn(),
  completeOrder: vi.fn(),
}))

vi.mock('../../services/subscription-service.js', () => ({
  scanAndChargeDueContracts: vi.fn(),
  chargeOneContractNow: vi.fn(),
}))

vi.mock('../../db/index.js', () => ({ db: {} }))

vi.mock('../../plugins/auth.js', () => ({ authenticate: vi.fn() }))

vi.mock('../../utils/swagger.js', () => ({
  buildSchema: () => ({}),
  swaggerSchemas: { callback: {} },
}))

import { paymentRecurringRoutes } from '../payment-recurring.js'

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
      payload: {},
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
