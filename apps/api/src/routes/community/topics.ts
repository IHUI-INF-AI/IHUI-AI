/**
 * community/topics 子路由(从 community.ts 拆分)。
 * 包含 sections: 话题/动态（历史 circle_dynamic，integer id）, 圈子分类关系（历史 circle_category_relation，integer id）, 圈子类目关系（历史 circle_circle_category_relation，integer id）
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../plugins/auth.js'
import { success, error } from '../../utils/response.js'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { circleCategoryRelation, circleCircleCategoryRelation, circleDynamic } from '@ihui/database'

const topicsRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有 circles / asks 路由均需登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  })

  // ===== Circles =====

  // GET /circles - 圈子列表(?page&pageSize&search)
  // ===== 话题/动态（历史 circle_dynamic，integer id） =====

  // GET /circles/topic/list - 话题列表
  server.get('/circles/topic/list', async (request, reply) => {
    const { page, pageSize, circleId, memberId, status } = z
      .object({
        page: z.coerce.number().optional().default(1),
        pageSize: z.coerce.number().optional().default(20),
        circleId: z.coerce.number().optional(),
        memberId: z.coerce.number().optional(),
        status: z.string().optional(),
      })
      .parse(request.query)
    const conditions: Array<ReturnType<typeof eq>> = []
    if (circleId) conditions.push(eq(circleDynamic.circleId, Number(circleId)))
    if (memberId) conditions.push(eq(circleDynamic.memberId, Number(memberId)))
    if (status) conditions.push(eq(circleDynamic.status, String(status)))
    const baseQuery =
      conditions.length > 0
        ? db
            .select()
            .from(circleDynamic)
            .where(and(...conditions))
        : db.select().from(circleDynamic)
    const list = await baseQuery
      .orderBy(desc(circleDynamic.id))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return reply.send(success({ list, page: Number(page), pageSize: Number(pageSize) }))
  })

  // GET /circles/topic/:tid - 话题详情
  server.get('/circles/topic/:tid', async (request, reply) => {
    const { tid } = z.object({ tid: z.string() }).parse(request.params)
    const tidNum = Number(tid)
    if (!Number.isInteger(tidNum) || tidNum <= 0) {
      return reply.status(400).send(error(400, '无效的话题 ID'))
    }
    const [item] = await db
      .select()
      .from(circleDynamic)
      .where(eq(circleDynamic.id, tidNum))
      .limit(1)
    if (!item) return reply.status(404).send(error(404, '话题不存在'))
    return reply.send(success({ topic: item }))
  })

  // POST /circles/topic - 创建话题
  server.post('/circles/topic', async (request, reply) => {
    const body = z
      .object({
        content: z.string().min(1),
        circleId: z.number().int().positive(),
        memberId: z.number().int().positive(),
        image: z.string().max(3000).optional().default(''),
        status: z.string().max(100).optional().default('published'),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [created] = await db
      .insert(circleDynamic)
      .values({
        content: body.data.content,
        circleId: body.data.circleId,
        memberId: body.data.memberId,
        image: body.data.image,
        status: body.data.status,
      })
      .returning()
    if (!created) return reply.status(500).send(error(500, '创建话题失败'))
    return reply.status(201).send(success({ topic: created }))
  })

  // PUT /circles/topic/:tid - 修改话题
  server.put('/circles/topic/:tid', async (request, reply) => {
    const { tid } = z.object({ tid: z.string() }).parse(request.params)
    const tidNum = Number(tid)
    if (!Number.isInteger(tidNum) || tidNum <= 0) {
      return reply.status(400).send(error(400, '无效的话题 ID'))
    }
    const body = z
      .object({
        content: z.string().min(1).optional(),
        image: z.string().max(3000).optional(),
        status: z.string().max(100).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (body.data.content !== undefined) updateData.content = body.data.content
    if (body.data.image !== undefined) updateData.image = body.data.image
    if (body.data.status !== undefined) updateData.status = body.data.status
    const [updated] = await db
      .update(circleDynamic)
      .set(updateData)
      .where(eq(circleDynamic.id, tidNum))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '话题不存在'))
    return reply.send(success({ topic: updated }))
  })

  // DELETE /circles/topic/:tid - 删除话题
  server.delete('/circles/topic/:tid', async (request, reply) => {
    const { tid } = z.object({ tid: z.string() }).parse(request.params)
    const tidNum = Number(tid)
    if (!Number.isInteger(tidNum) || tidNum <= 0) {
      return reply.status(400).send(error(400, '无效的话题 ID'))
    }
    const [deleted] = await db.delete(circleDynamic).where(eq(circleDynamic.id, tidNum)).returning()
    if (!deleted) return reply.status(404).send(error(404, '话题不存在'))
    return reply.send(success({ id: tidNum, deleted: true }))
  })

  // ===== 圈子分类关系（历史 circle_category_relation，integer id） =====

  // GET /circles/category-relation/list - 分类关系列表
  server.get('/circles/category-relation/list', async (request, reply) => {
    const { fatherCategoryId, childCategoryId } = z
      .object({
        fatherCategoryId: z.coerce.number().optional(),
        childCategoryId: z.coerce.number().optional(),
      })
      .parse(request.query)
    const conditions: Array<ReturnType<typeof eq>> = []
    if (fatherCategoryId)
      conditions.push(eq(circleCategoryRelation.fatherCategoryId, Number(fatherCategoryId)))
    if (childCategoryId)
      conditions.push(eq(circleCategoryRelation.childCategoryId, Number(childCategoryId)))
    const list =
      conditions.length > 0
        ? await db
            .select()
            .from(circleCategoryRelation)
            .where(and(...conditions))
        : await db.select().from(circleCategoryRelation)
    return reply.send(success({ list, total: list.length }))
  })

  // POST /circles/category-relation - 创建分类关系
  server.post('/circles/category-relation', async (request, reply) => {
    const body = z
      .object({
        childCategoryId: z.number().int().positive(),
        fatherCategoryId: z.number().int().positive(),
        directFatherCategoryId: z.number().int().positive(),
        isSub: z.boolean().default(false),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [created] = await db
      .insert(circleCategoryRelation)
      .values({
        childCategoryId: body.data.childCategoryId,
        fatherCategoryId: body.data.fatherCategoryId,
        directFatherCategoryId: body.data.directFatherCategoryId,
        isSub: body.data.isSub,
      })
      .returning()
    if (!created) return reply.status(500).send(error(500, '创建分类关系失败'))
    return reply.status(201).send(success({ relation: created }))
  })

  // DELETE /circles/category-relation/:rid - 删除分类关系
  server.delete('/circles/category-relation/:rid', async (request, reply) => {
    const { rid } = z.object({ rid: z.string() }).parse(request.params)
    const ridNum = Number(rid)
    if (!Number.isInteger(ridNum) || ridNum <= 0) {
      return reply.status(400).send(error(400, '无效的关系 ID'))
    }
    const [deleted] = await db
      .delete(circleCategoryRelation)
      .where(eq(circleCategoryRelation.id, ridNum))
      .returning()
    if (!deleted) return reply.status(404).send(error(404, '分类关系不存在'))
    return reply.send(success({ id: ridNum, deleted: true }))
  })

  // ===== 圈子类目关系（历史 circle_circle_category_relation，integer id） =====

  // GET /circles/circle-category-relation/list - 类目关系列表
  server.get('/circles/circle-category-relation/list', async (request, reply) => {
    const { categoryId, circleId } = z
      .object({
        categoryId: z.coerce.number().optional(),
        circleId: z.coerce.number().optional(),
      })
      .parse(request.query)
    const conditions: Array<ReturnType<typeof eq>> = []
    if (categoryId) conditions.push(eq(circleCircleCategoryRelation.categoryId, Number(categoryId)))
    if (circleId) conditions.push(eq(circleCircleCategoryRelation.circleId, Number(circleId)))
    const list =
      conditions.length > 0
        ? await db
            .select()
            .from(circleCircleCategoryRelation)
            .where(and(...conditions))
        : await db.select().from(circleCircleCategoryRelation)
    return reply.send(success({ list, total: list.length }))
  })

  // POST /circles/circle-category-relation - 创建类目关系
  server.post('/circles/circle-category-relation', async (request, reply) => {
    const body = z
      .object({
        categoryId: z.number().int().positive(),
        circleId: z.number().int().positive(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [created] = await db
      .insert(circleCircleCategoryRelation)
      .values({
        categoryId: body.data.categoryId,
        circleId: body.data.circleId,
      })
      .returning()
    if (!created) return reply.status(500).send(error(500, '创建类目关系失败'))
    return reply.status(201).send(success({ relation: created }))
  })

  // DELETE /circles/circle-category-relation/:rid - 删除类目关系
  server.delete('/circles/circle-category-relation/:rid', async (request, reply) => {
    const { rid } = z.object({ rid: z.string() }).parse(request.params)
    const ridNum = Number(rid)
    if (!Number.isInteger(ridNum) || ridNum <= 0) {
      return reply.status(400).send(error(400, '无效的关系 ID'))
    }
    const [deleted] = await db
      .delete(circleCircleCategoryRelation)
      .where(eq(circleCircleCategoryRelation.id, ridNum))
      .returning()
    if (!deleted) return reply.status(404).send(error(404, '类目关系不存在'))
    return reply.send(success({ id: ridNum, deleted: true }))
  })

}
export default topicsRoutes
