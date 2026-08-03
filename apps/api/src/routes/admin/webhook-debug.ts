/**
 * /api/admin/webhook-debug Relay Webhook 调试面板(2026-08-01 立)。
 *
 * 端点清单:
 * 1. GET  /webhook-debug/subscriptions — 全平台订阅列表(支持按 userId 筛选,分页)
 * 2. GET  /webhook-debug/logs          — 全平台投递日志(支持按 status 筛选,分页)
 * 3. POST /webhook-debug/retry-all     — 批量重试所有 retrying 状态日志
 * 4. GET  /webhook-debug/stats         — 统计(今日投递数/成功率/平均尝试次数)
 *
 * admin 调试用,不返回订阅 secret(敏感信息,与 developer 端一致脱敏)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql, and, gte } from 'drizzle-orm'
import { db, dbRead } from '../../db/index.js'
import { webhookSubscriptions, webhookDeliveryLogs } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { paginationSchema } from './_shared.js'
import { retryPendingWebhooks } from '../../services/webhook-relay-notifier.js'

// =============================================================================
// Zod schemas
// =============================================================================

const subscriptionsQuerySchema = paginationSchema.extend({
  /** 按用户筛选 */
  userId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  /** 按启用状态筛选 */
  enabled: z.preprocess(emptyToUndefined, z.enum(['true', 'false']).optional()),
})

const logsQuerySchema = paginationSchema.extend({
  /** 按状态筛选:pending/success/failed/retrying */
  status: z.preprocess(
    emptyToUndefined,
    z.enum(['pending', 'success', 'failed', 'retrying']).optional(),
  ),
  /** 按订阅筛选 */
  subscriptionId: z.preprocess(emptyToUndefined, z.uuid().optional()),
})

/** select 字段列表(排除 secret) */
const safeSubscriptionFields = {
  id: webhookSubscriptions.id,
  userId: webhookSubscriptions.userId,
  url: webhookSubscriptions.url,
  events: webhookSubscriptions.events,
  enabled: webhookSubscriptions.enabled,
  balanceThresholdCents: webhookSubscriptions.balanceThresholdCents,
  createdAt: webhookSubscriptions.createdAt,
  updatedAt: webhookSubscriptions.updatedAt,
} as const

// =============================================================================
// 路由
// =============================================================================

const adminWebhookDebugRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /webhook-debug/subscriptions — 全平台订阅列表 =====
  server.get('/webhook-debug/subscriptions', async (request, reply) => {
    const q = subscriptionsQuerySchema.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, userId, enabled } = q.data

    const conditions = []
    if (userId) conditions.push(eq(webhookSubscriptions.userId, userId))
    if (enabled === 'true') conditions.push(eq(webhookSubscriptions.enabled, true))
    if (enabled === 'false') conditions.push(eq(webhookSubscriptions.enabled, false))
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [list, totalRow] = await Promise.all([
      dbRead
        .select(safeSubscriptionFields)
        .from(webhookSubscriptions)
        .where(where)
        .orderBy(desc(webhookSubscriptions.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      dbRead
        .select({ c: sql<number>`count(*)::int` })
        .from(webhookSubscriptions)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRow[0]?.c ?? 0, page, pageSize }))
  })

  // ===== 2. GET /webhook-debug/logs — 全平台投递日志 =====
  server.get('/webhook-debug/logs', async (request, reply) => {
    const q = logsQuerySchema.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, status, subscriptionId } = q.data

    const conditions = []
    if (status) conditions.push(eq(webhookDeliveryLogs.status, status))
    if (subscriptionId) conditions.push(eq(webhookDeliveryLogs.subscriptionId, subscriptionId))
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [list, totalRow] = await Promise.all([
      dbRead
        .select()
        .from(webhookDeliveryLogs)
        .where(where)
        .orderBy(desc(webhookDeliveryLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      dbRead
        .select({ c: sql<number>`count(*)::int` })
        .from(webhookDeliveryLogs)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRow[0]?.c ?? 0, page, pageSize }))
  })

  // ===== 3. POST /webhook-debug/retry-all — 批量重试所有 retrying 状态 =====
  server.post('/webhook-debug/retry-all', async (_request, reply) => {
    // 把所有 retrying 状态的 nextRetryAt 设为 now,触发立即重试
    await db
      .update(webhookDeliveryLogs)
      .set({ nextRetryAt: new Date() })
      .where(eq(webhookDeliveryLogs.status, 'retrying'))

    // 调用 service 处理(它会查 nextRetryAt <= now 的重发)
    const processed = await retryPendingWebhooks()

    return reply.send(
      success({
        processed,
        message: `已触发 ${processed} 条待重试日志的重新投递`,
      }),
    )
  })

  // ===== 4. GET /webhook-debug/stats — 统计(今日投递数/成功率/平均尝试次数)=====
  server.get('/webhook-debug/stats', async (_request, reply) => {
    // 今日 00:00:00(本地时区,转 ISO 传给 PG)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [statsRow] = await dbRead
      .select({
        todayTotal: sql<number>`count(*)::int`,
        todaySuccess: sql<number>`count(*) FILTER (WHERE status = 'success')::int`,
        todayFailed: sql<number>`count(*) FILTER (WHERE status = 'failed')::int`,
        todayRetrying: sql<number>`count(*) FILTER (WHERE status = 'retrying')::int`,
        avgAttempts: sql<number>`COALESCE(round(avg(attempt)::numeric, 2), 0)::float`,
      })
      .from(webhookDeliveryLogs)
      .where(gte(webhookDeliveryLogs.createdAt, todayStart))

    const todayTotal = statsRow?.todayTotal ?? 0
    const todaySuccess = statsRow?.todaySuccess ?? 0
    const successRate = todayTotal > 0 ? Math.round((todaySuccess / todayTotal) * 10000) / 100 : 0

    // 全平台订阅总数 + 启用数
    const [subStatsRow] = await dbRead
      .select({
        totalSubs: sql<number>`count(*)::int`,
        enabledSubs: sql<number>`count(*) FILTER (WHERE enabled = true)::int`,
      })
      .from(webhookSubscriptions)

    return reply.send(
      success({
        today: {
          totalDeliveries: todayTotal,
          successCount: todaySuccess,
          failedCount: statsRow?.todayFailed ?? 0,
          retryingCount: statsRow?.todayRetrying ?? 0,
          /** 成功率(百分比,保留 2 位小数,如 95.5) */
          successRate,
          /** 平均尝试次数(含首次,1.0=全部一次成功,2.5=平均重试 1.5 次) */
          avgAttempts: statsRow?.avgAttempts ?? 0,
        },
        subscriptions: {
          total: subStatsRow?.totalSubs ?? 0,
          enabled: subStatsRow?.enabledSubs ?? 0,
        },
      }),
    )
  })
}

export default adminWebhookDebugRoutes
