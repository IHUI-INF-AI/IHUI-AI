/**
 * /api/admin/zhs-agent 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { zhsAgentCategory } from '@ihui/database'
import { eq, ilike, desc, sql } from 'drizzle-orm'
import { paginationSchema, idParamSchema } from './_shared.js'
import { z } from 'zod'

import { requireAdmin } from '../../plugins/require-permission.js'

const createSchema = z.object({
  agentId: z.string().optional(),
  group: z.number().int().optional(),
  type: z.string().optional(),
  typeChild: z.string().optional(),
  limitFree: z.string().optional(),
  account: z.number().int().optional(),
})

const updateSchema = createSchema.partial()

const zhsAgentRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/zhs-agent', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(zhsAgentCategory.agentId, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(zhsAgentCategory)
      .where(where)
      .orderBy(desc(zhsAgentCategory.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(zhsAgentCategory)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.delete('/zhs-agent/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsAgentCategory).where(eq(zhsAgentCategory.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  server.post('/zhs-agent', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .insert(zhsAgentCategory)
      .values({
        agentId: parsed.data.agentId ?? null,
        group: parsed.data.group ?? 2,
        type: parsed.data.type ?? '1',
        typeChild: parsed.data.typeChild ?? '1',
        limitFree: parsed.data.limitFree ?? null,
        account: parsed.data.account ?? 0,
        createTime: new Date(),
      })
      .returning()
    return reply.status(201).send(success(row))
  })

  server.put('/zhs-agent/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const set: Record<string, unknown> = {}
    if (parsed.data.agentId !== undefined) set.agentId = parsed.data.agentId
    if (parsed.data.group !== undefined) set.group = parsed.data.group
    if (parsed.data.type !== undefined) set.type = parsed.data.type
    if (parsed.data.typeChild !== undefined) set.typeChild = parsed.data.typeChild
    if (parsed.data.limitFree !== undefined) set.limitFree = parsed.data.limitFree
    if (parsed.data.account !== undefined) set.account = parsed.data.account
    set.updatedAt = new Date()
    const [row] = await db
      .update(zhsAgentCategory)
      .set(set)
      .where(eq(zhsAgentCategory.id, Number(p.data.id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
}

export default zhsAgentRoutes
