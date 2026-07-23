/**
 * AI 世界条目(从 frontend-stub-other-routes.ts 拆分)。
 * POST /ai-world/create — 创建 AI 世界条目
 * PUT /ai-world/:id — 更新 AI 世界条目
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db, dbRead } from '../../db/index.js'
import { aiWorldItems } from '@ihui/database'
import { parseIdParam } from './_shared.js'

export const aiWorldRoutes: FastifyPluginAsync = async (server) => {
  // POST /ai-world/create — 创建 AI 世界条目
  server.post('/ai-world/create', async (request, reply) => {
    const body = z
      .object({
        title: z.string().min(1).max(200),
        content: z.string().optional(),
        coverImage: z.string().max(500).optional(),
        categoryId: z.string().uuid().optional(),
        status: z.number().int().default(1),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [item] = await db
      .insert(aiWorldItems)
      .values({
        kind: 'news',
        title: body.data.title,
        content: body.data.content ?? null,
        coverImage: body.data.coverImage ?? null,
        categoryId: body.data.categoryId ?? null,
        authorId: request.userId,
        source: 'user',
        sourceUrl: null,
        status: body.data.status,
      })
      .returning()
    return reply.status(201).send(success({ item }))
  })

  // PUT /ai-world/:id — 更新 AI 世界条目
  server.put('/ai-world/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = z
      .object({
        title: z.string().min(1).max(200).optional(),
        content: z.string().optional(),
        coverImage: z.string().max(500).optional(),
        categoryId: z.string().uuid().optional(),
        status: z.number().int().optional(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await dbRead
      .select()
      .from(aiWorldItems)
      .where(eq(aiWorldItems.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '条目不存在'))
    const [updated] = await db
      .update(aiWorldItems)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(aiWorldItems.id, id))
      .returning()
    return reply.send(success({ item: updated }))
  })
}
