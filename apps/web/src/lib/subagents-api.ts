/**
 * Subagent 派单 + Swarm 拓扑 Web 端 API client。
 * 契约对齐 apps/api/src/routes/subagent-dispatch.ts(11 个端点)。
 */
import { fetchApi } from '@/lib/api'
import type {
  SubagentDispatchInput,
  SubagentDispatch,
  SubagentDispatchResult,
  SubagentResumeResult,
  SwarmTopology,
  SubagentGlobalStats,
  SubagentQueueEntry,
  SubagentDispatchStats,
  DagDefinition,
  QuotaUsage,
  AgentMessage,
} from '@ihui/shared/subagents/index'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchActiveDispatches(): Promise<{ dispatches: SubagentDispatch[] }> {
  return api('/api/subagents/active')
}

export function createDispatch(input: SubagentDispatchInput): Promise<SubagentDispatchResult> {
  return api('/api/subagents/dispatch', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function cancelDispatch(id: string): Promise<{ cancelled: boolean }> {
  return api(`/api/subagents/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
}

export function resumeDispatch(id: string): Promise<SubagentResumeResult> {
  return api(`/api/subagents/${encodeURIComponent(id)}/resume`, { method: 'POST' })
}

export function fetchTopology(): Promise<{ topology: SwarmTopology }> {
  return api('/api/subagents/topology')
}

export function fetchStats(): Promise<SubagentGlobalStats> {
  return api('/api/subagents/stats')
}

export function fetchQueue(): Promise<{ queue: SubagentQueueEntry[] }> {
  return api('/api/subagents/queue')
}

export function fetchDispatchStats(id: string): Promise<SubagentDispatchStats> {
  return api(`/api/subagents/${encodeURIComponent(id)}/stats`)
}

export function fetchDispatchDag(id: string): Promise<DagDefinition> {
  return api(`/api/subagents/${encodeURIComponent(id)}/dag`)
}

export function fetchDispatchQuotas(id: string): Promise<QuotaUsage> {
  return api(`/api/subagents/${encodeURIComponent(id)}/quotas`)
}

export function fetchDispatchMessages(id: string): Promise<{ messages: AgentMessage[] }> {
  return api(`/api/subagents/${encodeURIComponent(id)}/messages`)
}

export type {
  SubagentDispatchInput,
  SubagentDispatch,
  SubagentDispatchResult,
  SubagentResumeResult,
  SwarmTopology,
  SubagentGlobalStats,
  SubagentQueueEntry,
  SubagentDispatchStats,
  DagDefinition,
  QuotaUsage,
  AgentMessage,
}
