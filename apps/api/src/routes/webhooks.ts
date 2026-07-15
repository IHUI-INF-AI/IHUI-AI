import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { webhooks, webhookEvents } from '@ihui/database'
import { requireAuth } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url('无效的 URL').max(512),
  events: z.array(z.string()).default([]),
  secret: z.string().max(255).optional(),
})

const testWebhookSchema = z.object({
  eventType: z.string().min(1).max(100).default('test.event'),
  payload: z.record(z.string(), z.unknown()).optional(),
})

// =============================================================================
// 辅助：向 webhook URL 发送测试投递
// =============================================================================

async function deliverWebhook(
  url: string,
  body: unknown,
  _secret?: string,
): Promise<{ code: number; ok: boolean; message: string }> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)
    return { code: resp.status, ok: resp.ok, message: resp.ok ? '投递成功' : `HTTP ${resp.status}` }
  } catch (e) {
    return { code: 0, ok: false, message: (e as Error).message || '投递失败' }
  }
}

// =============================================================================
// 路由
// =============================================================================

const webhooksRoutes: FastifyPluginAsync = async (server) => {
  // webhook 创建后返回 signing secret,需跳过响应脱敏
  // 防止 response-sanitizer 把 secret 字段误伤为 '***'
  server.addHook('onRequest', async (request) => {
    request.skipResponseSanitization = true
  })

  // 统一鉴权：所有 webhook 端点需登录
  server.addHook('preHandler', requireAuth)

  // GET / — 列出当前用户的 webhook
  server.get('/', async (request, reply) => {
    const userId = request.userId!
    const list = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.userId, userId))
      .orderBy(desc(webhooks.createdAt))
    return reply.send(success({ list }))
  })

  // POST / — 创建 webhook
  server.post('/', async (request, reply) => {
    const userId = request.userId!
    const parsed = createWebhookSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [webhook] = await db
      .insert(webhooks)
      .values({
        userId,
        name: parsed.data.name,
        url: parsed.data.url,
        events: parsed.data.events,
        secret: parsed.data.secret,
      })
      .returning()
    return reply.status(201).send(success({ webhook }))
  })

  // DELETE /:id — 删除 webhook
  server.delete('/:id', async (request, reply) => {
    const userId = request.userId!
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [deleted] = await db.delete(webhooks).where(eq(webhooks.id, parsed.data.id)).returning()
    if (!deleted) return reply.status(404).send(error(404, 'webhook 不存在'))
    if (deleted.userId !== userId) {
      return reply.status(403).send(error(403, '无权删除此 webhook'))
    }
    return reply.send(success({ ok: true }))
  })

  // POST /:id/test — 测试 webhook（发送测试事件并记录投递日志）
  server.post('/:id/test', async (request, reply) => {
    const userId = request.userId!
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = testWebhookSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, idParsed.data.id))
      .limit(1)
    if (!webhook) return reply.status(404).send(error(404, 'webhook 不存在'))
    if (webhook.userId !== userId) {
      return reply.status(403).send(error(403, '无权操作此 webhook'))
    }

    const payload = {
      event: parsed.data.eventType,
      data: parsed.data.payload ?? {},
      timestamp: new Date().toISOString(),
    }
    const result = await deliverWebhook(webhook.url, payload, webhook.secret ?? undefined)

    await db.insert(webhookEvents).values({
      webhookId: webhook.id,
      eventType: parsed.data.eventType,
      payload,
      status: result.ok ? 'success' : 'failed',
      responseCode: result.code,
      responseBody: result.message,
      attempts: 1,
      deliveredAt: new Date(),
    })

    return reply.send(success({ result }))
  })

  // GET /:id/logs — 事件投递日志
  server.get('/:id/logs', async (request, reply) => {
    const userId = request.userId!
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 校验归属权
    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, idParsed.data.id))
      .limit(1)
    if (!webhook) return reply.status(404).send(error(404, 'webhook 不存在'))
    if (webhook.userId !== userId) {
      return reply.status(403).send(error(403, '无权查看此 webhook'))
    }
    const list = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.webhookId, idParsed.data.id))
      .orderBy(desc(webhookEvents.createdAt))
      .limit(50)
    return reply.send(success({ list }))
  })

  // POST /:id/retry — 重试最近一次失败事件
  server.post('/:id/retry', async (request, reply) => {
    const userId = request.userId!
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, idParsed.data.id))
      .limit(1)
    if (!webhook) return reply.status(404).send(error(404, 'webhook 不存在'))
    if (webhook.userId !== userId) {
      return reply.status(403).send(error(403, '无权操作此 webhook'))
    }
    // 查找最近一次失败事件
    const [failedEvent] = await db
      .select()
      .from(webhookEvents)
      .where(and(eq(webhookEvents.webhookId, idParsed.data.id), eq(webhookEvents.status, 'failed')))
      .orderBy(desc(webhookEvents.createdAt))
      .limit(1)
    if (!failedEvent) return reply.status(404).send(error(404, '没有可重试的失败事件'))

    const result = await deliverWebhook(
      webhook.url,
      failedEvent.payload,
      webhook.secret ?? undefined,
    )
    await db
      .update(webhookEvents)
      .set({
        status: result.ok ? 'success' : 'failed',
        responseCode: result.code,
        responseBody: result.message,
        attempts: sql`${webhookEvents.attempts} + 1`,
        deliveredAt: new Date(),
      })
      .where(eq(webhookEvents.id, failedEvent.id))
    return reply.send(success({ result, eventId: failedEvent.id }))
  })
}

export default webhooksRoutes
