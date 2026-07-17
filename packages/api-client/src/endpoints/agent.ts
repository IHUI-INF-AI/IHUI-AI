import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'

export type AgentStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'offline'

export interface Agent {
  id: string
  name: string
  avatar: string | null
  description: string
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number
  category: string
  tags: string[]
  status: AgentStatus
  author: { id: string; nickname: string; avatar: string | null }
  useCount: number
  favoriteCount: number
  rating: number
  isFavorited: boolean
  isPublic: boolean
  isVipExclusive: boolean
  version: string
  capabilities: string[]
  createdAt: string
  updatedAt: string
}

export type AgentListQuery = {
  page?: number
  pageSize?: number
  keyword?: string
  category?: string
  status?: AgentStatus
  sort?: string
}

export async function getAgents(query: AgentListQuery = {}): Promise<ApiResult<PageData<Agent>>> {
  return fetchApi<PageData<Agent>>(`/agents${buildQs(query)}`)
}

// =============================================================================
// 智能体提现明细(对应后端 /api/agent-ext/withdrawal/* 端点)
// =============================================================================

export type WithdrawalStatus =
  'pending' | 'approved' | 'processing' | 'completed' | 'rejected' | 'failed'

export interface AgentWithdrawal {
  id: string
  userId: string
  agentId: string | null
  amount: string
  status: WithdrawalStatus
  type: number | null
  outBillNo: string | null
  orderIds: string | null
  reviewer: string | null
  reviewedAt: string | null
  initiateAt: string | null
  bankInfo: string | null
  rejectReason: string | null
  processedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentWithdrawalListQuery {
  userId?: string
  page?: number
  pageSize?: number
}

export interface AgentWithdrawalCreateInput {
  userId: string
  agentId?: string
  amount: number
  type: number // 1=微信 2=支付宝 3=其他
  outBillNo?: string
  orderIds?: string
  bankInfo?: string
}

export interface AgentWithdrawalUpdateInput {
  amount?: number
  type?: number
  bankInfo?: string
  status?: WithdrawalStatus
}

export interface AgentWithdrawalReviewInput {
  status: 'approved' | 'rejected'
  reviewer: string
  rejectReason?: string
}

export interface AgentWithdrawalProcessInput {
  status: 'processing' | 'completed' | 'failed'
  rejectReason?: string
}

export interface AgentWithdrawalStats {
  totalCount: number
  pendingCount: number
  approvedCount: number
  processingCount: number
  completedCount: number
  failedCount: number
  rejectedCount: number
  totalAmount: number
  completedAmount: number
  pendingAmount: number
}

const WITHDRAWAL_BASE = '/api/agent-ext/withdrawal'

export async function listAgentWithdrawals(
  query: AgentWithdrawalListQuery = {},
): Promise<ApiResult<PageData<AgentWithdrawal>>> {
  return fetchApi<PageData<AgentWithdrawal>>(`${WITHDRAWAL_BASE}/list${buildQs(query)}`)
}

export async function getAgentWithdrawalSummary(userId?: string): Promise<
  ApiResult<{
    totalAmount: number
    totalCount: number
    pendingCount: number
    completedCount: number
  }>
> {
  return fetchApi(`${WITHDRAWAL_BASE}/summary${buildQs(userId ? { userId } : {})}`)
}

export async function getAgentWithdrawalStats(
  userId?: string,
): Promise<ApiResult<AgentWithdrawalStats>> {
  return fetchApi(`${WITHDRAWAL_BASE}/stats/overview${buildQs(userId ? { userId } : {})}`)
}

export async function createAgentWithdrawal(
  input: AgentWithdrawalCreateInput,
): Promise<ApiResult<AgentWithdrawal>> {
  return fetchApi<AgentWithdrawal>(WITHDRAWAL_BASE + '/create', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getAgentWithdrawal(id: string): Promise<ApiResult<AgentWithdrawal>> {
  return fetchApi<AgentWithdrawal>(`${WITHDRAWAL_BASE}/${id}`)
}

export async function updateAgentWithdrawal(
  id: string,
  input: AgentWithdrawalUpdateInput,
): Promise<ApiResult<AgentWithdrawal>> {
  return fetchApi<AgentWithdrawal>(`${WITHDRAWAL_BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteAgentWithdrawal(
  id: string,
): Promise<ApiResult<{ id: string; message: string }>> {
  return fetchApi(`${WITHDRAWAL_BASE}/${id}`, { method: 'DELETE' })
}

export async function reviewAgentWithdrawal(
  id: string,
  input: AgentWithdrawalReviewInput,
): Promise<ApiResult<AgentWithdrawal>> {
  return fetchApi<AgentWithdrawal>(`${WITHDRAWAL_BASE}/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function processAgentWithdrawal(
  id: string,
  input: AgentWithdrawalProcessInput,
): Promise<ApiResult<AgentWithdrawal>> {
  return fetchApi<AgentWithdrawal>(`${WITHDRAWAL_BASE}/${id}/process`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function batchDeleteAgentWithdrawals(
  ids: string[],
): Promise<ApiResult<{ deletedCount: number; deletedIds: string[] }>> {
  return fetchApi(`${WITHDRAWAL_BASE}/batch-delete`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

// =============================================================================
// 智能体 VIP 权限（对应后端 /api/agent-ext/permission/:agentId 端点）
// =============================================================================

export type AgentPermissionType = 'free' | 'vip' | 'purchased' | 'vip_only' | 'paid'

export interface AgentPermission {
  type: AgentPermissionType
  accountType: string
  hasPermission: boolean
  reason?: string
}

export async function getAgentPermission(
  agentId: string,
  userId?: string,
): Promise<ApiResult<AgentPermission>> {
  return fetchApi<AgentPermission>(
    `/api/agent-ext/permission/${agentId}${buildQs(userId ? { userId } : {})}`,
  )
}
