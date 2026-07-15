/**
 * community/asks 子路由(从 community.ts 拆分)。
 * 包含 sections: Asks, 圈子管理（管理员）
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../plugins/auth.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { and, desc, eq, ilike, sql } from 'drizzle-orm'
import { db, dbRead } from '../../db/index.js'
import { acceptAnswer, createAnswer, createAsk, deleteAsk, deleteCircle, findAskAnswers, findAskById, findAsks, findCircleById, updateAsk, updateCircleShowStatus } from '../../db/community-queries.js'
import { circles } from '@ihui/database'
import { circleShowSchema, createAnswerSchema, createAskSchema, errRespSchema, listAskAnswersQuery, listAsksQuery, updateAskSchema, uuidParamSchema } from './_shared.js'

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
    if (body.data.isPublished !== undefined) updateData.isPublished = body.data.isPublished
    const [updated] = await db
      .update(circles)
      .set(updateData)
      .where(eq(circles.id, parsed.data.id))
      .returning()
    if (!updated) return reply.status(500).send(error(500, '修改圈子失败'))
    return reply.send(success({ circle: updated }))
  })
}
export default asksRoutes
