// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 事件唤醒触发规则 CRUD(2026-09-08 立)。
 *
 * 挂载前缀:/api/event-triggers(JWT 保护,所有查询强制 userId 过滤防越权)。
 *   POST   /            创建规则(repoFullName + event + action{prompt,mode?,agentId?})
 *   GET    /            列表(当前用户,createdAt desc)
 *   GET    /:id         详情(仅本人)
 *   PATCH  /:id         部分更新(本人)
 *   DELETE /:id         删除(本人)
 *
 * event 仅允许 pull_request / issues / push(与 GitHub webhook 接收器订阅子集一致)。
 * enabled 以 'true'|'false' 字符串落库(与 schema 定义一致),API 层用 boolean 交互。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { agentEventTriggers } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

const EVENT_VALUES = ['pull_request', 'issues', 'push'] as const

const uuidParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const actionSchema = z
  .object({
    prompt: z.string().min(1, '提示词不能为空').max(8000),
    mode: z.string().max(40).optional(),
    agentId: z.string().max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'action 至少包含 prompt' })

const createSchema = z.object({
  repoFullName: z.string().min(1, '仓库全名不能为空').max(255),
  event: z.enum(EVENT_VALUES),
  action: actionSchema,
  enabled: z.boolean().default(true),
})

const updateSchema = z
  .object({
    repoFullName: z.string().min(1).max(255).optional(),
    event: z.enum(EVENT_VALUES).optional(),
    action: actionSchema.optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个更新字段' })

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

function boolToEnabled(v: boolean): string {
  return v ? 'true' : 'false'
}

const eventTriggersRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request) => {
    await authenticate(request)
  })

  // 创建
  server.post('/', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const input = parsed.data

    const [row] = await db
      .insert(agentEventTriggers)
      .values({
        userId,
        repoFullName: input.repoFullName,
        event: input.event,
        action: input.action,
        enabled: boolToEnabled(input.enabled),
      })
      .returning()
    return reply.status(201).send(success(row))
  })

  // 列表(当前用户)
  server.get('/', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { limit, offset } = parsed.data

    const rows = await db
      .select()
      .from(agentEventTriggers)
      .where(eq(agentEventTriggers.userId, userId))
      .orderBy(desc(agentEventTriggers.createdAt))
      .limit(limit)
      .offset(offset)
    return reply.send(success({ items: rows, total: rows.length }))
  })

  // 详情(仅本人)
  server.get('/:id', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .select()
      .from(agentEventTriggers)
      .where(and(eq(agentEventTriggers.id, parsed.data.id), eq(agentEventTriggers.userId, userId)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '触发规则不存在'))
    return reply.send(success(row))
  })

  // 部分更新(本人)
  server.patch('/:id', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const parsedParams = uuidParamSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const input = parsed.data

    const [existing] = await db
      .select()
      .from(agentEventTriggers)
      .where(
        and(eq(agentEventTriggers.id, parsedParams.data.id), eq(agentEventTriggers.userId, userId)),
      )
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '触发规则不存在'))

    const [row] = await db
      .update(agentEventTriggers)
      .set({
        ...(input.repoFullName !== undefined ? { repoFullName: input.repoFullName } : {}),
        ...(input.event !== undefined ? { event: input.event } : {}),
        ...(input.action !== undefined ? { action: input.action } : {}),
        ...(input.enabled !== undefined ? { enabled: boolToEnabled(input.enabled) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(agentEventTriggers.id, parsedParams.data.id))
      .returning()
    return reply.send(success(row))
  })

  // 删除(本人)
  server.delete('/:id', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const deleted = await db
      .delete(agentEventTriggers)
      .where(and(eq(agentEventTriggers.id, parsed.data.id), eq(agentEventTriggers.userId, userId)))
      .returning({ id: agentEventTriggers.id })
    if (deleted.length === 0) return reply.status(404).send(error(404, '触发规则不存在'))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })
}

export default eventTriggersRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
