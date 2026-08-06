/**
 * Subagent 派单 + Swarm 拓扑 Fastify 路由(2026-07-22 立,2026-07-22 深化 v2)。
 *
 * 路径(server.ts 用 prefix:'/api' 注册 → 最终 /api/subagents/*):
 *  - POST   /subagents/dispatch       创建派单(调 ai-service agent_orchestrator)
 *  - GET    /subagents/active         列出 pending/running 派单
 *  - POST   /subagents/:id/cancel     取消派单
 *  - POST   /subagents/:id/resume     从 checkpoint 恢复(深化 v2 新增)
 *  - GET    /subagents/topology       Swarm 拓扑(节点 + 边)
 *  - GET    /subagents/stats          全局统计(深化新增)
 *  - GET    /subagents/:id/stats      单个 dispatch 资源统计(深化新增)
 *  - GET    /subagents/:id/dag        DAG 可视化数据(深化 v2 新增)
 *  - GET    /subagents/queue          优先级调度队列(深化 v2 新增)
 *  - GET    /subagents/:id/quotas     资源配额使用情况(深化 v2 新增)
 *  - GET    /subagents/:id/messages   with_communication 消息列表(深化 v2 新增)
 *
 * 深化 v2:
 *  - Zod schema 支持 dag + priority + quotas
 *  - DAG 循环依赖 → 400 cyclic_dependency
 *  - 优先级调度:urgent 可抢占 → 队列查询
 *  - Checkpoint 恢复:POST /:id/resume
 *  - 资源配额查询:GET /:id/quotas
 *
 * 鉴权:复用 packages/auth 的 authenticate(同 v1-apply-diff.ts 模式)
 * 校验:Zod
 * 响应:{ code: 0, message: 'success', data: ... }
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { subagentDispatchService } from '../services/subagent-dispatch-service.js'
import { findAgentTasksByAgentId } from '../db/agent-queries.js'
import type { AgentTask } from '@ihui/database'

export const subagentDispatchRoutes: FastifyPluginAsync = async (server) => {
  // 注入 Redis 客户端(fastify.decorate 挂载后,服务初始化时从 app 拿取)
  try {
    await subagentDispatchService.setRedisClient(server.redis ?? null)
  } catch {
    // Redis 初始化失败 → 降级内存,不阻塞路由注册
  }

  // 鉴权 helper
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  // ---------- Zod schemas ----------

  const retrySchema = z.object({
    maxAttempts: z.number().int().min(1).max(3).default(1),
    delayMs: z.number().int().min(0).default(1000),
  })

  const quotasSchema = z.object({
    timeoutMs: z.number().int().min(1000).max(3_600_000).default(300_000),
    tokenQuota: z.number().int().min(1000).max(1_000_000).default(50_000),
    maxRetries: z.number().int().min(0).max(3).default(2),
  })

  const dagNodeSchema = z.object({
    id: z.string().min(1),
    agentRole: z.enum(['researcher', 'coder', 'reviewer', 'architect', 'debugger']),
    task: z.string().min(1),
  })

  const dagEdgeSchema = z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    condition: z.string().optional(),
  })

  const dagSchema = z.object({
    nodes: z.array(dagNodeSchema).min(1).max(100),
    edges: z.array(dagEdgeSchema).max(100).default([]),
  })

  const dispatchSchema = z.object({
    goal: z.string().min(1, '任务目标不能为空'),
    affectedFiles: z.array(z.string().min(1)).min(1, '至少一个受影响文件').max(100),
    forbidden: z.array(z.string()).max(100).optional(),
    verifyCommands: z.array(z.string()).max(100).default([]),
    constraints: z.string().min(1, '约束边界不能为空'),
    deliverables: z.string().min(1, '交付物不能为空'),
    agentRole: z
      .enum(['researcher', 'coder', 'reviewer', 'architect', 'debugger'])
      .optional(),
    orchestration: z
      .enum([
        'pipeline',
        'parallel',
        'debate',
        'vote',
        'critique',
        'decomposed',
        'with_communication',
      ])
      .optional(),
    retry: retrySchema.optional(),
    dag: dagSchema.optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    quotas: quotasSchema.optional(),
    // 2026-08-06: 关联 agent 主表 id,派单运行轨迹持久化到 agent_tasks(agents 详情页 5 Tab 数据源)
    agentId: z.string().uuid().optional(),
  })

  // ---------- GET /subagents/by-agent/:agentId/summary 聚合类型 ----------
  // agent 详情页 5 个 Tab(progress/swarm/checkpoint/plan/background)的运行时数据形状。
  // 数据源:agent_tasks 表(subagent dispatch 无 agentId 关联,无法直接查询)。

  /** 进度步骤(对齐前端 AgentProgressPanel props) */
  interface AgentRuntimeStep {
    id: string
    title: string
    status: 'pending' | 'running' | 'done' | 'error'
    detail?: string
    duration?: number
  }

  /** 检查点(对齐前端 CheckpointHistoryPanel props) */
  interface AgentRuntimeCheckpoint {
    id: string
    label: string
    timestamp: string
    diff?: string
  }

  /** 计划步骤(对齐前端 PlanReviewPanel props) */
  interface AgentRuntimePlanStep {
    id: string
    description: string
    tools?: string[]
  }

  /** 计划(对齐前端 PlanReviewPanel props) */
  interface AgentRuntimePlan {
    steps: AgentRuntimePlanStep[]
    summary?: string
  }

  /** 后台 agent(对齐前端 BackgroundAgentsPanel props) */
  interface AgentRuntimeBackgroundAgent {
    agent_id: string
    status: string
    prompt: string
    created_at: string
    updated_at?: string
    progress?: { text_preview?: string; tool_calls?: number }
    result?: { output?: string }
    error?: string
  }

  /** swarm 数据(对齐前端 AgentSwarmMonitor props 的 SwarmData) */
  interface AgentRuntimeSwarmData {
    swarm?: {
      swarmId: string
      status: string
      task: string
      currentIteration: number
      maxIterations: number
    }
    agentList?: Array<{
      name: string
      type: string
      status: string
      currentStep?: string
    }>
    results?: Array<{
      step_id: string
      step_action: string
      result?: string
      error_message?: string
      created_at: string
    }>
  }

  /** agent 运行时汇总(端点返回结构) */
  interface AgentRuntimeSummary {
    steps: AgentRuntimeStep[]
    swarmData: AgentRuntimeSwarmData | null
    checkpoints: AgentRuntimeCheckpoint[]
    plan: AgentRuntimePlan
    agents: AgentRuntimeBackgroundAgent[]
  }

  /** agent_tasks.status(legacy) → 前端进度步骤状态 */
  function toStepStatus(raw: string): AgentRuntimeStep['status'] {
    if (raw === 'running' || raw === 'in_progress') return 'running'
    if (raw === 'completed' || raw === 'done') return 'done'
    if (raw === 'failed' || raw === 'blocked' || raw === 'cancelled') return 'error'
    return 'pending'
  }

  /** agent_tasks.status(legacy) → 前端 AgentStatus(swarm/background 共用) */
  function toAgentStatus(raw: string): string {
    if (raw === 'in_progress') return 'running'
    if (raw === 'done') return 'completed'
    if (raw === 'blocked') return 'failed'
    if (raw === 'cancelled') return 'cancelled'
    if (raw === 'completed') return 'completed'
    if (raw === 'failed') return 'failed'
    if (raw === 'running') return 'running'
    return 'idle'
  }

  /** 从任务行读取 payload 中的 toolCalls(存在且为 number 时返回) */
  function readToolCalls(payload: Record<string, unknown> | null | undefined): number | undefined {
    if (!payload) return undefined
    const v = payload.toolCalls ?? payload.tool_calls
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined
  }

  /** 从任务行的 payload 中尝试提取计划(payload.plan / payload.steps 为数组时) */
  function extractPlanFromTask(task: AgentTask): AgentRuntimePlan | undefined {
    const payload = task.payload ?? {}
    const candidate: unknown[] | undefined = Array.isArray(payload.plan)
      ? (payload.plan as unknown[])
      : Array.isArray(payload.steps)
        ? (payload.steps as unknown[])
        : undefined
    if (!candidate) return undefined
    const steps: AgentRuntimePlanStep[] = []
    for (let i = 0; i < candidate.length; i++) {
      const item = candidate[i]
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      const description =
        typeof record.description === 'string'
          ? record.description
          : typeof record.name === 'string'
            ? record.name
            : typeof record.task === 'string'
              ? record.task
              : ''
      if (!description) continue
      steps.push({
        id: typeof record.id === 'string' && record.id.length > 0 ? record.id : `${task.id}-plan-${i}`,
        description,
        tools: Array.isArray(record.tools)
          ? (record.tools as unknown[]).filter((t): t is string => typeof t === 'string')
          : undefined,
      })
    }
    if (steps.length === 0) return undefined
    const summary = typeof payload.planSummary === 'string' ? payload.planSummary : undefined
    return { steps, summary }
  }

  /** 由 agent_tasks 记录聚合出详情页运行时汇总(无记录时返回空数据,保持前端空态) */
  function buildAgentRuntimeSummary(agentId: string, tasks: AgentTask[]): AgentRuntimeSummary {
    const steps: AgentRuntimeStep[] = []
    const checkpoints: AgentRuntimeCheckpoint[] = []
    const planSteps: AgentRuntimePlanStep[] = []
    const agents: AgentRuntimeBackgroundAgent[] = []
    const results: AgentRuntimeSwarmData['results'] = []

    // 计划:优先用最近一条任务的 payload.plan,否则用任务名/描述兜底
    let planSummary: string | undefined
    const extractedPlan = tasks.length > 0 ? extractPlanFromTask(tasks[0]!) : undefined
    if (extractedPlan) {
      planSteps.push(...extractedPlan.steps)
      planSummary = extractedPlan.summary
    }

    for (const task of tasks) {
      const rawStatus = task.status ?? 'pending'
      const startedAt = task.startedAt?.getTime()
      const completedAt = task.completedAt?.getTime()
      const duration =
        startedAt !== undefined && completedAt !== undefined && completedAt >= startedAt
          ? completedAt - startedAt
          : undefined
      const description = task.description ?? undefined
      const payload = task.payload ?? {}

      steps.push({
        id: task.id,
        title: task.name,
        status: toStepStatus(rawStatus),
        detail: description ?? task.errorMessage ?? undefined,
        duration,
      })

      checkpoints.push({
        id: task.id,
        label: `${task.name} · ${rawStatus}`,
        timestamp: (task.updatedAt ?? task.createdAt).toISOString(),
        diff: task.result
          ? JSON.stringify(task.result, null, 2)
          : Object.keys(payload).length > 0
            ? JSON.stringify(payload, null, 2)
            : undefined,
      })

      if (!extractedPlan) {
        planSteps.push({
          id: task.id,
          description: description ?? task.name,
        })
      }

      agents.push({
        agent_id: task.id,
        status: toAgentStatus(rawStatus),
        prompt: description ?? task.name,
        created_at: task.createdAt.toISOString(),
        updated_at: task.updatedAt?.toISOString(),
        progress:
          description || readToolCalls(payload) !== undefined
            ? { text_preview: description, tool_calls: readToolCalls(payload) }
            : undefined,
        result: task.result
          ? {
              output:
                typeof task.result.output === 'string'
                  ? task.result.output
                  : JSON.stringify(task.result),
            }
          : undefined,
        error: task.errorMessage ?? undefined,
      })

      if (task.result) {
        results.push({
          step_id: task.id,
          step_action: task.name,
          result: typeof task.result.output === 'string' ? task.result.output : undefined,
          error_message: task.errorMessage ?? undefined,
          created_at: task.createdAt.toISOString(),
        })
      }
    }

    // swarm 状态:running > failed > pending > completed > idle(有记录时)
    let swarmStatus = 'idle'
    if (tasks.length > 0) {
      if (tasks.some((t) => t.status === 'running' || t.status === 'in_progress')) swarmStatus = 'running'
      else if (tasks.some((t) => t.status === 'failed' || t.status === 'blocked' || t.status === 'cancelled')) swarmStatus = 'failed'
      else if (tasks.some((t) => t.status === 'pending')) swarmStatus = 'pending'
      else swarmStatus = 'completed'
    }

    const swarmData: AgentRuntimeSwarmData | null =
      tasks.length > 0
        ? {
            swarm: {
              swarmId: agentId,
              status: swarmStatus,
              task: tasks[0]!.name,
              currentIteration: 1,
              maxIterations: Math.max(1, tasks.length),
            },
            agentList: tasks.map((task) => ({
              name: task.name,
              type: task.status ?? 'pending',
              status: toAgentStatus(task.status ?? 'pending'),
              currentStep: task.description ?? undefined,
            })),
            results: results.length > 0 ? results : undefined,
          }
        : null

    return {
      steps,
      swarmData,
      checkpoints,
      plan: { steps: planSteps, summary: planSummary },
      agents,
    }
  }

  // ---------- POST /subagents/dispatch ----------

  server.post('/subagents/dispatch', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = dispatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const input = parsed.data

    try {
      const result = await subagentDispatchService.dispatch(input)

      // 并发超限 → 429
      if (result.outcome === 'concurrent_limit') {
        return reply.status(429).send(
          error(429, result.error ?? '并发派单数已达上限'),
        )
      }

      // DAG 循环依赖 → 400
      if (result.outcome === 'cyclic_dependency') {
        return reply.status(400).send(
          error(400, result.error ?? 'DAG 存在循环依赖'),
        )
      }

      return reply.send(success({ dispatch: result.dispatch }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- GET /subagents/active ----------

  server.get('/subagents/active', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const dispatches = subagentDispatchService.listActive()
    return reply.send(success({ dispatches }))
  })

  // ---------- POST /subagents/:id/cancel ----------

  server.post('/subagents/:id/cancel', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }

    const cancelled = subagentDispatchService.cancel(id)
    if (!cancelled) {
      return reply
        .status(404)
        .send(error(404, '派单不存在或已结束(无法取消)'))
    }
    return reply.send(success({ cancelled: true }))
  })

  // ---------- POST /subagents/:id/resume(深化 v2 新增) ----------

  server.post('/subagents/:id/resume', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }

    try {
      const result = await subagentDispatchService.resume(id)
      if (!result.resumed) {
        return reply.status(400).send(error(400, result.error ?? '无法恢复'))
      }
      return reply.send(success(result))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- GET /subagents/topology ----------

  server.get('/subagents/topology', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const topology = subagentDispatchService.getTopology()
    return reply.send(success({ topology }))
  })

  // ---------- GET /subagents/stats(全局统计) ----------

  server.get('/subagents/stats', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const stats = subagentDispatchService.getStats()
    return reply.send(success(stats))
  })

  // ---------- GET /subagents/queue(优先级调度队列,深化 v2 新增) ----------
  // 注意:此路由必须在 /:id/stats 之前注册,否则 'queue' 会被当作 :id

  server.get('/subagents/queue', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const queue = subagentDispatchService.getQueue()
    return reply.send(success({ queue }))
  })

  // ---------- GET /subagents/by-agent/:agentId/summary ----------
  // agent 详情页运行时数据汇总:从 agent_tasks 按 agentId 聚合最近记录,
  // 映射为 progress/swarm/checkpoint/plan/background 5 个 Tab 的数据形状。
  // 注意:by-agent 为静态前缀,须在 /subagents/:id/stats 参数路由之前注册。

  server.get('/subagents/by-agent/:agentId/summary', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { agentId } = request.params as { agentId: string }
    if (!agentId) {
      return reply.status(400).send(error(400, 'agentId 不能为空'))
    }

    try {
      const tasks = await findAgentTasksByAgentId(agentId, 50)
      return reply.send(success(buildAgentRuntimeSummary(agentId, tasks)))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- GET /subagents/:id/stats(单个 dispatch 资源统计) ----------

  server.get('/subagents/:id/stats', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }

    const stats = subagentDispatchService.getDispatchStats(id)
    if (!stats) {
      return reply.status(404).send(error(404, '派单不存在'))
    }
    return reply.send(success(stats))
  })

  // ---------- GET /subagents/:id/dag(DAG 可视化数据,深化 v2 新增) ----------

  server.get('/subagents/:id/dag', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }

    const dag = subagentDispatchService.getDag(id)
    if (!dag) {
      return reply.status(404).send(error(404, '派单不存在或无 DAG 配置'))
    }
    return reply.send(success(dag))
  })

  // ---------- GET /subagents/:id/quotas(资源配额使用情况,深化 v2 新增) ----------

  server.get('/subagents/:id/quotas', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }

    const quotas = subagentDispatchService.getQuotas(id)
    if (!quotas) {
      return reply.status(404).send(error(404, '派单不存在'))
    }
    return reply.send(success(quotas))
  })

  // ---------- GET /subagents/:id/messages(with_communication 消息列表,深化 v2 新增) ----------

  server.get('/subagents/:id/messages', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }

    const messages = subagentDispatchService.getMessages(id)
    return reply.send(success({ messages }))
  })
}

export default subagentDispatchRoutes
