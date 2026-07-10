import { useState, useCallback } from 'react'

interface PaginationOptions { initialPage?: number; initialPageSize?: number }
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

export function usePagination<T = any>(opts: PaginationOptions = {}): PaginationResult<T> {
  const { initialPage = 1, initialPageSize = 10 } = opts
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [total, setTotal] = useState(0)
  const [list, setList] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const hasNext = page * pageSize < total
  return {
    page, pageSize, total, list, loading, hasNext,
    setPage, setPageSize,
    setList: (newList, newTotal) => { setList(newList); setTotal(newTotal) },
    appendList: (more) => setList(prev => [...prev, ...more]),
    setLoading, reset: () => { setPage(1); setList([]); setTotal(0) },
    next: () => hasNext && setPage(p => p + 1),
    prev: () => page > 1 && setPage(p => p - 1)
  }
}
