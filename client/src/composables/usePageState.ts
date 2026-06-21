/**
 * 统一页面状态管理 Composable
 * 提供统一的 loading、error、empty 状态管理
 */

import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { t } from '@/utils/i18n'
import { useApiError } from './useApiError'
import type { ApiResponse } from '@/types'

export interface UsePageStateOptions {
  /** 是否自动显示错误消息 */
  autoShowError?: boolean
  /** 是否自动显示成功消息 */
  autoShowSuccess?: boolean
  /** 空状态的描述文本 */
  emptyText?: string
  /** 初始loading状态 */
  initialLoading?: boolean
}

/**
 * 统一页面状态管理
 * 整合 loading、error、empty 状态
 */
export function usePageState<T = unknown>(options: UsePageStateOptions = {}) {
  const { autoShowError = true, autoShowSuccess = false, emptyText = '暂无数据' } = options

  const { error, loading: apiLoading, execute, clearError } = useApiError()
  const data = ref<T | null>(null)
  const isEmpty = computed(() => {
    if (data.value === null || data.value === undefined) return true
    if (Array.isArray(data.value)) return data.value.length === 0
    if (typeof data.value === 'object') return Object.keys(data.value).length === 0
    return false
  })

  /**
   * 执行API调用并更新状态
   */
  const fetchData = async <R = T>(
    apiCall: () => Promise<ApiResponse<R>>,
    options?: {
      showSuccess?: boolean
      successMessage?: string
      onSuccess?: (data: R) => void
      onError?: (error: any) => void
      transform?: (data: R) => T
    }
  ): Promise<R | null> => {
    const result = await execute(apiCall, {
      showMessage: autoShowError,
    })

    if (result) {
      const transformedData = options?.transform
        ? options.transform(result)
        : (result as unknown as T)
      data.value = transformedData
      if (options?.showSuccess || autoShowSuccess) {
        ElMessage.success(options?.successMessage || '操作成功')
      }
      options?.onSuccess?.(result)
      return result
    } else {
      options?.onError?.(error.value)
      return null
    }
  }

  /**
   * 重置状态
   */
  const reset = () => {
    data.value = null
    clearError()
  }

  return {
    // 状态
    data,
    loading: computed(() => apiLoading.value),
    error,
    isEmpty,
    emptyText,

    // 方法
    fetchData,
    reset,
    clearError,
  }
}

/**
 * 列表页面状态管理（带分页）
 */
export function useListPageState<T = unknown>(options: UsePageStateOptions = {}) {
  const pageState = usePageState<T[]>(options)
  const pagination = ref({
    page: 1,
    pageSize: 20,
    total: 0,
  })

  /**
   * 加载列表数据
   */
  const loadList = async <R = T>(
    apiCall: (params: {
      page: number
      pageSize: number
    }) => Promise<ApiResponse<{ list: R[]; total: number }>>,
    options?: {
      reset?: boolean
      showSuccess?: boolean
      onSuccess?: (data: R[]) => void
    }
  ): Promise<R[] | null> => {
    if (options?.reset) {
      pagination.value.page = 1
    }

    const response = await apiCall({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    })

    if (response.code === 200 || response.success) {
      const listData = response.data as { list: R[]; total: number }
      if (listData && 'list' in listData && 'total' in listData) {
        if (options?.reset) {
          pageState.data.value = listData.list as unknown as T[]
        } else {
          const currentData = (pageState.data.value || []) as unknown as R[]
          pageState.data.value = [...currentData, ...listData.list] as unknown as T[]
        }
        pagination.value.total = listData.total
        options?.onSuccess?.(listData.list)
        return listData.list
      }
    } else {
      if (options?.showSuccess === false) {
        // 静默失败
      } else {
        ElMessage.error(response.message || t('common.errors.loadFailed'))
      }
    }

    return null
  }

  /**
   * 重置列表
   */
  const resetList = () => {
    pageState.reset()
    pagination.value.page = 1
    pagination.value.total = 0
  }

  return {
    ...pageState,
    pagination,
    loadList,
    resetList,
  }
}
