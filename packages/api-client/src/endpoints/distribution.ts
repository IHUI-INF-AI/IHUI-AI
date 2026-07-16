import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'

export interface CommissionOverview {
  totalCommission: number
  availableCommission: number
  frozenCommission: number
  withdrawnCommission: number
  pendingCommission: number
  invitedCount: number
  activeCount: number
  rank: number
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
  status: string
  createdAt: string
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
  return fetchApi<CommissionOverview>('/commission/overview')
}

export async function getInviteInfo(): Promise<ApiResult<InviteInfo>> {
  return fetchApi<InviteInfo>('/commission/invite-info')
}

export async function getInvitedUsers(
  query: { page?: number; pageSize?: number; status?: string } = {},
): Promise<ApiResult<PageData<InvitedUser>>> {
  return fetchApi<PageData<InvitedUser>>(`/commission/invited-users${buildQs(query)}`)
}

export async function getCommissionList(
  query: { page?: number; pageSize?: number; status?: string } = {},
): Promise<ApiResult<PageData<CommissionRecord>>> {
  return fetchApi<PageData<CommissionRecord>>(`/commission/list${buildQs(query)}`)
}

export async function getWithdrawList(
  query: { page?: number; pageSize?: number; status?: string } = {},
): Promise<ApiResult<PageData<CommissionWithdrawRecord>>> {
  return fetchApi<PageData<CommissionWithdrawRecord>>(`/commission/withdraw-list${buildQs(query)}`)
}

export async function requestWithdraw(input: {
  amount: number
  account: string
  accountType: string
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/commission/withdraw', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getRanking(
  query: { limit?: number; period?: string } = {},
): Promise<ApiResult<CommissionRanking[]>> {
  return fetchApi<CommissionRanking[]>(`/commission/ranking${buildQs(query)}`)
}

export interface DayMonthSummary {
  day: number
  month: number | null
}

export async function getDayMonthSummary(): Promise<ApiResult<DayMonthSummary>> {
  return fetchApi<DayMonthSummary>('/api/finance/commission/day-month-summary')
}
