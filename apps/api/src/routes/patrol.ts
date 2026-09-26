// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主动巡逻 Agent 路由(2026-09-17 立,P3 #40)。
 *
 * 路由前缀由主控注册为 /api/patrol(文件内写相对路径):
 *   - POST /patrol             创建巡检任务
 *   - GET  /patrol             列表(按当前用户过滤,updatedAt desc,limit/offset)
 *   - GET  /patrol/:id         详情
 *   - PATCH /patrol/:id        部分更新(name/patrolType/target/prompt/rrule/status)
 *   - DELETE /patrol/:id       删除(cascade 删巡检历史)
 *   - POST /patrol/:id/run-now 立即巡检一次(复用调度器 executePatrol)
 *   - GET  /patrol/:id/runs    巡检历史(status/summary/conversationId,倒序)
 *
 * 所有查询强制 where userId = req.userId 防越权。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { patrolRuns, patrolTasks } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { parseNextRun } from '../services/agent-automation-scheduler.js'
import { executePatrol } from '../services/patrol-scheduler.js'

// =============================================================================
// Zod schemas
// =============================================================================

const uuidParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const PATROL_TYPES = ['ci', 'dependency', 'log', 'deadlink', 'workspace', 'custom'] as const

const rruleSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((v) => parseNextRun(v, new Date()) !== null, { message: 'rrule 格式不支持' })

const createSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(200),
  patrolType: z.enum(PATROL_TYPES).default('custom'),
  target: z.string().max(2000).optional(),
  prompt: z.string().max(8000).optional(),
  rrule: rruleSchema,
  timezone: z.string().max(64).optional(),
})

const updateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    patrolType: z.enum(PATROL_TYPES).optional(),
    target: z.string().max(2000).nullable().optional(),
    prompt: z.string().max(8000).nullable().optional(),
    rrule: rruleSchema.optional(),
    timezone: z.string().max(64).optional(),
    status: z.enum(['active', 'paused']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个更新字段' })

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const runsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// =============================================================================
// 路由
// =============================================================================

const patrolRoutes: FastifyPluginAsync = async (server) => {
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
    const input = parsed.data

    const nextRunAt = parseNextRun(input.rrule, new Date())
    if (!nextRunAt) {
      return reply.status(400).send(error(400, 'rrule 无法计算出下次执行时间'))
    }

    const [row] = await db
      .insert(patrolTasks)
      .values({
        userId,
        name: input.name,
        patrolType: input.patrolType,
        target: input.target ?? null,
        prompt: input.prompt ?? null,
        rrule: input.rrule,
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
      .from(patrolTasks)
      .where(eq(patrolTasks.userId, userId))
      .orderBy(desc(patrolTasks.updatedAt))
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
      .from(patrolTasks)
      .where(and(eq(patrolTasks.id, parsed.data.id), eq(patrolTasks.userId, userId)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '巡检任务不存在'))
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
      .from(patrolTasks)
      .where(and(eq(patrolTasks.id, parsedParams.data.id), eq(patrolTasks.userId, userId)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '巡检任务不存在'))

    const rrule = input.rrule !== undefined ? input.rrule : existing.rrule
    const nextRunAt = rrule ? parseNextRun(rrule, new Date()) : null
    // 恢复 active 时重算(暂停期间过期的时间已无意义);解析失败保持 400
    if (input.status === 'active' && rrule && !nextRunAt) {
      return reply.status(400).send(error(400, 'rrule 无法计算出下次执行时间'))
    }

    const [row] = await db
      .update(patrolTasks)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.patrolType !== undefined ? { patrolType: input.patrolType } : {}),
        ...(input.target !== undefined ? { target: input.target } : {}),
        ...(input.prompt !== undefined ? { prompt: input.prompt } : {}),
        ...(input.rrule !== undefined ? { rrule: input.rrule } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(nextRunAt ? { nextRunAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(patrolTasks.id, parsedParams.data.id))
      .returning()
    return reply.send(success(row))
  })

  // DELETE /:id — 删除(仅本人,patrol_runs cascade)
  server.delete('/:id', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const deleted = await db
      .delete(patrolTasks)
      .where(and(eq(patrolTasks.id, parsed.data.id), eq(patrolTasks.userId, userId)))
      .returning({ id: patrolTasks.id })
    if (deleted.length === 0) return reply.status(404).send(error(404, '巡检任务不存在'))
    return reply.send(success({ id: parsed.data.id, deleted: deleted.length > 0 }))
  })

  // POST /:id/run-now — 立即巡检一次(复用调度器执行函数)
  server.post('/:id/run-now', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .select()
      .from(patrolTasks)
      .where(and(eq(patrolTasks.id, parsed.data.id), eq(patrolTasks.userId, userId)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '巡检任务不存在'))

    const result = await executePatrol(row, request)
    if (result === null) {
      return reply.status(502).send(error(502, '巡检执行失败,请查看服务端日志'))
    }
    return reply.send(success({ id: row.id, ...result }))
  })

  // GET /:id/runs — 巡检历史(仅本人,倒序)
  server.get('/:id/runs', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const parsedParams = uuidParamSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'))
    }
    const parsedQuery = runsQuerySchema.safeParse(request.query)
    if (!parsedQuery.success) {
      return reply.status(400).send(error(400, parsedQuery.error.issues[0]?.message ?? '参数错误'))
    }

    const [task] = await db
      .select({ id: patrolTasks.id })
      .from(patrolTasks)
      .where(and(eq(patrolTasks.id, parsedParams.data.id), eq(patrolTasks.userId, userId)))
      .limit(1)
    if (!task) return reply.status(404).send(error(404, '巡检任务不存在'))

    const rows = await db
      .select()
      .from(patrolRuns)
      .where(eq(patrolRuns.taskId, task.id))
      .orderBy(desc(patrolRuns.createdAt))
      .limit(parsedQuery.data.limit)
    return reply.send(success({ items: rows }))
  })
}

export default patrolRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
