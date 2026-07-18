/**
 * community/asks 子路由(从 community.ts 拆分)。
 * 包含 sections: Asks, 圈子管理（管理员）
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../plugins/auth.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db, dbRead } from '../../db/index.js'
import {
  acceptAnswer,
  createAnswer,
  createAsk,
  deleteAsk,
  deleteCircle,
  findAskAnswers,
  findAskById,
  findAsks,
  findCircleById,
  findPostById,
  updateAsk,
  updateCircleShowStatus,
} from '../../db/community-queries.js'
import {
  askAnswers,
  asks,
  circlePostComments,
  circlePostLikes,
  circlePosts,
  circles,
  users,
} from '@ihui/database'
import {
  circleShowSchema,
  createAnswerSchema,
  createAskSchema,
  errRespSchema,
  listAskAnswersQuery,
  listAsksQuery,
  updateAskSchema,
  uuidParamSchema,
} from './_shared.js'

const asksRoutes: FastifyPluginAsync = async (server) => {
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
  // ===== Asks =====

  // GET /asks - 问答列表(?page&pageSize&search&resolved)
  server.get(
    '/asks',
    {
      schema: {
        summary: '问答列表',
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
            search: { type: 'string', description: '标题/内容模糊搜索(可选)' },
            resolved: { type: 'boolean', description: '是否已解决筛选(可选)' },
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
      const parsed = listAsksQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { page, pageSize, search, resolved } = parsed.data
      const { list, total } = await findAsks({ page, pageSize, search, resolved })
      return reply.send(success({ list, total, page, pageSize }))
    },
  )

  // GET /asks/:id - 问答详情
  server.get(
    '/asks/:id',
    {
      schema: {
        summary: '问答详情',
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
      const ask = await findAskById(parsed.data.id)
      if (!ask) {
        return reply.status(404).send(error(404, '问答不存在'))
      }
      return reply.send(success({ ask }))
    },
  )

  // POST /asks - 提问
  server.post(
    '/asks',
    {
      schema: {
        summary: '创建问答',
        tags: ['community'],
        body: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '问题标题' },
            content: { type: 'string', description: '问题内容' },
            tags: { type: 'array', items: { type: 'string' }, description: '标签数组(可选)' },
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
        },
      },
    },
    async (request, reply) => {
      const body = createAskSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const ask = await createAsk(request.userId!, body.data)
      return reply.status(201).send(success({ ask }))
    },
  )

  // PATCH /asks/:id - 编辑问题(仅本人)
  server.patch('/asks/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = updateAskSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findAskById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '问答不存在'))
    }
    if (existing.userId !== request.userId) {
      return reply.status(403).send(error(403, '只能编辑自己的问题'))
    }
    const updated = await updateAsk(parsed.data.id, request.userId!, body.data)
    return reply.send(success({ ask: updated }))
  })

  // DELETE /asks/:id - 删除问题(仅本人)
  server.delete('/asks/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findAskById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '问答不存在'))
    }
    if (existing.userId !== request.userId) {
      return reply.status(403).send(error(403, '只能删除自己的问题'))
    }
    await deleteAsk(parsed.data.id, request.userId!)
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })

  // GET /asks/:id/answers - 回答列表
  server.get(
    '/asks/:id/answers',
    {
      schema: {
        summary: '问答回答列表',
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
      const parsedP = uuidParamSchema.safeParse(request.params)
      if (!parsedP.success) {
        return reply.status(400).send(error(400, parsedP.error.issues[0]?.message ?? '参数错误'))
      }
      const parsedQ = listAskAnswersQuery.safeParse(request.query)
      if (!parsedQ.success) {
        return reply.status(400).send(error(400, parsedQ.error.issues[0]?.message ?? '参数错误'))
      }
      const ask = await findAskById(parsedP.data.id)
      if (!ask) {
        return reply.status(404).send(error(404, '问答不存在'))
      }
      const { page, pageSize } = parsedQ.data
      const { list, total } = await findAskAnswers(ask.id, { page, pageSize })
      return reply.send(success({ list, total, page, pageSize }))
    },
  )

  // POST /asks/:id/answers - 回答
  server.post(
    '/asks/:id/answers',
    {
      schema: {
        summary: '创建回答',
        tags: ['community'],
        body: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '回答内容' },
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
      const parsedP = uuidParamSchema.safeParse(request.params)
      if (!parsedP.success) {
        return reply.status(400).send(error(400, parsedP.error.issues[0]?.message ?? '参数错误'))
      }
      const body = createAnswerSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const ask = await findAskById(parsedP.data.id)
      if (!ask) {
        return reply.status(404).send(error(404, '问答不存在'))
      }
      const answer = await createAnswer(ask.id, request.userId!, body.data.content)
      return reply.status(201).send(success({ answer }))
    },
  )

  // POST /asks/answers/:id/accept - 采纳答案(仅提问者)
  server.post(
    '/asks/answers/:id/accept',
    {
      schema: {
        summary: '采纳答案',
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
          403: {
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
      const accepted = await acceptAnswer(parsed.data.id, request.userId!)
      if (!accepted) {
        // 答案不存在或当前用户不是提问者，统一返回 404 避免泄露存在性
        return reply.status(404).send(error(404, '答案不存在或无权采纳'))
      }
      return reply.send(success({ answer: accepted }))
    },
  )

  // ===== 圈子管理（管理员） =====

  // DELETE /admin/circles/:id - 管理员删除圈子
  server.delete('/admin/circles/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findCircleById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '圈子不存在'))
    }
    await deleteCircle(parsed.data.id)
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })

  // PUT /admin/circles/:id/show - 更新圈子显示状态
  server.put('/admin/circles/:id/show', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = circleShowSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findCircleById(idParsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '圈子不存在'))
    }
    const circle = await updateCircleShowStatus(idParsed.data.id, parsed.data.isPublished)
    return reply.send(success({ circle }))
  })

  // GET /admin/circles - 管理员圈子列表(支持 search + isPublished 过滤)
  server.get('/admin/circles', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        search: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
        isPublished: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, search, isPublished } = parsed.data
    const conds: Array<ReturnType<typeof eq>> = []
    if (search) conds.push(ilike(circles.name, `%${search}%`))
    if (isPublished !== undefined) conds.push(eq(circles.isPublished, isPublished))
    const where = conds.length > 0 ? and(...conds) : undefined
    const offset = (page - 1) * pageSize
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(circles)
        .where(where)
        .orderBy(desc(circles.createdAt))
        .limit(pageSize)
        .offset(offset),
      dbRead
        .select({ count: sql<number>`COUNT(*)` })
        .from(circles)
        .where(where),
    ])
    return reply.send(success({ list, total: Number(totalRows[0]?.count ?? 0), page, pageSize }))
  })

  // POST /admin/circles - 管理员创建圈子
  server.post('/admin/circles', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const body = z
      .object({
        name: z.string().min(1).max(100),
        slug: z.string().min(1).max(120).optional(),
        description: z.string().max(2000).optional().nullable(),
        coverImage: z.string().max(512).optional().nullable(),
        cidList: z.array(z.string().uuid()).max(50).optional(),
        isPublished: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const slug =
      body.data.slug ??
      `${body.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`
    const [created] = await db
      .insert(circles)
      .values({
        name: body.data.name,
        slug,
        description: body.data.description ?? null,
        coverImage: body.data.coverImage ?? null,
        cidList: body.data.cidList ?? null,
        isPublished: body.data.isPublished ?? true,
      })
      .returning()
    if (!created) return reply.status(500).send(error(500, '创建圈子失败'))
    return reply.status(201).send(success({ circle: created }))
  })

  // PUT /admin/circles/:id - 管理员编辑圈子(全字段 optional)
  server.put('/admin/circles/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = z
      .object({
        name: z.string().min(1).max(100).optional(),
        slug: z.string().min(1).max(120).optional(),
        description: z.string().max(2000).nullable().optional(),
        coverImage: z.string().max(512).nullable().optional(),
        cidList: z.array(z.string().uuid()).max(50).nullable().optional(),
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
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (body.data.name !== undefined) updateData.name = body.data.name
    if (body.data.slug !== undefined) updateData.slug = body.data.slug
    if (body.data.description !== undefined) updateData.description = body.data.description
    if (body.data.coverImage !== undefined) updateData.coverImage = body.data.coverImage
    if (body.data.cidList !== undefined) updateData.cidList = body.data.cidList
    if (body.data.isPublished !== undefined) updateData.isPublished = body.data.isPublished
    const [updated] = await db
      .update(circles)
      .set(updateData)
      .where(eq(circles.id, parsed.data.id))
      .returning()
    if (!updated) return reply.status(500).send(error(500, '修改圈子失败'))
    return reply.send(success({ circle: updated }))
  })

  // ===== 圈子帖子管理（管理员） =====

  // GET /admin/circles/posts - 管理员圈子帖子列表(支持 keyword + status + circleId 过滤)
  server.get('/admin/circles/posts', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        keyword: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
        status: z.preprocess(
          emptyToUndefined,
          z.enum(['published', 'deleted', 'pending', 'rejected']).optional(),
        ),
        circleId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, keyword, status, circleId } = parsed.data
    const conds: Array<ReturnType<typeof eq>> = []
    if (keyword) {
      const kw = `%${keyword}%`
      conds.push(or(ilike(circlePosts.title, kw), ilike(circlePosts.content, kw))!)
    }
    if (status === 'published') conds.push(eq(circlePosts.status, 1))
    else if (status === 'deleted') conds.push(eq(circlePosts.status, -1))
    else if (status === 'pending') conds.push(eq(circlePosts.status, 2))
    else if (status === 'rejected') conds.push(eq(circlePosts.status, 3))
    if (circleId) conds.push(eq(circlePosts.circleId, circleId))
    const where = conds.length > 0 ? and(...conds) : undefined
    const offset = (page - 1) * pageSize
    const cols = {
      id: circlePosts.id,
      content: circlePosts.content,
      images: circlePosts.images,
      status: circlePosts.status,
      viewCount: circlePosts.viewCount,
      commentCount: circlePosts.replyCount,
      likeCount: circlePosts.likeCount,
      createdAt: circlePosts.createdAt,
      authorId: users.id,
      authorNickname: users.nickname,
      authorAvatar: users.avatar,
      circleId: circles.id,
      circleName: circles.name,
    }
    const [rows, totalRows] = await Promise.all([
      dbRead
        .select(cols)
        .from(circlePosts)
        .leftJoin(users, eq(users.id, circlePosts.userId))
        .leftJoin(circles, eq(circles.id, circlePosts.circleId))
        .where(where)
        .orderBy(desc(circlePosts.createdAt))
        .limit(pageSize)
        .offset(offset),
      dbRead
        .select({ count: sql<number>`COUNT(*)` })
        .from(circlePosts)
        .where(where),
    ])
    const list = rows.map((r) => {
      const statusStr =
        r.status === 1
          ? ('published' as const)
          : r.status === 2
            ? ('pending' as const)
            : r.status === 3
              ? ('rejected' as const)
              : ('deleted' as const)
      return {
        id: r.id,
        content: r.content,
        images: (r.images ?? []) as string[],
        status: statusStr,
        author: {
          id: r.authorId ?? '',
          nickname: r.authorNickname ?? '',
          avatar: r.authorAvatar ?? null,
        },
        circle: {
          id: r.circleId ?? '',
          name: r.circleName ?? '',
        },
        viewCount: r.viewCount,
        commentCount: r.commentCount,
        likeCount: r.likeCount,
        favoriteCount: 0,
        createdAt: r.createdAt,
      }
    })
    return reply.send(success({ list, total: Number(totalRows[0]?.count ?? 0), page, pageSize }))
  })

  // DELETE /admin/circles/posts/:id - 管理员删除帖子(软删:status=-1)
  server.delete('/admin/circles/posts/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findPostById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '帖子不存在'))
    }
    await db
      .update(circlePosts)
      .set({ status: -1, updatedAt: new Date() })
      .where(eq(circlePosts.id, parsed.data.id))
    return reply.send(success(null))
  })

  // PUT /admin/circles/posts/:id/audit - 管理员审核帖子(更新 status 字段)
  // status 映射: published=1, pending=2, rejected=3
  server.put('/admin/circles/posts/:id/audit', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = z
      .object({
        status: z.enum(['published', 'pending', 'rejected']),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findPostById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '帖子不存在'))
    }
    const statusMap: Record<string, number> = {
      published: 1,
      pending: 2,
      rejected: 3,
    }
    const [updated] = await db
      .update(circlePosts)
      .set({ status: statusMap[body.data.status], updatedAt: new Date() })
      .where(eq(circlePosts.id, parsed.data.id))
      .returning()
    if (!updated) return reply.status(500).send(error(500, '审核失败'))
    const statusStr =
      updated.status === 1
        ? ('published' as const)
        : updated.status === 2
          ? ('pending' as const)
          : updated.status === 3
            ? ('rejected' as const)
            : ('deleted' as const)
    return reply.send(success({ post: { id: updated.id, status: statusStr } }))
  })

  // GET /admin/circles/posts/:id/comments - 管理端帖子评论列表(分页)
  server.get('/admin/circles/posts/:id/comments', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const query = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .safeParse(request.query)
    if (!query.success) {
      return reply.status(400).send(error(400, query.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = query.data
    const existing = await findPostById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '帖子不存在'))
    }
    const cols = {
      id: circlePostComments.id,
      content: circlePostComments.content,
      status: circlePostComments.status,
      likeCount: circlePostComments.likeCount,
      createdAt: circlePostComments.createdAt,
      pid: circlePostComments.pid,
      replyUserId: circlePostComments.replyUserId,
      authorId: users.id,
      authorNickname: users.nickname,
      authorAvatar: users.avatar,
    }
    const offset = (page - 1) * pageSize
    const [rows, totalRows] = await Promise.all([
      dbRead
        .select(cols)
        .from(circlePostComments)
        .leftJoin(users, eq(users.id, circlePostComments.userId))
        .where(eq(circlePostComments.postId, parsed.data.id))
        .orderBy(desc(circlePostComments.createdAt))
        .limit(pageSize)
        .offset(offset),
      dbRead
        .select({ count: sql<number>`COUNT(*)` })
        .from(circlePostComments)
        .where(eq(circlePostComments.postId, parsed.data.id)),
    ])
    const list = rows.map((r) => ({
      id: r.id,
      content: r.content,
      status: r.status,
      likeCount: r.likeCount,
      createdAt: r.createdAt,
      pid: r.pid,
      replyUserId: r.replyUserId,
      author: {
        id: r.authorId ?? '',
        nickname: r.authorNickname ?? '',
        avatar: r.authorAvatar ?? null,
      },
    }))
    return reply.send(success({ list, total: Number(totalRows[0]?.count ?? 0), page, pageSize }))
  })

  // ===== 补建端点:问答批量/列表/采纳/相关 =====

  // GET /asks/question/list/by-ids - 按 ID 批量查询问题(query: ids 逗号分隔)
  server.get('/asks/question/list/by-ids', async (request, reply) => {
    const parsed = z.object({ ids: z.string().min(1, 'ids 不能为空') }).safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const ids = parsed.data.ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (ids.length === 0) {
      return reply.send(success({ list: [] }))
    }
    const list = await dbRead
      .select()
      .from(asks)
      .where(inArray(asks.id, ids))
      .orderBy(desc(asks.createdAt))
    return reply.send(success({ list }))
  })

  // GET /asks/member/question/list - 当前用户的问题列表(分页)
  server.get('/asks/member/question/list', async (request, reply) => {
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const userId = request.userId!
    const where = eq(asks.userId, userId)
    const offset = (page - 1) * pageSize
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(asks)
        .where(where)
        .orderBy(desc(asks.createdAt))
        .limit(pageSize)
        .offset(offset),
      dbRead
        .select({ count: sql<number>`COUNT(*)` })
        .from(asks)
        .where(where),
    ])
    return reply.send(success({ list, total: Number(totalRows[0]?.count ?? 0), page, pageSize }))
  })

  // GET /asks/answer/list/by-ids - 按 ID 批量查询回答(query: ids)
  server.get('/asks/answer/list/by-ids', async (request, reply) => {
    const parsed = z.object({ ids: z.string().min(1, 'ids 不能为空') }).safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const ids = parsed.data.ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (ids.length === 0) {
      return reply.send(success({ list: [] }))
    }
    const list = await dbRead
      .select()
      .from(askAnswers)
      .where(inArray(askAnswers.id, ids))
      .orderBy(desc(askAnswers.createdAt))
    return reply.send(success({ list }))
  })

  // POST /asks/answer/adopt - 采纳回答(body: answerId)
  server.post('/asks/answer/adopt', async (request, reply) => {
    const body = z.object({ answerId: z.string().uuid('无效的 answerId') }).safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const accepted = await acceptAnswer(body.data.answerId, request.userId!)
    if (!accepted) {
      return reply.status(404).send(error(404, '答案不存在或无权采纳'))
    }
    return reply.send(success({ answer: accepted }))
  })

  // GET /asks/answer/related-questions - 相关问题列表(query: questionId)
  server.get('/asks/answer/related-questions', async (request, reply) => {
    const parsed = z
      .object({ questionId: z.string().uuid('无效的 questionId') })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const ask = await findAskById(parsed.data.questionId)
    if (!ask) {
      return reply.status(404).send(error(404, '问答不存在'))
    }
    const list = await dbRead
      .select()
      .from(asks)
      .where(
        and(
          sql`${asks.id} <> ${parsed.data.questionId}`,
          eq(asks.userId, ask.userId),
          eq(asks.status, 1),
        ),
      )
      .orderBy(desc(asks.createdAt))
      .limit(10)
    return reply.send(success({ list }))
  })

  // ===== 补建端点:圈子动态 =====

  // GET /circles/dynamic/list/by-ids - 按 ID 批量查询动态(query: ids)
  server.get('/circles/dynamic/list/by-ids', async (request, reply) => {
    const parsed = z.object({ ids: z.string().min(1, 'ids 不能为空') }).safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const ids = parsed.data.ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (ids.length === 0) {
      return reply.send(success({ list: [] }))
    }
    const list = await dbRead
      .select()
      .from(circlePosts)
      .where(inArray(circlePosts.id, ids))
      .orderBy(desc(circlePosts.createdAt))
    return reply.send(success({ list }))
  })

  // GET /circles/member/dynamic/list - 当前用户的动态列表(分页)
  server.get('/circles/member/dynamic/list', async (request, reply) => {
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const userId = request.userId!
    const where = eq(circlePosts.userId, userId)
    const offset = (page - 1) * pageSize
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(circlePosts)
        .where(where)
        .orderBy(desc(circlePosts.createdAt))
        .limit(pageSize)
        .offset(offset),
      dbRead
        .select({ count: sql<number>`COUNT(*)` })
        .from(circlePosts)
        .where(where),
    ])
    return reply.send(success({ list, total: Number(totalRows[0]?.count ?? 0), page, pageSize }))
  })

  // POST /circles/dynamic/like - 点赞动态(body: dynamicId,如已存在则取消)
  server.post('/circles/dynamic/like', async (request, reply) => {
    const body = z
      .object({ dynamicId: z.string().uuid('无效的 dynamicId') })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const dynamicId = body.data.dynamicId
    const post = await findPostById(dynamicId)
    if (!post) {
      return reply.status(404).send(error(404, '动态不存在'))
    }
    const userId = request.userId!
    const [existing] = await db
      .select()
      .from(circlePostLikes)
      .where(and(eq(circlePostLikes.postId, dynamicId), eq(circlePostLikes.userId, userId)))
      .limit(1)
    if (existing) {
      await db.delete(circlePostLikes).where(eq(circlePostLikes.id, existing.id))
      const [updated] = await db
        .update(circlePosts)
        .set({ likeCount: Math.max(0, post.likeCount - 1), updatedAt: new Date() })
        .where(eq(circlePosts.id, dynamicId))
        .returning()
      return reply.send(success({ liked: false, likeCount: updated?.likeCount ?? 0 }))
    }
    await db.insert(circlePostLikes).values({ postId: dynamicId, userId })
    const [updated] = await db
      .update(circlePosts)
      .set({ likeCount: post.likeCount + 1, updatedAt: new Date() })
      .where(eq(circlePosts.id, dynamicId))
      .returning()
    return reply.send(success({ liked: true, likeCount: updated?.likeCount ?? post.likeCount + 1 }))
  })

  // DELETE /circles/dynamic/comment - 删除动态评论(query/body: commentId)
  server.delete('/circles/dynamic/comment', async (request, reply) => {
    const raw =
      (request.query as { commentId?: string } | undefined)?.commentId ??
      (request.body as { commentId?: string } | undefined)?.commentId
    const parsed = z
      .object({ commentId: z.string().uuid('无效的 commentId') })
      .safeParse({ commentId: raw })
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const commentId = parsed.data.commentId
    const userId = request.userId!
    const [existing] = await db
      .select()
      .from(circlePostComments)
      .where(eq(circlePostComments.id, commentId))
      .limit(1)
    if (!existing) {
      return reply.status(404).send(error(404, '评论不存在'))
    }
    if (existing.userId !== userId) {
      return reply.status(403).send(error(403, '只能删除自己的评论'))
    }
    await db.delete(circlePostComments).where(eq(circlePostComments.id, commentId))
    await db
      .update(circlePosts)
      .set({ replyCount: sql`GREATEST(${circlePosts.replyCount} - 1, 0)`, updatedAt: new Date() })
      .where(eq(circlePosts.id, existing.postId))
    return reply.send(success({ id: commentId, deleted: true }))
  })
}
export default asksRoutes
