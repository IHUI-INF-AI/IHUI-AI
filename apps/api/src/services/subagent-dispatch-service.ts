/**
 * Subagent 派单服务(2026-07-22 立,2026-07-22 深化 v2)。
 *
 * 职责:
 *  1. 维护进程内 active dispatches Map + Redis 持久化(降级内存)
 *  2. 调 apps/ai-service 的 agent_orchestrator HTTP 接口(pipeline/parallel/run-decomposed)
 *  3. debate/vote/critique 编排模式:多 agent + LLM 仲裁 / 投票 / 批判
 *  4. with_communication 编排模式:agent 间 Redis 消息总线通信
 *  5. DAG 依赖图:拓扑排序 + 循环检测 + 条件边 + 同层并行
 *  6. Checkpoint 恢复:每步写 Redis hash,失败后从断点续跑
 *  7. 优先级调度:urgent 可抢占 lowest priority running dispatch
 *  8. 资源配额:超时/超 token kill agent,标记 quota_exceeded
 *  9. 失败重试(指数退避,maxAttempts 1-3)
 * 10. 并发控制(默认最大 3,超限返回 429)
 * 11. 资源消耗统计(durationMs + tokenUsage + estimatedCost)
 * 12. 维护派单 → 拓扑映射(DAG/critique/communication 多节点)
 *
 * 设计:
 *  - 跨服务调用超时 30s,失败降级为 step failed
 *  - ai-service 无对应路由(404)→ 抛 not_implemented,路由层返回 501
 *  - Redis 不可用时降级为内存 Map,不抛异常
 *  - redisClient 通过 fastify.decorate 挂载,路由注册时调 setRedisClient 注入
 */

import type { Redis } from 'ioredis'
import type {
  SubagentDispatch,
  DispatchInput,
  TopologyNode,
  TopologyEdge,
  OrchestrationMode,
  SubagentRole,
  DispatchStatus,
} from '@ihui/types/subagent-dispatch'

/** ai-service 基础 URL(优先 env,回退 AGENTS.md §6 文档值 8000) */
const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL && process.env.AI_SERVICE_URL.length > 0
    ? process.env.AI_SERVICE_URL.replace(/\/$/, '')
    : 'http://localhost:8000'

/** 跨服务调用超时(ms) */
const AI_SERVICE_TIMEOUT_MS = 30_000

/** Redis 键前缀 */
const REDIS_KEY_DISPATCH = 'subagent:dispatch:' // hash
const REDIS_KEY_LOGS = 'subagent:logs:' // list
const REDIS_KEY_IDS = 'subagent:dispatch:ids' // set
const REDIS_KEY_INBOX = 'subagent:inbox:' // list(with_communication agent 消息)
const REDIS_KEY_CHECKPOINT = 'subagent:checkpoint:' // hash(stepId → JSON)
const REDIS_KEY_QUEUE = 'subagent:dispatch:queue' // zset(priority score)

/** 日志最大保留条数(LTRIM) */
const LOG_MAX_ENTRIES = 500

/** 默认最大并发 dispatch 数 */
const DEFAULT_MAX_CONCURRENT = 3

/** 重试最大次数上限 */
const MAX_RETRY_ATTEMPTS = 3

/** Checkpoint TTL(24 小时,秒) */
const CHECKPOINT_TTL_SEC = 24 * 60 * 60

/** 通信轮次默认值(with_communication) */
const DEFAULT_COMM_ROUNDS = 3

/** 简单成本估算($/token,演示用) */
const COST_PER_TOKEN_USD = 0.000001

/** 5 默认 agent 中文标签(用于拓扑节点 label) */
const ROLE_LABELS: Record<SubagentRole, string> = {
  researcher: '研究助手',
  coder: '代码助手',
  reviewer: '审查助手',
  architect: '架构师',
  debugger: '调试助手',
}

/** 所有默认 agent 角色(debate/vote/critique 多 agent 并发) */
const ALL_ROLES: SubagentRole[] = [
  'researcher',
  'coder',
  'reviewer',
  'architect',
  'debugger',
]

// ---------------------------------------------------------------------------
// 扩展类型(深化新增)
// ---------------------------------------------------------------------------

/** 扩展 dispatch 状态(增加 preempted / quota_exceeded) */
export type ExtendedDispatchStatus =
  | DispatchStatus
  | 'preempted'
  | 'quota_exceeded'

/** 派单优先级(调度队列排序) */
export type DispatchPriority = 'low' | 'normal' | 'high' | 'urgent'

/** 优先级 → 数值(zset score,数值越大越优先) */
const PRIORITY_SCORE: Record<DispatchPriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  urgent: 4,
}

/** 资源配额(单 agent 级别) */
export interface QuotaConfig {
  /** 单 agent 超时 ms(默认 300000 = 5 分钟) */
  timeoutMs: number
  /** 单 agent token 上限(默认 50000) */
  tokenQuota: number
  /** 单 agent 最大重试(默认 2) */
  maxRetries: number
}

/** DAG 节点 */
export interface DagNode {
  id: string
  agentRole: SubagentRole
  task: string
}

/** DAG 边 */
export interface DagEdge {
  from: string
  to: string
  /** 条件表达式(如 "result.includes('success')"),为空 = 无条件 */
  condition?: string
}

/** DAG 配置 */
export interface DagConfig {
  nodes: DagNode[]
  edges: DagEdge[]
}

/** 重试配置 */
export interface RetryConfig {
  /** 最大尝试次数(含首次,1=不重试,最大 3) */
  maxAttempts: number
  /** 重试间隔基数 ms(实际间隔 = delayMs * 2^(attempt-1)) */
  delayMs: number
}

/** 扩展派单输入(支持 DAG + 优先级 + 配额 + 重试) */
export interface ExtendedDispatchInput extends DispatchInput {
  retry?: RetryConfig
  dag?: DagConfig
  priority?: DispatchPriority
  quotas?: QuotaConfig
}

/** 全局统计 */
export interface DispatchStats {
  active: number
  completed: number
  failed: number
  total: number
  avgDurationMs: number
  totalTokens: number
}

/** 单个 dispatch 资源统计 */
export interface DispatchResourceStats {
  dispatchId: string
  status: ExtendedDispatchStatus
  totalDurationMs: number
  totalTokens: number
  estimatedCost: number
  steps: Array<{
    agent: string
    durationMs: number
    tokenUsage: { prompt: number; completion: number; total: number }
    attempt: number
    status: 'ok' | 'failed' | 'quota_exceeded'
    error?: string
  }>
}

/** debate 模式结果 */
export interface DebateResult {
  winningAgent: string
  mergedResult: string
  allResults: Array<{ agent: string; output: string }>
  debateSummary: string
}

/** vote 模式结果 */
export interface VoteResult {
  winningAgent: string
  winnerResult: string
  votes: Array<{ voter: string; candidate: string; score: number }>
}

/** critique 单轮结果 */
export interface CritiqueRound {
  round: number
  results: Array<{ agent: string; output: string }>
  critiques: Array<{ agent: string; target: string; critique: string }>
}

/** critique 模式结果 */
export interface CritiqueResult {
  rounds: CritiqueRound[]
  finalResult: string
  winningAgent: string
}

/** 通信消息(with_communication) */
export interface CommunicationMessage {
  from: string
  to: string
  type: 'question' | 'answer' | 'result'
  content: string
  timestamp: string
  round: number
}

/** with_communication 模式结果 */
export interface WithCommunicationResult {
  messages: CommunicationMessage[]
  finalResults: Array<{ agent: string; output: string }>
  rounds: number
}

/** Checkpoint 条目 */
export interface Checkpoint {
  stepId: string
  agentRole: string
  status: 'ok' | 'failed' | 'quota_exceeded'
  result?: string
  timestamp: string
  tokenUsage?: number
  durationMs?: number
}

/** 队列条目(优先级调度) */
export interface QueueEntry {
  dispatchId: string
  priority: DispatchPriority
  status: ExtendedDispatchStatus
  goal: string
  createdAt: string
  position: number
}

/** 配额使用情况 */
export interface QuotaUsage {
  dispatchId: string
  quotas: QuotaConfig
  agents: Array<{
    agent: string
    durationMs: number
    tokenUsage: number
    retries: number
    status: 'ok' | 'failed' | 'quota_exceeded' | 'running' | 'pending'
    exceeded: 'none' | 'timeout' | 'tokens' | 'retries'
  }>
}

/** DAG 可视化数据 */
export interface DagVisualization {
  dispatchId: string
  nodes: Array<DagNode & { status: ExtendedDispatchStatus; result?: string }>
  edges: DagEdge[]
  executionOrder: string[][]
  hasCycle: boolean
}

/** 扩展拓扑节点(携带 dispatch 状态 + 资源统计 + 仲裁标记) */
export interface RichTopologyNode extends TopologyNode {
  dispatchStatus?: ExtendedDispatchStatus
  durationMs?: number
  tokenUsage?: number
  isArbiter?: boolean
  isDagNode?: boolean
  dagNodeStatus?: ExtendedDispatchStatus
}

/** 扩展拓扑 */
export interface RichSwarmTopology {
  nodes: RichTopologyNode[]
  edges: TopologyEdge[]
}

/** 派单创建结果:成功 dispatch / 失败 reason / 501 notImplemented / 429 concurrentLimit / 400 cyclic */
export interface DispatchCallResult {
  dispatch?: SubagentDispatch
  /** 'ok' = ai-service 调用成功;'failed' = 调用失败;'not_implemented' = 501;'concurrent_limit' = 429;'cyclic_dependency' = 400 */
  outcome: 'ok' | 'failed' | 'not_implemented' | 'concurrent_limit' | 'cyclic_dependency'
  limit?: number
  active?: number
  error?: string
}

/** resume 结果 */
export interface ResumeResult {
  dispatchId: string
  resumed: boolean
  skippedSteps: string[]
  resumedFromStep?: string
  error?: string
}

// ---------------------------------------------------------------------------
// 内部类型
// ---------------------------------------------------------------------------

/** 日志条目 */
interface LogEntry {
  ts: string
  level: 'info' | 'warn' | 'error'
  event: string
  data?: Record<string, unknown>
}

/** token 用量 */
interface TokenUsage {
  prompt: number
  completion: number
  total: number
}

/** dispatch 运行时扩展(统计 + 日志 + 重试 + DAG + 优先级 + 配额 + checkpoint + 通信) */
interface DispatchRuntime {
  dispatch: SubagentDispatch
  retry?: RetryConfig
  dag?: DagConfig
  priority: DispatchPriority
  quotas?: QuotaConfig
  steps: Array<{
    agent: string
    durationMs: number
    tokenUsage: TokenUsage
    attempt: number
    status: 'ok' | 'failed' | 'quota_exceeded'
    error?: string
  }>
  logs: LogEntry[]
  startedAt?: number
  completedAt?: number
  /** 所有重试耗尽后标记(但 dispatch 状态保持 running) */
  hasFailed: boolean
  /** checkpoint 缓存(也写 Redis) */
  checkpoints: Map<string, Checkpoint>
  /** with_communication 消息缓存 */
  messages: CommunicationMessage[]
  /** DAG 节点执行状态(stepId → status) */
  dagNodeStatus: Map<string, ExtendedDispatchStatus>
}

/** ai-service 返回的 OrchestrationResult 形状(子集,含 token 用量) */
interface AiOrchestrationResult {
  orchestration_id?: string
  final_output?: string
  status?: string
  steps?: Array<{
    agent_name?: string
    status?: string
    output?: string
    token_usage?: { prompt?: number; completion?: number; total?: number }
  }>
  token_usage?: { prompt?: number; completion?: number; total?: number }
  trace?: Array<Record<string, unknown>>
}

interface AiServiceResponse {
  code?: number
  message?: string
  data?: AiOrchestrationResult | null
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

function newId(): string {
  return `dispatch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function emptyTokenUsage(): TokenUsage {
  return { prompt: 0, completion: 0, total: 0 }
}

/** 从 ai-service 响应中提取 token 用量,缺失时按输出长度粗估 */
function extractTokenUsage(
  data: AiOrchestrationResult | null | undefined,
  finalOutput: string,
): TokenUsage {
  const direct = data?.token_usage
  if (direct && typeof direct.total === 'number' && direct.total > 0) {
    return {
      prompt: direct.prompt ?? 0,
      completion: direct.completion ?? 0,
      total: direct.total,
    }
  }
  const stepsTotal = (data?.steps ?? []).reduce(
    (acc, s) => {
      if (s.token_usage) {
        acc.prompt += s.token_usage.prompt ?? 0
        acc.completion += s.token_usage.completion ?? 0
        acc.total += s.token_usage.total ?? 0
      }
      return acc
    },
    { prompt: 0, completion: 0, total: 0 },
  )
  if (stepsTotal.total > 0) return stepsTotal
  const estimated = Math.ceil((finalOutput?.length ?? 0) / 4)
  return { prompt: 0, completion: estimated, total: estimated }
}

/**
 * 把 DispatchInput + status + result 合并为 SubagentDispatch。
 */
function buildDispatch(
  input: ExtendedDispatchInput,
  status: SubagentDispatch['status'],
  result?: string,
): SubagentDispatch {
  return {
    id: newId(),
    goal: input.goal,
    affectedFiles: input.affectedFiles,
    forbidden:
      input.forbidden && input.forbidden.length > 0
        ? input.forbidden
        : ['任何不在上述清单的文件'],
    verifyCommands: input.verifyCommands,
    constraints: input.constraints,
    deliverables: input.deliverables,
    agentRole: input.agentRole ?? 'coder',
    orchestration: input.orchestration ?? 'parallel',
    status,
    result,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
}

/** 拼装派单 prompt(把 AGENTS.md §11 强制格式作为 user_input 传给 agent) */
function buildAgentPrompt(input: DispatchInput): string {
  const forbidden: string[] =
    input.forbidden && input.forbidden.length > 0
      ? input.forbidden
      : ['任何不在上述清单的文件']
  return [
    '## 任务目标',
    input.goal,
    '',
    '## 受影响文件(绝对路径,只允许以下文件)',
    ...input.affectedFiles.map((f: string) => `- ${f}`),
    '',
    '## 禁止修改',
    ...forbidden.map((f: string) => `- ${f}`),
    '',
    '## 验证命令(子任务完成后必须自行运行)',
    ...input.verifyCommands.map((c: string) => `- ${c}`),
    '',
    '## 约束边界',
    input.constraints,
    '',
    '## 交付物',
    input.deliverables,
  ].join('\n')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// DAG 辅助函数
// ---------------------------------------------------------------------------

/**
 * 拓扑排序(Kahn 算法):返回按层级分组的节点 ID(同层可并行)。
 * 返回 null 表示有环。
 */
function topologicalSort(
  nodes: DagNode[],
  edges: DagEdge[],
): string[][] | null {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const id of nodeIds) {
    inDegree.set(id, 0)
    adj.set(id, [])
  }
  for (const e of edges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) continue
    adj.get(e.from)!.push(e.to)
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1)
  }
  const layers: string[][] = []
  const visited = new Set<string>()
  while (visited.size < nodeIds.size) {
    const layer = Array.from(nodeIds).filter(
      (id) =>
        !visited.has(id) && (inDegree.get(id) ?? 0) === 0,
    )
    if (layer.length === 0) return null // 有环
    for (const id of layer) {
      visited.add(id)
      for (const next of adj.get(id) ?? []) {
        inDegree.set(next, (inDegree.get(next) ?? 0) - 1)
      }
    }
    layers.push(layer)
  }
  return layers
}

/** 检测 DAG 是否有环(返回 true = 有环) */
function hasCycle(nodes: DagNode[], edges: DagEdge[]): boolean {
  return topologicalSort(nodes, edges) === null
}

/**
 * 评估条件边表达式。
 * 支持:
 *  - "result.includes('xxx')" → 检查 result 是否包含 xxx
 *  - "result.length > 100" → 检查 result 长度
 *  - "true" / "" → 无条件通过
 * 安全:仅支持有限表达式,不使用 eval。
 */
function evaluateCondition(condition: string | undefined, result: string): boolean {
  if (!condition || condition.trim() === '' || condition.trim() === 'true') {
    return true
  }
  const cond = condition.trim()
  // result.includes('xxx')
  const includeMatch = cond.match(/^result\.includes\(['"](.+)['"]\)$/)
  if (includeMatch) {
    return result.includes(includeMatch[1]!)
  }
  // result.length > N
  const lengthMatch = cond.match(/^result\.length\s*(>=|>|<=|<)\s*(\d+)$/)
  if (lengthMatch) {
    const op = lengthMatch[1]
    const n = parseInt(lengthMatch[2]!, 10)
    const len = result.length
    if (op === '>') return len > n
    if (op === '>=') return len >= n
    if (op === '<') return len < n
    if (op === '<=') return len <= n
  }
  // result.startsWith('xxx')
  const startsMatch = cond.match(/^result\.startsWith\(['"](.+)['"]\)$/)
  if (startsMatch) {
    return result.startsWith(startsMatch[1]!)
  }
  // 未知表达式 → 默认通过(保守策略,不阻塞执行)
  return true
}

// ---------------------------------------------------------------------------
// ai-service 调用
// ---------------------------------------------------------------------------

type AiCallResult =
  | { ok: true; finalOutput: string; data: AiOrchestrationResult | null }
  | { ok: false; reason: 'not_implemented'; message: string }
  | { ok: false; reason: 'failed'; message: string }

/**
 * 调 ai-service agent_orchestrator 对应编排接口。
 *
 * 路由映射:
 *  - pipeline → POST /api/v1/ai/agent/pipeline
 *  - parallel → POST /api/v1/ai/agent/parallel
 *  - decomposed → POST /api/v1/ai/agent/run-decomposed
 *  - debate → 调 callAiServiceDebate
 *  - vote → 调 callAiServiceVote
 *  - critique → 调 callAiServiceCritique(ai-service /agents/debate mode=critique)
 *  - with_communication → 调 callAiServiceWithCommunication(API 层 Redis 消息总线)
 */
async function callAiService(
  mode: OrchestrationMode,
  agentRole: SubagentRole,
  prompt: string,
): Promise<AiCallResult> {
  let path = ''
  let body: Record<string, unknown> = {}
  if (mode === 'pipeline') {
    path = '/api/v1/ai/agent/pipeline'
    body = {
      steps: [{ agent: agentRole, input_template: '{input}' }],
      initial_input: prompt,
    }
  } else if (mode === 'parallel') {
    path = '/api/v1/ai/agent/parallel'
    body = { items: [{ agent: agentRole, input: prompt }] }
  } else if (mode === 'decomposed') {
    path = '/api/v1/ai/agent/run-decomposed'
    body = { task: prompt, strategy: 'dag' }
  } else if (mode === 'debate') {
    return callAiServiceDebate(agentRole, prompt)
  } else if (mode === 'vote') {
    return callAiServiceVote(agentRole, prompt)
  } else if (mode === 'critique') {
    return callAiServiceCritique(agentRole, prompt)
  } else if (mode === 'with_communication') {
    return callAiServiceWithCommunication(agentRole, prompt)
  } else {
    return {
      ok: false,
      reason: 'not_implemented',
      message: `编排模式 "${mode}" 暂未支持`,
    }
  }

  return callAiServiceEndpoint(path, body)
}

/** 通用 ai-service POST 调用 */
async function callAiServiceEndpoint(
  path: string,
  body: Record<string, unknown>,
): Promise<AiCallResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_SERVICE_TIMEOUT_MS)
  try {
    const res = await fetch(`${AI_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (res.status === 404) {
      return {
        ok: false,
        reason: 'not_implemented',
        message: `ai-service 无 ${path} 路由,后端 orchestrator 集成待办`,
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        reason: 'failed',
        message: `ai-service 返回 ${res.status} ${res.statusText}`,
      }
    }
    const json = (await res.json()) as AiServiceResponse
    if (typeof json.code !== 'number' || json.code !== 0) {
      return {
        ok: false,
        reason: 'failed',
        message: json.message || 'ai-service 业务失败',
      }
    }
    const data = json.data ?? {}
    const finalOutput =
      typeof data.final_output === 'string' && data.final_output.length > 0
        ? data.final_output
        : (data.steps ?? [])
            .map((s) => `[${s.agent_name ?? 'agent'}]: ${s.output ?? ''}`)
            .join('\n')
    return { ok: true, finalOutput, data }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      reason: 'failed',
      message: `ai-service 调用失败: ${msg}`,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * debate 模式:多 agent 处理同一任务 → LLM 仲裁选择最佳 + 合并。
 */
async function callAiServiceDebate(
  primaryRole: SubagentRole,
  prompt: string,
): Promise<AiCallResult> {
  const parallelBody = {
    items: ALL_ROLES.map((r) => ({ agent: r, input: prompt })),
  }
  const parallelRes = await callAiServiceEndpoint(
    '/api/v1/ai/agent/parallel',
    parallelBody,
  )
  if (!parallelRes.ok) return parallelRes

  const parallelData = parallelRes.data
  const allResults: Array<{ agent: string; output: string }> =
    (parallelData?.steps ?? []).map((s) => ({
      agent: s.agent_name ?? primaryRole,
      output: s.output ?? '',
    }))

  if (allResults.length === 0) {
    return { ok: true, finalOutput: parallelRes.finalOutput, data: parallelData }
  }

  const arbitrationPrompt = [
    '以下是多个 AI agent 对同一任务的独立结果,请选择最佳结果并进行合并优化。',
    '在回答开头用 [winner:agent_name] 标注最佳结果的 agent,然后给出合并后的最终输出。',
    '',
    '任务:' + prompt,
    '',
    '各 agent 结果:',
    ...allResults.map((r, i) => `--- Agent ${i + 1} (${r.agent}) ---\n${r.output}`),
  ].join('\n')

  const arbiterRes = await callAiServiceEndpoint(
    '/api/v1/ai/agent/run-decomposed',
    { task: arbitrationPrompt, strategy: 'dag' },
  )
  if (!arbiterRes.ok) return arbiterRes

  const winnerMatch = arbiterRes.finalOutput.match(
    /\[winner:\s*([^\]]+)\]/i,
  )
  const winningAgent = winnerMatch
    ? winnerMatch[1]!.trim()
    : allResults[0]!.agent

  const mergedResult = arbiterRes.finalOutput.replace(
    /\[winner:\s*[^\]]+\]/i,
    '',
  ).trim()

  const debateSummary = `共 ${allResults.length} 个 agent 参与辩论,胜出 agent: ${winningAgent}`

  const compositeOutput = JSON.stringify({
    winningAgent,
    mergedResult,
    allResults,
    debateSummary,
  } satisfies DebateResult)

  return {
    ok: true,
    finalOutput: compositeOutput,
    data: arbiterRes.data,
  }
}

/**
 * vote 模式:多 agent 处理同一任务 → 每个 agent 对其他结果投票(1-5 分)→ 最高分胜出。
 */
async function callAiServiceVote(
  primaryRole: SubagentRole,
  prompt: string,
): Promise<AiCallResult> {
  const parallelBody = {
    items: ALL_ROLES.map((r) => ({ agent: r, input: prompt })),
  }
  const parallelRes = await callAiServiceEndpoint(
    '/api/v1/ai/agent/parallel',
    parallelBody,
  )
  if (!parallelRes.ok) return parallelRes

  const parallelData = parallelRes.data
  const allResults: Array<{ agent: string; output: string }> =
    (parallelData?.steps ?? []).map((s) => ({
      agent: s.agent_name ?? primaryRole,
      output: s.output ?? '',
    }))

  if (allResults.length === 0) {
    return { ok: true, finalOutput: parallelRes.finalOutput, data: parallelData }
  }

  const votePromptBase = [
    '以下是多个 AI agent 对同一任务的独立结果。',
    '请作为评审,对除自己以外的每个 agent 的结果打分(1-5 分,5=最佳)。',
    '输出格式:每行一个 "agent_name:score",不要其他内容。',
    '',
    '任务:' + prompt,
    '',
    '各 agent 结果:',
    ...allResults.map((r, i) => `--- Agent ${i + 1} (${r.agent}) ---\n${r.output}`),
  ].join('\n')

  const voteBody = {
    items: ALL_ROLES.map((r) => ({ agent: r, input: votePromptBase })),
  }
  const voteRes = await callAiServiceEndpoint(
    '/api/v1/ai/agent/parallel',
    voteBody,
  )
  if (!voteRes.ok) return voteRes

  const votes: Array<{ voter: string; candidate: string; score: number }> = []
  const voteData = voteRes.data
  for (const step of voteData?.steps ?? []) {
    const voter = step.agent_name ?? primaryRole
    const output = step.output ?? ''
    const lines = output.split('\n')
    for (const line of lines) {
      const match = line.match(/([\w_]+)\s*[:：]\s*(\d)/i)
      if (match) {
        const candidate = match[1]!.trim()
        const score = Math.min(5, Math.max(1, parseInt(match[2]!, 10)))
        votes.push({ voter, candidate, score })
      }
    }
  }

  const scoreMap = new Map<string, number>()
  for (const v of votes) {
    scoreMap.set(v.candidate, (scoreMap.get(v.candidate) ?? 0) + v.score)
  }

  let winningAgent = allResults[0]!.agent
  let maxScore = -1
  for (const [agent, score] of scoreMap) {
    if (score > maxScore) {
      maxScore = score
      winningAgent = agent
    }
  }

  const winnerResult =
    allResults.find((r) => r.agent === winningAgent)?.output ??
    allResults[0]!.output

  const compositeOutput = JSON.stringify({
    winningAgent,
    winnerResult,
    votes,
  } satisfies VoteResult)

  return {
    ok: true,
    finalOutput: compositeOutput,
    data: voteRes.data,
  }
}

/**
 * critique 模式:多 agent 互相批判 + 修订。
 *
 * 流程(3 轮):
 *  1. 第 1 轮:N 个 agent 并行处理同一任务
 *  2. 第 2 轮:每个 agent 看到其他 agent 的结果,生成批判意见
 *  3. 第 3 轮:每个 agent 根据批判意见修订自己的结果
 *  4. LLM 仲裁选择最佳修订结果
 *
 * 调用 ai-service POST /api/v1/ai/agents/debate with mode="critique"
 * 降级:404 → not_implemented(501)
 */
async function callAiServiceCritique(
  primaryRole: SubagentRole,
  prompt: string,
): Promise<AiCallResult> {
  // 尝试调 ai-service /agents/debate with mode=critique
  const debatePath = '/api/v1/ai/agents/debate'
  const debateBody = {
    mode: 'critique',
    agents: ALL_ROLES,
    topic: prompt,
    maxRounds: 3,
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_SERVICE_TIMEOUT_MS * 3)
  try {
    const res = await fetch(`${AI_SERVICE_URL}${debatePath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(debateBody),
      signal: controller.signal,
    })
    if (res.status === 404) {
      return {
        ok: false,
        reason: 'not_implemented',
        message: `ai-service 无 ${debatePath} 路由,critique 编排模式暂未集成`,
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        reason: 'failed',
        message: `ai-service critique 返回 ${res.status} ${res.statusText}`,
      }
    }
    const json = (await res.json()) as AiServiceResponse
    if (typeof json.code !== 'number' || json.code !== 0) {
      return {
        ok: false,
        reason: 'failed',
        message: json.message || 'ai-service critique 业务失败',
      }
    }

    const data = json.data ?? {}
    const finalOutput =
      typeof data.final_output === 'string' && data.final_output.length > 0
        ? data.final_output
        : ''

    // 尝试从 trace 中提取 rounds 信息
    const rounds: CritiqueRound[] = []
    const trace = data.trace ?? []
    for (let i = 0; i < trace.length; i++) {
      const entry = trace[i]!
      const round = entry['round'] as number | undefined
      const phase = entry['phase'] as string | undefined
      if (round !== undefined && phase) {
        const existing = rounds.find((r) => r.round === round)
        if (existing) {
          if (phase === 'critique') {
            const agent = (entry['agent'] as string) ?? primaryRole
            const target = (entry['target'] as string) ?? ''
            const critique = (entry['critique'] as string) ?? ''
            existing.critiques.push({ agent, target, critique })
          }
        } else {
          const results: Array<{ agent: string; output: string }> = []
          const steps = data.steps ?? []
          for (const s of steps) {
            if (s.agent_name) {
              results.push({ agent: s.agent_name, output: s.output ?? '' })
            }
          }
          rounds.push({ round, results, critiques: [] })
        }
      }
    }

    // 如果 trace 无结构化 rounds,构造简化版本
    if (rounds.length === 0) {
      const allResults: Array<{ agent: string; output: string }> =
        (data.steps ?? []).map((s) => ({
          agent: s.agent_name ?? primaryRole,
          output: s.output ?? '',
        }))
      rounds.push({ round: 1, results: allResults, critiques: [] })
    }

    // 提取 winning agent(从 final_output 解析 [winner:xxx])
    const winnerMatch = finalOutput.match(/\[winner:\s*([^\]]+)\]/i)
    const winningAgent = winnerMatch
      ? winnerMatch[1]!.trim()
      : (rounds[rounds.length - 1]?.results[0]?.agent ?? primaryRole)

    const critiqueResult: CritiqueResult = {
      rounds,
      finalResult: finalOutput,
      winningAgent,
    }

    const compositeOutput = JSON.stringify(critiqueResult)

    return {
      ok: true,
      finalOutput: compositeOutput,
      data,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      reason: 'failed',
      message: `ai-service critique 调用失败: ${msg}`,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * with_communication 模式:agent 间通过消息总线通信。
 *
 * 流程(3 轮):
 *  1. 每个 agent 有独立 inbox(Redis list "subagent:inbox:{agentId}")
 *  2. 每轮:agent 读取 inbox → 处理任务 → 发送 result 消息到其他 agent
 *  3. 协调者控制通信轮次(默认 3 轮)
 *
 * 消息格式:{ from, to, type("question"/"answer"/"result"), content, timestamp, round }
 * 返回:{ messages, finalResults, rounds }
 *
 * 降级:Redis 不可用时用内存 queue
 */
async function callAiServiceWithCommunication(
  primaryRole: SubagentRole,
  prompt: string,
  redisClient?: Redis | null,
): Promise<AiCallResult> {
  const roles = ALL_ROLES
  const messages: CommunicationMessage[] = []
  const inMemoryInboxes = new Map<string, CommunicationMessage[]>()
  for (const r of roles) {
    inMemoryInboxes.set(r, [])
  }

  /** 发送消息到 agent inbox */
  const sendMessage = async (msg: CommunicationMessage): Promise<void> => {
    messages.push(msg)
    // 内存 inbox
    const memInbox = inMemoryInboxes.get(msg.to)
    if (memInbox) memInbox.push(msg)
    // Redis inbox(降级安全)
    if (redisClient) {
      try {
        await redisClient.lpush(
          `${REDIS_KEY_INBOX}${msg.to}`,
          JSON.stringify(msg),
        )
      } catch {
        // Redis 不可用 → 内存降级
      }
    }
  }

  const finalResults: Array<{ agent: string; output: string }> = []

  // 3 轮通信
  for (let round = 1; round <= DEFAULT_COMM_ROUNDS; round++) {
    // 每个 agent 读取 inbox + 处理任务
    const agentInputs = roles.map((r) => {
      const inboxMsgs = inMemoryInboxes.get(r) ?? []
      const contextMsgs = inboxMsgs
        .map(
          (m) =>
            `[来自 ${m.from} 的${m.type === 'question' ? '提问' : m.type === 'answer' ? '回答' : '结果'}]: ${m.content}`,
        )
        .join('\n')
      const taskPrompt =
        round === 1
          ? prompt
          : `轮次 ${round}/${DEFAULT_COMM_ROUNDS}\n\n原始任务:\n${prompt}\n\n其他 agent 的消息:\n${contextMsgs}\n\n请基于以上信息继续处理任务,并给出你的当前结果。`
      return { agent: r, input: taskPrompt }
    })

    // 并行调 ai-service
    const parallelRes = await callAiServiceEndpoint(
      '/api/v1/ai/agent/parallel',
      { items: agentInputs },
    )

    if (!parallelRes.ok) {
      // 第 1 轮失败 → 直接返回失败
      if (round === 1) return parallelRes
      // 后续轮失败 → 用已有结果降级返回
      break
    }

    // 提取各 agent 结果
    const stepResults = parallelRes.data?.steps ?? []
    const roundResults: Array<{ agent: string; output: string }> = []
    for (const s of stepResults) {
      const agent = s.agent_name ?? primaryRole
      const output = s.output ?? ''
      roundResults.push({ agent, output })
    }

    // 更新 finalResults(最后一轮的结果)
    finalResults.length = 0
    finalResults.push(...roundResults)

    // 每个 agent 发送 result 消息到其他 agent(为下一轮准备)
    if (round < DEFAULT_COMM_ROUNDS) {
      for (const r of roundResults) {
        for (const other of roles) {
          if (other === r.agent) continue
          await sendMessage({
            from: r.agent,
            to: other,
            type: 'result',
            content: r.output.slice(0, 500), // 截断避免消息过长
            timestamp: nowIso(),
            round,
          })
        }
      }
    }
  }

  const result: WithCommunicationResult = {
    messages,
    finalResults,
    rounds: DEFAULT_COMM_ROUNDS,
  }

  return {
    ok: true,
    finalOutput: JSON.stringify(result),
    data: null,
  }
}

// ---------------------------------------------------------------------------
// 服务单例
// ---------------------------------------------------------------------------

/**
 * 单例服务:维护 active dispatches Map + Redis 持久化 + 拓扑推导。
 *
 * 深化 v2:
 *  - critique/with_communication 编排模式
 *  - DAG 依赖图(拓扑排序 + 循环检测 + 条件边)
 *  - Checkpoint 恢复(每步写 Redis hash,失败后从断点续跑)
 *  - 优先级调度(urgent 可抢占)
 *  - 资源配额(超时/超 token kill agent)
 *  - Redis 持久化 + 失败重试 + 并发控制 + debate/vote
 *  - 资源消耗统计
 */
class SubagentDispatchService {
  private runtimes = new Map<string, DispatchRuntime>()
  private redisClient: Redis | null = null
  private readonly _maxConcurrent = DEFAULT_MAX_CONCURRENT
  private _stats = {
    totalDispatches: 0,
    totalTokens: 0,
    totalDurationMs: 0,
  }

  constructor(redisClient?: Redis | null) {
    if (redisClient) {
      this.redisClient = redisClient
      void this._loadActiveDispatches()
    }
  }

  /** 注入 Redis 客户端(fastify 装饰器挂载后调用) */
  async setRedisClient(client: Redis | null): Promise<void> {
    this.redisClient = client
    if (client) {
      await this._loadActiveDispatches()
    }
  }

  // ---------- Redis 持久化(降级内存) ----------

  /** dispatch 状态变更时写入 Redis hash */
  private async _persistDispatch(id: string): Promise<void> {
    const runtime = this.runtimes.get(id)
    if (!runtime) return
    const d = runtime.dispatch
    if (!this.redisClient) return
    try {
      const key = `${REDIS_KEY_DISPATCH}${id}`
      await this.redisClient.hset(key, {
        id: d.id,
        goal: d.goal,
        affectedFiles: JSON.stringify(d.affectedFiles),
        forbidden: JSON.stringify(d.forbidden),
        verifyCommands: JSON.stringify(d.verifyCommands),
        constraints: d.constraints,
        deliverables: d.deliverables,
        agentRole: d.agentRole ?? '',
        orchestration: d.orchestration ?? '',
        status: d.status,
        result: d.result ?? '',
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        retry: runtime.retry ? JSON.stringify(runtime.retry) : '',
        dag: runtime.dag ? JSON.stringify(runtime.dag) : '',
        priority: runtime.priority,
        quotas: runtime.quotas ? JSON.stringify(runtime.quotas) : '',
      })
      await this.redisClient.sadd(REDIS_KEY_IDS, id)
      // 优先级队列
      await this.redisClient.zadd(
        REDIS_KEY_QUEUE,
        PRIORITY_SCORE[runtime.priority],
        id,
      )
    } catch {
      // Redis 不可用 → 降级内存,不抛异常
    }
  }

  /** 执行日志写入 Redis list(LPUSH + LTRIM 保留 500 条) */
  private async _persistLog(id: string, entry: LogEntry): Promise<void> {
    const runtime = this.runtimes.get(id)
    if (runtime) {
      runtime.logs.push(entry)
      if (runtime.logs.length > LOG_MAX_ENTRIES) {
        runtime.logs = runtime.logs.slice(-LOG_MAX_ENTRIES)
      }
    }
    if (!this.redisClient) return
    try {
      const key = `${REDIS_KEY_LOGS}${id}`
      await this.redisClient.lpush(key, JSON.stringify(entry))
      await this.redisClient.ltrim(key, 0, LOG_MAX_ENTRIES - 1)
    } catch {
      // Redis 不可用 → 降级内存,不抛异常
    }
  }

  /** 写 checkpoint 到 Redis hash(每步完成时调用) */
  private async _writeCheckpoint(
    dispatchId: string,
    checkpoint: Checkpoint,
  ): Promise<void> {
    const runtime = this.runtimes.get(dispatchId)
    if (runtime) {
      runtime.checkpoints.set(checkpoint.stepId, checkpoint)
    }
    if (!this.redisClient) return
    try {
      const key = `${REDIS_KEY_CHECKPOINT}${dispatchId}`
      await this.redisClient.hset(key, checkpoint.stepId, JSON.stringify(checkpoint))
      await this.redisClient.expire(key, CHECKPOINT_TTL_SEC)
    } catch {
      // Redis 不可用 → 降级内存,不抛异常
    }
  }

  /** 加载所有 checkpoint(用于 resume) */
  private async _loadCheckpoints(dispatchId: string): Promise<Map<string, Checkpoint>> {
    const result = new Map<string, Checkpoint>()
    // 内存优先
    const runtime = this.runtimes.get(dispatchId)
    if (runtime) {
      for (const [k, v] of runtime.checkpoints) {
        result.set(k, v)
      }
    }
    // Redis 补充
    if (this.redisClient) {
      try {
        const key = `${REDIS_KEY_CHECKPOINT}${dispatchId}`
        const raw = await this.redisClient.hgetall(key)
        for (const [stepId, json] of Object.entries(raw)) {
          if (!result.has(stepId)) {
            try {
              result.set(stepId, JSON.parse(json) as Checkpoint)
            } catch {
              // 跳过损坏 checkpoint
            }
          }
        }
      } catch {
        // Redis 不可用 → 内存降级
      }
    }
    return result
  }

  /** 初始化时从 Redis 加载所有活跃 dispatch */
  private async _loadActiveDispatches(): Promise<void> {
    if (!this.redisClient) return
    try {
      const ids = await this.redisClient.smembers(REDIS_KEY_IDS)
      for (const id of ids) {
        const key = `${REDIS_KEY_DISPATCH}${id}`
        const raw = await this.redisClient.hgetall(key)
        if (!raw || !raw.id) continue
        const status = raw.status as DispatchStatus
        if (status !== 'pending' && status !== 'running') continue
        const dispatch: SubagentDispatch = {
          id: raw.id,
          goal: raw.goal || '',
          affectedFiles: JSON.parse(raw.affectedFiles || '[]'),
          forbidden: JSON.parse(raw.forbidden || '[]'),
          verifyCommands: JSON.parse(raw.verifyCommands || '[]'),
          constraints: raw.constraints || '',
          deliverables: raw.deliverables || '',
          agentRole: (raw.agentRole || 'coder') as SubagentRole,
          orchestration: (raw.orchestration || 'parallel') as OrchestrationMode,
          status,
          result: raw.result || undefined,
          createdAt: raw.createdAt || nowIso(),
          updatedAt: raw.updatedAt || nowIso(),
        }
        const retry = raw.retry
          ? (JSON.parse(raw.retry) as RetryConfig)
          : undefined
        const dag = raw.dag
          ? (JSON.parse(raw.dag) as DagConfig)
          : undefined
        const priority = (raw.priority as DispatchPriority) || 'normal'
        const quotas = raw.quotas
          ? (JSON.parse(raw.quotas) as QuotaConfig)
          : undefined
        this.runtimes.set(id, {
          dispatch,
          retry,
          dag,
          priority,
          quotas,
          steps: [],
          logs: [],
          hasFailed: false,
          checkpoints: new Map(),
          messages: [],
          dagNodeStatus: new Map(),
        })
      }
    } catch {
      // Redis 不可用 → 降级内存,不抛异常
    }
  }

  // ---------- 主方法 ----------

  /** 创建并派发:检查并发 → 入 Map → DAG 校验 → 异步调 ai-service */
  async dispatch(
    input: ExtendedDispatchInput,
  ): Promise<DispatchCallResult> {
    // DAG 循环检测
    if (input.dag) {
      if (hasCycle(input.dag.nodes, input.dag.edges)) {
        return {
          outcome: 'cyclic_dependency',
          error: 'DAG 存在循环依赖,无法执行',
        }
      }
    }

    // 优先级调度:urgent 可抢占
    const priority: DispatchPriority = input.priority ?? 'normal'
    if (priority === 'urgent') {
      const activeCount = this.listActive().length
      if (activeCount >= this._maxConcurrent) {
        // 尝试抢占最低优先级的 running dispatch
        const preempted = this._tryPreempt()
        if (!preempted) {
          return {
            outcome: 'concurrent_limit',
            limit: this._maxConcurrent,
            active: activeCount,
            error: `并发派单数已达上限 ${this._maxConcurrent},且无低优先级可抢占`,
          }
        }
      }
    } else {
      // 非 urgent:正常并发检查
      const activeCount = this.listActive().length
      if (activeCount >= this._maxConcurrent) {
        return {
          outcome: 'concurrent_limit',
          limit: this._maxConcurrent,
          active: activeCount,
          error: `并发派单数已达上限 ${this._maxConcurrent}`,
        }
      }
    }

    const role: SubagentRole = input.agentRole ?? 'coder'
    const mode: OrchestrationMode = input.orchestration ?? 'parallel'
    const prompt = buildAgentPrompt(input)

    // 校验 retry 配置
    const retry: RetryConfig | undefined = input.retry
      ? {
          maxAttempts: Math.min(
            MAX_RETRY_ATTEMPTS,
            Math.max(1, input.retry.maxAttempts),
          ),
          delayMs: Math.max(0, input.retry.delayMs),
        }
      : undefined

    // 校验 quotas
    const quotas: QuotaConfig | undefined = input.quotas
      ? {
          timeoutMs: Math.max(1000, input.quotas.timeoutMs),
          tokenQuota: Math.max(1000, input.quotas.tokenQuota),
          maxRetries: Math.min(MAX_RETRY_ATTEMPTS, Math.max(0, input.quotas.maxRetries)),
        }
      : undefined

    // DAG
    const dag = input.dag

    // 先入 Map(pending),保证 GET /active 立即能看到
    const pending = buildDispatch(input, 'pending')
    this.runtimes.set(pending.id, {
      dispatch: pending,
      retry,
      dag,
      priority,
      quotas,
      steps: [],
      logs: [],
      hasFailed: false,
      checkpoints: new Map(),
      messages: [],
      dagNodeStatus: new Map(),
    })
    await this._persistDispatch(pending.id)
    await this._persistLog(pending.id, {
      ts: nowIso(),
      level: 'info',
      event: 'dispatch_created',
      data: { mode, role, retry, priority, hasDag: !!dag, hasQuotas: !!quotas },
    })

    this._stats.totalDispatches++

    // 异步调 ai-service(不 await,立即返回 pending)
    // with_communication 需要 Redis client
    if (mode === 'with_communication') {
      void this.runDispatchWithCommunication(pending.id, role, prompt, retry, quotas)
    } else if (dag && mode === 'parallel') {
      // DAG 模式:按拓扑排序执行
      void this.runDispatchDag(pending.id, prompt, retry, quotas)
    } else {
      void this.runDispatch(pending.id, mode, role, prompt, retry, quotas)
    }

    return { dispatch: pending, outcome: 'ok' }
  }

  /**
   * 尝试抢占最低优先级的 running dispatch。
   * 仅 urgent 可以抢占 low/normal。
   * 返回 true = 抢占成功。
   */
  private _tryPreempt(): boolean {
    const candidates = Array.from(this.runtimes.values())
      .filter((r) => r.dispatch.status === 'running' || r.dispatch.status === 'pending')
      .filter((r) => r.priority === 'low' || r.priority === 'normal')
      .sort((a, b) => PRIORITY_SCORE[a.priority] - PRIORITY_SCORE[b.priority])
    if (candidates.length === 0) return false
    const target = candidates[0]!
    target.dispatch.status = 'preempted' as DispatchStatus
    target.dispatch.updatedAt = nowIso()
    target.completedAt = Date.now()
    void this._persistDispatch(target.dispatch.id)
    void this._persistLog(target.dispatch.id, {
      ts: nowIso(),
      level: 'warn',
      event: 'dispatch_preempted',
      data: { originalPriority: target.priority },
    })
    return true
  }

  /** 实际执行 ai-service 调用,更新 dispatch 状态 + 重试 + 统计 + checkpoint + 配额监控 */
  private async runDispatch(
    id: string,
    mode: OrchestrationMode,
    role: SubagentRole,
    prompt: string,
    retry?: RetryConfig,
    quotas?: QuotaConfig,
  ): Promise<void> {
    const runtime = this.runtimes.get(id)
    if (!runtime) return
    const dispatch = runtime.dispatch

    // 标记 running
    dispatch.status = 'running'
    dispatch.updatedAt = nowIso()
    runtime.startedAt = Date.now()
    await this._persistDispatch(id)
    await this._persistLog(id, {
      ts: nowIso(),
      level: 'info',
      event: 'dispatch_started',
      data: { mode, role },
    })

    const maxAttempts = retry?.maxAttempts ?? quotas?.maxRetries ? Math.max(retry?.maxAttempts ?? 1, (quotas?.maxRetries ?? 0) + 1) : 1
    const delayMs = retry?.delayMs ?? 1000
    const timeoutMs = quotas?.timeoutMs ?? 0
    const tokenQuota = quotas?.tokenQuota ?? 0

    let attempt = 0
    while (attempt < maxAttempts) {
      attempt++
      const stepStart = Date.now()

      // 超时监控(用 Promise.race)
      const callPromise = callAiService(mode, role, prompt)
      const result = timeoutMs > 0
        ? await Promise.race([
            callPromise,
            new Promise<AiCallResult>((resolve) =>
              setTimeout(
                () =>
                  resolve({
                    ok: false,
                    reason: 'failed',
                    message: `agent 超时(> ${timeoutMs}ms)`,
                  }),
                timeoutMs,
              ),
            ),
          ])
        : await callPromise

      const stepDuration = Date.now() - stepStart
      const tokenUsage = result.ok
        ? extractTokenUsage(result.data, result.finalOutput)
        : emptyTokenUsage()

      // 配额检查:token 超限
      const tokenExceeded = tokenQuota > 0 && tokenUsage.total > tokenQuota
      const timeoutExceeded = timeoutMs > 0 && stepDuration > timeoutMs

      if (tokenExceeded || timeoutExceeded) {
        const quotaError = tokenExceeded
          ? `token 超限(${tokenUsage.total} > ${tokenQuota})`
          : `超时(${stepDuration}ms > ${timeoutMs}ms)`
        runtime.steps.push({
          agent: role,
          durationMs: stepDuration,
          tokenUsage,
          attempt,
          status: 'quota_exceeded',
          error: quotaError,
        })
        // 写 checkpoint
        await this._writeCheckpoint(id, {
          stepId: `step-${attempt}`,
          agentRole: role,
          status: 'quota_exceeded',
          timestamp: nowIso(),
          tokenUsage: tokenUsage.total,
          durationMs: stepDuration,
        })
        // 标记 dispatch 为 quota_exceeded
        dispatch.status = 'quota_exceeded' as DispatchStatus
        dispatch.result = quotaError
        runtime.completedAt = Date.now()
        runtime.hasFailed = true
        this._updateStats(runtime)
        await this._persistDispatch(id)
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'error',
          event: 'dispatch_quota_exceeded',
          data: { attempt, error: quotaError, tokens: tokenUsage.total, durationMs: stepDuration },
        })
        return
      }

      // 记录 step
      runtime.steps.push({
        agent: role,
        durationMs: stepDuration,
        tokenUsage,
        attempt,
        status: result.ok ? 'ok' : 'failed',
        error: result.ok ? undefined : result.message,
      })

      if (result.ok) {
        // 写 checkpoint
        await this._writeCheckpoint(id, {
          stepId: `step-${attempt}`,
          agentRole: role,
          status: 'ok',
          result: result.finalOutput,
          timestamp: nowIso(),
          tokenUsage: tokenUsage.total,
          durationMs: stepDuration,
        })
        // 成功
        dispatch.status = 'completed'
        dispatch.result = result.finalOutput
        runtime.completedAt = Date.now()
        runtime.hasFailed = false
        this._updateStats(runtime)
        await this._persistDispatch(id)
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'info',
          event: 'dispatch_completed',
          data: {
            durationMs: runtime.completedAt - (runtime.startedAt ?? 0),
            tokens: tokenUsage.total,
            attempt,
          },
        })
        return
      }

      // not_implemented → 不重试,直接标记 failed
      if (result.reason === 'not_implemented') {
        dispatch.status = 'failed'
        dispatch.result = result.message
        runtime.completedAt = Date.now()
        runtime.hasFailed = true
        this._updateStats(runtime)
        await this._persistDispatch(id)
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'error',
          event: 'dispatch_not_implemented',
          data: { message: result.message },
        })
        return
      }

      // failed → 检查是否还有重试机会
      if (attempt < maxAttempts) {
        const waitMs = delayMs * (2 ** (attempt - 1))
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'warn',
          event: 'step_retry',
          data: { attempt, error: result.message, waitMs },
        })
        await sleep(waitMs)
      } else {
        // 重试耗尽 → 标记 step failed
        runtime.hasFailed = true
        dispatch.status = 'failed'
        dispatch.result = result.message
        runtime.completedAt = Date.now()
        this._updateStats(runtime)
        await this._persistDispatch(id)
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'error',
          event: 'dispatch_failed',
          data: { attempt, error: result.message, maxAttempts },
        })
        return
      }
    }
  }

  /** DAG 模式执行:按拓扑排序分层,同层并行,条件边评估 */
  private async runDispatchDag(
    id: string,
    prompt: string,
    _retry?: RetryConfig,
    _quotas?: QuotaConfig,
  ): Promise<void> {
    const runtime = this.runtimes.get(id)
    if (!runtime || !runtime.dag) return
    const dispatch = runtime.dispatch
    const dag = runtime.dag

    dispatch.status = 'running'
    dispatch.updatedAt = nowIso()
    runtime.startedAt = Date.now()
    await this._persistDispatch(id)
    await this._persistLog(id, {
      ts: nowIso(),
      level: 'info',
      event: 'dag_started',
      data: { nodes: dag.nodes.length, edges: dag.edges.length },
    })

    // 拓扑排序(已在 dispatch 入口校验无环)
    const layers = topologicalSort(dag.nodes, dag.edges)
    if (!layers) {
      dispatch.status = 'failed'
      dispatch.result = 'DAG 存在循环依赖'
      runtime.completedAt = Date.now()
      await this._persistDispatch(id)
      return
    }

    // 加载 checkpoint(用于 resume)
    const checkpoints = await this._loadCheckpoints(id)
    const nodeMap = new Map(dag.nodes.map((n) => [n.id, n]))
    const results = new Map<string, string>()

    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
      const layer = layers[layerIdx]!
      // 同层并行
      const layerPromises = layer.map(async (nodeId) => {
        const node = nodeMap.get(nodeId)
        if (!node) return

        // checkpoint 命中 → 跳过
        const cp = checkpoints.get(nodeId)
        if (cp && cp.status === 'ok') {
          results.set(nodeId, cp.result ?? '')
          runtime.dagNodeStatus.set(nodeId, 'completed')
          return
        }

        runtime.dagNodeStatus.set(nodeId, 'running')
        await this._persistDispatch(id)

        // 构造 prompt:原始 + 上游结果
        const upstreamEdges = dag.edges.filter((e) => e.to === nodeId)
        const upstreamContext = upstreamEdges
          .map((e) => {
            const upstreamResult = results.get(e.from) ?? ''
            return `[上游 ${e.from} 结果]: ${upstreamResult.slice(0, 500)}`
          })
          .join('\n')
        const nodePrompt = upstreamContext
          ? `${prompt}\n\n${upstreamContext}\n\n请处理当前节点任务: ${node.task}`
          : `${prompt}\n\n请处理当前节点任务: ${node.task}`

        const stepStart = Date.now()
        const callResult = await callAiService('parallel', node.agentRole, nodePrompt)
        const stepDuration = Date.now() - stepStart
        const tokenUsage = callResult.ok
          ? extractTokenUsage(callResult.data, callResult.finalOutput)
          : emptyTokenUsage()

        if (callResult.ok) {
          results.set(nodeId, callResult.finalOutput)
          runtime.dagNodeStatus.set(nodeId, 'completed')
          // 写 checkpoint
          await this._writeCheckpoint(id, {
            stepId: nodeId,
            agentRole: node.agentRole,
            status: 'ok',
            result: callResult.finalOutput,
            timestamp: nowIso(),
            tokenUsage: tokenUsage.total,
            durationMs: stepDuration,
          })
          runtime.steps.push({
            agent: node.agentRole,
            durationMs: stepDuration,
            tokenUsage,
            attempt: 1,
            status: 'ok',
          })
        } else {
          runtime.dagNodeStatus.set(nodeId, 'failed')
          await this._writeCheckpoint(id, {
            stepId: nodeId,
            agentRole: node.agentRole,
            status: 'failed',
            timestamp: nowIso(),
            tokenUsage: tokenUsage.total,
            durationMs: stepDuration,
          })
          runtime.steps.push({
            agent: node.agentRole,
            durationMs: stepDuration,
            tokenUsage,
            attempt: 1,
            status: 'failed',
            error: callResult.message,
          })
        }
      })

      await Promise.all(layerPromises)

      // 评估条件边:决定下游节点是否继续
      for (const nodeId of layer) {
        const nodeResult = results.get(nodeId) ?? ''
        const downstreamEdges = dag.edges.filter((e) => e.from === nodeId)
        for (const edge of downstreamEdges) {
          const shouldContinue = evaluateCondition(edge.condition, nodeResult)
          if (!shouldContinue) {
            // 条件不满足 → 标记下游节点为 cancelled(跳过)
            runtime.dagNodeStatus.set(edge.to, 'cancelled' as ExtendedDispatchStatus)
            await this._persistLog(id, {
              ts: nowIso(),
              level: 'info',
              event: 'dag_edge_condition_false',
              data: { from: edge.from, to: edge.to, condition: edge.condition },
            })
          }
        }
      }
    }

    // 汇总结果
    const allResults = Array.from(results.entries())
      .map(([nid, output]) => `[${nid}]: ${output}`)
      .join('\n')
    const hasFailed = Array.from(runtime.dagNodeStatus.values()).some(
      (s) => s === 'failed',
    )

    dispatch.status = hasFailed ? 'failed' : 'completed'
    dispatch.result = allResults
    runtime.completedAt = Date.now()
    runtime.hasFailed = hasFailed
    this._updateStats(runtime)
    await this._persistDispatch(id)
    await this._persistLog(id, {
      ts: nowIso(),
      level: hasFailed ? 'error' : 'info',
      event: 'dag_completed',
      data: { layers: layers.length, nodes: dag.nodes.length, hasFailed },
    })
  }

  /** with_communication 模式执行 */
  private async runDispatchWithCommunication(
    id: string,
    role: SubagentRole,
    prompt: string,
    retry?: RetryConfig,
    _quotas?: QuotaConfig,
  ): Promise<void> {
    const runtime = this.runtimes.get(id)
    if (!runtime) return
    const dispatch = runtime.dispatch

    dispatch.status = 'running'
    dispatch.updatedAt = nowIso()
    runtime.startedAt = Date.now()
    await this._persistDispatch(id)
    await this._persistLog(id, {
      ts: nowIso(),
      level: 'info',
      event: 'with_communication_started',
      data: { rounds: DEFAULT_COMM_ROUNDS },
    })

    const maxAttempts = retry?.maxAttempts ?? 1
    const delayMs = retry?.delayMs ?? 1000

    let attempt = 0
    while (attempt < maxAttempts) {
      attempt++
      const stepStart = Date.now()

      const result = await callAiServiceWithCommunication(role, prompt, this.redisClient)
      const stepDuration = Date.now() - stepStart
      const tokenUsage = result.ok
        ? extractTokenUsage(result.data, result.finalOutput)
        : emptyTokenUsage()

      runtime.steps.push({
        agent: role,
        durationMs: stepDuration,
        tokenUsage,
        attempt,
        status: result.ok ? 'ok' : 'failed',
        error: result.ok ? undefined : result.message,
      })

      if (result.ok) {
        // 解析消息缓存
        try {
          const parsed = JSON.parse(result.finalOutput) as WithCommunicationResult
          runtime.messages = parsed.messages
        } catch {
          // 解析失败 → 不影响结果
        }
        // 写 checkpoint
        await this._writeCheckpoint(id, {
          stepId: `comm-${attempt}`,
          agentRole: role,
          status: 'ok',
          result: result.finalOutput,
          timestamp: nowIso(),
          tokenUsage: tokenUsage.total,
          durationMs: stepDuration,
        })
        dispatch.status = 'completed'
        dispatch.result = result.finalOutput
        runtime.completedAt = Date.now()
        runtime.hasFailed = false
        this._updateStats(runtime)
        await this._persistDispatch(id)
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'info',
          event: 'with_communication_completed',
          data: { durationMs: stepDuration, tokens: tokenUsage.total },
        })
        return
      }

      if (result.reason === 'not_implemented') {
        dispatch.status = 'failed'
        dispatch.result = result.message
        runtime.completedAt = Date.now()
        runtime.hasFailed = true
        this._updateStats(runtime)
        await this._persistDispatch(id)
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'error',
          event: 'dispatch_not_implemented',
          data: { message: result.message },
        })
        return
      }

      if (attempt < maxAttempts) {
        const waitMs = delayMs * (2 ** (attempt - 1))
        await sleep(waitMs)
      } else {
        runtime.hasFailed = true
        dispatch.status = 'failed'
        dispatch.result = result.message
        runtime.completedAt = Date.now()
        this._updateStats(runtime)
        await this._persistDispatch(id)
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'error',
          event: 'dispatch_failed',
          data: { attempt, error: result.message },
        })
        return
      }
    }
  }

  /** 更新全局统计 */
  private _updateStats(runtime: DispatchRuntime): void {
    const durationMs =
      (runtime.completedAt ?? 0) - (runtime.startedAt ?? 0)
    const tokens = runtime.steps.reduce(
      (acc, s) => acc + s.tokenUsage.total,
      0,
    )
    this._stats.totalTokens += tokens
    this._stats.totalDurationMs += durationMs
  }

  /** 取消派单:仅 pending/running 可取消 */
  cancel(id: string): boolean {
    const runtime = this.runtimes.get(id)
    if (!runtime) return false
    const d = runtime.dispatch
    if (d.status !== 'pending' && d.status !== 'running') return false
    d.status = 'cancelled'
    d.updatedAt = nowIso()
    runtime.completedAt = Date.now()
    void this._persistDispatch(id)
    void this._persistLog(id, {
      ts: nowIso(),
      level: 'info',
      event: 'dispatch_cancelled',
    })
    return true
  }

  /** 列出活跃派单(pending / running) */
  listActive(): SubagentDispatch[] {
    return Array.from(this.runtimes.values())
      .map((r) => r.dispatch)
      .filter(
        (d) => d.status === 'pending' || d.status === 'running',
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  /** 列出全部派单(供拓扑推导) */
  listAll(): SubagentDispatch[] {
    return Array.from(this.runtimes.values())
      .map((r) => r.dispatch)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  /** 全局统计 */
  getStats(): DispatchStats {
    const all = Array.from(this.runtimes.values()).map((r) => r.dispatch)
    const active = all.filter(
      (d) => d.status === 'pending' || d.status === 'running',
    ).length
    const completed = all.filter((d) => d.status === 'completed').length
    const failed = all.filter(
      (d) => d.status === 'failed',
    ).length
    const total = this._stats.totalDispatches
    const avgDurationMs =
      total > 0 ? Math.round(this._stats.totalDurationMs / total) : 0
    return {
      active,
      completed,
      failed,
      total,
      avgDurationMs,
      totalTokens: this._stats.totalTokens,
    }
  }

  /** 单个 dispatch 资源统计 */
  getDispatchStats(id: string): DispatchResourceStats | null {
    const runtime = this.runtimes.get(id)
    if (!runtime) return null
    const d = runtime.dispatch
    const totalDurationMs =
      (runtime.completedAt ?? Date.now()) - (runtime.startedAt ?? 0)
    const totalTokens = runtime.steps.reduce(
      (acc, s) => acc + s.tokenUsage.total,
      0,
    )
    return {
      dispatchId: id,
      status: d.status as ExtendedDispatchStatus,
      totalDurationMs,
      totalTokens,
      estimatedCost: Math.round(totalTokens * COST_PER_TOKEN_USD * 1e6) / 1e6,
      steps: runtime.steps.map((s) => ({
        agent: s.agent,
        durationMs: s.durationMs,
        tokenUsage: s.tokenUsage,
        attempt: s.attempt,
        status: s.status,
        error: s.error,
      })),
    }
  }

  // ---------- DAG 可视化 ----------

  /** 获取 DAG 可视化数据(nodes + edges + 执行状态) */
  getDag(id: string): DagVisualization | null {
    const runtime = this.runtimes.get(id)
    if (!runtime || !runtime.dag) return null
    const dag = runtime.dag
    const layers = topologicalSort(dag.nodes, dag.edges)
    return {
      dispatchId: id,
      nodes: dag.nodes.map((n) => ({
        ...n,
        status: (runtime.dagNodeStatus.get(n.id) ?? 'pending') as ExtendedDispatchStatus,
        result: undefined, // 简化:不暴露中间结果
      })),
      edges: dag.edges,
      executionOrder: layers ?? [],
      hasCycle: layers === null,
    }
  }

  // ---------- Checkpoint 恢复 ----------

  /** 从最近 checkpoint 恢复 dispatch 执行 */
  async resume(id: string): Promise<ResumeResult> {
    const runtime = this.runtimes.get(id)
    if (!runtime) {
      return { dispatchId: id, resumed: false, skippedSteps: [], error: '派单不存在' }
    }
    const dispatch = runtime.dispatch
    const status = dispatch.status as ExtendedDispatchStatus
    if (status !== 'failed' && status !== 'preempted' && status !== 'quota_exceeded') {
      return {
        dispatchId: id,
        resumed: false,
        skippedSteps: [],
        error: `派单状态为 ${dispatch.status},仅 failed/preempted/quota_exceeded 可恢复`,
      }
    }

    // 加载 checkpoints
    const checkpoints = await this._loadCheckpoints(id)
    const skippedSteps = Array.from(checkpoints.keys()).filter(
      (sid) => checkpoints.get(sid)?.status === 'ok',
    )

    // 找到第一个非 ok 的 checkpoint 作为恢复点
    const failedStep = Array.from(checkpoints.entries()).find(
      ([, cp]) => cp.status !== 'ok',
    )
    const resumedFromStep = failedStep?.[0]

    // 重置 dispatch 状态为 running
    dispatch.status = 'running'
    dispatch.updatedAt = nowIso()
    runtime.hasFailed = false
    runtime.completedAt = undefined
    await this._persistDispatch(id)
    await this._persistLog(id, {
      ts: nowIso(),
      level: 'info',
      event: 'dispatch_resumed',
      data: { skippedSteps, resumedFromStep },
    })

    // 重新执行(DAG 模式会自动跳过已完成 checkpoint)
    const mode = dispatch.orchestration ?? 'parallel'
    const role = dispatch.agentRole ?? 'coder'
    const prompt = buildAgentPrompt(dispatch)
    const retry = runtime.retry
    const quotas = runtime.quotas

    if (runtime.dag) {
      void this.runDispatchDag(id, prompt, retry, quotas)
    } else if (mode === 'with_communication') {
      void this.runDispatchWithCommunication(id, role, prompt, retry, quotas)
    } else {
      void this.runDispatch(id, mode, role, prompt, retry, quotas)
    }

    return {
      dispatchId: id,
      resumed: true,
      skippedSteps,
      resumedFromStep,
    }
  }

  // ---------- 优先级队列 ----------

  /** 获取调度队列(按优先级排序) */
  getQueue(): QueueEntry[] {
    const entries = Array.from(this.runtimes.values())
      .filter((r) => {
        const s = r.dispatch.status as ExtendedDispatchStatus
        return s === 'pending' || s === 'running' || s === 'preempted'
      })
      .sort((a, b) => PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority])
    return entries.map((r, idx) => ({
      dispatchId: r.dispatch.id,
      priority: r.priority,
      status: r.dispatch.status as ExtendedDispatchStatus,
      goal: r.dispatch.goal,
      createdAt: r.dispatch.createdAt,
      position: idx + 1,
    }))
  }

  // ---------- 资源配额 ----------

  /** 获取各 agent 资源使用情况 */
  getQuotas(id: string): QuotaUsage | null {
    const runtime = this.runtimes.get(id)
    if (!runtime) return null
    const quotas: QuotaConfig = runtime.quotas ?? {
      timeoutMs: 0,
      tokenQuota: 0,
      maxRetries: 0,
    }
    // 按 agent 聚合 steps
    const agentMap = new Map<
      string,
      { durationMs: number; tokenUsage: number; retries: number; lastStatus: 'ok' | 'failed' | 'quota_exceeded' | 'running' | 'pending' }
    >()
    for (const step of runtime.steps) {
      const existing = agentMap.get(step.agent) ?? {
        durationMs: 0,
        tokenUsage: 0,
        retries: 0,
        lastStatus: 'pending' as const,
      }
      existing.durationMs += step.durationMs
      existing.tokenUsage += step.tokenUsage.total
      if (step.status === 'failed') existing.retries++
      existing.lastStatus = step.status === 'ok' ? 'ok' : step.status === 'quota_exceeded' ? 'quota_exceeded' : 'failed'
      agentMap.set(step.agent, existing)
    }
    // DAG 节点状态
    if (runtime.dag) {
      for (const node of runtime.dag.nodes) {
        if (!agentMap.has(node.agentRole)) {
          const dagStatus = runtime.dagNodeStatus.get(node.id) ?? 'pending'
          agentMap.set(node.agentRole, {
            durationMs: 0,
            tokenUsage: 0,
            retries: 0,
            lastStatus: dagStatus === 'completed' ? 'ok' : dagStatus === 'running' ? 'running' : 'pending',
          })
        }
      }
    }
    return {
      dispatchId: id,
      quotas,
      agents: Array.from(agentMap.entries()).map(([agent, usage]) => {
        let exceeded: 'none' | 'timeout' | 'tokens' | 'retries' = 'none'
        if (quotas.timeoutMs > 0 && usage.durationMs > quotas.timeoutMs) {
          exceeded = 'timeout'
        } else if (quotas.tokenQuota > 0 && usage.tokenUsage > quotas.tokenQuota) {
          exceeded = 'tokens'
        } else if (quotas.maxRetries > 0 && usage.retries > quotas.maxRetries) {
          exceeded = 'retries'
        }
        return {
          agent,
          durationMs: usage.durationMs,
          tokenUsage: usage.tokenUsage,
          retries: usage.retries,
          status: usage.lastStatus,
          exceeded,
        }
      }),
    }
  }

  /** 获取 with_communication 消息(供拓扑可视化) */
  getMessages(id: string): CommunicationMessage[] {
    const runtime = this.runtimes.get(id)
    if (!runtime) return []
    return runtime.messages
  }

  // ---------- 拓扑推导 ----------

  /** 推导拓扑:支持 DAG / critique / with_communication / debate / vote / 普通模式 */
  getTopology(): RichSwarmTopology {
    const all = this.listAll()
    const nodes: RichTopologyNode[] = []
    const edges: TopologyEdge[] = []

    for (const d of all) {
      const role = d.agentRole ?? 'coder'
      const mode = d.orchestration ?? 'parallel'
      const runtime = this.runtimes.get(d.id)
      const nodeStatus: TopologyNode['status'] =
        d.status === 'pending'
          ? 'waiting'
          : d.status === 'running'
            ? 'running'
            : d.status === 'completed'
              ? 'completed'
              : d.status === 'failed'
                ? 'failed'
                : 'idle'

      const durationMs =
        runtime?.completedAt && runtime?.startedAt
          ? runtime.completedAt - runtime.startedAt
          : undefined
      const tokenUsage = runtime?.steps.reduce(
        (acc, s) => acc + s.tokenUsage.total,
        0,
      )

      // DAG 模式:渲染所有 DAG 节点 + 边
      if (runtime?.dag) {
        const dag = runtime.dag
        for (const dagNode of dag.nodes) {
          const dagStatus = runtime.dagNodeStatus.get(dagNode.id) ?? 'pending'
          nodes.push({
            id: `${d.id}:${dagNode.id}`,
            label: `${ROLE_LABELS[dagNode.agentRole] ?? dagNode.agentRole}`,
            role: dagNode.agentRole,
            status: dagStatus === 'completed' ? 'completed' : dagStatus === 'running' ? 'running' : dagStatus === 'failed' ? 'failed' : 'waiting',
            dispatchStatus: dagStatus as ExtendedDispatchStatus,
            durationMs,
            tokenUsage,
            isDagNode: true,
            dagNodeStatus: dagStatus as ExtendedDispatchStatus,
          })
        }
        for (const dagEdge of dag.edges) {
          edges.push({
            from: `${d.id}:${dagEdge.from}`,
            to: `${d.id}:${dagEdge.to}`,
            label: dagEdge.condition ?? '依赖',
            type: 'pipeline',
          })
        }
      } else if (mode === 'critique') {
        // critique 模式:多 agent 节点 + 仲裁节点
        const arbiterId = `${d.id}:arbiter`
        nodes.push({
          id: arbiterId,
          label: '批判仲裁',
          role: 'arbiter',
          status: nodeStatus,
          dispatchStatus: d.status as ExtendedDispatchStatus,
          durationMs,
          tokenUsage,
          isArbiter: true,
        })
        for (const r of ALL_ROLES) {
          const agentNodeId = `${d.id}:${r}`
          nodes.push({
            id: agentNodeId,
            label: ROLE_LABELS[r] ?? r,
            role: r,
            status: nodeStatus,
            dispatchStatus: d.status as ExtendedDispatchStatus,
          })
          edges.push({
            from: agentNodeId,
            to: arbiterId,
            label: '批判',
            type: 'critique',
          })
        }
      } else if (mode === 'with_communication') {
        // with_communication 模式:多 agent 节点 + 双向通信边
        for (const r of ALL_ROLES) {
          const agentNodeId = `${d.id}:${r}`
          nodes.push({
            id: agentNodeId,
            label: ROLE_LABELS[r] ?? r,
            role: r,
            status: nodeStatus,
            dispatchStatus: d.status as ExtendedDispatchStatus,
          })
        }
        // 通信边(从 messages 推导)
        const messages = runtime?.messages ?? []
        const edgeSet = new Set<string>()
        for (const msg of messages) {
          const edgeKey = `${d.id}:${msg.from}->${d.id}:${msg.to}`
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey)
            edges.push({
              from: `${d.id}:${msg.from}`,
              to: `${d.id}:${msg.to}`,
              label: `R${msg.round}`,
              type: 'communication',
            })
          }
        }
      } else if (mode === 'debate' || mode === 'vote') {
        // debate/vote 模式:多 agent 节点 + 中心仲裁节点
        const arbiterId = `${d.id}:arbiter`
        nodes.push({
          id: arbiterId,
          label: mode === 'debate' ? '辩论仲裁' : '投票仲裁',
          role: 'arbiter',
          status: nodeStatus,
          dispatchStatus: d.status as ExtendedDispatchStatus,
          durationMs,
          tokenUsage,
          isArbiter: true,
        })
        for (const r of ALL_ROLES) {
          const agentNodeId = `${d.id}:${r}`
          nodes.push({
            id: agentNodeId,
            label: ROLE_LABELS[r] ?? r,
            role: r,
            status: nodeStatus,
            dispatchStatus: d.status as ExtendedDispatchStatus,
          })
          edges.push({
            from: agentNodeId,
            to: arbiterId,
            label: mode === 'debate' ? '辩论' : '投票',
            type: mode,
          })
        }
      } else {
        // 普通模式:1 个主 agent 节点
        nodes.push({
          id: d.id,
          label: ROLE_LABELS[role] ?? role,
          role,
          status: nodeStatus,
          dispatchStatus: d.status as ExtendedDispatchStatus,
          durationMs,
          tokenUsage,
        })
      }
    }

    // 多 dispatch 时按创建顺序串行连接(仅普通模式)
    const simpleDispatches = all.filter((d) => {
      const mode = d.orchestration ?? 'parallel'
      const rt = this.runtimes.get(d.id)
      return mode !== 'debate' && mode !== 'vote' && mode !== 'critique' && mode !== 'with_communication' && !rt?.dag
    })
    for (let i = 1; i < simpleDispatches.length; i++) {
      const prev = simpleDispatches[i - 1]!
      const cur = simpleDispatches[i]!
      const prevMode = prev.orchestration ?? 'parallel'
      edges.push({
        from: prev.id,
        to: cur.id,
        label: '派单顺序',
        type: prevMode === 'parallel' ? 'parallel' : 'pipeline',
      })
    }

    return { nodes, edges }
  }
}

/** 进程内单例 */
export const subagentDispatchService = new SubagentDispatchService()
