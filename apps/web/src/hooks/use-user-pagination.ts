'use client'

import { usePagination } from '@/hooks/use-pagination'

export interface UseUserPaginationReturn {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

/** 用户分页 Hook，基于通用 usePagination 封装用户列表默认分页尺寸 */
export function useUserPagination(total: number, initialPageSize = 10): UseUserPaginationReturn {
  const pagination = usePagination({ total, pageSize: initialPageSize })
  return pagination
}
