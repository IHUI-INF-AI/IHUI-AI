'use client'

import { usePagination as useSharedPagination } from '@ihui/shared/hooks/use-pagination'
import type { UsePaginationReturn as SharedUsePaginationReturn } from '@ihui/shared/hooks/use-pagination'

export type UsePaginationReturn = SharedUsePaginationReturn

export interface UsePaginationOptions {
  /** 总数(web 端作为受控输入,必填) */
  total: number
  pageSize?: number
  initialPage?: number
}

/**
 * 分页 Hook(web 端:total 作为受控输入)
 *
 * 基于 @ihui/shared/hooks/use-pagination,保留 web 端 total 必填的严格接口。
 */
export function usePagination(options: UsePaginationOptions): UsePaginationReturn {
  return useSharedPagination(options)
}
