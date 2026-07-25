/**
 * Edge Runtime 兼容的轻量级 JWT 验签(Web Crypto API)。
 *
 * 为什么不复用 packages/auth 的 verifyAccessToken:
 * - packages/auth/src/index.ts re-export 了 blacklist.ts / key-rotation.ts 等模块,
 *   它们依赖 node:crypto + ioredis(Edge Runtime 不兼容)
 * - packages/auth/package.json exports 只暴露 '.' 入口,无法从 './jwt' 子路径导入
 * - 本任务约束禁止修改 packages/auth 文件
 *
 * 此实现只验签不查库,与 packages/auth/src/jwt.ts 的校验逻辑对齐:
 * - alg=HS256, iss='ihui-ai', aud='ihui-ai-users'
 * - 拒绝 type='refresh' 的 token 被当作 access token
 * - 检查 exp 过期 + sub 存在
 */

const ISSUER = 'ihui-ai'
const AUDIENCE = 'ihui-ai-users'

export interface EdgeJWTPayload {
  userId: string
  phone: string
  familyId: string
  roleId: number
}

function base64UrlDecode(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** 恒定时间字符串比较(防 timing attack) */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET 未设置或强度不足(>=32 字符)')
  }
  return new TextEncoder().encode(secret)
}

/**
 * 用 Web Crypto API 验证 HS256 access token(只验签不查库)。
 * @returns 校验通过返回 payload;失败返回 null(middleware 友好处理,不抛异常)
 */
export async function verifyAccessTokenEdge(token: string): Promise<EdgeJWTPayload | null> {
  if (!token) return null
  const parts = token.split('.')
  const [headerB64, payloadB64, signatureB64] = parts
  if (!headerB64 || !payloadB64 || !signatureB64) return null

  // 1. 解析 header,校验 alg
  let header: { alg?: string; typ?: string }
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64)))
  } catch {
    return null
  }
  if (header.alg !== 'HS256') return null

  // 2. HMAC-SHA256 计算期望签名,恒定时间比较
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      getSecret(),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const sigBuf = await crypto.subtle.sign('HMAC', key, data)
    const expected = base64UrlEncode(new Uint8Array(sigBuf))
    if (!timingSafeEqual(expected, signatureB64)) return null
  } catch {
    return null
  }

  // 3. 解析 payload,校验 exp / iss / aud / type / sub
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)))
  } catch {
    return null
  }

  const exp = payload.exp
  if (typeof exp !== 'number' || exp <= Math.floor(Date.now() / 1000)) return null
  if (payload.iss !== ISSUER) return null
  if (payload.aud !== AUDIENCE) return null
  if (payload.type === 'refresh') return null

  const sub = payload.sub
  if (typeof sub !== 'string' || !sub) return null

  return {
    userId: sub,
    phone: String(payload.phone ?? ''),
    familyId: String(payload.familyId ?? ''),
    roleId: Number(payload.roleId ?? 0),
  }
}
