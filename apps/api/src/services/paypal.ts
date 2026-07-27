/**
 * PayPal 支付集成(裸 fetch 模式,对齐 stripe.ts / alipay.ts / wechat-pay.ts)
 *
 * 环境变量(从 node:process.env 读取):
 * - PAYPAL_CLIENT_ID       REST App client id
 * - PAYPAL_CLIENT_SECRET   REST App secret
 * - PAYPAL_WEBHOOK_ID      Webhook 订阅 id(用于事件来源校验)
 * - PAYPAL_API_BASE        API 地址,默认 https://api-m.sandbox.paypal.com
 *                          生产:https://api-m.paypal.com
 * - PAYPAL_RETURN_URL      支付人批准后回跳 URL
 * - PAYPAL_CANCEL_URL      用户取消回跳 URL
 *
 * 货币单位:元(string,2 位小数,PayPal API 接收 "10.99" 形式)
 * 订阅激活:复用 activateOrderSubscription(orderType=2 VIP / 5 开发者套餐)
 * provider 字段:billing.ts payments.provider varchar(16) 注释加入 'paypal',无需 migration
 *
 * API 参考:https://developer.paypal.com/docs/api/orders/v2/
 */

import { env } from 'node:process'

const API_BASE = env.PAYPAL_API_BASE ?? 'https://api-m.sandbox.paypal.com'
const PAYPAL_FETCH_TIMEOUT_MS = 10_000

/** Access token 缓存(单进程,避免每次调用都换 token) */
interface TokenCache {
  accessToken: string
  expiresAt: number // epoch ms
}
let tokenCache: TokenCache | null = null

export function isPaypalConfigured(): boolean {
  return Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET)
}

export function isWebhookVerificationReady(): boolean {
  return Boolean(env.PAYPAL_WEBHOOK_ID)
}

function buildBasicAuthHeader(): string {
  const credentials = `${env.PAYPAL_CLIENT_ID ?? ''}:${env.PAYPAL_CLIENT_SECRET ?? ''}`
  return `Basic ${Buffer.from(credentials, 'utf-8').toString('base64')}`
}

/**
 * 获取 PayPal access token(带缓存,过期前 60s 重新换)。
 * PayPal OAuth2 token 有效期默认 32400s(9h),缓存避免每次 API 调用都换 token。
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt - now > 60_000) {
    return tokenCache.accessToken
  }
  const form = new URLSearchParams()
  form.set('grant_type', 'client_credentials')
  const resp = await fetch(`${API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: buildBasicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
    signal: AbortSignal.timeout(PAYPAL_FETCH_TIMEOUT_MS),
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`PayPal OAuth2 token failed: ${resp.status} ${text.slice(0, 200)}`)
  }
  const json = (await resp.json()) as {
    access_token: string
    expires_in: number
  }
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  }
  return json.access_token
}

/** 测试用:清空 token 缓存 */
export function __clearTokenCacheForTests(): void {
  tokenCache = null
}

async function paypalRequest<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const accessToken = await getAccessToken()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
  const init: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(PAYPAL_FETCH_TIMEOUT_MS),
  }
  if (body !== undefined && method === 'POST') {
    init.body = JSON.stringify(body)
  }
  const resp = await fetch(`${API_BASE}${path}`, init)
  const text = await resp.text()
  if (!resp.ok) {
    let detail = text
    try {
      const errJson = JSON.parse(text) as { message?: string; error_description?: string }
      detail = errJson.message ?? errJson.error_description ?? text
    } catch {
      /* keep raw text */
    }
    throw new Error(`PayPal ${method} ${path} failed: ${resp.status} ${detail}`)
  }
  return (text ? JSON.parse(text) : ({} as T)) as T
}

// =============================================================================
// Orders API v2(创建 / 查询 / capture)
// =============================================================================

export interface CreateOrderParams {
  outTradeNo: string
  amountYuan: string // "10.99" 形式,PayPal 接收 string
  currency: string // 'USD' / 'EUR' 等,默认 'USD'
  description: string
  returnUrl?: string
  cancelUrl?: string
}

export interface CreateOrderResult {
  id: string // PAYID-...
  status: string // 'CREATED' / 'APPROVED' / 'COMPLETED'
  links: Array<{ href: string; rel: string; method: string }>
}

interface PaypalAmount {
  currency_code: string
  value: string
}

/**
 * 创建 PayPal Order(用户需在 PayPal 批准后才能 capture)
 * - intent: 'CAPTURE' 一次性付款(对齐 Stripe Checkout 一次完成模式)
 * - approve link(rel='approve')是 PayPal 托管支付页 URL
 */
export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: params.outTradeNo,
        description: params.description,
        amount: {
          currency_code: params.currency,
          value: params.amountYuan,
        } satisfies PaypalAmount,
      },
    ],
    application_context: {
      brand_name: 'IHUI-AI',
      user_action: 'PAY_NOW',
      shipping_preference: 'NO_SHIPPING',
      return_url: params.returnUrl ?? env.PAYPAL_RETURN_URL ?? '',
      cancel_url: params.cancelUrl ?? env.PAYPAL_CANCEL_URL ?? '',
    },
  }
  return paypalRequest<CreateOrderResult>('POST', '/v2/checkout/orders', body)
}

export interface OrderStatus {
  id: string
  status: string // 'CREATED' / 'APPROVED' / 'COMPLETED' / 'VOIDED'
  intent: string
  purchase_units: Array<{
    reference_id: string
    amount: PaypalAmount
    payments?: {
      captures?: Array<{
        id: string
        status: string // 'COMPLETED' / 'PENDING' / 'DECLINED' / 'REFUNDED' ...
        amount: PaypalAmount
      }>
    }
  }>
}

export async function getOrderStatus(orderId: string): Promise<OrderStatus> {
  return paypalRequest<OrderStatus>('GET', `/v2/checkout/orders/${orderId}`)
}

export interface CaptureResult {
  id: string // order id
  status: string // 'COMPLETED'
  purchase_units: Array<{
    payments?: {
      captures?: Array<{
        id: string // capture id,用于退款
        status: string
        amount: PaypalAmount
      }>
    }
  }>
}

/**
 * 捕获已批准订单(purchase_units[].payments.captures[].id 用于退款)
 * 前置条件:用户已在 PayPal approve(order status='APPROVED')
 */
export async function captureOrder(orderId: string): Promise<CaptureResult> {
  return paypalRequest<CaptureResult>('POST', `/v2/checkout/orders/${orderId}/capture`, {})
}

// =============================================================================
// 退款(基于 capture_id)
// =============================================================================

export interface RefundParams {
  captureId: string
  amountYuan?: string // 可选,部分退款
  currency?: string
  note?: string
}

export interface RefundResult {
  id: string // refund id
  status: string // 'COMPLETED' / 'PENDING'
  amount: PaypalAmount
}

export async function refundCapture(params: RefundParams): Promise<RefundResult> {
  const body: Record<string, unknown> = {}
  if (params.amountYuan) {
    body.amount = {
      currency_code: params.currency ?? 'USD',
      value: params.amountYuan,
    } satisfies PaypalAmount
  }
  if (params.note) body.note_to_payer = params.note
  return paypalRequest<RefundResult>(
    'POST',
    `/v2/payments/captures/${params.captureId}/refund`,
    body,
  )
}

// =============================================================================
// Webhook 验签(PayPal-Transmissions-* headers + cert URL)
// 完整流程:下载 cert → 用 cert 公钥 RSA 验签 transmission_sig
// 简化模式(开发降级):用 webhook_id 校验事件类型
// =============================================================================

export interface PaypalWebhookHeaders {
  transmissionId: string
  transmissionTime: string
  transmissionSig: string
  certUrl: string
  authAlgo: string
}

export interface PaypalWebhookEvent {
  id: string
  event_type: string
  resource_type: string
  resource: Record<string, unknown>
}

/**
 * 校验 webhook 事件类型是否在订阅清单内
 * PayPal Webhook 可订阅多种事件,本服务只关心 payment 相关:
 * - CHECKOUT.ORDER.APPROVED:用户批准订单
 * - PAYMENT.CAPTURE.COMPLETED:capture 完成(实际到账)
 * - PAYMENT.CAPTURE.REFUNDED:退款完成
 * - PAYMENT.CAPTURE.DENIED:capture 被拒
 */
export const SUBSCRIBED_EVENTS = new Set<string>([
  'CHECKOUT.ORDER.APPROVED',
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.REFUNDED',
  'PAYMENT.CAPTURE.DENIED',
])

export function isSubscribedEvent(eventType: string): boolean {
  return SUBSCRIBED_EVENTS.has(eventType)
}

/**
 * 验证 PayPal Webhook 签名。
 * - DEV 环境 + 未配置 PAYPAL_WEBHOOK_ID 时降级直接 parse(便于本地测试)
 * - 生产环境:用 PayPal Verify-Webhook-Signature API 校验
 *   (完整 cert 验签需要 https 下载证书 + RSA 验签,Verify API 是官方推荐方案)
 *
 * @param payload 原始请求体字符串
 * @param headers PayPal 传输头
 */
export async function verifyWebhookSignature(
  payload: string,
  headers: PaypalWebhookHeaders,
): Promise<PaypalWebhookEvent> {
  const webhookId = env.PAYPAL_WEBHOOK_ID
  if (!webhookId) {
    if (env.NODE_ENV !== 'production') {
      return JSON.parse(payload) as PaypalWebhookEvent
    }
    throw new Error('PAYPAL_WEBHOOK_ID not configured')
  }

  // 调用 PayPal Verify-Webhook-Signature API
  // 文档:https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature_post
  const body = {
    auth_algo: headers.authAlgo,
    cert_url: headers.certUrl,
    transmission_id: headers.transmissionId,
    transmission_sig: headers.transmissionSig,
    transmission_time: headers.transmissionTime,
    webhook_id: webhookId,
    webhook_event: JSON.parse(payload),
  }
  const accessToken = await getAccessToken()
  const resp = await fetch(`${API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(PAYPAL_FETCH_TIMEOUT_MS),
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`PayPal verify-webhook-signature failed: ${resp.status} ${text.slice(0, 200)}`)
  }
  const result = (await resp.json()) as { verification_status: string }
  if (result.verification_status !== 'SUCCESS') {
    throw new Error(`PayPal webhook signature verification failed: ${result.verification_status}`)
  }
  return JSON.parse(payload) as PaypalWebhookEvent
}

// =============================================================================
// 工具:cents → "元字符串"(PayPal 用 string)
// =============================================================================

/** 把分(cents)转换为 PayPal 期望的 "10.99" 形式 string */
export function centsToYuanString(cents: number): string {
  return (cents / 100).toFixed(2)
}
