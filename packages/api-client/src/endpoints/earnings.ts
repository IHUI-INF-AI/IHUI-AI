import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'
import { buildQs } from '../utils'

// 响应类型对齐 apps/api/src/routes/earnings-routes.ts + apps/web/src/hooks/use-earnings.ts

export interface EarningsOverview {
  todayIncome: number
  todayIncomeTrend: number
  byokIncome: number
  byokIncomeTrend: number
  referralCount: number
  referralTrend: number
  conversionRate: number
  conversionTrend: number
}

export interface ByokIncomePoint {
  date: string
  amount: number
}

export type ReferralChannelCode = 'free-model' | 'publish' | 'direct'

export interface ReferralChannelStat {
  channel: ReferralChannelCode
  count: number
}

export type ConversionStageCode = 'register' | 'active' | 'byok' | 'vip'

export interface ConversionStageStat {
  stage: ConversionStageCode
  count: number
}

/** GET /api/earnings/overview — 今日收入概览 + 同比昨天趋势(admin) */
export function getEarningsOverview(): Promise<ApiResult<EarningsOverview>> {
  return fetchApi<EarningsOverview>('/api/earnings/overview')
}

/** GET /api/earnings/byok-trend?days=N — 最近 N 天 BYOK 抽成趋势(默认 30) */
export function getByokIncomeTrend(
  query: { days?: number } = {},
): Promise<ApiResult<ByokIncomePoint[]>> {
  return fetchApi<ByokIncomePoint[]>(`/api/earnings/byok-trend${buildQs(query)}`)
}

/** GET /api/earnings/referral — 各渠道引流数(free-model/publish/direct) */
export function getReferralStats(): Promise<ApiResult<ReferralChannelStat[]>> {
  return fetchApi<ReferralChannelStat[]>('/api/earnings/referral')
}

/** GET /api/earnings/funnel — 转化漏斗(register→active→byok→vip) */
export function getConversionFunnel(): Promise<ApiResult<ConversionStageStat[]>> {
  return fetchApi<ConversionStageStat[]>('/api/earnings/funnel')
}
