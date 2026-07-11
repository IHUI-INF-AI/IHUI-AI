'use client'

import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'

export interface AiReportConfig {
  type: 'daily' | 'weekly' | 'custom'
  startDate?: string
  endDate?: string
  metrics?: string[]
}

export interface AiReport {
  id: string
  title: string
  content: string
  type: string
  createdAt: string
  status: 'pending' | 'completed' | 'failed'
}

export interface UseAiReportReturn {
  reports: AiReport[]
  isLoading: boolean
  generating: boolean
  generate: (config: AiReportConfig) => Promise<AiReport | null>
  error: Error | null
}

async function fetchReports(): Promise<AiReport[]> {
  const res = await fetchApi<AiReport[]>('/api/ai-ext/reports')
  if (!res.success) throw new Error(res.error)
  return res.data
}

async function generateReport(config: AiReportConfig): Promise<AiReport> {
  const res = await fetchApi<AiReport>('/api/ai-ext/reports/generate', {
    method: 'POST',
    body: JSON.stringify(config),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** AI 报告引擎 Hook，列表用 useQuery，生成用 useMutation */
export function useAiReport(): UseAiReportReturn {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-reports'],
    queryFn: fetchReports,
  })

  const mutation = useMutation({
    mutationFn: generateReport,
  })

  const generate = React.useCallback(
    async (config: AiReportConfig): Promise<AiReport | null> => {
      try {
        return await mutation.mutateAsync(config)
      } catch {
        return null
      }
    },
    [mutation],
  )

  return {
    reports: data ?? [],
    isLoading,
    generating: mutation.isPending,
    generate,
    error: error as Error | null,
  }
}
