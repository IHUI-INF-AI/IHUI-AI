import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { logger } from '@/utils/logger'

export interface InfiniteScrollOptions<T> {
  /** 每页大小，默认 10 */
  pageSize?: number
  /** 获取数据的函数 */
  fetchFn: (page: number, pageSize: number) => Promise<{ list: T[]; total: number }>
  /** 是否立即加载，默认 false */
  immediate?: boolean
}

export interface InfiniteScrollReturn<T> {
  /** 数据列表 */
  list: Ref<T[]>
  /** 加载状态 */
  loading: Ref<boolean>
  /** 是否已加载全部 */
  finished: Ref<boolean>
  /** 刷新状态 */
  refreshing: Ref<boolean>
  /** 当前页码 */
  page: Ref<number>
  /** 总数 */
  total: Ref<number>
  /** 加载下一页 */
  loadData: () => Promise<void>
  /** 刷新列表 */
  refresh: () => Promise<void>
  /** 重置列表 */
  reset: () => void
  /** 是否为空 */
  isEmpty: ComputedRef<boolean>
}

export function useInfiniteScroll<T = unknown>(
  options: InfiniteScrollOptions<T>
): InfiniteScrollReturn<T> {
  const { pageSize = 10, fetchFn, immediate = false } = options

  const list = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const finished = ref(false)
  const refreshing = ref(false)
  const page = ref(1)
  const total = ref(0)

  const isEmpty = computed(() => !loading.value && list.value.length === 0)

  const loadData = async (): Promise<void> => {
    if (loading.value || finished.value) return

    loading.value = true
    try {
      const res = await fetchFn(page.value, pageSize)
      list.value = [...list.value, ...res.list]
      total.value = res.total
      page.value++
      if (list.value.length >= total.value) {
        finished.value = true
      }
    } catch (error) {
      logger.error('InfiniteScroll loadData error:', error)
    } finally {
      loading.value = false
    }
  }

  const refresh = async (): Promise<void> => {
    refreshing.value = true
    page.value = 1
    finished.value = false
    list.value = []
    await loadData()
    refreshing.value = false
  }

  const reset = (): void => {
    page.value = 1
    finished.value = false
    list.value = []
    total.value = 0
  }

  if (immediate) {
    void loadData()
  }

  return {
    list,
    loading,
    finished,
    refreshing,
    page,
    total,
    loadData,
    refresh,
    reset,
    isEmpty,
  }
}
