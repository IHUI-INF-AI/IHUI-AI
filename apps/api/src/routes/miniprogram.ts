import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { miniprogramConfigs, miniprogramVersions } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const configQuerySchema = z.object({
  appId: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
})

const updateConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['active', 'disabled']).optional(),
})

const versionsQuerySchema = z.object({
  appId: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  status: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
})

const previewSchema = z.object({
  appId: z.string().min(1).max(64),
  version: z.string().min(1).max(32),
  versionDesc: z.string().max(500).optional(),
})

// =============================================================================
// 路由
// =============================================================================

const miniprogramRoutes: FastifyPluginAsync = async (server) => {
  // GET /config — 小程序配置（公开，按 appId 查询）
  server.get('/config', async (request, reply) => {
    const parsed = configQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const conditions = [eq(miniprogramConfigs.status, 'active')]
    if (parsed.data.appId) conditions.push(eq(miniprogramConfigs.appId, parsed.data.appId))
    const list = await db
      .select()
      .from(miniprogramConfigs)
      .where(and(...conditions))
    return reply.send(success({ list }))
  })

  // POST /config — 更新配置（admin，upsert 语义）
  server.post('/config', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = updateConfigSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 需要 body 中提供 appId 以定位配置（upsert）
    const body = z.object({ appId: z.string().optional() }).parse(request.body)
    if (!body.appId) {
      return reply.status(400).send(error(400, 'appId 为必填项'))
    }
    const [existing] = await db
      .select()
      .from(miniprogramConfigs)
      .where(eq(miniprogramConfigs.appId, body.appId))
      .limit(1)

    if (existing) {
      const [updated] = await db
        .update(miniprogramConfigs)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(miniprogramConfigs.appId, body.appId))
        .returning()
      return reply.send(success({ config: updated }))
    }
    // 新建配置
    const [created] = await db
      .insert(miniprogramConfigs)
      .values({
        appId: body.appId,
        name: parsed.data.name ?? body.appId,
        type: 'wechat',
        config: parsed.data.config ?? {},
        status: parsed.data.status ?? 'active',
      })
      .returning()
    return reply.status(201).send(success({ config: created }))
  })

  // GET /versions — 版本列表（公开，支持 appId/status 筛选）
  server.get('/versions', async (request, reply) => {
    const parsed = versionsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { appId, status } = parsed.data

    const list = await db
      .select()
      .from(miniprogramVersions)
      .orderBy(desc(miniprogramVersions.createdAt))
      .limit(50)
    // 简单内存过滤（避免复杂 where 构建）
    const filtered = list.filter(
      (v) => (!appId || v.appId === appId) && (!status || v.status === status),
    )
    return reply.send(success({ list: filtered }))
  })

  // POST /preview — 预览（admin，创建预览版本记录）
  server.post('/preview', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = previewSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [version] = await db
      .insert(miniprogramVersions)
      .values({
        appId: parsed.data.appId,
        version: parsed.data.version,
        versionDesc: parsed.data.versionDesc,
        status: 'preview',
        build: Math.floor(Date.now() / 1000),
      })
      .returning()
    return reply.status(201).send(success({ version }))
  })
}

export default miniprogramRoutes
