import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'
import { buildQs, type PageData } from '../utils'

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
  /** 分类 ID(2026-08-01 P0 契约修复:原字段名 category 与后端 categoryId 不一致,筛选不生效) */
  categoryId?: string
  /** 作者用户 ID(后端支持按作者筛选) */
  userId?: string
  status?: AgentStatus
  /**
   * 赛道筛选(对齐 Uniapp tools/index.vue agentCategory_active 参数)
   * 空字符串/不传表示"全公司",buildQs 会自动忽略空值
   */
  agentCategory?: string
  /**
   * 主分类筛选(对齐 Uniapp tools/index.vue fenlei_active_id 参数)
   * 空字符串/不传表示"全部",buildQs 会自动忽略空值
   */
  agentMainCategory?: string
}

export async function getAgents(query: AgentListQuery = {}): Promise<ApiResult<PageData<Agent>>> {
  return fetchApi<PageData<Agent>>(`/agents${buildQs(query)}`)
}

export async function getAgentDetail(id: string): Promise<ApiResult<Agent>> {
  return fetchApi<Agent>(`/agents/${id}`)
}

// =============================================================================
// 智能体分类字典(对应后端 /cozeZhsApi/cache/agent-category-dict/categories)
// 对齐 Uniapp src/service/pay.js categories() 接口,跨端共享
// =============================================================================

/** 智能体分类项(对齐 Uniapp agentCategory/agentMainCategory 列表项) */
export interface AgentCategoryItem {
  id: string
  name: string
}

/** categories() 返回结构:赛道 + 主分类两组 */
export interface AgentCategories {
  /** 赛道列表(对应"全公司/技术/设计..."等) */
  agentCategory: AgentCategoryItem[]
  /** 主分类列表(对应"全部/写作/编程..."等) */
  agentMainCategory: AgentCategoryItem[]
}

/**
 * 获取智能体分类字典(赛道 + 主分类)
 * 对齐 Uniapp src/service/pay.js categories(),返回两组并列的分类列表。
 * 失败时调用方应 fallback 到本地静态占位,避免列表为空。
 */
export async function getAgentCategories(): Promise<ApiResult<AgentCategories>> {
  return fetchApi<AgentCategories>('/cozeZhsApi/cache/agent-category-dict/categories')
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
