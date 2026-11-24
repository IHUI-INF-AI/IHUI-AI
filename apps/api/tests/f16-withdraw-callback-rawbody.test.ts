// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-16:微信提现回调(POST /api/payments/withdrawal/notify)验签原文必须是「原始报文字节」。
 *
 * 缺陷:payment-extended 插件没有 rawBody 时退化为 JSON.stringify(request.body) 验签。
 * 重序列化会抹掉原始空白/换行/转义,与微信签名串不一致 —— 真实回调稳定 401,
 * 而「可被重排后仍能算出同一 JSON」也给了绕过面。
 *
 * 本文件钉三格:
 *  ① 带正确 rawBody 的回调通过,且验签收到的字符串与线上字节**逐字相同**(含空白);
 *  ② 解析器没挂 rawBody 时 fail-closed 拒绝,不回落 JSON.stringify;
 *  ③ 篡改字段导致签名不符时拒绝。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const mocks = vi.hoisted(() => ({
  verifyCallbackSignature: vi.fn(),
  consumeNotifyNonce: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(),
  checkAuth: vi.fn(),
}))

vi.mock('../src/services/wechat-pay.js', () => ({
  isWechatPayConfigured: vi.fn().mockReturnValue(false),
  jsapiPrepay: vi.fn(),
  buildJsapiSign: vi.fn(),
  verifyCallbackSignature: mocks.verifyCallbackSignature,
  consumeNotifyNonce: mocks.consumeNotifyNonce,
  deductRecurring: vi.fn(),
  generateOutTradeNo: vi.fn(),
}))

vi.mock('../src/services/alipay.js', () => ({
  isAlipayConfigured: vi.fn().mockReturnValue(false),
  buildSignedUrl: vi.fn(),
}))

vi.mock('../src/services/order-service.js', () => ({ placeOrder: vi.fn() }))

vi.mock('../src/db/index.js', () => {
  function txSelectChain() {
    const chain: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown) => Promise.resolve([]).then(resolve),
    }
    for (const method of ['from', 'where', 'for', 'limit']) {
      chain[method] = vi.fn(() => chain)
    }
    return chain
  }
  const tx = {
    select: vi.fn(() => txSelectChain()),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  }
  return {
    db: {
      transaction: vi.fn(async (fn: (txArg: unknown) => Promise<unknown>) => fn(tx)),
    },
    dbRead: {},
    dbClient: {},
  }
})

import { paymentExtendedRoutes } from '../src/routes/payment-extended.js'

const NOTIFY_URL = '/api/payments/withdrawal/notify'
const TS = '1700000000'
const NONCE = 'nonce-f16'
const SIG = 'sig-f16'

// 刻意带换行与空格:JSON.stringify(JSON.parse(x)) 会把它压成单行,
// 因此「验签入参 === 本串」这一条断言能直接钉住"没有走重序列化"。
const SIGNED_BODY = '{\n  "out_bill_no": "WD-F16-1",\n  "state": "SUCCESS",\n  "transfer_bill_no": "TR-1"\n}'

function callbackHeaders(contentType = 'application/json'): Record<string, string> {
  return {
    'content-type': contentType,
    'wechatpay-timestamp': TS,
    'wechatpay-nonce': NONCE,
    'wechatpay-signature': SIG,
  }
}

describe('F-16 提现回调按 rawBody 原文验签', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 模拟"另一个已注册的解析器":它能解析 JSON 但不挂 rawBody。
    // 用它把「拿到 body 却拿不到原始报文」的请求真实送进 handler(而不是绕过路由)。
    app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => {
      try {
        done(null, JSON.parse((body as Buffer).toString('utf8')))
      } catch (err) {
        done(err as Error)
      }
    })
    await app.register(paymentExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.consumeNotifyNonce.mockResolvedValue('ok')
    // 只有「完全等于签名报文」+ 正确三元组才通过,等价于真实验签对原文逐字节比对。
    mocks.verifyCallbackSignature.mockImplementation(
      (timestamp: string, nonce: string, rawBody: string, signature: string) =>
        timestamp === TS && nonce === NONCE && signature === SIG && rawBody === SIGNED_BODY,
    )
  })

  it('① 带正确 rawBody 的回调通过,验签入参与线上字节逐字相同', async () => {
    const res = await app.inject({
      method: 'POST',
      url: NOTIFY_URL,
      headers: callbackHeaders(),
      payload: SIGNED_BODY,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ code: 'SUCCESS' })
    expect(mocks.verifyCallbackSignature).toHaveBeenCalledTimes(1)
    // 变异自证:把 rawBody 改回 `?? JSON.stringify(request.body)`,这里会拿到压缩后的单行 JSON ⇒ 翻红。
    expect(mocks.verifyCallbackSignature.mock.calls[0]?.[2]).toBe(SIGNED_BODY)
    expect(mocks.consumeNotifyNonce).toHaveBeenCalledTimes(1)
  })

  it('② 解析器没挂 rawBody 时 fail-closed 拒绝,不回落 JSON.stringify', async () => {
    const res = await app.inject({
      method: 'POST',
      url: NOTIFY_URL,
      headers: callbackHeaders('application/vnd.f16-json'),
      payload: SIGNED_BODY,
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ code: 'FAIL' })
    // 回落 stringify 的话这里会被调用一次(且 mock 对压缩串返回 false ⇒ 401),
    // 「一次都没调」才是 fail-closed 的判据。
    expect(mocks.verifyCallbackSignature).not.toHaveBeenCalled()
    expect(mocks.consumeNotifyNonce).not.toHaveBeenCalled()
  })

  it('③ 篡改字段导致签名不符时拒绝,且仍按篡改后的原文验签', async () => {
    const tampered = SIGNED_BODY.replace('"SUCCESS"', '"FAIL"')
    const res = await app.inject({
      method: 'POST',
      url: NOTIFY_URL,
      headers: callbackHeaders(),
      payload: tampered,
    })

    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ code: 'FAIL' })
    expect(mocks.verifyCallbackSignature).toHaveBeenCalledWith(TS, NONCE, tampered, SIG)
    expect(mocks.consumeNotifyNonce).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
