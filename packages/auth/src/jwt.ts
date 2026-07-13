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
const ALG = 'HS256'

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
 * 签发 access token (HS256, 7d 过期)。
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
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret())
}

/**
 * 签发 refresh token (HS256, 30d 过期)。
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
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret())
}

/**
 * 验证 access token，返回解码后的 payload。
 * 拒绝 refresh token 被当作 access token 使用。
 */
export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    issuer: ISSUER,
    algorithms: [ALG],
  })

  if (payload.type === 'refresh') {
    const err = new Error('refresh token 不能用作 access token')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }

  return {
    userId: payload.sub ?? '',
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
    algorithms: [ALG],
  })

  if (payload.type !== 'refresh') {
    const err = new Error('无效的 refresh token')
    ;(err as Error & { statusCode: number }).statusCode = 401
    throw err
  }

  return {
    userId: payload.sub ?? '',
    phone: String(payload.phone ?? ''),
    familyId: String(payload.familyId ?? ''),
    roleId: Number(payload.roleId ?? 0),
  }
}
