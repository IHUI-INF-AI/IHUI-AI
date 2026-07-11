import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { appVersions } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const platformSchema = z.enum(['ios', 'android', 'web', 'harmony'])

const listQuerySchema = z.object({
  platform: z.preprocess(emptyToUndefined, platformSchema.optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const latestQuerySchema = z.object({
  platform: z.preprocess(emptyToUndefined, platformSchema.optional()),
})

const createVersionSchema = z.object({
  version: z.string().min(1).max(32),
  platform: platformSchema,
  buildNumber: z.number().int().min(0),
  downloadUrl: z.string().max(512).optional(),
  forceUpdate: z.boolean().optional(),
  releaseNotes: z.string().max(5000).optional(),
  status: z.enum(['latest', 'history', 'disabled']).optional(),
})

const updateVersionSchema = z.object({
  version: z.string().min(1).max(32).optional(),
  buildNumber: z.number().int().min(0).optional(),
  downloadUrl: z.string().max(512).optional(),
  forceUpdate: z.boolean().optional(),
  releaseNotes: z.string().max(5000).optional(),
  status: z.enum(['latest', 'history', 'disabled']).optional(),
})

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

// =============================================================================
// 路由
// =============================================================================

const appVersionRoutes: FastifyPluginAsync = async (server) => {
  // GET /latest — 获取最新版本（公开，按 platform 筛选）
  server.get('/latest', async (request, reply) => {
    const parsed = latestQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const conditions = [eq(appVersions.status, 'latest')]
    if (parsed.data.platform) {
      conditions.push(eq(appVersions.platform, parsed.data.platform))
    }
    const [latest] = await db
      .select()
      .from(appVersions)
      .where(and(...conditions))
      .orderBy(desc(appVersions.buildNumber))
      .limit(1)
    return reply.send(success({ latest }))
  })

  // GET / — 版本列表（admin，分页 + platform 筛选）
  server.get('/', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { platform, page, pageSize } = parsed.data
    const offset = (page - 1) * pageSize
    const conditions = platform ? [eq(appVersions.platform, platform)] : []

    const list = await db
      .select()
      .from(appVersions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(appVersions.createdAt))
      .limit(pageSize)
      .offset(offset)

    return reply.send(success({ list, page, pageSize }))
  })

  // POST / — 发布新版本（admin）
  server.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createVersionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 若新版本标记为 latest，则将同平台旧 latest 降级为 history
    if (parsed.data.status === 'latest' || !parsed.data.status) {
      await db
        .update(appVersions)
        .set({ status: 'history' })
        .where(
          and(eq(appVersions.platform, parsed.data.platform), eq(appVersions.status, 'latest')),
        )
    }
    const [version] = await db
      .insert(appVersions)
      .values({
        ...parsed.data,
        status: parsed.data.status ?? 'latest',
      })
      .returning()
    return reply.status(201).send(success({ version }))
  })

  // PUT /:id — 修改版本（admin）
  server.put('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const parsedP = idParamSchema.safeParse(request.params)
    if (!parsedP.success) {
      return reply.status(400).send(error(400, parsedP.error.issues[0]?.message ?? '参数错误'))
    }
    const parsedB = updateVersionSchema.safeParse(request.body)
    if (!parsedB.success) {
      return reply.status(400).send(error(400, parsedB.error.issues[0]?.message ?? '参数错误'))
    }
    const updates = parsedB.data
    if (Object.keys(updates).length === 0) {
      return reply.status(400).send(error(400, '无更新字段'))
    }
    // 若更新为 latest，则将同平台旧 latest 降级为 history
    if (updates.status === 'latest') {
      const [existing] = await db
        .select()
        .from(appVersions)
        .where(eq(appVersions.id, parsedP.data.id))
        .limit(1)
      if (existing) {
        await db
          .update(appVersions)
          .set({ status: 'history' })
          .where(and(eq(appVersions.platform, existing.platform), eq(appVersions.status, 'latest')))
      }
    }
    const [version] = await db
      .update(appVersions)
      .set(updates)
      .where(eq(appVersions.id, parsedP.data.id))
      .returning()
    if (!version) {
      return reply.status(404).send(error(404, '版本不存在'))
    }
    return reply.send(success({ version }))
  })

  // DELETE /:id — 删除版本（admin）
  server.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const parsedP = idParamSchema.safeParse(request.params)
    if (!parsedP.success) {
      return reply.status(400).send(error(400, parsedP.error.issues[0]?.message ?? '参数错误'))
    }
    const [version] = await db
      .delete(appVersions)
      .where(eq(appVersions.id, parsedP.data.id))
      .returning()
    if (!version) {
      return reply.status(404).send(error(404, '版本不存在'))
    }
    return reply.send(success({ deleted: true }))
  })
}

export default appVersionRoutes
