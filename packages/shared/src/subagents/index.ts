/**
 * Subagent 派单 + Swarm 拓扑跨端共享类型(2026-07-24 立,对标 TRAE Work 多智能体团队)。
 *
 * 契约对齐 apps/api/src/routes/subagent-dispatch.ts:
 *  - POST /subagents/dispatch          → SubagentDispatchResult
 *  - GET  /subagents/active            → SubagentDispatch[]
 *  - POST /subagents/:id/cancel        → { cancelled: boolean }
 *  - POST /subagents/:id/resume        → SubagentResumeResult
 *  - GET  /subagents/topology          → SwarmTopology
 *  - GET  /subagents/stats             → SubagentGlobalStats
 *  - GET  /subagents/queue             → SubagentQueueEntry[]
 *  - GET  /subagents/:id/stats         → SubagentDispatchStats
 *  - GET  /subagents/:id/dag           → DagDefinition
 *  - GET  /subagents/:id/quotas        → QuotaUsage
 *  - GET  /subagents/:id/messages      → AgentMessage[]
 */

/** Agent 角色(对齐 API Zod agentRole enum) */
export type AgentRole = 'researcher' | 'coder' | 'reviewer' | 'architect' | 'debugger'

/** 编排模式(对齐 API Zod orchestration enum) */
export type OrchestrationMode =
  | 'pipeline'
  | 'parallel'
  | 'debate'
  | 'vote'
  | 'critique'
  | 'decomposed'
  | 'with_communication'

/** 优先级(对齐 API Zod priority enum) */
export type DispatchPriority = 'low' | 'normal' | 'high' | 'urgent'

/** 派单状态 */
export type DispatchStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'

/** DAG 节点定义 */
export interface DagNode {
  id: string
  agentRole: AgentRole
  task: string
}

/** DAG 边定义 */
export interface DagEdge {
  from: string
  to: string
  condition?: string
}

/** DAG 完整定义 */
export interface DagDefinition {
  nodes: DagNode[]
  edges: DagEdge[]
}

/** 重试配置 */
export interface RetryConfig {
  maxAttempts: number
  delayMs: number
}

/** 资源配额 */
export interface QuotaConfig {
  timeoutMs: number
  tokenQuota: number
  maxRetries: number
}

/** 资源配额使用情况 */
export interface QuotaUsage {
  quota: QuotaConfig
  used: {
    elapsedMs: number
    tokensUsed: number
    retriesUsed: number
  }
  exceeded: boolean
}

/** 派单请求体(对齐 API POST /subagents/dispatch) */
export interface SubagentDispatchInput {
  goal: string
  affectedFiles: string[]
  forbidden?: string[]
  verifyCommands?: string[]
  constraints: string
  deliverables: string
  agentRole?: AgentRole
  orchestration?: OrchestrationMode
  retry?: RetryConfig
  dag?: DagDefinition
  priority?: DispatchPriority
  quotas?: QuotaConfig
}

/** 派单实例 */
export interface SubagentDispatch {
  id: string
  goal: string
  status: DispatchStatus
  agentRole?: AgentRole
  orchestration?: OrchestrationMode
  priority?: DispatchPriority
  affectedFiles: string[]
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
}

/** 派单结果 */
export interface SubagentDispatchResult {
  dispatch: SubagentDispatch
  outcome: 'success' | 'concurrent_limit' | 'cyclic_dependency'
  error?: string
}

/** Resume 结果 */
export interface SubagentResumeResult {
  resumed: boolean
  dispatch?: SubagentDispatch
  error?: string
}

/** Swarm 拓扑节点 */
export interface SwarmNode {
  id: string
  agentRole: AgentRole
  status: DispatchStatus
  task: string
}

/** Swarm 拓扑边 */
export interface SwarmEdge {
  from: string
  to: string
  condition?: string
}

/** Swarm 拓扑(节点 + 边) */
export interface SwarmTopology {
  nodes: SwarmNode[]
  edges: SwarmEdge[]
}

/** 全局统计 */
export interface SubagentGlobalStats {
  totalDispatches: number
  active: number
  completed: number
  failed: number
  cancelled: number
  byRole: Record<AgentRole, number>
  byOrchestration: Record<OrchestrationMode, number>
  avgDurationMs: number
}

/** 单个派单统计 */
export interface SubagentDispatchStats {
  dispatchId: string
  durationMs: number
  tokensUsed: number
  retries: number
  toolCalls: number
  filesChanged: number
}

/** 优先级队列条目 */
export interface SubagentQueueEntry {
  id: string
  goal: string
  priority: DispatchPriority
  status: DispatchStatus
  position: number
  createdAt: string
}

/** Agent 间消息(with_communication 模式) */
export interface AgentMessage {
  id: string
  fromAgent: string
  toAgent: string
  content: string
  timestamp: string
  messageType: 'task' | 'review' | 'critique' | 'vote' | 'result'
}

/** 取消响应 */
export interface SubagentCancelResponse {
  cancelled: boolean
}
