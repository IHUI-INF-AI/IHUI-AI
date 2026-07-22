'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

/** aiFeedHotItem 表对应结构 */
export interface AiFeedItem {
  id: string
  title: string
  summary?: string
  url?: string
  source?: string
  category?: string
  publishedAt?: string
  hotScore?: number
  cover?: string
}

export interface UseAiFeedReturn {
  items: AiFeedItem[]
  loading: boolean
  error: string | null
  hasMore: boolean
  page: number
  fetchItems: (reset?: boolean) => Promise<void>
}

const PAGE_SIZE = 20

/** AI 资讯流 Hook，对接 aiFeedHotItem 表 */
export function useAiFeed(): UseAiFeedReturn {
  const [items, setItems] = React.useState<AiFeedItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const pageRef = React.useRef(1)
  const [hasMore, setHasMore] = React.useState(true)

  const fetchItems = React.useCallback(
    async (reset = false) => {
      const nextPage = reset ? 1 : pageRef.current
      setLoading(true)
      setError(null)
      try {
        const res = await fetchApi<{ list: AiFeedItem[]; total: number }>(
          `/api/ai-ext/ai-feed/items?page=${nextPage}&pageSize=${PAGE_SIZE}`,
        )
        if (res.success) {
          const list = res.data.list ?? []
          setItems((prev) => (reset ? list : [...prev, ...list]))
          setHasMore(list.length === PAGE_SIZE)
          pageRef.current = nextPage + 1
        } else {
          setError(res.error)
        }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { items, loading, error, hasMore, page: pageRef.current, fetchItems }
}
