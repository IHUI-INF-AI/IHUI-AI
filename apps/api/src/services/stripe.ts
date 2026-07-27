/**
 * Stripe 支付集成(裸 fetch 模式,对齐 alipay.ts / wechat-pay.ts)
 *
 * 环境变量(从 node:process.env 读取):
 * - STRIPE_SECRET_KEY      服务端密钥(sk_test_ / sk_live_)
 * - STRIPE_PUBLISHABLE_KEY 客户端密钥(pk_test_ / pk_live_)
 * - STRIPE_WEBHOOK_SECRET  Webhook 签名密钥(whsec_...)
 * - STRIPE_API_BASE        API 地址,默认 https://api.stripe.com
 *
 * 货币单位:分(integer),调用 Stripe API 时直接传(Stripe 用最小货币单位 cents)
 * 订阅激活:复用 activateOrderSubscription(orderType=2 VIP / 5 开发者套餐)
 * provider 字段:billing.ts payments.provider 已支持 'stripe',无需 migration
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from 'node:process'

const API_BASE = env.STRIPE_API_BASE ?? 'https://api.stripe.com'
const STRIPE_FETCH_TIMEOUT_MS = 10_000
// Webhook 时间戳防重放窗口(5 分钟,Stripe 官方推荐)
const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PUBLISHABLE_KEY)
}

export function isWebhookVerificationReady(): boolean {
  return Boolean(env.STRIPE_WEBHOOK_SECRET)
}

function buildHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${env.STRIPE_SECRET_KEY ?? ''}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }
}

type FormValue = string | number | boolean | undefined

async function stripePost<T>(
  path: string,
  body: Record<string, FormValue>,
): Promise<T> {
  const form = new URLSearchParams()
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && v !== null) form.set(k, String(v))
  }
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: buildHeaders(),
    body: form.toString(),
    signal: AbortSignal.timeout(STRIPE_FETCH_TIMEOUT_MS),
  })
  return parseStripeResponse<T>(resp, 'POST', path)
}

async function stripeGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: buildHeaders(),
    signal: AbortSignal.timeout(STRIPE_FETCH_TIMEOUT_MS),
  })
  return parseStripeResponse<T>(resp, 'GET', path)
}

async function parseStripeResponse<T>(
  resp: Response,
  method: string,
  path: string,
): Promise<T> {
  const text = await resp.text()
  if (!resp.ok) {
    let detail = text
    try {
      const errJson = JSON.parse(text)
      detail = errJson.error?.message ?? text
    } catch {
      /* keep raw text */
    }
    throw new Error(`Stripe ${method} ${path} failed: ${resp.status} ${detail}`)
  }
  return (text ? JSON.parse(text) : ({} as T)) as T
}

// =============================================================================
// Checkout Session(Stripe 托管支付页,适合 SaaS MVP)
// =============================================================================

export interface CheckoutSessionParams {
  outTradeNo: string
  amountCents: number
  currency: string // ISO 4217 小写:'usd' / 'eur' / 'cny' 等
  productName: string
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}

export interface CheckoutSessionResult {
  id: string // cs_test_...
  url: string // https://checkout.stripe.com/c/pay/...
  payment_intent: string | null
}

export async function createCheckoutSession(
  params: CheckoutSessionParams,
): Promise<CheckoutSessionResult> {
  const body: Record<string, FormValue> = {
    mode: 'payment',
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': params.currency,
    'line_items[0][price_data][unit_amount]': params.amountCents,
    'line_items[0][price_data][product_data][name]': params.productName,
    client_reference_id: params.outTradeNo,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    'metadata[outTradeNo]': params.outTradeNo,
  }
  if (params.metadata) {
    for (const [k, v] of Object.entries(params.metadata)) {
      body[`metadata[${k}]`] = v
    }
  }
  return stripePost<CheckoutSessionResult>('/v1/checkout/sessions', body)
}

export interface CheckoutSessionStatus {
  id: string
  payment_status: string // 'paid' / 'unpaid' / 'no_payment_required'
  payment_intent: string | null
  client_reference_id: string | null
  amount_total: number
  currency: string
  metadata: Record<string, string> | null
}

export async function getCheckoutSession(
  sessionId: string,
): Promise<CheckoutSessionStatus> {
  return stripeGet<CheckoutSessionStatus>(`/v1/checkout/sessions/${sessionId}`)
}

// =============================================================================
// PaymentIntent 查询 / 退款
// =============================================================================

export interface PaymentIntentResult {
  id: string // pi_...
  amount: number // cents
  status: string // 'succeeded' / 'processing' / 'requires_payment_method' 等
  metadata: Record<string, string> | null
}

export async function queryPaymentIntent(
  paymentIntentId: string,
): Promise<PaymentIntentResult> {
  return stripeGet<PaymentIntentResult>(`/v1/payment_intents/${paymentIntentId}`)
}

export interface RefundParams {
  paymentIntentId: string
  amountCents?: number // 可选,部分退款;不传则全退
  reason?: string // 'duplicate' / 'fraudulent' / 'requested_by_customer'
}

export interface RefundResult {
  id: string // re_...
  amount: number // cents
  status: string // 'succeeded' / 'pending' / 'failed'
  payment_intent: string
}

export async function refundPaymentIntent(
  params: RefundParams,
): Promise<RefundResult> {
  const body: Record<string, FormValue> = {
    payment_intent: params.paymentIntentId,
  }
  if (params.amountCents !== undefined) body.amount = params.amountCents
  if (params.reason) body.reason = params.reason
  return stripePost<RefundResult>('/v1/refunds', body)
}

// =============================================================================
// Webhook 验签(Stripe-Signature: t=xxx,v1=xxx)
// =============================================================================

export interface StripeEvent {
  id: string // evt_...
  type: string // 'checkout.session.completed' / 'payment_intent.succeeded' 等
  data: {
    object: Record<string, unknown>
  }
}

/**
 * 验证 Stripe Webhook 签名并解析事件。
 * - DEV 环境 + 未配置 STRIPE_WEBHOOK_SECRET 时降级直接 parse(便于本地测试)
 * - 生产环境强制验签 + 时间戳防重放(5 分钟窗口)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
): StripeEvent {
  const secret = env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    if (env.NODE_ENV !== 'production') {
      return JSON.parse(payload) as StripeEvent
    }
    throw new Error('STRIPE_WEBHOOK_SECRET not configured')
  }
  let t: string | undefined
  let v1: string | undefined
  for (const part of signature.split(',')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const k = part.slice(0, eq)
    const v = part.slice(eq + 1)
    if (k === 't') t = v
    else if (k === 'v1') v1 = v
  }
  if (!t || !v1) throw new Error('Invalid Stripe-Signature header')

  const signedPayload = `${t}.${payload}`
  const expected = createHmac('sha256', secret)
    .update(signedPayload, 'utf-8')
    .digest('hex')
  const a = Buffer.from(expected, 'utf-8')
  const b = Buffer.from(v1, 'utf-8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Stripe webhook signature verification failed')
  }

  const timestamp = Number(t)
  if (Number.isNaN(timestamp)) throw new Error('Invalid Stripe timestamp')
  const ageMs = Date.now() - timestamp * 1000
  if (ageMs > WEBHOOK_TOLERANCE_MS) {
    throw new Error('Stripe webhook timestamp too old (possible replay)')
  }

  return JSON.parse(payload) as StripeEvent
}
