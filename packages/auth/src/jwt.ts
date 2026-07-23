import { SignJWT, jwtVerify } from 'jose'

/**
 * JWT payload 结构。
 * - userId: 用户 UUID
 * - phone: 手机号（可能为空字符串）
 * - familyId: refresh token family 标识（用于 token 重放检测）
 * - roleId: 角色ID（0 = 普通用户）
 */
export interface JWTPayload {
  userId: string
  phone: string
  familyId: string
  roleId: number
}

const ISSUER = 'ihui-ai'
const AUDIENCE = 'ihui-ai-users'
const ALG = 'HS256'

/**
 * Access Token TTL（秒）。
 *
 * 2026-07-22 鲁棒性加固:7d → 15min,符合 OAuth2 安全基线(短 TTL + refresh token 轮换)。
 * - 短 TTL 让被泄露的 access token 快速失效
 * - roleId 等敏感 claim 写入 JWT,管理员降级用户角色后最多 15 分钟生效
 * - 可通过 env.JWT_ACCESS_TTL_SECONDS 覆盖(单位秒)
 *
 * 破坏性:现有用户 access token 在升级后 15 分钟内全部过期,需用 refresh token 重新换新。
 */
export const ACCESS_TOKEN_TTL_SECONDS = (() => {
  const envVal = process.env.JWT_ACCESS_TTL_SECONDS
  if (envVal) {
    const n = Number(envVal)
    if (Number.isFinite(n) && n >= 60 && n <= 86400) return n
  }
  return 15 * 60 // 默认 15 分钟
})()

/**
 * Refresh Token TTL（秒）。
 * 30 天,与 legacy 行为一致;可通过 env.JWT_REFRESH_TTL_SECONDS 覆盖。
 */
export const REFRESH_TOKEN_TTL_SECONDS = (() => {
  const envVal = process.env.JWT_REFRESH_TTL_SECONDS
  if (envVal) {
    const n = Number(envVal)
    if (Number.isFinite(n) && n >= 3600 && n <= 90 * 86400) return n
  }
  return 30 * 24 * 60 * 60
})()

/** 将秒数转换为 jose setExpirationTime 接受的字符串(<=1 天用 'Nm' 格式,>1 天用 'Nd' 格式) */
function ttlToExpirationString(seconds: number): string {
  if (seconds % 86400 === 0 && seconds >= 86400) return `${seconds / 86400}d`
  return `${seconds}s`
}

/**
 * 读取 JWT 密钥（Uint8Array）。
 *  - 强制校验: JWT_SECRET 必须 >= 32 字符且不能为弱默认值
 *  - 导出供 ws-auth.ts / OAuth2 等同源模块复用，避免重复实现
 */
export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  const weakValues = new Set(['', 'change-me-to-a-random-256-bit-key', 'secret', 'changeme'])
  if (!secret || weakValues.has(secret) || secret.length < 32) {
    const err = new Error(
      'JWT_SECRET 未设置或强度不足 (>=32 字符，不可为默认值)，请在环境变量中配置强随机密钥后重启。',
    )
    ;(err as Error & { statusCode: number }).statusCode = 500
    throw err
  }
  return new TextEncoder().encode(secret)
}

/**
 * 签发 access token (HS256, 默认 15min 过期,可经 env.JWT_ACCESS_TTL_SECONDS 覆盖)。
 */
export function signAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({
    phone: payload.phone,
    familyId: payload.familyId,
    roleId: payload.roleId,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE) // 2026-07-24 安全加固:加 aud claim 防跨服务 token 误用
    .setIssuedAt()
    .setExpirationTime(ttlToExpirationString(ACCESS_TOKEN_TTL_SECONDS))
    .sign(getJwtSecret())
}

/**
 * 签发 refresh token (HS256, 默认 30d 过期,可经 env.JWT_REFRESH_TTL_SECONDS 覆盖)。
 * 与 access token 共享同样的 payload，但通过 type 字段区分。
 */
export function signRefreshToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({
    phone: payload.phone,
    familyId: payload.familyId,
    roleId: payload.roleId,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE) // 2026-07-24 安全加固:加 aud claim 防跨服务 token 误用
    .setIssuedAt()
    .setExpirationTime(ttlToExpirationString(REFRESH_TOKEN_TTL_SECONDS))
    .sign(getJwtSecret())
}

/**
 * 验证 access token，返回解码后的 payload。
 * 拒绝 refresh token 被当作 access token 使用。
 */
export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE, // 2026-07-24 安全加固:校验 aud claim
    algorithms: [ALG],
  })

  if (payload.type === 'refresh') {
    const err = new Error('refresh token 不能用作 access token')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }

  // sub 是签发时 setSubject(userId) 写入,缺失说明 token 被篡改或格式错误,拒绝
  if (!payload.sub) {
    const err = new Error('invalid access token: missing subject')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }

  return {
    userId: payload.sub,
    phone: String(payload.phone ?? ''),
    familyId: String(payload.familyId ?? ''),
    roleId: Number(payload.roleId ?? 0),
  }
}

/**
 * 验证 refresh token，返回解码后的 payload。
 * 仅接受 type=refresh 的 token。
 */
export async function verifyRefreshToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE, // 2026-07-24 安全加固:校验 aud claim
    algorithms: [ALG],
  })

  if (payload.type !== 'refresh') {
    const err = new Error('无效的 refresh token')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }

  // sub 是签发时 setSubject(userId) 写入,缺失说明 token 被篡改或格式错误,拒绝
  if (!payload.sub) {
    const err = new Error('invalid refresh token: missing subject')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }

  return {
    userId: payload.sub,
    phone: String(payload.phone ?? ''),
    familyId: String(payload.familyId ?? ''),
    roleId: Number(payload.roleId ?? 0),
  }
}
