/**
 * /api/admin/relay/key-pool 中转站 Key 池管理(P0-5c,2026-07-29 立)。
 *
 * 端点清单:
 * 1. GET    /admin/relay/key-pool          — Key 池列表(分页 + 筛选 provider/启用状态/搜索)
 * 1b. GET   /admin/relay/key-pool/:id      — 单个 Key 详情(apiKeyEnc 脱敏)
 * 2. POST   /admin/relay/key-pool          — 添加 Key(加密 apiKeyEnc)
 * 3. PUT    /admin/relay/key-pool/:id      — 更新(priority/weight/启用/名称)
 * 4. DELETE /admin/relay/key-pool/:id      — 删除 Key
 * 5. POST   /admin/relay/key-pool/:id/toggle — 启用/禁用切换
 * 6. POST   /admin/relay/key-pool/:id/health — 触发健康检查(真实 ping 上游 /v1/models)
 *
 * 复用 ai_relay_key_pool 表;加密用 utils/crypto.ts 的 encryptJSON。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, ilike, or, sql, type SQL } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { dbRead } from '../../db/index.js'
import { aiRelayKeyPool } from '@ihui/database'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { paginationSchema, idParamSchema } from './_shared.js'
import { encryptJSON } from '../../utils/crypto.js'
import { checkSingleKey } from '../../services/relay-health-check-service.js'

const listQuerySchema = paginationSchema.extend({
  provider: z.transform(emptyToUndefined).pipe(z.string().max(64).optional()),
  enabled: z.transform(emptyToUndefined).pipe(z.enum(['true', 'false']).optional()),
})

const createBodySchema = z.object({
  providerCode: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  apiKey: z.string().min(1),
  priority: z.number().int().optional(),
  weight: z.number().int().min(1).optional(),
  isEnabled: z.boolean().optional(),
  remark: z.string().optional(),
})

const updateBodySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  priority: z.number().int().optional(),
  weight: z.number().int().min(1).optional(),
  isEnabled: z.boolean().optional(),
  remark: z.string().nullable().optional(),
})

/** 从明文 apiKey 生成显示用前缀(保留前 4 + 后 4,中间 *** ) */
function makeKeyPrefix(key: string): string {
  if (key.length <= 8) return '***'
  return `${key.slice(0, 4)}***${key.slice(-4)}`
}

const relayKeyPoolRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /admin/relay/key-pool — Key 池列表(apiKeyEnc 脱敏) =====
  server.get('/admin/relay/key-pool', async (request, reply) => {
    const q = listQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize, search, provider, enabled } = q.data

    const conds: SQL[] = []
    if (provider) conds.push(eq(aiRelayKeyPool.providerCode, provider))
    if (enabled === 'true') conds.push(eq(aiRelayKeyPool.isEnabled, true))
    if (enabled === 'false') conds.push(eq(aiRelayKeyPool.isEnabled, false))
    const where = conds.length > 0 ? and(...conds) : undefined

    const searchCond = search
      ? or(
          ilike(aiRelayKeyPool.name, `%${search}%`),
          ilike(aiRelayKeyPool.providerCode, `%${search}%`),
          ilike(aiRelayKeyPool.keyPrefix, `%${search}%`),
        )
      : undefined
    const finalWhere = searchCond && where ? and(where, searchCond) : (where ?? searchCond)

    try {
      const [list, totalRows] = await Promise.all([
        dbRead
          .select({
            id: aiRelayKeyPool.id,
            providerCode: aiRelayKeyPool.providerCode,
            name: aiRelayKeyPool.name,
            keyPrefix: aiRelayKeyPool.keyPrefix,
            priority: aiRelayKeyPool.priority,
            weight: aiRelayKeyPool.weight,
            isEnabled: aiRelayKeyPool.isEnabled,
            healthStatus: aiRelayKeyPool.healthStatus,
            healthCheckedAt: aiRelayKeyPool.healthCheckedAt,
            lastErrorMessage: aiRelayKeyPool.lastErrorMessage,
            balanceCents: aiRelayKeyPool.balanceCents,
            remark: aiRelayKeyPool.remark,
            createdAt: aiRelayKeyPool.createdAt,
            updatedAt: aiRelayKeyPool.updatedAt,
          })
          .from(aiRelayKeyPool)
          .where(finalWhere)
          .orderBy(aiRelayKeyPool.providerCode, aiRelayKeyPool.priority, aiRelayKeyPool.createdAt)
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        dbRead
          .select({ c: sql<number>`count(*)::int` })
          .from(aiRelayKeyPool)
          .where(finalWhere),
      ])
      return reply.send(success({ list, total: totalRows[0]?.c ?? 0, page, pageSize }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 Key 池列表失败'))
    }
  })

  // ===== 1b. GET /admin/relay/key-pool/:id — 单个 Key 详情(apiKeyEnc 脱敏,不返回) =====
  server.get('/admin/relay/key-pool/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    try {
      const [row] = await dbRead
        .select({
          id: aiRelayKeyPool.id,
          providerCode: aiRelayKeyPool.providerCode,
          name: aiRelayKeyPool.name,
          keyPrefix: aiRelayKeyPool.keyPrefix,
          priority: aiRelayKeyPool.priority,
          weight: aiRelayKeyPool.weight,
          isEnabled: aiRelayKeyPool.isEnabled,
          healthStatus: aiRelayKeyPool.healthStatus,
          healthCheckedAt: aiRelayKeyPool.healthCheckedAt,
          lastErrorMessage: aiRelayKeyPool.lastErrorMessage,
          balanceCents: aiRelayKeyPool.balanceCents,
          remark: aiRelayKeyPool.remark,
          createdAt: aiRelayKeyPool.createdAt,
          updatedAt: aiRelayKeyPool.updatedAt,
        })
        .from(aiRelayKeyPool)
        .where(eq(aiRelayKeyPool.id, p.data.id))
        .limit(1)
      if (!row) return reply.status(404).send(error(404, 'Key 不存在'))
      // 脱敏:不返回 apiKeyEnc;keyPrefix 已是脱敏前缀,跳过响应脱敏避免误伤
      request.skipResponseSanitization = true
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 Key 详情失败'))
    }
  })

  // ===== 2. POST /admin/relay/key-pool — 添加 Key(加密 apiKeyEnc) =====
  server.post('/admin/relay/key-pool', async (request, reply) => {
    const parsed = createBodySchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { providerCode, name, apiKey, priority, weight, isEnabled, remark } = parsed.data

    try {
      const apiKeyEnc = JSON.stringify(encryptJSON(apiKey))
      const [row] = await db
        .insert(aiRelayKeyPool)
        .values({
          providerCode,
          name,
          apiKeyEnc,
          keyPrefix: makeKeyPrefix(apiKey),
          priority: priority ?? 0,
          weight: weight ?? 1,
          isEnabled: isEnabled ?? true,
          remark: remark ?? null,
        })
        .returning({
          id: aiRelayKeyPool.id,
          providerCode: aiRelayKeyPool.providerCode,
          name: aiRelayKeyPool.name,
          keyPrefix: aiRelayKeyPool.keyPrefix,
          priority: aiRelayKeyPool.priority,
          weight: aiRelayKeyPool.weight,
          isEnabled: aiRelayKeyPool.isEnabled,
          createdAt: aiRelayKeyPool.createdAt,
        })
      // 跳过响应脱敏,避免 keyPrefix 被误伤
      request.skipResponseSanitization = true
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '添加 Key 失败'))
    }
  })

  // ===== 3. PUT /admin/relay/key-pool/:id — 更新(不更新 apiKeyEnc) =====
  server.put('/admin/relay/key-pool/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const parsed = updateBodySchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const setData: Record<string, unknown> = { updatedAt: new Date() }
    const d = parsed.data
    if (d.name !== undefined) setData.name = d.name
    if (d.priority !== undefined) setData.priority = d.priority
    if (d.weight !== undefined) setData.weight = d.weight
    if (d.isEnabled !== undefined) setData.isEnabled = d.isEnabled
    if (d.remark !== undefined) setData.remark = d.remark

    try {
      const [updated] = await db
        .update(aiRelayKeyPool)
        .set(setData)
        .where(eq(aiRelayKeyPool.id, p.data.id))
        .returning({
          id: aiRelayKeyPool.id,
          name: aiRelayKeyPool.name,
          priority: aiRelayKeyPool.priority,
          weight: aiRelayKeyPool.weight,
          isEnabled: aiRelayKeyPool.isEnabled,
          remark: aiRelayKeyPool.remark,
          updatedAt: aiRelayKeyPool.updatedAt,
        })
      if (!updated) return reply.status(404).send(error(404, 'Key 不存在'))
      return reply.send(success(updated))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新 Key 失败'))
    }
  })

  // ===== 4. DELETE /admin/relay/key-pool/:id — 删除 Key =====
  server.delete('/admin/relay/key-pool/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    try {
      const [row] = await db
        .delete(aiRelayKeyPool)
        .where(eq(aiRelayKeyPool.id, p.data.id))
        .returning({ id: aiRelayKeyPool.id })
      if (!row) return reply.status(404).send(error(404, 'Key 不存在'))
      return reply.send(success({ id: row.id, deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除 Key 失败'))
    }
  })

  // ===== 5. POST /admin/relay/key-pool/:id/toggle — 启用/禁用切换 =====
  server.post('/admin/relay/key-pool/:id/toggle', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    try {
      const [existing] = await dbRead
        .select({ isEnabled: aiRelayKeyPool.isEnabled })
        .from(aiRelayKeyPool)
        .where(eq(aiRelayKeyPool.id, p.data.id))
        .limit(1)
      if (!existing) return reply.status(404).send(error(404, 'Key 不存在'))

      const [updated] = await db
        .update(aiRelayKeyPool)
        .set({ isEnabled: !existing.isEnabled, updatedAt: new Date() })
        .where(eq(aiRelayKeyPool.id, p.data.id))
        .returning({
          id: aiRelayKeyPool.id,
          isEnabled: aiRelayKeyPool.isEnabled,
        })
      return reply.send(success(updated))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '切换启用状态失败'))
    }
  })

  // ===== 6. POST /admin/relay/key-pool/:id/health — 触发真实健康检查 =====
  server.post('/admin/relay/key-pool/:id/health', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    try {
      // 先检查 Key 是否存在(避免 checkSingleKey 返回 'down' 与真实 key 失效混淆)
      const [existing] = await dbRead
        .select({ id: aiRelayKeyPool.id })
        .from(aiRelayKeyPool)
        .where(eq(aiRelayKeyPool.id, p.data.id))
        .limit(1)
      if (!existing) return reply.status(404).send(error(404, 'Key 不存在'))

      // 使用 relay-health-check-service 的 checkSingleKey:
      // 解密 apiKeyEnc → 按 providerCode 查 ai_model_config.base_url → fetch /v1/models(AbortController 超时 10s)
      // 状态映射:healthy=上游 200 OK,degraded=限流/超时/网络错误,down=key 失效(401/403)/解密失败
      // 服务层自动持久化 health_status + last_error_message + extra_metadata.consecutiveFailures
      const result = await checkSingleKey(p.data.id)
      return reply.send(
        success({
          id: result.keyId,
          healthStatus: result.status,
          healthCheckedAt: new Date(),
          lastErrorMessage: result.errorMessage ?? null,
          latencyMs: result.latencyMs,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '健康检查失败'))
    }
  })
}

export default relayKeyPoolRoutes
