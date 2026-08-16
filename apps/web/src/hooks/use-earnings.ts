'use client'

/**
 * 挣钱中心数据 Hook — 汇总概览/BYOK 抽成趋势/引流统计/转化漏斗
 *
 * 后端 /api/earnings/* 4 端点已实装真实聚合查询(2026-07-31 完成),
 * 前端 mock fallback 已移除(2026-08-04)。加载失败时上层使用 useEarnings
 * 返回的 error 状态显示重试提示,不再回退到 mock 数据。
 *
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
// API 调用(失败抛错,由 useQuery 上层处理 error 状态)
// =============================================================================

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) {
    throw new Error(r.error || '加载失败')
  }
  return r.data
}

// =============================================================================
// 独立 fetch 函数(供非 hook 场景使用)
// =============================================================================

export function fetchEarningsOverview(): Promise<EarningsOverview> {
  return fetchJson<EarningsOverview>('/api/earnings/overview')
}

export function fetchByokIncomeTrend(days = 30): Promise<ByokIncomePoint[]> {
  return fetchJson<ByokIncomePoint[]>(`/api/earnings/byok-trend?days=${days}`)
}

export function fetchReferralStats(): Promise<ReferralChannelStat[]> {
  return fetchJson<ReferralChannelStat[]>('/api/earnings/referral')
}

export function fetchConversionFunnel(): Promise<ConversionStageStat[]> {
  return fetchJson<ConversionStageStat[]>('/api/earnings/funnel')
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
  /** 加载失败错误(任一端点失败即设置,优先 overview 失败) */
  error: Error | null
}

export function useEarnings(): UseEarningsReturn {
  const overviewQ = useQuery({
    queryKey: ['earnings', 'overview'],
    queryFn: fetchEarningsOverview,
    staleTime: 60_000,
    retry: 1,
  })
  const trendQ = useQuery({
    queryKey: ['earnings', 'byok-trend', 30],
    queryFn: () => fetchByokIncomeTrend(30),
    staleTime: 60_000,
    retry: 1,
  })
  const referralQ = useQuery({
    queryKey: ['earnings', 'referral'],
    queryFn: fetchReferralStats,
    staleTime: 60_000,
    retry: 1,
  })
  const funnelQ = useQuery({
    queryKey: ['earnings', 'funnel'],
    queryFn: fetchConversionFunnel,
    staleTime: 60_000,
    retry: 1,
  })

  const loading =
    overviewQ.isLoading || trendQ.isLoading || referralQ.isLoading || funnelQ.isLoading

  // 优先返回 overview 错误,其次其他端点
  const error = overviewQ.error ?? trendQ.error ?? referralQ.error ?? funnelQ.error ?? null

  return {
    overview: overviewQ.data ?? null,
    byokTrend: trendQ.data ?? [],
    referral: referralQ.data ?? [],
    funnel: funnelQ.data ?? [],
    loading,
    error,
  }
}
