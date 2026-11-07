// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

import { randomBytes } from 'node:crypto'
import type { Redis } from 'ioredis'
import { eq } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { agentTasks, chatConversations } from '@ihui/database'
import { coerceKnownOr } from '@ihui/types'
import { logger } from '../utils/logger.js'
import { aiServiceSystemFetch } from '../utils/ai-service-fetch.js'
import { releaseTaskLockByTaskId, toLockReleaseOutcome } from './workspace-lock-heartbeat.js'
import { broadcastSSEEvent } from './agent-sse-bus.js'
// 活跃状态判据的唯一出口(2026-11-01,S-ACTIVE):listActive 与并发计数共用一份
import { isActiveDispatchStatus } from '../utils/dispatch-status.js'
// 归属回填只处理 uuid 形态的关联 id(非 uuid 直接跳过,避免 Postgres 22P02 把整批装载打断)
import { isUuidString } from '../utils/uuid.js'
import type {
  SubagentDispatch,
  DispatchInput,
  DispatchAttention,
  TopologyNode,
  TopologyEdge,
  OrchestrationMode,
  SubagentRole,
  DispatchStatus,
} from '@ihui/shared/subagents'

/** 跨服务调用超时(ms) */
const AI_SERVICE_TIMEOUT_MS = 30_000

/** Redis 键前缀 */
const REDIS_KEY_DISPATCH = 'subagent:dispatch:' // hash
const REDIS_KEY_LOGS = 'subagent:logs:' // list
const REDIS_KEY_IDS = 'subagent:dispatch:ids' // set
const REDIS_KEY_INBOX = 'subagent:inbox:' // list(with_communication agent 消息)
const REDIS_KEY_CHECKPOINT = 'subagent:checkpoint:' // hash(stepId → JSON)
const REDIS_KEY_QUEUE = 'subagent:dispatch:queue' // zset(priority score)
/** F3(2026-11-02)thread 索引:每个会话一条 zset(score=createdAt,member=dispatchId) */
const REDIS_KEY_THREAD = 'subagent:dispatch:thread:'
/** F4(2026-11-02)Inline & Spill:上游长结果的全文产物(id = `${dispatchId}:${stepId}`) */
const REDIS_KEY_ARTIFACT = 'subagent:artifact:'
/**
 * 归属回填记账(2026-11-02,归属回填与 fail-open 收敛):
 * member = `${dispatchId}|${source}`,source ∈ conversation / agentTask / thread / orphan。
 * 只用于回滚(逐条 HDEL ownerUserId / ownership)与影响面审计,不参与可见性判定。
 */
const REDIS_KEY_OWNERSHIP_BACKFILL = 'subagent:dispatch:ownership-backfill:20261102'

/** 日志最大保留条数(LTRIM) */
const LOG_MAX_ENTRIES = 500

/**
 * F3 上下文预算:近期整段 inline,更早/更长的按引用取(不把整条 thread 一股脑塞进 prompt)。
 * 三个数值是上下文拼装的策略参数,调大只影响 prompt 体积,不改变归属/执行语义。
 */
const THREAD_CONTEXT_INLINE_ENTRIES = 3
const THREAD_CONTEXT_ENTRY_MAX_CHARS = 800
const THREAD_CONTEXT_MAX_CHARS = 4000

/**
 * F4 上游结果预算:不超过该长度的整段 inline;超出部分落可寻址产物,
 * prompt 只给「摘要 + 引用」,不再用 slice(0, 500) 截断丢弃。
 * ARTIFACT_MAX_CHARS 是单条产物的存储上限(长度保护);超过时按上限截存并标记 truncated。
 */
const UPSTREAM_CONTEXT_INLINE_CHARS = 800
const ARTIFACT_MAX_CHARS = 200_000

/**
 * 全局并发硬上限(F2 2026-11-02:保护值,不再作为「拒绝」依据 —— 满额落 queued 等槽位)。
 *
 * 配额维度改为 `(ownerUserId, priority)`:
 *  - 全局硬上限:所有租户合计的在跑数,防止单租户/单优先级把进程打满;
 *  - 每租户上限:防单租户吃满全局(单租户打满只影响自己);
 *  - 每租户每优先级上限:同租户内 high/urgent 可多占,low 只留 1 档(避免低优任务长期霸槽)。
 *
 * 具体数值(2026-11-02 拍板):全局 6 / 每租户 3 / 每租户每优先级 low 1·normal 2·high 3·urgent 3。
 * 调数值只需改这三个常量,调度逻辑与判据不变。
 *
 * 为什么不是拍板前的「租户 2 + normal 1」:
 *  - normal=1 时,租户里的**第二条普通任务**会先撞自己的优先级配额,而租户总配额(2)还有余量
 *    —— 优先级层比租户层更早成为瓶颈,等于把优先级设计反用了:优先级层的职责是
 *    「防止低优任务把租户槽位灌满」,不该回头限制正常任务本身。
 *  - 抬到 normal 2 / high 3 / urgent 3 之后,三层判据的先后才有意义:
 *    先看全局(6),再看每租户(3),最后才用优先级层兜底低优任务 ——
 *    优先级层不再抢在租户层之前拦人,只在同租户同类任务占满自己那一档时才生效。
 *  - low 仍保留 1 档:低优任务不长期霸槽,这是优先级层唯一保留的「更早生效」场景
 *    (同租户 low 已占 1 槽时,第二条 low 直接落 queued,而不是再去挤占 normal/high 的空间)。
 */
const DEFAULT_MAX_CONCURRENT = 6

/** 单租户在跑上限(与全局上限取小,是「单租户打满不影响他人」的关键保护) */
const DEFAULT_TENANT_MAX_CONCURRENT = 3

/**
 * 单租户单优先级在跑上限(仍需同时满足租户总上限)。
 * 只有 low 比租户层更早生效(1 档);normal/high/urgent 的档位等于或高于租户层,
 * 保证「第二条普通任务」先落到租户层的余量里,而不是被优先级层先拦下。
 */
const TENANT_PRIORITY_MAX_CONCURRENT: Record<DispatchPriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  urgent: 3,
}

/**
 * 队列分数:priority 主序 + 先来后到次序,全部编码进 zset score。
 * score = PRIORITY_SCORE * 1e14 - createdAt(ms) ⇒ 同优先级里越早创建分数越大,
 * `zrevrange` 一次读出的顺序就是真实出队顺序(不依赖第二次排序,也不受浮点抖动影响)。
 */
const QUEUE_PRIORITY_SCORE_UNIT = 1e14

/** 重试最大次数上限 */
const MAX_RETRY_ATTEMPTS = 3

/** Checkpoint TTL(24 小时,秒) */
const CHECKPOINT_TTL_SEC = 24 * 60 * 60

/** 通信轮次默认值(with_communication) */
const DEFAULT_COMM_ROUNDS = 3

/**
 * 摘要截断上限(单一数值口径,2026-11-02)。
 *
 * with_communication 的 agent 间 result 消息与 deliverables.outputSummary 语义不同:
 * 前者是下一轮 prompt 的预算控制,后者是给人看的最终答复摘录;数据源也不同
 * (单 agent 单轮 output vs 整次 run 的 final_output)。两者**只共用 500 这一数值口径**,
 * 不得各自写死数字(否则会出现一侧 500、一侧 501 的静默漂移);也不得合并数据源/形状。
 *
 * 不加省略号或「已截断」标记:既有契约测试断言摘要精确等于原文前 500 字
 * (subagent-dispatch-service.test.ts 的 'x'.repeat(500) 用例),加标记会破坏该契约。
 */
const SUMMARY_MAX_CHARS = 500

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
const ALL_ROLES: SubagentRole[] = ['researcher', 'coder', 'reviewer', 'architect', 'debugger']

// ---------------------------------------------------------------------------
// 扩展类型(深化新增)
// ---------------------------------------------------------------------------

/**
 * 扩展 dispatch 状态(增加 preempted / quota_exceeded / interrupted / queued)。
 *
 * `interrupted`(2026-11-02,F1 崩溃自愈):**只由启动恢复写入** —— 进程重启时发现
 * Redis 里仍是 running 的记录(说明执行态已随进程消失),先标记 interrupted 留痕,
 * 随即转 pending 重新入队执行。它不是终态,也不参与并发计数;若重新入队失败
 * (例如 ai-service 不可用),记录停在 interrupted 且 `resume` 接受该态(见 resume 注释)。
 *
 * `queued`(2026-11-02,F2 租户槽位 + 真排队):并发配额(全局硬上限 + 每租户配额)满时,
 * 新派单不再返回 429,而是落 queued 并写进 Redis zset(`subagent:dispatch:queue`);
 * 槽位释放后按「优先级 → 先来后到」出队。它不占槽位(不计入 isActiveDispatchStatus),
 * 但也不是终态:可被 cancel,重启后由 zset 原样恢复等待。
 */
export type ExtendedDispatchStatus =
  DispatchStatus | 'preempted' | 'quota_exceeded' | 'interrupted' | 'queued'

/**
 * 写侧状态视图:`SubagentDispatch.status` 的声明面是基础联合(不含 preempted / quota_exceeded),
 * 而本服务确实写这两个扩展值 —— 经这个已声明为**扩展域**的视图写回同一个对象,让 TS 按扩展域判
 * 字面量合法性;不再用类型断言把越域字面量掩盖成合法(守门 94 R4 同族的写侧形态)。
 */
function statusWriteView(dispatch: SubagentDispatch): { status: ExtendedDispatchStatus } {
  return dispatch
}

/**
 * 读侧状态视图:记录声明面只容基础档,而运行时确实会读到扩展档(queued / interrupted / preempted)。
 * 与 statusWriteView 同一手法(不 as-cast、不在调用点散落 `as ExtendedDispatchStatus`)。
 */
function statusReadView(dispatch: SubagentDispatch): { status: ExtendedDispatchStatus } {
  return dispatch
}

/**
 * 终态判据(F2):只有这些状态会释放并发槽位,触发排队出队。
 * 与 `isActiveDispatchStatus`(pending|running)互补 —— 未终态但也不占槽的 queued/interrupted
 * 既不出队也不被当终态结算。
 */
function isTerminalDispatchStatus(status: string): boolean {
  return (
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'preempted' ||
    status === 'quota_exceeded'
  )
}

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

/** 扩展派单输入(支持 DAG + 优先级 + 配额 + 重试 + agentId 关联) */
export interface ExtendedDispatchInput extends DispatchInput {
  retry?: RetryConfig
  dag?: DagConfig
  priority?: DispatchPriority
  quotas?: QuotaConfig
  /** 可选:关联 agent 主表 id,派单运行轨迹持久化到 agent_tasks(2026-08-06 新增) */
  agentId?: string
  /**
   * 租户归属 = 鉴权后的 request.userId。**只由路由从鉴权结果注入**,不从请求体读
   * (dispatchSchema 里没有该字段 ⇒ 客户端自报会被 Zod 剥掉)。
   * 落在派单记录上并随 Redis 持久化,供 GET /subagents/all 按租户口径过滤。
   */
  ownerUserId?: string
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
  /**
   * F3(2026-11-02)纯增量字段(既有消费方不受影响):
   *  - parentDispatchId/attention:thread 归属与人工注意力,与派单记录同值;
   *  - result:结果全文,供 thread 上下文里「按引用取」有真实取回点(GET /:id/stats)。
   */
  parentDispatchId?: string
  attention?: DispatchAttention
  result?: string
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
  /** F2(2026-11-02):无并发槽位时 resume 只把记录放回真队列,resumed=true 但尚未开跑 */
  queued?: boolean
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

/**
 * 投递重试日志(outbox 式,2026-11-02 F1)。
 *
 * 旧实现的重试只是 `runDispatch` 里的 `await sleep()` —— 进程在等待窗口内重启,
 * 「已失败一次、还剩几次、下次何时可试」这条状态就没了,恢复后只能从头再来。
 * 这里把**重试意图**随 dispatch 落 Redis(`outbox` 字段):
 *  - `attempt` = 已经执行过的尝试序号(恢复时从 attempt+1 继续,不重复执行已失败那次);
 *  - `nextRetryAt` = 下一次允许投递的时间(epoch ms,恢复时若已过则立即试,未到则等到点);
 *  - `lastError` = 上次失败原因(排障用)。
 * 终态 / 成功后清空该字段。
 */
interface RetryJournal {
  attempt: number
  maxAttempts: number
  nextRetryAt: number
  lastError?: string
}

/** F3:thread 历史条目(内存 runtime 或 Redis hash 都能还原出的最小字段) */
interface ThreadEntry {
  id: string
  goal: string
  status: string
  result?: string
  createdAt: string
  conversationId?: string
  ownerUserId?: string
}

/** F3:进入/退出人工注意力的结果(terminal 与 not_found 分开报,路由据此给 409/404) */
export type SetAttentionResult =
  { ok: true; dispatch: SubagentDispatch } | { ok: false; reason: 'not_found' | 'terminal' }

/**
 * F4:落库的上游产物(全文)。
 * `truncated=true` 表示原文超过 ARTIFACT_MAX_CHARS 的存储上限,产物只保留前 N 字符 ——
 * 这是长度保护,不是运行时截断丢弃;prompt 里的引用始终可用。
 */
export interface DispatchArtifact {
  /** 全局寻址 id:`${dispatchId}:${stepId}` */
  id: string
  dispatchId: string
  stepId: string
  content: string
  truncated: boolean
  createdAt: string
}

/** dispatch 运行时扩展(统计 + 日志 + 重试 + DAG + 优先级 + 配额 + checkpoint + 通信) */
interface DispatchRuntime {
  dispatch: SubagentDispatch
  retry?: RetryConfig
  dag?: DagConfig
  priority: DispatchPriority
  quotas?: QuotaConfig
  /** 本次派单的最终 prompt(建单时算一次并落 Redis;恢复时直接复用,不重新拼装) */
  prompt?: string
  /** outbox 式重试状态(见 RetryJournal;落 Redis hash 的 `outbox` 字段) */
  outbox?: RetryJournal
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
  /** F4:上游结果产物缓存(stepId → artifact;全文同时落 Redis,进程内留一份便于即时取回) */
  artifacts: Map<string, DispatchArtifact>
  /** agent_tasks 记录 id(subagent dispatch 轨迹持久化关联,2026-08-06 新增) */
  agentTaskId?: string
  /** ai-service 编排原始结果(D27 交付清单聚合数据源,仅成功分支赋值;DAG/多轮通信无单一编排结果时为 null) */
  orchestration?: AiOrchestrationResult | null
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
    /** D27:步骤内工具调用明细(lenient 形状,字段按名取值,兼容各 ai-service 版本) */
    tool_calls?: Array<Record<string, unknown>>
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
// D27 交付清单(deliverables)聚合 — 跨端契约 camelCase 形状钉死,字段不可改名
// ---------------------------------------------------------------------------

/** 任务完成交付清单(跨端契约:前端直接消费) */
export interface Deliverables {
  /** 引用来源(四源:wiki/memory/skill/mcp,去重后上限 20) */
  citations: Array<{ source: string; label: string; url?: string }>
  /** 变更文件(写文件类工具聚合,上限 100) */
  filesChanged: Array<{
    path: string
    kind: 'add' | 'delete' | 'update'
    stepIds: string[]
    additions: number
    deletions: number
  }>
  /** 工具调用统计 */
  toolsSummary: { total: number; byTool: Record<string, number> }
  /** 最终输出摘要(前 500 字) */
  outputSummary: string
  /** 生成时间(ISO) */
  generatedAt: string
}

/** 写文件类工具名 → filesChanged.kind 映射 */
const FILE_TOOL_KIND: Readonly<Record<string, 'add' | 'delete' | 'update'>> = {
  write_file: 'add',
  create_file: 'add',
  delete_file: 'delete',
  edit_file: 'update',
  file_edit: 'update',
}

/** 从对象中按候选键取第一个非空字符串值 */
function firstStringOf(obj: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return undefined
}

/**
 * 摘要前缀截断(纯函数:无省略号、无副作用)。
 * 两处调用点共用,保证字节级一致的 500 字口径;语义差异见 SUMMARY_MAX_CHARS 注释。
 */
function truncateSummary(text: string): string {
  return text.slice(0, SUMMARY_MAX_CHARS)
}

/** 估算文本行数(空串按 0 行) */
function countLinesOf(text: string): number {
  return text.length === 0 ? 0 : text.split('\n').length
}

/**
 * 聚合编排结果为交付清单(D27):遍历各 step 的 tool_calls,产出
 * filesChanged / citations / toolsSummary / outputSummary。
 * 纯函数无副作用;无任何可聚合内容(工具调用与输出全空)时返回 null。
 */
export function aggregateDeliverables(result: AiOrchestrationResult): Deliverables | null {
  const citations: Deliverables['citations'] = []
  const seenCitations = new Set<string>()
  // 同一路径多次操作合并:kind 以最后一次为准,增删行累加,stepIds 去重合并
  const filesByPath = new Map<string, Deliverables['filesChanged'][number]>()
  const filesOrder: string[] = []
  let totalCalls = 0
  const byTool: Record<string, number> = {}

  for (const [stepIdx, step] of (result.steps ?? []).entries()) {
    for (const [callIdx, rawCall] of (step.tool_calls ?? []).entries()) {
      const call = (rawCall ?? {}) as Record<string, unknown>
      // 工具名:lenient 兼容 name / tool_name / function.name(OpenAI 风格)
      const fn = call.function as Record<string, unknown> | undefined
      const toolName =
        firstStringOf(call, ['name', 'tool_name']) ?? firstStringOf(fn ?? {}, ['name']) ?? 'unknown'
      totalCalls += 1
      byTool[toolName] = (byTool[toolName] ?? 0) + 1

      // 参数:lenient 兼容 args / input / function.arguments(JSON 字符串自动解析)
      let args: Record<string, unknown> = {}
      const rawArgs = call.args ?? call.input ?? fn?.arguments
      if (typeof rawArgs === 'string' && rawArgs.length > 0) {
        try {
          const parsed: unknown = JSON.parse(rawArgs)
          if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
            args = parsed as Record<string, unknown>
          }
        } catch {
          // 非 JSON 字符串参数 → 按空参数处理
        }
      } else if (rawArgs !== null && typeof rawArgs === 'object' && !Array.isArray(rawArgs)) {
        args = rawArgs as Record<string, unknown>
      }

      // 调用 id(stepIds 数据源,缺失时按位置合成)
      const callId = firstStringOf(call, ['id', 'call_id']) ?? `call-${stepIdx + 1}-${callIdx + 1}`

      // ① 写文件类工具 → filesChanged
      const kind = FILE_TOOL_KIND[toolName]
      if (kind) {
        const path = firstStringOf(args, ['path', 'file_path', 'filePath', 'file', 'filename'])
        if (path) {
          const oldText = firstStringOf(args, ['oldText', 'old_string'])
          const newText = firstStringOf(args, ['newText', 'new_string', 'content', 'text'])
          let additions = 0
          let deletions = 0
          // 增删行按新旧文本行数差估算(仅作概览,不做精确 diff)
          if (oldText !== undefined || newText !== undefined) {
            const oldLines = oldText !== undefined ? countLinesOf(oldText) : 0
            const newLines = newText !== undefined ? countLinesOf(newText) : 0
            additions = Math.max(0, newLines - oldLines)
            deletions = Math.max(0, oldLines - newLines)
          }
          const existed = filesByPath.get(path)
          if (existed) {
            existed.kind = kind
            existed.additions += additions
            existed.deletions += deletions
            if (!existed.stepIds.includes(callId)) existed.stepIds.push(callId)
          } else {
            filesByPath.set(path, { path, kind, stepIds: [callId], additions, deletions })
            filesOrder.push(path)
          }
        }
      }

      // ② 引用来源四源映射(mcp 前缀/双下划线优先判定)
      let source: 'wiki' | 'memory' | 'skill' | 'mcp' | undefined
      if (toolName.startsWith('mcp:') || toolName.includes('__')) source = 'mcp'
      else if (toolName.includes('wiki')) source = 'wiki'
      else if (toolName.includes('memory')) source = 'memory'
      else if (toolName.includes('skill')) source = 'skill'
      if (source) {
        const label =
          firstStringOf(args, ['title', 'name', 'key', 'slug', 'query', 'page', 'topic']) ?? callId
        const url =
          source === 'wiki'
            ? '/repo-wiki'
            : source === 'skill'
              ? '/skills'
              : source === 'mcp'
                ? '/mcp-projects'
                : undefined
        const dedupKey = `${source}|${label}|${url ?? ''}`
        if (!seenCitations.has(dedupKey)) {
          seenCitations.add(dedupKey)
          citations.push(url ? { source, label, url } : { source, label })
        }
      }
    }
  }

  const outputSummary = truncateSummary(result.final_output ?? '')
  // 全空(无引用/无文件变更/无工具调用/无输出)→ null
  if (
    citations.length === 0 &&
    filesOrder.length === 0 &&
    totalCalls === 0 &&
    outputSummary.length === 0
  ) {
    return null
  }
  return {
    citations: citations.slice(0, 20),
    filesChanged: filesOrder.slice(0, 100).map((p) => filesByPath.get(p)!),
    toolsSummary: { total: totalCalls, byTool },
    outputSummary,
    generatedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

function newId(): string {
  // 2026-08-02 P2 安全加固：用 CSPRNG 替换 Math.random，防止攻击者枚举他人 dispatch ID
  return `dispatch-${Date.now()}-${randomBytes(4).toString('hex')}`
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
      input.forbidden && input.forbidden.length > 0 ? input.forbidden : ['任何不在上述清单的文件'],
    verifyCommands: input.verifyCommands,
    constraints: input.constraints,
    deliverables: input.deliverables,
    agentRole: input.agentRole ?? 'coder',
    orchestration: input.orchestration ?? 'parallel',
    status,
    result,
    // D08 ③(2026-10-27):会话归属随派单记录一起落库 —— 落点唯一就是派单记录本身,
    // 路由层不另存映射表(§0.6)。入口没有会话上下文时 input.conversationId 为 undefined,
    // 记录上就不带这个字段 ⇒ 载荷里也没有 ⇒ 消费方按「未归属会话」渲染(不塞常量)。
    conversationId: input.conversationId,
    // 租户归属随派单记录一起落库(同 conversationId:落点唯一 = 派单记录本身)。
    // 入口没带(非路由入口 / 旧调用)⇒ undefined ⇒ 记录不带该字段 ⇒ 列表按「未标注」处理。
    ownerUserId: input.ownerUserId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
}

/** 拼装派单 prompt(把 AGENTS.md §11 强制格式作为 user_input 传给 agent) */
function buildAgentPrompt(
  input: Pick<
    SubagentDispatch,
    'goal' | 'affectedFiles' | 'forbidden' | 'verifyCommands' | 'constraints' | 'deliverables'
  >,
): string {
  const forbidden: string[] =
    input.forbidden && input.forbidden.length > 0 ? input.forbidden : ['任何不在上述清单的文件']
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
    ...(input.verifyCommands ?? []).map((c: string) => `- ${c}`),
    '',
    '## 约束边界',
    input.constraints ?? '',
    '',
    '## 交付物',
    input.deliverables ?? '',
  ].join('\n')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 容错 JSON 解析(2026-11-02,F1):Redis hash 是同一份记录跨版本共享的持久层,
 * 旧版本写入的字段可能缺字段/格式漂移。恢复流程不能用裸 JSON.parse 把整个
 * 启动恢复直接 catch 掉(一条坏记录会让其余在途派单全部不被接管)。
 */
function parseJsonOr<T>(raw: string | undefined | null, fallback: T): T {
  if (raw === undefined || raw === null || raw === '') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

// ---------------------------------------------------------------------------
// DAG 辅助函数
// ---------------------------------------------------------------------------

/**
 * 拓扑排序(Kahn 算法):返回按层级分组的节点 ID(同层可并行)。
 * 返回 null 表示有环。
 */
function topologicalSort(nodes: DagNode[], edges: DagEdge[]): string[][] | null {
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
      (id) => !visited.has(id) && (inDegree.get(id) ?? 0) === 0,
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
    const res = await aiServiceSystemFetch(path, {
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
  const parallelRes = await callAiServiceEndpoint('/api/v1/ai/agent/parallel', parallelBody)
  if (!parallelRes.ok) return parallelRes

  const parallelData = parallelRes.data
  const allResults: Array<{ agent: string; output: string }> = (parallelData?.steps ?? []).map(
    (s) => ({
      agent: s.agent_name ?? primaryRole,
      output: s.output ?? '',
    }),
  )

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

  const arbiterRes = await callAiServiceEndpoint('/api/v1/ai/agent/run-decomposed', {
    task: arbitrationPrompt,
    strategy: 'dag',
  })
  if (!arbiterRes.ok) return arbiterRes

  const winnerMatch = arbiterRes.finalOutput.match(/\[winner:\s*([^\]]+)\]/i)
  const winningAgent = winnerMatch ? winnerMatch[1]!.trim() : allResults[0]!.agent

  const mergedResult = arbiterRes.finalOutput.replace(/\[winner:\s*[^\]]+\]/i, '').trim()

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
async function callAiServiceVote(primaryRole: SubagentRole, prompt: string): Promise<AiCallResult> {
  const parallelBody = {
    items: ALL_ROLES.map((r) => ({ agent: r, input: prompt })),
  }
  const parallelRes = await callAiServiceEndpoint('/api/v1/ai/agent/parallel', parallelBody)
  if (!parallelRes.ok) return parallelRes

  const parallelData = parallelRes.data
  const allResults: Array<{ agent: string; output: string }> = (parallelData?.steps ?? []).map(
    (s) => ({
      agent: s.agent_name ?? primaryRole,
      output: s.output ?? '',
    }),
  )

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
  const voteRes = await callAiServiceEndpoint('/api/v1/ai/agent/parallel', voteBody)
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
    allResults.find((r) => r.agent === winningAgent)?.output ?? allResults[0]!.output

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
    const res = await aiServiceSystemFetch(debatePath, {
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
      typeof data.final_output === 'string' && data.final_output.length > 0 ? data.final_output : ''

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
      const allResults: Array<{ agent: string; output: string }> = (data.steps ?? []).map((s) => ({
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
        await redisClient.lpush(`${REDIS_KEY_INBOX}${msg.to}`, JSON.stringify(msg))
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
    const parallelRes = await callAiServiceEndpoint('/api/v1/ai/agent/parallel', {
      items: agentInputs,
    })

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
            // 仅 prompt 预算控制,非交付摘要;与 outputSummary 共用数值口径但不合并数据源
            content: truncateSummary(r.output),
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
export class SubagentDispatchService {
  private runtimes = new Map<string, DispatchRuntime>()
  private redisClient: Redis | null = null
  private readonly _maxConcurrent = DEFAULT_MAX_CONCURRENT
  /**
   * 本进程内正在飞的 dispatch。启动恢复只接管「进程外的 running」,
   * 不许把本进程还在执行(第二次 setRedisClient / 重复 load)的记录误判成中断。
   */
  private inFlight = new Set<string>()
  /** 防止 _loadActiveDispatches 重入(构造器 + setRedisClient 可能连续触发) */
  private _loading = false
  /** 防止排队出队并发重入(槽位释放与启动恢复可能同时触发) */
  private _draining = false

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

  /** dispatch 状态变更时写入 Redis hash(字段必须覆盖「重启后能重建执行」的粒度) */
  private async _persistDispatch(id: string): Promise<void> {
    const runtime = this.runtimes.get(id)
    if (!runtime) return
    // 2026-08-06: agent_tasks 联动同步(带 agentId 的派单在状态终态时写回轨迹)
    await this._syncAgentTask(runtime)
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
        // 租户归属随记录落 Redis:进程重启后从 hash 恢复仍能按租户过滤(不因重启丢归属)
        ownerUserId: d.ownerUserId ?? '',
        // 归属回填标记(2026-11-02):orphan 记录随 hash 持久化,重启后仍只对管理面可见
        ownership: d.ownership ?? '',
        // F1(2026-11-02)崩溃自愈:以下字段是「重启后足以重建执行」的最小集,
        // 少了任何一项,恢复都只能从头再来或直接失忆(agent_tasks 关联/耗时/step 全丢):
        //  - prompt:建单时算一次,恢复时原样复用(不依赖 build 函数的未来变更改变在途任务语义)
        //  - conversationId:会话归属(重启不能丢,否则 thread 归属漂移)
        //  - agentTaskId:轨迹关联,恢复后终态仍能写回同一条 agent_tasks(不新建)
        //  - steps/startedAt/completedAt:统计与看板口径
        //  - dagNodeStatus:已完成节点,与 checkpoint 互补(DAG 进度可读)
        //  - messages:with_communication 已产生的通信消息
        //  - outbox:投递失败的重试意图(attempt/nextRetryAt)
        prompt: runtime.prompt ?? '',
        conversationId: d.conversationId ?? '',
        agentTaskId: runtime.agentTaskId ?? '',
        steps: JSON.stringify(runtime.steps),
        startedAt: runtime.startedAt !== undefined ? String(runtime.startedAt) : '',
        completedAt: runtime.completedAt !== undefined ? String(runtime.completedAt) : '',
        dagNodeStatus: JSON.stringify(Array.from(runtime.dagNodeStatus.entries())),
        messages: JSON.stringify(runtime.messages),
        outbox: runtime.outbox ? JSON.stringify(runtime.outbox) : '',
        // F3(2026-11-02):thread 归属 + 人工注意力,与 prompt 同属「重启后可重建的语义」
        parentDispatchId: d.parentDispatchId ?? '',
        attention: d.attention ?? '',
      })
      await this.redisClient.sadd(REDIS_KEY_IDS, id)
      // F3:会话索引(跨重启仍能把后续派单挂回既有 thread)。score=createdAt ⇒ zrevrange 即「最近一条」
      if (d.conversationId) {
        const created = Date.parse(d.createdAt)
        await this.redisClient.zadd(
          `${REDIS_KEY_THREAD}${d.conversationId}`,
          Number.isFinite(created) ? created : Date.now(),
          id,
        )
      }
      // F2(2026-11-02):zset 只装「正在排队」的记录。旧实现每次写都 zadd(连 running/终态也塞),
      // 队列只写不读、退役成员永不清理 ⇒ getQueue 只能读内存视图(与真实出队脱钩)。
      if (statusReadView(d).status === 'queued') {
        await this.redisClient.zadd(REDIS_KEY_QUEUE, this._queueScore(runtime), id)
      } else {
        await this.redisClient.zrem(REDIS_KEY_QUEUE, id)
      }
    } catch {
      // Redis 不可用 → 降级内存,不抛异常
    }
    // 终态释放槽位 ⇒ 触发真队列出队(异步,不阻塞状态写回;重入由 _draining 挡)
    if (isTerminalDispatchStatus(d.status)) void this._drainQueue()
  }

  /** 队列分数:priority 主序 + createdAt 先来后到(数值越大越先出队) */
  private _queueScore(runtime: DispatchRuntime): number {
    const created = Date.parse(runtime.dispatch.createdAt)
    const ts = Number.isFinite(created) ? created : Date.now()
    return PRIORITY_SCORE[runtime.priority] * QUEUE_PRIORITY_SCORE_UNIT - ts
  }

  // ---------- F3(2026-11-02)Thread/Ticket:会话连续 ----------

  /** 会话 thread 索引(zset,score=createdAt)⇒ 新 → 旧 */
  private async _threadIds(conversationId: string): Promise<string[]> {
    if (!this.redisClient) return []
    try {
      return await this.redisClient.zrevrange(`${REDIS_KEY_THREAD}${conversationId}`, 0, -1)
    } catch {
      // Redis 不可用 ⇒ 无 thread 可读(降级为「孤立新开」,不阻断派单)
      return []
    }
  }

  /**
   * 读一条 thread 条目:本进程 runtime 优先(状态/结果最新),Redis hash 兜底(跨重启)。
   * 两边都没有 ⇒ null(索引里的退役成员,调用方跳过)。
   */
  private async _readThreadEntry(id: string): Promise<ThreadEntry | null> {
    const runtime = this.runtimes.get(id)
    if (runtime) {
      const d = runtime.dispatch
      return {
        id: d.id,
        goal: d.goal,
        status: String(d.status),
        result: d.result,
        createdAt: d.createdAt,
        conversationId: d.conversationId,
        ownerUserId: d.ownerUserId,
      }
    }
    if (!this.redisClient) return null
    try {
      const raw = await this.redisClient.hgetall(`${REDIS_KEY_DISPATCH}${id}`)
      if (!raw || !raw.id) return null
      return {
        id: raw.id,
        goal: raw.goal || '',
        status: raw.status || '',
        result: raw.result || undefined,
        createdAt: raw.createdAt || '',
        conversationId: raw.conversationId || undefined,
        ownerUserId: raw.ownerUserId || undefined,
      }
    } catch {
      return null
    }
  }

  /**
   * 解析本次派单的父节点:同会话、同租户(= ownerUserId 相等;undefined 只与 undefined 成链)、
   * 最近一条。跨租户不成链 —— thread 归属不得成为跨租户血缘通道。
   */
  private async _resolveParentDispatchId(
    conversationId: string | undefined,
    ownerUserId: string | undefined,
  ): Promise<string | undefined> {
    if (!conversationId) return undefined
    for (const id of await this._threadIds(conversationId)) {
      const entry = await this._readThreadEntry(id)
      if (!entry) continue
      if (entry.ownerUserId !== ownerUserId) continue
      return entry.id
    }
    return undefined
  }

  /** 读同 thread 历史(同租户),新 → 旧;条目字段与 `_readThreadEntry` 同源 */
  private async _loadThreadHistory(
    conversationId: string | undefined,
    ownerUserId: string | undefined,
  ): Promise<ThreadEntry[]> {
    if (!conversationId) return []
    const entries: ThreadEntry[] = []
    for (const id of await this._threadIds(conversationId)) {
      const entry = await this._readThreadEntry(id)
      if (!entry) continue
      if (entry.ownerUserId !== ownerUserId) continue
      entries.push(entry)
    }
    return entries
  }

  /**
   * 拼装派单 prompt:基础格式 + 同 thread 上下文。
   *
   * 预算三层(见文件顶部常量):
   *  - 最近 `THREAD_CONTEXT_INLINE_ENTRIES` 条结果 inline;
   *  - 单条 inline 结果最多 `THREAD_CONTEXT_ENTRY_MAX_CHARS` 字,超出部分改成引用行;
   *  - 整个 thread 段最多 `THREAD_CONTEXT_MAX_CHARS` 字,超预算的条目一律降级为引用行,
   *    引用行也放不下就停止(长度上限保护)。
   * 引用行的落点是既有 `GET /api/subagents/{id}/stats` 的 `result` 字段 —— 下游能取回全文,
   * 不会因 inline 截断而永久丢信息。
   */
  private async _buildPromptWithThread(
    input: ExtendedDispatchInput,
    parentDispatchId: string | undefined,
  ): Promise<string> {
    const base = buildAgentPrompt(input)
    if (!input.conversationId) return base
    const history = await this._loadThreadHistory(input.conversationId, input.ownerUserId)
    if (history.length === 0) return base

    const refLine = (e: ThreadEntry): string =>
      `- [${e.status}] ${e.goal}(派单 id: ${e.id};全文按引用取: GET /api/subagents/${e.id}/stats)`
    const lines: string[] = [
      '',
      '## 同会话历史(thread)',
      parentDispatchId
        ? `本次是既有会话的后续派单,上一条派单 id:${parentDispatchId}`
        : '本次是既有会话的后续派单',
      '近期结果内联;更早或超出预算的内容按引用取全文(不截断丢弃)。',
    ]
    let used = lines.join('\n').length

    // 较早记录:只给引用行(按时间旧→新)
    const older = history.slice(THREAD_CONTEXT_INLINE_ENTRIES)
    if (older.length > 0) {
      lines.push('### 较早记录(按引用取)')
      for (const e of older.reverse()) {
        const line = refLine(e)
        if (used + line.length > THREAD_CONTEXT_MAX_CHARS) break
        lines.push(line)
        used += line.length + 1
      }
    }

    // 近期记录:结果 inline(按时间旧→新);超单条/总预算 ⇒ 该条降级为引用行
    const recent = history.slice(0, THREAD_CONTEXT_INLINE_ENTRIES)
    if (recent.length > 0) {
      lines.push('### 近期记录(内联)')
      for (const e of recent.reverse()) {
        const full = e.result ?? '(无结果)'
        const clipped = full.length > THREAD_CONTEXT_ENTRY_MAX_CHARS
        let block = `- [${e.status}] ${e.goal}\n  结果:${full.slice(0, THREAD_CONTEXT_ENTRY_MAX_CHARS)}${
          clipped ? '…(已截断,全文按引用取)' : ''
        }\n  (派单 id: ${e.id};全文按引用取: GET /api/subagents/${e.id}/stats)`
        if (used + block.length > THREAD_CONTEXT_MAX_CHARS) {
          block = refLine(e)
          if (used + block.length > THREAD_CONTEXT_MAX_CHARS) break
        }
        lines.push(block)
        used += block.length + 1
      }
    }
    return `${base}\n${lines.join('\n')}`
  }

  /**
   * 派单轨迹持久化:创建 agent_tasks 记录(仅 input.agentId 存在时)。
   * 失败静默(轨迹落库失败不影响派单主流程)。返回 task id,无 agentId / 失败返回 undefined。
   */
  private async _createAgentTask(
    input: ExtendedDispatchInput,
    pending: SubagentDispatch,
  ): Promise<string | undefined> {
    if (!input.agentId || input.agentId.length === 0) return undefined
    try {
      const [task] = await db
        .insert(agentTasks)
        .values({
          agentId: input.agentId,
          name: `subagent:${input.orchestration ?? 'parallel'}:${input.agentRole ?? 'coder'}`,
          description: (input.goal ?? '').slice(0, 2000),
          status: 'running',
          startedAt: new Date(),
          payload: { dispatchId: pending.id },
          // 归属回填(2026-11-02):新派单从创建起就带创建者,不再产生新的 NULL 存量。
          // 取不到 ownerUserId(内部调用/旧入口)时才落 null,由迁移口径按 orphan 处理。
          createdBy: input.ownerUserId ?? null,
          // F3:两个派生标记随派单记录一起落库(会话 thread 归属 + 人工注意力)
          parentDispatchId: pending.parentDispatchId ?? null,
          attention: pending.attention ?? null,
        })
        .returning({ id: agentTasks.id })
      return task?.id
    } catch (err) {
      logger.warn(`[subagent-dispatch] _createAgentTask 失败(不阻塞): ${String(err)}`)
      return undefined
    }
  }

  /**
   * 派单轨迹同步:dispatch 进入终态时把 status/result/error 写回 agent_tasks。
   * running/pending 保持创建时的 running;幂等(终态只写一次);失败静默。
   */
  private async _syncAgentTask(runtime: DispatchRuntime): Promise<void> {
    const taskId = runtime.agentTaskId
    if (!taskId) return
    // quota_exceeded / preempted 为代码内 as 强转态,不在 DispatchStatus 联合中。
    // G-672(2026-10-01):终态判定从手写 string 集合换成带谓词的收窄 —— 命中即产出
    // 类型化 outcome,非终态结构上进不了释放原语;未命中语义与旧集合完全一致。
    const status = String(runtime.dispatch.status)
    const releaseOutcome = toLockReleaseOutcome(status)
    if (releaseOutcome === null || releaseOutcome === 'deleted') return
    try {
      const terminalStatus = status === 'preempted' ? 'cancelled' : status
      // 步骤明细(2026-08-06 增补):completed 时把 runtime.steps 写入 result,
      // 供 agents 详情页 5 Tab checkpoint 展示各 step 的 agent/耗时/token 用量。
      const steps = (runtime.steps ?? []).map((s) => ({
        agent: s.agent,
        status: s.status,
        durationMs: s.durationMs,
        attempt: s.attempt,
        tokenUsage: s.tokenUsage,
        error: s.error,
      }))
      const [taskRow] = await db.select().from(agentTasks).where(eq(agentTasks.id, taskId)).limit(1)
      // F1(2026-11-02)幂等:恢复路径可能对同一条派单再次走到终态(例如 checkpoint 已 ok、
      // 重启后又从断点完成)。agent_tasks 已经是该终态 ⇒ 不再 update、不再广播 ——
      // 否则同一任务会出现第二条完成时间/第二次 SSE(外部消费方看到"完成两次")。
      if (taskRow?.status === terminalStatus) {
        logger.info(
          `[subagent-dispatch] agent_tasks ${taskId} 已是 ${terminalStatus},跳过重复终态写回`,
        )
        return
      }
      // P0-2(2026-09-11):终态前统一释放工作区锁(停心跳 + 凭 token 释放 +
      // 清 lockedBy 审计字段 + 广播 workspace_lock_released),防止锁悬挂
      await releaseTaskLockByTaskId(taskId, releaseOutcome)
      // D27(2026-09-20):completed 时聚合交付清单(deliverables)合并进 result ——
      // 保留既有 result 中的其他键,不破坏 output/steps;deliverables 为 null 时不加该键
      const deliverables =
        status === 'completed' && runtime.orchestration
          ? aggregateDeliverables(runtime.orchestration)
          : null
      const existingResult: Record<string, unknown> =
        taskRow?.result && typeof taskRow.result === 'object' && !Array.isArray(taskRow.result)
          ? (taskRow.result as Record<string, unknown>)
          : {}
      await db
        .update(agentTasks)
        .set({
          status: terminalStatus,
          result:
            status === 'completed' && typeof runtime.dispatch.result === 'string'
              ? {
                  ...existingResult,
                  output: runtime.dispatch.result,
                  steps,
                  ...(deliverables ? { deliverables } : {}),
                }
              : undefined,
          errorMessage:
            (status === 'failed' || status === 'quota_exceeded') &&
            typeof runtime.dispatch.result === 'string'
              ? runtime.dispatch.result.slice(0, 2000)
              : undefined,
          completedAt: runtime.completedAt ? new Date(runtime.completedAt) : undefined,
          updatedAt: new Date(),
        })
        .where(eq(agentTasks.id, taskId))
      // P0-2:终态广播 SSE(原先 dispatch 写库不广播,看板需手动刷新才能看到)
      broadcastSSEEvent({
        type: status === 'completed' ? 'task_completed' : 'task_failed',
        taskId,
        payload: {
          dispatchStatus: status,
          task: { id: taskId, status: terminalStatus, teamId: taskRow?.teamId ?? undefined },
        },
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      logger.warn(`[subagent-dispatch] _syncAgentTask 失败(不阻塞): ${String(err)}`)
    }
  }

  /**
   * 人工注意力镜像到 agent_tasks(F3)。
   * 运行时真相仍在 Redis hash + runtimes(重启可恢复);DB 列是派生镜像,
   * 供按 id 查询/审计 —— 失败静默,不阻塞派单主流程(与 `_syncAgentTask` 同口径)。
   */
  private async _syncAttentionToAgentTask(runtime: DispatchRuntime): Promise<void> {
    const taskId = runtime.agentTaskId
    if (!taskId) return
    try {
      // G-998153:先取现值再比。attention 是派生镜像,同一值会被重复同步 ——
      // 同值不发 UPDATE、不盖 updatedAt(该列是增量读的消费源,tasks.ts since 补拉会误读成"变过")。
      const [current] = await db
        .select({ attention: agentTasks.attention })
        .from(agentTasks)
        .where(eq(agentTasks.id, taskId))
        .limit(1)
      // 镜像行尚未建立(_createAgentTask 失败 / 无 agentId):原语义就是 0 行受影响,这里不新建
      if (!current) return
      const desired = runtime.dispatch.attention ?? null
      const changed: { attention?: DispatchAttention | null } = {}
      if (current.attention !== desired) changed.attention = desired
      if (Object.keys(changed).length === 0) return
      await db
        .update(agentTasks)
        .set({ ...changed, updatedAt: new Date() })
        .where(eq(agentTasks.id, taskId))
    } catch (err) {
      logger.warn(`[subagent-dispatch] _syncAttentionToAgentTask 失败(不阻塞): ${String(err)}`)
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
  private async _writeCheckpoint(dispatchId: string, checkpoint: Checkpoint): Promise<void> {
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

  /**
   * F4 Inline & Spill:把上游全文落可寻址存储,返回产物记录。
   *
   * 目标:prompt 里只放摘要 + 引用,不再用 `slice(0, 500)` 把长结果截断丢弃。
   * - 内存 runtime 留一份(本进程即时可读;重启后它没了,Redis 仍在);
   * - Redis 键 `subagent:artifact:{dispatchId}:{stepId}` 存全文 JSON,跨重启可寻址;
   * - 超过 ARTIFACT_MAX_CHARS 时只存前 N 字符并置 truncated(长度保护,不是运行时丢内容)。
   * Redis 写入失败时降级内存,不抛异常(与 checkpoint 同口径)。
   */
  private async _spillArtifact(
    dispatchId: string,
    stepId: string,
    fullText: string,
  ): Promise<DispatchArtifact> {
    const capped =
      fullText.length > ARTIFACT_MAX_CHARS ? fullText.slice(0, ARTIFACT_MAX_CHARS) : fullText
    const artifact: DispatchArtifact = {
      id: `${dispatchId}:${stepId}`,
      dispatchId,
      stepId,
      content: capped,
      truncated: capped.length < fullText.length,
      createdAt: nowIso(),
    }
    this.runtimes.get(dispatchId)?.artifacts.set(stepId, artifact)
    if (this.redisClient) {
      try {
        await this.redisClient.set(`${REDIS_KEY_ARTIFACT}${artifact.id}`, JSON.stringify(artifact))
      } catch {
        // Redis 不可用 → 内存降级,不抛异常
      }
    }
    return artifact
  }

  /**
   * F4:按 id 取回上游产物全文(路由 `GET /subagents/:id/artifacts/:stepId` 的唯一读点)。
   * 读序 = 进程内 runtime(含刚写完) → Redis(跨重启);都没有 ⇒ null(路由给 404)。
   * 归属判据不在本方法内 —— 路由层先过 dispatch-ownership.ts 的唯一出口再调这里。
   */
  async getArtifact(dispatchId: string, stepId: string): Promise<DispatchArtifact | null> {
    const cached = this.runtimes.get(dispatchId)?.artifacts.get(stepId)
    if (cached) return cached
    if (!this.redisClient) return null
    try {
      const raw = await this.redisClient.get(`${REDIS_KEY_ARTIFACT}${dispatchId}:${stepId}`)
      if (!raw) return null
      const parsed = JSON.parse(raw) as DispatchArtifact
      // 只认自家写出的形状;坏数据当「取不到」,不把半个对象交出去
      if (
        parsed &&
        parsed.dispatchId === dispatchId &&
        parsed.stepId === stepId &&
        typeof parsed.content === 'string'
      ) {
        return parsed
      }
      return null
    } catch {
      return null
    }
  }

  // ---------- 归属回填(2026-11-02,先回填后收紧) ----------

  /**
   * 旧派单归属三级推导:conversation 属主 → agent_tasks.created_by → 同会话 thread 兄弟。
   *
   * 调用点只在 `_loadActiveDispatches`,且必须在 `runtimes.set` **之前**完成 ——
   * 这是「先回填、后收紧」的代码侧顺序保证:路由读不到尚未推导归属的记录。
   * 关联 id 非 uuid 时直接跳过(不查库),避免 Postgres 22P02 打断整批装载。
   */
  private async _deriveDispatchOwner(
    raw: Record<string, string>,
    cache: {
      conversations: Map<string, string | null>
      agentTasks: Map<string, string | null>
    },
  ): Promise<{ owner: string; source: 'conversation' | 'agentTask' | 'thread' } | null> {
    const conversationId = raw.conversationId ?? ''
    if (isUuidString(conversationId)) {
      if (!cache.conversations.has(conversationId)) {
        const rows = await dbRead
          .select({ userId: chatConversations.userId })
          .from(chatConversations)
          .where(eq(chatConversations.id, conversationId))
          .limit(1)
        cache.conversations.set(conversationId, rows[0]?.userId ?? null)
      }
      const owner = cache.conversations.get(conversationId)
      if (owner) return { owner, source: 'conversation' }
    }

    const agentTaskId = raw.agentTaskId ?? ''
    if (isUuidString(agentTaskId)) {
      if (!cache.agentTasks.has(agentTaskId)) {
        const rows = await dbRead
          .select({ createdBy: agentTasks.createdBy })
          .from(agentTasks)
          .where(eq(agentTasks.id, agentTaskId))
          .limit(1)
        cache.agentTasks.set(agentTaskId, rows[0]?.createdBy ?? null)
      }
      const owner = cache.agentTasks.get(agentTaskId)
      if (owner) return { owner, source: 'agentTask' }
    }

    if (conversationId && this.redisClient) {
      // 兄弟记录只扫最近 50 条:thread 是"会话连续性"索引,不是全量历史;扫不到即 orphan。
      const siblings = await this.redisClient.zrevrange(
        `${REDIS_KEY_THREAD}${conversationId}`,
        0,
        49,
      )
      for (const siblingId of siblings) {
        if (siblingId === raw.id) continue
        const owner = await this.redisClient.hget(
          `${REDIS_KEY_DISPATCH}${siblingId}`,
          'ownerUserId',
        )
        if (typeof owner === 'string' && owner.length > 0) return { owner, source: 'thread' }
      }
    }
    return null
  }

  /**
   * 回填结果落回 Redis(内存先改,Redis best-effort):成功补 ownerUserId,失败标 orphan;
   * 两种情况都写记账 set,供回滚时逐条 HDEL(见 drizzle/20261102180000 迁移头注释)。
   */
  private async _markBackfilledOwnership(
    id: string,
    owner: string | null,
    source: 'conversation' | 'agentTask' | 'thread' | 'orphan',
  ): Promise<void> {
    if (!this.redisClient) return
    try {
      const key = `${REDIS_KEY_DISPATCH}${id}`
      if (owner) await this.redisClient.hset(key, { ownerUserId: owner })
      else await this.redisClient.hset(key, { ownership: 'orphan' })
      await this.redisClient.sadd(REDIS_KEY_OWNERSHIP_BACKFILL, `${id}|${source}`)
    } catch (err) {
      logger.warn(`[subagent-dispatch] 归属回填落 Redis 失败(内存已生效): ${id} ${String(err)}`)
    }
  }

  /**
   * 初始化时从 Redis 加载所有活跃 dispatch,并把「中断的 running」重新入队。
   *
   * F1(2026-11-02)崩溃自愈:旧实现只把 pending/running 装回内存,不重新执行;
   * 而 `resume` 又拒绝 running ⇒ 进程重启后正在跑的派单既不动也 resume 不了(僵尸)。
   * 现在:
   *  - 先把**足以重建执行**的字段全部恢复(prompt/agentTaskId/steps/dagNodeStatus/messages/outbox);
   *  - running ⇒ 标记 interrupted 留痕,再转 pending 重新入队(不是静默装回内存);
   *  - pending ⇒ 直接重新入队(它本来就还没开始);
   *  - 已在本进程 inFlight 的记录不重复接管(防止重复 load 把活任务误判成中断);
   *  - 旧 hash 缺 ownerUserId ⇒ **先回填再装载**(2026-11-02):回填在 runtimes.set 之前,
   *    路由读不到未推导归属的记录;三源都推不出才标 orphan(仅管理面)。
   */
  private async _loadActiveDispatches(): Promise<void> {
    if (!this.redisClient || this._loading) return
    this._loading = true
    const toRecover: string[] = []
    // 回填统计只落日志(影响面审计);orphan 计数是「收紧后仅管理面可见」的存量口径
    const backfill = {
      scanned: 0,
      alreadyOwned: 0,
      derivedConversation: 0,
      derivedAgentTask: 0,
      derivedThread: 0,
      orphan: 0,
    }
    const deriveCache = {
      conversations: new Map<string, string | null>(),
      agentTasks: new Map<string, string | null>(),
    }
    try {
      const ids = await this.redisClient.smembers(REDIS_KEY_IDS)
      for (const id of ids) {
        // 本进程已持有(构造器已 load / 重复 setRedisClient)⇒ 不覆盖、不重判
        if (this.runtimes.has(id)) continue
        const key = `${REDIS_KEY_DISPATCH}${id}`
        const raw = await this.redisClient.hgetall(key)
        if (!raw || !raw.id) continue
        const status = raw.status as ExtendedDispatchStatus
        // F2:queued 也必须加载 —— 重启后它仍在 zset 里等槽位;interrupted 是恢复中途宕机的遗留,
        // 同样不能漏(否则记录既不动也 resume 不了)。
        if (
          status !== 'pending' &&
          status !== 'running' &&
          status !== 'queued' &&
          status !== 'interrupted'
        ) {
          continue
        }
        const dispatch: SubagentDispatch = {
          id: raw.id,
          goal: raw.goal || '',
          affectedFiles: parseJsonOr<string[]>(raw.affectedFiles, []),
          forbidden: parseJsonOr<string[]>(raw.forbidden, []),
          verifyCommands: parseJsonOr<string[]>(raw.verifyCommands, []),
          constraints: raw.constraints || '',
          deliverables: raw.deliverables || '',
          agentRole: (raw.agentRole || 'coder') as SubagentRole,
          orchestration: (raw.orchestration || 'parallel') as OrchestrationMode,
          // 声明面只容基础档;真正的扩展档经写侧视图落回同一个对象(见 statusWriteView 注释)
          status: status === 'running' ? 'running' : 'pending',
          result: raw.result || undefined,
          createdAt: raw.createdAt || nowIso(),
          updatedAt: raw.updatedAt || nowIso(),
          // 旧 hash 没有该字段 ⇒ undefined ⇒ 「未标注」,不塞常量顶替
          ownerUserId: raw.ownerUserId || undefined,
          // 回填标记:只有"无 owner 且已判定 orphan"的记录才带;有 owner 的记录不保留 orphan
          ownership: raw.ownership === 'orphan' && !raw.ownerUserId ? 'orphan' : undefined,
          // conversationId 同理:旧 hash 没有就保持未归属
          conversationId: raw.conversationId || undefined,
          // F3:旧 hash 没有这两项 ⇒ undefined = 无父 / 不需要人(不塞常量顶替)
          parentDispatchId: raw.parentDispatchId || undefined,
          attention:
            raw.attention === 'awaiting_answer' || raw.attention === 'awaiting_review'
              ? raw.attention
              : undefined,
        }
        statusWriteView(dispatch).status = status
        const retry = raw.retry
          ? parseJsonOr<RetryConfig | undefined>(raw.retry, undefined)
          : undefined
        const dag = raw.dag ? parseJsonOr<DagConfig | undefined>(raw.dag, undefined) : undefined
        const priority = (raw.priority as DispatchPriority) || 'normal'
        const quotas = raw.quotas
          ? parseJsonOr<QuotaConfig | undefined>(raw.quotas, undefined)
          : undefined
        const runtime: DispatchRuntime = {
          dispatch,
          retry,
          dag,
          priority,
          quotas,
          prompt: raw.prompt || undefined,
          outbox: raw.outbox
            ? parseJsonOr<RetryJournal | undefined>(raw.outbox, undefined)
            : undefined,
          steps: parseJsonOr<DispatchRuntime['steps']>(raw.steps, []),
          logs: [],
          startedAt: raw.startedAt ? Number(raw.startedAt) : undefined,
          completedAt: raw.completedAt ? Number(raw.completedAt) : undefined,
          hasFailed: false,
          checkpoints: new Map(),
          messages: parseJsonOr<CommunicationMessage[]>(raw.messages, []),
          dagNodeStatus: new Map(
            parseJsonOr<Array<[string, ExtendedDispatchStatus]>>(raw.dagNodeStatus, []),
          ),
          // F4:产物不随 hash 恢复 —— 全文在独立的 artifact 键里,getArtifact 按需读 Redis
          artifacts: new Map(),
          agentTaskId: raw.agentTaskId || undefined,
        }
        // 归属回填(2026-11-02):必须在 runtimes.set **之前**完成 ——
        // 推导成功 ⇒ 本人可见;三源都推不出 ⇒ orphan(仅管理面),不再回落「未标注公开」。
        backfill.scanned += 1
        if (dispatch.ownerUserId) {
          backfill.alreadyOwned += 1
        } else {
          try {
            const derived = await this._deriveDispatchOwner(raw, deriveCache)
            if (derived) {
              dispatch.ownerUserId = derived.owner
              dispatch.ownership = undefined
              await this._markBackfilledOwnership(id, derived.owner, derived.source)
              if (derived.source === 'conversation') backfill.derivedConversation += 1
              else if (derived.source === 'agentTask') backfill.derivedAgentTask += 1
              else backfill.derivedThread += 1
            } else {
              dispatch.ownership = 'orphan'
              await this._markBackfilledOwnership(id, null, 'orphan')
              backfill.orphan += 1
            }
          } catch (err) {
            // 推导异常按 orphan 处理:该条不公开、不中断整批;计数照报
            dispatch.ownership = 'orphan'
            backfill.orphan += 1
            logger.warn(`[subagent-dispatch] 归属推导失败,按 orphan 处理: ${id} ${String(err)}`)
          }
        }
        this.runtimes.set(id, runtime)
        // checkpoint 是独立 hash(redis 优先,内存为空)⇒ 恢复已完成步骤/断点
        runtime.checkpoints = await this._loadCheckpoints(id)
        toRecover.push(id)
      }
    } catch (err) {
      logger.warn(`[subagent-dispatch] _loadActiveDispatches 失败(降级内存): ${String(err)}`)
    } finally {
      this._loading = false
    }
    // 读取全部完成后再发起执行:避免在 Redis 读循环里穿插写/跑
    if (backfill.scanned > 0 && (backfill.orphan > 0 || backfill.scanned > backfill.alreadyOwned)) {
      logger.info(`[subagent-dispatch] 归属回填统计: ${JSON.stringify(backfill)}`)
    }
    for (const id of toRecover) {
      await this._recoverInterruptedDispatch(id)
    }
    // 恢复过程中放不进槽位的记录已落 queued ⇒ 按真队列顺序补位(容量足则立即开跑)
    await this._drainQueue()
  }

  /**
   * 接管一条重启前未终态的派单。
   * running ⇒ interrupted(留痕)⇒ 有槽位则 pending 重新入队,无槽位则 queued 等槽位;
   * pending / interrupted ⇒ 同一条准入路径(不再无条件开跑);
   * queued ⇒ 留在队列(刷新 zset 成员),由 `_drainQueue` 按顺序补位。
   * 已在 inFlight ⇒ 跳过(本进程正在执行,不是中断)。
   */
  private async _recoverInterruptedDispatch(id: string): Promise<void> {
    const runtime = this.runtimes.get(id)
    if (!runtime || this.inFlight.has(id)) return
    const from = statusReadView(runtime.dispatch).status
    if (from === 'queued') {
      // 重启后队列成员:重新写一次 zset(分数按记录 createdAt 复原),不在这里抢跑
      await this._persistDispatch(id)
      await this._persistLog(id, {
        ts: nowIso(),
        level: 'info',
        event: 'dispatch_queue_restored',
        data: { priority: runtime.priority },
      })
      return
    }
    const wasRunning = from === 'running'
    if (wasRunning) {
      statusWriteView(runtime.dispatch).status = 'interrupted'
      runtime.dispatch.updatedAt = nowIso()
      await this._persistDispatch(id)
      await this._persistLog(id, {
        ts: nowIso(),
        level: 'warn',
        event: 'dispatch_interrupted',
        data: {
          reason: 'process_restart',
          // 已有 checkpoint 的步骤不会重跑(resume 时按 status=ok 跳过)
          checkpointedSteps: Array.from(runtime.checkpoints.values()).filter(
            (cp) => cp.status === 'ok',
          ).length,
          outbox: runtime.outbox ?? null,
        },
      })
    }

    // F2:恢复也要走同一份容量判据 —— 不能因为「重启」就把全局/租户上限撑破;
    // 放不下的落 queued,等槽位释放后按真队列顺序续跑(仍然满足 F1「自动续跑」)。
    const blocked = this._capacityBlocked(runtime.priority, runtime.dispatch.ownerUserId, id)
    if (blocked) {
      statusWriteView(runtime.dispatch).status = 'queued'
      runtime.dispatch.updatedAt = nowIso()
      await this._persistDispatch(id)
      await this._persistLog(id, {
        ts: nowIso(),
        level: 'info',
        event: 'dispatch_requeued',
        data: { from, blockedBy: blocked },
      })
      return
    }

    runtime.dispatch.status = 'pending'
    runtime.dispatch.updatedAt = nowIso()
    await this._persistDispatch(id)
    await this._persistLog(id, {
      ts: nowIso(),
      level: 'info',
      event: 'dispatch_recovered',
      data: { from: wasRunning ? 'interrupted' : from, hasDag: Boolean(runtime.dag) },
    })
    this._scheduleExecution(
      id,
      runtime.dag !== undefined && (runtime.dispatch.orchestration ?? 'parallel') === 'parallel',
    )
  }

  /**
   * 容量判据(唯一出口):返回 null = 有槽位;否则返回被哪一档挡住。
   * 计数口径与 `isActiveDispatchStatus` 同源(pending|running 占槽;queued 不占)。
   * 先判全局硬上限,再判租户总上限,最后判租户内优先级上限 —— 三层都过才允许开跑。
   */
  private _capacityBlocked(
    priority: DispatchPriority,
    ownerUserId: string | undefined,
    excludeId?: string,
  ): 'global' | 'tenant' | 'priority' | null {
    // 判「有没有槽位」时必须排除正在申请的那条记录(它已先入 Map,状态为 pending/queued):
    // 不排除 ⇒ 申请人把自己算进占用,租户优先级上限为 1 时任何单都进不来(自锁)。
    const active = Array.from(this.runtimes.values()).filter(
      (r) => r.dispatch.id !== excludeId && isActiveDispatchStatus(r.dispatch.status),
    )
    if (active.length >= this._maxConcurrent) return 'global'
    const tenantActive = active.filter((r) => r.dispatch.ownerUserId === ownerUserId)
    if (tenantActive.length >= DEFAULT_TENANT_MAX_CONCURRENT) return 'tenant'
    const tenantPriorityActive = tenantActive.filter((r) => r.priority === priority)
    if (tenantPriorityActive.length >= TENANT_PRIORITY_MAX_CONCURRENT[priority]) return 'priority'
    return null
  }

  /**
   * 读真队列(F2):zset 分数已编码「优先级 + createdAt」,`zrevrange` 的顺序就是出队顺序。
   * Redis 不可用时按内存做同一口径的降级读(不另建第二套排序语义)。
   */
  private async _queuedIds(): Promise<string[]> {
    if (this.redisClient) {
      try {
        const raw = await this.redisClient.zrevrange(REDIS_KEY_QUEUE, 0, -1, 'WITHSCORES')
        const ids: string[] = []
        for (let i = 0; i + 1 < raw.length; i += 2) ids.push(raw[i]!)
        return ids
      } catch {
        // Redis 不可用 → 内存降级
      }
    }
    return Array.from(this.runtimes.values())
      .filter((r) => statusReadView(r.dispatch).status === 'queued')
      .sort(
        (a, b) =>
          PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority] ||
          a.dispatch.createdAt.localeCompare(b.dispatch.createdAt),
      )
      .map((r) => r.dispatch.id)
  }

  /** 从真队列移除(记录已出队 / 已取消 / 已终态) */
  private async _removeFromQueue(id: string): Promise<void> {
    if (!this.redisClient) return
    try {
      await this.redisClient.zrem(REDIS_KEY_QUEUE, id)
    } catch {
      // Redis 不可用 → 内存视图不维护 zset,忽略
    }
  }

  /**
   * 真队列出队:按 zset 顺序扫描,能放进槽位的逐条提升为 pending 并开跑。
   *
   * 为什么是「扫描」而不是只取队首:队首可能属于已打满的租户,只取队首会让该租户
   * 把所有人的队列堵死(与 F2「单租户打满只影响自己」相反)。扫描保证**实际出队顺序
   * 仍严格服从 zset 顺序**,只是跳过此刻放不下的项(它们留在队列里等下次槽位释放)。
   */
  private async _drainQueue(): Promise<void> {
    if (this._draining) return
    this._draining = true
    try {
      const ids = await this._queuedIds()
      for (const id of ids) {
        const runtime = this.runtimes.get(id)
        if (!runtime || statusReadView(runtime.dispatch).status !== 'queued') {
          await this._removeFromQueue(id)
          continue
        }
        if (this._capacityBlocked(runtime.priority, runtime.dispatch.ownerUserId, id)) continue
        runtime.dispatch.status = 'pending'
        runtime.dispatch.updatedAt = nowIso()
        await this._persistDispatch(id)
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'info',
          event: 'dispatch_dequeued',
          data: { priority: runtime.priority, ownerUserId: runtime.dispatch.ownerUserId ?? null },
        })
        this._scheduleExecution(
          id,
          runtime.dag !== undefined &&
            (runtime.dispatch.orchestration ?? 'parallel') === 'parallel',
        )
      }
    } finally {
      this._draining = false
    }
  }

  /**
   * 把一条 runtimes 记录交给对应的执行器(dispatch / resume / 启动恢复共用一条入口)。
   * 维护 inFlight 集合,既是「重复接管」的保护,也是「本进程内活任务」的判据。
   *
   * `preferDag` 由调用方按**建单时的执行模式**传入(dispatch 只在 dag+parallel 时走 DAG;
   * resume 沿用既有语义:有 dag 就走 DAG)—— 恢复不能改变在途任务的执行语义。
   */
  private _scheduleExecution(id: string, preferDag: boolean): boolean {
    if (this.inFlight.has(id)) return false
    const runtime = this.runtimes.get(id)
    if (!runtime) return false
    const dispatch = runtime.dispatch
    const mode = dispatch.orchestration ?? 'parallel'
    const role = dispatch.agentRole ?? 'coder'
    const prompt = runtime.prompt ?? buildAgentPrompt(dispatch)
    runtime.prompt = prompt
    this.inFlight.add(id)
    const execution =
      preferDag && runtime.dag
        ? this.runDispatchDag(id, prompt, runtime.retry, runtime.quotas)
        : mode === 'with_communication'
          ? this.runDispatchWithCommunication(id, role, prompt, runtime.retry, runtime.quotas)
          : this.runDispatch(id, mode, role, prompt, runtime.retry, runtime.quotas)
    void execution
      .catch((err) => {
        logger.warn(`[subagent-dispatch] 执行器异常(不抛出): ${String(err)}`)
      })
      .finally(() => {
        this.inFlight.delete(id)
      })
    return true
  }

  // ---------- 主方法 ----------

  /** 创建并派发:检查并发 → 入 Map → DAG 校验 → 异步调 ai-service */
  async dispatch(input: ExtendedDispatchInput): Promise<DispatchCallResult> {
    // DAG 循环检测
    if (input.dag) {
      if (hasCycle(input.dag.nodes, input.dag.edges)) {
        return {
          outcome: 'cyclic_dependency',
          error: 'DAG 存在循环依赖,无法执行',
        }
      }
    }

    // 优先级调度:urgent 可抢占(仅同租户,见 _tryPreempt);并发满额不再在这里拒绝,
    // 统一在入 Map 之后走 F2 准入(_capacityBlocked + 落 queued),因此不会出现 429。
    const priority: DispatchPriority = input.priority ?? 'normal'

    const role: SubagentRole = input.agentRole ?? 'coder'
    const mode: OrchestrationMode = input.orchestration ?? 'parallel'

    // 校验 retry 配置
    const retry: RetryConfig | undefined = input.retry
      ? {
          maxAttempts: Math.min(MAX_RETRY_ATTEMPTS, Math.max(1, input.retry.maxAttempts)),
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
    // F3(2026-11-02)Thread/Ticket:同会话的后续派单默认挂到既有 thread 上(不孤立新开)。
    // 父节点 = 同 conversationId 里最近一条、且同租户的派单;跨租户不成链。
    const parentDispatchId = await this._resolveParentDispatchId(
      input.conversationId,
      input.ownerUserId,
    )
    if (parentDispatchId) pending.parentDispatchId = parentDispatchId
    // prompt 建单时算一次并落 Redis(F1);F3 起拼装会带同 thread 的历史上下文
    // (近期 inline,更早/超预算的留下「按引用取」,不把整条 thread 一股脑塞进来)
    const prompt = await this._buildPromptWithThread(input, parentDispatchId)
    const runtime: DispatchRuntime = {
      dispatch: pending,
      retry,
      dag,
      priority,
      quotas,
      // prompt 建单时算一次并落 Redis(F1):恢复时原样复用,不受 build 函数未来变更影响
      prompt,
      steps: [],
      logs: [],
      hasFailed: false,
      checkpoints: new Map(),
      messages: [],
      dagNodeStatus: new Map(),
      artifacts: new Map(),
    }
    this.runtimes.set(pending.id, runtime)
    // 2026-08-06: 派单轨迹持久化 — 带 agentId 的派单写入 agent_tasks(agents 详情页 5 Tab 运行时数据源)
    runtime.agentTaskId = await this._createAgentTask(input, pending)

    // F2 准入(唯一判据):全局硬上限 → 租户总上限 → 租户内优先级上限。
    // urgent 可先尝试同租户抢占自己的低优任务;仍无槽位则落 queued —— 不返回 concurrent_limit/429。
    let blocked = this._capacityBlocked(priority, input.ownerUserId, pending.id)
    if (blocked && priority === 'urgent' && this._tryPreempt(input.ownerUserId)) {
      blocked = this._capacityBlocked(priority, input.ownerUserId, pending.id)
    }
    if (blocked) {
      statusWriteView(pending).status = 'queued'
      pending.updatedAt = nowIso()
    }

    await this._persistDispatch(pending.id)
    await this._persistLog(pending.id, {
      ts: nowIso(),
      level: 'info',
      event: 'dispatch_created',
      data: {
        mode,
        role,
        retry,
        priority,
        hasDag: !!dag,
        hasQuotas: !!quotas,
        queued: blocked !== null,
        blockedBy: blocked,
      },
    })
    if (blocked) {
      await this._persistLog(pending.id, {
        ts: nowIso(),
        level: 'info',
        event: 'dispatch_queued',
        data: { blockedBy: blocked, priority },
      })
    } else {
      // 异步调 ai-service(不 await,立即返回 pending);与启动恢复共用同一执行入口
      this._scheduleExecution(pending.id, dag !== undefined && mode === 'parallel')
    }

    return { dispatch: pending, outcome: 'ok' }
  }

  /**
   * 尝试抢占最低优先级的 running dispatch。
   * 仅 urgent 可以抢占 low/normal,且**只能抢同一 ownerUserId 的记录**。
   * 返回 true = 抢占成功。
   *
   * P0-1(2026-11-02):候选原先取自 runtimes 全集、只按 priority 排序 ⇒ 等于绕过了
   * `/cancel` 的 ownsDispatch 归属闸:A 租户的 urgent 能把 B 租户的 normal 任务置 preempted。
   * 归属判据直接读派单记录自己的 `ownerUserId`(与 isDispatchVisibleTo 同字段,不另立租户表达);
   * 无同租户候选 ⇒ 返回 false,调用方按既有 `concurrent_limit` 路径返回(不发明新错误码)。
   * 无 `ownerUserId` 的旧记录(未标注)只在发起方也「未标注」时才是候选 —— 不做跨租户写入。
   */
  private _tryPreempt(ownerUserId: string | undefined): boolean {
    const candidates = Array.from(this.runtimes.values())
      .filter((r) => r.dispatch.status === 'running' || r.dispatch.status === 'pending')
      .filter((r) => r.priority === 'low' || r.priority === 'normal')
      .filter((r) => r.dispatch.ownerUserId === ownerUserId)
      .sort((a, b) => PRIORITY_SCORE[a.priority] - PRIORITY_SCORE[b.priority])
    if (candidates.length === 0) return false
    const target = candidates[0]!
    // 'preempted' 不在 DispatchStatus 内,真实域是 ExtendedDispatchStatus ⇒ 经扩展域视图写回
    statusWriteView(target.dispatch).status = 'preempted'
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

    // F1(2026-11-02)断点完成:进程可能在 AI 返回后、写终态前重启,但 checkpoint
    // 已经落 Redis(status=ok)。恢复时直接按已完成收尾,不再调一次 AI(不重复执行)。
    // 只认本执行器写的 `step-N`;DAG 节点 id / with_communication 的 comm-N 不在此列。
    const completedCheckpoint = Array.from((await this._loadCheckpoints(id)).values())
      .filter((cp) => cp.status === 'ok' && /^step-\d+$/.test(cp.stepId))
      .sort((a, b) => a.stepId.localeCompare(b.stepId))
      .pop()
    if (completedCheckpoint) {
      dispatch.status = 'completed'
      dispatch.result = completedCheckpoint.result ?? ''
      dispatch.updatedAt = nowIso()
      runtime.completedAt = runtime.completedAt ?? Date.now()
      runtime.hasFailed = false
      runtime.outbox = undefined
      await this._persistDispatch(id)
      await this._persistLog(id, {
        ts: nowIso(),
        level: 'info',
        event: 'dispatch_recovered_from_checkpoint',
        data: { stepId: completedCheckpoint.stepId, resumedFrom: 'checkpoint' },
      })
      return
    }

    // 标记 running
    dispatch.status = 'running'
    dispatch.updatedAt = nowIso()
    runtime.startedAt = runtime.startedAt ?? Date.now()
    await this._persistDispatch(id)
    await this._persistLog(id, {
      ts: nowIso(),
      level: 'info',
      event: 'dispatch_started',
      data: { mode, role, recoveredOutbox: runtime.outbox ?? null },
    })

    const maxAttempts =
      (retry?.maxAttempts ?? quotas?.maxRetries)
        ? Math.max(retry?.maxAttempts ?? 1, (quotas?.maxRetries ?? 0) + 1)
        : 1
    const delayMs = retry?.delayMs ?? 1000
    const timeoutMs = quotas?.timeoutMs ?? 0
    const tokenQuota = quotas?.tokenQuota ?? 0

    // outbox 式续跑:恢复时从「已执行过的尝试序号」继续,并等下一次允许投递的时间;
    // 旧实现只有一个内存里的 attempt 变量,重启即失忆(从头再来 ⇒ 重复执行已失败的那次)。
    let attempt = runtime.outbox?.attempt ?? 0
    const journaledMax = runtime.outbox?.maxAttempts ?? 0
    const effectiveMaxAttempts = Math.max(maxAttempts, journaledMax)
    if (runtime.outbox) {
      const waitMs = runtime.outbox.nextRetryAt - Date.now()
      if (waitMs > 0) {
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'info',
          event: 'dispatch_retry_wait_restored',
          data: { attempt, waitMs, maxAttempts: effectiveMaxAttempts },
        })
        await sleep(waitMs)
      }
    }
    while (attempt < effectiveMaxAttempts) {
      attempt++
      const stepStart = Date.now()

      // 超时监控(用 Promise.race)
      const callPromise = callAiService(mode, role, prompt)
      const result =
        timeoutMs > 0
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
        // 标记 dispatch 为 quota_exceeded(同 'preempted':扩展值,走扩展域视图写入)
        statusWriteView(dispatch).status = 'quota_exceeded'
        dispatch.result = quotaError
        runtime.completedAt = Date.now()
        runtime.hasFailed = true
        runtime.outbox = undefined
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
        // D27:缓存编排原始结果,供终态 _syncAgentTask 聚合交付清单(deliverables)落库
        runtime.orchestration = result.data ?? null
        runtime.completedAt = Date.now()
        runtime.hasFailed = false
        runtime.outbox = undefined
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
        runtime.outbox = undefined
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
      if (attempt < effectiveMaxAttempts) {
        const waitMs = delayMs * 2 ** (attempt - 1)
        // outbox:把「重试意图」落 Redis 后再等 —— 等待窗口内进程重启,恢复时
        // 从 attempt+1 继续,不会把已经失败的那次再执行一遍。
        runtime.outbox = {
          attempt,
          maxAttempts: effectiveMaxAttempts,
          nextRetryAt: Date.now() + waitMs,
          lastError: result.message,
        }
        await this._persistDispatch(id)
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'warn',
          event: 'step_retry',
          data: {
            attempt,
            error: result.message,
            waitMs,
            nextRetryAt: runtime.outbox.nextRetryAt,
            maxAttempts: effectiveMaxAttempts,
          },
        })
        await sleep(waitMs)
      } else {
        // 重试耗尽 → 标记 step failed
        runtime.hasFailed = true
        dispatch.status = 'failed'
        dispatch.result = result.message
        runtime.completedAt = Date.now()
        runtime.outbox = undefined
        await this._persistDispatch(id)
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'error',
          event: 'dispatch_failed',
          data: { attempt, error: result.message, maxAttempts: effectiveMaxAttempts },
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
    runtime.startedAt = runtime.startedAt ?? Date.now()
    await this._persistDispatch(id)
    await this._persistLog(id, {
      ts: nowIso(),
      level: 'info',
      event: 'dag_started',
      data: {
        nodes: dag.nodes.length,
        edges: dag.edges.length,
        recoveredOutbox: runtime.outbox ?? null,
      },
    })

    // 拓扑排序(已在 dispatch 入口校验无环)
    const layers = topologicalSort(dag.nodes, dag.edges)
    if (!layers) {
      dispatch.status = 'failed'
      dispatch.result = 'DAG 存在循环依赖'
      runtime.completedAt = Date.now()
      runtime.outbox = undefined
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
        //
        // F4(2026-11-02)Inline & Spill:短结果整段 inline;超出 UPSTREAM_CONTEXT_INLINE_CHARS 的
        // 长结果只 inline 摘要,全文落可寻址产物并在 prompt 里给 id + 取回地址 ——
        // 旧实现 `slice(0, 500)` 会把下游永远拿不到的内容直接丢掉。
        const upstreamEdges = dag.edges.filter((e) => e.to === nodeId)
        const upstreamContext = (
          await Promise.all(
            upstreamEdges.map(async (e) => {
              const upstreamResult = results.get(e.from) ?? ''
              if (upstreamResult.length <= UPSTREAM_CONTEXT_INLINE_CHARS) {
                return `[上游 ${e.from} 结果]: ${upstreamResult}`
              }
              const artifact = await this._spillArtifact(id, e.from, upstreamResult)
              return (
                `[上游 ${e.from} 结果摘要]: ${upstreamResult.slice(0, UPSTREAM_CONTEXT_INLINE_CHARS)}…\n` +
                `[上游 ${e.from} 全文引用]: id=${artifact.id} · GET /api/subagents/${id}/artifacts/${e.from}` +
                (artifact.truncated
                  ? `(产物超过 ${ARTIFACT_MAX_CHARS} 字符存储上限,已按上限截存)`
                  : '')
              )
            }),
          )
        ).join('\n')
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
            runtime.dagNodeStatus.set(edge.to, 'cancelled')
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
    const hasFailed = Array.from(runtime.dagNodeStatus.values()).some((s) => s === 'failed')

    dispatch.status = hasFailed ? 'failed' : 'completed'
    dispatch.result = allResults
    runtime.completedAt = Date.now()
    runtime.hasFailed = hasFailed
    runtime.outbox = undefined
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

    // F1:与 runDispatch 同口径 —— 已有 ok checkpoint 就不再重跑 AI
    const completedCheckpoint = Array.from((await this._loadCheckpoints(id)).values())
      .filter((cp) => cp.status === 'ok' && /^comm-\d+$/.test(cp.stepId))
      .sort((a, b) => a.stepId.localeCompare(b.stepId))
      .pop()
    if (completedCheckpoint) {
      dispatch.status = 'completed'
      dispatch.result = completedCheckpoint.result ?? ''
      dispatch.updatedAt = nowIso()
      runtime.completedAt = runtime.completedAt ?? Date.now()
      runtime.hasFailed = false
      runtime.outbox = undefined
      await this._persistDispatch(id)
      await this._persistLog(id, {
        ts: nowIso(),
        level: 'info',
        event: 'dispatch_recovered_from_checkpoint',
        data: { stepId: completedCheckpoint.stepId, resumedFrom: 'checkpoint' },
      })
      return
    }

    dispatch.status = 'running'
    dispatch.updatedAt = nowIso()
    runtime.startedAt = runtime.startedAt ?? Date.now()
    await this._persistDispatch(id)
    await this._persistLog(id, {
      ts: nowIso(),
      level: 'info',
      event: 'with_communication_started',
      data: { rounds: DEFAULT_COMM_ROUNDS, recoveredOutbox: runtime.outbox ?? null },
    })

    const maxAttempts = retry?.maxAttempts ?? 1
    const delayMs = retry?.delayMs ?? 1000

    let attempt = runtime.outbox?.attempt ?? 0
    const journaledMax = runtime.outbox?.maxAttempts ?? 0
    const effectiveMaxAttempts = Math.max(maxAttempts, journaledMax)
    if (runtime.outbox) {
      const waitMs = runtime.outbox.nextRetryAt - Date.now()
      if (waitMs > 0) {
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'info',
          event: 'dispatch_retry_wait_restored',
          data: { attempt, waitMs, maxAttempts: effectiveMaxAttempts },
        })
        await sleep(waitMs)
      }
    }
    while (attempt < effectiveMaxAttempts) {
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
        // D27:缓存编排原始结果(with_communication 的 data 恒为 null → 交付清单不加,行为与契约一致)
        runtime.orchestration = result.data ?? null
        runtime.completedAt = Date.now()
        runtime.hasFailed = false
        runtime.outbox = undefined
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
        runtime.outbox = undefined
        await this._persistDispatch(id)
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'error',
          event: 'dispatch_not_implemented',
          data: { message: result.message },
        })
        return
      }

      if (attempt < effectiveMaxAttempts) {
        const waitMs = delayMs * 2 ** (attempt - 1)
        runtime.outbox = {
          attempt,
          maxAttempts: effectiveMaxAttempts,
          nextRetryAt: Date.now() + waitMs,
          lastError: result.message,
        }
        await this._persistDispatch(id)
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'warn',
          event: 'step_retry',
          data: { attempt, error: result.message, waitMs, mode: 'with_communication' },
        })
        await sleep(waitMs)
      } else {
        runtime.hasFailed = true
        dispatch.status = 'failed'
        dispatch.result = result.message
        runtime.completedAt = Date.now()
        runtime.outbox = undefined
        await this._persistDispatch(id)
        await this._persistLog(id, {
          ts: nowIso(),
          level: 'error',
          event: 'dispatch_failed',
          data: { attempt, error: result.message, maxAttempts: effectiveMaxAttempts },
        })
        return
      }
    }
  }

  /**
   * 进入 / 清除人工注意力(F3 Thread/Ticket)。
   *
   * 与执行状态机正交:不改 `status`(否则等于凭空造出第 9/10 个执行态,
   * 并让既有 8 状态消费方全部要跟着改)。`attention` 只是「需要人回答 / 需要人复核」标记:
   *  - 进入:仅非终态记录(终态记录不再需要人来处理);
   *  - 清除:任意时刻可做(外部回路处理完后清标记,记录状态不变);
   *  - 写 Redis hash(重启可恢复)+ 镜像 agent_tasks.attention(有 agentTaskId 时);
   *  - `/subagents/active` 返回整条记录,新字段自然反映,不需要另开接口口径。
   */
  async setAttention(id: string, attention: DispatchAttention | null): Promise<SetAttentionResult> {
    const runtime = this.runtimes.get(id)
    if (!runtime) return { ok: false, reason: 'not_found' }
    if (attention !== null && isTerminalDispatchStatus(String(runtime.dispatch.status))) {
      return { ok: false, reason: 'terminal' }
    }
    if (attention === null) delete runtime.dispatch.attention
    else runtime.dispatch.attention = attention
    runtime.dispatch.updatedAt = nowIso()
    await this._persistDispatch(id)
    await this._persistLog(id, {
      ts: nowIso(),
      level: 'info',
      event: 'dispatch_attention_changed',
      data: { attention },
    })
    await this._syncAttentionToAgentTask(runtime)
    return { ok: true, dispatch: runtime.dispatch }
  }

  /** 取消派单:pending/running/queued 可取消(queued 取消即从真队列移除) */
  cancel(id: string): boolean {
    const runtime = this.runtimes.get(id)
    if (!runtime) return false
    const d = runtime.dispatch
    if (d.status !== 'pending' && d.status !== 'running' && statusReadView(d).status !== 'queued') {
      return false
    }
    d.status = 'cancelled'
    d.updatedAt = nowIso()
    runtime.completedAt = Date.now()
    // 终态:清掉 outbox 重试意图(否则下轮启动会把已取消的派单当"待重试"恢复)
    runtime.outbox = undefined
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
      .filter((d) => isActiveDispatchStatus(d.status))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  /** 列出全部派单(供拓扑推导) */
  listAll(): SubagentDispatch[] {
    return Array.from(this.runtimes.values())
      .map((r) => r.dispatch)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  /**
   * 取单条派单(只读,不改任何状态)。
   *
   * S-ACL(2026-11-01):按 id 的 6 个端点原先直接调 cancel/resume/getDispatchStats/...,
   * 路由层拿不到记录就无法判归属 ⇒ 知道 id 即可跨租户读/取消。
   * 这里只补一个**读**出口给路由层做归属闸;鉴权判据留在路由(§22c:判据单一份)。
   * **不**给 cancel/resume 塞 owner 参数 —— 那两个方法还背着并发上限与状态机语义。
   */
  findById(id: string): SubagentDispatch | null {
    return this.runtimes.get(id)?.dispatch ?? null
  }

  /**
   * 统计读数(六个字段同源:都从 `runtimes` 的同一个集合派生)。
   *
   * S-STATS(2026-11-01):原实现的 total / totalTokens / avgDurationMs 读自进程级累加器
   * `_stats`(无租户维度)⇒ 任何登录用户拿到的是**全站**派单数与 token 总量。
   * 传 `visible` 就只算该调用方可见的记录;判据仍由路由提供(isDispatchVisibleTo),
   * 本类不持有租户表达(§22c:判据单一份)。
   *
   * 为什么删掉累加器而不是按 owner 再开一份桶:
   *  - token/时长本来就在记录上(`runtime.steps[].tokenUsage` / `startedAt|completedAt`),
   *    累加器只是同一份数据的**第二份副本** —— 副本与记录生命周期脱钩正是 G-998156 那一族
   *    (重复进账/续跑重放)缺陷的根;按需聚合后这类漂移结构上不存在。
   *  - 分桶累加还要在 3 个写点上各带 owner,任何一处漏带就静默落进别人的桶;
   *    按需聚合没有写点,只有一处读口径。
   *
   * 口径与旧实现对齐:total = 记录数(旧 `totalDispatches` 在创建时 +1,而 runtimes 只增不减 ⇒ 等价);
   * avgDurationMs 的分母仍是 total(未终态记录按 0 时长参与分母,与旧实现一致)。
   */
  getStats(visible?: (dispatch: SubagentDispatch) => boolean): DispatchStats {
    const runtimes = Array.from(this.runtimes.values()).filter(
      (r) => !visible || visible(r.dispatch),
    )
    const all = runtimes.map((r) => r.dispatch)
    const active = all.filter((d) => isActiveDispatchStatus(d.status)).length
    const completed = all.filter((d) => d.status === 'completed').length
    const failed = all.filter((d) => d.status === 'failed').length
    const total = all.length
    let totalTokens = 0
    let totalDurationMs = 0
    for (const r of runtimes) {
      totalTokens += r.steps.reduce((acc, s) => acc + s.tokenUsage.total, 0)
      if (r.startedAt !== undefined && r.completedAt !== undefined) {
        totalDurationMs += r.completedAt - r.startedAt
      }
    }
    const avgDurationMs = total > 0 ? Math.round(totalDurationMs / total) : 0
    return { active, completed, failed, total, avgDurationMs, totalTokens }
  }

  /** 单个 dispatch 资源统计 */
  getDispatchStats(id: string): DispatchResourceStats | null {
    const runtime = this.runtimes.get(id)
    if (!runtime) return null
    const d = runtime.dispatch
    const totalDurationMs = (runtime.completedAt ?? Date.now()) - (runtime.startedAt ?? 0)
    const totalTokens = runtime.steps.reduce((acc, s) => acc + s.tokenUsage.total, 0)
    return {
      dispatchId: id,
      status: coerceKnownOr(
        d.status,
        [
          'pending',
          'running',
          'completed',
          'failed',
          'cancelled',
          'paused',
          'preempted',
          'quota_exceeded',
          'interrupted',
          'queued',
        ],
        'failed',
      ),
      totalDurationMs,
      totalTokens,
      estimatedCost: Math.round(totalTokens * COST_PER_TOKEN_USD * 1e6) / 1e6,
      // F3:纯增量字段(既有消费方不受影响):
      //  - result 是全文本体,thread 上下文里的「全文按引用取」就落在这里(不靠截断丢信息);
      //  - parentDispatchId / attention 与派单记录同值,按 id 端点也能看到。
      parentDispatchId: d.parentDispatchId,
      attention: d.attention,
      result: d.result,
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
        // 读侧收敛:map 里只有已写过的已知档,未知/未来值兜 'failed'(终态,不暗示可继续调度)
        status: coerceKnownOr(
          runtime.dagNodeStatus.get(n.id) ?? 'pending',
          [
            'pending',
            'running',
            'completed',
            'failed',
            'cancelled',
            'paused',
            'preempted',
            'quota_exceeded',
            'interrupted',
            'queued',
          ],
          'failed',
        ),
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
    // 读侧收敛:放行档 failed / preempted / quota_exceeded / interrupted。未知/未来值兜**终态**
    // 'cancelled'(同样落到下方 resume 拒绝分支,不产生"把未知态重置成 running 再执行"的副作用)。
    // 不兜 'pending':门 205 的口径是"未知值不许落可写/初始档";也不兜 'failed'(它是放行档,
    // 兜它会把未知态当可恢复放行执行)。
    // interrupted(F1):启动自动重入队失败时(例如执行器抛错)记录会停在该态,这里必须接受,
    // 否则又回到"既不动也 resume 不了"的僵尸面。
    const status = coerceKnownOr(
      dispatch.status,
      [
        'pending',
        'running',
        'completed',
        'failed',
        'cancelled',
        'paused',
        'preempted',
        'quota_exceeded',
        'interrupted',
      ],
      'cancelled',
    )
    if (
      status !== 'failed' &&
      status !== 'preempted' &&
      status !== 'quota_exceeded' &&
      status !== 'interrupted'
    ) {
      return {
        dispatchId: id,
        resumed: false,
        skippedSteps: [],
        error: `派单状态为 ${dispatch.status},仅 failed/preempted/quota_exceeded/interrupted 可恢复`,
      }
    }

    // 加载 checkpoints
    const checkpoints = await this._loadCheckpoints(id)
    const skippedSteps = Array.from(checkpoints.keys()).filter(
      (sid) => checkpoints.get(sid)?.status === 'ok',
    )

    // 找到第一个非 ok 的 checkpoint 作为恢复点
    const failedStep = Array.from(checkpoints.entries()).find(([, cp]) => cp.status !== 'ok')
    const resumedFromStep = failedStep?.[0]

    // F2:resume 也要占槽位。没有槽位时落 queued(不是绕过上限直接跑),等 _drainQueue 补位。
    const blocked = this._capacityBlocked(runtime.priority, dispatch.ownerUserId, id)
    if (blocked) {
      statusWriteView(dispatch).status = 'queued'
      dispatch.updatedAt = nowIso()
      runtime.hasFailed = false
      runtime.completedAt = undefined
      await this._persistDispatch(id)
      await this._persistLog(id, {
        ts: nowIso(),
        level: 'info',
        event: 'dispatch_resume_queued',
        data: { skippedSteps, resumedFromStep, blockedBy: blocked },
      })
      return {
        dispatchId: id,
        resumed: true,
        skippedSteps,
        resumedFromStep,
        queued: true,
      }
    }

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

    // 重新执行(DAG 模式会自动跳过已完成 checkpoint);与启动恢复共用执行入口
    // (resume 沿用既有语义:有 dag 就走 DAG)
    this._scheduleExecution(id, true)

    return {
      dispatchId: id,
      resumed: true,
      skippedSteps,
      resumedFromStep,
    }
  }

  // ---------- 优先级队列 ----------

  /**
   * 获取调度队列(按优先级排序)。
   *
   * S-ACL(2026-11-01):`visible` 是**调用方给的可见性谓词**(默认不过滤 = 旧行为)。
   * 判据本体只有一份(路由里的 isDispatchVisibleTo),service 不认识租户字段 —— 避免
   * routes → service 的反向 import 造成环,也避免同一口径在两个文件各写一遍。
   */
  async getQueue(visible?: (dispatch: SubagentDispatch) => boolean): Promise<QueueEntry[]> {
    // F2:读真队列 —— zset 成员 = 正在排队等待槽位的记录;顺序就是出队顺序。
    // 内存视图不再作为数据源(它只是进程内副本,重启/多实例会与真队列脱钩)。
    const ids = await this._queuedIds()
    const entries: Array<{ runtime: DispatchRuntime; status: ExtendedDispatchStatus }> = []
    for (const id of ids) {
      const runtime = this.runtimes.get(id)
      // 运行时不存在 / 已不在 queued ⇒ 视为退役成员,顺手清出 zset(不返回幽灵队列项)
      if (!runtime || statusReadView(runtime.dispatch).status !== 'queued') {
        await this._removeFromQueue(id)
        continue
      }
      if (visible && !visible(runtime.dispatch)) continue
      entries.push({
        runtime,
        status: coerceKnownOr(
          runtime.dispatch.status,
          [
            'pending',
            'running',
            'completed',
            'failed',
            'cancelled',
            'paused',
            'preempted',
            'quota_exceeded',
            'interrupted',
            'queued',
          ],
          'failed',
        ),
      })
    }
    return entries.map(({ runtime, status }, idx) => ({
      dispatchId: runtime.dispatch.id,
      priority: runtime.priority,
      status,
      goal: runtime.dispatch.goal,
      createdAt: runtime.dispatch.createdAt,
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
      {
        durationMs: number
        tokenUsage: number
        retries: number
        lastStatus: 'ok' | 'failed' | 'quota_exceeded' | 'running' | 'pending'
      }
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
      existing.lastStatus =
        step.status === 'ok' ? 'ok' : step.status === 'quota_exceeded' ? 'quota_exceeded' : 'failed'
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
            lastStatus:
              dagStatus === 'completed' ? 'ok' : dagStatus === 'running' ? 'running' : 'pending',
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

  /**
   * 推导拓扑:支持 DAG / critique / with_communication / debate / vote / 普通模式。
   *
   * S-ACL(2026-11-01):`visible` 同 getQueue —— 由路由传入 isDispatchVisibleTo,
   * service 不复制租户口径。
   */
  getTopology(visible?: (dispatch: SubagentDispatch) => boolean): RichSwarmTopology {
    const all = visible ? this.listAll().filter(visible) : this.listAll()
    const nodes: RichTopologyNode[] = []
    const edges: TopologyEdge[] = []

    for (const d of all) {
      const role = d.agentRole ?? 'coder'
      const mode = d.orchestration ?? 'parallel'
      // 拓扑的 dispatchStatus(d.status)读侧收敛:未知/未来值兜 'failed'(终态,不当可继续调度)
      const dispatchStatus = coerceKnownOr(
        d.status,
        [
          'pending',
          'running',
          'completed',
          'failed',
          'cancelled',
          'paused',
          'preempted',
          'quota_exceeded',
          'interrupted',
          'queued',
        ],
        'failed',
      )
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
      const tokenUsage = runtime?.steps.reduce((acc, s) => acc + s.tokenUsage.total, 0)

      // DAG 模式:渲染所有 DAG 节点 + 边
      if (runtime?.dag) {
        const dag = runtime.dag
        for (const dagNode of dag.nodes) {
          const dagStatus = runtime.dagNodeStatus.get(dagNode.id) ?? 'pending'
          // 读侧收敛:未知/未来值兜 'failed'(节点显示失败,不伪装成等待/进行中)
          const dagStatusSafe = coerceKnownOr(
            dagStatus,
            [
              'pending',
              'running',
              'completed',
              'failed',
              'cancelled',
              'paused',
              'preempted',
              'quota_exceeded',
            ],
            'failed',
          )
          nodes.push({
            id: `${d.id}:${dagNode.id}`,
            label: `${ROLE_LABELS[dagNode.agentRole] ?? dagNode.agentRole}`,
            role: dagNode.agentRole,
            status:
              dagStatus === 'completed'
                ? 'completed'
                : dagStatus === 'running'
                  ? 'running'
                  : dagStatus === 'failed'
                    ? 'failed'
                    : 'waiting',
            dispatchStatus: dagStatusSafe,
            durationMs,
            tokenUsage,
            isDagNode: true,
            dagNodeStatus: dagStatusSafe,
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
          dispatchStatus,
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
            dispatchStatus,
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
            dispatchStatus,
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
          dispatchStatus,
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
            dispatchStatus,
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
          dispatchStatus,
          durationMs,
          tokenUsage,
        })
      }
    }

    // 多 dispatch 时按创建顺序串行连接(仅普通模式)
    const simpleDispatches = all.filter((d) => {
      const mode = d.orchestration ?? 'parallel'
      const rt = this.runtimes.get(d.id)
      return (
        mode !== 'debate' &&
        mode !== 'vote' &&
        mode !== 'critique' &&
        mode !== 'with_communication' &&
        !rt?.dag
      )
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
