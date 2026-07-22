/**
 * Agent Tasks Kanban 状态流转 API + SSE 实时流。
 *
 * 端点(挂载于 /api):
 *   GET    /agents/kanban                    — 6 列 Kanban 视图
 *   GET    /agents/kanban/tasks              — 任务列表(?status= 过滤)
 *   GET    /agents/kanban/tasks/stream       — SSE 实时流
 *   GET    /agents/kanban/tasks/:id          — 单个任务
 *   POST   /agents/kanban/tasks              — 创建任务(status 默认 triage)
 *   POST   /agents/kanban/tasks/:id/transition — 状态流转
 *   DELETE /agents/kanban/tasks/:id          — 删除任务(仅 triage/done)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { EventEmitter } from 'events'
import { z } from 'zod'
import { eq, desc, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import { agentTasks } from '@ihui/database'
import { checkAuth } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../utils/response.js'
import { withAuditBoth } from '../utils/audit.js'
import type {
  KanbanTask,
  KanbanColumn,
  AgentTaskStatus,
  KanbanTransitionResponse,
  AgentSSEEvent,
} from '@ihui/types'

// ---------------------------------------------------------------------------
// SSE 事件总线(进程内广播,transition / create 触发事件)
// ---------------------------------------------------------------------------
const sseEventBus = new EventEmitter()
sseEventBus.setMaxListeners(0)

// ---------------------------------------------------------------------------
// Kanban 6 列定义
// ---------------------------------------------------------------------------
const KANBAN_COLUMNS: { status: AgentTaskStatus; titleKey: string }[] = [
  { status: 'triage', titleKey: 'agents.kanban.triage' },
  { status: 'todo', titleKey: 'agents.kanban.todo' },
  { status: 'ready', titleKey: 'agents.kanban.ready' },
  { status: 'in_progress', titleKey: 'agents.kanban.in_progress' },
  { status: 'blocked', titleKey: 'agents.kanban.blocked' },
  { status: 'done', titleKey: 'agents.kanban.done' },
]

// ---------------------------------------------------------------------------
// 合法状态流转图
// ---------------------------------------------------------------------------
const ALLOWED_TRANSITIONS: Record<AgentTaskStatus, AgentTaskStatus[]> = {
  triage: ['todo', 'blocked', 'done'],
  todo: ['ready', 'blocked', 'done'],
  ready: ['in_progress', 'blocked'],
  in_progress: ['done', 'blocked'],
  blocked: ['todo', 'ready'],
  done: [],
}

// ---------------------------------------------------------------------------
// 旧表 status 兼容映射(读取时转换 legacy → Kanban)
// ---------------------------------------------------------------------------
const LEGACY_STATUS_MAP: Record<string, AgentTaskStatus> = {
  pending: 'triage',
  running: 'in_progress',
  completed: 'done',
  failed: 'blocked',
}

// 过滤时 Kanban status → DB status 变体(含 legacy)
const STATUS_VARIANTS: Record<AgentTaskStatus, string[]> = {
  triage: ['triage', 'pending'],
  todo: ['todo'],
  ready: ['ready'],
  in_progress: ['in_progress', 'running'],
  blocked: ['blocked', 'failed'],
  done: ['done', 'completed'],
}

function mapStatus(raw: string): AgentTaskStatus {
  return LEGACY_STATUS_MAP[raw] ?? (raw as AgentTaskStatus)
}

// ---------------------------------------------------------------------------
// agent_tasks 行 → KanbanTask 映射
// ---------------------------------------------------------------------------
type AgentTaskRow = typeof agentTasks.$inferSelect

function toKanbanTask(row: AgentTaskRow): KanbanTask {
  const payload = row.payload ?? {}
  const deps = payload.dependencies
  const dependencies = Array.isArray(deps)
    ? deps.filter((d): d is string => typeof d === 'string')
    : []
  const workerId =
    typeof payload.workerId === 'string' ? payload.workerId : undefined
  return {
    id: row.id,
    agentId: row.agentId,
    name: row.name,
    description: row.description ?? undefined,
    status: mapStatus(row.status),
    priority: row.priority,
    payload: row.payload ?? {},
    result: row.result ?? undefined,
    scheduledAt: row.scheduledAt?.toISOString(),
    startedAt: row.startedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    errorMessage: row.errorMessage ?? undefined,
    dependencies,
    workerId,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// 构建 Kanban 6 列(按 priority 降序)— 供 admin 端点复用
// ---------------------------------------------------------------------------
export async function buildKanbanColumns(): Promise<KanbanColumn[]> {
  const rows = await db
    .select()
    .from(agentTasks)
    .orderBy(desc(agentTasks.priority), desc(agentTasks.createdAt))
  const tasks = rows.map(toKanbanTask)
  return KANBAN_COLUMNS.map((col) => ({
    status: col.status,
    titleKey: col.titleKey,
    tasks: tasks.filter((t) => t.status === col.status),
  }))
}

// ---------------------------------------------------------------------------
// SSE 事件广播
// ---------------------------------------------------------------------------
function broadcastSSEEvent(event: AgentSSEEvent): void {
  sseEventBus.emit('agent-sse', event)
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------
const idParamSchema = z.object({ id: z.string().uuid() })

const statusFilterSchema = z.object({
  status: z
    .enum(['triage', 'todo', 'ready', 'in_progress', 'blocked', 'done'])
    .optional(),
})

const createTaskSchema = z.object({
  agentId: z.string().uuid(),
  ruleId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.number().int().optional(),
  payload: z.record(z.unknown()).optional(),
  scheduledAt: z.coerce.date().optional(),
  dependencies: z.array(z.string()).optional(),
  workerId: z.string().optional(),
})

const transitionSchema = z.object({
  taskId: z.string().uuid(),
  toStatus: z.enum([
    'triage',
    'todo',
    'ready',
    'in_progress',
    'blocked',
    'done',
  ]),
  operatedBy: z.string().optional(),
  reason: z.string().optional(),
})

// ---------------------------------------------------------------------------
// 路由插件
// ---------------------------------------------------------------------------
export const agentsKanbanRoutes: FastifyPluginAsync = async (server) => {
  // 插件级 preHandler:所有路由要求登录(等价 requireAuth)
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // GET /agents/kanban — 6 列 Kanban 视图
  server.get('/agents/kanban', async (_request, reply) => {
    const columns = await buildKanbanColumns()
    return reply.send(success(columns))
  })

  // GET /agents/kanban/tasks — 任务列表(?status= 过滤)
  server.get('/agents/kanban/tasks', async (request, reply) => {
    const parsed = statusFilterSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const where = parsed.data.status
      ? inArray(agentTasks.status, STATUS_VARIANTS[parsed.data.status])
      : undefined
    const rows = await db
      .select()
      .from(agentTasks)
      .where(where)
      .orderBy(desc(agentTasks.priority), desc(agentTasks.createdAt))
    return reply.send(success(rows.map(toKanbanTask)))
  })

  // GET /agents/kanban/tasks/stream — SSE 实时流
  // 必须在 /:id 之前注册(Fastify radix tree 优先匹配静态路由)
  server.get('/agents/kanban/tasks/stream', async (request, reply) => {
    reply.hijack()
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')

    const listener = (event: AgentSSEEvent) => {
      try {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
      } catch {
        // 连接已断开,忽略写入错误
      }
    }

    sseEventBus.on('agent-sse', listener)
    reply.raw.write(': connected\n\n')

    // 15s 心跳防连接超时
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': keepalive\n\n')
      } catch {
        clearInterval(heartbeat)
      }
    }, 15000)

    // 客户端断开时清理 listener + heartbeat
    request.raw.on('close', () => {
      clearInterval(heartbeat)
      sseEventBus.off('agent-sse', listener)
    })
  })

  // GET /agents/kanban/tasks/:id — 单个任务详情
  server.get('/agents/kanban/tasks/:id', async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const [row] = await db.select().from(agentTasks).where(eq(agentTasks.id, id)).limit(1)
    if (!row) return reply.status(404).send(error(404, '任务不存在'))
    return reply.send(success(toKanbanTask(row)))
  })

  // POST /agents/kanban/tasks — 创建任务(status 默认 triage)
  server.post('/agents/kanban/tasks', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createTaskSchema, request.body)
    // 将 dependencies / workerId 合并进 payload
    const payload: Record<string, unknown> = { ...(body.payload ?? {}) }
    if (body.dependencies) payload.dependencies = body.dependencies
    if (body.workerId) payload.workerId = body.workerId

    const [row] = await db
      .insert(agentTasks)
      .values(
        withAuditBoth(
          {
            agentId: body.agentId,
            ruleId: body.ruleId,
            name: body.name,
            description: body.description,
            status: 'triage',
            priority: body.priority ?? 0,
            payload,
            scheduledAt: body.scheduledAt ?? null,
          },
          request.userId ?? null,
        ),
      )
      .returning()

    if (!row) return reply.status(500).send(error(500, '创建任务失败'))
    const task = toKanbanTask(row)
    broadcastSSEEvent({
      type: 'task_created',
      taskId: task.id,
      payload: task as unknown as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    })
    return reply.status(201).send(success(task))
  })

  // POST /agents/kanban/tasks/:id/transition — 状态流转
  server.post(
    '/agents/kanban/tasks/:id/transition',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const body = parseOrThrow(transitionSchema, request.body)
      const { toStatus, reason } = body

      // 查当前任务
      const [current] = await db.select().from(agentTasks).where(eq(agentTasks.id, id)).limit(1)
      if (!current) return reply.status(404).send(error(404, '任务不存在'))

      const fromStatus = mapStatus(current.status)

      // 校验流转合法性
      const isAllowed = ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)
      const response: KanbanTransitionResponse = {
        taskId: id,
        fromStatus,
        toStatus,
        transitionedAt: new Date().toISOString(),
        allowed: isAllowed,
        reason: isAllowed ? reason : `非法状态流转: ${fromStatus} → ${toStatus}`,
      }

      if (!isAllowed) {
        return reply.status(409).send(success(response))
      }

      // 合法流转 → 更新 DB
      const updateData: Record<string, unknown> = {
        status: toStatus,
        updatedAt: new Date(),
        updatedBy: request.userId ?? null,
      }
      // 状态相关的副作用时间戳
      if (toStatus === 'in_progress' && !current.startedAt) {
        updateData.startedAt = new Date()
      }
      if (toStatus === 'done') {
        updateData.completedAt = new Date()
      }
      if (toStatus === 'blocked' && reason) {
        updateData.errorMessage = reason
      }
      // 从 blocked 恢复时清除错误信息
      if (fromStatus === 'blocked' && toStatus !== 'blocked') {
        updateData.errorMessage = null
      }

      const [updated] = await db
        .update(agentTasks)
        .set(updateData)
        .where(eq(agentTasks.id, id))
        .returning()

      if (!updated) return reply.status(500).send(error(500, '状态流转失败'))
      const task = toKanbanTask(updated)
      // 广播状态变化事件
      broadcastSSEEvent({
        type: 'task_status_changed',
        taskId: id,
        payload: {
          fromStatus,
          toStatus,
          reason,
          task: task as unknown as Record<string, unknown>,
        },
        timestamp: new Date().toISOString(),
      })

      response.reason = reason
      return reply.send(success(response))
    },
  )

  // DELETE /agents/kanban/tasks/:id — 删除任务(仅 triage/done 可删)
  server.delete(
    '/agents/kanban/tasks/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const [current] = await db.select().from(agentTasks).where(eq(agentTasks.id, id)).limit(1)
      if (!current) return reply.status(404).send(error(404, '任务不存在'))

      const status = mapStatus(current.status)
      if (status !== 'triage' && status !== 'done') {
        return reply.status(409).send(error(409, `仅 triage/done 状态可删除,当前状态: ${status}`))
      }

      const [row] = await db.delete(agentTasks).where(eq(agentTasks.id, id)).returning()
      if (!row) return reply.status(404).send(error(404, '任务不存在'))
      return reply.send(success({ id, deleted: true }))
    },
  )
}
