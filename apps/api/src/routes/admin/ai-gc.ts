/**
 * /api/admin/ai-gc 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { aiGcContent } from '@ihui/database'
import { eq, ilike, desc, sql } from 'drizzle-orm'
import { paginationSchema, idParamSchema } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const aiGcRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
server.get('/ai-gc', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(aiGcContent.content, `%${search}%`) : undefined
    const list = await db
      .select()
      .from(aiGcContent)
      .where(where)
      .orderBy(desc(aiGcContent.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(aiGcContent)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.post('/ai-gc', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .insert(aiGcContent)
      .values({
        userUuid: String(body.userUuid ?? ''),
        agentId: body.agentId ? String(body.agentId) : null,
        gcType: String(body.gcType ?? 'text'),
        content: body.content ? String(body.content) : null,
        status: Number(body.status ?? 1),
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/ai-gc/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = request.body as Record<string, unknown>
    const [row] = await db
      .update(aiGcContent)
      .set({
        ...(body.gcType !== undefined && { gcType: String(body.gcType) }),
        ...(body.content !== undefined && { content: body.content ? String(body.content) : null }),
        ...(body.status !== undefined && { status: Number(body.status) }),
        updatedAt: new Date(),
      })
      .where(eq(aiGcContent.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/ai-gc/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(aiGcContent).where(eq(aiGcContent.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })
}

export default aiGcRoutes
