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
import { db } from '../db/index.js'
import { eduPointRecords } from '@ihui/database'
import { findUserPointsBalance } from '../db/point-queries.js'
import { success, error } from '../utils/response.js'

const notifySchema = z.object({
  userId: z.string().min(1),
  adType: z.string().optional(),
  rewardAmount: z.number().int().min(1).optional(),
  transactionId: z.string().optional(),
  signature: z.string().optional(),
})

// 已发放的回调事务去重(防止广告平台重复回调)
const processedTx = new Set<string>()

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
    // 事务去重
    if (body.transactionId) {
      if (processedTx.has(body.transactionId)) {
        return reply.send(success({ duplicated: true, awarded: false }))
      }
      processedTx.add(body.transactionId)
      // 防止内存无限增长(保留最近 10000 条)
      if (processedTx.size > 10_000) {
        const first = processedTx.values().next().value
        if (first) processedTx.delete(first)
      }
    }
    const rewardAmount = body.rewardAmount ?? Number(process.env.REWARDED_AD_POINTS ?? 10)
    const currentBalance = await findUserPointsBalance(body.userId)
    const newBalance = currentBalance + rewardAmount
    try {
      await db.insert(eduPointRecords).values({
        memberId: body.userId,
        point: rewardAmount,
        balance: newBalance,
        type: 'rewarded_ad',
        description: `激励视频广告奖励(${body.adType ?? 'unknown'})`,
        refId: body.transactionId ?? null,
      })
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
