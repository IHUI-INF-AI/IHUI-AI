/**
 * 子智能体(Subagent)派单 + Swarm 拓扑端点封装(跨端共用:web / mobile-rn / desktop)。
 *
 * 平台说明:
 * - 统一走 fetchApi,自动注入 Authorization / X-Requested-With / 设备指纹 / 30s 超时,
 *   各端无需自行拼 header;调用失败时抛 Error。
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
 *   后端 service(subagent-dispatch-service.ts)个别响应字段与 shared 契约存在漂移
 *   (stats 的 total/totalTokens、queue 条目的 dispatchId、per-dispatch stats 的
 *   totalDurationMs/totalTokens 等),漂移字段声明为可选,消费方用 `??` 兜底。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'

/** 子智能体调度状态 */
export type SubagentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/** 子智能体调度记录(active 列表 / dispatch 返回) */
export interface SubagentDispatch {
  id: string
  agentId?: string
  agentName?: string
  goal: string
  status: SubagentStatus
  priority: number
  createdAt: string
  updatedAt?: string
  startedAt?: string
  finishedAt?: string
  parentId?: string | null
  subAgentIds?: string[]
  result?: unknown
  error?: string | null
}

/** 发起调度结果 */
export interface SubagentDispatchResult {
  dispatch: SubagentDispatch
}

/** 恢复调度结果 */
export interface SubagentResumeResult {
  success: boolean
  dispatch?: SubagentDispatch
}

/** Swarm 拓扑节点 */
export interface SwarmNode {
  id: string
  name?: string
  role?: string
  status?: string
  children?: SwarmNode[]
}

/** Swarm 拓扑 */
export interface SwarmTopology {
  root: SwarmNode
  [key: string]: unknown
}

/** 全局统计(对齐后端实际返回;totalDispatches/byRole 为历史契约字段,后端当前不返回) */
export interface SubagentGlobalStats {
  active: number
  completed: number
  failed: number
  total: number
  avgDurationMs: number
  totalTokens: number
  totalDispatches?: number
  byRole?: Record<string, number>
}

/** 队列条目(后端用 dispatchId 而非 id) */
export interface SubagentQueueEntry {
  dispatchId: string
  priority: number
  status?: string
  goal?: string
  createdAt?: string
  position?: number
}

/** 单调度统计(对齐后端实际返回) */
export interface SubagentDispatchStats {
  dispatchId: string
  status?: string
  totalDurationMs: number
  totalTokens: number
  estimatedCost?: number
  steps?: unknown[]
}

/** 获取活跃调度列表 */
export async function getActiveSubagentDispatches(): Promise<
  ApiResult<{ dispatches: SubagentDispatch[] }>
> {
  return fetchApi<{ dispatches: SubagentDispatch[] }>('/api/subagents/active')
}

/** 发起子智能体调度 */
export async function dispatchSubagent(input: {
  goal: string
  agentId?: string
  priority?: number
  parentId?: string | null
}): Promise<ApiResult<SubagentDispatchResult>> {
  return fetchApi<SubagentDispatchResult>('/api/subagents/dispatch', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 取消调度 */
export async function cancelSubagentDispatch(
  id: string,
): Promise<ApiResult<{ cancelled: boolean }>> {
  return fetchApi<{ cancelled: boolean }>(`/api/subagents/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  })
}

/** 恢复调度 */
export async function resumeSubagentDispatch(
  id: string,
): Promise<ApiResult<SubagentResumeResult>> {
  return fetchApi<SubagentResumeResult>(`/api/subagents/${encodeURIComponent(id)}/resume`, {
    method: 'POST',
  })
}

/** 获取 Swarm 拓扑 */
export async function getSubagentTopology(): Promise<ApiResult<{ topology: SwarmTopology }>> {
  return fetchApi<{ topology: SwarmTopology }>('/api/subagents/topology')
}

/** 获取全局统计 */
export async function getSubagentStats(): Promise<ApiResult<SubagentGlobalStats>> {
  return fetchApi<SubagentGlobalStats>('/api/subagents/stats')
}

/** 获取队列 */
export async function getSubagentQueue(): Promise<ApiResult<{ queue: SubagentQueueEntry[] }>> {
  return fetchApi<{ queue: SubagentQueueEntry[] }>('/api/subagents/queue')
}

/** 获取单调度统计 */
export async function getSubagentDispatchStats(
  id: string,
): Promise<ApiResult<SubagentDispatchStats>> {
  return fetchApi<SubagentDispatchStats>(`/api/subagents/${encodeURIComponent(id)}/stats`)
}
