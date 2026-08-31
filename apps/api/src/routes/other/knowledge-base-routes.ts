// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 知识库(从 frontend-stub-other-routes.ts 拆分)。
 * GET /knowledge-base/categories, POST /knowledge-base,
 * GET /knowledge-base/:id, PUT /knowledge-base/:id
 */
import type { FastifyPluginAsync } from 'fastify'
import type { SQL } from 'drizzle-orm'
import { z } from 'zod'
import { eq, asc, desc, sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db, dbRead } from '../../db/index.js'
import { knowledgeBase, knowledgeBaseCategories, users } from '@ihui/database'
import { parseIdParam } from './_shared.js'

export const knowledgeBaseRoutes: FastifyPluginAsync = async (server) => {
  // GET /knowledge-base — 知识库列表(分页 + 分类/标题搜索, 前端 knowledge-base 页)
  server.get('/knowledge-base', async (request, reply) => {
    const {
      page = 1,
      pageSize = 10,
      categoryId,
      search,
    } = request.query as {
      page?: string | number
      pageSize?: string | number
      categoryId?: string
      search?: string
    }
    const p = Math.max(1, Number(page) || 1)
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 10))
    const conds: SQL[] = []
    if (categoryId && categoryId !== 'all') conds.push(eq(knowledgeBase.categoryId, categoryId))
    if (search) conds.push(sql`(title ILIKE ${`%${search}%`} OR summary ILIKE ${`%${search}%`})`)
    const cond = conds.length
      ? sql`${conds[0]}${conds.slice(1).map((c) => sql` AND ${c}`)}`
      : undefined
    const [totalRow] = await dbRead
      .select({ cnt: sql<number>`count(*)::int` })
      .from(knowledgeBase)
      .where(cond)
    const total = totalRow?.cnt ?? 0

    const list = await dbRead
      .select({
        id: knowledgeBase.id,
        title: knowledgeBase.title,
        summary: knowledgeBase.summary,
        viewCount: knowledgeBase.viewCount,
        updatedAt: knowledgeBase.updatedAt,
        categoryId: knowledgeBase.categoryId,
        categoryName: knowledgeBaseCategories.name,
        authorName: users.nickname,
      })
      .from(knowledgeBase)
      .leftJoin(knowledgeBaseCategories, eq(knowledgeBase.categoryId, knowledgeBaseCategories.id))
      .leftJoin(users, eq(knowledgeBase.authorId, users.id))
      .where(cond)
      .orderBy(desc(knowledgeBase.updatedAt))
      .limit(ps)
      .offset((p - 1) * ps)
    return reply.send(success({ list, total }))
  })

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
        categoryId: z.uuid().optional(),
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
        categoryId: z.uuid().optional(),
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
