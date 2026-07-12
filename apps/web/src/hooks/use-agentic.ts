'use client'

import { useQuery } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'

export interface AgenticTask {
  id: string
  name: string
  description?: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  capabilities?: string[]
  createdAt?: string
}

export interface UseAgenticReturn {
  tasks: AgenticTask[]
  isLoading: boolean
  error: Error | null
  refresh: () => void
}

async function fetchAgentic(): Promise<AgenticTask[]> {
  const res = await fetchApi<AgenticTask[]>('/api/workspace/agentic')
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** Agentic AI Hook，拉取工作区 Agentic 任务列表 */
export function useAgentic(): UseAgenticReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['agentic-tasks'],
    queryFn: fetchAgentic,
  })

  return {
    tasks: data ?? [],
    isLoading,
    error: error as Error | null,
    refresh: () => void refetch(),
  }
}
