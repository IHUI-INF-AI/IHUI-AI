'use client'

import * as React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'

export interface ModelTestConfig {
  modelId: string
  prompt: string
  temperature?: number
  maxTokens?: number
}

export interface ModelTestResult {
  id: string
  modelId: string
  input: string
  output: string
  latencyMs: number
  tokenCount?: number
  success: boolean
  error?: string
  createdAt: string
}

export interface UseModelTestReturn {
  history: ModelTestResult[]
  isLoading: boolean
  testing: boolean
  runTest: (config: ModelTestConfig) => Promise<ModelTestResult | null>
  error: Error | null
}

async function fetchHistory(): Promise<ModelTestResult[]> {
  const res = await fetchApi<ModelTestResult[]>('/api/ai-ext/developer/model-test')
  if (!res.success) throw new Error(res.error)
  return res.data
}

async function runModelTest(config: ModelTestConfig): Promise<ModelTestResult> {
  const res = await fetchApi<ModelTestResult>('/api/ai-ext/developer/model-test', {
    method: 'POST',
    body: JSON.stringify(config),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** 模型测试 Hook，历史用 useQuery，执行测试用 useMutation */
export function useModelTest(): UseModelTestReturn {
  const { data, isLoading, error } = useQuery({
    queryKey: ['model-test-history'],
    queryFn: fetchHistory,
  })

  const mutation = useMutation({ mutationFn: runModelTest })

  const runTest = React.useCallback(
    async (config: ModelTestConfig): Promise<ModelTestResult | null> => {
      try {
        return await mutation.mutateAsync(config)
      } catch {
        return null
      }
    },
    [mutation],
  )

  return {
    history: data ?? [],
    isLoading,
    testing: mutation.isPending,
    runTest,
    error: error as Error | null,
  }
}
