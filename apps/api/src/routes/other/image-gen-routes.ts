/**
 * 图像生成(从 frontend-stub-other-routes.ts 拆分)。
 * GET /image-gen/favorites, GET /image-gen/gallery, GET /image-gen/history,
 * POST /image-gen/generate, GET /image-gen/templates
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db, dbRead } from '../../db/index.js'
import { aiGcContent, contentGenerationTemplates, imageGenFavorites } from '@ihui/database'
import { parsePagination } from './_shared.js'

export const imageGenRoutes: FastifyPluginAsync = async (server) => {
  // GET /image-gen/favorites — 当前用户收藏的 AI 生成图片列表
  server.get('/image-gen/favorites', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const [list, totalRows] = await Promise.all([
      dbRead
        .select({
          id: imageGenFavorites.id,
          prompt: imageGenFavorites.prompt,
          imageUrl: imageGenFavorites.imageUrl,
          createdAt: imageGenFavorites.createdAt,
        })
        .from(imageGenFavorites)
        .where(eq(imageGenFavorites.userId, request.userId!))
        .orderBy(desc(imageGenFavorites.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(imageGenFavorites)
        .where(eq(imageGenFavorites.userId, request.userId!)),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // GET /image-gen/gallery — 公开图库(aiGcContent where gcType=image, status=1)
  server.get('/image-gen/gallery', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = and(eq(aiGcContent.gcType, 'image'), eq(aiGcContent.status, 1))
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(aiGcContent)
        .where(where)
        .orderBy(desc(aiGcContent.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(aiGcContent)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // GET /image-gen/history — 当前用户的图像生成历史
  server.get('/image-gen/history', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = and(eq(aiGcContent.userUuid, request.userId!), eq(aiGcContent.gcType, 'image'))
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(aiGcContent)
        .where(where)
        .orderBy(desc(aiGcContent.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(aiGcContent)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // POST /image-gen/generate — 创建图像生成任务
  server.post('/image-gen/generate', async (request, reply) => {
    const body = z
      .object({
        content: z.string().min(1).max(5000),
        agentId: z.string().max(64).optional(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [item] = await db
      .insert(aiGcContent)
      .values({
        userUuid: request.userId!,
        agentId: body.data.agentId ?? null,
        gcType: 'image',
        content: body.data.content,
        status: 1,
      })
      .returning()
    return reply.status(201).send(success({ item }))
  })

  // GET /image-gen/templates — 图像生成模板列表(contentGenerationTemplates)
  server.get('/image-gen/templates', async (_request, reply) => {
    const list = await dbRead
      .select()
      .from(contentGenerationTemplates)
      .where(eq(contentGenerationTemplates.status, 1))
      .orderBy(desc(contentGenerationTemplates.createdAt))
    return reply.send(success({ list }))
  })
}
