// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'
import { buildQs, type PageData } from '../utils'

export interface CommissionOverview {
  totalCommission: number
  availableCommission: number
  frozenCommission: number
  withdrawnCommission: number
  pendingCommission: number
  invitedCount: number
  activeCount: number
  rank: number
  /** 推广订单数(commission_flows 去重非空 orderId;无订单数据时为 null) */
  orderCount: number | null
}

export interface InviteInfo {
  inviteCode: string
  inviteUrl: string
  inviteCount: number
  commissionRate: number
  level: string
  qrCode: string | null
}

export interface InvitedUser {
  id: string
  nickname: string
  avatar: string | null
  joinedAt: string
  status: string
  totalCommission: number
  lastActiveAt: string
}

export interface CommissionRecord {
  id: string
  orderId: string
  orderAmount: number
  commissionAmount: number
  rate: number
  userId: string
  userNickname: string
  /** 后端 /distribution/list 返回 commission_flows 原始行,status 实为数字(0=invalid 1=active);消费方需 String() 归一化 */
  status: string
  createdAt: string
  /** 后端原始行真实字段(金额单位分);展示层字段 orderAmount/commissionAmount 无数据源时为 undefined */
  amount?: number
  token?: number
  type?: number
  remark?: string | null
}

export interface CommissionWithdrawRecord {
  id: string
  amount: number
  account: string
  accountType: string
  status: string
  remark: string | null
  createdAt: string
  processedAt: string | null
}

export interface CommissionRanking {
  rank: number
  userId: string
  nickname: string
  avatar: string | null
  totalCommission: number
  invitedCount: number
}

export async function getOverview(): Promise<ApiResult<CommissionOverview>> {
  return fetchApi<CommissionOverview>('/distribution/overview')
}

export async function getInviteInfo(): Promise<ApiResult<InviteInfo>> {
  return fetchApi<InviteInfo>('/distribution/invite-info')
}

export async function getInvitedUsers(
  query: { page?: number; pageSize?: number; status?: string } = {},
): Promise<ApiResult<PageData<InvitedUser>>> {
  return fetchApi<PageData<InvitedUser>>(`/distribution/invited-users${buildQs(query)}`)
}

export async function getCommissionList(
  query: { page?: number; pageSize?: number; status?: string } = {},
): Promise<ApiResult<PageData<CommissionRecord>>> {
  return fetchApi<PageData<CommissionRecord>>(`/distribution/list${buildQs(query)}`)
}

export async function getWithdrawList(
  query: { page?: number; pageSize?: number; status?: string } = {},
): Promise<ApiResult<PageData<CommissionWithdrawRecord>>> {
  return fetchApi<PageData<CommissionWithdrawRecord>>(
    `/distribution/withdraw-list${buildQs(query)}`,
  )
}

export async function requestWithdraw(input: {
  amount: number
  account: string
  accountType: string
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/distribution/withdraw', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getRanking(
  query: { limit?: number; period?: string } = {},
): Promise<ApiResult<CommissionRanking[]>> {
  return fetchApi<CommissionRanking[]>(`/distribution/ranking${buildQs(query)}`)
}

export interface DayMonthSummaryItem {
  /** 日期 YYYY-MM-DD 或月份 YYYY-MM */
  dateStr: string
  /** 金额(分) */
  amount: number
  /** 笔数 */
  count: number
}

/**
 * 日/月收益汇总 — 对齐后端 /api/finance/commission/day-month-summary 实际返回
 * { daySummary, monthSummary, total }(数组,按时间倒序)。
 * day/month 标量后端不下发,保留为可选仅供旧调用方兜底。
 */
export interface DayMonthSummary {
  daySummary: DayMonthSummaryItem[]
  monthSummary: DayMonthSummaryItem[]
  total: { totalAmount: number; totalCount: number }
  /** 兼容旧调用方:后端不返回 day 标量,应由 daySummary 按日期计算 */
  day?: number
  /** 兼容旧调用方:后端不返回 month 标量,应由 monthSummary 按月份计算 */
  month?: number | null
}

export async function getDayMonthSummary(): Promise<ApiResult<DayMonthSummary>> {
  return fetchApi<DayMonthSummary>('/api/finance/commission/day-month-summary')
}

// ============================================================================
// 分销团队(对齐后端 /api/distribution/team/*,Uniapp distribution_personnel_list)
// ============================================================================

export interface TeamStats {
  totalMembers: number
  activeMembers: number
  directCount: number
  indirectCount: number
  totalContribution: number
  vipInvitees: number
  monthNew: number
}

export interface TeamMemberItem {
  id: string
  nickname: string
  avatar: string | null
  level: number
  joinDate: string
  contribution: number
  status: 'active'
  relation: 'direct'
  transactionVolume: number
  commission: number
  orderNum: number
  phone: string | null
}

export interface TeamMemberDetail {
  id: string
  nickname: string
  phone: string | null
  avatar: string | null
  joinedAt: string
  transactionVolume: number
  commission: number
  orderNum: number
}

export async function getTeamStats(): Promise<ApiResult<TeamStats>> {
  return fetchApi<TeamStats>('/distribution/team/stats')
}

export async function getTeamMembers(
  params: {
    page?: number
    pageSize?: number
  } = {},
): Promise<ApiResult<PageData<TeamMemberItem>>> {
  return fetchApi<PageData<TeamMemberItem>>(`/distribution/team/members${buildQs(params)}`)
}

export async function getTeamMemberDetail(id: string): Promise<ApiResult<TeamMemberDetail | null>> {
  return fetchApi<TeamMemberDetail | null>(`/distribution/team/members/${id}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
