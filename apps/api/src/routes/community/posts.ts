/**
 * community/posts 子路由(从 community.ts 拆分)。
 * 包含 sections: 跨圈子社区帖子 /community/posts（前端 use-community-publish.ts 调用）
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../plugins/auth.js'
import { success, error } from '../../utils/response.js'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db, dbRead } from '../../db/index.js'
import { createPost } from '../../db/community-queries.js'
import { circlePosts, circles, users } from '@ihui/database'

const postsRoutes: FastifyPluginAsync = async (server) => {
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
  // ===== 跨圈子社区帖子 /community/posts（前端 use-community-publish.ts 调用）=====

  // GET /community/posts — 跨圈子帖子列表（仅 status=1 已发布）
  server.get('/community/posts', async (request, reply) => {
    const { page, pageSize } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(request.query)
    const offset = (page - 1) * pageSize
    try {
      const [list, totalRows] = await Promise.all([
        dbRead
          .select({
            id: circlePosts.id,
            circleId: circlePosts.circleId,
            userId: circlePosts.userId,
            title: circlePosts.title,
            content: circlePosts.content,
            images: circlePosts.images,
            viewCount: circlePosts.viewCount,
            likeCount: circlePosts.likeCount,
            replyCount: circlePosts.replyCount,
            status: circlePosts.status,
            createdAt: circlePosts.createdAt,
            updatedAt: circlePosts.updatedAt,
            authorName: users.nickname,
            authorAvatar: users.avatar,
          })
          .from(circlePosts)
          .leftJoin(users, eq(users.id, circlePosts.userId))
          .where(eq(circlePosts.status, 1))
          .orderBy(desc(circlePosts.createdAt))
          .limit(pageSize)
          .offset(offset),
        dbRead
          .select({ count: sql<number>`COUNT(*)` })
          .from(circlePosts)
          .where(eq(circlePosts.status, 1)),
      ])
      return reply.send(success({ list, total: Number(totalRows[0]?.count ?? 0), page, pageSize }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询社区帖子列表失败'))
    }
  })

  // GET /community/posts/draft — 当前用户草稿列表（status=0）
  server.get('/community/posts/draft', async (request, reply) => {
    const { page, pageSize } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(request.query)
    const userId = request.userId!
    const offset = (page - 1) * pageSize
    try {
      const [list, totalRows] = await Promise.all([
        dbRead
          .select({
            id: circlePosts.id,
            circleId: circlePosts.circleId,
            userId: circlePosts.userId,
            title: circlePosts.title,
            content: circlePosts.content,
            images: circlePosts.images,
            status: circlePosts.status,
            createdAt: circlePosts.createdAt,
            updatedAt: circlePosts.updatedAt,
          })
          .from(circlePosts)
          .where(and(eq(circlePosts.userId, userId), eq(circlePosts.status, 0)))
          .orderBy(desc(circlePosts.updatedAt))
          .limit(pageSize)
          .offset(offset),
        dbRead
          .select({ count: sql<number>`COUNT(*)` })
          .from(circlePosts)
          .where(and(eq(circlePosts.userId, userId), eq(circlePosts.status, 0))),
      ])
      return reply.send(success({ list, total: Number(totalRows[0]?.count ?? 0), page, pageSize }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询草稿列表失败'))
    }
  })

  // POST /community/posts — 发布帖子（跨圈子，需要 circleId 或默认个人圈子）
  server.post('/community/posts', async (request, reply) => {
    const body = z
      .object({
        title: z.string().min(1, '标题不能为空').max(200),
        content: z.string().min(1, '内容不能为空').max(50000),
        tags: z.array(z.string().max(64)).max(20).optional(),
        cover: z.string().max(512).optional(),
        category: z.string().max(64).optional(),
        visibility: z.enum(['public', 'private', 'followers']).optional(),
        circleId: z.string().uuid().optional(),
        status: z.string().max(32).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    try {
      let targetCircleId = body.data.circleId
      if (!targetCircleId) {
        // 自动获取或创建用户的"个人圈子"
        const [personal] = await db
          .select()
          .from(circles)
          .where(eq(circles.createdBy, userId))
          .limit(1)
        if (personal) {
          targetCircleId = personal.id
        } else {
          const [created] = await db
            .insert(circles)
            .values({
              name: `个人圈子-${userId.slice(-6)}`,
              slug: `personal-${userId.slice(-8)}`,
              description: '个人帖子默认圈子',
              isPublished: true,
              createdBy: userId,
              memberCount: 1,
            })
            .returning()
          if (!created) return reply.status(500).send(error(500, '创建个人圈子失败'))
          targetCircleId = created.id
        }
      }
      const post = await createPost(targetCircleId, userId, {
        title: body.data.title,
        content: body.data.content,
        images: body.data.cover ? [body.data.cover] : null,
      })
      return reply.status(201).send(
        success({
          id: post.id,
          title: post.title,
          content: post.content,
          tags: body.data.tags ?? [],
          authorId: post.userId,
          status: 'published',
          publishedAt: post.createdAt,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '发布帖子失败'))
    }
  })

  // POST /community/posts/draft — 保存草稿（status=0）
  server.post('/community/posts/draft', async (request, reply) => {
    const body = z
      .object({
        title: z.string().min(1).max(200).default('未命名草稿'),
        content: z.string().max(50000).default(''),
        tags: z.array(z.string().max(64)).max(20).optional(),
        cover: z.string().max(512).optional(),
        category: z.string().max(64).optional(),
        visibility: z.enum(['public', 'private', 'followers']).optional(),
        circleId: z.string().uuid().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    try {
      let targetCircleId = body.data.circleId
      if (!targetCircleId) {
        const [personal] = await db
          .select()
          .from(circles)
          .where(eq(circles.createdBy, userId))
          .limit(1)
        if (personal) {
          targetCircleId = personal.id
        } else {
          const [created] = await db
            .insert(circles)
            .values({
              name: `个人圈子-${userId.slice(-6)}`,
              slug: `personal-${userId.slice(-8)}`,
              description: '个人帖子默认圈子',
              isPublished: true,
              createdBy: userId,
              memberCount: 1,
            })
            .returning()
          if (!created) return reply.status(500).send(error(500, '创建个人圈子失败'))
          targetCircleId = created.id
        }
      }
      // 草稿：插入 status=0 的帖子（不可见，仅本人可见）
      const [post] = await db
        .insert(circlePosts)
        .values({
          circleId: targetCircleId,
          userId,
          title: body.data.title,
          content: body.data.content,
          images: body.data.cover ? [body.data.cover] : null,
          status: 0,
        })
        .returning()
      if (!post) return reply.status(500).send(error(500, '保存草稿失败'))
      return reply.status(201).send(
        success({
          id: post.id,
          title: post.title,
          content: post.content,
          tags: body.data.tags ?? [],
          authorId: post.userId,
          status: 'draft',
          publishedAt: undefined,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '保存草稿失败'))
    }
  })

}
export default postsRoutes
