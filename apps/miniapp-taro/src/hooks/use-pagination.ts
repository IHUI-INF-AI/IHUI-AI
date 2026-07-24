import { useState, useCallback } from 'react'
import { usePagination as useSharedPagination } from '@ihui/shared/hooks/use-pagination'

interface PaginationOptions {
  initialPage?: number
  initialPageSize?: number
}
interface PaginationResult<T> {
  page: number
  pageSize: number
  total: number
  list: T[]
  loading: boolean
  hasNext: boolean
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setList: (list: T[], total: number) => void
  appendList: (list: T[]) => void
  setLoading: (loading: boolean) => void
  reset: () => void
  next: () => void
  prev: () => void
}

/**
 * 分页 Hook(miniapp-taro 端:扩展 shared 纯状态 + 列表管理)
 *
 * 基于 @ihui/shared/hooks/use-pagination,加入 list/loading/appendList 等列表管理逻辑。
 * - setPage 自动 clamp 到 [1, totalPages](行为升级,原版无 clamp)
 * - setList(list, total) 同时更新列表和总数
 */
export function usePagination<T = unknown>(opts: PaginationOptions = {}): PaginationResult<T> {
  const { initialPage = 1, initialPageSize = 10 } = opts
  const base = useSharedPagination({
    total: 0,
    pageSize: initialPageSize,
    initialPage,
  })
  const [list, setList] = useState<T[]>([])
  const [loading, setLoading] = useState(false)

  const setListAndTotal = useCallback(
    (newList: T[], newTotal: number) => {
      setList(newList)
      base.setTotal(newTotal)
    },
    [base],
  )

  const appendList = useCallback((more: T[]) => {
    setList((prev) => [...prev, ...more])
  }, [])

  const resetAll = useCallback(() => {
    base.reset()
    setList([])
    base.setTotal(0)
  }, [base])

  return {
    page: base.page,
    pageSize: base.pageSize,
    total: base.total,
    list,
    loading,
    hasNext: base.hasNext,
    setPage: base.setPage,
    setPageSize: base.setPageSize,
    setList: setListAndTotal,
    appendList,
    setLoading,
    reset: resetAll,
    next: base.next,
    prev: base.prev,
  }
}
