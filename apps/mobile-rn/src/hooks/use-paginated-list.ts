import { useCallback, useEffect, useState } from 'react'

interface PageData<T> {
  list: T[]
  total: number
}

type Fetcher<T> = (query: {
  page: number
  pageSize: number
}) => Promise<{ success: true; data: PageData<T> } | { success: false; error?: string }>

export function usePaginatedList<T>(fetcher: Fetcher<T>, pageSize = 20) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetch = useCallback(
    async (nextPage: number, isRefresh: boolean) => {
      if (nextPage === 1) {
        if (isRefresh) setRefreshing(true)
        else setLoading(true)
      } else {
        setLoadingMore(true)
      }
      setError('')
      const res = await fetcher({ page: nextPage, pageSize })
      if (res.success) {
        setItems((prev) => (nextPage === 1 ? res.data.list : [...prev, ...res.data.list]))
        setTotal(res.data.total)
        setPage(nextPage)
      } else {
        setError(res.error || '加载失败')
      }
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    },
    [fetcher, pageSize],
  )

  useEffect(() => {
    void fetch(1, false)
  }, [fetch])

  const refresh = useCallback(() => {
    void fetch(1, true)
  }, [fetch])

  const loadMore = useCallback(() => {
    if (loadingMore || items.length >= total) return
    void fetch(page + 1, false)
  }, [fetch, loadingMore, items.length, total, page])

  const removeItem = useCallback((predicate: (item: T) => boolean) => {
    setItems((prev) => prev.filter((item) => !predicate(item)))
    setTotal((prev) => Math.max(0, prev - 1))
  }, [])

  return { items, loading, refreshing, loadingMore, error, refresh, loadMore, removeItem }
}
