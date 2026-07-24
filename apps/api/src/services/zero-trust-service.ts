/**
 * 零信任策略评估服务(国安级零信任架构核心)。
 *
 * 评估维度(5 维):
 * 1. 身份认证状态(JWT / mTLS 客户端证书 / 都没有 → deny)
 * 2. 设备信任状态(mTLS 证书 / 已注册设备指纹 / 都没有 → challenge)
 * 3. 网络位置(内网 / 公网 / 黑名单 IP)
 * 4. 资源敏感度(普通 / 敏感 / 高敏感,基于路由配置)
 * 5. 时间窗(工作时间 / 非工作时间 → 高敏感操作需 challenge)
 *
 * 决策结果:allow / deny / challenge。
 * 策略来源:ZERO_TRUST_POLICY_PATH 指定的 JSON 文件(可选),缺失则用默认策略。
 *
 * 策略规则(优先级从高到低):
 * - 黑名单 IP → deny
 * - 无任何身份认证 → deny
 * - 高敏感资源 + 公网 → 必须 mTLS + JWT 双重(否则 challenge/deny)
 * - 高敏感资源 + 非工作时间 → challenge
 * - 敏感资源 + 无设备信任 → challenge
 * - 普通资源 + 公网 → JWT 即可
 * - 高敏感资源 + 内网 → JWT 即可
 */
import { readFileSync } from 'node:fs'
import { logger } from '../utils/logger.js'

export type ZeroTrustDecision = 'allow' | 'deny' | 'challenge'
export type ResourceSensitivity = 'normal' | 'sensitive' | 'highly_sensitive'

export interface ZeroTrustContext {
  /** JWT 已认证 */
  authenticated: boolean
  /** mTLS 客户端证书有效 */
  mtlsAuthenticated: boolean
  /** 设备指纹已注册 */
  deviceTrusted: boolean
  /** 客户端 IP(用于日志) */
  clientIp: string
  /** IP 是否在黑名单 */
  blacklistedIp: boolean
  /** IP 网络分类:internal / external / unknown */
  networkLocation: 'internal' | 'external' | 'unknown'
  /** 资源敏感度(从路由 config.zeroTrust.sensitivity 读取) */
  resourceSensitivity: ResourceSensitivity
  /** 是否工作时间 */
  isWorkingHours: boolean
  /** 请求路径(用于日志) */
  routePath: string
}

export interface ZeroTrustResult {
  decision: ZeroTrustDecision
  reasons: string[]
}

export interface ZeroTrustPolicy {
  /** 工作时间定义 [startHour, endHour),24h 制,默认 [9, 18) */
  workingHours?: [number, number]
  /** 高敏感资源访问是否要求工作时间(默认 false) */
  highlySensitiveRequiresWorkingHours?: boolean
  /** 高敏感资源 + 公网是否要求 mTLS + JWT 双重(默认 true) */
  highlySensitiveExternalRequiresMtls?: boolean
  /** 自定义黑名单 IP(追加到网络分段黑名单) */
  blacklistIps?: string[]
}

const DEFAULT_POLICY: Required<ZeroTrustPolicy> = {
  workingHours: [9, 18],
  highlySensitiveRequiresWorkingHours: false,
  highlySensitiveExternalRequiresMtls: true,
  blacklistIps: [],
}

let cachedPolicy: Required<ZeroTrustPolicy> | null = null

/**
 * 加载零信任策略(从 ZERO_TRUST_POLICY_PATH JSON 文件)。
 * 缺失或解析失败时降级到默认策略,logger.warning(不阻塞运行)。
 * 策略加载后缓存,resetPolicyCache() 可清除缓存用于热重载/测试。
 */
export function loadPolicy(): Required<ZeroTrustPolicy> {
  if (cachedPolicy) return cachedPolicy

  const policyPath = process.env.ZERO_TRUST_POLICY_PATH ?? ''
  if (!policyPath) {
    cachedPolicy = DEFAULT_POLICY
    return cachedPolicy
  }

  try {
    const raw = readFileSync(policyPath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<ZeroTrustPolicy>
    cachedPolicy = { ...DEFAULT_POLICY, ...parsed }
    logger.info('Zero trust policy loaded', { path: policyPath })
    return cachedPolicy
  } catch (e) {
    logger.warn('Failed to load zero trust policy, using defaults', {
      path: policyPath,
      error: (e as Error).message,
    })
    cachedPolicy = DEFAULT_POLICY
    return cachedPolicy
  }
}

/**
 * 判断当前时间是否在工作时间窗内。
 * @param policy 策略(默认 loadPolicy())
 */
export function isWithinWorkingHours(policy: Required<ZeroTrustPolicy> = loadPolicy()): boolean {
  const hour = new Date().getHours()
  const [start, end] = policy.workingHours
  return hour >= start && hour < end
}

/**
 * 评估零信任访问决策。
 *
 * 评估顺序(优先级从高到低,命中即返回):
 * 1. 黑名单 IP → deny
 * 2. 无任何身份认证(JWT + mTLS 都没有)→ deny
 * 3. 高敏感资源 + 公网 + 要求 mTLS → 缺 mTLS 返回 challenge,缺 JWT 返回 deny
 * 4. 高敏感资源 + 非工作时间(若策略要求)→ challenge
 * 5. 敏感资源 + 无设备信任 → challenge
 * 6. 通过所有检查 → allow
 */
export function evaluateAccess(ctx: ZeroTrustContext): ZeroTrustResult {
  const policy = loadPolicy()

  // 1. 黑名单 IP → deny(最高优先级)
  if (ctx.blacklistedIp) {
    return { decision: 'deny', reasons: ['Client IP is blacklisted'] }
  }

  // 2. 无任何身份认证 → deny
  if (!ctx.authenticated && !ctx.mtlsAuthenticated) {
    return { decision: 'deny', reasons: ['No authentication (neither JWT nor mTLS)'] }
  }

  // 3. 高敏感资源特殊策略
  if (ctx.resourceSensitivity === 'highly_sensitive') {
    // 公网访问高敏感资源 → 必须 mTLS + JWT 双重
    if (ctx.networkLocation === 'external' && policy.highlySensitiveExternalRequiresMtls) {
      if (!ctx.mtlsAuthenticated) {
        return {
          decision: 'challenge',
          reasons: ['Highly sensitive resource from external network requires mTLS'],
        }
      }
      if (!ctx.authenticated) {
        return {
          decision: 'deny',
          reasons: ['Highly sensitive resource from external network requires JWT'],
        }
      }
    }
    // 非工作时间访问高敏感资源 → challenge(若策略要求)
    if (policy.highlySensitiveRequiresWorkingHours && !ctx.isWorkingHours) {
      return {
        decision: 'challenge',
        reasons: ['Highly sensitive resource access outside working hours'],
      }
    }
  }

  // 4. 敏感资源(非高敏感) + 无设备信任 → challenge
  if (ctx.resourceSensitivity === 'sensitive' && !ctx.mtlsAuthenticated && !ctx.deviceTrusted) {
    return {
      decision: 'challenge',
      reasons: ['Sensitive resource requires device trust (mTLS or registered fingerprint)'],
    }
  }

  // 5. 通过所有检查 → allow
  const reasons: string[] = []
  if (ctx.authenticated) reasons.push('JWT authenticated')
  if (ctx.mtlsAuthenticated) reasons.push('mTLS client certificate verified')
  return { decision: 'allow', reasons }
}

/**
 * 重置策略缓存(用于测试或策略热重载)。
 */
export function resetPolicyCache(): void {
  cachedPolicy = null
}
