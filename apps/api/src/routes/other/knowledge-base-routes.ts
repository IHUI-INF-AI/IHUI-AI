/**
 * 知识库(从 frontend-stub-other-routes.ts 拆分)。
 * GET /knowledge-base/categories, POST /knowledge-base,
 * GET /knowledge-base/:id, PUT /knowledge-base/:id
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, asc, sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db, dbRead } from '../../db/index.js'
import { knowledgeBase, knowledgeBaseCategories } from '@ihui/database'
import { parseIdParam } from './_shared.js'

export const knowledgeBaseRoutes: FastifyPluginAsync = async (server) => {
  // GET /knowledge-base/categories — 知识库分类列表(含每分类文章数)
  server.get('/knowledge-base/categories', async (_request, reply) => {
    const rows = await dbRead
      .select({
        id: knowledgeBaseCategories.id,
        name: knowledgeBaseCategories.name,
        count: sql<number>`(SELECT count(*) FROM knowledge_base kb WHERE kb.category_id = ${knowledgeBaseCategories.id})::int`,
      })
      .from(knowledgeBaseCategories)
      .orderBy(asc(knowledgeBaseCategories.sortOrder), asc(knowledgeBaseCategories.name))
    return reply.send(success({ list: rows }))
  })

  // POST /knowledge-base — 创建知识库条目
  server.post('/knowledge-base', async (request, reply) => {
    const body = z
      .object({
        title: z.string().min(1).max(200),
        summary: z.string().optional(),
        content: z.string().optional(),
        coverImage: z.string().max(500).optional(),
        categoryId: z.string().uuid().optional(),
        isPublished: z.boolean().default(false),
        status: z.number().int().default(1),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [item] = await db
      .insert(knowledgeBase)
      .values({
        title: body.data.title,
        summary: body.data.summary ?? null,
        content: body.data.content ?? null,
        coverImage: body.data.coverImage ?? null,
        categoryId: body.data.categoryId ?? null,
        authorId: request.userId,
        isPublished: body.data.isPublished,
        status: body.data.status,
      })
      .returning()
    return reply.status(201).send(success({ item }))
  })

  // GET /knowledge-base/:id — 知识库详情
  server.get('/knowledge-base/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [item] = await dbRead
      .select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.id, id))
      .limit(1)
    if (!item) return reply.status(404).send(error(404, '知识库不存在'))
    // 浏览量 +1
    await db
      .update(knowledgeBase)
      .set({ viewCount: sql`${knowledgeBase.viewCount} + 1` })
      .where(eq(knowledgeBase.id, id))
    return reply.send(success({ item }))
  })

  // PUT /knowledge-base/:id — 更新知识库
  server.put('/knowledge-base/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = z
      .object({
        title: z.string().min(1).max(200).optional(),
        summary: z.string().optional(),
        content: z.string().optional(),
        coverImage: z.string().max(500).optional(),
        categoryId: z.string().uuid().optional(),
        isPublished: z.boolean().optional(),
        status: z.number().int().optional(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await dbRead
      .select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '知识库不存在'))
    if (existing.authorId !== request.userId)
      return reply.status(403).send(error(403, '无权编辑此知识库'))
    const [updated] = await db
      .update(knowledgeBase)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(knowledgeBase.id, id))
      .returning()
    return reply.send(success({ item: updated }))
  })
}
