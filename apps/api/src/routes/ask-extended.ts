import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  asks,
  askAnswers,
  askCategories,
  askLikes,
  askFavorites,
  askComments,
} from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

const uuidParamSchema = z.object({ id: z.string().uuid() })
const answerParamSchema = z.object({ id: z.string().uuid() })

const categoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  pid: z.string().uuid().optional(),
  sortOrder: z.number().int().default(0),
  isShow: z.boolean().default(true),
  isShowIndex: z.boolean().default(false),
  image: z.string().max(500).optional(),
  level: z.number().int().min(1).default(1),
})

const categoryUpdateSchema = categoryCreateSchema.partial()

const commentCreateSchema = z.object({
  content: z.string().min(1).max(10000),
  pid: z.string().uuid().optional(),
})

/**
 * Ask 模块扩展端点（M-64 补建）：
 * 回答编辑/删除 + 点赞 + 收藏 + 评论 + 分类管理 CRUD + 树 + 统计
 */
export const askExtendedRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // PATCH /asks/answers/:id - 编辑回答（仅本人）
  // -------------------------------------------------------------------------
  server.patch('/asks/answers/:id', async (request, reply) => {
    await authenticate(request)
    const parsed = answerParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的回答 ID'))
    }
    const body = z.object({ content: z.string().min(1).max(10000) }).safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const rows = await db
        .update(askAnswers)
        .set({ content: body.data.content })
        .where(and(eq(askAnswers.id, parsed.data.id), eq(askAnswers.userId, request.userId!)))
        .returning({ id: askAnswers.id })
      if (rows.length === 0) {
        return reply.status(404).send(error(404, '回答不存在或无权编辑'))
      }
      return reply.send(success({ id: rows[0]!.id, updated: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '编辑回答失败'))
    }
  })

  // -------------------------------------------------------------------------
  // DELETE /asks/answers/:id - 删除回答（仅本人，软删除 status=-1）
  // -------------------------------------------------------------------------
  server.delete('/asks/answers/:id', async (request, reply) => {
    await authenticate(request)
    const parsed = answerParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的回答 ID'))
    }
    try {
      const rows = await db
        .update(askAnswers)
        .set({ status: -1 })
        .where(and(eq(askAnswers.id, parsed.data.id), eq(askAnswers.userId, request.userId!)))
        .returning({ id: askAnswers.id })
      if (rows.length === 0) {
        return reply.status(404).send(error(404, '回答不存在或无权删除'))
      }
      return reply.send(success({ id: rows[0]!.id, deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除回答失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /asks/:id/like - 点赞问题（toggle）
  // -------------------------------------------------------------------------
  server.post('/asks/:id/like', async (request, reply) => {
    await authenticate(request)
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的问题 ID'))
    }
    const { id } = parsed.data
    try {
      const existing = await db
        .select()
        .from(askLikes)
        .where(
          and(
            eq(askLikes.userId, request.userId!),
            eq(askLikes.targetType, 'question'),
            eq(askLikes.targetId, id),
          ),
        )
        .limit(1)
      if (existing.length > 0) {
        const existingRow = existing[0]!
        const newLike = !existingRow.isLike
        await db.update(askLikes).set({ isLike: newLike }).where(eq(askLikes.id, existingRow.id))
        if (newLike) {
          await db
            .update(asks)
            .set({ likeCount: sql`${asks.likeCount} + 1` })
            .where(eq(asks.id, id))
        } else {
          await db
            .update(asks)
            .set({ likeCount: sql`GREATEST(${asks.likeCount} - 1, 0)` })
            .where(eq(asks.id, id))
        }
        return reply.send(success({ id, liked: newLike }))
      }
      await db.insert(askLikes).values({
        userId: request.userId!,
        targetType: 'question',
        targetId: id,
        isLike: true,
      })
      await db
        .update(asks)
        .set({ likeCount: sql`${asks.likeCount} + 1` })
        .where(eq(asks.id, id))
      return reply.send(success({ id, liked: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '点赞失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /asks/:id/favorite - 收藏问题（toggle）
  // -------------------------------------------------------------------------
  server.post('/asks/:id/favorite', async (request, reply) => {
    await authenticate(request)
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的问题 ID'))
    }
    const { id } = parsed.data
    try {
      const existing = await db
        .select()
        .from(askFavorites)
        .where(
          and(
            eq(askFavorites.userId, request.userId!),
            eq(askFavorites.targetType, 'question'),
            eq(askFavorites.targetId, id),
          ),
        )
        .limit(1)
      if (existing.length > 0) {
        const existingRow = existing[0]!
        await db.delete(askFavorites).where(eq(askFavorites.id, existingRow.id))
        return reply.send(success({ id, favorited: false }))
      }
      await db.insert(askFavorites).values({
        userId: request.userId!,
        targetType: 'question',
        targetId: id,
      })
      return reply.send(success({ id, favorited: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '收藏失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /asks/:id/comments - 问题评论列表
  // -------------------------------------------------------------------------
  server.get('/asks/:id/comments', async (request, reply) => {
    await authenticate(request)
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的问题 ID'))
    }
    try {
      const rows = await db
        .select({
          id: askComments.id,
          content: askComments.content,
          userId: askComments.userId,
          pid: askComments.pid,
          likeCount: askComments.likeCount,
          status: askComments.status,
          createdAt: askComments.createdAt,
        })
        .from(askComments)
        .where(
          and(
            eq(askComments.targetType, 'question'),
            eq(askComments.targetId, parsed.data.id),
            eq(askComments.status, 1),
          ),
        )
        .orderBy(desc(askComments.createdAt))
        .limit(200)
      return reply.send(success({ list: rows, total: rows.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询评论失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /asks/:id/comments - 发布问题评论
  // -------------------------------------------------------------------------
  server.post('/asks/:id/comments', async (request, reply) => {
    await authenticate(request)
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的问题 ID'))
    }
    const body = commentCreateSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const [inserted] = await db
        .insert(askComments)
        .values({
          targetType: 'question',
          targetId: parsed.data.id,
          userId: request.userId!,
          content: body.data.content,
          pid: body.data.pid ?? null,
        })
        .returning({ id: askComments.id })
      if (!inserted) {
        return reply.status(500).send(error(500, '发布评论失败'))
      }
      return reply.send(success({ id: inserted.id, created: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '发布评论失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /asks/categories - 分类列表
  // -------------------------------------------------------------------------
  server.get('/asks/categories', async (request, reply) => {
    await authenticate(request)
    const query = z
      .object({ isShow: z.enum(['true', 'false']).optional() })
      .safeParse(request.query)
    const isShow = query.success ? query.data.isShow : undefined
    try {
      const conds = []
      if (isShow === 'true') conds.push(eq(askCategories.isShow, true))
      if (isShow === 'false') conds.push(eq(askCategories.isShow, false))
      const rows = await db
        .select()
        .from(askCategories)
        .where(conds.length > 0 ? and(...conds) : undefined)
        .orderBy(desc(askCategories.sortOrder))
      return reply.send(success({ list: rows, total: rows.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询分类失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /asks/categories/tree - 分类树
  // -------------------------------------------------------------------------
  server.get('/asks/categories/tree', async (_request, reply) => {
    try {
      const rows = await db.select().from(askCategories).orderBy(desc(askCategories.sortOrder))
      type CategoryNode = (typeof rows)[number] & { children: CategoryNode[] }
      const map = new Map<string, CategoryNode>()
      const roots: CategoryNode[] = []
      for (const row of rows) {
        map.set(row.id, { ...row, children: [] })
      }
      for (const row of rows) {
        const node = map.get(row.id)!
        if (row.pid && map.has(row.pid)) {
          map.get(row.pid)!.children.push(node)
        } else {
          roots.push(node)
        }
      }
      return reply.send(success({ tree: roots }))
    } catch (e) {
      server.log.error(e)
      return reply.status(500).send(error(500, '查询分类树失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /asks/categories - 创建分类
  // -------------------------------------------------------------------------
  server.post('/asks/categories', async (request, reply) => {
    await authenticate(request)
    const body = categoryCreateSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const [inserted] = await db
        .insert(askCategories)
        .values({
          name: body.data.name,
          pid: body.data.pid ?? null,
          sortOrder: body.data.sortOrder,
          isShow: body.data.isShow,
          isShowIndex: body.data.isShowIndex,
          image: body.data.image ?? null,
          level: body.data.level,
        })
        .returning({ id: askCategories.id })
      if (!inserted) {
        return reply.status(500).send(error(500, '创建分类失败'))
      }
      return reply.send(success({ id: inserted.id, created: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建分类失败'))
    }
  })

  // -------------------------------------------------------------------------
  // PUT /asks/categories/:id - 更新分类
  // -------------------------------------------------------------------------
  server.put('/asks/categories/:id', async (request, reply) => {
    await authenticate(request)
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的分类 ID'))
    }
    const body = categoryUpdateSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const rows = await db
        .update(askCategories)
        .set({
          ...(body.data.name !== undefined && { name: body.data.name }),
          ...(body.data.pid !== undefined && { pid: body.data.pid ?? null }),
          ...(body.data.sortOrder !== undefined && { sortOrder: body.data.sortOrder }),
          ...(body.data.isShow !== undefined && { isShow: body.data.isShow }),
          ...(body.data.isShowIndex !== undefined && { isShowIndex: body.data.isShowIndex }),
          ...(body.data.image !== undefined && { image: body.data.image ?? null }),
          ...(body.data.level !== undefined && { level: body.data.level }),
        })
        .where(eq(askCategories.id, parsed.data.id))
        .returning({ id: askCategories.id })
      if (rows.length === 0) {
        return reply.status(404).send(error(404, '分类不存在'))
      }
      return reply.send(success({ id: rows[0]!.id, updated: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新分类失败'))
    }
  })

  // -------------------------------------------------------------------------
  // DELETE /asks/categories/:id - 删除分类
  // -------------------------------------------------------------------------
  server.delete('/asks/categories/:id', async (request, reply) => {
    await authenticate(request)
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的分类 ID'))
    }
    try {
      const rows = await db
        .delete(askCategories)
        .where(eq(askCategories.id, parsed.data.id))
        .returning({ id: askCategories.id })
      if (rows.length === 0) {
        return reply.status(404).send(error(404, '分类不存在'))
      }
      return reply.send(success({ id: rows[0]!.id, deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除分类失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /asks/stats - 会员问答统计
  // -------------------------------------------------------------------------
  server.get('/asks/stats', async (request, reply) => {
    await authenticate(request)
    try {
      const questionRows = await db
        .select({ id: asks.id })
        .from(asks)
        .where(eq(asks.userId, request.userId!))
      const answerRows = await db
        .select({ id: askAnswers.id })
        .from(askAnswers)
        .where(eq(askAnswers.userId, request.userId!))
      const acceptedRows = await db
        .select({ id: askAnswers.id })
        .from(askAnswers)
        .where(and(eq(askAnswers.userId, request.userId!), eq(askAnswers.isAccepted, true)))
      const favoriteRows = await db
        .select({ id: askFavorites.id })
        .from(askFavorites)
        .where(eq(askFavorites.userId, request.userId!))
      return reply.send(
        success({
          questionCount: questionRows.length,
          answerCount: answerRows.length,
          acceptedCount: acceptedRows.length,
          favoriteCount: favoriteRows.length,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询统计失败'))
    }
  })
}
