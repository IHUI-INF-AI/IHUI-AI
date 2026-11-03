// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本地真 HTTP mock 支付网关(票 G-998162,联调验证档;AI vendor 代理后置)。
 *
 * 目的钉死:与联调同形 —— 在 127.0.0.1 起【真】HTTP 服务,复刻微信支付 V3 端点
 * (prepay / query)连同服务端订单状态机与回调投递;真实 client(wechat-pay.ts 的
 * fetch 调用)只需把 provider baseURL(WX_API_BASE)指到本网关 origin —— 生产代码
 * 路径与联调完全一致,联调时删掉 IHUI_PAY_MOCK 开关即可。
 *
 * 服务端状态机(单实例):
 *   POST /v3/pay/transactions/jsapi(下单)→ created
 *   → POST /__mock/pay/orders/:no/pay-success(模拟用户支付成功)→ paid
 *   → 向 prepay 请求携带的 notify_url 投递【与真实微信同构】的回调:
 *     RSA-SHA256 签名(平台私钥,签 `${timestamp}\n${nonce}\n${body}\n`)+
 *     AES-256-GCM 加密 resource(密钥=WX_PAY_V3_KEY)—— 逆运算即
 *     wechat-pay.ts 的 verifyCallbackSignature / decryptCallback,应用侧走
 *     与真环境完全相同的验签/解密分支。
 *
 * 双层限流注入:
 *   粗阀 prepay429Count —— prepay 直接回 429 + Retry-After + next_retry_at
 *   (可重试 + 下次时间,商户级限流形态);
 *   细阀 queue429Count —— 订单已 paid 后,结果查询(query)准入前先回 N 次
 *   429/ORDER_RESULT_QUEUED + Retry-After,第 N+1 次放行(结果排队形态)。
 *
 * 观测端点(GET /__mock/pay/observations)只记布尔与计数,不记录任何请求头值/
 * 签名材料/密文。EADDRINUSE 时复用已运行实例(external:true,close 为 no-op)。
 *
 * 开关:IHUI_PAY_MOCK=1 时由挂载点(worker-entry)或测试调用
 * ensurePaymentMockGateway;不设时零影响 —— 不起监听、不改环境变量、
 * 不触碰任何现有生产行为。
 */
import {
  createCipheriv,
  createPublicKey,
  createSign,
  generateKeyPairSync,
  randomBytes,
  createPrivateKey,
  type KeyObject,
} from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

const PAYMENT_MOCK_DEFAULT_PORT = 45_217
/** 真实微信支付 V3 网关(与 wechat-pay.ts 的缺省一致)。 */
export const REAL_WX_PAY_API_BASE = 'https://api.mch.weixin.qq.com'

export interface PaymentMockGatewayOptions {
  /** 监听端口;0 = 临时端口(测试用)。缺省读 IHUI_PAY_MOCK_PORT,再缺省 45217。 */
  port?: number
  /** 粗阀:prepay 先回多少次 429(可重试+下次时间)。env IHUI_PAY_MOCK_PREPAY_429_COUNT。 */
  prepay429Count?: number
  /** 细阀:每笔订单结果查询准入前先回多少次 429。env IHUI_PAY_MOCK_QUEUE_429_COUNT。 */
  queue429Count?: number
  /** 429 的 Retry-After 秒数。env IHUI_PAY_MOCK_RETRY_AFTER_S。 */
  retryAfterS?: number
  /** 平台私钥 PEM(回调签名用);缺省读 IHUI_PAY_MOCK_PLATFORM_PRIVATE_KEY,再缺省临时生成。 */
  platformPrivateKeyPem?: string
  /** 回调 resource 加密密钥(32 字节);缺省读 WX_PAY_V3_KEY(与应用侧解密同源)。 */
  v3Key?: string
  /** 订单未携带 notify_url 时的投递兜底。env IHUI_PAY_MOCK_NOTIFY_URL。 */
  notifyUrlFallback?: string
}

export interface PaymentMockGatewayHandle {
  origin: string
  port: number
  /** true = 端口已被另一实例占用,本 handle 只是指向它(close 为 no-op)。 */
  external: boolean
  close: () => Promise<void>
}

export function isPaymentMockEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env['IHUI_PAY_MOCK'] === '1'
}

/** 环境变量数值选项(真机联调用;测试直接传 options)。 */
function readEnvOptions(env: NodeJS.ProcessEnv): PaymentMockGatewayOptions {
  const num = (key: string): number | undefined => {
    const raw = env[key]
    if (!raw) return undefined
    const value = Number(raw)
    return Number.isFinite(value) && value >= 0 ? value : undefined
  }
  return {
    ...(num('IHUI_PAY_MOCK_PREPAY_429_COUNT') !== undefined
      ? { prepay429Count: num('IHUI_PAY_MOCK_PREPAY_429_COUNT') }
      : {}),
    ...(num('IHUI_PAY_MOCK_QUEUE_429_COUNT') !== undefined
      ? { queue429Count: num('IHUI_PAY_MOCK_QUEUE_429_COUNT') }
      : {}),
    ...(num('IHUI_PAY_MOCK_RETRY_AFTER_S') !== undefined
      ? { retryAfterS: num('IHUI_PAY_MOCK_RETRY_AFTER_S') }
      : {}),
    ...(env['IHUI_PAY_MOCK_PLATFORM_PRIVATE_KEY']
      ? { platformPrivateKeyPem: env['IHUI_PAY_MOCK_PLATFORM_PRIVATE_KEY'] }
      : {}),
    ...(env['IHUI_PAY_MOCK_NOTIFY_URL'] ? { notifyUrlFallback: env['IHUI_PAY_MOCK_NOTIFY_URL'] } : {}),
  }
}

interface MockOrder {
  outTradeNo: string
  amountTotal: number
  notifyUrl?: string
  state: 'created' | 'paid'
  transactionId?: string
  queue429Remaining: number
  // ---- 观测布尔(仅布尔,不存任何请求头值/签名/密文) ----
  prepayAccepted: boolean
  paid: boolean
  callbackDelivered: boolean
  callbackAcked: boolean
  queue429Injected: boolean
}

interface Observations {
  counters: {
    prepayRequests: number
    prepay429Injected: number
    queryRequests: number
    queue429Injected: number
    callbacksDelivered: number
    callbacksAcked: number
  }
  orders: Array<{
    outTradeNo: string
    prepayAccepted: boolean
    paid: boolean
    callbackDelivered: boolean
    callbackAcked: boolean
    queue429Injected: boolean
  }>
}

/** 本进程当前持有的网关 handle(直接 start 或 ensure 成功后设置)。 */
let activeHandle: PaymentMockGatewayHandle | null = null

/**
 * provider baseURL 解析:mock 开启且本进程持有网关时指 mock origin;
 * 否则走真实环境注入路径(WX_API_BASE,缺省微信 V3 网关)。
 * 关 mock 时与现网行为逐字节一致。
 */
export function resolvePaymentProviderBase(env: NodeJS.ProcessEnv = process.env): string {
  if (isPaymentMockEnabled(env) && activeHandle) return activeHandle.origin
  return env['WX_API_BASE'] ?? REAL_WX_PAY_API_BASE
}

export async function startPaymentMockGateway(
  deps: { log?: (msg: string) => void } = {},
  options: PaymentMockGatewayOptions = {},
): Promise<PaymentMockGatewayHandle> {
  const config = {
    retryAfterS: 1,
    ...readEnvOptions(process.env),
    ...options,
  }
  const log = (msg: string): void => deps.log?.(msg)

  const orders = new Map<string, MockOrder>()
  let prepay429Remaining = config.prepay429Count ?? 0
  let seqCounter = 0
  const counters: Observations['counters'] = {
    prepayRequests: 0,
    prepay429Injected: 0,
    queryRequests: 0,
    queue429Injected: 0,
    callbacksDelivered: 0,
    callbacksAcked: 0,
  }

  const platformPrivateKey: KeyObject = (() => {
    const pem = config.platformPrivateKeyPem ?? process.env['IHUI_PAY_MOCK_PLATFORM_PRIVATE_KEY']
    if (pem) return createPrivateKey(pem)
    return generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
  })()
  const platformPublicKeyPem = createPublicKey(platformPrivateKey).export({
    type: 'spki',
    format: 'pem',
  })

  function json(
    res: ServerResponse,
    status: number,
    body: unknown,
    headers?: Record<string, string>,
  ): void {
    res.writeHead(status, { 'content-type': 'application/json', ...headers })
    res.end(JSON.stringify(body))
  }

  async function readBody(req: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    return Buffer.concat(chunks)
  }

  /** 粗阀 429:可重试 + 下次时间(Retry-After 头 + next_retry_at 毫秒时间戳)。 */
  function coarse429(res: ServerResponse): void {
    json(
      res,
      429,
      {
        code: 'RATELIMIT',
        message: 'mock prepay throttled, retry later',
        next_retry_at: Date.now() + config.retryAfterS * 1000,
      },
      { 'retry-after': String(config.retryAfterS) },
    )
  }

  async function handlePrepay(req: IncomingMessage, res: ServerResponse): Promise<void> {
    counters.prepayRequests += 1
    let body: Record<string, unknown> = {}
    try {
      body = JSON.parse((await readBody(req)).toString('utf8')) as Record<string, unknown>
    } catch {
      body = {}
    }
    const outTradeNo = typeof body['out_trade_no'] === 'string' ? body['out_trade_no'] : ''
    const amount = body['amount'] as { total?: number } | undefined
    if (!outTradeNo || !amount || typeof amount.total !== 'number' || amount.total <= 0) {
      json(res, 400, { code: 'PARAM_ERROR', message: 'out_trade_no / amount.total required' })
      return
    }
    if (prepay429Remaining > 0) {
      prepay429Remaining -= 1
      counters.prepay429Injected += 1
      coarse429(res)
      return
    }
    seqCounter += 1
    const order: MockOrder = {
      outTradeNo,
      amountTotal: amount.total,
      notifyUrl:
        (typeof body['notify_url'] === 'string' && body['notify_url']) ||
        config.notifyUrlFallback ||
        process.env['IHUI_PAY_MOCK_NOTIFY_URL'] ||
        undefined,
      state: 'created',
      queue429Remaining: config.queue429Count ?? 0,
      prepayAccepted: true,
      paid: false,
      callbackDelivered: false,
      callbackAcked: false,
      queue429Injected: false,
    }
    orders.set(outTradeNo, order)
    json(res, 200, { prepay_id: `mock_prepay_${seqCounter}` })
  }

  function handleQuery(outTradeNo: string, res: ServerResponse): void {
    counters.queryRequests += 1
    const order = orders.get(outTradeNo)
    if (!order) {
      json(res, 404, { code: 'ORDER_NOT_EXIST', message: 'order not found in mock' })
      return
    }
    // 细阀:已支付订单的结果在准入前先回 N 次 429 + Retry-After,第 N+1 次放行。
    if (order.state === 'paid' && order.queue429Remaining > 0) {
      order.queue429Remaining -= 1
      order.queue429Injected = true
      counters.queue429Injected += 1
      json(
        res,
        429,
        { code: 'ORDER_RESULT_QUEUED', message: 'payment result queued (mock)' },
        { 'retry-after': String(config.retryAfterS) },
      )
      return
    }
    json(res, 200, {
      out_trade_no: order.outTradeNo,
      trade_state: order.state === 'paid' ? 'SUCCESS' : 'NOTPAY',
      ...(order.transactionId ? { transaction_id: order.transactionId } : {}),
      amount: { total: order.amountTotal, currency: 'CNY' },
    })
  }

  /**
   * 构造与真实微信回调同构的通知:resource 用 AES-256-GCM(WX_PAY_V3_KEY)
   * 加密,整包用平台私钥 RSA-SHA256 签 `${timestamp}\n${nonce}\n${body}\n`。
   * 应用侧 verifyCallbackSignature / decryptCallback 即为其逆运算(同码分支)。
   */
  function buildWechatCallback(order: MockOrder): {
    body: string
    headers: Record<string, string>
  } {
    const v3Key = config.v3Key ?? process.env['WX_PAY_V3_KEY'] ?? ''
    const resourceNonce = randomBytes(6).toString('hex') // 12 字符,与微信 nonce 形态一致
    const associatedData = 'transaction'
    const plain = JSON.stringify({
      out_trade_no: order.outTradeNo,
      trade_state: 'SUCCESS',
      transaction_id: order.transactionId,
      amount: { total: order.amountTotal, currency: 'CNY' },
    })
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(v3Key, 'utf8'), Buffer.from(resourceNonce, 'utf8'))
    cipher.setAAD(Buffer.from(associatedData, 'utf8'))
    const ciphertext = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
      cipher.getAuthTag(),
    ]).toString('base64')
    const body = JSON.stringify({
      id: `evt_mock_${randomBytes(8).toString('hex')}`,
      event_type: 'TRANSACTION.SUCCESS',
      resource: { ciphertext, nonce: resourceNonce, associated_data: associatedData },
    })
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = randomBytes(16).toString('hex')
    const sign = createSign('RSA-SHA256')
    sign.update(`${timestamp}\n${nonce}\n${body}\n`, 'utf8')
    const signature = sign.sign(platformPrivateKey, 'base64')
    return {
      body,
      headers: {
        'wechatpay-timestamp': timestamp,
        'wechatpay-nonce': nonce,
        'wechatpay-serial': 'MOCK-SERIAL',
        'wechatpay-signature': signature,
      },
    }
  }

  async function handlePaySuccess(outTradeNo: string, res: ServerResponse): Promise<void> {
    const order = orders.get(outTradeNo)
    if (!order) {
      json(res, 404, { code: 'ORDER_NOT_EXIST', message: 'order not found in mock' })
      return
    }
    if (order.state === 'paid') {
      // 幂等:不重复投递。
      json(res, 200, {
        alreadyPaid: true,
        callbackDelivered: order.callbackDelivered,
        callbackAcked: order.callbackAcked,
      })
      return
    }
    order.state = 'paid'
    order.paid = true
    order.transactionId = `mock_txn_${randomBytes(6).toString('hex')}`
    if (!order.notifyUrl) {
      json(res, 200, { alreadyPaid: false, callbackDelivered: false, callbackAcked: false })
      return
    }
    let callback: { body: string; headers: Record<string, string> }
    try {
      callback = buildWechatCallback(order)
    } catch (error) {
      json(res, 503, {
        error: `mock callback build failed(WX_PAY_V3_KEY 未配置或不合法?): ${String(error)}`,
      })
      return
    }
    try {
      const resp = await fetch(order.notifyUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...callback.headers },
        body: callback.body,
      })
      order.callbackDelivered = true
      order.callbackAcked = resp.ok
      counters.callbacksDelivered += 1
      if (resp.ok) counters.callbacksAcked += 1
    } catch {
      order.callbackDelivered = false
      order.callbackAcked = false
    }
    json(res, 200, {
      alreadyPaid: false,
      callbackDelivered: order.callbackDelivered,
      callbackAcked: order.callbackAcked,
    })
  }

  function handleObservations(res: ServerResponse): void {
    // 观测端点:只记布尔与计数,不记头值/签名/密文。
    const observations: Observations = {
      counters,
      orders: [...orders.values()].map((order) => ({
        outTradeNo: order.outTradeNo,
        prepayAccepted: order.prepayAccepted,
        paid: order.paid,
        callbackDelivered: order.callbackDelivered,
        callbackAcked: order.callbackAcked,
        queue429Injected: order.queue429Injected,
      })),
    }
    json(res, 200, observations)
  }

  const server: Server = createServer((req, res) => {
    const url = (req.url ?? '').split('?')[0] ?? ''
    void (async () => {
      if (req.method === 'GET' && url === '/__mock/pay/health') {
        json(res, 200, { ok: true })
        return
      }
      if (req.method === 'GET' && url === '/__mock/pay/observations') {
        handleObservations(res)
        return
      }
      if (req.method === 'GET' && url === '/__mock/pay/platform-cert') {
        // 配置分发端点(公开钥,非观测):外部进程以它配置 WX_PAY_PLATFORM_CERT。
        json(res, 200, { publicKeyPem: platformPublicKeyPem, serial: 'MOCK-SERIAL' })
        return
      }
      if (req.method === 'POST' && url === '/v3/pay/transactions/jsapi') {
        await handlePrepay(req, res)
        return
      }
      const queryMatch = /^\/v3\/pay\/transactions\/out-trade-no\/([^/]+)$/.exec(url)
      if (req.method === 'GET' && queryMatch) {
        handleQuery(decodeURIComponent(queryMatch[1] ?? ''), res)
        return
      }
      const paySuccessMatch = /^\/__mock\/pay\/orders\/([^/]+)\/pay-success$/.exec(url)
      if (req.method === 'POST' && paySuccessMatch) {
        await handlePaySuccess(decodeURIComponent(paySuccessMatch[1] ?? ''), res)
        return
      }
      json(res, 404, { message: `no mock route for ${req.method} ${url}` })
    })().catch((error) => {
      log(`payment mock gateway handler failed: ${String(error)}`)
      try {
        json(res, 500, { message: 'payment mock gateway internal error' })
      } catch {
        // 响应已发出,忽略。
      }
    })
  })

  const requestedPort =
    options.port ??
    (Number(process.env['IHUI_PAY_MOCK_PORT']) > 0
      ? Number(process.env['IHUI_PAY_MOCK_PORT'])
      : PAYMENT_MOCK_DEFAULT_PORT)
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(requestedPort, '127.0.0.1', () => resolve())
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      // 多窗口:另一个进程已起网关,共用它(票据/订单状态必须单实例)。
      const origin = `http://127.0.0.1:${requestedPort}`
      log(`payment mock gateway reusing existing instance at ${origin}`)
      return { origin, port: requestedPort, external: true, close: async () => {} }
    }
    throw error
  }
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('payment mock gateway failed to bind')
  }
  const origin = `http://127.0.0.1:${address.port}`
  log(`payment mock gateway listening at ${origin}`)
  const handle: PaymentMockGatewayHandle = {
    origin,
    port: address.port,
    external: false,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeIdleConnections?.()
        if (activeHandle === handle) activeHandle = null
        server.close(() => resolve())
      }),
  }
  activeHandle = handle
  return handle
}

let ensurePromise: Promise<PaymentMockGatewayHandle> | null = null

/**
 * 开关挂载入口:IHUI_PAY_MOCK=1 时启动(或复用)网关并注入 provider baseURL
 * (WX_API_BASE ??= origin,显式配置优先);未开启时返回 null 且零副作用。
 */
export async function ensurePaymentMockGateway(
  options: PaymentMockGatewayOptions = {},
): Promise<PaymentMockGatewayHandle | null> {
  if (!isPaymentMockEnabled()) return null
  if (!ensurePromise) {
    ensurePromise = startPaymentMockGateway({}, options).then((handle) => {
      process.env['WX_API_BASE'] ??= handle.origin
      return handle
    })
    ensurePromise.catch(() => {
      ensurePromise = null
    })
  }
  return ensurePromise
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
