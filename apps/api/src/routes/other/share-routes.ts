/**
 * 分享链接(从 frontend-stub-other-routes.ts 拆分)。
 * POST /shares — 创建分享链接(mobile-rn ShareScreen)
 * 用 systemConfigs 表存(category='share-link',key='share-link:<code>',value=JSON)
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { db } from '../../db/index.js'
import { systemConfigs } from '@ihui/database'

export const shareRoutes: FastifyPluginAsync = async (server) => {
  server.post('/shares', async (request, reply) => {
    const body = z
      .object({
        targetType: z.string().min(1).max(32),
        targetId: z.string().min(1).max(100),
        remark: z.string().max(500).optional(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const shareCode = randomUUID().replace(/-/g, '').slice(0, 16)
    const expireAt = new Date(Date.now() + 7 * 86400_000)
    await db.insert(systemConfigs).values({
      key: `share-link:${shareCode}`,
      value: JSON.stringify({
        targetType: body.data.targetType,
        targetId: body.data.targetId,
        remark: body.data.remark ?? '',
        createdBy: request.userId,
        expireAt: expireAt.toISOString(),
      }),
      type: 'json',
      category: 'share-link',
    })
    const shareUrl = `https://aizhs.top/s/${shareCode}`
    return reply.status(201).send(
      success({
        shareUrl,
        shareCode,
        expireAt: expireAt.toISOString(),
      }),
    )
  })
}
