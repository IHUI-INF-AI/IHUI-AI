import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * 视频签名 URL 服务。
 *
 * 用于为 lesson/section 视频生成带过期时间的签名 URL,
 * 防止他人盗链播放。签名算法 HMAC-SHA256,
 * 签名 payload = `${userId}|${resourceId}|${expiresAt}`,
 * 附在 URL query 上:`?uid=...&rid=...&exp=...&sig=...`。
 *
 * 验证时同样 payload 重新计算 HMAC,与 sig 用 timingSafeEqual 比对。
 */

const DEFAULT_SECRET = 'ihui-video-sign-secret-change-me'
const DEFAULT_TTL_SECONDS = 3600

function getSecret(): string {
  return process.env.VIDEO_SIGN_SECRET ?? DEFAULT_SECRET
}

export function getDefaultTtlSeconds(): number {
  const raw = process.env.VIDEO_SIGN_TTL_SECONDS
  const n = raw ? Number.parseInt(raw, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_SECONDS
}

export function signVideoToken(payload: {
  userId: string
  resourceId: string
  expiresAt: number
}): string {
  const base = `${payload.userId}|${payload.resourceId}|${payload.expiresAt}`
  return createHmac('sha256', getSecret()).update(base).digest('hex')
}

export function verifyVideoToken(payload: {
  userId: string
  resourceId: string
  expiresAt: number
  signature: string
}): boolean {
  if (!payload.signature || payload.signature.length !== 64) return false
  const expected = signVideoToken({
    userId: payload.userId,
    resourceId: payload.resourceId,
    expiresAt: payload.expiresAt,
  })
  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(payload.signature, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export interface SignedVideoUrlInput {
  baseUrl: string
  userId: string
  resourceId: string
  ttlSeconds?: number
}

export interface SignedVideoUrlOutput {
  url: string
  expiresAt: number
  signature: string
}

export function buildSignedVideoUrl(input: SignedVideoUrlInput): SignedVideoUrlOutput {
  const ttl = input.ttlSeconds ?? getDefaultTtlSeconds()
  const expiresAt = Math.floor(Date.now() / 1000) + ttl
  const signature = signVideoToken({
    userId: input.userId,
    resourceId: input.resourceId,
    expiresAt,
  })
  const sep = input.baseUrl.includes('?') ? '&' : '?'
  const url =
    `${input.baseUrl}${sep}uid=${encodeURIComponent(input.userId)}` +
    `&rid=${encodeURIComponent(input.resourceId)}` +
    `&exp=${expiresAt}` +
    `&sig=${signature}`
  return { url, expiresAt, signature }
}
