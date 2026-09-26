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
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import type { Redis } from 'ioredis'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userAutomations, chatConversations } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { parseNextRun, executeAutomation } from '../services/agent-automation-scheduler.js'
import type { AutomationRepairService } from '../services/automation-repair-service.js'
import { buildRepairService } from '../services/automation-repair-service.js'

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
    /** D12:可选绑定聊天会话(执行复用该线程;须为当前用户自己的会话) */
    conversationId: z.string().uuid().nullable().optional(),
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
    /** D12:可选绑定/解绑聊天会话(null 解绑;须为当前用户自己的会话) */
    conversationId: z.string().uuid().nullable().optional(),
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
  /** D12:可选绑定聊天会话 */
  conversationId?: string | null
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
// D30 无人值守修复闭环 admin 面(2026-09-26 立,G-36)
// =============================================================================
//
// 与上面用户侧 CRUD 隔离为**独立 encapsulated 插件**,单一集中 admin 闸门
// (requireAdmin,roleId >= 1;懒加载避免把 auth/rbac/db 静态链拖进本文件加载面)。
// 路径全部显式列举,不引任何 `[^/]+` 兜底参数路由 —— 整族路由默认需要 admin,
// 新登记的 /repair/<静态段> 天然在闸门后,不存在"新增静态段被当游客详情放行"的洞。
//
// 服务未启用(IHUI_AUTOMATIONS_ENABLED !== 'true')/ 装配失败 ⇒ 一律 503 明确原因,
// 不静默退化(无人值守 = 高危面,fail-closed)。

const repairListQuerySchema = z.object({
  state: z.enum(['pending', 'claimed', 'running', 'fixed', 'failed']).optional(),
})

const repairKeyParamSchema = z.object({
  /** 任务键:issue:123 / code-scanning:45 / workflow-run:6789 */
  key: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[\w.-]+:[\w.-]+$/, '任务键形如 source:number'),
})

export interface RepairAdminRoutesOptions {
  /** 注入式服务(测试用);缺省按 env 懒装配一次并缓存 */
  service?: AutomationRepairService | null
  /** 覆盖 admin 闸门(测试注入);缺省懒加载 require-permission 的 requireAdmin */
  guard?: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
}

async function requireAdminGuardLazy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { requireAdmin } = await import('../plugins/require-permission.js')
  return requireAdmin(request, reply)
}

export const repairAdminRoutes: FastifyPluginAsync<RepairAdminRoutesOptions> = async (
  server,
  opts,
) => {
  const guard = opts.guard ?? requireAdminGuardLazy
  server.addHook('preHandler', async (request, reply) => {
    await guard(request, reply)
  })

  let cached: AutomationRepairService | null | undefined = opts.service ?? undefined
  const resolveService = async (): Promise<AutomationRepairService | null> => {
    if (cached !== undefined) return cached
    // server.redis 由 plugins/redis.ts 装饰;缺省时服务层落 fail-closed 锁(拒认领)
    const redis = (server as unknown as { redis?: Redis }).redis ?? null
    cached = await buildRepairService({ redis })
    return cached
  }

  // GET /repair/tasks — 任务列表(可按状态过滤)
  server.get('/repair/tasks', async (request, reply) => {
    const service = await resolveService()
    if (!service)
      return reply.status(503).send(error(503, '无人值守修复闭环未启用或装配失败(fail-closed)'))
    const parsed = repairListQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send(error(400, 'state 参数非法'))
    return reply.send(success({ items: service.listTasks(parsed.data.state) }))
  })

  // GET /repair/tasks/:key — 单任务详情(含迁移审计流水)
  server.get('/repair/tasks/:key', async (request, reply) => {
    const service = await resolveService()
    if (!service)
      return reply.status(503).send(error(503, '无人值守修复闭环未启用或装配失败(fail-closed)'))
    const parsed = repairKeyParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const task = service.getTask(parsed.data.key)
    if (!task) return reply.status(404).send(error(404, '修复任务不存在'))
    return reply.send(success(task))
  })

  // POST /repair/cycle — 手动触发一轮(摄入 → 认领 → 执行 → 回帖),返回逐任务报告
  server.post('/repair/cycle', async (_request, reply) => {
    const service = await resolveService()
    if (!service)
      return reply.status(503).send(error(503, '无人值守修复闭环未启用或装配失败(fail-closed)'))
    const result = await service.runCycle()
    return reply.send(success(result))
  })
}

// =============================================================================
// 路由(用户侧自动化 CRUD + D30 修复闭环 admin 面)
// =============================================================================

const automationsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request) => {
    await authenticate(request)
  })

  /** D12:校验 conversationId 归属当前用户(防跨会话上下文泄露);null/undefined 放行 */
  const assertConversationOwnership = async (
    userId: string,
    conversationId: string | null | undefined,
  ): Promise<boolean> => {
    if (conversationId === null || conversationId === undefined) return true
    const [conv] = await db
      .select({ id: chatConversations.id })
      .from(chatConversations)
      .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)))
      .limit(1)
    return conv !== undefined
  }

  // POST / — 创建
  server.post('/', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const input = parsed.data as CreateInput

    if (!(await assertConversationOwnership(userId, input.conversationId))) {
      return reply.status(400).send(error(400, '会话不存在或无权绑定'))
    }

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
        ...(input.conversationId !== undefined ? { conversationId: input.conversationId } : {}),
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

    // D12:绑定/解绑会话时校验归属
    if (!(await assertConversationOwnership(userId, input.conversationId))) {
      return reply.status(400).send(error(400, '会话不存在或无权绑定'))
    }

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
        ...(input.conversationId !== undefined ? { conversationId: input.conversationId } : {}),
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
    return reply.send(success({ id: parsed.data.id, deleted: deleted.length > 0 }))
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

  // D30 修复闭环 admin 面:作为子插件注册,继承本插件的 authenticate,
  // 再叠加集中 requireAdmin 闸门(双闸,任何一道失效另一道仍拦)。
  void server.register(repairAdminRoutes)
}

export default automationsRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
