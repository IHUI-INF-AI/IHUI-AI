/**
 * 安全风控路由(国安级)。
 *
 * 挂载前缀建议 /api/security:
 *   POST   /challenge              生成 CAPTCHA 挑战(无认证)
 *   POST   /verify-challenge       验证 CAPTCHA 答案,返回临时 token(无认证)
 *   GET    /ip-reputation/:ip      查询 IP 信誉(仅 admin)
 *   POST   /block-ip               封禁指定 IP(仅 admin)
 *   DELETE /block-ip/:ip           解封 IP(仅 admin)
 *   GET    /anomalies              查询异常事件列表(仅 admin,分页 + 过滤)
 *   POST   /report                 用户主动上报可疑活动(无认证,带 rate limit)
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import type { Redis } from 'ioredis'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { logger } from '../utils/logger.js'
import {
  CaptchaService,
  type ChallengeType,
  getCaptchaService,
} from '../services/captcha-service.js'
import { IpReputationService, getIpReputationService } from '../services/ip-reputation.js'
import { AnomalyDetector, getAnomalyDetector } from '../services/anomaly-detector.js'

/* -------------------------------------------------------------------------- */
/* 校验 schema                                                                 */
/* -------------------------------------------------------------------------- */

const challengeSchema = z.object({
  type: z.enum(['image', 'math', 'recaptcha']).optional(),
})

const verifySchema = z.object({
  challengeId: z.string().min(1),
  answer: z.string().min(1),
})

const blockIpSchema = z.object({
  ip: z.string().min(1),
  duration: z.number().int().positive().max(30 * 24 * 3600).default(3600),
  reason: z.string().max(500).optional(),
})

const anomaliesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  minScore: z.coerce.number().min(0).max(100).optional(),
  ip: z.string().optional(),
})

const reportSchema = z.object({
  type: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  ip: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

/* -------------------------------------------------------------------------- */
/* admin 守卫                                                                   */
/* -------------------------------------------------------------------------- */

async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  try {
    await authenticate(request)
  } catch {
    reply.status(401).send(error(401, '需要登录'))
    return false
  }
  const roleId = request.jwtPayload?.roleId ?? 0
  if (roleId < 1) {
    reply.status(403).send(error(403, '需要管理员权限'))
    return false
  }
  return true
}

/* -------------------------------------------------------------------------- */
/* 路由                                                                        */
/* -------------------------------------------------------------------------- */

export const securityRoutes: FastifyPluginAsync = async (server) => {
  const redis: Redis | null = (server as unknown as { redis?: Redis }).redis ?? null
  const captcha: CaptchaService = getCaptchaService(redis)
  const ipRep: IpReputationService = getIpReputationService(redis)
  const anomaly: AnomalyDetector = getAnomalyDetector(redis)

  /* ---------------------- 1. 生成 CAPTCHA 挑战(无认证) ---------------------- */
  server.post('/challenge', async (request, reply) => {
    let type: ChallengeType = 'image'
    if (request.body && typeof request.body === 'object') {
      const parsed = challengeSchema.safeParse(request.body)
      if (parsed.success && parsed.data.type) type = parsed.data.type
    }
    const ip = request.ip
    try {
      const challenge = await captcha.generateChallenge(type, ip)
      return success(challenge)
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('rate limit')) {
        return reply.status(429).send(error(429, '挑战请求过于频繁,请稍后再试'))
      }
      logger.error('security: generateChallenge failed', { err: e })
      return reply.status(500).send(error(500, '生成挑战失败'))
    }
  })

  /* ---------------------- 2. 验证 CAPTCHA(无认证) ---------------------- */
  server.post('/verify-challenge', async (request, reply) => {
    const parsed = verifySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await captcha.verifyChallenge(parsed.data.challengeId, parsed.data.answer)
    if (!result.valid) {
      return reply.status(400).send(error(400, result.reason ?? '验证失败'))
    }
    return success({ token: result.token, valid: true })
  })

  /* ---------------------- 3. 查询 IP 信誉(仅 admin) ---------------------- */
  server.get<{ Params: { ip: string } }>(
    '/ip-reputation/:ip',
    async (request, reply) => {
      if (!(await requireAdmin(request, reply))) return
      const { ip } = request.params
      const rep = await ipRep.getIpReputation(ip)
      return success(rep)
    },
  )

  /* ---------------------- 4. 封禁 IP(仅 admin) ---------------------- */
  server.post('/block-ip', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = blockIpSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { ip, duration, reason } = parsed.data
    await ipRep.blockIp(ip, duration)
    if (reason) await ipRep.recordBadEvent(ip, `admin-block:${reason}`)
    logger.warn('security: admin blocked ip', { ip, duration, reason, by: request.userId })
    return success({ ip, duration, blocked: true })
  })

  /* ---------------------- 5. 解封 IP(仅 admin) ---------------------- */
  server.delete<{ Params: { ip: string } }>(
    '/block-ip/:ip',
    async (request, reply) => {
      if (!(await requireAdmin(request, reply))) return
      const { ip } = request.params
      await ipRep.unblockIp(ip)
      logger.info('security: admin unblocked ip', { ip, by: request.userId })
      return success({ ip, blocked: false })
    },
  )

  /* ---------------------- 6. 查询异常事件列表(仅 admin) ---------------------- */
  server.get('/anomalies', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = anomaliesQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await anomaly.getRecentAnomalies({
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      minScore: parsed.data.minScore,
      ipFilter: parsed.data.ip,
    })
    return success(result)
  })

  /* ---------------------- 7. 用户主动上报可疑活动(无认证,限流) ---------------------- */
  server.post('/report', async (request, reply) => {
    const ip = request.ip
    // 限流:同 IP 5 次/分钟
    const allowed = await checkReportRateLimit(redis, ip)
    if (!allowed) {
      return reply.status(429).send(error(429, '上报过于频繁,请稍后再试'))
    }

    const parsed = reportSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const reportIp = parsed.data.ip ?? ip
    await ipRep.recordBadEvent(reportIp, `user-report:${parsed.data.type}`)

    // 高分上报触发异常检测记录
    const event = {
      timestamp: Date.now(),
      ip: reportIp,
      userId: request.userId,
      url: '/api/security/report',
      score: 50,
      recommendation: 'monitor' as const,
      dimensions: [
        { name: 'user-report', score: 50, weight: 1 },
      ],
    }
    await anomaly.recordEvent(event)

    logger.info('security: user report received', {
      type: parsed.data.type,
      ip: reportIp,
      reporter: ip,
    })
    return success({ received: true })
  })
}

/* -------------------------------------------------------------------------- */
/* 上报限流                                                                     */
/* -------------------------------------------------------------------------- */

const REPORT_RATE_LIMIT = 5
const REPORT_WINDOW_SEC = 60
const K_REPORT_RATE = (ip: string) => `security:report:ratelimit:${ip}`

// 内存降级存储
const memReportRate = new Map<string, { count: number; expiresAt: number }>()

async function checkReportRateLimit(redis: Redis | null, ip: string): Promise<boolean> {
  if (!redis) {
    const cur = memReportRate.get(ip) ?? { count: 0, expiresAt: 0 }
    if (cur.expiresAt < Date.now()) cur.count = 0
    cur.count += 1
    cur.expiresAt = Date.now() + REPORT_WINDOW_SEC * 1000
    memReportRate.set(ip, cur)
    return cur.count <= REPORT_RATE_LIMIT
  }
  try {
    const key = K_REPORT_RATE(ip)
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, REPORT_WINDOW_SEC)
    return count <= REPORT_RATE_LIMIT
  } catch (e) {
    logger.warn('security: report rate limit check failed, allow', { err: e })
    return true
  }
}

export default securityRoutes
