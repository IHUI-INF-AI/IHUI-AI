// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  appId: z.transform(emptyToUndefined).pipe(z.string().max(64).optional()),
})

const updateConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['active', 'disabled']).optional(),
})

const versionsQuerySchema = z.object({
  appId: z.transform(emptyToUndefined).pipe(z.string().max(64).optional()),
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

const previewSchema = z.object({
  appId: z.string().min(1).max(64),
  version: z.string().min(1).max(32),
  versionDesc: z.string().max(500).optional(),
})

// G-962 #86/#87/#88: 根 CRUD(消费方 packages/api-client business.ts createMiniprogram/updateMiniprogram/deleteMiniprogram)
const createMiniprogramSchema = z.object({
  appId: z.string().min(1).max(64),
  name: z.string().min(1).max(100).optional(),
  type: z.string().max(32).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['active', 'disabled']).optional(),
})

const updateMiniprogramSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.string().max(32).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['active', 'disabled']).optional(),
})

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

// =============================================================================
// 路由
// =============================================================================

const miniprogramRoutes: FastifyPluginAsync = async (server) => {
  // POST / — 创建小程序配置(G-962 #86: 消费方 business.ts createMiniprogram,admin)
  server.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = createMiniprogramSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select({ id: miniprogramConfigs.id })
      .from(miniprogramConfigs)
      .where(eq(miniprogramConfigs.appId, parsed.data.appId))
      .limit(1)
    if (existing) return reply.status(409).send(error(409, '该 appId 已存在'))
    const [created] = await db
      .insert(miniprogramConfigs)
      .values({
        appId: parsed.data.appId,
        name: parsed.data.name ?? parsed.data.appId,
        type: parsed.data.type ?? 'wechat',
        config: parsed.data.config ?? {},
        status: parsed.data.status ?? 'active',
      })
      .returning()
    return reply.status(201).send(success(created))
  })

  // PUT /:id — 更新小程序配置(G-962 #87: 消费方 business.ts updateMiniprogram,admin)
  server.put('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateMiniprogramSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select({ id: miniprogramConfigs.id })
      .from(miniprogramConfigs)
      .where(eq(miniprogramConfigs.id, idParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '小程序配置不存在'))
    const [updated] = await db
      .update(miniprogramConfigs)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(miniprogramConfigs.id, idParsed.data.id))
      .returning()
    return reply.send(success(updated))
  })

  // DELETE /:id — 删除小程序配置(G-962 #88: 消费方 business.ts deleteMiniprogram,admin)
  server.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const removed = await db
      .delete(miniprogramConfigs)
      .where(eq(miniprogramConfigs.id, idParsed.data.id))
      .returning({ id: miniprogramConfigs.id })
    if (removed.length === 0) return reply.status(404).send(error(404, '小程序配置不存在'))
    return reply.send(success({ success: true }))
  })

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
      const changed = Object.fromEntries(
        Object.entries(parsed.data).filter(([key, value]) => {
          if (value === undefined) return false
          const current = (existing as unknown as Record<string, unknown>)[key]
          // config 是 JSONB,按引用比永远"变了" ⇒ 对象档按键序无关的序列化值比
          return typeof value === 'object'
            ? JSON.stringify(current) !== JSON.stringify(value)
            : current !== value
        }),
      )
      if (Object.keys(changed).length === 0) return reply.send(success({ config: existing }))
      const [updated] = await db
        .update(miniprogramConfigs)
        .set({ ...changed, updatedAt: new Date() })
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
