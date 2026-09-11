// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { z } from 'zod'
import { eq, desc, inArray, and, or, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { agentTasks, teamMembers } from '@ihui/database'
import { checkAuth } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../utils/response.js'
import { withAuditBoth } from '../utils/audit.js'
import {
  acquireWorkspaceLock,
  getWorkspaceLock,
  WORKSPACE_LOCK_TTL,
} from '../services/workspace-lock.js'
import {
  startLockHeartbeat,
  stopLockHeartbeat,
  releaseLockToken,
  releaseTaskLockByTaskId,
} from '../services/workspace-lock-heartbeat.js'
import { sseEventBus, broadcastSSEEvent } from '../services/agent-sse-bus.js'
import { ALLOWED_TRANSITIONS, STATUS_VARIANTS, mapStatus } from '../services/agent-task-status.js'
import type {
  KanbanTask,
  KanbanColumn,
  AgentTaskStatus,
  KanbanTransitionResponse,
  AgentSSEEvent,
} from '@ihui/types'

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
// agent_tasks 行 → KanbanTask 映射
// ---------------------------------------------------------------------------
type AgentTaskRow = typeof agentTasks.$inferSelect

function toKanbanTask(row: AgentTaskRow): KanbanTask {
  const payload = row.payload ?? {}
  const deps = payload.dependencies
  const dependencies = Array.isArray(deps)
    ? deps.filter((d): d is string => typeof d === 'string')
    : []
  const workerId = typeof payload.workerId === 'string' ? payload.workerId : undefined
  const workspacePath =
    row.workspacePath ??
    (typeof payload.workspacePath === 'string' ? payload.workspacePath : undefined)
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
    workspacePath,
    teamId: row.teamId ?? undefined,
    lockedBy: row.lockedBy ?? undefined,
    lockedAt: row.lockedAt?.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// 构建 Kanban 6 列(按 priority 降序)— 供 admin 端点复用
// visibleTeamIds: 传入数组时仅返回"无团队 + 这些团队"的任务(P0-4 团队过滤;
// undefined 表示不过滤,admin 全量视图用)
// ---------------------------------------------------------------------------
export async function buildKanbanColumns(visibleTeamIds?: string[]): Promise<KanbanColumn[]> {
  const conditions =
    visibleTeamIds === undefined
      ? undefined
      : or(isNull(agentTasks.teamId), inArray(agentTasks.teamId, visibleTeamIds))
  const rows = await db
    .select()
    .from(agentTasks)
    .where(conditions)
    .orderBy(desc(agentTasks.priority), desc(agentTasks.createdAt))
  const tasks = rows.map(toKanbanTask)
  return KANBAN_COLUMNS.map((col) => ({
    status: col.status,
    titleKey: col.titleKey,
    tasks: tasks.filter((t) => t.status === col.status),
  }))
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------
const idParamSchema = z.object({ id: z.uuid() })

const statusFilterSchema = z.object({
  status: z.enum(['triage', 'todo', 'ready', 'in_progress', 'blocked', 'done']).optional(),
  teamId: z.uuid().optional(),
})

const createTaskSchema = z.object({
  agentId: z.uuid(),
  ruleId: z.uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.number().int().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  scheduledAt: z.coerce
    .date()
    .refine((d) => !isNaN(d.getTime()), '无效日期')
    .optional(),
  dependencies: z.array(z.string()).max(100).optional(),
  workerId: z.string().optional(),
  workspacePath: z.string().max(512).optional(),
  teamId: z.uuid().optional(),
})

const transitionSchema = z.object({
  taskId: z.uuid(),
  toStatus: z.enum(['triage', 'todo', 'ready', 'in_progress', 'blocked', 'done']),
  operatedBy: z.string().optional(),
  reason: z.string().optional(),
})

const workspaceLockQuerySchema = z.object({
  workspace: z.string().min(1).max(512),
})

// ---------------------------------------------------------------------------
// 团队成员校验(2-2 团队任务板):admin(roleId>=1)直接放行,其余须为团队成员
// ---------------------------------------------------------------------------
const ADMIN_ROLE_ID = 1

async function isTeamMember(teamId: string, userId: string | undefined): Promise<boolean> {
  if (!userId) return false
  const [row] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1)
  return !!row
}

/**
 * 请求者可见团队集合(P0-4 团队过滤)。
 * admin(roleId>=1)返回 undefined(不过滤,全量视图);
 * 普通用户返回其所属团队 id 数组(可能为空 → 仅见无团队任务)。
 */
async function getUserVisibleTeamIds(request: FastifyRequest): Promise<string[] | undefined> {
  const roleId = request.jwtPayload?.roleId ?? 0
  if (roleId >= ADMIN_ROLE_ID) return undefined
  const userId = request.userId
  if (!userId) return []
  const rows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
  return rows.map((r) => r.teamId)
}

/** P0-4:校验请求者是否有权查看某团队的任务行 */
async function canViewTaskTeam(
  request: FastifyRequest,
  row: { teamId: string | null },
): Promise<boolean> {
  if (row.teamId === null) return true
  const roleId = request.jwtPayload?.roleId ?? 0
  if (roleId >= ADMIN_ROLE_ID) return true
  return isTeamMember(row.teamId, request.userId)
}

// ---------------------------------------------------------------------------
// 路由插件
// ---------------------------------------------------------------------------
export const agentsKanbanRoutes: FastifyPluginAsync = async (server) => {
  // 插件级 preHandler:所有路由要求登录(等价 requireAuth)
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // GET /agents/kanban — 6 列 Kanban 视图
  // P0-4:非 admin 默认仅见「无团队 + 我所在团队」的任务
  server.get('/agents/kanban', async (request, reply) => {
    const visibleTeamIds = await getUserVisibleTeamIds(request)
    const columns = await buildKanbanColumns(visibleTeamIds)
    return reply.send(success(columns))
  })

  // GET /agents/kanban/tasks — 任务列表(?status= / ?teamId= 过滤)
  server.get('/agents/kanban/tasks', async (request, reply) => {
    const parsed = statusFilterSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { status, teamId } = parsed.data
    // 团队过滤:非 admin 须为该团队成员(2-2 团队任务板)
    if (teamId) {
      const roleId = request.jwtPayload?.roleId ?? 0
      if (roleId < ADMIN_ROLE_ID && !(await isTeamMember(teamId, request.userId))) {
        return reply.status(403).send(error(403, '非团队成员,无法查看该团队任务板'))
      }
    }
    const conditions = []
    if (status) conditions.push(inArray(agentTasks.status, STATUS_VARIANTS[status]))
    if (teamId) {
      conditions.push(eq(agentTasks.teamId, teamId))
    } else {
      // P0-4:未显式指定 teamId 时,非 admin 仅见「无团队 + 我所在团队」
      const visibleTeamIds = await getUserVisibleTeamIds(request)
      if (visibleTeamIds !== undefined) {
        if (visibleTeamIds.length === 0) {
          conditions.push(isNull(agentTasks.teamId))
        } else {
          conditions.push(or(isNull(agentTasks.teamId), inArray(agentTasks.teamId, visibleTeamIds)))
        }
      }
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const rows = await db
      .select()
      .from(agentTasks)
      .where(where)
      .orderBy(desc(agentTasks.priority), desc(agentTasks.createdAt))
    return reply.send(success(rows.map(toKanbanTask)))
  })

  // GET /agents/kanban/workspace-lock — 查询工作区锁当前持有者(2-2 锁徽标)
  server.get('/agents/kanban/workspace-lock', async (request, reply) => {
    const parsed = workspaceLockQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, 'workspace 参数无效'))
    }
    const info = await getWorkspaceLock(parsed.data.workspace)
    return reply.send(
      success({
        workspace: parsed.data.workspace,
        held: info !== null,
        holder: info?.holder,
        acquiredAt: info ? new Date(info.acquiredAt * 1000).toISOString() : undefined,
        heartbeatAt: info ? new Date(info.heartbeatAt * 1000).toISOString() : undefined,
        ttl: WORKSPACE_LOCK_TTL,
      }),
    )
  })

  // GET /agents/kanban/tasks/stream — SSE 实时流
  // 必须在 /:id 之前注册(Fastify radix tree 优先匹配静态路由)
  // P0-4:非 admin 订阅者只收到「无团队 + 我所在团队」的事件(按 teamId 过滤)
  server.get('/agents/kanban/tasks/stream', async (request, reply) => {
    reply.hijack()
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')

    const visibleTeamIds = await getUserVisibleTeamIds(request)
    const teamVisible = (eventTeamId: unknown): boolean => {
      if (visibleTeamIds === undefined) return true // admin 全量
      if (typeof eventTeamId !== 'string' || eventTeamId.length === 0) return true // 无团队任务
      return visibleTeamIds.includes(eventTeamId)
    }
    // 事件 payload 里的 task 对象可能携带 teamId(transition/心跳回写均带)
    const eventTaskTeamId = (event: AgentSSEEvent): unknown => {
      const p = event.payload as Record<string, unknown> | undefined
      const direct = p?.teamId
      if (typeof direct === 'string') return direct
      const task = p?.task
      if (task && typeof task === 'object') return (task as Record<string, unknown>).teamId
      return undefined
    }

    const listener = (event: AgentSSEEvent) => {
      try {
        if (!teamVisible(eventTaskTeamId(event))) return
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
      } catch {
        // P1 修复:异常路径也要移除 listener,防止 sseEventBus listener 泄漏
        clearInterval(heartbeat)
        sseEventBus.off('agent-sse', listener)
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
  // P0-4:非 admin 查看他人团队任务 → 404(不泄露存在性)
  server.get('/agents/kanban/tasks/:id', async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const [row] = await db.select().from(agentTasks).where(eq(agentTasks.id, id)).limit(1)
    if (!row) return reply.status(404).send(error(404, '任务不存在'))
    if (!(await canViewTaskTeam(request, row))) {
      return reply.status(404).send(error(404, '任务不存在'))
    }
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
            workspacePath: body.workspacePath ?? null,
            teamId: body.teamId ?? null,
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

      // -----------------------------------------------------------------
      // 2-2 工作区锁联动:进入 in_progress 前获取锁,离开时释放
      // -----------------------------------------------------------------
      const payload = current.payload ?? {}
      const workspace =
        current.workspacePath ??
        (typeof payload.workspacePath === 'string' ? payload.workspacePath : undefined)
      let nextPayload = payload

      if (toStatus === 'in_progress' && workspace) {
        const holder = `task:${id}`
        const lockInfo = await acquireWorkspaceLock(workspace, holder)
        if (!lockInfo) {
          const held = await getWorkspaceLock(workspace)
          return reply
            .status(409)
            .send(
              error(
                409,
                `工作区 ${workspace} 已被 ${held?.holder ?? '未知持有者'} 占用,无法开始执行`,
              ),
            )
        }
        // token 存入 payload,离开 in_progress 时凭此释放
        nextPayload = { ...payload, workspaceLockToken: lockInfo.token }
        // P0-1:抢锁成功即启动心跳续期(TTL 120s / 间隔 40s),
        // 防止长任务超过 TTL 后锁静默过期被抢;离开 in_progress 时停止
        startLockHeartbeat(id, workspace, lockInfo.token)
        broadcastSSEEvent({
          type: 'workspace_lock_acquired',
          taskId: id,
          payload: { workspace, holder, task: id, teamId: current.teamId ?? undefined },
          timestamp: new Date().toISOString(),
        })
      }

      const leavingInProgress = fromStatus === 'in_progress' && toStatus !== 'in_progress'
      if (leavingInProgress && workspace) {
        const token =
          typeof payload.workspaceLockToken === 'string' ? payload.workspaceLockToken : undefined
        if (token) {
          // P0-2:统一释放原语(停心跳 + 凭 token 释放 + 广播含释放结果)
          await releaseLockToken(id, workspace, token, current.teamId)
          const { workspaceLockToken: _removed, ...rest } = payload
          nextPayload = rest
        } else {
          // 历史 payload 无 token:至少停掉可能残留的心跳定时器
          stopLockHeartbeat(id)
          broadcastSSEEvent({
            type: 'workspace_lock_released',
            taskId: id,
            payload: { workspace, task: id, teamId: current.teamId ?? undefined, released: false },
            timestamp: new Date().toISOString(),
          })
        }
      }

      // 合法流转 → 更新 DB
      const updateData: Record<string, unknown> = {
        status: toStatus,
        updatedAt: new Date(),
        updatedBy: request.userId ?? null,
      }
      if (nextPayload !== payload) {
        updateData.payload = nextPayload
      }
      // 锁审计字段:进 in_progress 记录持有者,离开时清除
      if (toStatus === 'in_progress' && workspace) {
        updateData.lockedBy = `task:${id}`
        updateData.lockedAt = new Date()
      }
      if (leavingInProgress) {
        updateData.lockedBy = null
        updateData.lockedAt = null
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

      // P0-2:删除前统一释放残留锁(停心跳 + 凭 token 释放 + 清审计字段 + 广播)。
      // dispatch 写入的终态行可能残留 lockedBy/payload token;无锁时仅停心跳,幂等。
      await releaseTaskLockByTaskId(id)

      const [row] = await db.delete(agentTasks).where(eq(agentTasks.id, id)).returning()
      if (!row) return reply.status(404).send(error(404, '任务不存在'))
      return reply.send(success({ id, deleted: true }))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
