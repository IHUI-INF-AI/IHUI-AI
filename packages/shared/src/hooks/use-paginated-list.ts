// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import { type PageData } from '@ihui/api-client'

export type Fetcher<T> = (query: {
  page: number
  pageSize: number
}) => Promise<{ success: true; data: PageData<T> } | { success: false; error?: string }>

export interface PaginatedListResult<T> {
  items: T[]
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string
  page: number
  total: number
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
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  // 序号守卫(2026-10-25):fetcher 身份变化(筛选切档)会经下方 effect 重发第 1 页,
  // 与在途的旧查询/第 N 页并跑 —— 无守卫时两条响应按**到达顺序**互相覆盖:
  // 慢的旧页会把新筛选的第 1 页整表替换、或把第 N 页 append 进新结果,同时 setPage
  // 记成旧页号(下次"加载更多"直接跳页)。规则恒定:最后一次发出的请求才是当下事实,
  // 先发出的任何在途响应落地一律丢弃(不写数据、不写错误、不翻加载位 —— 状态归最后一发管)。
  const seqRef = useRef(0)

  const fetch = useCallback(
    async (nextPage: number, isRefresh: boolean) => {
      const mine = ++seqRef.current
      if (nextPage === 1) {
        if (isRefresh) setRefreshing(true)
        else setLoading(true)
      } else {
        setLoadingMore(true)
      }
      setError('')
      const res = await fetcher({ page: nextPage, pageSize })
      if (seqRef.current !== mine) return
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

  return {
    items,
    loading,
    refreshing,
    loadingMore,
    error,
    page,
    total,
    refresh,
    loadMore,
    removeItem,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
