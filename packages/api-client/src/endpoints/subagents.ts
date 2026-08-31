// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 子智能体(Subagent)派单 + Swarm 拓扑端点封装(跨端共用:web / mobile-rn / desktop)。
 *
 * 平台说明:
 * - 统一走 fetchApi,自动注入 Authorization / X-Requested-With / 设备指纹 / 30s 超时,
 *   各端无需自行拼 header;调用失败时抛 Error(见下方 api 辅助函数)。
 * - 端点契约对齐 apps/api/src/routes/subagent-dispatch.ts(prefix /api):
 *   GET  /subagents/active      → { dispatches: SubagentDispatch[] }
 *   POST /subagents/dispatch    → SubagentDispatchResult(成功时仅含 dispatch)
 *   POST /subagents/:id/cancel  → { cancelled: boolean }
 *   POST /subagents/:id/resume  → SubagentResumeResult
 *   GET  /subagents/topology    → { topology: SwarmTopology }
 *   GET  /subagents/stats       → SubagentGlobalStats
 *   GET  /subagents/queue       → { queue: SubagentQueueEntry[] }
 *   GET  /subagents/:id/stats   → SubagentDispatchStats
 * - 类型字段对齐 web apps/web/src/lib/subagents-api.ts(@ihui/shared/subagents);
 *   后端 service(subagent-dispatch-service.ts)个别响应字段与 web/shared 契约存在漂移
 *   (stats 的 total/totalTokens、queue 条目的 dispatchId、per-dispatch stats 的
 *   totalDurationMs/totalTokens 等),漂移字段在本文件声明为可选,消费方用 `??` 兜底。
 */
import { fetchApi } from '../client'

/** Agent 角色(对齐 API Zod agentRole enum) */
export type AgentRole = 'researcher' | 'coder' | 'reviewer' | 'architect' | 'debugger'

/** 编排模式(对齐 API Zod orchestration enum) */
export type OrchestrationMode =
  'pipeline' | 'parallel' | 'debate' | 'vote' | 'critique' | 'decomposed' | 'with_communication'

/** 优先级(对齐 API Zod priority enum) */
export type DispatchPriority = 'low' | 'normal' | 'high' | 'urgent'

/** 派单状态 */
export type DispatchStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'

/** 派单请求体(对齐 web POST /subagents/dispatch 输入) */
export interface SubagentDispatchInput {
  goal: string
  affectedFiles: string[]
  forbidden?: string[]
  verifyCommands?: string[]
  constraints: string
  deliverables: string
  agentRole?: AgentRole
  orchestration?: OrchestrationMode
  priority?: DispatchPriority
  /** 可选:关联 agent 主表 id,派单运行轨迹持久化到 agent_tasks */
  agentId?: string
}

/** 派单实例(输入字段 + 运行时状态字段) */
export interface SubagentDispatch {
  id: string
  goal: string
  status: DispatchStatus
  agentRole?: AgentRole
  orchestration?: OrchestrationMode
  priority?: DispatchPriority
  affectedFiles: string[]
  forbidden?: string[]
  verifyCommands?: string[]
  constraints?: string
  deliverables?: string
  result?: string
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
}

/** 派单结果 */
export interface SubagentDispatchResult {
  dispatch: SubagentDispatch
  outcome?: 'success' | 'concurrent_limit' | 'cyclic_dependency'
  error?: string
}

/** Resume 结果 */
export interface SubagentResumeResult {
  resumed: boolean
  dispatch?: SubagentDispatch
  error?: string
}

/** Swarm 拓扑节点(兼容 web/shared V1 `agentRole+task` 与后端 RichSwarmTopology V2 `label+role` 漂移) */
export interface SwarmTopologyNode {
  id: string
  /** V1 契约字段(web @ihui/shared/subagents SwarmNode) */
  agentRole?: string
  /** V2 实际字段(后端 RichTopologyNode,UI 展示用) */
  role?: string
  /** V2 实际字段(UI 展示名) */
  label?: string
  status: string
  /** V1 契约字段(agent 任务描述) */
  task?: string
  x?: number
  y?: number
}

/** Swarm 拓扑边 */
export interface SwarmTopologyEdge {
  from: string
  to: string
  label?: string
  type?: string
}

/** Swarm 拓扑(节点 + 边) */
export interface SwarmTopology {
  nodes: SwarmTopologyNode[]
  edges: SwarmTopologyEdge[]
}

/** 全局统计(web/shared 契约字段为必填,后端 DispatchStats 漂移字段可选) */
export interface SubagentGlobalStats {
  /** 总派单(web/shared 契约字段) */
  totalDispatches?: number
  /** 总派单(后端 DispatchStats 实际字段) */
  total?: number
  active: number
  completed: number
  failed: number
  cancelled?: number
  byRole?: Record<string, number>
  byOrchestration?: Record<string, number>
  avgDurationMs?: number
  totalTokens?: number
}

/** 优先级队列条目(web/shared 契约用 `id`,后端 QueueEntry 实际用 `dispatchId`) */
export interface SubagentQueueEntry {
  /** 派单 ID(web/shared 契约字段) */
  id?: string
  /** 派单 ID(后端 QueueEntry 实际字段) */
  dispatchId?: string
  goal: string
  priority: DispatchPriority
  status: DispatchStatus
  position: number
  createdAt: string
}

/** 单个派单统计(web/shared 契约字段与后端 DispatchResourceStats 字段并存) */
export interface SubagentDispatchStats {
  dispatchId?: string
  status?: string
  /** 后端 DispatchResourceStats 实际字段 */
  totalDurationMs?: number
  totalTokens?: number
  estimatedCost?: number
  /** web/shared 契约字段 */
  durationMs?: number
  tokensUsed?: number
  retries?: number
  toolCalls?: number
  filesChanged?: number
}

/** 统一请求:失败抛 Error,成功返回 data */
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetchApi<T>(url, options)
  if (!res.success) throw new Error(res.error || '请求失败')
  return res.data
}

/** 活跃调度列表(GET /api/subagents/active) */
export function getActiveSubagentDispatches(): Promise<{ dispatches: SubagentDispatch[] }> {
  return api<{ dispatches: SubagentDispatch[] }>('/api/subagents/active')
}

/** 发起调度(POST /api/subagents/dispatch) */
export function dispatchSubagent(payload: SubagentDispatchInput): Promise<SubagentDispatchResult> {
  return api<SubagentDispatchResult>('/api/subagents/dispatch', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** 取消调度(POST /api/subagents/:id/cancel) */
export function cancelSubagentDispatch(id: string): Promise<{ cancelled: boolean }> {
  return api<{ cancelled: boolean }>(`/api/subagents/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  })
}

/** 恢复调度(POST /api/subagents/:id/resume) */
export function resumeSubagentDispatch(id: string): Promise<SubagentResumeResult> {
  return api<SubagentResumeResult>(`/api/subagents/${encodeURIComponent(id)}/resume`, {
    method: 'POST',
  })
}

/** 拓扑(GET /api/subagents/topology) */
export function getSubagentTopology(): Promise<{ topology: SwarmTopology }> {
  return api<{ topology: SwarmTopology }>('/api/subagents/topology')
}

/** 全局统计(GET /api/subagents/stats) */
export function getSubagentStats(): Promise<SubagentGlobalStats> {
  return api<SubagentGlobalStats>('/api/subagents/stats')
}

/** 优先级调度队列(GET /api/subagents/queue) */
export function getSubagentQueue(): Promise<{ queue: SubagentQueueEntry[] }> {
  return api<{ queue: SubagentQueueEntry[] }>('/api/subagents/queue')
}

/** 单调度统计(GET /api/subagents/:id/stats) */
export function getSubagentDispatchStats(id: string): Promise<SubagentDispatchStats> {
  return api<SubagentDispatchStats>(`/api/subagents/${encodeURIComponent(id)}/stats`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
