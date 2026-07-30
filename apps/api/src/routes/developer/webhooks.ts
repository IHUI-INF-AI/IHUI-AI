/**
 * /api/developer/webhooks/subscriptions Relay Webhook 订阅自助管理(2026-08-01 立)。
 *
 * 端点清单:
 * 1. GET    /webhooks/subscriptions           — 列我的订阅
 * 2. POST   /webhooks/subscriptions           — 建订阅(url + events + balanceThresholdCents,自动生成 secret,secret 仅返回一次)
 * 3. PATCH  /webhooks/subscriptions/:id       — 改订阅(不能改 secret)
 * 4. DELETE /webhooks/subscriptions/:id       — 删订阅
 * 5. GET    /webhooks/subscriptions/:id/logs  — 查投递日志(分页)
 * 6. POST   /webhooks/subscriptions/:id/test  — 发测试事件,验证连通性
 * 7. POST   /webhooks/subscriptions/:id/redeliver/:logId — 重发某条日志
 *
 * 路径设计:用 /webhooks/subscriptions 子路径,避免与现有 /api/developer/webhooks(/)
 * 及 /api/developer/webhooks/:id 路由冲突(Fastify 静态段优先于参数段)。
 *
 * 安全:secret 仅在创建时返回一次,后续查询/更新不返回。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { createHmac } from 'node:crypto'
import { db } from '../../db/index.js'
import { webhookSubscriptions, webhookDeliveryLogs } from '@ihui/database'
import { requireAuth } from '../../plugins/require-permission.js'
import { success, error } from '../../utils/response.js'
import { generateWebhookSecret } from '../../services/webhook-relay-notifier.js'

// =============================================================================
// 常量与 Zod schemas
// =============================================================================

/** 允许订阅的事件类型 */
const ALLOWED_EVENTS = ['relay.call.completed', 'relay.call.failed', 'relay.balance.low'] as const
type AllowedEvent = (typeof ALLOWED_EVENTS)[number]

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const createSubscriptionSchema = z.object({
  url: z.string().url('无效的 URL').max(512),
  events: z.array(z.enum(ALLOWED_EVENTS)).min(1, '至少订阅一个事件').max(10),
  enabled: z.boolean().optional(),
  balanceThresholdCents: z.number().int().min(0).max(1_000_000_00).optional(),
})

const updateSubscriptionSchema = z
  .object({
    url: z.string().url('无效的 URL').max(512).optional(),
    events: z.array(z.enum(ALLOWED_EVENTS)).min(1).max(10).optional(),
    enabled: z.boolean().optional(),
    balanceThresholdCents: z.number().int().min(0).max(1_000_000_00).optional(),
  })
  .refine(
    (d) =>
      d.url !== undefined ||
      d.events !== undefined ||
      d.enabled !== undefined ||
      d.balanceThresholdCents !== undefined,
    { message: '至少填写一个字段(url / events / enabled / balanceThresholdCents)' },
  )

const testEventSchema = z.object({
  event: z.enum(ALLOWED_EVENTS).default('relay.call.completed'),
})

// =============================================================================
// 辅助:安全返回订阅(不含 secret)
// =============================================================================

/** select 字段列表(排除 secret,用于列表/详情/更新返回) */
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
// 辅助:校验订阅归属权(返回订阅或 403/404)
// =============================================================================

async function getOwnedSubscription(id: string, userId: string) {
  const [sub] = await db
    .select({
      id: webhookSubscriptions.id,
      userId: webhookSubscriptions.userId,
      url: webhookSubscriptions.url,
      secret: webhookSubscriptions.secret,
      enabled: webhookSubscriptions.enabled,
    })
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.id, id))
    .limit(1)
  if (!sub) return { error: error(404, '订阅不存在'), sub: null }
  if (sub.userId !== userId) return { error: error(403, '无权操作此订阅'), sub: null }
  return { error: null, sub }
}

// =============================================================================
// 辅助:单次投递(用于 test / redeliver,带 HMAC 签名)
// =============================================================================

async function deliverOnce(
  url: string,
  secret: string,
  body: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const signature = createHmac('sha256', secret).update(body).digest('hex')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-IHUI-Signature': `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    })
    const rawBody = await resp.text().catch(() => '')
    const truncated =
      rawBody.length > 2000 ? rawBody.slice(0, 2000) + '...[truncated]' : rawBody
    return { ok: resp.ok, status: resp.status, body: truncated }
  } catch (e) {
    return { ok: false, status: 0, body: (e as Error).message || '投递失败' }
  } finally {
    clearTimeout(timer)
  }
}

// =============================================================================
// 路由
// =============================================================================

const developerWebhooksRoutes: FastifyPluginAsync = async (server) => {
  // 创建订阅后返回 secret,需跳过响应脱敏(防止 response-sanitizer 把 secret 误伤为 '***')
  server.addHook('onRequest', async (request) => {
    request.skipResponseSanitization = true
  })

  // 统一鉴权:所有端点需登录
  server.addHook('preHandler', requireAuth)

  // ===== 1. GET /webhooks/subscriptions — 列我的订阅 =====
  server.get('/webhooks/subscriptions', async (request, reply) => {
    const userId = request.userId!
    const list = await db
      .select(safeSubscriptionFields)
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.userId, userId))
      .orderBy(desc(webhookSubscriptions.createdAt))
    return reply.send(success({ list }))
  })

  // ===== 2. POST /webhooks/subscriptions — 建订阅(secret 仅返回一次)=====
  server.post('/webhooks/subscriptions', async (request, reply) => {
    const userId = request.userId!
    const parsed = createSubscriptionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const secret = generateWebhookSecret()
    const [created] = await db
      .insert(webhookSubscriptions)
      .values({
        userId,
        url: parsed.data.url,
        events: parsed.data.events,
        secret,
        enabled: parsed.data.enabled ?? true,
        balanceThresholdCents: parsed.data.balanceThresholdCents ?? 1000,
      })
      .returning()
    // 创建时返回完整对象(含 secret),后续查询不再返回 secret
    return reply.status(201).send(success({ subscription: created }))
  })

  // ===== 3. PATCH /webhooks/subscriptions/:id — 改订阅(不能改 secret)=====
  server.patch('/webhooks/subscriptions/:id', async (request, reply) => {
    const userId = request.userId!
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateSubscriptionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { error: err, sub } = await getOwnedSubscription(idParsed.data.id, userId)
    if (err || !sub) return reply.status(err!.code).send(err)

    const setClause: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.url !== undefined) setClause.url = parsed.data.url
    if (parsed.data.events !== undefined) setClause.events = parsed.data.events
    if (parsed.data.enabled !== undefined) setClause.enabled = parsed.data.enabled
    if (parsed.data.balanceThresholdCents !== undefined)
      setClause.balanceThresholdCents = parsed.data.balanceThresholdCents

    const [updated] = await db
      .update(webhookSubscriptions)
      .set(setClause)
      .where(eq(webhookSubscriptions.id, idParsed.data.id))
      .returning(safeSubscriptionFields)
    return reply.send(success({ subscription: updated }))
  })

  // ===== 4. DELETE /webhooks/subscriptions/:id — 删订阅 =====
  server.delete('/webhooks/subscriptions/:id', async (request, reply) => {
    const userId = request.userId!
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { error: err, sub } = await getOwnedSubscription(idParsed.data.id, userId)
    if (err || !sub) return reply.status(err!.code).send(err)

    await db.delete(webhookSubscriptions).where(eq(webhookSubscriptions.id, idParsed.data.id))
    return reply.send(success({ ok: true }))
  })

  // ===== 5. GET /webhooks/subscriptions/:id/logs — 查投递日志(分页)=====
  server.get('/webhooks/subscriptions/:id/logs', async (request, reply) => {
    const userId = request.userId!
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { error: err } = await getOwnedSubscription(idParsed.data.id, userId)
    if (err) return reply.status(err.code).send(err)

    const q = paginationSchema.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = q.data
    const [list, totalRow] = await Promise.all([
      db
        .select()
        .from(webhookDeliveryLogs)
        .where(eq(webhookDeliveryLogs.subscriptionId, idParsed.data.id))
        .orderBy(desc(webhookDeliveryLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(webhookDeliveryLogs)
        .where(eq(webhookDeliveryLogs.subscriptionId, idParsed.data.id)),
    ])
    return reply.send(success({ list, total: totalRow[0]?.c ?? 0, page, pageSize }))
  })

  // ===== 6. POST /webhooks/subscriptions/:id/test — 发测试事件 =====
  server.post('/webhooks/subscriptions/:id/test', async (request, reply) => {
    const userId = request.userId!
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = testEventSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { error: err, sub } = await getOwnedSubscription(idParsed.data.id, userId)
    if (err || !sub) return reply.status(err!.code).send(err)

    const event: AllowedEvent = parsed.data.event
    const payload: Record<string, unknown> = {
      event,
      data: { test: true, message: 'IHUI Relay Webhook 连通性测试' },
      timestamp: new Date().toISOString(),
    }
    const body = JSON.stringify(payload)
    const result = await deliverOnce(sub.url, sub.secret, body)

    await db.insert(webhookDeliveryLogs).values({
      subscriptionId: sub.id,
      event,
      payload,
      responseStatus: result.status,
      responseBody: result.body,
      attempt: 1,
      status: result.ok ? 'success' : 'failed',
      nextRetryAt: null,
    })

    return reply.send(
      success({
        ok: result.ok,
        httpStatus: result.status,
        message: result.ok ? '测试投递成功' : `测试投递失败:${result.body}`,
      }),
    )
  })

  // ===== 7. POST /webhooks/subscriptions/:id/redeliver/:logId — 重发某条日志 =====
  server.post('/webhooks/subscriptions/:id/redeliver/:logId', async (request, reply) => {
    const userId = request.userId!
    const paramsSchema = z.object({
      id: z.string().uuid('无效的订阅 ID'),
      logId: z.string().uuid('无效的日志 ID'),
    })
    const parsed = paramsSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { error: err, sub } = await getOwnedSubscription(parsed.data.id, userId)
    if (err || !sub) return reply.status(err!.code).send(err)

    // 查原始日志
    const [log] = await db
      .select({
        id: webhookDeliveryLogs.id,
        event: webhookDeliveryLogs.event,
        payload: webhookDeliveryLogs.payload,
        attempt: webhookDeliveryLogs.attempt,
      })
      .from(webhookDeliveryLogs)
      .where(
        and(
          eq(webhookDeliveryLogs.id, parsed.data.logId),
          eq(webhookDeliveryLogs.subscriptionId, parsed.data.id),
        ),
      )
      .limit(1)
    if (!log) return reply.status(404).send(error(404, '投递日志不存在'))

    const body = JSON.stringify(log.payload)
    const result = await deliverOnce(sub.url, sub.secret, body)

    // redeliver 创建一条新日志(attempt=1),保留原始日志不变(审计完整)
    await db.insert(webhookDeliveryLogs).values({
      subscriptionId: sub.id,
      event: log.event,
      payload: log.payload,
      responseStatus: result.status,
      responseBody: result.body,
      attempt: 1,
      status: result.ok ? 'success' : 'retrying',
      nextRetryAt: result.ok ? null : new Date(Date.now() + 2_000),
    })

    return reply.send(
      success({
        ok: result.ok,
        httpStatus: result.status,
        message: result.ok ? '重发成功' : `重发失败(将进入重试队列):${result.body}`,
      }),
    )
  })
}

export default developerWebhooksRoutes
