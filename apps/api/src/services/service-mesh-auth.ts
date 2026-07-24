/**
 * 服务间 mTLS 身份认证(国安级服务网格配套)。
 *
 * 基于 JWT (HS256, jose) 实现短期(5min)服务间令牌:
 * - generateServiceToken:源服务 → 目标服务的定向令牌
 * - verifyServiceToken:验签 + 过期 + 目标匹配(常量时间比较防 timing attack)
 * - 服务白名单:ALLOWED_SERVICES 环境变量配置
 *
 * 设计要点:
 * - 令牌 payload:{ type:'service', src, dst, iat, exp },5 分钟过期
 * - 目标服务名(dst)用常量时间比较,防 timing attack 泄露预期目标
 * - 密钥从 SERVICE_MESH_JWT_SECRET 读取(>= 32 字符),缺失时拒绝签发/验证
 * - 白名单默认 ['ihui-web','ihui-api','ihui-ai-service']
 */
import { SignJWT, jwtVerify } from 'jose'
import { constantTimeCompare } from '../utils/crypto-extra.js'
import { logger } from '../utils/logger.js'

const TOKEN_TTL_SECONDS = 300 // 5 分钟
const ALG = 'HS256'

/**
 * 获取服务网格 JWT 密钥(从环境变量)。
 * 密钥 < 32 字符时抛异常(强制安全密钥长度)。
 */
function getSecret(): Uint8Array {
  const secret = process.env.SERVICE_MESH_JWT_SECRET ?? ''
  if (!secret || secret.length < 32) {
    throw new Error('SERVICE_MESH_JWT_SECRET not configured or too short (< 32 chars)')
  }
  return new TextEncoder().encode(secret)
}

/**
 * 解析服务白名单(从 ALLOWED_SERVICES 环境变量,逗号分隔)。
 * 默认包含 ihui-web / ihui-api / ihui-ai-service。
 */
function getAllowedServices(): Set<string> {
  const raw = process.env.ALLOWED_SERVICES ?? 'ihui-web,ihui-api,ihui-ai-service'
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

export interface ServiceTokenPayload {
  type: 'service'
  src: string
  dst: string
  iat: number
  exp: number
}

export interface ServiceTokenVerifyResult {
  valid: boolean
  /** 验证成功时的源服务名 */
  service?: string
  /** 验证失败时的原因 */
  reason?: string
}

/**
 * 生成服务间调用令牌(5 分钟有效)。
 * @param serviceName 源服务名(必须在白名单中)
 * @param targetService 目标服务名
 * @throws 服务不在白名单 / 密钥未配置
 */
export async function generateServiceToken(
  serviceName: string,
  targetService: string,
): Promise<string> {
  const allowed = getAllowedServices()
  if (!allowed.has(serviceName)) {
    throw new Error(`Service "${serviceName}" is not in ALLOWED_SERVICES whitelist`)
  }
  const key = getSecret()
  return new SignJWT({ type: 'service', src: serviceName, dst: targetService })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(key)
}

/**
 * 验证服务间调用令牌。
 * 校验链:签名 → 过期 → token type → payload 完整性 → 源服务白名单 → 目标匹配(常量时间比较)。
 * 任何一步失败返回 { valid: false, reason },不抛异常。
 */
export async function verifyServiceToken(
  token: string,
  expectedTarget: string,
): Promise<ServiceTokenVerifyResult> {
  let key: Uint8Array
  try {
    key = getSecret()
  } catch (e) {
    return { valid: false, reason: (e as Error).message }
  }

  try {
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] })

    if (payload.type !== 'service') {
      return { valid: false, reason: 'Invalid token type' }
    }

    const src = payload.src
    const dst = payload.dst
    if (typeof src !== 'string' || typeof dst !== 'string') {
      return { valid: false, reason: 'Invalid token payload (src/dst missing)' }
    }

    const allowed = getAllowedServices()
    if (!allowed.has(src)) {
      logger.warn('Service mesh token from non-whitelisted service', { src })
      return { valid: false, reason: 'Source service not in whitelist' }
    }

    // 常量时间比较目标服务名,防 timing attack 泄露 expectedTarget
    if (!constantTimeCompare(dst, expectedTarget)) {
      return { valid: false, reason: 'Target service mismatch' }
    }

    return { valid: true, service: src }
  } catch (e) {
    return { valid: false, reason: (e as Error).message }
  }
}

/**
 * 检查服务是否在白名单中。
 */
export function isServiceAllowed(serviceName: string): boolean {
  return getAllowedServices().has(serviceName)
}
