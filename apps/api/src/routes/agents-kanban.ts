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
import {
  STATUS_VARIANTS,
  mapStatus,
  isTransitionAllowedFromRaw,
  terminationOf,
  countUnrecognizedTasks,
  statusOrUnrecognized,
} from '../services/agent-task-status.js'
// G-462(2026-10-07):列定义与两处 z.enum 的成员清单改为从单一真相源**派生** ——
// 这里曾各抄一份六档字面量,拆分终态档时必须三处同笔,漏一处就是"接口收新档、看板没列"的分叉。
import { AGENT_TASK_STATUSES } from '@ihui/types'
import type {
  KanbanTask,
  KanbanColumn,
  AgentTaskStatus,
  KanbanTransitionResponse,
  AgentSSEEvent,
} from '@ihui/types'

// ---------------------------------------------------------------------------
// Kanban 列定义(列序与成员 = AGENT_TASK_STATUSES,派生不抄)
// ---------------------------------------------------------------------------
const KANBAN_COLUMNS: { status: AgentTaskStatus; titleKey: string }[] = AGENT_TASK_STATUSES.map(
  (status) => ({ status, titleKey: `agents.kanban.${status}` }),
)

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
  // 未识别档归一(唯一出口在 @ihui/types):原始值落在六档之外时挂一个可选的 rawStatus 供报数。
  // 刻意**不动 status**:它继续是 mapStatus 的结果(legacy 归一、未知值原样透传),既有断言逐字不变。
  const normalizedStatus = statusOrUnrecognized(row.status)
  return {
    id: row.id,
    agentId: row.agentId,
    name: row.name,
    description: row.description ?? undefined,
    status: mapStatus(row.status),
    // 次级标记:被折叠进 blocked 的终态成因(取消 / 配额超限 / 被抢占)。
    // 刻意**新增可选字段**而不是拆第七档状态 —— 后者要同时动落库列 / REST 枚举 / SSE 载荷 /
    // Python 调度器 / 五语言词表(2026-09-28 拍板)。取不到即 undefined,不猜一个标记。
    termination: terminationOf(row.status) ?? undefined,
    // "未识别"档的载体:只有原始值不在六档内时这个键才出现(且只报数,不参与任何判定)。
    ...(normalizedStatus.rawStatus !== undefined ? { rawStatus: normalizedStatus.rawStatus } : {}),
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
// 构建 Kanban 列(列数 = AGENT_TASK_STATUSES,G-462 拆档后十列;按 priority 降序)— 供 admin 端点复用
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
  // 未识别档**只报数**:这些任务不进下面任何一列(按定义拿不到已知档的归属),
  // 但也不能静默消失 —— 未知状态既不代表成功也不代表失败,必须留下一个可问责的计数。
  // (默认 6 列视图的响应形态由用例会当契约钉着,所以这一计数不走响应体而走日志;
  //  客户端能拿到未识别任务的场景 —— /tasks 扁平列表 —— 另有看板上的计数条。)
  const unrecognizedCount = countUnrecognizedTasks(tasks)
  if (unrecognizedCount > 0) {
    console.warn(
      `[agents-kanban] 未识别状态任务 ${unrecognizedCount} 条(不计入任何已知列,仅报数;原始值见 rawStatus)`,
    )
  }
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
  // 成员清单派生自 AGENT_TASK_STATUSES(G-462 拆分终态档同枚生效,不再抄字面量)
  status: z.enum([...AGENT_TASK_STATUSES]).optional(),
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
  // 成员清单派生自 AGENT_TASK_STATUSES;新终态档(parse 可过)能否真流转仍由
  // isTransitionAllowedFromRaw 按 ALLOWED_TRANSITIONS 判(四个终态出边为空 ⇒ 409)
  toStatus: z.enum([...AGENT_TASK_STATUSES]),
  operatedBy: z.string().optional(),
  reason: z.string().optional(),
})

const workspaceLockQuerySchema = z.object({
  workspace: z.string().min(1).max(512),
})

// D25 统一任务看板:改名/改描述(name 与 description 至少提供其一)
const renameTaskSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
  })
  .refine((d) => d.name !== undefined || d.description !== undefined, {
    message: '至少提供 name 或 description',
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

/** P0-4:校验请求者是否有权查看某团队的任务行(D25 task-messages router 复用) */
export async function canViewTaskTeam(
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
      // G-463(2026-10-04):原先是 `ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)`,
      // 无 `?.` 兜底 ⇒ 库里出现六档之外的 status 时求值为 undefined 再 .includes() 就是
      // TypeError ⇒ 本接口 500(实测 `mapStatus('weird_status')` 透传后 `ALLOWED_TRANSITIONS[...]`
      // 恒 undefined)。改走 types 的唯一出口:未知状态判"无合法流转"⇒ 走下面 409 分支。
      const isAllowed = isTransitionAllowedFromRaw(current.status, toStatus)
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
          // G-672:此分支已由 leavingInProgress 别名条件收窄 toStatus ≠ in_progress
          await releaseLockToken(id, workspace, token, current.teamId, toStatus)
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

  // PATCH /agents/kanban/tasks/:id — 改名/改描述(D25 统一任务看板)
  // 注:不广播 SSE——AgentSSEEvent type 联合未含 task_updated,改名属低频编辑操作,
  //     前端改名成功后手动失效 ['agents-kanban'] 缓存即可
  server.patch('/agents/kanban/tasks/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(renameTaskSchema, request.body)
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: request.userId ?? null,
    }
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description

    const [updated] = await db
      .update(agentTasks)
      .set(updateData)
      .where(eq(agentTasks.id, id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '任务不存在'))
    return reply.send(success(toKanbanTask(updated)))
  })

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
      // G-672:上方 409 守卫已把 status 收窄到 triage/done,合法 outcome。
      await releaseTaskLockByTaskId(id, status)

      const removed = await db
        .delete(agentTasks)
        .where(eq(agentTasks.id, id))
        .returning({ id: agentTasks.id })
      if (removed.length === 0) return reply.status(404).send(error(404, '任务不存在'))
      return reply.send(success({ id, deleted: removed.length > 0 }))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
