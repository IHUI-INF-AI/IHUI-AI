/**
 * /api/admin/ai-gc 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { aiGcContent } from '@ihui/database'
import { eq, ilike, desc, sql } from 'drizzle-orm'
import { paginationSchema, idParamSchema } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'

// 2026-08-01 P1 修复:POST/PUT 原直接用 request.body as Record<string, unknown>,
// Number(body.status ?? 1) 在 status="abc" 时变 NaN 写入 DB,且无字段长度约束。
// 补齐 Zod schema 保证数据完整性。
const aiGcCreateSchema = z.object({
  userUuid: z.string().min(1).max(100),
  agentId: z.string().max(100).nullable().optional(),
  gcType: z.string().max(50).default('text'),
  content: z.string().max(50000).nullable().optional(),
  status: z.coerce.number().int().min(0).max(3).default(1),
})

const aiGcUpdateSchema = z.object({
  gcType: z.string().max(50).optional(),
  content: z.string().max(50000).nullable().optional(),
  status: z.coerce.number().int().min(0).max(3).optional(),
})

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
    const body = aiGcCreateSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .insert(aiGcContent)
      .values({
        userUuid: body.data.userUuid,
        agentId: body.data.agentId ?? null,
        gcType: body.data.gcType,
        content: body.data.content ?? null,
        status: body.data.status,
      })
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/ai-gc/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = aiGcUpdateSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .update(aiGcContent)
      .set({
        ...(body.data.gcType !== undefined && { gcType: body.data.gcType }),
        ...(body.data.content !== undefined && { content: body.data.content }),
        ...(body.data.status !== undefined && { status: body.data.status }),
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
