/**
 * 国安级运行时威胁检测与响应插件。
 *
 * 与 anti-automation 互补:
 * - anti-automation: 基于 specific events(scanner pattern / rate limit)封禁
 * - threat-detector: 基于 IP 信誉 SCORE 主动封禁(proactive,不只 reactive)
 *
 * 能力:
 * 1. onRequest 检查 IP 是否已被封禁(快速路径,isIpBlocked)
 * 2. 采样检查 IP 信誉评分(每 30s 每 IP 最多查一次,避免 Redis 压力)
 * 3. 评分超阈值(>=80)自动封禁 + 递增封禁时长(1h→24h→7d→30d)
 * 4. 评分中风险(>=60)告警日志(允许通过但标记监控)
 * 5. 威胁事件计数 + 实时统计
 *
 * 协同:
 * - sqli-guard / xss-protection / anti-automation 调用 recordBadEvent → 评分升高
 * - 本插件消费评分 → 自动封禁 → 后续请求被 isIpBlocked 拦截
 */

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from 'fastify'
import fp from 'fastify-plugin'
import type { Redis } from 'ioredis'
import { getIpReputationService, isPrivateIp } from '../services/ip-reputation.js'
import { logger } from '../utils/logger.js'

/** 信誉评分阈值:>= 此值自动封禁 */
const THREAT_BLOCK_THRESHOLD = 80
/** 信誉评分阈值:>= 此值告警(允许通过) */
const THREAT_WARN_THRESHOLD = 60
/** 采样间隔:同一 IP 每 N 秒最多查一次信誉(避免 Redis 压力) */
const REPUTATION_CHECK_INTERVAL_SEC = 30
/** 内网 IP 跳过(不检测威胁) */
const SKIP_PRIVATE_IP = true

/** 递增封禁时长(秒),按 bad event 计数递增 */
const PROGRESSIVE_BLOCK_DURATIONS = [
  3600,        // 1st: 1 小时
  86400,       // 2nd: 24 小时
  7 * 86400,   // 3rd: 7 天
  30 * 86400,  // 4th+: 30 天
]

/** 健康检查 / 监控路径白名单 */
const SKIP_PATHS = new Set([
  '/api/health',
  '/api/ready',
  '/api/metrics',
  '/business-metrics',
])

declare module 'fastify' {
  interface FastifyInstance {
    threatDetector: {
      /** 累计威胁检测次数 */
      readonly totalChecks: number
      /** 累计自动封禁次数 */
      readonly totalAutoBlocks: number
      /** 累计告警次数 */
      readonly totalWarnings: number
      /** 获取威胁统计快照 */
      getStats(): ThreatStats
    }
  }
}

export interface ThreatStats {
  totalChecks: number
  totalAutoBlocks: number
  totalWarnings: number
  /** 当前监控中的 IP 列表(评分 >= WARN_THRESHOLD 但未封禁) */
  watchedIps: Array<{ ip: string; score: number; reasons: string[] }>
  /** 最近封禁的 IP 列表(最多 20 条) */
  recentBlocks: Array<{ ip: string; score: number; duration: string; timestamp: number }>
}

/** 每 IP 上次信誉查询时间(in-memory,单实例) */
const lastCheckTime = new Map<string, number>()
/** 监控中的 IP(评分 >= WARN 但 < BLOCK) */
const watchedIps = new Map<string, { score: number; reasons: string[]; lastSeen: number }>()
/** 最近封禁记录 */
const recentBlocks: Array<{ ip: string; score: number; duration: string; timestamp: number }> = []
const MAX_RECENT_BLOCKS = 20

const threatDetectorPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  const redis: Redis | null = (server as unknown as { redis?: Redis }).redis ?? null
  const ipRep = getIpReputationService(redis)

  let totalChecks = 0
  let totalAutoBlocks = 0
  let totalWarnings = 0

  // 定期清理过期的 watchedIps(10 分钟未见)
  const cleanupInterval = setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000
    for (const [ip, info] of watchedIps) {
      if (info.lastSeen < cutoff) watchedIps.delete(ip)
    }
    // 清理 lastCheckTime(避免 Map 无限增长)
    if (lastCheckTime.size > 10000) {
      const oldCutoff = Date.now() - 5 * 60 * 1000
      for (const [ip, ts] of lastCheckTime) {
        if (ts < oldCutoff) lastCheckTime.delete(ip)
      }
    }
  }, 60_000)
  cleanupInterval.unref()

  server.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = (request.url.split('?')[0] ?? request.url).toLowerCase()
    if (SKIP_PATHS.has(path)) return

    const ip = request.ip
    if (!ip) return

    // 内网跳过(开发环境友好)
    if (SKIP_PRIVATE_IP && isPrivateIp(ip)) return

    totalChecks++

    // 1. 快速路径:检查是否已被封禁
    const isBlocked = await ipRep.isIpBlocked(ip)
    if (isBlocked) {
      reply
        .status(403)
        .header('X-Block-Reason', 'threat-detector-blocked')
        .send({ code: 403, message: '访问被拒绝' })
      return
    }

    // 2. 采样检查信誉评分(每 30s 最多查一次)
    const now = Date.now()
    const lastCheck = lastCheckTime.get(ip) ?? 0
    if (now - lastCheck < REPUTATION_CHECK_INTERVAL_SEC * 1000) return
    lastCheckTime.set(ip, now)

    const rep = await ipRep.getIpReputation(ip)

    // 3. 评分 >= BLOCK_THRESHOLD:自动封禁(递增时长)
    if (rep.score >= THREAT_BLOCK_THRESHOLD) {
      // 根据 bad events 计数决定封禁时长
      // bad events 计数从 reputation reasons 中解析(格式: "bad-events:N")
      const badEventsMatch = rep.reasons.find((r) => r.startsWith('bad-events:'))
      const badEventsCount = badEventsMatch ? parseInt(badEventsMatch.split(':')[1] ?? '0', 10) : 0
      const durationIdx = Math.min(
        Math.floor(badEventsCount / 5),
        PROGRESSIVE_BLOCK_DURATIONS.length - 1,
      )
      const blockDuration = PROGRESSIVE_BLOCK_DURATIONS[durationIdx] ?? 3600
      const durationLabel = ['1小时', '24小时', '7天', '30天'][durationIdx] ?? '1小时'

      await ipRep.blockIp(ip, blockDuration)
      totalAutoBlocks++

      // 记录最近封禁
      recentBlocks.unshift({
        ip,
        score: rep.score,
        duration: durationLabel,
        timestamp: now,
      })
      if (recentBlocks.length > MAX_RECENT_BLOCKS) recentBlocks.pop()

      // 从监控列表移除(已封禁)
      watchedIps.delete(ip)

      logger.warn('threat-detector: IP auto-blocked (high threat score)', {
        ip,
        score: rep.score,
        reasons: rep.reasons,
        blockDuration: durationLabel,
        badEvents: badEventsCount,
      })

      reply
        .status(403)
        .header('X-Block-Reason', 'high-threat-score')
        .header('X-Threat-Score', String(rep.score))
        .send({ code: 403, message: '访问被拒绝' })
      return
    }

    // 4. 评分 >= WARN_THRESHOLD:告警但允许通过
    if (rep.score >= THREAT_WARN_THRESHOLD) {
      totalWarnings++
      watchedIps.set(ip, {
        score: rep.score,
        reasons: rep.reasons,
        lastSeen: now,
      })
      logger.warn('threat-detector: high-risk IP detected (warn)', {
        ip,
        score: rep.score,
        reasons: rep.reasons,
        path,
      })
    } else {
      // 评分降低后从监控列表移除
      watchedIps.delete(ip)
    }
  })

  server.decorate('threatDetector', {
    get totalChecks() { return totalChecks },
    get totalAutoBlocks() { return totalAutoBlocks },
    get totalWarnings() { return totalWarnings },
    getStats(): ThreatStats {
      return {
        totalChecks,
        totalAutoBlocks,
        totalWarnings,
        watchedIps: Array.from(watchedIps.entries()).map(([ip, info]) => ({
          ip,
          score: info.score,
          reasons: info.reasons,
        })),
        recentBlocks: [...recentBlocks],
      }
    },
  })

  server.addHook('onClose', async () => {
    clearInterval(cleanupInterval)
    lastCheckTime.clear()
    watchedIps.clear()
    recentBlocks.length = 0
  })
}

export default fp(threatDetectorPlugin, {
  name: 'threat-detector',
  fastify: '5.x',
})
