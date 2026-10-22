// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/relay/accounts 第三方 AI IDE 账号池管理(2026-10-22 立,对标码道网关)。
 *
 * 端点清单:
 * 1. POST   /admin/relay/accounts/import   — 批量导入(直接吃账号导出 JSON:{accounts:[...]})
 * 2. GET    /admin/relay/accounts          — 号池列表(凭证字段一律不出库面,分页 + 筛选)
 * 3. GET    /admin/relay/accounts/:id      — 单账号详情(脱敏)
 * 4. PUT    /admin/relay/accounts/:id      — 更新调度参数(名称/优先级/权重/代理/临时摘除)
 * 5. POST   /admin/relay/accounts/:id/toggle — 启用/禁用切换
 * 6. POST   /admin/relay/accounts/:id/health — 触发健康检查(走平台适配器真实探测)
 * 7. DELETE /admin/relay/accounts/:id      — 删除账号
 *
 * 加密:token/refreshToken/cookies 走 encryptField(AES-256-GCM),响应面永不回传密文/明文。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, ilike, or, sql, type SQL } from 'drizzle-orm'
import { db, dbRead } from '../../db/index.js'
import { aiRelayAccountPool } from '@ihui/database'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { paginationSchema, idParamSchema } from './_shared.js'
import {
  importAccounts,
  isRelayProviderCode,
  RELAY_PROVIDERS,
  decryptAccountCredentials,
  type ImportAccountInput,
} from '../../services/relay-account-pool-service.js'
import { getRelayAdapter } from '../../services/relay-upstream-adapters.js'

const importBodySchema = z.object({
  providerCode: z.enum(RELAY_PROVIDERS),
  accounts: z
    .array(
      z
        .object({
          name: z.string().max(128).optional(),
          token: z.string().min(1),
          refreshToken: z.string().optional(),
          deviceId: z.string().max(128).optional(),
          machineId: z.string().max(128).optional(),
          enabled: z.boolean().optional(),
          cookies: z.array(z.unknown()).optional(),
          proxyUrl: z.string().max(512).optional(),
        })
        .passthrough(),
    )
    .min(1)
    .max(500),
})

const listQuerySchema = paginationSchema.extend({
  provider: z.transform(emptyToUndefined).pipe(z.enum(RELAY_PROVIDERS).optional()),
  enabled: z.transform(emptyToUndefined).pipe(z.enum(['true', 'false']).optional()),
  health: z
    .transform(emptyToUndefined)
    .pipe(z.enum(['unknown', 'healthy', 'degraded', 'down']).optional()),
})

const updateBodySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  priority: z.number().int().optional(),
  weight: z.number().int().min(1).optional(),
  tempUnschedulable: z.boolean().optional(),
  proxyUrl: z.string().max(512).nullable().optional(),
})

/** 列表/详情统一脱敏投影(绝不 SELECT *Enc 字段) */
const safeProjection = {
  id: aiRelayAccountPool.id,
  providerCode: aiRelayAccountPool.providerCode,
  uid: aiRelayAccountPool.uid,
  name: aiRelayAccountPool.name,
  deviceId: aiRelayAccountPool.deviceId,
  machineId: aiRelayAccountPool.machineId,
  tokenExpiresAt: aiRelayAccountPool.tokenExpiresAt,
  refreshExpiresAt: aiRelayAccountPool.refreshExpiresAt,
  priority: aiRelayAccountPool.priority,
  weight: aiRelayAccountPool.weight,
  isEnabled: aiRelayAccountPool.isEnabled,
  tempUnschedulable: aiRelayAccountPool.tempUnschedulable,
  healthStatus: aiRelayAccountPool.healthStatus,
  healthCheckedAt: aiRelayAccountPool.healthCheckedAt,
  lastErrorMessage: aiRelayAccountPool.lastErrorMessage,
  lastUsedAt: aiRelayAccountPool.lastUsedAt,
  lastRefreshAt: aiRelayAccountPool.lastRefreshAt,
  refreshFailureCount: aiRelayAccountPool.refreshFailureCount,
  consecutiveFailures: aiRelayAccountPool.consecutiveFailures,
  hasProxy:
    sql<boolean>`case when ${aiRelayAccountPool.proxyUrl} is null then false else true end`.as(
      'has_proxy',
    ),
  totalCalls: aiRelayAccountPool.totalCalls,
  extraMetadata: aiRelayAccountPool.extraMetadata,
  createdAt: aiRelayAccountPool.createdAt,
  updatedAt: aiRelayAccountPool.updatedAt,
}

const relayAccountPoolRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. POST /admin/relay/accounts/import — 批量导入 =====
  server.post('/admin/relay/accounts/import', async (request, reply) => {
    const parsed = importBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(
          error(
            400,
            parsed.error.issues[0]?.message ?? '导入参数错误(需 providerCode + accounts[])',
          ),
        )
    }
    const { providerCode, accounts } = parsed.data
    if (!isRelayProviderCode(providerCode)) {
      return reply.status(400).send(error(400, `不支持的平台: ${providerCode}`))
    }
    try {
      const result = await importAccounts(providerCode, accounts as ImportAccountInput[])
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '批量导入失败'))
    }
  })

  // ===== 2. GET /admin/relay/accounts — 列表 =====
  server.get('/admin/relay/accounts', async (request, reply) => {
    const q = listQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize, search, provider, enabled, health } = q.data

    const conds: SQL[] = []
    if (provider) conds.push(eq(aiRelayAccountPool.providerCode, provider))
    if (enabled === 'true') conds.push(eq(aiRelayAccountPool.isEnabled, true))
    if (enabled === 'false') conds.push(eq(aiRelayAccountPool.isEnabled, false))
    if (health) conds.push(eq(aiRelayAccountPool.healthStatus, health))
    const where = conds.length > 0 ? and(...conds) : undefined

    const searchCond = search
      ? or(
          ilike(aiRelayAccountPool.name, `%${search}%`),
          ilike(aiRelayAccountPool.uid, `%${search}%`),
          ilike(aiRelayAccountPool.providerCode, `%${search}%`),
        )
      : undefined
    const finalWhere = searchCond && where ? and(where, searchCond) : (where ?? searchCond)

    try {
      const [list, totalRows] = await Promise.all([
        dbRead
          .select(safeProjection)
          .from(aiRelayAccountPool)
          .where(finalWhere)
          .orderBy(
            aiRelayAccountPool.providerCode,
            aiRelayAccountPool.priority,
            aiRelayAccountPool.createdAt,
          )
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        dbRead
          .select({ c: sql<number>`count(*)::int` })
          .from(aiRelayAccountPool)
          .where(finalWhere),
      ])
      return reply.send(success({ list, total: totalRows[0]?.c ?? 0, page, pageSize }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询账号池列表失败'))
    }
  })

  // ===== 3. GET /admin/relay/accounts/:id — 详情 =====
  server.get('/admin/relay/accounts/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    try {
      const [row] = await dbRead
        .select(safeProjection)
        .from(aiRelayAccountPool)
        .where(eq(aiRelayAccountPool.id, p.data.id))
        .limit(1)
      if (!row) return reply.status(404).send(error(404, '账号不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询账号详情失败'))
    }
  })

  // ===== 4. PUT /admin/relay/accounts/:id — 更新调度参数 =====
  server.put('/admin/relay/accounts/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    const b = updateBodySchema.safeParse(request.body)
    if (!b.success)
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数错误'))
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    for (const k of ['name', 'priority', 'weight', 'tempUnschedulable', 'proxyUrl'] as const) {
      if (b.data[k] !== undefined) patch[k] = b.data[k]
    }
    try {
      const updated = await db
        .update(aiRelayAccountPool)
        .set(patch)
        .where(eq(aiRelayAccountPool.id, p.data.id))
        .returning({ id: aiRelayAccountPool.id })
      if (updated.length === 0) return reply.status(404).send(error(404, '账号不存在'))
      return reply.send(success({ id: updated[0] ? updated[0].id : p.data.id }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新账号失败'))
    }
  })

  // ===== 5. POST /admin/relay/accounts/:id/toggle — 启用/禁用 =====
  server.post('/admin/relay/accounts/:id/toggle', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    try {
      const [row] = await dbRead
        .select({ isEnabled: aiRelayAccountPool.isEnabled })
        .from(aiRelayAccountPool)
        .where(eq(aiRelayAccountPool.id, p.data.id))
        .limit(1)
      if (!row) return reply.status(404).send(error(404, '账号不存在'))
      const next = !row.isEnabled
      await db
        .update(aiRelayAccountPool)
        .set({ isEnabled: next, updatedAt: new Date() })
        .where(eq(aiRelayAccountPool.id, p.data.id))
      return reply.send(success({ id: p.data.id, isEnabled: next }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '切换启用状态失败'))
    }
  })

  // ===== 6. POST /admin/relay/accounts/:id/health — 触发健康检查 =====
  server.post('/admin/relay/accounts/:id/health', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    try {
      const [row] = await dbRead
        .select()
        .from(aiRelayAccountPool)
        .where(eq(aiRelayAccountPool.id, p.data.id))
        .limit(1)
      if (!row) return reply.status(404).send(error(404, '账号不存在'))
      const adapter = getRelayAdapter(row.providerCode)
      if (!adapter) {
        return reply
          .status(400)
          .send(error(400, `平台 ${row.providerCode} 适配器未注册,无法健康检查`))
      }
      const ctx = { row, credentials: decryptAccountCredentials(row) }
      const outcome = await adapter.checkHealth(ctx, { proxyUrl: row.proxyUrl })
      const now = new Date()
      await db
        .update(aiRelayAccountPool)
        .set({
          healthStatus: outcome.ok ? 'healthy' : 'down',
          healthCheckedAt: now,
          lastErrorMessage: outcome.ok ? null : (outcome.error ?? '健康检查失败').slice(0, 500),
          consecutiveFailures: outcome.ok ? 0 : row.consecutiveFailures,
          updatedAt: now,
        })
        .where(eq(aiRelayAccountPool.id, row.id))
      return reply.send(success({ id: row.id, ok: outcome.ok, error: outcome.error ?? null }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '健康检查失败'))
    }
  })

  // ===== 7. DELETE /admin/relay/accounts/:id =====
  server.delete('/admin/relay/accounts/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    try {
      const deleted = await db
        .delete(aiRelayAccountPool)
        .where(eq(aiRelayAccountPool.id, p.data.id))
        .returning({ id: aiRelayAccountPool.id })
      if (deleted.length === 0) return reply.status(404).send(error(404, '账号不存在'))
      return reply.send(success({ id: deleted[0] ? deleted[0].id : p.data.id }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除账号失败'))
    }
  })
}

export default relayAccountPoolRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
