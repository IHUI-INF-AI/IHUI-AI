/**
 * 微信支付周期扣款(连续包月)API 客户端。
 * 对应后端路由:apps/api/src/routes/payment-recurring.ts + payment-extended.ts
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

// =============================================================================
// 类型定义
// =============================================================================

export type WechatPayContractStatus = 'pending' | 'active' | 'cancelled' | 'expired'
export type WechatPayContractChargeStatus = 'success' | 'failed' | 'pending'

export interface WechatPayContract {
  id: number
  contractId: string
  userId: string
  planId?: string
  productId?: number
  status: WechatPayContractStatus
  wechatPlanId?: string
  outTradeNo?: string
  nextChargeTime?: string
  lastChargeTime?: string
  lastChargeStatus?: WechatPayContractChargeStatus
  signedAt?: string
  cancelledAt?: string
  cancelReason?: string
  trialEndAt?: string
  rawResponse?: unknown
  createdAt: string
  updatedAt: string
}

export interface SignContractResponse {
  signUrl: string
  contractId: string
}

export interface SubscriptionStatus {
  isVip: boolean
  vipLevel?: number
  endTime?: string
  autoRenew: boolean
  planName?: string
  contract?: WechatPayContract
}

// =============================================================================
// API 函数
// =============================================================================

/** 发起周期扣款签约 — POST /payments/recurring/sign */
export async function signRecurringContract(params: {
  planId: string
  productId?: string
  openid?: string
}): Promise<ApiResult<SignContractResponse>> {
  return fetchApi<SignContractResponse>('/api/payments/recurring/sign', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/** 查询当前用户签约列表 — GET /payments/recurring/contracts */
export async function listRecurringContracts(): Promise<ApiResult<{ list: WechatPayContract[] }>> {
  return fetchApi<{ list: WechatPayContract[] }>('/api/payments/recurring/contracts')
}

/** 查询单个签约详情 — GET /payments/recurring/contracts/:id */
export async function getRecurringContract(
  id: number | string,
): Promise<ApiResult<{ contract: WechatPayContract }>> {
  return fetchApi<{ contract: WechatPayContract }>(`/api/payments/recurring/contracts/${id}`)
}

/** 解约(关闭自动续费) — POST /payments/recurring/contracts/:id/cancel */
export async function cancelRecurringContract(
  id: number | string,
  reason?: string,
): Promise<ApiResult<{ cancelled: boolean }>> {
  return fetchApi<{ cancelled: boolean }>(`/api/payments/recurring/contracts/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(reason ? { reason } : {}),
  })
}

/** 查询当前 VIP 订阅状态(含签约信息) — GET /payments/subscription/status */
export async function getSubscriptionStatus(): Promise<ApiResult<SubscriptionStatus>> {
  return fetchApi<SubscriptionStatus>('/api/payments/subscription/status')
}
