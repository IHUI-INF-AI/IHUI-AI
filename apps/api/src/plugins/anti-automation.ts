// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Fastify 反自动化插件(国安级风控前置防线)。
 *
 * onRequest 阶段执行:
 * 1. 提取 IP / UA / 路径,查 Redis 计数(IP 维度滑动窗口 + 用户维度单独计数)。
 * 2. 自动化检测:无 UA / curl / wget / python-requests / bot / headless 特征 → 标记。
 * 3. 响应策略:
 *    - 单 IP 1 分钟 > 100 请求 → 429 + 引入 CAPTCHA(响应头 X-Challenge-Required)
 *    - 单 IP 1 分钟 > 600 请求 → 403 临时封禁 15 分钟
 *    - 扫描器模式(/.env /admin /backup 等) → 立即 403 + 封禁 1 小时
 *    两个阈值可用 ANTI_AUTOMATION_CHALLENGE_THRESHOLD / ANTI_AUTOMATION_BLOCK_THRESHOLD 覆盖。
 *    封禁线定在 600 而非早先的 200:2026-09-23 实测用户仅打开一个页面就打出 205 次/分钟
 *    (前端按账号数线性扇出),被封 15 分钟。封禁是不可自助绕过的重处置,
 *    判据线必须落在人类正常使用够不着的位置。
 * 4. 白名单:内网 IP 自动放行;健康检查 UA 自动放行;
 *    监控探针与自助解封面豁免(见 utils/block-exempt-paths.ts)。
 * 5. 路由级开关:routeOptions.config.antiAutomation = { enabled: false } 可关闭。
 *
 * Redis 不可用时 fail-open(放行),保障可用性。
 */

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { verifyAccessToken } from '@ihui/auth'
import type { Redis } from 'ioredis'
import { logger } from '../utils/logger.js'
import {
  isBotUserAgent,
  isCurlLike,
  isHeadlessBrowser,
  isMissingOrShortUserAgent,
} from '../utils/bot-detection.js'
import { isPrivateIp, getIpReputationService } from '../services/ip-reputation.js'
import { isBlockExemptPath } from '../utils/block-exempt-paths.js'

/* -------------------------------------------------------------------------- */
/* 配置                                                                        */
/* -------------------------------------------------------------------------- */

export interface AntiAutomationRouteConfig {
  /** 是否启用本插件,默认 true */
  enabled?: boolean
  /** 单 IP 每分钟请求数阈值,超过返回 429。默认 100 */
  threshold?: number
}

declare module 'fastify' {
  interface FastifyContextConfig {
    antiAutomation?: AntiAutomationRouteConfig
  }
}

/** 单 IP 每分钟请求数阈值,超过返回 429。 */
const DEFAULT_THRESHOLD = readIntEnv('ANTI_AUTOMATION_CHALLENGE_THRESHOLD', 100)
/**
 * 触发 403 + 临时封禁的阈值。
 *
 * 原值 200 是**可被正常使用打穿的**:2026-09-23 实测,用户仅打开「平台账号管理」页
 * 就在 60 秒窗口内产生 205 个请求(按账号数线性扇出),被封 15 分钟。
 * 封禁是不可自助绕过的重处置,判据线必须落在"人类正常使用够不着"的位置,
 * 否则每个前端的扇出 bug 都会变成一次用户侧事故。
 * 600/分钟 = 持续 10 次/秒,远超任何真实交互;软性第一道仍是 429 + CAPTCHA。
 */
const BLOCK_THRESHOLD = readIntEnv('ANTI_AUTOMATION_BLOCK_THRESHOLD', 600)
/** 扫描器模式命中 → 封禁时长(秒)。 */
const SCANNER_BLOCK_SEC = 3600
/** 超频 403 封禁时长(秒)。 */
const RATE_BLOCK_SEC = 900
/** 滑动窗口(毫秒)。 */
const WINDOW_MS = 60_000

/** 读整数型环境变量;缺失或非法(<=0 / NaN)时用默认值。 */
function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

/** 健康检查 / 监控 UA 白名单关键词。 */
const HEALTH_UA_KEYWORDS = [
  'kube-probe',
  'elb-healthchecker',
  'prometheus',
  'gthealthcheck',
  'health-check',
  'uptime',
  'monitor',
] as const

/** 扫描器路径特征(与 anomaly-detector 保持一致语义)。 */
const SCANNER_PATTERNS: readonly string[] = [
  '/.env',
  '/.git',
  '/.aws',
  '/.ssh',
  '/wp-admin',
  '/wp-login',
  '/phpmyadmin',
  '/phpinfo',
  '/cgi-bin',
  '/actuator/env',
  '/manager/html',
  '/server-status',
  '/jenkins',
  '/solr',
  '/struts',
]

const K_FREQ = (ip: string) => `anti:auto:ip:${ip}`
const K_FREQ_USER = (uid: string) => `anti:auto:user:${uid}`

/* -------------------------------------------------------------------------- */
/* 插件实现                                                                    */
/* -------------------------------------------------------------------------- */

const antiAutomationPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  const redis: Redis | null = (server as unknown as { redis?: Redis }).redis ?? null
  const ipRep = getIpReputationService(redis)

  server.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // 路由级开关
    const aaCfg = request.routeOptions.config?.antiAutomation
    if (aaCfg?.enabled === false) return

    const ip = request.ip
    if (!ip) return

    // 内网白名单
    if (isPrivateIp(ip)) return

    // 健康检查 / 监控 UA 白名单
    const ua = request.headers['user-agent'] ?? ''
    if (isHealthCheckUa(ua)) return

    const path = (request.url.split('?')[0] ?? request.url).toLowerCase()

    // 监控探针与自助解封面:既不占频率预算,也不该被已有封禁挡住
    if (isBlockExemptPath(path)) return

    // 1. 扫描器模式:立即 403 + 封禁 1 小时
    if (isScannerPath(path)) {
      logger.warn('anti-automation: scanner pattern detected, blocking', { ip, path, ua })
      await ipRep.recordBadEvent(ip, 'scanner-pattern')
      await ipRep.blockIp(ip, SCANNER_BLOCK_SEC, 'scanner-detected')
      reply
        .status(403)
        .header('X-Block-Reason', 'scanner-detected')
        .header('Retry-After', String(SCANNER_BLOCK_SEC))
        .send({ code: 403, message: '检测到扫描行为,已被临时封禁' })
      return
    }

    // 2. IP 是否已被封禁
    const blockInfo = await ipRep.getBlockInfo(ip)
    if (blockInfo) {
      reply
        .status(403)
        .header('X-Block-Reason', 'ip-blocked')
        .header('Retry-After', String(blockInfo.remainingSec))
        .send({ code: 403, message: 'IP 已被临时封禁', retryAfterSec: blockInfo.remainingSec })
      return
    }

    // 3. 频率统计
    //    封禁只看 IP 维度:账号跑得快不该惩罚一个可能是 NAT / 手机热点共享的出口地址。
    //    用户维度单独计数并喂给信誉体系(recordBadEvent → threat-detector),不直接封 IP。
    //    (历史上这里取 max(ipCount, userCount) 判封禁,但 request.userId 在 onRequest
    //     阶段恒未填充 —— authenticate 跑得更晚 —— 所以 userCount 一直是 0,"双轨"实为单轨。)
    const threshold = aaCfg?.threshold ?? DEFAULT_THRESHOLD
    const now = Date.now()
    const ipCount = await incrCounter(redis, K_FREQ(ip), now, WINDOW_MS)
    const userId = await resolveUserIdForRate(request)
    const userCount = userId ? await incrCounter(redis, K_FREQ_USER(userId), now, WINDOW_MS) : 0
    if (userId && userCount > BLOCK_THRESHOLD) {
      logger.warn('anti-automation: user-dimension rate exceeded', { ip, userId, userCount })
      await ipRep.recordBadEvent(ip, 'user-rate-exceeded')
    }

    if (ipCount > BLOCK_THRESHOLD) {
      // > 阈值:403 + 封禁
      logger.warn('anti-automation: block threshold exceeded', {
        ip,
        userId,
        ipCount,
        userCount,
      })
      await ipRep.blockIp(ip, RATE_BLOCK_SEC, 'rate-limit-block')
      reply
        .status(403)
        .header('X-Block-Reason', 'rate-limit-block')
        .header('Retry-After', String(RATE_BLOCK_SEC))
        .send({ code: 403, message: '请求频率过高,IP 已被临时封禁 15 分钟' })
      return
    }

    if (ipCount > threshold) {
      // > 挑战阈值:429 + 要求 CAPTCHA
      const botFlag =
        isMissingOrShortUserAgent(ua) ||
        isCurlLike(ua) ||
        isHeadlessBrowser(ua) ||
        isBotUserAgent(ua)
      logger.warn('anti-automation: challenge threshold exceeded', {
        ip,
        userId,
        ipCount,
        userCount,
        botFlag,
      })
      reply
        .status(429)
        .header('X-Challenge-Required', 'captcha')
        .header('X-Challenge-Type', botFlag ? 'bot' : 'rate')
        .header('Retry-After', String(Math.ceil(WINDOW_MS / 1000)))
        .send({
          code: 429,
          message: '请求频率过高,需完成人机验证',
          challengeEndpoint: '/api/security/challenge',
        })
      return
    }

    // 4. 自动化标记(仅记录,不阻塞;高分由 anomaly-detector 综合)
    if (isMissingOrShortUserAgent(ua) || isCurlLike(ua) || isHeadlessBrowser(ua)) {
      logger.info('anti-automation: automation client flagged', { ip, path, ua })
      // 异步记录异常事件,不阻塞
      ipRep.recordBadEvent(ip, 'automation-ua').catch(() => {})
    }
  })
}

/* -------------------------------------------------------------------------- */
/* 辅助                                                                        */
/* -------------------------------------------------------------------------- */

function isHealthCheckUa(ua: string): boolean {
  if (!ua) return false
  const lower = ua.toLowerCase()
  return HEALTH_UA_KEYWORDS.some((k) => lower.includes(k))
}

/**
 * 尽力解析调用者身份 —— 只用于用户维度频率统计,不做任何授权判定。
 *
 * 只验签不查库:`authenticate()` 还会查用户状态,不能放进 onRequest 的每请求路径。
 * 任何失败一律返回 undefined —— 反自动化不是鉴权面,坏 token 自有后续鉴权层拒绝。
 * 历史上这里读 `request.userId`,但它在 onRequest 阶段恒未填充(authenticate 跑得更晚),
 * 导致"IP/用户双轨"实际只有 IP 一轨。
 */
async function resolveUserIdForRate(request: FastifyRequest): Promise<string | undefined> {
  const header = request.headers.authorization
  const cookieToken = (request as unknown as { cookies?: Record<string, string> }).cookies
    ?.auth_token
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : cookieToken
  if (!token) return undefined
  try {
    return (await verifyAccessToken(token)).userId
  } catch {
    return undefined
  }
}

function isScannerPath(path: string): boolean {
  return SCANNER_PATTERNS.some((p) => path.includes(p))
}

/**
 * 滑动窗口计数(Redis ZSET)。Redis 不可用时回退内存计数。
 * 返回当前窗口内请求数(含本次)。
 */
async function incrCounter(
  redis: Redis | null,
  key: string,
  now: number,
  windowMs: number,
): Promise<number> {
  if (!redis) {
    const arr = memFreq.get(key) ?? []
    const cutoff = now - windowMs
    const kept = arr.filter((t) => t > cutoff)
    kept.push(now)
    memFreq.set(key, kept)
    return kept.length
  }
  try {
    const pipe = redis.multi()
    pipe.zremrangebyscore(key, 0, now - windowMs)
    pipe.zcard(key)
    pipe.zadd(key, now, `${now}:${Math.random().toString(36).slice(2)}`)
    pipe.pexpire(key, windowMs)
    const res = await pipe.exec()
    const card = res?.[1]?.[1]
    return typeof card === 'number' ? card + 1 : 1
  } catch (e) {
    logger.warn('anti-automation: incrCounter failed, allow', { err: e })
    return 0
  }
}

const memFreq = new Map<string, number[]>()

export default fp(antiAutomationPlugin, {
  name: 'anti-automation',
  fastify: '5.x',
})

/** 供单测直接命中判据(§22c),不引入 CLI 副作用。 */
export const __test__ = {
  readIntEnv,
  resolveUserIdForRate,
  thresholds: () => ({ DEFAULT_THRESHOLD, BLOCK_THRESHOLD }),
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
