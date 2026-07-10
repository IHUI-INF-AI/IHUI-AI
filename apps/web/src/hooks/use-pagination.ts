'use client'

import * as React from 'react'

export interface UsePaginationOptions {
  total: number
  pageSize?: number
  initialPage?: number
}

export interface UsePaginationReturn {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

export function usePagination({
  total,
  pageSize = 10,
  initialPage = 1,
}: UsePaginationOptions): UsePaginationReturn {
  const [page, setPage] = React.useState(initialPage)
  const [size, setSize] = React.useState(pageSize)

  const totalPages = Math.max(1, Math.ceil(total / size))

  const setPageSafe = React.useCallback(
    (p: number) => {
      setPage(Math.min(Math.max(1, p), totalPages))
    },
    [totalPages],
  )

  const setPageSize = React.useCallback((s: number) => {
    setSize(s)
    setPage(1)
  }, [])

  return {
    page,
    pageSize: size,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
    setPage: setPageSafe,
    setPageSize,
  }
}
