import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { authenticate } from '../plugins/auth.js'
import { z } from 'zod'
import { db } from '../db/index.js'
import { eq, and } from 'drizzle-orm'
import { subscriptions } from '@ihui/database'

/**
 * 历史项目缺失端点补齐 — 直播订阅模块(D6)。
 * 从原 legacy-completion.ts 拆分,注册 prefix 为 /api/legacy,完整路径保持不变。
 * - D6: 直播频道订阅(2端点 /live/subscribe + /live/unsubscribe)
 */
export const legacyLiveRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // ========== D6: 直播频道订阅 (2端点) ==========
  fastify.post('/live/subscribe', { preHandler: authenticate }, async (request, reply) => {
    const body = z
      .object({ channelId: z.string().uuid(), userId: z.string().uuid() })
      .parse(request.body)
    const [created] = await db
      .insert(subscriptions)
      .values({
        userId: body.userId,
        targetType: 'live_channel',
        targetId: body.channelId,
      })
      .returning()
    return reply.code(201).send(created)
  })

  fastify.delete('/live/unsubscribe', { preHandler: authenticate }, async (request) => {
    const { channelId, userId } = z
      .object({ channelId: z.string(), userId: z.string() })
      .parse(request.query)
    await db
      .delete(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.targetId, channelId)))
    return { unsubscribed: true }
  })
}
