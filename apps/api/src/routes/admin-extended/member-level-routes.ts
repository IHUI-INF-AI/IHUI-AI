/**
 * 会员等级管理路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/member-levels
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { eduMemberLevels } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
import { idParamSchema } from './_shared.js'

const createMemberLevelSchema = z.object({
  name: z.string().min(1).max(100),
  growthValue: z.number().int().optional(),
  discount: z.string().optional(),
  sort: z.number().int().optional(),
})
const updateMemberLevelSchema = createMemberLevelSchema.partial()

export const memberLevelRoutes: FastifyPluginAsync = async (server) => {
  server.post('/admin/member-levels', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createMemberLevelSchema, request.body)
    const [row] = await db.insert(eduMemberLevels).values(body).returning()
    return reply.status(201).send(success(row))
  })
  server.put('/admin/member-levels/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateMemberLevelSchema, request.body)
    const [row] = await db
      .update(eduMemberLevels)
      .set(body)
      .where(eq(eduMemberLevels.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete(
    '/admin/member-levels/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      await db.delete(eduMemberLevels).where(eq(eduMemberLevels.id, id))
      return reply.send(success({ id, deleted: true }))
    },
  )
}
