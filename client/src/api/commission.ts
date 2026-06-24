// 2026-06-24 修复: 路径前缀对齐后端 /api/v1/*
import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types/api'
import type { Commission, WithdrawRecord } from '@/types/user'

// 获取分销概览
export function getCommissionOverview(): Promise<
  ApiResponse<{
    totalCommission: number
    availableCommission: number
    pendingCommission: number
    withdrawnCommission: number
    inviteCount: number
    activeInvites: number
    thisMonthCommission: number
    lastMonthCommission: number
    commissionRate: number
  }>
> {
  return request.get('/commission/overview')
}

// 获取邀请码信息
export function getInviteInfo(): Promise<
  ApiResponse<{
    inviteCode: string
    inviteUrl: string
    qrCode: string
    inviteCount: number
    totalCommission: number
    commissionRate: number
  }>
> {
  return request.get('/commission/invite-info')
}

// 获取佣金记录
export function getCommissionList(
  params: PaginationParams & {
    type?: 'register' | 'recharge' | 'vip' | 'consumption'
    status?: 'pending' | 'completed' | 'cancelled'
    startTime?: string
    endTime?: string
  }
): Promise<ApiResponse<PaginationResponse<Commission>>> {
  return request.get('/api/v1/finance/list', { params })
}

// 获取邀请用户列表
export function getInvitedUsers(
  params: PaginationParams & {
    keyword?: string
    isActive?: boolean
    hasCommission?: boolean
  }
): Promise<
  ApiResponse<
    PaginationResponse<{
      id: string
      username: string
      nickname: string
      avatar: string
      registerTime: string
      lastActiveTime: string
      isVip: boolean
      totalSpent: number
      totalCommission: number
      status: 'active' | 'inactive'
    }>
  >
> {
  return request.get('/commission/invited-users', { params })
}

// 获取提现记录
export function getWithdrawList(
  params: PaginationParams & {
    status?: 'pending' | 'processing' | 'completed' | 'rejected'
    startTime?: string
    endTime?: string
  }
): Promise<ApiResponse<PaginationResponse<WithdrawRecord>>> {
  // 2026-06-24 修复: 对齐后端 /api/v1/finance/withdrawal 前缀 (后端暂无 list 端点, 路径规范化)
  return request.get('/api/v1/finance/withdrawal/list', { params })
}

// 申请提现
export function applyWithdraw(data: {
  amount: number
  type: 'bank' | 'alipay' | 'wechat'
  bankInfo?: {
    bankName: string
    accountName: string
    accountNumber: string
    branchName?: string
  }
  alipayInfo?: {
    account: string
    name: string
  }
  wechatInfo?: {
    account: string
    name: string
  }
}): Promise<ApiResponse<WithdrawRecord>> {
  // 2026-06-24 修复: 对齐后端 /api/v1/wallet/withdraw (compat_routes.py)
  return request.post('/api/v1/wallet/withdraw', data)
}

// 取消提现申请
export function cancelWithdraw(withdrawId: string): Promise<ApiResponse<void>> {
  return request.post(`/commission/withdraw/${withdrawId}/cancel`)
}

// 获取提现配置
export function getWithdrawConfig(): Promise<
  ApiResponse<{
    minAmount: number
    maxAmount: number
    feeRate: number
    minFee: number
    maxFee: number
    workingDays: string[]
    processingTime: string
    supportedMethods: {
      type: 'bank' | 'alipay' | 'wechat'
      name: string
      icon: string
      isEnabled: boolean
      minAmount: number
      maxAmount: number
      feeRate: number
    }[]
  }>
> {
  return request.get('/commission/withdraw-config')
}

// 获取佣金统计
export function getCommissionStats(params: {
  period: 'week' | 'month' | 'quarter' | 'year'
  startTime?: string
  endTime?: string
}): Promise<
  ApiResponse<{
    totalCommission: number
    commissionTrend: {
      date: string
      amount: number
      count: number
    }[]
    typeDistribution: {
      type: string
      amount: number
      percentage: number
    }[]
    topInvitees: {
      userId: string
      username: string
      avatar: string
      commission: number
      inviteTime: string
    }[]
  }>
> {
  return request.get('/commission/stats', { params })
}

// 生成邀请海报
export function generateInvitePoster(template: string = 'default'): Promise<
  ApiResponse<{
    posterUrl: string
    qrCode: string
    inviteCode: string
  }>
> {
  return request.post('/commission/generate-poster', { template })
}

// 获取分销排行榜
export function getCommissionRanking(params: {
  period: 'week' | 'month' | 'all'
  type: 'commission' | 'invites'
  limit?: number
}): Promise<
  ApiResponse<{
    myRank: number
    totalUsers: number
    rankings: {
      rank: number
      userId: string
      username: string
      avatar: string
      value: number
      isMe: boolean
    }[]
  }>
> {
  return request.get('/commission/ranking', { params })
}

// 获取佣金规则
export function getCommissionRules(): Promise<
  ApiResponse<{
    registerCommission: number
    rechargeCommissionRate: number
    vipCommissionRate: number
    consumptionCommissionRate: number
    levelCommissionRates: {
      level: number
      rate: number
      minInvites: number
    }[]
    withdrawRules: {
      minAmount: number
      feeRate: number
      processingTime: string
    }
  }>
> {
  return request.get('/commission/rules')
}
