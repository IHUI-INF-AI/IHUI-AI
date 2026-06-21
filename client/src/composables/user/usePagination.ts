/**
 * 分页管理 Composable
 *
 * 提供通用的分页状态管理和处理方法，用于统一管理列表数据的分页逻辑。
 *
 * @example
 * ```typescript
 * const { pagination, handlePageChange, handlePageSizeChange } = usePagination({
 *   initialPage: 1,
 *   initialPageSize: 20,
 *   onPageChange: async (page) => {
 *     await loadData(page)
 *   },
 *   onPageSizeChange: async (pageSize) => {
 *     await loadData(1, pageSize)
 *   },
 * })
 * ```
 *
 * @packageDocumentation
 */

import { reactive } from 'vue'

/**
 * 分页状态接口
 */
export interface PaginationState {
  /** 当前页码，从 1 开始 */
  page: number
  /** 每页显示数量 */
  pageSize: number
  /** 总记录数 */
  total: number
}

/**
 * usePagination 配置选项
 */
export interface UsePaginationOptions {
  /** 初始页码，默认为 1 */
  initialPage?: number
  /** 初始每页数量，默认为 20 */
  initialPageSize?: number
  /** 页码变化时的回调函数 */
  onPageChange?: (page: number) => void | Promise<void>
  /** 每页数量变化时的回调函数 */
  onPageSizeChange?: (pageSize: number) => void | Promise<void>
}

/**
 * 分页管理 Composable
 *
 * @param options - 配置选项
 * @returns 返回分页状态和处理方法
 */
export function usePagination(options: UsePaginationOptions = {}) {
  const { initialPage = 1, initialPageSize = 20, onPageChange, onPageSizeChange } = options

  const pagination = reactive<PaginationState>({
    page: initialPage,
    pageSize: initialPageSize,
    total: 0,
  })

  /**
   * 处理页码变化
   * @param page - 新的页码
   */
  const handlePageChange = async (page: number): Promise<void> => {
    pagination.page = page
    if (onPageChange) {
      await onPageChange(page)
    }
  }

  /**
   * 处理每页数量变化
   * @param pageSize - 新的每页数量
   */
  const handlePageSizeChange = async (pageSize: number): Promise<void> => {
    pagination.pageSize = pageSize
    pagination.page = 1 // 重置到第一页
    if (onPageSizeChange) {
      await onPageSizeChange(pageSize)
    }
  }

  /**
   * 重置分页到初始状态
   */
  const resetPagination = (): void => {
    pagination.page = initialPage
    pagination.pageSize = initialPageSize
    pagination.total = 0
  }

  return {
    pagination,
    handlePageChange,
    handlePageSizeChange,
    resetPagination,
  }
}
