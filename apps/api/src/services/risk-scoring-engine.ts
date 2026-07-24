/**
 * 综合风险评分引擎(国安级登录风控)。
 *
 * 5 维度评分(总分 100,越高越危险):
 * - 异常 IP 地理位置/黑名单 (40 分) — 整合 risk-engine-service
 * - 新设备指纹 (20 分)
 * - 异常登录时间凌晨 0-6 点 (10 分)
 * - 高频登录尝试 5 分钟内 ≥5 次 (15 分)
 * - 用户代理异常 curl/bot/空 UA (15 分)
 *
 * 决策:< 30 allow / 30-59 challenge / >= 60 deny
 * 缓存:Redis 5 分钟,key=risk:user:{userId}:{fp}
 */
import type { Redis } from 'ioredis'
import { logger } from '../utils/logger.js'
import { evaluateRisk, type RiskContext } from './risk-engine-service.js'
import { isNewDevice, rGet, rSet } from './device-fingerprint.js'

export interface RiskScoreInput {
  userId: string
  ip: string
  deviceFingerprint: string
  loginTime: number // epoch ms
  userAgent: string
}

export interface RiskFactor {
  name: string
  score: number
  detail: string
}

export interface RiskScoreResult {
  score: number
  decision: 'allow' | 'challenge' | 'deny'
  factors: RiskFactor[]
  evaluatedAt: number
}

const SCORE_CACHE_TTL_SEC = 5 * 60
const SCORE_CACHE_PREFIX = 'risk:user:'
const LOGIN_ATTEMPTS_PREFIX = 'login_attempts:'
const LOGIN_ATTEMPTS_WINDOW_SEC = 5 * 60
const LOGIN_ATTEMPTS_THRESHOLD = 5

// 简化 IP 黑名单前缀段(生产环境应接入威胁情报动态加载)
const IP_BLACKLIST_PREFIXES: readonly string[] = []

/**
 * 计算综合风险评分。
 * @param redis Redis 客户端(可为 null,降级到内存)
 */
export async function calculateRiskScore(
  input: RiskScoreInput,
  redis: Redis | null = null,
): Promise<RiskScoreResult> {
  // 1. 查缓存
  const cacheKey = `${SCORE_CACHE_PREFIX}${input.userId}:${input.deviceFingerprint}`
  const cached = await rGet(redis, cacheKey)
  if (cached) {
    try {
      return JSON.parse(cached) as RiskScoreResult
    } catch {
      // 缓存损坏,重新计算
    }
  }

  const factors: RiskFactor[] = []

  // 维度一:异常 IP (最高 40 分)
  const ipScore = scoreIpRisk(input.ip)
  if (ipScore > 0) {
    factors.push({ name: '异常 IP', score: ipScore, detail: `IP ${input.ip} 命中风险规则` })
  }

  // 维度二:新设备 (20 分)
  const newDevice = await isNewDevice(redis, input.userId, input.deviceFingerprint)
  if (newDevice) {
    factors.push({ name: '新设备', score: 20, detail: '设备指纹不在可信列表' })
  }

  // 维度三:异常登录时间凌晨 0-6 点 (10 分)
  const hour = new Date(input.loginTime).getHours()
  if (hour >= 0 && hour < 6) {
    factors.push({ name: '异常登录时间', score: 10, detail: `登录时间 ${hour}:xx(凌晨 0-6 点)` })
  }

  // 维度四:高频登录尝试 (15 分)
  const attemptCount = await getLoginAttemptCount(redis, input.userId)
  if (attemptCount >= LOGIN_ATTEMPTS_THRESHOLD) {
    factors.push({
      name: '高频登录尝试',
      score: 15,
      detail: `${attemptCount} 次尝试 / ${LOGIN_ATTEMPTS_WINDOW_SEC}s`,
    })
  }

  // 维度五:UA 异常 (15 分)
  if (isAbnormalUserAgent(input.userAgent)) {
    factors.push({
      name: '用户代理异常',
      score: 15,
      detail: `UA: ${input.userAgent.slice(0, 80)}`,
    })
  }

  const score = Math.min(100, factors.reduce((sum, f) => sum + f.score, 0))
  const decision: RiskScoreResult['decision'] =
    score >= 60 ? 'deny' : score >= 30 ? 'challenge' : 'allow'

  const result: RiskScoreResult = { score, decision, factors, evaluatedAt: Date.now() }

  // 写缓存
  await rSet(redis, cacheKey, JSON.stringify(result), SCORE_CACHE_TTL_SEC)

  if (decision === 'deny') {
    logger.warn('风险评分 deny', { userId: input.userId, score, factors })
  }

  return result
}

/**
 * 记录登录尝试(用于高频检测,5 分钟滑动窗口)。
 */
export async function recordLoginAttempt(redis: Redis | null, userId: string): Promise<void> {
  const key = `${LOGIN_ATTEMPTS_PREFIX}${userId}`
  const raw = await rGet(redis, key)
  const count = raw ? parseInt(raw, 10) || 0 : 0
  await rSet(redis, key, String(count + 1), LOGIN_ATTEMPTS_WINDOW_SEC)
}

async function getLoginAttemptCount(redis: Redis | null, userId: string): Promise<number> {
  const raw = await rGet(redis, `${LOGIN_ATTEMPTS_PREFIX}${userId}`)
  return raw ? parseInt(raw, 10) || 0 : 0
}

/**
 * IP 风险评分(简化版):黑名单 → 40 分,整合 risk-engine-service。
 */
function scoreIpRisk(ip: string): number {
  if (!ip) return 20 // 无 IP 可疑

  // 私有 IP 低风险
  if (isPrivateIp(ip)) return 0

  // 黑名单匹配
  if (IP_BLACKLIST_PREFIXES.some((p) => ip.startsWith(p))) return 40

  // 整合 risk-engine-service:构造 RiskContext 评估
  const ctx: RiskContext = { ip, ipBlacklisted: false }
  try {
    const result = evaluateRisk(ctx)
    if (result.action === 'DENY') return 40
    if (result.totalScore > 0) return Math.min(40, result.totalScore)
  } catch {
    // risk-engine 异常不影响主流程
  }

  return 0
}

function isPrivateIp(ip: string): boolean {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('127.') ||
    ip === '::1'
  )
}

function isAbnormalUserAgent(ua: string): boolean {
  if (!ua || ua.length < 10) return true
  const lower = ua.toLowerCase()
  if (lower.includes('curl') || lower.includes('wget')) return true
  if (lower.includes('bot') || lower.includes('spider') || lower.includes('crawler')) return true
  return false
}
