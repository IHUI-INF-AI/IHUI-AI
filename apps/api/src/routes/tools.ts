import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, ilike, desc, asc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tools, toolFavorites } from '@ihui/database'
import { requireAuth, requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  category: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  search: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
  sort: z.enum(['rating', 'favoriteCount', 'sortOrder', 'createdAt']).default('sortOrder'),
  order: z.enum(['asc', 'desc']).default('asc'),
})

const createToolSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(64),
  icon: z.string().max(512).optional(),
  url: z.string().max(512).optional(),
  rating: z.number().int().min(0).max(500).optional(),
  status: z.enum(['published', 'draft', 'offline']).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

const updateToolSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(64).optional(),
  icon: z.string().max(512).optional(),
  url: z.string().max(512).optional(),
  rating: z.number().int().min(0).max(500).optional(),
  status: z.enum(['published', 'draft', 'offline']).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

// =============================================================================
// 路由
// =============================================================================

const toolsRoutes: FastifyPluginAsync = async (server) => {
  // GET / — 工具列表（支持分类筛选/搜索/排序）
  server.get('/', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, category, search, sort, order } = parsed.data
    const conditions = [eq(tools.status, 'published')]
    if (category) conditions.push(eq(tools.category, category))
    if (search) conditions.push(ilike(tools.name, `%${search}%`))

    const sortColumn = tools[sort]
    const orderFn = order === 'desc' ? desc : asc
    const offset = (page - 1) * pageSize

    const list = await db
      .select()
      .from(tools)
      .where(and(...conditions))
      .orderBy(orderFn(sortColumn))
      .limit(pageSize)
      .offset(offset)

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tools)
      .where(and(...conditions))
    const total = countResult[0]?.count ?? 0

    return reply.send(success({ list, total, page, pageSize }))
  })

  // GET /:id — 工具详情
  server.get('/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [tool] = await db.select().from(tools).where(eq(tools.id, parsed.data.id)).limit(1)
    if (!tool) return reply.status(404).send(error(404, '工具不存在'))
    return reply.send(success({ tool }))
  })

  // POST / — 创建工具（admin）
  server.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createToolSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [tool] = await db.insert(tools).values(parsed.data).returning()
    return reply.status(201).send(success({ tool }))
  })

  // PATCH /:id — 更新工具（admin）
  server.patch('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateToolSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [tool] = await db
      .update(tools)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(tools.id, idParsed.data.id))
      .returning()
    if (!tool) return reply.status(404).send(error(404, '工具不存在'))
    return reply.send(success({ tool }))
  })

  // DELETE /:id — 删除工具（admin）
  server.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [tool] = await db.delete(tools).where(eq(tools.id, parsed.data.id)).returning()
    if (!tool) return reply.status(404).send(error(404, '工具不存在'))
    return reply.send(success({ ok: true }))
  })

  // POST /:id/favorite — 收藏工具（需登录）
  server.post('/:id/favorite', { preHandler: requireAuth }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    // 校验工具是否存在
    const [tool] = await db.select().from(tools).where(eq(tools.id, idParsed.data.id)).limit(1)
    if (!tool) return reply.status(404).send(error(404, '工具不存在'))
    // 幂等：已收藏则直接返回
    const [existing] = await db
      .select()
      .from(toolFavorites)
      .where(and(eq(toolFavorites.userId, userId), eq(toolFavorites.toolId, idParsed.data.id)))
      .limit(1)
    if (existing) return reply.send(success({ favorited: true }))
    await db.insert(toolFavorites).values({ userId, toolId: idParsed.data.id })
    // 收藏数 +1
    await db
      .update(tools)
      .set({ favoriteCount: sql`${tools.favoriteCount} + 1` })
      .where(eq(tools.id, idParsed.data.id))
    return reply.status(201).send(success({ favorited: true }))
  })

  // DELETE /:id/favorite — 取消收藏（需登录）
  server.delete('/:id/favorite', { preHandler: requireAuth }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const [deleted] = await db
      .delete(toolFavorites)
      .where(and(eq(toolFavorites.userId, userId), eq(toolFavorites.toolId, idParsed.data.id)))
      .returning()
    if (deleted) {
      // 收藏数 -1（不低于 0）
      await db
        .update(tools)
        .set({ favoriteCount: sql`GREATEST(${tools.favoriteCount} - 1, 0)` })
        .where(eq(tools.id, idParsed.data.id))
    }
    return reply.send(success({ favorited: false }))
  })
}

export default toolsRoutes
