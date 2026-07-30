'use client'

/**
 * 挣钱中心数据 Hook — 汇总概览/BYOK 抽成趋势/引流统计/转化漏斗
 *
 * API 未就绪时 fallback 到 mock 数据(前端展示层先行,后端后续补)。
 * 所有金额单位:元(¥)。转化率单位:%。
 */
import { useQuery } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'

// =============================================================================
// 类型定义(精确,禁 any)
// =============================================================================

export interface EarningsOverview {
  /** 今日收入(元) */
  todayIncome: number
  /** 今日收入对比昨天趋势(%) */
  todayIncomeTrend: number
  /** BYOK 抽成收入(元) */
  byokIncome: number
  /** BYOK 抽成收入趋势(%) */
  byokIncomeTrend: number
  /** 今日免费用户引流数 */
  referralCount: number
  /** 引流数趋势(%) */
  referralTrend: number
  /** 付费转化率(%) */
  conversionRate: number
  /** 转化率趋势(%) */
  conversionTrend: number
}

export interface ByokIncomePoint {
  /** YYYY-MM-DD */
  date: string
  /** 当日 BYOK 抽成收入(元) */
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

// =============================================================================
// API 调用 + mock fallback
// =============================================================================

async function fetchJson<T>(url: string, mock: T): Promise<T> {
  try {
    const r = await fetchApi<T>(url)
    if (r.success) return r.data
    return mock
  } catch {
    return mock
  }
}

/** 生成最近 N 天的 mock BYOK 抽成趋势(合理波动) */
function mockByokTrend(days: number): ByokIncomePoint[] {
  const points: ByokIncomePoint[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const ymd = d.toISOString().slice(0, 10)
    // 3~15 元波动,周末略低
    const weekend = d.getDay() === 0 || d.getDay() === 6
    const base = weekend ? 4 : 8
    const amount = Number((base + Math.sin(i * 0.7) * 3 + Math.random() * 2).toFixed(2))
    points.push({ date: ymd, amount: Math.max(2, amount) })
  }
  return points
}

const MOCK_OVERVIEW: EarningsOverview = {
  todayIncome: 12.5,
  todayIncomeTrend: 8.2,
  byokIncome: 8.3,
  byokIncomeTrend: 12.5,
  referralCount: 23,
  referralTrend: 5.1,
  conversionRate: 4.3,
  conversionTrend: 0.8,
}

const MOCK_REFERRAL: ReferralChannelStat[] = [
  { channel: 'free-model', count: 12 },
  { channel: 'publish', count: 7 },
  { channel: 'direct', count: 4 },
]

const MOCK_FUNNEL: ConversionStageStat[] = [
  { stage: 'register', count: 230 },
  { stage: 'active', count: 145 },
  { stage: 'byok', count: 42 },
  { stage: 'vip', count: 9 },
]

// =============================================================================
// 独立 fetch 函数(供非 hook 场景使用)
// =============================================================================

export function fetchEarningsOverview(): Promise<EarningsOverview> {
  return fetchJson<EarningsOverview>('/api/earnings/overview', MOCK_OVERVIEW)
}

export function fetchByokIncomeTrend(days = 30): Promise<ByokIncomePoint[]> {
  return fetchJson<ByokIncomePoint[]>(`/api/earnings/byok-trend?days=${days}`, mockByokTrend(days))
}

export function fetchReferralStats(): Promise<ReferralChannelStat[]> {
  return fetchJson<ReferralChannelStat[]>('/api/earnings/referral', MOCK_REFERRAL)
}

export function fetchConversionFunnel(): Promise<ConversionStageStat[]> {
  return fetchJson<ConversionStageStat[]>('/api/earnings/funnel', MOCK_FUNNEL)
}

// =============================================================================
// Hook:聚合 4 个端点 + loading 状态
// =============================================================================

export interface UseEarningsReturn {
  overview: EarningsOverview | null
  byokTrend: ByokIncomePoint[]
  referral: ReferralChannelStat[]
  funnel: ConversionStageStat[]
  loading: boolean
}

export function useEarnings(): UseEarningsReturn {
  const overviewQ = useQuery({
    queryKey: ['earnings', 'overview'],
    queryFn: fetchEarningsOverview,
    staleTime: 60_000,
  })
  const trendQ = useQuery({
    queryKey: ['earnings', 'byok-trend', 30],
    queryFn: () => fetchByokIncomeTrend(30),
    staleTime: 60_000,
  })
  const referralQ = useQuery({
    queryKey: ['earnings', 'referral'],
    queryFn: fetchReferralStats,
    staleTime: 60_000,
  })
  const funnelQ = useQuery({
    queryKey: ['earnings', 'funnel'],
    queryFn: fetchConversionFunnel,
    staleTime: 60_000,
  })

  const loading =
    overviewQ.isLoading || trendQ.isLoading || referralQ.isLoading || funnelQ.isLoading

  return {
    overview: overviewQ.data ?? null,
    byokTrend: trendQ.data ?? [],
    referral: referralQ.data ?? [],
    funnel: funnelQ.data ?? [],
    loading,
  }
}
