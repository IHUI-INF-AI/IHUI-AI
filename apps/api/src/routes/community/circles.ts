/**
 * community/circles 子路由(从 community.ts 拆分)。
 * 包含 sections: Circles
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../plugins/auth.js'
import { success, error } from '../../utils/response.js'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  createPost,
  deletePost,
  findCircleById,
  findCircleByIdOrSlug,
  findCirclePosts,
  findCircles,
  findPostById,
  updatePost,
} from '../../db/community-queries.js'
import {
  circleCategories,
  circleMembers,
  circlePostComments,
  circlePostLikes,
  circlePosts,
  circles,
} from '@ihui/database'
import {
  ADMIN_ROLE_ID,
  circleIdParamSchema,
  createPostSchema,
  errRespSchema,
  listCirclePostsQuery,
  listCirclesQuery,
  updatePostSchema,
  uuidParamSchema,
} from './_shared.js'

const circlesRoutes: FastifyPluginAsync = async (server) => {
  // 鉴权:GET /circles(列表)与 GET /circles/:id(详情)公开访问,其他路由需登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method === 'GET') {
      const path = request.url.split('?')[0] ?? ''
      // 公开读取路由:/circles, /circles/:id, /circles/:id/posts, /circles/:id/posts/:pid/comments
      if (
        path === '/api/circles' ||
        /^\/api\/circles\/[^/?]+$/.test(path) ||
        /^\/api\/circles\/[^/?]+\/posts$/.test(path) ||
        /^\/api\/circles\/[^/?]+\/posts\/[^/?]+\/comments$/.test(path)
      ) {
        return
      }
    }
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
  server.get(
    '/circles',
    {
      schema: {
        summary: '圈子列表',
        tags: ['community'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1, description: '页码(默认 1)' },
            pageSize: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: '每页数量(1-100,默认 20)',
            },
            search: { type: 'string', description: '名称/描述模糊搜索(可选)' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = listCirclesQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { page, pageSize, search } = parsed.data
      const { list, total } = await findCircles({ page, pageSize, search })
      return reply.send(success({ list, total, page, pageSize }))
    },
  )

  // GET /circles/:id - 圈子详情(支持 UUID 或 slug)
  server.get(
    '/circles/:id',
    {
      schema: {
        summary: '圈子详情',
        tags: ['community'],
        params: {
          type: 'object',
          properties: { id: { type: 'string', description: '圈子 ID 或 slug' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          500: errRespSchema,
        },
      },
    },
    async (request, reply) => {
      const parsed = circleIdParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const circle = await findCircleByIdOrSlug(parsed.data.id)
      if (!circle) {
        return reply.status(404).send(error(404, '圈子不存在'))
      }
      return reply.send(success({ circle }))
    },
  )

  // GET /circles/categories - 圈子分类树
  server.get(
    '/circles/categories',
    {
      schema: {
        summary: '圈子分类树',
        tags: ['community'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          401: errRespSchema,
          500: errRespSchema,
        },
      },
    },
    async (_request, reply) => {
      try {
        const rows = await db
          .select({
            id: circleCategories.id,
            pid: circleCategories.pid,
            name: circleCategories.name,
            sort_order: circleCategories.sortOrder,
            is_show: circleCategories.isShow,
            icon: circleCategories.icon,
          })
          .from(circleCategories)
          .where(eq(circleCategories.isShow, true))
          .orderBy(asc(circleCategories.sortOrder), asc(circleCategories.name))
        const categories = rows as unknown as Array<{
          id: string
          pid: string | null
          name: string
          sort_order: number
          is_show: boolean
          icon: string | null
        }>
        // 构建分类树
        const buildTree = (parentId: string | null): Array<Record<string, unknown>> => {
          return categories
            .filter((c) => (parentId === null ? c.pid === null : c.pid === parentId))
            .map((c) => ({
              id: c.id,
              name: c.name,
              icon: c.icon,
              sortOrder: c.sort_order,
              children: buildTree(c.id),
            }))
        }
        const tree = buildTree(null)
        return reply.send(success({ categories: tree }))
      } catch (e) {
        _request.log.error(e)
        return reply.status(500).send(error(500, '查询圈子分类失败'))
      }
    },
  )

  // GET /circles/:id/members - 圈子成员列表
  server.get(
    '/circles/:id/members',
    {
      schema: {
        summary: '圈子成员列表',
        tags: ['community'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          500: errRespSchema,
        },
      },
    },
    async (request, reply) => {
      const parsedP = circleIdParamSchema.safeParse(request.params)
      if (!parsedP.success) {
        return reply.status(400).send(error(400, parsedP.error.issues[0]?.message ?? '参数错误'))
      }
      const parsedQ = listCirclePostsQuery.safeParse(request.query)
      if (!parsedQ.success) {
        return reply.status(400).send(error(400, parsedQ.error.issues[0]?.message ?? '参数错误'))
      }
      const circle = await findCircleByIdOrSlug(parsedP.data.id)
      if (!circle) {
        return reply.status(404).send(error(404, '圈子不存在'))
      }
      const { page, pageSize } = parsedQ.data
      const offset = (page - 1) * pageSize
      try {
        const listRows = await db.execute(sql`
        SELECT cm.id, cm.user_id, cm.role, cm.status, cm.created_at,
               u.nickname, u.avatar
        FROM circle_members cm
        LEFT JOIN users u ON u.id = cm.user_id
        WHERE cm.circle_id = ${circle.id} AND cm.status = 1
        ORDER BY cm.created_at ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `)
        const countRows = await db.execute(sql`
        SELECT count(*)::int AS count FROM circle_members
        WHERE circle_id = ${circle.id} AND status = 1
      `)
        const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
        return reply.send(
          success({ list: listRows as Array<Record<string, unknown>>, total, page, pageSize }),
        )
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '查询圈子成员失败'))
      }
    },
  )

  // POST /circles/:id/members - 加入圈子
  server.post(
    '/circles/:id/members',
    {
      schema: {
        summary: '加入圈子',
        tags: ['community'],
        response: {
          201: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
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
      const parsedP = circleIdParamSchema.safeParse(request.params)
      if (!parsedP.success) {
        return reply.status(400).send(error(400, parsedP.error.issues[0]?.message ?? '参数错误'))
      }
      const circle = await findCircleByIdOrSlug(parsedP.data.id)
      if (!circle) {
        return reply.status(404).send(error(404, '圈子不存在'))
      }
      const userId = request.userId!
      try {
        await db
          .insert(circleMembers)
          .values({
            circleId: circle.id,
            userId,
            role: 'member',
            status: 1,
          })
          .onConflictDoUpdate({
            target: [circleMembers.circleId, circleMembers.userId],
            set: { status: 1, updatedAt: new Date() },
          })
        return reply.status(201).send(success({ circleId: circle.id, userId, joined: true }))
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '加入圈子失败'))
      }
    },
  )

  // DELETE /circles/:id/members - 退出圈子
  server.delete(
    '/circles/:id/members',
    {
      schema: {
        summary: '退出圈子',
        tags: ['community'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
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
      const parsedP = circleIdParamSchema.safeParse(request.params)
      if (!parsedP.success) {
        return reply.status(400).send(error(400, parsedP.error.issues[0]?.message ?? '参数错误'))
      }
      const circle = await findCircleByIdOrSlug(parsedP.data.id)
      if (!circle) {
        return reply.status(404).send(error(404, '圈子不存在'))
      }
      const userId = request.userId!
      try {
        await db
          .update(circleMembers)
          .set({ status: 0, updatedAt: new Date() })
          .where(and(eq(circleMembers.circleId, circle.id), eq(circleMembers.userId, userId)))
        return reply.send(success({ circleId: circle.id, userId, left: true }))
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, '退出圈子失败'))
      }
    },
  )

  // GET /circles/:id/posts - 圈子帖子列表
  server.get(
    '/circles/:id/posts',
    {
      schema: {
        summary: '圈子帖子列表',
        tags: ['community'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1, description: '页码(默认 1)' },
            pageSize: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: '每页数量(1-100,默认 20)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          500: errRespSchema,
        },
      },
    },
    async (request, reply) => {
      const parsedP = circleIdParamSchema.safeParse(request.params)
      if (!parsedP.success) {
        return reply.status(400).send(error(400, parsedP.error.issues[0]?.message ?? '参数错误'))
      }
      const parsedQ = listCirclePostsQuery.safeParse(request.query)
      if (!parsedQ.success) {
        return reply.status(400).send(error(400, parsedQ.error.issues[0]?.message ?? '参数错误'))
      }
      const circle = await findCircleByIdOrSlug(parsedP.data.id)
      if (!circle) {
        return reply.status(404).send(error(404, '圈子不存在'))
      }
      const { page, pageSize } = parsedQ.data
      const { list, total } = await findCirclePosts(circle.id, { page, pageSize })
      return reply.send(success({ list, total, page, pageSize }))
    },
  )

  // POST /circles/:id/posts - 发帖
  server.post(
    '/circles/:id/posts',
    {
      schema: {
        summary: '在圈子发帖',
        tags: ['community'],
        body: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '帖子标题' },
            content: { type: 'string', description: '帖子内容' },
            images: {
              type: 'array',
              items: { type: 'string' },
              description: '图片 URL 数组(可选)',
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          500: errRespSchema,
        },
      },
    },
    async (request, reply) => {
      const parsedP = circleIdParamSchema.safeParse(request.params)
      if (!parsedP.success) {
        return reply.status(400).send(error(400, parsedP.error.issues[0]?.message ?? '参数错误'))
      }
      const body = createPostSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const circle = await findCircleByIdOrSlug(parsedP.data.id)
      if (!circle) {
        return reply.status(404).send(error(404, '圈子不存在'))
      }
      const post = await createPost(circle.id, request.userId!, body.data)
      return reply.status(201).send(success({ post }))
    },
  )

  // GET /circles/posts/:id - 帖子详情
  server.get(
    '/circles/posts/:id',
    {
      schema: {
        summary: '帖子详情',
        tags: ['community'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          500: errRespSchema,
        },
      },
    },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const post = await findPostById(parsed.data.id)
      if (!post) {
        return reply.status(404).send(error(404, '帖子不存在'))
      }
      return reply.send(success({ post }))
    },
  )

  // PATCH /circles/posts/:id - 编辑帖子(仅本人)
  server.patch('/circles/posts/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = updatePostSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findPostById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '帖子不存在'))
    }
    if (existing.userId !== request.userId) {
      return reply.status(403).send(error(403, '只能编辑自己的帖子'))
    }
    const updated = await updatePost(parsed.data.id, request.userId!, body.data)
    return reply.send(success({ post: updated }))
  })

  // DELETE /circles/posts/:id - 删除帖子(仅本人)
  server.delete('/circles/posts/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findPostById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '帖子不存在'))
    }
    if (existing.userId !== request.userId) {
      return reply.status(403).send(error(403, '只能删除自己的帖子'))
    }
    await deletePost(parsed.data.id, request.userId!)
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })

  // POST /circles - 创建圈子
  server.post('/circles', async (request, reply) => {
    const body = z
      .object({
        name: z.string().min(1).max(100),
        description: z.string().max(2000).optional().nullable(),
        coverImage: z.string().max(512).optional().nullable(),
        categoryId: z.string().uuid().optional().nullable(),
        isPublished: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    const slug = `${body.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`
    const [created] = await db
      .insert(circles)
      .values({
        name: body.data.name,
        slug,
        description: body.data.description ?? null,
        coverImage: body.data.coverImage ?? null,
        categoryId: body.data.categoryId ?? null,
        isPublished: body.data.isPublished ?? true,
        createdBy: userId,
        memberCount: 1,
      })
      .returning()
    if (!created) return reply.status(500).send(error(500, '创建圈子失败'))
    return reply.status(201).send(success({ circle: created }))
  })

  // PUT /circles/:id - 修改圈子(仅创建者或管理员)
  server.put('/circles/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = z
      .object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(2000).nullable().optional(),
        coverImage: z.string().max(512).nullable().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        isPublished: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findCircleById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '圈子不存在'))
    }
    const roleId = request.jwtPayload?.roleId ?? 0
    if (existing.createdBy !== request.userId && roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '只能修改自己创建的圈子'))
    }
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (body.data.name !== undefined) updateData.name = body.data.name
    if (body.data.description !== undefined) updateData.description = body.data.description
    if (body.data.coverImage !== undefined) updateData.coverImage = body.data.coverImage
    if (body.data.categoryId !== undefined) updateData.categoryId = body.data.categoryId
    if (body.data.isPublished !== undefined) updateData.isPublished = body.data.isPublished
    const [updated] = await db
      .update(circles)
      .set(updateData)
      .where(eq(circles.id, parsed.data.id))
      .returning()
    if (!updated) return reply.status(500).send(error(500, '修改圈子失败'))
    return reply.send(success({ circle: updated }))
  })

  // POST /circles/posts/:id/like - 点赞/取消点赞
  server.post('/circles/posts/:id/like', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const post = await findPostById(parsed.data.id)
    if (!post) {
      return reply.status(404).send(error(404, '帖子不存在'))
    }
    const userId = request.userId!
    const [existing] = await db
      .select()
      .from(circlePostLikes)
      .where(and(eq(circlePostLikes.postId, parsed.data.id), eq(circlePostLikes.userId, userId)))
      .limit(1)
    if (existing) {
      await db.delete(circlePostLikes).where(eq(circlePostLikes.id, existing.id))
      const [updated] = await db
        .update(circlePosts)
        .set({ likeCount: Math.max(0, post.likeCount - 1), updatedAt: new Date() })
        .where(eq(circlePosts.id, parsed.data.id))
        .returning()
      return reply.send(success({ liked: false, likeCount: updated?.likeCount ?? 0 }))
    }
    await db.insert(circlePostLikes).values({ postId: parsed.data.id, userId })
    const [updated] = await db
      .update(circlePosts)
      .set({ likeCount: post.likeCount + 1, updatedAt: new Date() })
      .where(eq(circlePosts.id, parsed.data.id))
      .returning()
    return reply.send(success({ liked: true, likeCount: updated?.likeCount ?? post.likeCount + 1 }))
  })

  // GET /circles/posts/:id/comments - 帖子评论列表
  server.get('/circles/posts/:id/comments', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = z
      .object({
        page: z.coerce.number().optional().default(1),
        pageSize: z.coerce.number().optional().default(20),
      })
      .parse(request.query)
    const list = await db
      .select()
      .from(circlePostComments)
      .where(eq(circlePostComments.postId, parsed.data.id))
      .orderBy(desc(circlePostComments.createdAt))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return reply.send(success({ list, page: Number(page), pageSize: Number(pageSize) }))
  })

  // POST /circles/posts/:id/comment - 发表评论
  server.post('/circles/posts/:id/comment', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = z
      .object({
        content: z.string().min(1).max(20000),
        pid: z.string().uuid().optional().nullable(),
        replyUserId: z.string().uuid().optional().nullable(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const post = await findPostById(parsed.data.id)
    if (!post) {
      return reply.status(404).send(error(404, '帖子不存在'))
    }
    const userId = request.userId!
    const [created] = await db
      .insert(circlePostComments)
      .values({
        postId: parsed.data.id,
        userId,
        content: body.data.content,
        pid: body.data.pid ?? null,
        replyUserId: body.data.replyUserId ?? null,
      })
      .returning()
    if (!created) return reply.status(500).send(error(500, '发表评论失败'))
    await db
      .update(circlePosts)
      .set({ replyCount: post.replyCount + 1, updatedAt: new Date() })
      .where(eq(circlePosts.id, parsed.data.id))
    return reply.status(201).send(success({ comment: created }))
  })
}
export default circlesRoutes
