// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 总管智能体 · 统一注册表客户端（R1）。
 *
 * 三端共用这一份路径与 DTO；端上不得自己拼 `/api/agent-registry` 字符串。
 * 路径与 01 §4.1 的 prefix 一致，fetchApi 会把 `/agent-registry/...` 归一为
 * `/api/agent-registry/...`（见 client.ts::normalizeUrl）。
 */

import type { AgentRole, ApprovalStatus, DefinitionStatus, RunStatus, Scope } from '@ihui/types'
import { fetchApi } from './client.js'

// 值集不在本包重写：@ihui/types 的 agent-registry 镜像是契约扫描器的合法镜像，
// 这里只做面向调用方的命名别名，避免 api-client 成为第 5 份枚举源。
export type AgentScope = Scope
export type AgentDefinitionStatus = DefinitionStatus
export type RegistryAgentRole = AgentRole
export type AgentApprovalStatus = ApprovalStatus
export type AgentApprovalAction = 'delete' | 'purge' | 'rollback'
export type AgentRunStatus = RunStatus

export interface AgentDefinitionStats {
  runs7d: number
  successRate: number
  costPoints7d: string
}

export interface AgentDefinitionView {
  id: string
  ownerUserId: string | null
  teamId: string | null
  scope: AgentScope
  name: string
  displayName: string
  description: string
  role: RegistryAgentRole
  promptVersion: number
  model: string | null
  temperature: string
  maxTokens: number | null
  tools: string[]
  skills: string[]
  permissions: Record<string, unknown>
  memoryPolicy: Record<string, unknown>
  budget: Record<string, unknown>
  concurrencyLimit: number
  status: AgentDefinitionStatus
  isBuiltin: boolean
  isDispatchable: boolean
  marketAgentId: string | null
  metadata: Record<string, unknown>
  version: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  purgeAfter: string | null
  systemPrompt?: string
  promptHash?: string
  promptLength?: number
  auditId?: string
  stats?: AgentDefinitionStats
}

export interface AgentDefinitionListParams {
  scope?: AgentScope
  status?: AgentDefinitionStatus
  role?: RegistryAgentRole
  q?: string
  teamId?: string
  limit?: number
  offset?: number
  cursor?: string
  [key: string]: string | number | boolean | null | undefined
}

export interface AgentDefinitionListResponse {
  items: AgentDefinitionView[]
  total: number
  nextCursor: string | null
  limit: number
  offset: number
}

export interface CreateAgentDefinitionInput {
  scope: AgentScope
  name: string
  displayName: string
  description?: string
  role?: RegistryAgentRole
  systemPrompt?: string
  model?: string | null
  temperature?: number
  maxTokens?: number | null
  tools?: string[]
  skills?: string[]
  permissions?: Record<string, unknown>
  memoryPolicy?: Record<string, unknown>
  budget?: Record<string, unknown>
  concurrencyLimit?: number
  isDispatchable?: boolean
  marketAgentId?: string | null
  metadata?: Record<string, unknown>
  teamId?: string | null
  reason?: string
}

export interface UpdateAgentDefinitionInput {
  ifVersion: number
  name?: string
  displayName?: string
  description?: string
  role?: RegistryAgentRole
  systemPrompt?: string
  model?: string | null
  temperature?: number
  maxTokens?: number | null
  tools?: string[]
  skills?: string[]
  permissions?: Record<string, unknown>
  memoryPolicy?: Record<string, unknown>
  budget?: Record<string, unknown>
  concurrencyLimit?: number
  isDispatchable?: boolean
  marketAgentId?: string | null
  metadata?: Record<string, unknown>
  changeSummary?: string
  reason?: string
}

export interface CloneAgentDefinitionInput {
  name?: string
  displayName?: string
  scope?: AgentScope
  teamId?: string | null
  reason?: string
}

export interface AgentDefinitionVersionSummary {
  version: number
  changeKind: string
  changeSummary: string
  actorUserId: string | null
  createdAt: string
}

export interface AgentDefinitionVersionDetail {
  version: number
  changeKind: string
  snapshot: Record<string, unknown>
}

export interface PrecheckFinding {
  domain: string
  count: number
  ids: string[]
  hint?: string
}

export interface PrecheckUnverified {
  domain: string
  reason: string
}

export interface PrecheckResult {
  definitionId: string
  version: number
  blocking: PrecheckFinding[]
  warnings: PrecheckFinding[]
  unverified: PrecheckUnverified[]
  impactHash: string
  precheckToken: string
  expiresAt: string
}

export interface DeleteApprovalResult {
  approvalId: string
  status: 'pending'
  expiresAt: string
  impact: Record<string, unknown>
  auditId?: string
}

export interface RollbackApprovalResult {
  requiresApproval: true
  approvalId: string
  status: 'pending'
  expiresAt: string
  activeRuns: number
  impactHash: string
  auditId?: string
}

export interface AgentApprovalView {
  id: string
  action: AgentApprovalAction
  status: AgentApprovalStatus
  definitionId: string | null
  definitionName: string
  definitionVersion: number
  impactSnapshot: Record<string, unknown>
  reason: string | null
  requestedAt: string
  decidedAt: string | null
  consumedAt: string | null
  expiresAt: string
  errorMessage: string | null
}

export interface AgentApprovalListResponse {
  items: AgentApprovalView[]
  total: number
  nextCursor: string | null
}

export interface AgentRunView {
  id: string
  definitionId: string | null
  definitionName: string
  definitionVersion: number
  ownerUserId: string
  teamId: string | null
  parentRunId: string | null
  dispatchId: string | null
  sessionId: string | null
  mode: string
  goal: string
  status: AgentRunStatus
  startedAt: string | null
  endedAt: string | null
  lastHeartbeatAt: string | null
  inputTokens: number
  outputTokens: number
  costPoints: string
  errorCode: string | null
  errorMessage: string | null
  artifactCount: number
  traceId: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface AgentRunEventView {
  seq: number
  type: string
  payload: Record<string, unknown>
  createdAt: string
}

export interface AgentRunLogsResponse {
  items: AgentRunEventView[]
  nextSeq: number | null
  truncated: boolean
}

export interface AgentRunArtifactsResponse {
  items: Array<Record<string, unknown>>
  count: number
}

export interface ApproveResult {
  approval: AgentApprovalView
  definition: AgentDefinitionView | null
  auditId: string
  purged?: boolean
}

function unwrap<T>(result: { success: true; data: T } | { success: false; error: string }): T {
  if (!result.success) throw new Error(result.error)
  return result.data
}

export async function listAgentDefinitions(
  params: AgentDefinitionListParams = {},
): Promise<AgentDefinitionListResponse> {
  return unwrap(
    await fetchApi<AgentDefinitionListResponse>('/agent-registry/definitions', { params }),
  )
}

export async function getAgentDefinition(id: string): Promise<AgentDefinitionView> {
  return unwrap(
    await fetchApi<AgentDefinitionView>(`/agent-registry/definitions/${encodeURIComponent(id)}`),
  )
}

export async function createAgentDefinition(
  input: CreateAgentDefinitionInput,
): Promise<AgentDefinitionView> {
  return unwrap(
    await fetchApi<AgentDefinitionView>('/agent-registry/definitions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  )
}

export async function updateAgentDefinition(
  id: string,
  input: UpdateAgentDefinitionInput,
): Promise<AgentDefinitionView> {
  return unwrap(
    await fetchApi<AgentDefinitionView>(`/agent-registry/definitions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  )
}

export async function cloneAgentDefinition(
  id: string,
  input: CloneAgentDefinitionInput = {},
): Promise<AgentDefinitionView> {
  return unwrap(
    await fetchApi<AgentDefinitionView>(
      `/agent-registry/definitions/${encodeURIComponent(id)}/clone`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  )
}

export async function setAgentDefinitionEnabled(
  id: string,
  enabled: boolean,
  ifVersion: number,
): Promise<AgentDefinitionView> {
  return unwrap(
    await fetchApi<AgentDefinitionView>(
      `/agent-registry/definitions/${encodeURIComponent(id)}/${enabled ? 'enable' : 'disable'}`,
      { method: 'POST', body: JSON.stringify({ ifVersion }) },
    ),
  )
}

export async function listAgentDefinitionVersions(
  id: string,
  limit = 50,
): Promise<AgentDefinitionVersionSummary[]> {
  const data = unwrap(
    await fetchApi<{ items: AgentDefinitionVersionSummary[] }>(
      `/agent-registry/definitions/${encodeURIComponent(id)}/versions`,
      { params: { limit } },
    ),
  )
  return data.items
}

export async function getAgentDefinitionVersion(
  id: string,
  version: number,
): Promise<AgentDefinitionVersionDetail> {
  return unwrap(
    await fetchApi<AgentDefinitionVersionDetail>(
      `/agent-registry/definitions/${encodeURIComponent(id)}/versions/${version}`,
    ),
  )
}

export async function rollbackAgentDefinition(
  id: string,
  targetVersion: number,
  ifVersion: number,
): Promise<AgentDefinitionView | RollbackApprovalResult> {
  return unwrap(
    await fetchApi<AgentDefinitionView | RollbackApprovalResult>(
      `/agent-registry/definitions/${encodeURIComponent(id)}/rollback`,
      { method: 'POST', body: JSON.stringify({ targetVersion, ifVersion }) },
    ),
  )
}

export async function precheckDeleteAgentDefinition(id: string): Promise<PrecheckResult> {
  return unwrap(
    await fetchApi<PrecheckResult>(
      `/agent-registry/definitions/${encodeURIComponent(id)}/precheck-delete`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  )
}

export async function requestDeleteAgentDefinition(
  id: string,
  precheckToken: string,
  reason?: string,
): Promise<DeleteApprovalResult> {
  return unwrap(
    await fetchApi<DeleteApprovalResult>(`/agent-registry/definitions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ precheckToken, reason }),
    }),
  )
}

export async function requestPurgeAgentDefinition(
  id: string,
  confirmName: string,
  reason?: string,
): Promise<DeleteApprovalResult> {
  return unwrap(
    await fetchApi<DeleteApprovalResult>(
      `/agent-registry/definitions/${encodeURIComponent(id)}/purge`,
      { method: 'POST', body: JSON.stringify({ confirmName, reason }) },
    ),
  )
}

export async function restoreAgentDefinition(id: string): Promise<AgentDefinitionView> {
  return unwrap(
    await fetchApi<AgentDefinitionView>(
      `/agent-registry/definitions/${encodeURIComponent(id)}/restore`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  )
}

export async function listAgentApprovals(
  params: { status?: AgentApprovalStatus; limit?: number; offset?: number } = {},
): Promise<AgentApprovalListResponse> {
  return unwrap(await fetchApi<AgentApprovalListResponse>('/agent-registry/approvals', { params }))
}

export async function getAgentApproval(id: string): Promise<AgentApprovalView> {
  return unwrap(
    await fetchApi<AgentApprovalView>(`/agent-registry/approvals/${encodeURIComponent(id)}`),
  )
}

export async function approveAgentApproval(
  id: string,
  typedName: string,
  reason?: string,
): Promise<ApproveResult> {
  return unwrap(
    await fetchApi<ApproveResult>(`/agent-registry/approvals/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ typedName, reason }),
    }),
  )
}

export async function rejectAgentApproval(id: string, reason?: string): Promise<AgentApprovalView> {
  return unwrap(
    await fetchApi<AgentApprovalView>(
      `/agent-registry/approvals/${encodeURIComponent(id)}/reject`,
      { method: 'POST', body: JSON.stringify({ reason }) },
    ),
  )
}

export async function listDefinitionRuns(
  definitionId: string,
  params: { status?: AgentRunStatus; limit?: number; offset?: number } = {},
): Promise<{ items: AgentRunView[]; total: number; nextCursor: string | null }> {
  return unwrap(
    await fetchApi<{ items: AgentRunView[]; total: number; nextCursor: string | null }>(
      `/agent-registry/definitions/${encodeURIComponent(definitionId)}/runs`,
      { params },
    ),
  )
}

export async function getAgentRun(runId: string): Promise<AgentRunView> {
  return unwrap(await fetchApi<AgentRunView>(`/agent-registry/runs/${encodeURIComponent(runId)}`))
}

export async function getAgentRunLogs(
  runId: string,
  params: { afterSeq?: number; limit?: number } = {},
): Promise<AgentRunLogsResponse> {
  return unwrap(
    await fetchApi<AgentRunLogsResponse>(`/agent-registry/runs/${encodeURIComponent(runId)}/logs`, {
      params,
    }),
  )
}

export async function getAgentRunArtifacts(runId: string): Promise<AgentRunArtifactsResponse> {
  return unwrap(
    await fetchApi<AgentRunArtifactsResponse>(
      `/agent-registry/runs/${encodeURIComponent(runId)}/artifacts`,
    ),
  )
}

export async function getAgentRunStats(runId: string): Promise<Record<string, unknown>> {
  return unwrap(
    await fetchApi<Record<string, unknown>>(
      `/agent-registry/runs/${encodeURIComponent(runId)}/stats`,
    ),
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
