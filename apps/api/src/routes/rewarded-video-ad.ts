/**
 * 激励视频广告回调路由(迁移自 zhs_app-ZZ/Ai-WXMiniVue/uniCloud-aliyun/cloudfunctions/rewarded-video-ad-notify-url/index.js)。
 *
 * 看广告得积分:广告平台回调 /notify 触发积分发放;
 * /config 返回广告位配置(从环境变量读取,带默认值)。
 *
 * P0-3 安全加固(2026-08-05):
 * 1. REWARDED_AD_SECRET 未配置 → 503 fail-closed(原实现未配置时直接跳过签名校验,默认裸奔);
 * 2. transactionId 必填(原可选,不传则跳过 Redis 去重 → 无限刷);
 * 3. rewardAmount 强制 ≤1000,且为正整数(原无上限);
 * 4. userId 必须 UUID;
 * 5. 新增每用户每日积分上限(Redis INCRBY + 超限回滚),与 /config 的 dailyLimit 一致。
 *
 * 注册(server.ts):
 *   server.register(rewardedVideoAdRoutes, { prefix: '/api/rewarded-video-ad' })
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { createHash } from 'node:crypto'
import { awardAdPoints } from '../db/point-queries.js'
import { success, error } from '../utils/response.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const notifySchema = z.object({
  userId: z.string().regex(UUID_RE, 'userId 必须为 UUID'),
  adType: z.string().optional(),
  rewardAmount: z.number().int().min(1).max(1000).optional(),
  transactionId: z.string().min(1, 'transactionId 必填(防重放)'),
  signature: z.string().min(1, 'signature 必填'),
})

/** 广告回调事务去重 Redis key 前缀 + TTL(24h,覆盖广告平台最长重试周期) */
const AD_TX_PREFIX = 'ad:tx:'
const AD_TX_TTL_SEC = 86_400
/** 每用户每日发放积分计数 Redis key 前缀(当日 0 点自然过期) */
const AD_DAILY_PREFIX = 'ad:daily:'
const AD_DAILY_TTL_SEC = 86_400

export const rewardedVideoAdRoutes: FastifyPluginAsync = async (server) => {
  // POST /notify — 广告回调(广告平台服务端调用,无需用户 token)
  server.post('/notify', async (request, reply) => {
    const body = notifySchema.parse(request.body)

    // P0-3 fail-closed:secret 未配置一律拒绝服务,绝不静默跳过签名校验
    const secret = process.env.REWARDED_AD_SECRET
    if (!secret) {
      return reply.status(503).send(error(503, '服务端未配置 REWARDED_AD_SECRET,拒绝处理广告回调'))
    }
    // 签名:sha256(userId + transactionId + secret),与广告平台约定
    const expected = createHash('sha256')
      .update(`${body.userId}${body.transactionId}${secret}`)
      .digest('hex')
    if (body.signature !== expected) {
      return reply.status(403).send(error(403, '签名校验失败'))
    }

    // 事务去重:Redis SET NX(跨实例共享 + 重启不丢失,替代进程内 Set)
    const txOk = await server.redis.set(
      `${AD_TX_PREFIX}${body.transactionId}`,
      '1',
      'EX',
      AD_TX_TTL_SEC,
      'NX',
    )
    if (!txOk) {
      // 已处理过(广告平台重复回调),幂等返回
      return reply.send(success({ duplicated: true, awarded: false }))
    }

    const rewardAmount = body.rewardAmount ?? Number(process.env.REWARDED_AD_POINTS ?? 10)
    if (!Number.isInteger(rewardAmount) || rewardAmount <= 0 || rewardAmount > 1000) {
      // 释放去重锁,否则该 transactionId 永久被吞(无重试机会)
      await server.redis.del(`${AD_TX_PREFIX}${body.transactionId}`)
      return reply.status(400).send(error(400, 'rewardAmount 必须为 1~1000 的整数'))
    }

    // 每用户每日积分上限(Redis INCRBY,0 点自然过期;超限回滚计数并释放去重锁)
    const dailyKey = `${AD_DAILY_PREFIX}${body.userId}`
    const dailyLimit = Number(process.env.REWARDED_AD_DAILY_LIMIT ?? 50)
    const dayTotal = await server.redis.incrby(dailyKey, rewardAmount)
    if (dayTotal === rewardAmount) {
      await server.redis.expire(dailyKey, AD_DAILY_TTL_SEC)
    }
    if (dailyLimit > 0 && dayTotal > dailyLimit) {
      await server.redis.decrby(dailyKey, rewardAmount)
      await server.redis.del(`${AD_TX_PREFIX}${body.transactionId}`)
      return reply.status(429).send(error(429, '今日广告积分已达上限'))
    }

    // P0 修复(Lost Update):复用 awardAdPoints 事务(FOR UPDATE + INSERT),
    // 替代手动 findUserPointsBalance + INSERT 非原子序列
    let newBalance: number
    try {
      const result = await awardAdPoints(
        body.userId,
        rewardAmount,
        `激励视频广告奖励(${body.adType ?? 'unknown'})`,
        body.transactionId,
      )
      newBalance = result.afterBalance
    } catch (e) {
      // 发放失败:回滚每日计数并释放去重锁,允许广告平台重试
      await server.redis.decrby(dailyKey, rewardAmount)
      await server.redis.del(`${AD_TX_PREFIX}${body.transactionId}`)
      return reply.status(500).send(error(500, `积分发放失败: ${(e as Error).message}`))
    }
    // 通过 WS 通知用户积分到账(若 pushNotification 可用)
    try {
      server.pushNotification(body.userId, {
        type: 'rewarded_ad',
        event: 'points_awarded',
        amount: rewardAmount,
        balance: newBalance,
      })
    } catch {
      /* ignore */
    }
    return reply.send(success({ awarded: true, amount: rewardAmount, balance: newBalance }))
  })

  // GET /config — 获取广告配置(客户端拉取广告位 ID / 奖励积分)
  server.get('/config', async (_request, reply) => {
    const config = {
      adUnitId: process.env.REWARDED_AD_UNIT_ID ?? '',
      appId: process.env.REWARDED_AD_APP_ID ?? '',
      rewardPoints: Number(process.env.REWARDED_AD_POINTS ?? 10),
      dailyLimit: Number(process.env.REWARDED_AD_DAILY_LIMIT ?? 50),
      enabled: process.env.REWARDED_AD_ENABLED !== 'false',
    }
    return reply.send(success(config))
  })
}
