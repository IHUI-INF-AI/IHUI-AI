/**
 * P7-5 Webhook 签名工具
 * - HMAC-SHA256 签名生成
 * - 时间戳防重放（5 分钟窗口）
 * - 签名校验（容错时间窗口）
 * - 幂等 ID 生成
 */

export interface SignOptions {
  /** Webhook 密钥（来自开发者中心配置） */
  secret: string
  /** 请求体（已序列化为字符串） */
  body: string
  /** 唯一消息 ID（用幂等） */
  messageId?: string
  /** 客户端时间戳（毫秒） */
  timestamp?: number
}

export interface SignedHeaders {
  'X-Webhook-Id': string
  'X-Webhook-Timestamp': string
  'X-Webhook-Signature': string
  'X-Webhook-Signature-Algorithm': 'HMAC-SHA256'
}

export interface VerifyOptions {
  secret: string
  body: string
  messageId: string
  timestamp: string
  signature: string
  /** 时间容错窗口（毫秒），默认 5 分钟 */
  toleranceMs?: number
}

export interface VerifyResult {
  valid: boolean
  reason?: 'expired' | 'invalid_signature' | 'invalid_format'
  serverTimeMs?: number
}

/**
 * 浏览器兼容 HMAC-SHA256 → hex
 * 使用 Web Crypto API（仅在 secure context / localhost 可用）
 */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 同步 fallback（Node 环境用 crypto.createHmac）
 * 仅在非浏览器环境使用
 */
export function hmacSha256HexSync(_secret: string, _message: string): string {
  // 浏览器没有 require/import 同步方式，Node 22+ 才有 globalThis.crypto.subtle
  // 为兼容 SSR + 浏览器双端，使用 globalThis.crypto.subtle
  // 同步版本留给调用方用 await hmacSha256Hex
  throw new Error('使用 hmacSha256Hex() 异步版本')
}

/**
 * 生成 Webhook 签名头
 * @example
 * const headers = await signWebhookPayload({ secret, body, messageId })
 * fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body })
 */
export async function signWebhookPayload(opts: SignOptions): Promise<SignedHeaders> {
  const messageId = opts.messageId || generateWebhookMessageId()
  const timestamp = String(opts.timestamp || Date.now())
  const signingString = `${messageId}.${timestamp}.${opts.body}`
  const sig = await hmacSha256Hex(opts.secret, signingString)
  return {
    'X-Webhook-Id': messageId,
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Signature': sig,
    'X-Webhook-Signature-Algorithm': 'HMAC-SHA256',
  }
}

/**
 * 校验 Webhook 签名（接收端）
 */
export async function verifyWebhookSignature(opts: VerifyOptions): Promise<VerifyResult> {
  const ts = Number(opts.timestamp)
  if (!Number.isFinite(ts)) {
    return { valid: false, reason: 'invalid_format' }
  }
  const tolerance = opts.toleranceMs ?? 5 * 60 * 1000
  const now = Date.now()
  if (Math.abs(now - ts) > tolerance) {
    return { valid: false, reason: 'expired', serverTimeMs: now }
  }
  const signingString = `${opts.messageId}.${opts.timestamp}.${opts.body}`
  const expected = await hmacSha256Hex(opts.secret, signingString)
  if (expected !== opts.signature) {
    return { valid: false, reason: 'invalid_signature', serverTimeMs: now }
  }
  return { valid: true, serverTimeMs: now }
}

/**
 * 生成幂等消息 ID（UUID v4 风格）
 */
export function generateWebhookMessageId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // fallback
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * 提取重试头（用于接收端 5xx 响应后客户端重试）
 */
export function parseRetryAfterSeconds(value: string | null | undefined): number | null {
  if (!value) return null
  const n = Number(value)
  if (Number.isFinite(n)) return n
  const date = Date.parse(value)
  if (Number.isFinite(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000))
  return null
}
