// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Subagent 派单 + Swarm 拓扑 Fastify 路由(2026-07-22 立,2026-07-22 深化 v2)。
 *
 * 路径(server.ts 用 prefix:'/api' 注册 → 最终 /api/subagents/*):
 *  - POST   /subagents/dispatch       创建派单(调 ai-service agent_orchestrator)
 *  - GET    /subagents/active         列出 pending/running 派单
 *  - GET    /subagents/all            全量派单(新→旧,支持 status/limit 透传;G-299①)
 *  - POST   /subagents/:id/cancel     取消派单
 *  - POST   /subagents/:id/resume     从 checkpoint 恢复(深化 v2 新增)
 *  - POST   /subagents/:id/attention  进入/清除人工注意力(F3 Thread/Ticket 新增)
 *  - GET    /subagents/topology       Swarm 拓扑(节点 + 边)
 *  - GET    /subagents/stats          全局统计(深化新增)
 *  - GET    /subagents/:id/stats      单个 dispatch 资源统计(深化新增)
 *  - GET    /subagents/:id/artifacts/:stepId  上游长结果全文(F4 Inline & Spill 新增)
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
import {
  subagentDispatchService,
  type DagVisualization,
  type DispatchResourceStats,
} from '../services/subagent-dispatch-service.js'
import { findAgentById, findAgentTasksByAgentId } from '../db/agent-queries.js'
import { getConversationAccess } from '../db/chat-conversation-access.js'
import type { AgentTask } from '@ihui/database'
import { mapStatus, type AgentTaskStatus } from '@ihui/types'
import type { SubagentDispatch } from '@ihui/shared/subagents'
import { isUuidString } from '../utils/uuid.js'
// 归属判据唯一出口(2026-11-02):谓词与按 id 闸都住在 utils/dispatch-ownership.ts,
// extended 插件与本插件共用同一份;本文件不得再自带第二份实现(§22c)。
import { isAdminViewer, isDispatchVisibleTo, ownsDispatchById } from '../utils/dispatch-ownership.js'

export { isDispatchVisibleTo }

// ---------------------------------------------------------------------------
// D08 ③(2026-10-27,gb17c-e17):Fleet 统一仪表盘 —— 会话归属 + 逐 agent 指标
// ---------------------------------------------------------------------------

/**
 * 会话归属的语义与落点(D08 ③)。
 *
 * 会话语义 = chat_conversations.id(web 侧 chatStore.conversationId):这次派单发生在
 * 哪个聊天会话里。**声明面** = shared 的 `DispatchInput.conversationId` /
 * `SubagentDispatch.conversationId`(packages/shared/src/subagents/index.ts),
 * 路由层只接收 + 透传,落库由 service 的 buildDispatch 抄进派单记录本身 ——
 * 路由层不另存一份映射表(§0.6)。
 *
 * 没有会话上下文的派单入口(独立派单页 / agent 详情页)**不传这个字段**;
 * 记录上就没有它 ⇒ 载荷里也没有 ⇒ 消费方按「未归属会话」渲染,
 * 不许拿 goal 文本反推、不许塞常量顶替(§0.3「没判」不能写成「判过」)。
 */

/** 单个派单步骤(逐 agent 的 token/耗时/状态) */
interface SubagentDispatchStep {
  agent: string
  status: 'ok' | 'failed' | 'quota_exceeded'
  durationMs: number
  attempt: number
  tokenUsage: { prompt: number; completion: number; total: number }
  error?: string
}

/** 单个派单的运行指标(per-agent token + 进度);载荷缺该字段 ⇒ 视作「未判定」,不用 0 冒充 */
interface SubagentDispatchMetrics {
  /** 该派单累计 token(逐 step 求和,口径在 service 侧) */
  totalTokens: number
  /** 已耗时(ms);未开跑 = 0 */
  elapsedMs: number
  /** 已产生的步骤明细 */
  steps: SubagentDispatchStep[]
  /** DAG 编排时:已完成节点数 */
  dagDone?: number
  /** DAG 编排时:节点总数 */
  dagTotal?: number
}

/** GET /subagents/all 的行 = 派单记录 + 运行指标 + 会话归属 */
interface FleetDispatchRow extends SubagentDispatch {
  conversationId?: string
  metrics?: SubagentDispatchMetrics
}

/** buildFleetRow 的统计输入口径 = service 自己的两个出口(不另立一套) */
type FleetStatsInput = DispatchResourceStats
type FleetDagInput = DagVisualization

/**
 * 读派单记录上的会话归属。
 * 取不到(记录上没有该字段)⇒ undefined ⇒ 前端归「未归属会话」组,
 * **不从别处反推、不塞常量**(否则就是拿假字段糊面板)。
 */
export function readConversationId(dispatch: SubagentDispatch): string | undefined {
  const raw = (dispatch as SubagentDispatch & { conversationId?: unknown }).conversationId
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined
}

/**
 * 由派单记录 + service 自己的统计口径,算出 GET /subagents/all 的一行。
 *
 * **纯函数**(零 IO):stats / dag 由调用方从 service 取好再喂进来,
 * 路由层不复算、不另存(§0.6 单一真相源:token/耗时口径只认 service 的 getDispatchStats/getDag)。
 *
 * 三档语义:
 * - stats 取不到(派单已不在 runtime,重启后 Redis 只恢复 pending/running)⇒ **不带 metrics 字段**
 *   ⇒ 前端按「未判定」渲染,**不用 0 冒充**(§0.3);
 * - 未开跑(startedAt 为空)⇒ elapsedMs 记 0(service 的 totalDurationMs 在该态退化成 Date.now()-0);
 * - dag 取不到 ⇒ 不带 dagDone/dagTotal(而不是记 0/0 冒充「无节点」)。
 */
export function buildFleetRow(
  dispatch: SubagentDispatch,
  stats: FleetStatsInput | null | undefined,
  dag: FleetDagInput | null | undefined,
): FleetDispatchRow {
  const conversationId = readConversationId(dispatch)
  if (!stats) return conversationId ? { ...dispatch, conversationId } : { ...dispatch }
  const metrics: SubagentDispatchMetrics = {
    totalTokens: stats.totalTokens,
    elapsedMs: dispatch.startedAt ? Math.max(0, stats.totalDurationMs) : 0,
    steps: stats.steps.map((s) => ({
      agent: s.agent,
      status: s.status,
      durationMs: s.durationMs,
      attempt: s.attempt,
      tokenUsage: s.tokenUsage,
      error: s.error,
    })),
    dagDone: dag ? dag.nodes.filter((n) => n.status === 'completed').length : undefined,
    dagTotal: dag ? dag.nodes.length : undefined,
  }
  return { ...dispatch, conversationId, metrics }
}

// ---------------------------------------------------------------------------
// G-02①(2026-11-01,S-G02):GET /subagents/all 的分页/筛选口径
// ---------------------------------------------------------------------------
//
// 现状反查(G-299① 落地后):路由只吃单值 status + 无上界 limit + 无 offset,
// 且记录上没有租户维度。下面三个纯函数把「口径」集中成一份,路由只做拼装:
// 纯函数 ⇒ 判据可直接引源(apps/api/tests/subagents-all-route.test.ts),不在测试里另抄一份。

/** 状态取值唯一来源 = shared 的 DispatchStatus/ExtendedDispatchStatus(不在此处另立枚举) */
export const DISPATCH_STATUS_LITERALS: readonly string[] = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'paused',
  'preempted',
  'quota_exceeded',
  // F1(2026-11-02):重启中断的过渡态(自动重入队前的留痕),筛选纯增量,不改变既有 8 档语义
  'interrupted',
  // F2(2026-11-02):等槽位的排队态;`?status=queued` 可筛出等待中的派单,同样是纯增量
  'queued',
] as const

/** 一次最多回多少行:必须 ≥ 消费者契约(agent-teams 页 getAllSubagentDispatches({limit:200})),否则页面被削 */
export const SUBAGENTS_ALL_MAX_LIMIT = 500
/** 未传 limit 时的默认页大小(有界,不默认拉全表) */
export const SUBAGENTS_ALL_DEFAULT_LIMIT = 100

/**
 * 解析 status 筛选:`?status=a,b` 与重复参数 `?status=a&status=b` 等价。
 * - 未传 / 全空 ⇒ null(不过滤);
 * - 传了但没有任何合法字面量 ⇒ 返回空数组(⇒ 结果必然为空,而不是悄悄退化成"不过滤"
 *   把全量当筛选结果交回去);
 * - 未知字面量丢弃(状态集以 shared 为准,路由不猜近义词)。
 */
export function parseDispatchStatusFilter(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return null
  const pieces = (Array.isArray(raw) ? raw : [raw])
    .filter((v): v is string => typeof v === 'string')
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
  if (pieces.length === 0) return null
  return pieces.filter((v) => DISPATCH_STATUS_LITERALS.includes(v))
}

/**
 * limit 夹取:非法/非正 ⇒ 默认页大小;超上界 ⇒ 夹到上界(**不 400**,
 * 与文件内既有「透传式」参数风格一致:客户端多要只给上界,不因多要而报错)。
 */
export function clampDispatchLimit(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return SUBAGENTS_ALL_DEFAULT_LIMIT
  return Math.min(Math.floor(n), SUBAGENTS_ALL_MAX_LIMIT)
}

/** offset 夹取:非法/负数 ⇒ 0 */
export function clampDispatchOffset(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

/**
 * 租户可见性(单一口径)。
 *
 * 实现已迁至 `utils/dispatch-ownership.ts`(2026-11-02,两插件共用唯一出口);
 * 本文件只 re-export 供既有 `__test__` 与镜像测试引用,不再自带第二份表达。
 */

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
      const message = (e as Error).message || '操作失败,请稍后重试'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  // 按 id 端点的归属闸:直接复用 utils/dispatch-ownership.ts 的唯一实现(ownsDispatchById)。

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
    agentRole: z.enum(['researcher', 'coder', 'reviewer', 'architect', 'debugger']).optional(),
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
    // 2026-10-27(D08 ③):会话归属 = chat_conversations.id(web chatStore.conversationId)。
    // 语义单一:「这次派单发生在哪个聊天会话里」;路由层只接收 + 透传,
    // 落库归派单记录本身(service 的 buildDispatch/_persistDispatch),路由层不另存映射(§0.6)。
    conversationId: z.string().uuid().optional(),
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
      startedAt?: string
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

  /** agent_tasks.status(含 legacy)→ 前端进度步骤状态;经共享 mapStatus 归一,档位不自立一份 */
  function toStepStatus(raw: string): AgentRuntimeStep['status'] {
    const s: AgentTaskStatus = mapStatus(raw)
    if (s === 'in_progress') return 'running'
    if (s === 'done') return 'done'
    if (s === 'blocked' || s === 'cancelled' || s === 'execution_failed') return 'error'
    return 'pending'
  }

  /** agent_tasks.status(含 legacy)→ 前端 AgentStatus(swarm/background 共用);经共享 mapStatus 归一 */
  function toAgentStatus(raw: string): string {
    const s: AgentTaskStatus = mapStatus(raw)
    if (s === 'in_progress') return 'running'
    if (s === 'done') return 'completed'
    if (s === 'blocked') return 'failed'
    if (s === 'cancelled') return 'cancelled'
    if (s === 'execution_failed') return 'failed'
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
        id:
          typeof record.id === 'string' && record.id.length > 0
            ? record.id
            : `${task.id}-plan-${i}`,
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

    // swarm 状态:running > failed > pending > completed > idle(有记录时);档位经共享 mapStatus 归一
    let swarmStatus = 'idle'
    if (tasks.length > 0) {
      const kanbanOf = (t: AgentTask): AgentTaskStatus => mapStatus(t.status)
      if (tasks.some((t) => kanbanOf(t) === 'in_progress')) swarmStatus = 'running'
      else if (
        tasks.some(
          (t) =>
            kanbanOf(t) === 'execution_failed' ||
            kanbanOf(t) === 'blocked' ||
            kanbanOf(t) === 'cancelled',
        )
      )
        swarmStatus = 'failed'
      else if (tasks.some((t) => kanbanOf(t) === 'triage')) swarmStatus = 'pending'
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
              // P3 #44 阶段1:started_at 落进 agentList,瓶颈高亮有数据源
              startedAt: task.startedAt ? task.startedAt.toISOString() : undefined,
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
    const userId = request.userId
    if (!userId) return

    const parsed = dispatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const input = parsed.data

    try {
      // P1(2026-11-02):agentId / conversationId 归属闸 —— 与 /subagents/by-agent/:agentId/summary
      // 同一判据(§22c):agent 是「本人所有 或 已上架(published)」;会话经 chat-conversation-access
      // 的单源判据(本人会话 ∪ 已接受协作成员)。取不到 / 不是你的合并成同一个 404(防枚举,不用 403)。
      if (input.agentId) {
        const agent = await findAgentById(input.agentId)
        const agentOwner = typeof agent?.userId === 'string' ? agent.userId : null
        const isPublished = agent?.status === 'published' || agent?.publishStatus === 'published'
        if (!agent || (agentOwner !== userId && !isPublished)) {
          return reply.status(404).send(error(404, '派单不存在'))
        }
      }
      if (input.conversationId && !(await getConversationAccess(input.conversationId, userId))) {
        return reply.status(404).send(error(404, '派单不存在'))
      }

      // 会话归属透传:schema 已声明 conversationId,service 的 buildDispatch 抄进派单记录,
      // GET /subagents/all 原样回读 ⇒ 前端「按会话分组」即刻生效,路由层无需再改。
      // 租户归属**只从鉴权结果注入**(dispatchSchema 无该字段 ⇒ 请求体自报会被 Zod 剥掉),
      // 由 buildDispatch 落进记录并随 Redis 持久化,GET /subagents/all 据此隔离。
      const result = await subagentDispatchService.dispatch({
        ...input,
        // 与上面的 userId 同值(都是鉴权结果);保留此前已有的字面形态,归属写入源头不变
        ownerUserId: request.userId,
      })

      // F2(2026-11-02):并发满额不再返回 429 —— service 已把派单落 queued 并进真队列,
      // 这里直接按成功返回(dispatch.status = 'queued')。保留该分支只为兼容其他 outcome 来源。
      if (result.outcome === 'concurrent_limit') {
        return reply.status(429).send(error(429, result.error ?? '并发派单数已达上限'))
      }

      // DAG 循环依赖 → 400
      if (result.outcome === 'cyclic_dependency') {
        return reply.status(400).send(error(400, result.error ?? 'DAG 存在循环依赖'))
      }

      return reply.send(success({ dispatch: result.dispatch }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- GET /subagents/active ----------
  // S-ACTIVE(2026-11-01)收口:原实现直接 `listActive()` 全量返回 —— 记录上带 ownerUserId 之后,
  // 这就是跨租户读(A 的 pending/running 派单连同 goal/constraints/deliverables 一起给对方看)。
  // 修法与 /all **同源**:复用 isDispatchVisibleTo,不另写一份(§22c)。
  // 语义不动:活跃集仍只 pending/running(由 service.listActive 提供),这里只加可见性一层。
  // 过滤放在路由而**不是** service.listActive —— 后者还是并发上限(dispatch/_tryPreempt)的计数口径,
  // 按租户过滤会变成"每人 3 个并发"的隐性变更(越权票不承担该语义变更)。
  server.get('/subagents/active', async (request, reply) => {
    await requireAuth(request, reply)
    const userId = request.userId
    if (!userId) return

    const dispatches = subagentDispatchService
      .listActive()
      .filter((d) => isDispatchVisibleTo(d, userId, isAdminViewer(request)))
    return reply.send(success({ dispatches }))
  })

  // ---------- GET /subagents/all ----------
  // G-299①(2026-09-28):agent-teams 页(apps/web/app/(main)/agent-teams/page.tsx)要**全量**
  // 派单历史(含 completed/failed/cancelled),/subagents/active 只是 pending/running 子集 ——
  // 客户端改道 active 会把"页面少了历史"写成"已修",所以补这条真面。
  // 形状与 active 同({dispatches}),排序取新→旧(消费方按列表直读)。
  // G-02①(2026-11-01,S-G02)收口:status 支持逗号/重复参数多值、limit 有上界(500)、offset 分页、
  // 按租户(ownerUserId)过滤;口径全部收在文件头纯函数里,测试直接引源,不另抄。
  // 注意:不复制 /active 的实现 —— 两者口径必须真的不同(/active 只 pending/running 且不分页)。
  server.get('/subagents/all', async (request, reply) => {
    await requireAuth(request, reply)
    const userId = request.userId
    if (!userId) return

    const q = request.query as { status?: unknown; limit?: unknown; offset?: unknown }
    const statuses = parseDispatchStatusFilter(q.status)
    const limit = clampDispatchLimit(q.limit)
    const offset = clampDispatchOffset(q.offset)

    let dispatches = subagentDispatchService.listAll().slice().reverse()
    dispatches = dispatches.filter((d) => isDispatchVisibleTo(d, userId, isAdminViewer(request)))
    if (statuses) dispatches = dispatches.filter((d) => statuses.includes(d.status))

    // total = 过滤后、分页前(消费方据此判断"还有没有下一页");分页只切窗口,不改口径
    const total = dispatches.length
    const page = dispatches.slice(offset, offset + limit)
    const rows: FleetDispatchRow[] = page.map((d) =>
      buildFleetRow(
        d,
        subagentDispatchService.getDispatchStats(d.id),
        subagentDispatchService.getDag(d.id),
      ),
    )
    return reply.send(success({ dispatches: rows, total }))
  })

  // ---------- POST /subagents/:id/cancel ----------
  // S-ACL(2026-11-01):归属闸必须在**调 service 之前** —— cancel 会真的改状态,
  // 先取消再判归属 = 「返回 404 但暗地里取消了别人的派单」。

  server.post('/subagents/:id/cancel', async (request, reply) => {
    await requireAuth(request, reply)
    const userId = request.userId
    if (!userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }
    if (!ownsDispatchById(id, userId, isAdminViewer(request))) {
      return reply.status(404).send(error(404, '派单不存在或已结束(无法取消)'))
    }

    const cancelled = subagentDispatchService.cancel(id)
    if (!cancelled) {
      return reply.status(404).send(error(404, '派单不存在或已结束(无法取消)'))
    }
    return reply.send(success({ cancelled: true }))
  })

  // ---------- POST /subagents/:id/resume(深化 v2 新增) ----------

  server.post('/subagents/:id/resume', async (request, reply) => {
    await requireAuth(request, reply)
    const userId = request.userId
    if (!userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }
    // resume 会重置状态并重新执行 ⇒ 与 cancel 同级,闸在调用之前
    if (!ownsDispatchById(id, userId, isAdminViewer(request))) {
      return reply.status(404).send(error(404, '派单不存在'))
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

  // ---------- POST /subagents/:id/attention(F3 Thread/Ticket) ----------
  // 人工注意力:awaiting_answer / awaiting_review 进入,传 null 清除。
  // 与执行状态机正交(不改 status);归属闸仍走唯一出口 ownsDispatchById,一律 404,不引 403。

  const attentionSchema = z.object({
    attention: z.enum(['awaiting_answer', 'awaiting_review']).nullable(),
  })

  server.post('/subagents/:id/attention', async (request, reply) => {
    await requireAuth(request, reply)
    const userId = request.userId
    if (!userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }
    // 写操作:归属闸必须先于 service 调用(返回 404 不得暗地里改他人记录)
    if (!ownsDispatchById(id, userId, isAdminViewer(request))) {
      return reply.status(404).send(error(404, '派单不存在'))
    }

    const parsed = attentionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, 'attention 必须是 awaiting_answer / awaiting_review / null'))
    }

    const result = await subagentDispatchService.setAttention(id, parsed.data.attention)
    if (!result.ok) {
      if (result.reason === 'terminal') {
        return reply.status(409).send(error(409, '派单已结束,无法进入人工注意力'))
      }
      return reply.status(404).send(error(404, '派单不存在'))
    }
    return reply.send(success({ dispatch: result.dispatch }))
  })

  // ---------- GET /subagents/topology ----------
  // S-ACL(2026-11-01):原 `getTopology()` 是全量推导 —— 节点带 goal/status/duration/tokens,
  // 等于把他人派单的执行面貌摊给任何登录用户。消费方只有 web 用户页(use-subagent-dispatch.ts
  // useSwarmTopology、lib/subagents-api.ts fetchTopology),无管理端语义 ⇒ 按调用方收窄。

  server.get('/subagents/topology', async (request, reply) => {
    await requireAuth(request, reply)
    const userId = request.userId
    if (!userId) return

    const topology = subagentDispatchService.getTopology((d) => isDispatchVisibleTo(d, userId, isAdminViewer(request)))
    return reply.send(success({ topology }))
  })

  // ---------- GET /subagents/stats ----------
  // S-STATS(2026-11-01)收口:原实现六个字段里 total/totalTokens/avgDurationMs 读自进程级累加器
  // `_stats`(service 无租户维度)⇒ 任何一个登录用户拿到的都是**全站**派单数与 token 总量。
  //
  // 为什么不能判「不该收窄」(形态丙已排除,证据):本端点唯一消费方是
  // apps/web/src/lib/subagents-api.ts `getSubagentStats` → apps/web/src/components/ai/
  // fleet-cross-session-panel.tsx(D08 ③ Fleet 面板,token 总量画在同一屏),而该面板的行数据来自
  // GET /subagents/all —— 已被 S-ACL 按 isDispatchVisibleTo 收窄。同一个面板里「列表是本人的、
  // token 总量是全站的」不是管理端语义,是口径自相矛盾 ⇒ 必须收窄。
  //
  // 采用「按需聚合」而非「按 owner 分桶累加」:token/时长本就落在记录上
  // (runtime.steps[].tokenUsage / startedAt|completedAt),累加器只是第二份副本,还会与记录
  // 生命周期脱钩(G-998156 的重复进账/续跑重放就是这一族)。现在六个字段同源于一份 filtered 集合,
  // 判据仍只有 isDispatchVisibleTo 一份 ⇒ 不会出现「计数按租户、token 按全站」的错位。

  server.get('/subagents/stats', async (request, reply) => {
    await requireAuth(request, reply)
    const userId = request.userId
    if (!userId) return

    const stats = subagentDispatchService.getStats((d) => isDispatchVisibleTo(d, userId, isAdminViewer(request)))
    return reply.send(success(stats))
  })

  // ---------- GET /subagents/queue(优先级调度队列,深化 v2 新增) ----------
  // 注意:此路由必须在 /:id/stats 之前注册,否则 'queue' 会被当作 :id
  // S-ACL(2026-11-01):队列项带 dispatchId/goal/status ⇒ 同 topology,按调用方收窄。

  server.get('/subagents/queue', async (request, reply) => {
    await requireAuth(request, reply)
    const userId = request.userId
    if (!userId) return

    // F2:读真队列(Redis zset),service 出口已改为异步
    const queue = await subagentDispatchService.getQueue((d) => isDispatchVisibleTo(d, userId, isAdminViewer(request)))
    return reply.send(success({ queue }))
  })

  // ---------- GET /subagents/by-agent/:agentId/summary ----------
  // agent 详情页运行时数据汇总:从 agent_tasks 按 agentId 聚合最近记录,
  // 映射为 progress/swarm/checkpoint/plan/background 5 个 Tab 的数据形状。
  // 注意:by-agent 为静态前缀,须在 /subagents/:id/stats 参数路由之前注册。
  //
  // S-STATS(2026-11-01):补 agent 归属闸。agents 表有 userId(创建者)+ status/publishStatus
  // (上架态)⇒ **agent 本身就有租户维度**,不存在「全局共享、不该加校验」那一档:
  //   - 本人创建的 draft/pending agent ⇒ 只有创建者能读它的运行时汇总;
  //   - 已上架(published)⇒ 公开资源,任何登录用户可读(维持详情页现状)。
  // 越权面收掉的是「知道一个 uuid 就能读别人未上架 agent 的运行时」。
  //
  // 2026-11-02 已收口(归属回填与 fail-open 收敛):agent_tasks 行现在**有**租户归属 ——
  //   - 写侧:_createAgentTask 落 createdBy = input.ownerUserId(新派单从此可归属);
  //   - 存量:迁移 drizzle/20261102180000_ownership_backfill_before_tighten.sql 先把可推导行
  //     回填为 agents.user_id,**最后**写 ownership_backfill_state 标记;
  //   - 读侧:findAgentTasksByAgentId 按 `isAgentTaskVisibleTo` 单一判据过滤
  //     (createdBy=本人 / NULL 行在标记写入后按 orphan 仅管理面 / 管理员恒可见)。
  // 顺序契约:标记缺失 ⇒ 代码维持旧的「NULL 行可见」口径,不会出现「代码先收紧、数据未回填」
  // 导致历史数据集体消失。因此对**已上架** agent,汇总里的 steps[].detail /
  // checkpoints[].diff / agents[].result.output 不再带其他租户的派单产出。

  server.get('/subagents/by-agent/:agentId/summary', async (request, reply) => {
    await requireAuth(request, reply)
    const userId = request.userId
    if (!userId) return

    const { agentId } = request.params as { agentId: string }
    // 形状闸(2026-09-28 普查收口):下面这些 :id 最终会被喂进 uuid 列,非 uuid 字面量让 Postgres
    // 抛 22P02 invalid input syntax for type uuid,而未被兜住就是 500 —— 于是"这条不存在"与
    // "服务坏了"在响应上完全同形。判据只有一份(utils/uuid.ts 的 isUuidString),闸必须在进 SQL 之前。
    if (!isUuidString(agentId)) return reply.status(404).send(error(404, '派单不存在'))
    if (!agentId) {
      return reply.status(400).send(error(400, 'agentId 不能为空'))
    }

    try {
      // 归属闸:取不到 agent 与「不是你的」合并成同一个 404(同 ownsDispatch:防枚举,
      // 且不告诉调用方这个 uuid 真实存在)。
      const agent = await findAgentById(agentId)
      const agentOwner = typeof agent?.userId === 'string' ? agent.userId : null
      const isPublished = agent?.status === 'published' || agent?.publishStatus === 'published'
      if (!agent || (agentOwner !== userId && !isPublished)) {
        return reply.status(404).send(error(404, '派单不存在'))
      }

      const tasks = await findAgentTasksByAgentId(
        agentId,
        { userId, isAdmin: isAdminViewer(request) },
        50,
      )
      return reply.send(success(buildAgentRuntimeSummary(agentId, tasks)))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- GET /subagents/:id/stats(单个 dispatch 资源统计) ----------

  server.get('/subagents/:id/stats', async (request, reply) => {
    await requireAuth(request, reply)
    const userId = request.userId
    if (!userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }
    if (!ownsDispatchById(id, userId, isAdminViewer(request))) {
      return reply.status(404).send(error(404, '派单不存在'))
    }

    const stats = subagentDispatchService.getDispatchStats(id)
    if (!stats) {
      return reply.status(404).send(error(404, '派单不存在'))
    }
    return reply.send(success(stats))
  })

  // ---------- GET /subagents/:id/artifacts/:stepId(F4 Inline & Spill) ----------
  // 上游长结果全文的取回点(见 service 的 _spillArtifact / getArtifact)。
  // 归属闸先于取产物,一律 404、不引 403;产物不存在也给同一个 404,不泄露「有没有」。

  server.get('/subagents/:id/artifacts/:stepId', async (request, reply) => {
    await requireAuth(request, reply)
    const userId = request.userId
    if (!userId) return

    const { id, stepId } = request.params as { id: string; stepId: string }
    if (!id || !stepId) {
      return reply.status(400).send(error(400, '派单 ID 与产物 ID 不能为空'))
    }
    if (!ownsDispatchById(id, userId, isAdminViewer(request))) {
      return reply.status(404).send(error(404, '派单不存在'))
    }

    const artifact = await subagentDispatchService.getArtifact(id, stepId)
    if (!artifact) {
      return reply.status(404).send(error(404, '产物不存在'))
    }
    return reply.send(success({ artifact }))
  })

  // ---------- GET /subagents/:id/dag(DAG 可视化数据,深化 v2 新增) ----------

  server.get('/subagents/:id/dag', async (request, reply) => {
    await requireAuth(request, reply)
    const userId = request.userId
    if (!userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }
    if (!ownsDispatchById(id, userId, isAdminViewer(request))) {
      return reply.status(404).send(error(404, '派单不存在或无 DAG 配置'))
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
    const userId = request.userId
    if (!userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }
    if (!ownsDispatchById(id, userId, isAdminViewer(request))) {
      return reply.status(404).send(error(404, '派单不存在'))
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
    const userId = request.userId
    if (!userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }
    // 原实现对不存在/不可见的 id 都回 200 + 空数组(把「没有」与「不给你看」写成同一形状)
    // ⇒ 归属不符时明确 404,与其余 5 个按 id 端点同形。
    if (!ownsDispatchById(id, userId, isAdminViewer(request))) {
      return reply.status(404).send(error(404, '派单不存在'))
    }

    const messages = subagentDispatchService.getMessages(id)
    return reply.send(success({ messages }))
  })
}

export default subagentDispatchRoutes

/** 供镜像测试 import 的生产判据(§22c:测试不复制判据,直接引源) */
export const __test__ = {
  buildFleetRow,
  readConversationId,
  parseDispatchStatusFilter,
  clampDispatchLimit,
  clampDispatchOffset,
  isDispatchVisibleTo,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
