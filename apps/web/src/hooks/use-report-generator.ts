'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'

export interface ReportConfig {
  type: 'pdf' | 'excel' | 'csv' | 'json'
  templateId?: string
  filters?: Record<string, unknown>
  fields?: string[]
  dateRange?: { start: string; end: string }
}

export interface ReportResult {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  downloadUrl?: string
  error?: string
  createdAt: string
}

export interface UseReportGeneratorReturn {
  generate: (config: ReportConfig) => Promise<ReportResult | null>
  generating: boolean
  error: Error | null
  reset: () => void
}

async function generateReport(config: ReportConfig): Promise<ReportResult> {
  const res = await fetchApi<ReportResult>('/api/reports/generate', {
    method: 'POST',
    body: JSON.stringify(config),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** 报告生成 Hook，封装 useMutation 提交生成任务 */
export function useReportGenerator(): UseReportGeneratorReturn {
  const mutation = useMutation({ mutationFn: generateReport })

  const generate = React.useCallback(
    async (config: ReportConfig): Promise<ReportResult | null> => {
      try {
        return await mutation.mutateAsync(config)
      } catch {
        return null
      }
    },
    [mutation],
  )

  return {
    generate,
    generating: mutation.isPending,
    error: mutation.error as Error | null,
    reset: mutation.reset,
  }
}
