/**
 * /api/admin/task-developer 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { zhsAgentDeveloper } from '@ihui/database'
import { eq, ilike, desc, sql, or } from 'drizzle-orm'
import { paginationSchema, idParamSchema } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'

const createTaskDeveloperSchema = z.object({
  agentId: z.string().max(100).default(''),
  userId: z.string().max(100).default(''),
  status: z.coerce.number().int().min(0).default(1),
  price: z.coerce.number().nullable().optional(),
  type: z.string().max(50).nullable().optional(),
})

const updateTaskDeveloperSchema = z.object({
  status: z.coerce.number().int().min(0).optional(),
  price: z.coerce.number().nullable().optional(),
})

const taskDeveloperRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  server.get('/task-developer', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search
      ? or(
          ilike(zhsAgentDeveloper.agentId, `%${search}%`),
          ilike(zhsAgentDeveloper.userId, `%${search}%`),
        )
      : undefined
    const list = await db
      .select()
      .from(zhsAgentDeveloper)
      .where(where)
      .orderBy(desc(zhsAgentDeveloper.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(zhsAgentDeveloper)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/task-developer', async (request, reply) => {
    const parsed = createTaskDeveloperSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数校验失败'))
    }
    const [row] = await db
      .insert(zhsAgentDeveloper)
      .values({
        agentId: parsed.data.agentId,
        userId: parsed.data.userId,
        status: parsed.data.status,
        price: parsed.data.price ?? null,
        type: parsed.data.type ?? null,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/task-developer/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const parsed = updateTaskDeveloperSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数校验失败'))
    }
    const [row] = await db
      .update(zhsAgentDeveloper)
      .set({
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.price !== undefined && { price: parsed.data.price ?? null }),
        updatedAt: new Date(),
      })
      .where(eq(zhsAgentDeveloper.id, Number(p.data.id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/task-developer/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsAgentDeveloper).where(eq(zhsAgentDeveloper.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default taskDeveloperRoutes
