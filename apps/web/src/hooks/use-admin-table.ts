'use client'

import * as React from 'react'

export interface AdminTableState {
  page: number
  pageSize: number
  sortBy: string | null
  sortOrder: 'asc' | 'desc'
  keyword: string
  filters: Record<string, unknown>
}

export interface UseAdminTableReturn extends AdminTableState {
  totalPages: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setSort: (field: string) => void
  setKeyword: (keyword: string) => void
  setFilter: (key: string, value: unknown) => void
  reset: () => void
}

interface UseAdminTableOptions {
  initialPageSize?: number
  total: number
}

/** Admin 表格通用逻辑 Hook，封装分页/排序/筛选状态 */
export function useAdminTable(options: UseAdminTableOptions): UseAdminTableReturn {
  const { initialPageSize = 10, total } = options
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(initialPageSize)
  const [sortBy, setSortBy] = React.useState<string | null>(null)
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc')
  const [keyword, setKeyword] = React.useState('')
  const [filters, setFilters] = React.useState<Record<string, unknown>>({})

  const totalPages = React.useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  )

  const setSort = React.useCallback((field: string) => {
    setSortBy((prevField) => {
      if (prevField !== field) {
        setSortOrder('asc')
        return field
      }
      setSortOrder((prevOrder) => (prevOrder === 'asc' ? 'desc' : 'asc'))
      return field
    })
  }, [])

  const setFilter = React.useCallback((key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const reset = React.useCallback(() => {
    setPage(1)
    setPageSize(initialPageSize)
    setSortBy(null)
    setSortOrder('asc')
    setKeyword('')
    setFilters({})
  }, [initialPageSize])

  return {
    page,
    pageSize,
    sortBy,
    sortOrder,
    keyword,
    filters,
    totalPages,
    setPage,
    setPageSize,
    setSort,
    setKeyword,
    setFilter,
    reset,
  }
}
