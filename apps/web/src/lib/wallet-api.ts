import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

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
