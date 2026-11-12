/**
 * F-399 回归锁(2026-11-12,apps/api 安全子集 B)。
 *
 * 缺陷:POST /payments/recurring/wechat-notify 验签原文用 JSON.stringify(request.body)
 * 「重序列化」—— 键序/空白/转义与微信侧原始报文字节不一致,V3 平台签名必然对不上,
 * 验签实际失效(伪造回调可绕过 / 真实回调全被挡)。
 * 判据:
 *  - verifyCallbackSignature 收到的必须是 HTTP 原始报文字符串(逐字节);
 *  - 入库 wx_pay_notifications.rawXml 同样存原始字节;
 *  - 验签 false → 401,且不写通知行。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const spies = vi.hoisted(() => ({
  verifyCallbackSignature: vi.fn<(ts: string, nonce: string, raw: string, sig: string) => boolean>(
    () => true,
  ),
  consumeNotifyNonce: vi.fn(async () => 'ok' as 'ok' | 'replayed' | 'unavailable'),
  insertValues: vi.fn(async () => [{ id: 1 }]),
}))

vi.mock('../src/services/wechat-pay.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/wechat-pay.js')>()
  return {
    ...actual,
    verifyCallbackSignature: spies.verifyCallbackSignature,
    consumeNotifyNonce: spies.consumeNotifyNonce,
  }
})
vi.mock('../src/db/index.js', () => ({
  db: {
    insert: () => ({ values: spies.insertValues }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  },
  dbRead: {},
  dbClient: {},
}))

import { paymentRecurringRoutes } from '../src/routes/payment-recurring.js'

const HEADERS = {
  'content-type': 'application/json',
  'wechatpay-timestamp': '1700000000',
  'wechatpay-nonce': 'nonce-f399',
  'wechatpay-signature': 'sig-f399',
} as const

describe('F-399 周期扣款回调基于原始报文字节验签', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(paymentRecurringRoutes)
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    spies.verifyCallbackSignature.mockReset()
    spies.verifyCallbackSignature.mockReturnValue(true)
    spies.consumeNotifyNonce.mockClear()
    spies.consumeNotifyNonce.mockResolvedValue('ok')
    spies.insertValues.mockClear()
  })

  it('验签原文 = HTTP 原始报文(含空白/键序,非重序列化)且 rawXml 原样入库', async () => {
    const raw = '{\n  "event_type": "SOMETHING.NEW",\n  "extra_field": "x"\n}'
    const res = await server.inject({
      method: 'POST',
      url: '/payments/recurring/wechat-notify',
      headers: HEADERS,
      payload: raw,
    })
    expect(res.statusCode).toBe(200)
    // 关键判据:原文逐字节进验签。JSON.stringify(request.body) 会得到
    // {"event_type":"SOMETHING.NEW","extra_field":"x"}(无空白)≠ raw,旧行为在此翻红。
    expect(spies.verifyCallbackSignature).toHaveBeenCalledTimes(1)
    expect(spies.verifyCallbackSignature).toHaveBeenCalledWith(
      '1700000000',
      'nonce-f399',
      raw,
      'sig-f399',
    )
    expect(spies.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ rawXml: raw }),
    )
  })

  it('验签不通过 → 401,且不写通知行', async () => {
    spies.verifyCallbackSignature.mockReturnValue(false)
    const res = await server.inject({
      method: 'POST',
      url: '/payments/recurring/wechat-notify',
      headers: HEADERS,
      payload: '{"event_type":"SOMETHING.NEW"}',
    })
    expect(res.statusCode).toBe(401)
    const body = res.json() as { code?: unknown; message?: string }
    expect(body.message).toContain('签名验证失败')
    expect(spies.insertValues).not.toHaveBeenCalled()
  })
})
