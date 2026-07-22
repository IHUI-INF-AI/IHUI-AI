/**
 * Subagent 派单服务(2026-07-22 立,2026-07-22 深化)。
 *
 * 职责:
 *  1. 维护进程内 active dispatches Map + Redis 持久化(降级内存)
 *  2. 调 apps/ai-service 的 agent_orchestrator HTTP 接口(pipeline/parallel/run-decomposed)
 *  3. debate/vote 编排模式:多 agent + LLM 仲裁 / 投票
 *  4. 未暴露的编排模式(critique/with_communication)→ 501 降级
 *  5. 失败重试(指数退避,maxAttempts 1-3)
 *  6. 并发控制(默认最大 3,超限返回 429)
 *  7. 资源消耗统计(durationMs + tokenUsage + estimatedCost)
 *  8. 维护派单 → 拓扑映射(单 dispatch = 1 主 agent 节点 + debate/vote 仲裁节点)
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

/** 日志最大保留条数(LTRIM) */
const LOG_MAX_ENTRIES = 500

/** 默认最大并发 dispatch 数 */
const DEFAULT_MAX_CONCURRENT = 3

/** 重试最大次数上限 */
const MAX_RETRY_ATTEMPTS = 3

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

/** 所有默认 agent 角色(debate/vote 多 agent 并发) */
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

/** 重试配置 */
export interface RetryConfig {
  /** 最大尝试次数(含首次,1=不重试,最大 3) */
  maxAttempts: number
  /** 重试间隔基数 ms(实际间隔 = delayMs * 2^(attempt-1)) */
  delayMs: number
}

/** 扩展派单输入(支持重试配置) */
export interface ExtendedDispatchInput extends DispatchInput {
  retry?: RetryConfig
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
  status: DispatchStatus
  totalDurationMs: number
  totalTokens: number
  estimatedCost: number
  steps: Array<{
    agent: string
    durationMs: number
    tokenUsage: { prompt: number; completion: number; total: number }
    attempt: number
    status: 'ok' | 'failed'
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

/** 扩展拓扑节点(携带 dispatch 状态 + 资源统计 + 仲裁标记) */
export interface RichTopologyNode extends TopologyNode {
  dispatchStatus?: DispatchStatus
  durationMs?: number
  tokenUsage?: number
  isArbiter?: boolean
}

/** 扩展拓扑 */
export interface RichSwarmTopology {
  nodes: RichTopologyNode[]
  edges: TopologyEdge[]
}

/** 派单创建结果:成功 dispatch / 失败 reason / 501 notImplemented / 429 concurrentLimit */
export interface DispatchCallResult {
  dispatch?: SubagentDispatch
  /** 'ok' = ai-service 调用成功;'failed' = 调用失败;'not_implemented' = 501;'concurrent_limit' = 429 */
  outcome: 'ok' | 'failed' | 'not_implemented' | 'concurrent_limit'
  limit?: number
  active?: number
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

/** dispatch 运行时扩展(统计 + 日志 + 重试) */
interface DispatchRuntime {
  dispatch: SubagentDispatch
  retry?: RetryConfig
  steps: Array<{
    agent: string
    durationMs: number
    tokenUsage: TokenUsage
    attempt: number
    status: 'ok' | 'failed'
    error?: string
  }>
  logs: LogEntry[]
  startedAt?: number
  completedAt?: number
  /** 所有重试耗尽后标记(但 dispatch 状态保持 running) */
  hasFailed: boolean
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
  // 汇总 steps 的 token_usage
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
  // 粗估:1 token ≈ 4 字符
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
 *  - debate / vote → 调 callAiServiceDebate / callAiServiceVote
 *  - critique / with_communication → 无对应路由,返回 not_implemented
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
  } else {
    return {
      ok: false,
      reason: 'not_implemented',
      message: `编排模式 "${mode}" 暂未在 ai-service 暴露 HTTP 端点(critique/with_communication 仅 Python 内调用),后端 orchestrator 集成待办`,
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
 *
 * 步骤:
 *  1. POST /parallel 多 agent 并行生成独立结果
 *  2. POST /run-decomposed LLM 仲裁(选最佳 + 合并)
 *  3. 返回 { winningAgent, mergedResult, allResults, debateSummary }
 *
 * 降级:任一端点 404 → not_implemented
 */
async function callAiServiceDebate(
  primaryRole: SubagentRole,
  prompt: string,
): Promise<AiCallResult> {
  // Step 1: 多 agent 并行
  const parallelBody = {
    items: ALL_ROLES.map((r) => ({ agent: r, input: prompt })),
  }
  const parallelRes = await callAiServiceEndpoint(
    '/api/v1/ai/agent/parallel',
    parallelBody,
  )
  if (!parallelRes.ok) return parallelRes

  // 提取各 agent 独立结果
  const parallelData = parallelRes.data
  const allResults: Array<{ agent: string; output: string }> =
    (parallelData?.steps ?? []).map((s) => ({
      agent: s.agent_name ?? primaryRole,
      output: s.output ?? '',
    }))

  if (allResults.length === 0) {
    // 端点存在但无 steps,用 final_output 作为单结果
    return { ok: true, finalOutput: parallelRes.finalOutput, data: parallelData }
  }

  // Step 2: LLM 仲裁
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

  // 解析 winner 标注
  const winnerMatch = arbiterRes.finalOutput.match(
    /\[winner:\s*([^\]]+)\]/i,
  )
  const winningAgent = winnerMatch
    ? winnerMatch[1]!.trim()
    : allResults[0]!.agent

  // 移除 winner 标注行,得到纯 mergedResult
  const mergedResult = arbiterRes.finalOutput.replace(
    /\[winner:\s*[^\]]+\]/i,
    '',
  ).trim()

  const debateSummary = `共 ${allResults.length} 个 agent 参与辩论,胜出 agent: ${winningAgent}`

  // 组合最终输出(包含结构化信息,前端可解析)
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
 *
 * 步骤:
 *  1. POST /parallel 多 agent 并行生成独立结果
 *  2. POST /parallel 每个 agent 对其他结果投票(评分 1-5)
 *  3. 统计得分,最高分胜出
 *
 * 降级:任一端点 404 → not_implemented
 */
async function callAiServiceVote(
  primaryRole: SubagentRole,
  prompt: string,
): Promise<AiCallResult> {
  // Step 1: 多 agent 并行生成结果
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

  // Step 2: 每个 agent 对其他结果投票
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

  // 解析投票结果
  const votes: Array<{ voter: string; candidate: string; score: number }> = []
  const voteData = voteRes.data
  for (const step of voteData?.steps ?? []) {
    const voter = step.agent_name ?? primaryRole
    const output = step.output ?? ''
    // 解析 "agent_name:score" 行
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

  // 统计得分
  const scoreMap = new Map<string, number>()
  for (const v of votes) {
    scoreMap.set(v.candidate, (scoreMap.get(v.candidate) ?? 0) + v.score)
  }

  // 选出胜出 agent
  let winningAgent = allResults[0]!.agent
  let maxScore = -1
  for (const [agent, score] of scoreMap) {
    if (score > maxScore) {
      maxScore = score
      winningAgent = agent
      maxScore = score
    }
  }

  const winnerResult =
    allResults.find((r) => r.agent === winningAgent)?.output ??
    allResults[0]!.output

  // 组合最终输出
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

// ---------------------------------------------------------------------------
// 服务单例
// ---------------------------------------------------------------------------

/**
 * 单例服务:维护 active dispatches Map + Redis 持久化 + 拓扑推导。
 *
 * 深化:
 *  - Redis 持久化(dispatch hash + logs list)
 *  - 失败重试(指数退避)
 *  - 并发控制(429)
 *  - debate/vote 编排
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
      })
      await this.redisClient.sadd(REDIS_KEY_IDS, id)
    } catch {
      // Redis 不可用 → 降级内存,不抛异常
    }
  }

  /** 执行日志写入 Redis list(LPUSH + LTRIM 保留 500 条) */
  private async _persistLog(id: string, entry: LogEntry): Promise<void> {
    // 内存始终保留
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
        // 只加载活跃(pending/running)dispatch,已完成的从内存恢复即可
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
        this.runtimes.set(id, {
          dispatch,
          retry,
          steps: [],
          logs: [],
          hasFailed: false,
        })
      }
    } catch {
      // Redis 不可用 → 降级内存,不抛异常
    }
  }

  // ---------- 主方法 ----------

  /** 创建并派发:检查并发 → 入 Map → 异步调 ai-service */
  async dispatch(
    input: ExtendedDispatchInput,
  ): Promise<DispatchCallResult> {
    // 并发控制
    const activeCount = this.listActive().length
    if (activeCount >= this._maxConcurrent) {
      return {
        outcome: 'concurrent_limit',
        limit: this._maxConcurrent,
        active: activeCount,
        error: `并发派单数已达上限 ${this._maxConcurrent}`,
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

    // 先入 Map(pending),保证 GET /active 立即能看到
    const pending = buildDispatch(input, 'pending')
    this.runtimes.set(pending.id, {
      dispatch: pending,
      retry,
      steps: [],
      logs: [],
      hasFailed: false,
    })
    await this._persistDispatch(pending.id)
    await this._persistLog(pending.id, {
      ts: nowIso(),
      level: 'info',
      event: 'dispatch_created',
      data: { mode, role, retry },
    })

    // 统计
    this._stats.totalDispatches++

    // 异步调 ai-service(不 await,立即返回 pending;后续 GET 查状态)
    void this.runDispatch(pending.id, mode, role, prompt, retry)

    return { dispatch: pending, outcome: 'ok' }
  }

  /** 实际执行 ai-service 调用,更新 dispatch 状态 + 重试 + 统计 */
  private async runDispatch(
    id: string,
    mode: OrchestrationMode,
    role: SubagentRole,
    prompt: string,
    retry?: RetryConfig,
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

    const maxAttempts = retry?.maxAttempts ?? 1
    const delayMs = retry?.delayMs ?? 1000

    let attempt = 0
    while (attempt < maxAttempts) {
      attempt++
      const stepStart = Date.now()

      const result = await callAiService(mode, role, prompt)
      const stepDuration = Date.now() - stepStart
      const tokenUsage = result.ok
        ? extractTokenUsage(result.data, result.finalOutput)
        : emptyTokenUsage()

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
        const nextRetryAt = new Date(Date.now() + waitMs).toISOString()
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'warn',
          event: 'step_retry',
          data: { attempt, error: result.message, nextRetryAt, waitMs },
        })
        await sleep(waitMs)
      } else {
        // 重试耗尽 → 标记 step failed,dispatch 状态保持 running(不自动 cancel)
        runtime.hasFailed = true
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
      status: d.status,
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

  /** 推导拓扑:每个 dispatch 产生 1 个主 agent 节点;debate/vote 额外生成仲裁节点 */
  getTopology(): RichSwarmTopology {
    const all = this.listAll()
    const nodes: RichTopologyNode[] = []
    const edges: TopologyEdge[] = []

    for (const d of all) {
      const role = d.agentRole ?? 'coder'
      const mode = d.orchestration ?? 'parallel'
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

      // 查找 runtime 以获取资源统计
      const runtime = this.runtimes.get(d.id)
      const durationMs =
        runtime?.completedAt && runtime?.startedAt
          ? runtime.completedAt - runtime.startedAt
          : undefined
      const tokenUsage = runtime?.steps.reduce(
        (acc, s) => acc + s.tokenUsage.total,
        0,
      )

      // debate/vote 模式:多 agent 节点 + 中心仲裁节点
      if (mode === 'debate' || mode === 'vote') {
        // 仲裁节点(中心)
        const arbiterId = `${d.id}:arbiter`
        nodes.push({
          id: arbiterId,
          label: mode === 'debate' ? '辩论仲裁' : '投票仲裁',
          role: 'arbiter',
          status: nodeStatus,
          dispatchStatus: d.status,
          durationMs,
          tokenUsage,
          isArbiter: true,
        })
        // 多 agent 节点(围绕仲裁)
        for (const r of ALL_ROLES) {
          const agentNodeId = `${d.id}:${r}`
          nodes.push({
            id: agentNodeId,
            label: ROLE_LABELS[r] ?? r,
            role: r,
            status: nodeStatus,
            dispatchStatus: d.status,
            isArbiter: false,
          })
          // agent → arbiter 边
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
          dispatchStatus: d.status,
          durationMs,
          tokenUsage,
          isArbiter: false,
        })
      }
    }

    // 多 dispatch 时按创建顺序串行连接(表达"先后派发"关系)
    // 仅对非 debate/vote 的 dispatch 生成串行边(避免 debate/vote 内部边与串行边混淆)
    const simpleDispatches = all.filter((d) => {
      const mode = d.orchestration ?? 'parallel'
      return mode !== 'debate' && mode !== 'vote'
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
