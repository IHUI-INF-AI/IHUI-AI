/**
 * 激励视频广告回调路由(迁移自 zhs_app-ZZ/Ai-WXMiniVue/uniCloud-aliyun/cloudfunctions/rewarded-video-ad-notify-url/index.js)。
 *
 * 看广告得积分:广告平台回调 /notify 触发积分发放;
 * /config 返回广告位配置(从环境变量读取,带默认值)。
 *
 * 复用 routes/point.ts 的积分余额能力(findUserPointsBalance),
 * 通过直接插入 edu_point_records 记录实现积分发放(与 point 模块同表)。
 *
 * 注册(server.ts):
 *   server.register(rewardedVideoAdRoutes, { prefix: '/api/rewarded-video-ad' })
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { awardAdPoints } from '../db/point-queries.js'
import { success, error } from '../utils/response.js'

const notifySchema = z.object({
  userId: z.string().min(1),
  adType: z.string().optional(),
  rewardAmount: z.number().int().min(1).optional(),
  transactionId: z.string().optional(),
  signature: z.string().optional(),
})

/** 广告回调事务去重 Redis key 前缀 + TTL(24h,覆盖广告平台最长重试周期) */
const AD_TX_PREFIX = 'ad:tx:'
const AD_TX_TTL_SEC = 86_400

export const rewardedVideoAdRoutes: FastifyPluginAsync = async (server) => {
  // POST /notify — 广告回调(广告平台服务端调用,无需用户 token)
  server.post('/notify', async (request, reply) => {
    const body = notifySchema.parse(request.body)
    // 简单签名校验(若有配置 REWARDED_AD_SECRET,则要求 signature == sha256(userId+tx+secret))
    const secret = process.env.REWARDED_AD_SECRET
    if (secret) {
      const tx = body.transactionId ?? ''
      const expected = await import('node:crypto').then((c) =>
        c.createHash('sha256').update(`${body.userId}${tx}${secret}`).digest('hex'),
      )
      if (body.signature !== expected) {
        return reply.status(403).send(error(403, '签名校验失败'))
      }
    }
    // 事务去重:Redis SET NX(跨实例共享 + 重启不丢失,替代进程内 Set)
    if (body.transactionId) {
      const ok = await server.redis.set(
        `${AD_TX_PREFIX}${body.transactionId}`,
        '1',
        'EX',
        AD_TX_TTL_SEC,
        'NX',
      )
      if (!ok) {
        // 已处理过(广告平台重复回调),幂等返回
        return reply.send(success({ duplicated: true, awarded: false }))
      }
    }
    const rewardAmount = body.rewardAmount ?? Number(process.env.REWARDED_AD_POINTS ?? 10)
    // P0 修复(Lost Update):复用 awardAdPoints 事务(FOR UPDATE + INSERT),
    // 替代手动 findUserPointsBalance + INSERT 非原子序列
    let newBalance: number
    try {
      const result = await awardAdPoints(
        body.userId,
        rewardAmount,
        `激励视频广告奖励(${body.adType ?? 'unknown'})`,
        body.transactionId ?? null,
      )
      newBalance = result.afterBalance
    } catch (e) {
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
