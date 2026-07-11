'use client'

import { useQuery } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'

export interface BiMetric {
  key: string
  label: string
  value: number
  delta?: number
  unit?: string
}

export interface BiChart {
  id: string
  title: string
  type: 'line' | 'bar' | 'pie' | 'area'
  data: Array<Record<string, unknown>>
}

export interface BiDashboard {
  metrics: BiMetric[]
  charts: BiChart[]
  updatedAt: string
}

export interface UseBiReturn {
  dashboard: BiDashboard | null
  isLoading: boolean
  error: Error | null
  refresh: () => void
}

async function fetchDashboard(): Promise<BiDashboard> {
  const res = await fetchApi<BiDashboard>('/api/bi/dashboard')
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** 商业智能 Hook，拉取 BI 仪表盘数据 */
export function useBi(): UseBiReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['bi-dashboard'],
    queryFn: fetchDashboard,
    staleTime: 60 * 1000,
  })

  return {
    dashboard: data ?? null,
    isLoading,
    error: error as Error | null,
    refresh: () => void refetch(),
  }
}
