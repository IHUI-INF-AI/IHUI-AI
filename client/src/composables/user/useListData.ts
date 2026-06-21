/**
 * 列表数据管理 Composable
 *
 * 提供通用的列表数据加载、搜索、缓存等功能，用于统一管理列表数据的加载逻辑。
 *
 * @example
 * ```typescript
 * const { list, loading, search, loadData } = useListData({
 *   loadFunction: async ({ uuid, page, pageSize, search }) => {
 *     return await getListData({ uuid, page, pageSize, search })
 *   },
 *   cacheKey: 'myList',
 *   enableCache: true,
 *   debounceDelay: 300,
 * })
 * ```
 *
 * @packageDocumentation
 */

import { ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useAuthStore } from '@/stores/auth'
import type { UserInfoData } from '@/api/user'
import { logger } from '@/utils/logger'
import {
  cancelRequest,
  createAbortController,
  getCachedData,
  setCachedData,
} from '@/utils/resource-optimizer'

/**
 * useListData 配置选项
 */
export interface UseListDataOptions<T> {
  /** 数据加载函数 */
  loadFunction: (params: {
    uuid: string
    page?: number
    pageSize?: number
    search?: string
    [key: string]: any
  }) => Promise<{
    code?: number
    success?: boolean
    data?: {
      list?: T[]
      pagination?: {
        total?: number
        page?: number
        pageSize?: number
      }
    }
    [key: string]: any
  }>
  /** 缓存键名 */
  cacheKey?: string
  /** 防抖延迟时间（毫秒），默认为 300 */
  debounceDelay?: number
  /** 是否启用缓存，默认为 false */
  enableCache?: boolean
  /** 是否启用请求取消，默认为 false */
  enableAbortController?: boolean
}

/**
 * 列表数据管理 Composable
 *
 * @param options - 配置选项
 * @returns 返回列表数据、加载状态和相关方法
 */
export function useListData<T>(options: UseListDataOptions<T>) {
  const {
    loadFunction,
    cacheKey,
    debounceDelay = 300,
    enableCache = false,
    enableAbortController = false,
  } = options

  const authStore = useAuthStore()
  const list = ref<T[]>([])
  const loading = ref(false)
  const search = ref('')

  /**
   * 加载数据
   *
   * @param params - 加载参数（页码、每页数量、搜索关键词等）
   */
  const loadData = async (
    params: {
      page?: number
      pageSize?: number
      search?: string
      [key: string]: any
    } = {}
  ): Promise<void> => {
    const user = authStore.user as UserInfoData | null
    if (!user?.uuid) return

    // 检查缓存
    if (enableCache && cacheKey) {
      const cacheParams = { ...params, uuid: user.uuid }
      const cacheKeyStr = `${cacheKey}_${JSON.stringify(cacheParams)}`
      const cached = getCachedData(cacheKeyStr) as T[] | null
      if (cached && Array.isArray(cached)) {
        list.value = cached
        return
      }
    }

    loading.value = true

    // 取消之前的请求
    if (enableAbortController && cacheKey) {
      cancelRequest(cacheKey)
      createAbortController(cacheKey)
    }

    try {
      const response = await loadFunction({
        uuid: user.uuid,
        ...params,
      })

      if (response.code === 200 || response.success) {
        const data = Array.isArray(response.data)
          ? (response.data as T[])
          : (response.data as { list?: T[] })?.list || []
        list.value = data

        // 设置缓存
        if (enableCache && cacheKey) {
          const cacheParams = { ...params, uuid: user.uuid }
          const cacheKeyStr = `${cacheKey}_${JSON.stringify(cacheParams)}`
          setCachedData(cacheKeyStr, data)
        }
      }
    } catch (error: any) {
      if (error instanceof Error && error.name !== 'AbortError') {
        logger.error(`Failed to load data [${cacheKey || 'unknown'}]:`, error)
      }
    } finally {
      loading.value = false
    }
  }

  /**
   * 防抖加载数据（使用 VueUse 的 useDebounceFn）
   */
  const debouncedLoadData = useDebounceFn(loadData, debounceDelay)

  /**
   * 清空搜索内容
   */
  const clearSearch = (): void => {
    search.value = ''
  }

  /**
   * 重置列表数据
   */
  const resetList = (): void => {
    list.value = []
    search.value = ''
  }

  return {
    list,
    loading,
    search,
    loadData,
    debouncedLoadData,
    clearSearch,
    resetList,
  }
}
