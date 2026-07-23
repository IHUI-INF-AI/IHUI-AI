/**
 * ZHS 用户平台/Agent 音频/用户平台别名路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/user-platform, /admin/user-agent-audio, /admin/zhs-user
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { zhsUserPlatform, zhsUserAgentAudio } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
import { idParamSchema } from './_shared.js'

const createUserPlatformSchema = z.object({
  userUuid: z.string().min(1),
  platformId: z.coerce.number().int(),
  status: z.number().int().optional(),
})
const updateUserPlatformSchema = createUserPlatformSchema.partial()

const createUserAgentAudioSchema = z.object({
  userUuid: z.string().min(1),
  agentId: z.string().min(1),
  audioUrl: z.string().max(500).optional(),
  duration: z.number().int().optional(),
})
const updateUserAgentAudioSchema = createUserAgentAudioSchema.partial()

export const zhsUserRoutes: FastifyPluginAsync = async (server) => {
  server.post('/admin/user-platform', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createUserPlatformSchema, request.body)
    const [row] = await db.insert(zhsUserPlatform).values(body).returning()
    return reply.status(201).send(success(row))
  })
  server.put('/admin/user-platform/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateUserPlatformSchema, request.body)
    const [row] = await db
      .update(zhsUserPlatform)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(zhsUserPlatform.id, Number(id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete(
    '/admin/user-platform/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      await db.delete(zhsUserPlatform).where(eq(zhsUserPlatform.id, Number(id)))
      return reply.send(success({ id, deleted: true }))
    },
  )
  server.post('/admin/user-agent-audio', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createUserAgentAudioSchema, request.body)
    const [row] = await db.insert(zhsUserAgentAudio).values(body).returning()
    return reply.status(201).send(success(row))
  })
  server.put(
    '/admin/user-agent-audio/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const body = parseOrThrow(updateUserAgentAudioSchema, request.body)
      const [row] = await db
        .update(zhsUserAgentAudio)
        .set(body)
        .where(eq(zhsUserAgentAudio.id, Number(id)))
        .returning()
      if (!row) return reply.status(404).send(error(404, '记录不存在'))
      return reply.send(success(row))
    },
  )
  server.post('/admin/zhs-user', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createUserPlatformSchema, request.body)
    const [row] = await db.insert(zhsUserPlatform).values(body).returning()
    return reply.status(201).send(success(row))
  })
  server.put('/admin/zhs-user/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateUserPlatformSchema, request.body)
    const [row] = await db
      .update(zhsUserPlatform)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(zhsUserPlatform.id, Number(id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
}
