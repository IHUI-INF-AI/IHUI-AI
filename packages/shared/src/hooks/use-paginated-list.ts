// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { type PageData } from '@ihui/api-client'

export type Fetcher<T> = (query: {
  page: number
  pageSize: number
}) => Promise<{ success: true; data: PageData<T> | T[] } | { success: false; error?: string }>

export interface PaginatedListResult<T> {
  items: T[]
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string
  page: number
  total: number
  /** 还有下一页(判据见 fetch 内两分支:后端给 total 就按条数,不给就按本页条数) */
  hasMore: boolean
  refresh: () => void
  loadMore: () => void
  removeItem: (predicate: (item: T) => boolean) => void
}

/**
 * 分页列表管理 Hook(无平台依赖,纯 React hooks)
 *
 * 在 shared/use-pagination 纯状态 hook 之上扩展列表管理:
 * items / loading / refreshing / loadingMore / error / refresh / loadMore / removeItem。
 *
 * 各端(RN/Taro/Web)可直接 re-export 使用,避免重复实现。
 */
export function usePaginatedList<T>(fetcher: Fetcher<T>, pageSize = 20): PaginatedListResult<T> {
  const [items, setItems] = useState<T[]>([])
  // 初值必须是 true:effect 在 paint 之后才跑,写 false 会让首帧"既不 loading 也没数据",
  // 列表屏的 `loading && items.length === 0` 骨架屏判据当场落空 ⇒ 先闪一帧空态再进骨架
  // (2026-10-29 接 ArticleListScreen 时实测到,故在源头改,而不是让每张屏各自兜一层)。
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  /** 后端给不给 total 是两回事:给了就按累计条数判到底,不给就只能按"本页是否取满"自守。 */
  const [totalKnown, setTotalKnown] = useState(false)
  const [lastCount, setLastCount] = useState(0)

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
        const list = Array.isArray(res.data) ? res.data : res.data.list
        setItems((prev) => (nextPage === 1 ? list : [...prev, ...list]))
        setLastCount(list.length)
        if (!Array.isArray(res.data)) {
          setTotal(res.data.total)
          setTotalKnown(true)
        }
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

  const hasMore = totalKnown ? items.length < total : lastCount === pageSize

  const refresh = useCallback(() => {
    void fetch(1, true)
  }, [fetch])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    void fetch(page + 1, false)
  }, [fetch, loadingMore, hasMore, page])

  const removeItem = useCallback((predicate: (item: T) => boolean) => {
    setItems((prev) => prev.filter((item) => !predicate(item)))
    setTotal((prev) => Math.max(0, prev - 1))
  }, [])

  return {
    items,
    loading,
    refreshing,
    loadingMore,
    error,
    page,
    total,
    hasMore,
    refresh,
    loadMore,
    removeItem,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
