import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import {
  recordWatch,
  getWatchCount,
  findWatchList,
  deleteWatch,
  clearAllWatch,
  getBehaviorStatistics,
  findAllWatchList,
} from '../db/behavior-queries.js'
import { findLikeCounts } from '../db/resource-likes-queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { sql, eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { behaviorFavorite } from '@ihui/database'

// =============================================================================
// Zod schemas
// =============================================================================

const recordWatchSchema = z.object({
  topicId: z.string().min(1).max(128),
  topicType: z.string().min(1).max(50),
  topicTitle: z.string().max(200).optional(),
  watchDuration: z.number().int().min(0).default(0),
  lastPosition: z.number().int().min(0).default(0),
})

const watchCountQuery = z.object({
  topicId: z.string().min(1).max(128),
  topicType: z.string().min(1).max(50),
})

const myWatchListQuery = z.object({
  topicType: z.preprocess(emptyToUndefined, z.string().min(1).max(50).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const deleteWatchQuery = z.object({
  id: z.string().uuid('无效的 ID'),
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
})

const clearWatchQuery = z.object({
  userId: z.string().uuid('无效的用户 ID'),
})

const likeCountsSchema = z.object({
  resourceType: z.string().min(1).max(50),
  resourceIds: z.array(z.string().min(1)).min(1).max(100),
})

const adminWatchListQuery = z.object({
  topicType: z.preprocess(emptyToUndefined, z.string().min(1).max(50).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const likeBodySchema = z.object({
  topicId: z.string().min(1).max(128),
  topicType: z.string().min(1).max(50),
})

const likeQuerySchema = z.object({
  topicId: z.string().min(1).max(128),
  topicType: z.string().min(1).max(50),
})

const likeListQuerySchema = z.object({
  topicType: z.preprocess(emptyToUndefined, z.string().min(1).max(50).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const favoriteBodySchema = z.object({
  topicId: z.string().min(1).max(128),
  topicType: z.string().min(1).max(50),
  topicTitle: z.string().max(200).optional(),
})

const favoriteQuerySchema = z.object({
  topicId: z.string().min(1).max(128),
  topicType: z.string().min(1).max(50),
})

const favoriteListQuerySchema = z.object({
  topicType: z.preprocess(emptyToUndefined, z.string().min(1).max(50).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const dataObjSchema = {
  type: 'object',
  properties: {
    code: { type: 'number' },
    message: { type: 'string' },
    data: { type: 'object', additionalProperties: true },
  },
} as const

// =============================================================================
// 公共路由（前缀 /api，需登录，记录+查询浏览）
// =============================================================================

export const behaviorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // POST /behavior/likes/counts - 批量查询资源点赞数
  // 替代旧架构 getLikeCountList,返回 [{resourceId, count}] 数组
  server.post('/behavior/likes/counts', async (request, reply) => {
    const parsed = likeCountsSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const counts = await findLikeCounts(parsed.data.resourceType, parsed.data.resourceIds)
    const list = parsed.data.resourceIds.map((id) => ({
      resourceId: id,
      count: counts.get(id) ?? 0,
    }))
    return reply.send(success({ list }))
  })

  // POST /behavior/watch - 记录浏览
  server.post(
    '/behavior/watch',
    {
      schema: {
        summary: '记录浏览',
        tags: ['behavior'],
        body: {
          type: 'object',
          properties: {
            topicId: { type: 'string', description: '目标 ID' },
            topicType: { type: 'string', description: '目标类型: lesson/news/article/resource' },
            topicTitle: { type: 'string', description: '目标标题' },
            watchDuration: { type: 'integer', minimum: 0, description: '观看时长(秒)' },
            lastPosition: { type: 'integer', minimum: 0, description: '上次位置' },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = recordWatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await recordWatch({ ...parsed.data, userId: request.userId! })
      return reply.send(success(result))
    },
  )

  // GET /behavior/watch/count - 浏览计数
  server.get(
    '/behavior/watch/count',
    {
      schema: {
        summary: '浏览计数',
        tags: ['behavior'],
        querystring: {
          type: 'object',
          properties: {
            topicId: { type: 'string', description: '目标 ID' },
            topicType: { type: 'string', description: '目标类型' },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = watchCountQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const count = await getWatchCount(parsed.data.topicId, parsed.data.topicType)
      return reply.send(
        success({ topicId: parsed.data.topicId, topicType: parsed.data.topicType, count }),
      )
    },
  )

  // GET /behavior/watch/list - 我的浏览记录列表
  server.get(
    '/behavior/watch/list',
    {
      schema: {
        summary: '我的浏览记录列表',
        tags: ['behavior'],
        querystring: {
          type: 'object',
          properties: {
            topicType: { type: 'string', description: '目标类型筛选' },
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = myWatchListQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findWatchList({ ...parsed.data, userId: request.userId! })
      return reply.send(success(result))
    },
  )

  // DELETE /behavior/watch - 删除浏览记录
  server.delete(
    '/behavior/watch',
    {
      schema: {
        summary: '删除浏览记录',
        tags: ['behavior'],
        querystring: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: '浏览记录 ID' },
            userId: { type: 'string', format: 'uuid', description: '会员 ID(传入则校验归属)' },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = deleteWatchQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const deleted = await deleteWatch(parsed.data.id, parsed.data.userId)
      if (!deleted) return reply.status(404).send(error(404, '浏览记录不存在'))
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    },
  )

  // DELETE /behavior/watch/all - 清空浏览记录
  server.delete(
    '/behavior/watch/all',
    {
      schema: {
        summary: '清空浏览记录',
        tags: ['behavior'],
        querystring: {
          type: 'object',
          properties: { userId: { type: 'string', format: 'uuid', description: '会员 ID' } },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = clearWatchQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const deleted = await clearAllWatch(parsed.data.userId)
      return reply.send(success({ deleted }))
    },
  )

  // ===========================================================================
  // 通用点赞（t_like 表，raw SQL）
  // ===========================================================================

  // POST /behavior/like - 通用点赞
  server.post(
    '/behavior/like',
    {
      schema: {
        summary: '通用点赞',
        tags: ['behavior'],
        body: {
          type: 'object',
          properties: {
            topicId: { type: 'string', description: '目标 ID' },
            topicType: { type: 'string', description: '目标类型: lesson/article/exam/resource 等' },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          500: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = likeBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { topicId, topicType } = parsed.data
      const userId = request.userId!
      try {
        const existing = await db.execute(sql`
        SELECT id FROM t_like
        WHERE user_id = ${userId} AND topic_id = ${topicId} AND topic_type = ${topicType}
        LIMIT 1
      `)
        if (existing.length > 0) {
          return reply.send(success({ topicId, topicType, liked: true, alreadyLiked: true }))
        }
        await db.execute(sql`
        INSERT INTO t_like (user_id, topic_id, topic_type)
        VALUES (${userId}, ${topicId}, ${topicType})
      `)
        return reply.send(success({ topicId, topicType, liked: true }))
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '点赞失败'))
      }
    },
  )

  // DELETE /behavior/like - 取消点赞
  server.delete(
    '/behavior/like',
    {
      schema: {
        summary: '取消点赞',
        tags: ['behavior'],
        querystring: {
          type: 'object',
          properties: {
            topicId: { type: 'string', description: '目标 ID' },
            topicType: { type: 'string', description: '目标类型' },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          500: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = likeQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { topicId, topicType } = parsed.data
      const userId = request.userId!
      try {
        await db.execute(sql`
        DELETE FROM t_like
        WHERE user_id = ${userId} AND topic_id = ${topicId} AND topic_type = ${topicType}
      `)
        return reply.send(success({ topicId, topicType, liked: false }))
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '取消点赞失败'))
      }
    },
  )

  // GET /behavior/like/check - 检查是否已点赞
  server.get(
    '/behavior/like/check',
    {
      schema: {
        summary: '检查是否已点赞',
        tags: ['behavior'],
        querystring: {
          type: 'object',
          properties: {
            topicId: { type: 'string', description: '目标 ID' },
            topicType: { type: 'string', description: '目标类型' },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          500: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = likeQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { topicId, topicType } = parsed.data
      const userId = request.userId!
      try {
        const rows = await db.execute(sql`
        SELECT id FROM t_like
        WHERE user_id = ${userId} AND topic_id = ${topicId} AND topic_type = ${topicType}
        LIMIT 1
      `)
        const liked = rows.length > 0
        return reply.send(success({ topicId, topicType, liked }))
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '检查点赞状态失败'))
      }
    },
  )

  // GET /behavior/like/list - 用户点赞列表
  server.get(
    '/behavior/like/list',
    {
      schema: {
        summary: '用户点赞列表',
        tags: ['behavior'],
        querystring: {
          type: 'object',
          properties: {
            topicType: { type: 'string', description: '目标类型筛选' },
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          500: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = likeListQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { topicType, page, pageSize } = parsed.data
      const userId = request.userId!
      const offset = (page - 1) * pageSize
      try {
        const whereClause = topicType
          ? sql`WHERE user_id = ${userId} AND topic_type = ${topicType}`
          : sql`WHERE user_id = ${userId}`
        const listRows = await db.execute(sql`
        SELECT id, topic_id, topic_type, created_at
        FROM t_like ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `)
        const countRows = await db.execute(sql`
        SELECT count(*)::int AS count FROM t_like ${whereClause}
      `)
        const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
        return reply.send(
          success({ list: listRows as Array<Record<string, unknown>>, total, page, pageSize }),
        )
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '查询点赞列表失败'))
      }
    },
  )

  // GET /behavior/like/count - 点赞计数
  server.get(
    '/behavior/like/count',
    {
      schema: {
        summary: '点赞计数',
        tags: ['behavior'],
        querystring: {
          type: 'object',
          properties: {
            topicId: { type: 'string', description: '目标 ID' },
            topicType: { type: 'string', description: '目标类型' },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          500: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = likeQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { topicId, topicType } = parsed.data
      try {
        const rows = await db.execute(sql`
        SELECT count(*)::int AS count FROM t_like
        WHERE topic_id = ${topicId} AND topic_type = ${topicType}
      `)
        const count = (rows[0] as { count?: number } | undefined)?.count ?? 0
        return reply.send(success({ topicId, topicType, count }))
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '查询点赞计数失败'))
      }
    },
  )

  // ===========================================================================
  // 通用收藏（behavior_favorite 表，raw SQL）
  // ===========================================================================

  // POST /behavior/favorite - 通用收藏
  server.post(
    '/behavior/favorite',
    {
      schema: {
        summary: '通用收藏',
        tags: ['behavior'],
        body: {
          type: 'object',
          properties: {
            topicId: { type: 'string', description: '目标 ID' },
            topicType: { type: 'string', description: '目标类型: lesson/article/exam/resource 等' },
            topicTitle: { type: 'string', description: '目标标题' },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          500: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = favoriteBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { topicId, topicType } = parsed.data
      const userId = request.userId!
      try {
        const existing = await db
          .select({ id: behaviorFavorite.id })
          .from(behaviorFavorite)
          .where(
            and(
              eq(behaviorFavorite.userId, userId),
              eq(behaviorFavorite.targetType, topicType),
              eq(behaviorFavorite.targetId, parseInt(topicId, 10)),
            ),
          )
          .limit(1)
        if (existing.length > 0) {
          return reply.send(
            success({ topicId, topicType, favorited: true, alreadyFavorited: true }),
          )
        }
        await db.insert(behaviorFavorite).values({
          userId,
          targetType: topicType,
          targetId: parseInt(topicId, 10),
        })
        return reply.send(success({ topicId, topicType, favorited: true }))
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '收藏失败'))
      }
    },
  )

  // DELETE /behavior/favorite - 取消收藏
  server.delete(
    '/behavior/favorite',
    {
      schema: {
        summary: '取消收藏',
        tags: ['behavior'],
        querystring: {
          type: 'object',
          properties: {
            topicId: { type: 'string', description: '目标 ID' },
            topicType: { type: 'string', description: '目标类型' },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          500: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = favoriteQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { topicId, topicType } = parsed.data
      const userId = request.userId!
      try {
        await db
          .delete(behaviorFavorite)
          .where(
            and(
              eq(behaviorFavorite.userId, userId),
              eq(behaviorFavorite.targetType, topicType),
              eq(behaviorFavorite.targetId, parseInt(topicId, 10)),
            ),
          )
        return reply.send(success({ topicId, topicType, favorited: false }))
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '取消收藏失败'))
      }
    },
  )

  // GET /behavior/favorite/check - 检查是否已收藏
  server.get(
    '/behavior/favorite/check',
    {
      schema: {
        summary: '检查是否已收藏',
        tags: ['behavior'],
        querystring: {
          type: 'object',
          properties: {
            topicId: { type: 'string', description: '目标 ID' },
            topicType: { type: 'string', description: '目标类型' },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          500: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = favoriteQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { topicId, topicType } = parsed.data
      const userId = request.userId!
      try {
        const rows = await db
          .select({ id: behaviorFavorite.id })
          .from(behaviorFavorite)
          .where(
            and(
              eq(behaviorFavorite.userId, userId),
              eq(behaviorFavorite.targetType, topicType),
              eq(behaviorFavorite.targetId, parseInt(topicId, 10)),
            ),
          )
          .limit(1)
        const favorited = rows.length > 0
        return reply.send(success({ topicId, topicType, favorited }))
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '检查收藏状态失败'))
      }
    },
  )

  // GET /behavior/favorite/list - 用户收藏列表
  server.get(
    '/behavior/favorite/list',
    {
      schema: {
        summary: '用户收藏列表',
        tags: ['behavior'],
        querystring: {
          type: 'object',
          properties: {
            topicType: { type: 'string', description: '目标类型筛选' },
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          500: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = favoriteListQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { topicType, page, pageSize } = parsed.data
      const userId = request.userId!
      const offset = (page - 1) * pageSize
      try {
        const whereClause = topicType
          ? sql`WHERE user_id = ${userId} AND target_type = ${topicType}`
          : sql`WHERE user_id = ${userId}`
        const listRows = await db
          .select({
            id: behaviorFavorite.id,
            target_type: behaviorFavorite.targetType,
            target_id: behaviorFavorite.targetId,
            created_at: behaviorFavorite.createdAt,
          })
          .from(behaviorFavorite)
          .where(
            topicType
              ? and(eq(behaviorFavorite.userId, userId), eq(behaviorFavorite.targetType, topicType))
              : eq(behaviorFavorite.userId, userId),
          )
          .orderBy(desc(behaviorFavorite.createdAt))
          .limit(pageSize)
          .offset(offset)
        const countRows = await db.execute(sql`
        SELECT count(*)::int AS count FROM behavior_favorite ${whereClause}
      `)
        const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
        return reply.send(
          success({ list: listRows as Array<Record<string, unknown>>, total, page, pageSize }),
        )
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '查询收藏列表失败'))
      }
    },
  )
}

// =============================================================================
// 管理员路由（前缀 /api/admin，行为统计与全量浏览记录）
// =============================================================================

export const adminBehaviorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /behavior/statistics - 行为统计
  server.get(
    '/behavior/statistics',
    {
      schema: {
        summary: '行为统计',
        tags: ['behavior'],
        response: { 200: dataObjSchema },
      },
    },
    async (_request, reply) => {
      const statistics = await getBehaviorStatistics()
      return reply.send(success({ statistics }))
    },
  )

  // GET /behavior/watch/list - 全量浏览记录列表
  server.get(
    '/behavior/watch/list',
    {
      schema: {
        summary: '全量浏览记录列表',
        tags: ['behavior'],
        querystring: {
          type: 'object',
          properties: {
            topicType: { type: 'string', description: '目标类型筛选' },
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: dataObjSchema,
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = adminWatchListQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findAllWatchList(parsed.data)
      return reply.send(success(result))
    },
  )
}
