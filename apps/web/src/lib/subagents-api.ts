// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Subagent 派单 + Swarm 拓扑 Web 端 API client。
 * 契约对齐 apps/api/src/routes/subagent-dispatch.ts(11 个端点)。
 */
import { apiOrThrow } from '@/lib/api'
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
} from '@ihui/shared/subagents'

export function fetchActiveDispatches(): Promise<{ dispatches: SubagentDispatch[] }> {
  return apiOrThrow('/api/subagents/active')
}

export function createDispatch(input: SubagentDispatchInput): Promise<SubagentDispatchResult> {
  return apiOrThrow('/api/subagents/dispatch', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function cancelDispatch(id: string): Promise<{ cancelled: boolean }> {
  return apiOrThrow(`/api/subagents/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
}

export function resumeDispatch(id: string): Promise<SubagentResumeResult> {
  return apiOrThrow(`/api/subagents/${encodeURIComponent(id)}/resume`, { method: 'POST' })
}

export function fetchTopology(): Promise<{ topology: SwarmTopology }> {
  return apiOrThrow('/api/subagents/topology')
}

export function fetchStats(): Promise<SubagentGlobalStats> {
  return apiOrThrow('/api/subagents/stats')
}

export function fetchQueue(): Promise<{ queue: SubagentQueueEntry[] }> {
  return apiOrThrow('/api/subagents/queue')
}

export function fetchDispatchStats(id: string): Promise<SubagentDispatchStats> {
  return apiOrThrow(`/api/subagents/${encodeURIComponent(id)}/stats`)
}

export function fetchDispatchDag(id: string): Promise<DagDefinition> {
  return apiOrThrow(`/api/subagents/${encodeURIComponent(id)}/dag`)
}

export function fetchDispatchQuotas(id: string): Promise<QuotaUsage> {
  return apiOrThrow(`/api/subagents/${encodeURIComponent(id)}/quotas`)
}

export function fetchDispatchMessages(id: string): Promise<{ messages: AgentMessage[] }> {
  return apiOrThrow(`/api/subagents/${encodeURIComponent(id)}/messages`)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
