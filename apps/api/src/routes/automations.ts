// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 用户侧 Agent 定时自动化路由(2026-09-07 立)。
 *
 * 路由前缀由主控注册为 /api/automations(文件内写相对路径):
 *   - POST /automations            创建
 *   - GET  /automations            列表(按当前用户过滤,updatedAt desc,limit/offset)
 *   - GET  /automations/:id        详情
 *   - PATCH /automations/:id       部分更新(name/prompt/rrule/scheduledAt/status)
 *   - DELETE /automations/:id      删除
 *   - POST /automations/:id/run-now 立即执行一次(复用调度器 executeAutomation)
 *
 * 所有查询强制 where userId = req.userId 防越权。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userAutomations } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { parseNextRun, executeAutomation } from '../services/agent-automation-scheduler.js'

// =============================================================================
// Zod schemas
// =============================================================================

const uuidParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const rruleSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((v) => parseNextRun(v, new Date()) !== null, { message: 'rrule 格式不支持' })

const createSchema = z
  .object({
    name: z.string().min(1, '名称不能为空').max(200),
    prompt: z.string().min(1, '提示词不能为空').max(8000),
    scheduleType: z.enum(['once', 'recurring']),
    rrule: z.string().max(500).optional(),
    scheduledAt: z.iso.datetime({ offset: true }).optional(),
    timezone: z.string().max(64).optional(),
  })
  .refine((v) => (v.scheduleType === 'once' ? v.scheduledAt !== undefined : true), {
    message: '一次性计划必须提供 scheduledAt',
  })
  .refine((v) => (v.scheduleType === 'recurring' ? v.rrule !== undefined : true), {
    message: '重复计划必须提供 rrule',
  })

const updateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    prompt: z.string().min(1).max(8000).optional(),
    rrule: rruleSchema.optional(),
    scheduledAt: z.iso.datetime({ offset: true }).nullable().optional(),
    timezone: z.string().max(64).optional(),
    status: z.enum(['active', 'paused']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个更新字段' })

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

interface CreateInput {
  name: string
  prompt: string
  scheduleType: 'once' | 'recurring'
  rrule?: string
  scheduledAt?: string
  timezone?: string
}

/** 按计划类型计算 nextRunAt:once=scheduledAt;recurring=parseNextRun。 */
function computeNextRunAt(input: {
  scheduleType: string
  rrule?: string | null
  scheduledAt?: string | null
}): Date | null {
  if (input.scheduleType === 'once') {
    return input.scheduledAt ? new Date(input.scheduledAt) : null
  }
  if (input.rrule) return parseNextRun(input.rrule, new Date())
  return null
}

// =============================================================================
// 路由
// =============================================================================

const automationsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request) => {
    await authenticate(request)
  })

  // POST / — 创建
  server.post('/', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const input = parsed.data as CreateInput

    const nextRunAt = computeNextRunAt(input)
    if (input.scheduleType === 'recurring' && !nextRunAt) {
      return reply.status(400).send(error(400, 'rrule 无法计算出下次执行时间'))
    }

    const [row] = await db
      .insert(userAutomations)
      .values({
        userId,
        name: input.name,
        prompt: input.prompt,
        scheduleType: input.scheduleType,
        rrule: input.rrule ?? null,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        timezone: input.timezone ?? 'Asia/Shanghai',
        status: 'active',
        nextRunAt,
      })
      .returning()
    return reply.status(201).send(success(row))
  })

  // GET / — 列表(当前用户)
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
      .from(userAutomations)
      .where(eq(userAutomations.userId, userId))
      .orderBy(desc(userAutomations.updatedAt))
      .limit(limit)
      .offset(offset)
    return reply.send(success({ items: rows, total: rows.length }))
  })

  // GET /:id — 详情(仅本人)
  server.get('/:id', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .select()
      .from(userAutomations)
      .where(and(eq(userAutomations.id, parsed.data.id), eq(userAutomations.userId, userId)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '自动化不存在'))
    return reply.send(success(row))
  })

  // PATCH /:id — 部分更新(重算 nextRunAt)
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
      .from(userAutomations)
      .where(and(eq(userAutomations.id, parsedParams.data.id), eq(userAutomations.userId, userId)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '自动化不存在'))

    // 合并更新后的完整计划态再重算 nextRunAt
    const scheduleType = existing.scheduleType
    const rrule = input.rrule !== undefined ? input.rrule : existing.rrule
    const scheduledAt =
      input.scheduledAt !== undefined ? input.scheduledAt : existing.scheduledAt?.toISOString()
    let nextRunAt = computeNextRunAt({ scheduleType, rrule, scheduledAt })
    if (scheduleType === 'recurring' && input.rrule !== undefined && !nextRunAt) {
      return reply.status(400).send(error(400, 'rrule 无法计算出下次执行时间'))
    }
    // 恢复 active 且 recurring 下无有效 nextRunAt 时重算(暂停期间过期的时间已无意义)
    if (input.status === 'active' && scheduleType === 'recurring' && !nextRunAt && rrule) {
      nextRunAt = parseNextRun(rrule, new Date())
    }

    const [row] = await db
      .update(userAutomations)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.prompt !== undefined ? { prompt: input.prompt } : {}),
        ...(input.rrule !== undefined ? { rrule: input.rrule } : {}),
        ...(input.scheduledAt !== undefined
          ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null }
          : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(nextRunAt ? { nextRunAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(userAutomations.id, parsedParams.data.id))
      .returning()
    return reply.send(success(row))
  })

  // DELETE /:id — 删除(仅本人)
  server.delete('/:id', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const deleted = await db
      .delete(userAutomations)
      .where(and(eq(userAutomations.id, parsed.data.id), eq(userAutomations.userId, userId)))
      .returning({ id: userAutomations.id })
    if (deleted.length === 0) return reply.status(404).send(error(404, '自动化不存在'))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })

  // POST /:id/run-now — 立即执行一次(复用调度器执行函数)
  server.post('/:id/run-now', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .select()
      .from(userAutomations)
      .where(and(eq(userAutomations.id, parsed.data.id), eq(userAutomations.userId, userId)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '自动化不存在'))

    const summary = await executeAutomation(row, request)
    if (summary === null) {
      return reply.status(502).send(error(502, '执行失败,请查看服务端日志'))
    }
    return reply.send(success({ id: row.id, summary }))
  })
}

export default automationsRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
