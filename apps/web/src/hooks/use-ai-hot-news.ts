'use client'

import { useQuery } from '@tanstack/react-query'

import { fetchApi } from '@/lib/api'

export interface AiHotNews {
  id: string
  title: string
  summary?: string
  url?: string
  source?: string
  hotScore: number
  publishedAt: string
  cover?: string
}

export interface UseAiHotNewsReturn {
  news: AiHotNews[]
  isLoading: boolean
  error: Error | null
  refresh: () => void
}

async function fetchHotNews(): Promise<AiHotNews[]> {
  const res = await fetchApi<AiHotNews[]>('/api/ai-ext/ai-feed/hot')
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** AI 热门新闻 Hook，使用 react-query 自动缓存 5 分钟 */
export function useAiHotNews(): UseAiHotNewsReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ai-hot-news'],
    queryFn: fetchHotNews,
    staleTime: 5 * 60 * 1000,
  })

  return {
    news: data ?? [],
    isLoading,
    error: error as Error | null,
    refresh: () => void refetch(),
  }
}
