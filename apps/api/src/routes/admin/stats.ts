/**
 * /api/admin/stats 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { encryptJSON, decryptJSON, isEncryptedPayload } from '../../utils/crypto.js'
import { roles, withdrawalFlows, productIdentities, statisticsSnapshots, aiModelConfig, systemConfigs } from '@ihui/database'
import { eq, ilike, desc, sql } from 'drizzle-orm'
import { paginationSchema, idParamSchema, registerCrud, fields } from './_shared.js'

import { requireAdmin } from '../../plugins/require-permission.js'
import { aiServiceFetch } from '../../utils/ai-service-fetch.js'
const statsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
// ===========================================================================
  // 7. 商城模块 — 路由已迁移至 admin-shop-routes.ts
  // ===========================================================================
  // /shop/funds/accounts, /shop/products, PATCH /shop/products/:id/status — 已迁移至 admin-shop-routes.ts
  registerCrud(server, '/shop/withdrawal-flow', withdrawalFlows, {
    searchField: withdrawalFlows.method,
    map: fields({
      userId: 'string',
      amount: 'number',
      fee: 'number',
      originalAmount: 'number',
      status: 'number',
      method: 'string',
      accountInfo: 'json',
      partnerTradeNo: 'string',
      paymentNo: 'string',
      rejectReason: 'string',
      processedAt: 'date',
    }),
  })
  // /shop/withdrawals — 已迁移至 admin-shop-routes.ts

  // ===========================================================================
  // 8. 相对路径模块 — 无表路由（空数据桩，2 个）
  // ===========================================================================
  registerCrud(server, '/products', productIdentities, {
    searchField: productIdentities.name,
    map: fields({
      name: 'string',
      code: 'string',
      type: 'string',
      value: 'string',
      description: 'string',
      status: 'string',
    }),
  })
  registerCrud(server, '/statistics', statisticsSnapshots, {
    searchField: statisticsSnapshots.type,
    hasUpdatedAt: false,
    map: fields({ type: 'string', data: 'json', createdBy: 'string' }),
  })

  // ===========================================================================
  // 8.5 AI 模型配置 — aiModelConfig 表(加密 CRUD + 测试连通,6 个端点)
  // ===========================================================================
  // apiKeyEnc 字段 AES-256-GCM 加密(与 utils/crypto.ts 一致)
  // GET 不返回 apiKeyEnc,仅返回 hasApiKey 布尔;POST/PUT 接收 body.apiKey 明文加密入库

  server.get('/ai-model-config', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const where = search ? ilike(aiModelConfig.name, `%${search}%`) : undefined
    const rows = await db
      .select({
        id: aiModelConfig.id,
        name: aiModelConfig.name,
        providerCode: aiModelConfig.providerCode,
        isBuiltin: aiModelConfig.isBuiltin,
        baseUrl: aiModelConfig.baseUrl,
        apiFormat: aiModelConfig.apiFormat,
        modelIdForTest: aiModelConfig.modelIdForTest,
        enabled: aiModelConfig.enabled,
        description: aiModelConfig.description,
        sortOrder: aiModelConfig.sortOrder,
        ownerUuid: aiModelConfig.ownerUuid,
        lastTestStatus: aiModelConfig.lastTestStatus,
        lastTestResponseMs: aiModelConfig.lastTestResponseMs,
        lastTestedAt: aiModelConfig.lastTestedAt,
        lastTestError: aiModelConfig.lastTestError,
        hasApiKey: sql<boolean>`${aiModelConfig.apiKeyEnc} IS NOT NULL`,
        createdAt: aiModelConfig.createdAt,
        updatedAt: aiModelConfig.updatedAt,
      })
      .from(aiModelConfig)
      .where(where)
      .orderBy(desc(aiModelConfig.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(aiModelConfig)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list: rows, total, page, pageSize }))
  })

  server.get('/ai-model-config/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const id = Number(p.data.id)
    const [row] = await db
      .select({
        id: aiModelConfig.id,
        name: aiModelConfig.name,
        providerCode: aiModelConfig.providerCode,
        isBuiltin: aiModelConfig.isBuiltin,
        baseUrl: aiModelConfig.baseUrl,
        apiFormat: aiModelConfig.apiFormat,
        modelIdForTest: aiModelConfig.modelIdForTest,
        enabled: aiModelConfig.enabled,
        description: aiModelConfig.description,
        sortOrder: aiModelConfig.sortOrder,
        ownerUuid: aiModelConfig.ownerUuid,
        lastTestStatus: aiModelConfig.lastTestStatus,
        lastTestResponseMs: aiModelConfig.lastTestResponseMs,
        lastTestedAt: aiModelConfig.lastTestedAt,
        lastTestError: aiModelConfig.lastTestError,
        hasApiKey: sql<boolean>`${aiModelConfig.apiKeyEnc} IS NOT NULL`,
        extraConfig: aiModelConfig.extraConfig,
        createdAt: aiModelConfig.createdAt,
        updatedAt: aiModelConfig.updatedAt,
      })
      .from(aiModelConfig)
      .where(eq(aiModelConfig.id, id))
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })

  server.post('/ai-model-config', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey : ''
    const insertData: Record<string, unknown> = {
      name: String(body.name ?? ''),
      providerCode: String(body.providerCode ?? ''),
      isBuiltin: Boolean(body.isBuiltin ?? false),
      baseUrl: String(body.baseUrl ?? ''),
      apiFormat: String(body.apiFormat ?? 'openai_chat'),
      modelIdForTest: body.modelIdForTest ? String(body.modelIdForTest) : null,
      enabled: Boolean(body.enabled ?? true),
      description: body.description ? String(body.description) : null,
      sortOrder: Number(body.sortOrder ?? 0),
      ownerUuid: body.ownerUuid ? String(body.ownerUuid) : null,
      extraConfig: body.extraConfig ? String(body.extraConfig) : null,
    }
    if (apiKey) {
      insertData.apiKeyEnc = JSON.stringify(encryptJSON(apiKey))
    }
    const [row] = await db
      .insert(aiModelConfig)
      .values(insertData as never)
      .returning({ id: aiModelConfig.id })
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success({ id: row.id, created: true }))
  })

  server.put('/ai-model-config/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const id = Number(p.data.id)
    const body = (request.body ?? {}) as Record<string, unknown>
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    for (const k of [
      'name',
      'providerCode',
      'baseUrl',
      'apiFormat',
      'modelIdForTest',
      'description',
      'ownerUuid',
      'extraConfig',
    ]) {
      if (body[k] !== undefined) updateData[k] = body[k] === null ? null : String(body[k])
    }
    for (const k of ['isBuiltin', 'enabled']) {
      if (body[k] !== undefined) updateData[k] = Boolean(body[k])
    }
    if (body.sortOrder !== undefined) updateData.sortOrder = Number(body.sortOrder)
    if (typeof body.apiKey === 'string' && body.apiKey) {
      updateData.apiKeyEnc = JSON.stringify(encryptJSON(body.apiKey))
    }
    const [row] = await db
      .update(aiModelConfig)
      .set(updateData as never)
      .where(eq(aiModelConfig.id, id))
      .returning({ id: aiModelConfig.id })
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success({ id: row.id, updated: true }))
  })

  server.delete('/ai-model-config/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const id = Number(p.data.id)
    await db.delete(aiModelConfig).where(eq(aiModelConfig.id, id))
    return reply.send(success({ id, deleted: true }))
  })

  server.post('/ai-model-config/:id/test', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const id = Number(p.data.id)
    const [row] = await db.select().from(aiModelConfig).where(eq(aiModelConfig.id, id))
    if (!row) return reply.status(404).send(error(404, '记录不存在'))

    const startTime = Date.now()
    try {
      let apiKey = ''
      if (row.apiKeyEnc) {
        try {
          const payload = JSON.parse(row.apiKeyEnc) as unknown
          apiKey = isEncryptedPayload(payload) ? String(decryptJSON(payload)) : row.apiKeyEnc
        } catch {
          apiKey = row.apiKeyEnc
        }
      }
      if (!apiKey) throw new Error('API Key 未配置或解密失败')

      const model = row.modelIdForTest || `${row.providerCode}/test`
      const response = await aiServiceFetch(request, '/api/llm/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello, this is a connectivity test. Reply with "OK".' },
          ],
          model,
        }),
        signal: AbortSignal.timeout(60_000),
      })
      const elapsed = Date.now() - startTime
      const result = (await response.json().catch(() => ({}))) as Record<string, unknown>

      if (!response.ok || result.error) {
        throw new Error(String(result.error_message || result.message || `HTTP ${response.status}`))
      }

      await db
        .update(aiModelConfig)
        .set({
          lastTestStatus: 'success',
          lastTestResponseMs: elapsed,
          lastTestedAt: new Date().toISOString(),
          lastTestError: null,
          updatedAt: new Date(),
        })
        .where(eq(aiModelConfig.id, id))

      return reply.send(
        success({
          status: 'success',
          responseMs: elapsed,
          model: result.model,
          content: typeof result.content === 'string' ? result.content.slice(0, 200) : '',
        }),
      )
    } catch (e) {
      const elapsed = Date.now() - startTime
      const errMsg = e instanceof Error ? e.message : String(e)
      await db
        .update(aiModelConfig)
        .set({
          lastTestStatus: 'failed',
          lastTestResponseMs: elapsed,
          lastTestedAt: new Date().toISOString(),
          lastTestError: errMsg,
          updatedAt: new Date(),
        })
        .where(eq(aiModelConfig.id, id))
      return reply.send(success({ status: 'failed', responseMs: elapsed, error: errMsg }))
    }
  })

  // ===========================================================================
  // 9. 补充端点 — 管理员角色/配置
  // ===========================================================================
  const roleCreateSchema = z.object({
    name: z.string().min(1).max(64),
    displayName: z.string().min(1).max(128).optional(),
    description: z.string().nullable().optional(),
    scope: z.string().max(16).optional(),
  })
  const configUpsertSchema = z.object({
    key: z.string().min(1).max(128),
    value: z.string(),
    category: z.string().max(32).optional(),
    description: z.string().nullable().optional(),
    isPublic: z.boolean().optional(),
  })

  server.get('/roles', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    try {
      const where = search ? ilike(roles.name, `%${search}%`) : undefined
      const [list, totalRows] = await Promise.all([
        db
          .select()
          .from(roles)
          .where(where)
          .orderBy(desc(roles.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(roles)
          .where(where),
      ])
      return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询角色列表失败'))
    }
  })

  server.post('/roles', async (request, reply) => {
    const b = roleCreateSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    try {
      const [row] = await db
        .insert(roles)
        .values({
          name: b.data.name,
          displayName: b.data.displayName ?? b.data.name,
          description: b.data.description ?? null,
          scope: b.data.scope ?? 'self',
        })
        .returning()
      if (!row) return reply.status(500).send(error(500, '创建角色失败'))
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建角色失败'))
    }
  })

  // 注: /logs GET/PATCH /configs 已由 system.ts adminSystemRoutes 实现;此处仅保留 PUT /configs 按 key upsert

  server.put('/configs', async (request, reply) => {
    const b = configUpsertSchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    try {
      const [existing] = await db
        .select()
        .from(systemConfigs)
        .where(eq(systemConfigs.key, b.data.key))
        .limit(1)
      if (existing) {
        const [row] = await db
          .update(systemConfigs)
          .set({
            value: b.data.value,
            description: b.data.description,
            isPublic: b.data.isPublic,
            updatedAt: new Date(),
          })
          .where(eq(systemConfigs.key, b.data.key))
          .returning()
        return reply.send(success(row))
      }
      const [row] = await db
        .insert(systemConfigs)
        .values({
          key: b.data.key,
          value: b.data.value,
          category: b.data.category ?? 'general',
          type: 'string',
          description: b.data.description,
          isPublic: b.data.isPublic ?? false,
        })
        .returning()
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新系统配置失败'))
    }
  })
}

export default statsRoutes
