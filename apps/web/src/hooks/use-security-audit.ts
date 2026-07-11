'use client'

import { useQuery } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'

export interface SecurityAuditItem {
  id: string
  category: 'auth' | 'data' | 'network' | 'config' | 'permission'
  level: 'info' | 'warning' | 'critical'
  title: string
  description: string
  suggestion?: string
  detectedAt: string
  resolved: boolean
}

export interface SecurityAuditSummary {
  score: number
  total: number
  critical: number
  warning: number
  resolved: number
  items: SecurityAuditItem[]
}

export interface UseSecurityAuditReturn {
  summary: SecurityAuditSummary | null
  isLoading: boolean
  error: Error | null
  refresh: () => void
}

async function fetchAudit(): Promise<SecurityAuditSummary> {
  const res = await fetchApi<SecurityAuditSummary>('/api/security/audit')
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** 安全审计 Hook，拉取审计概要（评分/告警项） */
export function useSecurityAudit(): UseSecurityAuditReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['security-audit'],
    queryFn: fetchAudit,
    staleTime: 60 * 1000,
  })

  return {
    summary: data ?? null,
    isLoading,
    error: error as Error | null,
    refresh: () => void refetch(),
  }
}
