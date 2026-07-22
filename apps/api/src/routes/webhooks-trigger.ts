/**
 * Webhook 唤醒机制路由(2026-07-22 立,深度对标并反超 OpenClaw webhook 触发)。
 *
 * 核心能力:
 * - POST /webhooks/trigger/:id  接收外部 webhook(HMAC-SHA256 签名验证 + 条件评估 + 异步触发 agent)
 * - GET  /webhooks/triggers      列出所有触发器配置
 * - POST /webhooks/triggers      创建触发器
 * - PUT  /webhooks/triggers/:id  更新触发器
 * - DELETE /webhooks/triggers/:id 删除触发器
 * - GET  /webhooks/events        列出触发事件(支持 triggerId / status 过滤)
 * - GET  /webhooks/events/:eventId 查看事件详情
 * - POST /webhooks/events/:eventId/retry 手动重试事件
 *
 * 安全:本路由不挂 authenticate 中间件(webhook 是外部系统调用,用 HMAC 签名验证身份)。
 * 触发器管理端点(/triggers/*)和事件查询端点(/events/*)同样不挂鉴权,由主 agent 在
 * server.ts 注册时决定是否套 authenticate 前缀(生产环境应对管理端点加 admin 鉴权)。
 *
 * 存储:进程内存 Map,重启失效(生产环境用 DB)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { success, error } from '../utils/response.js'
import type {
  WebhookTriggerConfig,
  WebhookTriggerEvent,
  WebhookTriggerAuditLog,
  WebhookCondition,
  CreateWebhookTriggerInput,
} from '@ihui/types'

// =============================================================================
// 内存存储(生产环境用 DB)
// =============================================================================

/** 触发器配置:triggerId → config */
const triggerStore = new Map<string, WebhookTriggerConfig>()

/** 触发事件:eventId → event */
const eventStore = new Map<string, WebhookTriggerEvent>()

/** 审计日志(生产环境写 audit_logs 表) */
const auditLogs: WebhookTriggerAuditLog[] = []

/** 默认最大重试次数 */
const DEFAULT_MAX_RETRIES = 3

// =============================================================================
// Zod schemas
// =============================================================================

const triggerIdParamSchema = z.object({
  id: z.string().min(1, '触发器 ID 不能为空'),
})

const eventIdParamSchema = z.object({
  eventId: z.string().min(1, '事件 ID 不能为空'),
})

const conditionSchema = z.object({
  field: z.string().min(1, '条件字段不能为空'),
  operator: z.enum(['eq', 'neq', 'contains', 'regex', 'exists']),
  value: z.unknown().optional(),
})

const createTriggerSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100),
  url: z.string().min(1, 'URL 不能为空').max(512),
  agentId: z.string().min(1, 'agentId 不能为空'),
  secret: z.string().min(8, '密钥至少 8 字符').max(512),
  condition: conditionSchema.optional(),
  enabled: z.boolean().default(true),
})

const updateTriggerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().min(1).max(512).optional(),
  agentId: z.string().min(1).optional(),
  secret: z.string().min(8).max(512).optional(),
  condition: conditionSchema.optional(),
  enabled: z.boolean().optional(),
})

const listEventsQuerySchema = z.object({
  triggerId: z.string().optional(),
  status: z
    .enum(['pending', 'executing', 'success', 'failed', 'retrying'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

// =============================================================================
// 辅助函数:签名验证
// =============================================================================

/**
 * HMAC-SHA256 签名验证。
 * 外部系统用 config.secret 对 raw payload 计算 hex 摘要,放在 X-Webhook-Signature 头。
 * 用 timingSafeEqual 防时序攻击。
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  const expectedBuf = Buffer.from(expected, 'utf8')
  const providedBuf = Buffer.from(signature, 'utf8')
  // 长度不一致直接返回 false(timingSafeEqual 要求同长度)
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}

// =============================================================================
// 辅助函数:条件评估
// =============================================================================

/** 按 dotted 路径取值('data.type' → payload.data.type),取不到返回 undefined */
function getValueByPath(obj: unknown, path: string): unknown {
  if (obj == null) return undefined
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/**
 * 评估 payload 是否满足触发条件。
 * - eq:严格相等
 * - neq:严格不等
 * - contains:字符串包含(双方转 string 比较)
 * - regex:正则匹配(value 为 pattern 字符串)
 * - exists:字段存在(非 undefined)
 */
function evaluateCondition(payload: unknown, condition: WebhookCondition): boolean {
  const fieldValue = getValueByPath(payload, condition.field)
  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value
    case 'neq':
      return fieldValue !== condition.value
    case 'contains':
      if (typeof fieldValue !== 'string') return false
      return fieldValue.includes(String(condition.value))
    case 'regex':
      if (typeof fieldValue !== 'string') return false
      try {
        return new RegExp(String(condition.value)).test(fieldValue)
      } catch {
        return false
      }
    case 'exists':
      return fieldValue !== undefined
    default:
      return false
  }
}

// =============================================================================
// 辅助函数:审计日志
// =============================================================================

function recordAuditLog(entry: Omit<WebhookTriggerAuditLog, 'id'>): void {
  auditLogs.push({ id: randomUUID(), ...entry })
  // 防止内存无限增长,保留最近 1000 条
  if (auditLogs.length > 1000) {
    auditLogs.splice(0, auditLogs.length - 1000)
  }
}

// =============================================================================
// 辅助函数:异步触发 agent(含指数退避重试)
// =============================================================================

/**
 * 异步触发 agent 执行。
 * 真实集成:调用 ai-service 的 POST /api/agents/:id/run 接口。
 * 此处用 setTimeout 模拟异步(生产环境用 BullMQ / 专门的队列)。
 *
 * 重试策略:指数退避 1s / 2s / 4s,最多 maxRetries 次。
 */
async function executeAgentAsync(event: WebhookTriggerEvent): Promise<void> {
  // 标记为执行中
  event.status = 'executing'
  event.executedAt = new Date().toISOString()

  try {
    // 真实集成:const resp = await fetch(`http://ai-service:8000/api/agents/${event.agentId}/run`, { ... })
    // 此处模拟调用(生产环境替换为真实 ai-service 调用)
    await simulateAgentCall(event.agentId, event.payload)

    // 成功
    event.status = 'success'
    event.completedAt = new Date().toISOString()
    event.lastError = null
  } catch (e) {
    const errMsg = (e as Error).message || '执行失败'
    event.lastError = errMsg

    if (event.attempts < event.maxRetries) {
      // 进入重试
      event.status = 'retrying'
      event.attempts += 1
      // 指数退避:1s / 2s / 4s(attempts=1→1s, 2→2s, 3→4s)
      const delayMs = Math.pow(2, event.attempts - 1) * 1000
      setTimeout(() => {
        void executeAgentAsync(event)
      }, delayMs)
    } else {
      // 重试耗尽,标记最终失败
      event.status = 'failed'
      event.completedAt = new Date().toISOString()
    }
  }
}

/**
 * 模拟 agent 调用(生产环境替换为真实 fetch ai-service)。
 * 此处 95% 概率成功,用于演示重试机制。
 */
async function simulateAgentCall(agentId: string, _payload: unknown): Promise<void> {
  // 真实集成:
  // const controller = new AbortController()
  // const timer = setTimeout(() => controller.abort(), 30000)
  // const resp = await fetch(`http://ai-service:8000/api/agents/${agentId}/run`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ payload: _payload, triggeredBy: 'webhook' }),
  //   signal: controller.signal,
  // })
  // clearTimeout(timer)
  // if (!resp.ok) throw new Error(`ai-service 返回 ${resp.status}`)

  // 模拟实现(5% 概率失败,演示重试)
  void agentId
  if (Math.random() < 0.05) {
    throw new Error('模拟执行失败(演示重试机制)')
  }
}

// =============================================================================
// 路由插件
// =============================================================================

const webhookTriggerRoutes: FastifyPluginAsync = async (server) => {
  // POST /webhooks/trigger/:id — 接收外部 webhook(核心端点)
  // 不挂 authenticate:外部系统用 HMAC 签名验证身份
  server.post('/webhooks/trigger/:id', async (request, reply) => {
    const { id } = triggerIdParamSchema.parse(request.params)

    const config = triggerStore.get(id)
    if (!config) {
      return reply.status(404).send(error(404, '触发器不存在'))
    }
    if (!config.enabled) {
      return reply.status(403).send(error(403, '触发器已禁用'))
    }

    // 获取原始 payload 字符串(签名基于原始字节,不能先 JSON.parse)
    const rawPayload =
      typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body ?? {})

    // 签名验证(X-Webhook-Signature 头,hex 格式)
    const signatureHeader =
      (request.headers['x-webhook-signature'] as string | undefined) ?? ''
    const signatureValid = verifySignature(rawPayload, signatureHeader, config.secret)

    if (!signatureValid) {
      // 签名失败 → 401,但仍记录审计日志(便于排查)
      const eventId = randomUUID()
      recordAuditLog({
        eventId,
        timestamp: new Date().toISOString(),
        triggerId: id,
        signatureValid: false,
        conditionMatched: false,
        status: 'failed',
        sourceIp: request.ip,
      })
      return reply
        .status(401)
        .send(error(401, '签名验证失败'))
    }

    // 解析 payload 用于条件评估
    let parsedPayload: unknown
    try {
      parsedPayload = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
    } catch {
      parsedPayload = request.body
    }

    // 条件评估
    const conditionMatched = config.condition
      ? evaluateCondition(parsedPayload, config.condition)
      : true

    if (!conditionMatched) {
      // 条件不匹配 → 200 + accepted=false(不触发 agent,但告知调用方已收到)
      const eventId = randomUUID()
      recordAuditLog({
        eventId,
        timestamp: new Date().toISOString(),
        triggerId: id,
        signatureValid: true,
        conditionMatched: false,
        status: 'pending',
        sourceIp: request.ip,
      })
      return reply.send(
        success({
          accepted: false,
          eventId,
          message: '条件不匹配,未触发 agent',
          asyncExecution: false,
        }),
      )
    }

    // 创建事件,状态 pending
    const eventId = randomUUID()
    const now = new Date().toISOString()
    const event: WebhookTriggerEvent = {
      id: eventId,
      triggerId: id,
      agentId: config.agentId,
      payload: parsedPayload,
      signatureValid: true,
      conditionMatched: true,
      status: 'pending',
      attempts: 0,
      maxRetries: DEFAULT_MAX_RETRIES,
      lastError: null,
      createdAt: now,
      executedAt: null,
      completedAt: null,
    }
    eventStore.set(eventId, event)

    // 记录审计日志
    recordAuditLog({
      eventId,
      timestamp: now,
      triggerId: id,
      signatureValid: true,
      conditionMatched: true,
      status: 'pending',
      sourceIp: request.ip,
    })

    // 异步触发 agent(不阻塞响应)
    event.attempts = 1
    void executeAgentAsync(event)

    // 立即返回 202 Accepted
    return reply.status(202).send(
      success({
        accepted: true,
        eventId,
        message: '已接受触发,agent 异步执行中',
        asyncExecution: true,
      }),
    )
  })

  // GET /webhooks/triggers — 列出所有触发器配置
  server.get('/webhooks/triggers', async (_request, reply) => {
    const list = Array.from(triggerStore.values())
    return reply.send(success({ list, total: list.length }))
  })

  // POST /webhooks/triggers — 创建触发器
  server.post('/webhooks/triggers', async (request, reply) => {
    const parsed = createTriggerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const input = parsed.data as CreateWebhookTriggerInput
    const id = randomUUID()
    const now = new Date().toISOString()
    const config: WebhookTriggerConfig = {
      id,
      name: input.name,
      url: input.url,
      agentId: input.agentId,
      secret: input.secret,
      condition: input.condition,
      enabled: input.enabled,
      createdAt: now,
      updatedAt: now,
    }
    triggerStore.set(id, config)
    return reply.status(201).send(success({ trigger: config }))
  })

  // PUT /webhooks/triggers/:id — 更新触发器
  server.put('/webhooks/triggers/:id', async (request, reply) => {
    const { id } = triggerIdParamSchema.parse(request.params)
    const existing = triggerStore.get(id)
    if (!existing) {
      return reply.status(404).send(error(404, '触发器不存在'))
    }

    const parsed = updateTriggerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const input = parsed.data as Partial<WebhookTriggerConfig>
    const updated: WebhookTriggerConfig = {
      ...existing,
      ...input,
      // condition 单独处理:显式传入则覆盖(支持传 undefined 清除条件)
      condition: input.condition !== undefined ? input.condition : existing.condition,
      updatedAt: new Date().toISOString(),
    }
    triggerStore.set(id, updated)
    return reply.send(success({ trigger: updated }))
  })

  // DELETE /webhooks/triggers/:id — 删除触发器
  server.delete('/webhooks/triggers/:id', async (request, reply) => {
    const { id } = triggerIdParamSchema.parse(request.params)
    if (!triggerStore.has(id)) {
      return reply.status(404).send(error(404, '触发器不存在'))
    }
    triggerStore.delete(id)
    return reply.send(success({ deleted: true }))
  })

  // GET /webhooks/events — 列出触发事件(支持 triggerId / status 过滤)
  server.get('/webhooks/events', async (request, reply) => {
    const parsed = listEventsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { triggerId, status, limit } = parsed.data

    let list = Array.from(eventStore.values())
    if (triggerId) list = list.filter((e) => e.triggerId === triggerId)
    if (status) list = list.filter((e) => e.status === status)
    // 按创建时间倒序,取前 limit 条
    list = list
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)

    return reply.send(success({ list, total: list.length }))
  })

  // GET /webhooks/events/:eventId — 查看事件详情
  server.get('/webhooks/events/:eventId', async (request, reply) => {
    const { eventId } = eventIdParamSchema.parse(request.params)
    const event = eventStore.get(eventId)
    if (!event) {
      return reply.status(404).send(error(404, '事件不存在'))
    }
    // 附带该事件的审计日志
    const logs = auditLogs.filter((l) => l.eventId === eventId)
    return reply.send(success({ event, auditLogs: logs }))
  })

  // POST /webhooks/events/:eventId/retry — 手动重试事件
  server.post('/webhooks/events/:eventId/retry', async (request, reply) => {
    const { eventId } = eventIdParamSchema.parse(request.params)
    const event = eventStore.get(eventId)
    if (!event) {
      return reply.status(404).send(error(404, '事件不存在'))
    }
    // 只允许重试失败 / 已完成但需重新触发的事件
    if (event.status === 'executing' || event.status === 'retrying') {
      return reply
        .status(409)
        .send(error(409, `事件正在执行中(状态: ${event.status}),无法重试`))
    }
    if (event.status === 'success') {
      return reply.status(409).send(error(409, '事件已成功,无需重试'))
    }

    // 重置状态,重新触发
    event.status = 'pending'
    event.lastError = null
    event.executedAt = null
    event.completedAt = null
    event.attempts = 1
    void executeAgentAsync(event)

    recordAuditLog({
      eventId,
      timestamp: new Date().toISOString(),
      triggerId: event.triggerId,
      signatureValid: true,
      conditionMatched: true,
      status: 'pending',
      sourceIp: request.ip,
    })

    return reply.send(
      success({
        eventId,
        message: '已重新触发,agent 异步执行中',
        asyncExecution: true,
      }),
    )
  })
}

export default webhookTriggerRoutes
