import { useState, useRef, useCallback } from 'react'

export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

interface UseSocialListOptions<T> {
  pageSize?: number
  fetch: (params: { page: number; pageSize: number }) => Promise<PaginatedResponse<T>>
}

export function useSocialList<T extends { id: string }>(options: UseSocialListOptions<T>) {
  const { fetch, pageSize = 20 } = options
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(1)
  const loadingRef = useRef(false)

  const load = useCallback(
    async (reset = false) => {
      if (loadingRef.current) return
      if (reset) {
        pageRef.current = 1
        setHasMore(true)
        setItems([])
      }
      if (!hasMore && !reset) return
      loadingRef.current = true
      setLoading(true)
      try {
        const res = await fetch({ page: pageRef.current, pageSize })
        const list = res.list || []
        setItems((prev) => (reset ? list : [...prev, ...list]))
        const more = pageRef.current * pageSize < res.total
        setHasMore(more)
        if (more) pageRef.current++
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [fetch, pageSize, hasMore],
  )

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  return { items, loading, hasMore, load, removeItem }
}
