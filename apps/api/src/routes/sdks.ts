import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { sdks } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const listQuerySchema = z.object({
  language: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
  status: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
})

const createSdkSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().min(1).max(32),
  language: z.string().min(1).max(32),
  downloadUrl: z.string().max(512).optional(),
  documentationUrl: z.string().max(512).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['active', 'deprecated', 'beta']).optional(),
})

const updateSdkSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  version: z.string().min(1).max(32).optional(),
  language: z.string().min(1).max(32).optional(),
  downloadUrl: z.string().max(512).optional(),
  documentationUrl: z.string().max(512).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['active', 'deprecated', 'beta']).optional(),
})

// =============================================================================
// 路由
// =============================================================================

const sdksRoutes: FastifyPluginAsync = async (server) => {
  // GET / — SDK 列表（公开，支持 language/status 筛选）
  server.get('/', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { language, status } = parsed.data
    const conditions = [eq(sdks.status, status ?? 'active')]
    if (language) conditions.push(eq(sdks.language, language))

    const list = await db
      .select()
      .from(sdks)
      .where(and(...conditions))
      .orderBy(asc(sdks.name))
    return reply.send(success({ list }))
  })

  // GET /:id — SDK 详情（公开）
  server.get('/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [sdk] = await db.select().from(sdks).where(eq(sdks.id, parsed.data.id)).limit(1)
    if (!sdk) return reply.status(404).send(error(404, 'SDK 不存在'))
    return reply.send(success({ sdk }))
  })

  // POST / — 创建 SDK（admin）
  server.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createSdkSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [sdk] = await db
      .insert(sdks)
      .values({ ...parsed.data, status: parsed.data.status ?? 'active' })
      .returning()
    return reply.status(201).send(success({ sdk }))
  })

  // PATCH /:id — 更新 SDK（admin）
  server.patch('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateSdkSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [sdk] = await db
      .update(sdks)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(sdks.id, idParsed.data.id))
      .returning()
    if (!sdk) return reply.status(404).send(error(404, 'SDK 不存在'))
    return reply.send(success({ sdk }))
  })
}

export default sdksRoutes
