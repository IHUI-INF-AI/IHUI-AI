/**
 * /api/admin/user-agent-image 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { zhsUserAgentImage, newsArticles } from '@ihui/database'
import { eq, desc, sql } from 'drizzle-orm'
import { paginationSchema, idParamSchema, registerCrud, fields } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
const userAgentImageRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
server.get('/user-agent-image', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize } = q.data
    const list = await db
      .select()
      .from(zhsUserAgentImage)
      .orderBy(desc(zhsUserAgentImage.createTime))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (await db.select({ c: sql<number>`count(*)::int` }).from(zhsUserAgentImage))[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  server.get('/user-agent-image/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .select()
      .from(zhsUserAgentImage)
      .where(eq(zhsUserAgentImage.id, Number(p.data.id)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.post('/user-agent-image', async (request, reply) => {
    const body = z
      .object({
        userUuid: z.string().min(1).max(64),
        userId: z.string().max(64).optional(),
        userName: z.string().max(100).optional(),
        agentId: z.string().max(64).optional(),
        agentName: z.string().max(200).optional(),
        imageUrl: z.string().min(1).max(500),
        imageType: z.string().max(20).default('input'),
        prompt: z.string().optional(),
        model: z.string().max(50).optional(),
        taskId: z.string().max(100).optional(),
        status: z.coerce.number().int().default(1),
        cost: z.coerce.number().int().default(0),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const [created] = await db.insert(zhsUserAgentImage).values(body.data).returning()
    return reply.status(201).send(success(created))
  })
  server.put('/user-agent-image/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const body = z
      .object({
        userName: z.string().max(100).optional(),
        agentName: z.string().max(200).optional(),
        imageUrl: z.string().max(500).optional(),
        imageType: z.string().max(20).optional(),
        prompt: z.string().optional(),
        model: z.string().max(50).optional(),
        taskId: z.string().max(100).optional(),
        status: z.coerce.number().int().optional(),
        cost: z.coerce.number().int().optional(),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const [updated] = await db
      .update(zhsUserAgentImage)
      .set(body.data)
      .where(eq(zhsUserAgentImage.id, Number(p.data.id)))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(updated))
  })
  server.delete('/user-agent-image/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsUserAgentImage).where(eq(zhsUserAgentImage.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // ===========================================================================
  // 2. 内容运营模块 — 路由已迁移至 admin-content-routes.ts
  // ===========================================================================
  registerCrud(server, '/news/information', newsArticles, {
    searchField: newsArticles.title,
    map: fields({
      categoryId: 'string',
      title: 'string',
      summary: 'string',
      content: 'string',
      coverImage: 'string',
      authorId: 'string',
      authorName: 'string',
      isPublished: 'boolean',
      isPinned: 'boolean',
      viewCount: 'number',
      sort: 'number',
      status: 'number',
      publishedAt: 'date',
    }),
  })

  // ===========================================================================
  // 3. 鉴权/用户/系统模块 — 有表路由（真实 CRUD，11 个）
  // ===========================================================================
}

export default userAgentImageRoutes
