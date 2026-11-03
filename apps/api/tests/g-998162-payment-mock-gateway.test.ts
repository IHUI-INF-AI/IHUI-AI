// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import {
  createServer,
  type Server as HttpServer,
} from 'node:http'
import {
  isPaymentMockEnabled,
  resolvePaymentProviderBase,
  startPaymentMockGateway,
  ensurePaymentMockGateway,
  REAL_WX_PAY_API_BASE,
  type PaymentMockGatewayHandle,
} from '../src/services/payment-mock-gateway.js'

/**
 * 票 G-998162 验收测试(拍板采纳的三条判据):
 * ① 签名校验分支与真环境同码:mock 投递的回调被 payment-gateway.ts 同一分支代码
 *    (wechat-pay.verifyCallbackSignature / decryptCallback)接受;篡改/重放被同一分支拒绝。
 * ② queue429Count=2 时客户端在第 3 次成功且退避读的是 Retry-After。
 * ③ 不设 IHUI_PAY_MOCK(关 mock)后,同一测试用例代码改指真环境,不改代码。
 */

// consistent-type-imports 禁 `import()` 类型注解 ⇒ 改 import type namespace(类型等值,用法点不变)
import type * as _wechatPayNs from '../src/services/wechat-pay.js'
type WechatPayModule = typeof _wechatPayNs

const V3_KEY = '0123456789abcdef0123456789abcdef' // 32 字节(aes-256-gcm)
const ENV_KEYS = [
  'IHUI_PAY_MOCK',
  'IHUI_PAY_MOCK_PORT',
  'IHUI_PAY_MOCK_PREPAY_429_COUNT',
  'IHUI_PAY_MOCK_QUEUE_429_COUNT',
  'IHUI_PAY_MOCK_RETRY_AFTER_S',
  'WX_API_BASE',
  'WX_SHOP_ID',
  'WX_PAY_PRIVATE_KEY',
  'WX_PAY_PLATFORM_CERT',
  'WX_PAY_V3_KEY',
  'WX_PAY_CERT_SERIAL',
  'WX_MINI_APPID',
] as const

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
const post = async (url: string): Promise<Response> =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' } })

// ---- 环境快照:测试内任意改 env,收尾恢复,不影响同进程其他测试 ----
const savedEnv = new Map<string, string | undefined>()
beforeAll(() => {
  for (const key of ENV_KEYS) savedEnv.set(key, process.env[key])
})
afterAll(() => {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

/**
 * 链路驱动的唯一 baseURL 解析入口 —— mock 档与真环境档走的是同一行代码,
 * 仅环境变量差异(判据③"不改代码"的落点)。
 */
const chainProviderBase = (): string => resolvePaymentProviderBase()

interface NotifyDelivery {
  verified: boolean
  decrypted: boolean
  outTradeNo?: string
  tradeState?: string
  amountTotal?: number
  transactionId?: string
  // 负例复用材料(仅测试内存持有,不进任何观测断言面):
  ts?: string
  nonce?: string
  signature?: string
  rawBody?: string
}

/**
 * 应用侧 notify 端点替身:运行与 payment-gateway.ts /payments/wechat/notify
 * 【完全相同】的验签/解密分支代码(真 verifyCallbackSignature / decryptCallback),
 * DB 落账段(completeOrderWithSaga)留在真路由,不属 mock 档范围。
 */
async function startNotifyReceiver(wx: WechatPayModule): Promise<{
  url: string
  deliveries: NotifyDelivery[]
  close: () => Promise<void>
}> {
  const deliveries: NotifyDelivery[] = []
  const server: HttpServer = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk as Buffer))
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8')
      const ts = String(req.headers['wechatpay-timestamp'] ?? '')
      const nonce = String(req.headers['wechatpay-nonce'] ?? '')
      const signature = String(req.headers['wechatpay-signature'] ?? '')
      // —— 同码分支(正例与负例共用这一行生产代码)——
      const verified = wx.verifyCallbackSignature(ts, nonce, rawBody, signature)
      const delivery: NotifyDelivery = { verified, decrypted: false, ts, nonce, signature, rawBody }
      if (verified) {
        const body = JSON.parse(rawBody) as {
          resource?: { ciphertext: string; nonce: string; associated_data: string }
        }
        if (body.resource) {
          const decrypted = wx.decryptCallback(
            body.resource.ciphertext,
            body.resource.nonce,
            body.resource.associated_data,
          ) as {
            out_trade_no?: string
            trade_state?: string
            transaction_id?: string
            amount?: { total?: number }
          }
          delivery.decrypted = true
          delivery.outTradeNo = decrypted.out_trade_no
          delivery.tradeState = decrypted.trade_state
          delivery.transactionId = decrypted.transaction_id
          delivery.amountTotal = decrypted.amount?.total
        }
      }
      deliveries.push(delivery)
      res.writeHead(verified ? 200 : 400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ code: verified ? 'SUCCESS' : 'FAIL' }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  return {
    url: `http://127.0.0.1:${address.port}/payments/wechat/notify`,
    deliveries,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeIdleConnections?.()
        server.close(() => resolve())
      }),
  }
}

interface ObservationsBody {
  counters: Record<string, number>
  orders: Array<{ outTradeNo: string } & Record<string, unknown>>
}

// ===========================================================================
// 判据① + ②:mock 档一次真下单回调链路
// ===========================================================================
describe('G-998162 mock 档:真下单回调链路(判据①②)', () => {
  const outTradeNo = `MOCKG998162${Date.now()}`
  const AMOUNT = 500
  let gateway: PaymentMockGatewayHandle
  let wx: WechatPayModule
  let receiver: Awaited<ReturnType<typeof startNotifyReceiver>>

  beforeAll(async () => {
    const platform = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const merchant = generateKeyPairSync('rsa', { modulusLength: 2048 })
    gateway = await startPaymentMockGateway(
      {},
      {
        port: 0,
        prepay429Count: 2, // 粗阀
        queue429Count: 2, // 细阀
        retryAfterS: 1,
        platformPrivateKeyPem: platform.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        v3Key: V3_KEY,
      },
    )
    process.env.IHUI_PAY_MOCK = '1'
    process.env.WX_API_BASE = gateway.origin
    process.env.WX_SHOP_ID = '1900000001'
    process.env.WX_PAY_PRIVATE_KEY = merchant.privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString()
    process.env.WX_PAY_PLATFORM_CERT = platform.publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString()
    process.env.WX_PAY_V3_KEY = V3_KEY
    // wechat-pay 的 API_BASE 是模块加载期常量:env 注入后再动态 import
    wx = await import('../src/services/wechat-pay.js')
    receiver = await startNotifyReceiver(wx)
  })
  afterAll(async () => {
    await receiver?.close()
    await gateway?.close()
  })

  it('粗阀:prepay 前 2 次回 429+Retry-After+next_retry_at,按 Retry-After 退避后第 3 次(真实 jsapiPrepay)成功', async () => {
    const base = chainProviderBase()
    expect(base).toBe(gateway.origin)
    for (let i = 0; i < 2; i++) {
      const resp = await fetch(`${base}/v3/pay/transactions/jsapi`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          out_trade_no: outTradeNo,
          amount: { total: AMOUNT, currency: 'CNY' },
          notify_url: receiver.url,
        }),
      })
      expect(resp.status).toBe(429)
      expect(resp.headers.get('retry-after')).toBe('1')
      const body = (await resp.json()) as { code?: string; next_retry_at?: number }
      expect(body.code).toBe('RATELIMIT')
      expect(typeof body.next_retry_at).toBe('number')
      // 客户端退避读的是 Retry-After
      await sleep(Number(resp.headers.get('retry-after')) * 1000)
    }
    // 第 3 次:真实生产 client(wechat-pay.jsapiPrepay,baseURL 已指 mock origin)
    const prepayId = await wx.jsapiPrepay({
      outTradeNo,
      amount: AMOUNT,
      description: 'G-998162',
      openId: 'o-mock-openid',
      notifyUrl: receiver.url,
    })
    expect(prepayId).toMatch(/^mock_prepay_/)
  })

  it('细阀(queue429Count=2):结果查询第 1/2 次 429,客户端按 Retry-After 退避,第 3 次成功(判据②)', async () => {
    // 模拟用户支付成功 → mock 投递签名+加密回调
    const cmd = await post(`${gateway.origin}/__mock/pay/orders/${outTradeNo}/pay-success`)
    expect(cmd.status).toBe(200)
    const cmdBody = (await cmd.json()) as { callbackDelivered?: boolean; callbackAcked?: boolean }
    expect(cmdBody.callbackDelivered).toBe(true)
    expect(cmdBody.callbackAcked).toBe(true)

    const attempts: number[] = []
    const backoffs: number[] = []
    let lastBody: { trade_state?: string } = {}
    for (;;) {
      const resp = await fetch(
        `${gateway.origin}/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=1900000001`,
      )
      attempts.push(resp.status)
      if (resp.status !== 429) {
        expect(resp.status).toBe(200)
        lastBody = (await resp.json()) as { trade_state?: string }
        break
      }
      const retryAfterS = Number(resp.headers.get('retry-after'))
      expect(Number.isFinite(retryAfterS)).toBe(true)
      const t0 = Date.now()
      await sleep(retryAfterS * 1000)
      backoffs.push(Date.now() - t0)
    }
    expect(attempts).toEqual([429, 429, 200])
    expect(backoffs.length).toBe(2)
    for (const ms of backoffs) expect(ms).toBeGreaterThanOrEqual(950)
    expect(lastBody.trade_state).toBe('SUCCESS')
  })

  it('回调走真 HTTP,应用侧同码验签/解密分支通过(判据①正)', () => {
    expect(receiver.deliveries.length).toBe(1)
    const delivery = receiver.deliveries[0]!
    expect(delivery.verified).toBe(true)
    expect(delivery.decrypted).toBe(true)
    expect(delivery.outTradeNo).toBe(outTradeNo)
    expect(delivery.tradeState).toBe('SUCCESS')
    expect(delivery.amountTotal).toBe(AMOUNT)
    expect(delivery.transactionId).toBeTruthy()
  })

  it('同码验签分支负例:篡改报文 / 重放旧时间戳被同一分支拒绝(判据①反)', () => {
    const delivery = receiver.deliveries[0]!
    expect(delivery.verified).toBe(true)
    // 篡改原始报文(一个字节)→ 同一 verifyCallbackSignature 分支必须拒
    expect(
      wx.verifyCallbackSignature(delivery.ts!, delivery.nonce!, `${delivery.rawBody}x`, delivery.signature!),
    ).toBe(false)
    // 重放(时间戳超出 ±5min 新鲜度窗口)→ 同一分支必须拒
    const staleTs = String(Math.floor(Date.now() / 1000) - 600)
    expect(wx.verifyCallbackSignature(staleTs, delivery.nonce!, delivery.rawBody!, delivery.signature!)).toBe(
      false,
    )
  })

  it('观测端点只记布尔与计数,不记录头值/签名/密文', async () => {
    const resp = await fetch(`${gateway.origin}/__mock/pay/observations`)
    expect(resp.ok).toBe(true)
    const text = await resp.text()
    const body = JSON.parse(text) as ObservationsBody
    expect(body.counters['prepay429Injected']).toBe(2)
    expect(body.counters['queue429Injected']).toBe(2)
    expect(body.counters['callbacksDelivered']).toBe(1)
    expect(body.counters['callbacksAcked']).toBe(1)
    const order = body.orders.find((o) => o.outTradeNo === outTradeNo)
    expect(order).toBeDefined()
    for (const key of ['prepayAccepted', 'paid', 'callbackDelivered', 'callbackAcked', 'queue429Injected']) {
      expect(typeof order![key]).toBe('boolean')
    }
    expect(order!['paid']).toBe(true)
    expect(order!['callbackAcked']).toBe(true)
    // 无签名/密钥/密文/头值材料
    expect(text.includes('WECHATPAY2')).toBe(false)
    expect(text.includes('PRIVATE KEY')).toBe(false)
    expect(text.includes('ciphertext')).toBe(false)
    expect(text.toLowerCase().includes('authorization')).toBe(false)
  })

  it('platform-cert 端点下发平台公钥(供外部进程配置 WX_PAY_PLATFORM_CERT)', async () => {
    const resp = await fetch(`${gateway.origin}/__mock/pay/platform-cert`)
    expect(resp.ok).toBe(true)
    const body = (await resp.json()) as { publicKeyPem?: string; serial?: string }
    expect(body.publicKeyPem).toContain('BEGIN PUBLIC KEY')
    expect(body.serial).toBe('MOCK-SERIAL')
  })
})

// ===========================================================================
// EADDRINUSE 复用 + ensure 单例
// ===========================================================================
describe('G-998162 mock 档:EADDRINUSE 复用与 ensure 单例', () => {
  const FIXED_PORT = 45_917

  it('EADDRINUSE:复用已运行实例 external:true、close 为 no-op;释放后可重新绑定', async () => {
    const first = await startPaymentMockGateway({}, { port: FIXED_PORT })
    try {
      const second = await startPaymentMockGateway({}, { port: FIXED_PORT })
      expect(second.external).toBe(true)
      expect(second.origin).toBe(first.origin)
      await expect(second.close()).resolves.toBeUndefined() // no-op
      const health = await fetch(`${first.origin}/__mock/pay/health`)
      expect(health.ok).toBe(true)
    } finally {
      await first.close()
    }
    const third = await startPaymentMockGateway({}, { port: FIXED_PORT })
    expect(third.external).toBe(false)
    await third.close()
  })

  it('ensure:disabled 返回 null 且零副作用;enabled 单例复用并注入 WX_API_BASE', async () => {
    delete process.env.IHUI_PAY_MOCK
    delete process.env.WX_API_BASE
    expect(isPaymentMockEnabled()).toBe(false)
    expect(await ensurePaymentMockGateway({ port: 0 })).toBeNull()
    expect(process.env.WX_API_BASE).toBeUndefined()

    process.env.IHUI_PAY_MOCK = '1'
    const first = await ensurePaymentMockGateway({ port: 0 })
    expect(first).not.toBeNull()
    const second = await ensurePaymentMockGateway({ port: 0 })
    expect(second).toBe(first)
    expect(process.env.WX_API_BASE).toBe(first!.origin)
    await first!.close()
  })
})

// ===========================================================================
// 判据③:关 mock(不设 IHUI_PAY_MOCK)→ 同一用例代码指向真环境
// ===========================================================================
describe('G-998162 关 mock 档:同一用例代码走真实 baseURL 注入路径(判据③)', () => {
  it('不设 IHUI_PAY_MOCK:同一 chainProviderBase 解析到真实 provider,不起任何本地监听', async () => {
    delete process.env.IHUI_PAY_MOCK
    delete process.env.WX_API_BASE
    expect(isPaymentMockEnabled()).toBe(false)
    // 与 mock 档【完全相同】的驱动入口(同一行代码,仅 env 差异):
    const base = chainProviderBase()
    expect(base).toBe(REAL_WX_PAY_API_BASE)
    expect(base.startsWith('http://127.0.0.1:')).toBe(false)
    // 真环境档不起本地 mock,ensure 为纯 no-op:
    expect(await ensurePaymentMockGateway({ port: 0 })).toBeNull()
    // 显式 WX_API_BASE(联调真环境指向)优先于缺省,代码同样不改:
    process.env.WX_API_BASE = 'https://pay.example-real.cn'
    expect(chainProviderBase()).toBe('https://pay.example-real.cn')
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
