// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'
import { buildQs, type PageData } from '../utils'

export interface WalletBalance {
  balance: number
  frozenBalance: number
  totalRecharge: number
  totalWithdraw: number
}

export interface WalletRecord {
  id: string
  amount: number
  balanceAfter: number
  type: 'recharge' | 'withdraw' | 'consume' | 'refund' | 'commission'
  status: string
  payMethod: string | null
  remark: string | null
  createdAt: string
}

export async function getBalance(): Promise<ApiResult<WalletBalance>> {
  return fetchApi<WalletBalance>('/api/wallet/balance')
}

export async function recharge(input: {
  amount: number
  payMethod: string
  couponId?: string
}): Promise<ApiResult<{ orderNo: string; payUrl?: string }>> {
  return fetchApi<{ orderNo: string; payUrl?: string }>('/api/wallet/recharge', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function withdraw(input: {
  amount: number
  account: string
  accountType: string
}): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>('/api/wallet/withdraw', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getWithdrawRecords(
  query: { page?: number; pageSize?: number; status?: string } = {},
): Promise<ApiResult<PageData<WalletRecord>>> {
  return fetchApi<PageData<WalletRecord>>(`/api/wallet/withdraw/records${buildQs(query)}`)
}

export async function getRechargeRecords(
  query: { page?: number; pageSize?: number; status?: string } = {},
): Promise<ApiResult<PageData<WalletRecord>>> {
  return fetchApi<PageData<WalletRecord>>(`/api/wallet/recharge/records${buildQs(query)}`)
}

/** 单日消耗桶(date 为 UTC 日期键 YYYY-MM-DD;缺日由服务端补零) */
export interface CreditsUsageBucket {
  date: string
  /** 当日积分消耗笔数 */
  count: number
  /** 当日消耗积分总量(≥0) */
  points: number
  /** 当日新建会话数(与积分消耗是两条独立序列,不可互相换算) */
  sessions: number
}

/** GET /api/credits/usage/daily 响应(按日积分消耗聚合,只读) */
export interface CreditsDailyUsage {
  days: number
  startDate: string
  endDate: string
  timezone: 'UTC'
  buckets: CreditsUsageBucket[]
}

/**
 * 按日积分消耗聚合(需登录;days 上限 365,越界服务端返 400)。
 * 返回的 buckets 已按日期升序逐日补零,可直接折叠成热力图 dayCounts。
 */
export async function getDailyCreditsUsage(
  query: { days?: number } = {},
): Promise<ApiResult<CreditsDailyUsage>> {
  return fetchApi<CreditsDailyUsage>(`/api/credits/usage/daily${buildQs(query)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
