import type { NextRequest } from 'next/server'
import { base64UrlDecode } from '@ihui/shared/utils/jwt-utils'

// 纯函数下沉到共享层(2026-08-01,AGENTS.md §3 共享层优先)
// decodeUserFromToken / isAdmin / isAuthenticated / AuthTokenUser 现由 @ihui/shared/auth 提供,
// 此处 re-export 保持现有调用方零改动(继续从 @/lib/auth-utils import)。
export {
  decodeUserFromToken,
  isAdmin,
  isAuthenticated,
  type AuthTokenUser,
} from '@ihui/shared/auth'

/**
 * 获取 redirect 查询参数。
 * 仅允许站内相对路径(以单个 / 开头),防止开放重定向攻击。
 */
export function getRedirectPath(request: NextRequest): string {
  const redirect = request.nextUrl.searchParams.get('redirect')
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect
  }
  return '/'
}

// ---------------------------------------------------------------------------
// Edge Runtime 兼容的轻量级 JWT 验签(Web Crypto API)
// ---------------------------------------------------------------------------

const EDGE_ISSUER = 'ihui-ai'
const EDGE_AUDIENCE = 'ihui-ai-users'

/** Edge Runtime 验签后的用户信息(保证字段存在,供 middleware 使用) */
export interface EdgeVerifiedUser {
  userId: string
  phone: string
  familyId: string
  roleId: number
}

/** 恒定时间字符串比较(防 timing attack) */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function getJwtSecretBytes(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET 未设置或强度不足(>=32 字符)')
  }
  return new TextEncoder().encode(secret)
}

/** ArrayBuffer → base64url string(无 padding),用于 HMAC 签名编码 */
function arrayBufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * 用 Web Crypto API 验证 HS256 access token(只验签不查库)。
 *
 * 为什么不复用 packages/auth 的 verifyAccessToken:
 * - packages/auth/src/index.ts re-export 了 blacklist.ts / key-rotation.ts 等模块,
 *   它们依赖 node:crypto + ioredis(Edge Runtime 不兼容)
 * - packages/auth/package.json exports 只暴露 '.' 入口,无法从 './jwt' 子路径导入
 *
 * 与 packages/auth/src/jwt.ts 的校验逻辑对齐:
 * - alg=HS256, iss='ihui-ai', aud='ihui-ai-users'
 * - 拒绝 type='refresh' 的 token 被当作 access token
 * - 检查 exp 过期 + sub 存在
 *
 * @returns 校验通过返回 payload;失败返回 null(middleware 友好处理,不抛异常)
 */
export async function verifyAccessTokenEdge(token: string): Promise<EdgeVerifiedUser | null> {
  if (!token) return null
  const parts = token.split('.')
  const [headerB64, payloadB64, signatureB64] = parts
  if (!headerB64 || !payloadB64 || !signatureB64) return null

  // 1. 解析 header,校验 alg
  let header: { alg?: string; typ?: string }
  try {
    header = JSON.parse(base64UrlDecode(headerB64))
  } catch {
    return null
  }
  if (header.alg !== 'HS256') return null

  // 2. HMAC-SHA256 计算期望签名,恒定时间比较
  let expectedSig: string
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      getJwtSecretBytes() as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const sigBuf = await crypto.subtle.sign('HMAC', key, data as BufferSource)
    expectedSig = arrayBufferToBase64Url(sigBuf)
  } catch {
    return null
  }
  if (!timingSafeEqual(expectedSig, signatureB64)) return null

  // 3. 解析 payload,校验 exp / iss / aud / type / sub
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64))
  } catch {
    return null
  }

  const exp = payload.exp
  if (typeof exp !== 'number' || exp <= Math.floor(Date.now() / 1000)) return null
  if (payload.iss !== EDGE_ISSUER) return null
  if (payload.aud !== EDGE_AUDIENCE) return null
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
