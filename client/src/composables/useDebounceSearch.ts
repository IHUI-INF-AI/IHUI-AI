/**
 * 统一搜索防抖 Composable
 * 提供统一的搜索防抖处理
 */

import { ref, watch } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

export interface UseDebounceSearchOptions {
  /** 防抖延迟时间（毫秒） */
  delay?: number
  /** 是否立即执行第一次 */
  immediate?: boolean
  /** 最小搜索长度 */
  minLength?: number
}

/**
 * 搜索防抖 Composable
 */
export function useDebounceSearch(
  callback: (keyword: string) => void | Promise<void>,
  options: UseDebounceSearchOptions = {}
) {
  const { delay = 300, immediate: _immediate = false, minLength = 0 } = options
  const cleanup = useCleanup()
  const searchKeyword = ref('')
  let timer: { cancel: () => void; id: ReturnType<typeof setTimeout> } | null = null

  /**
   * 执行搜索
   */
  const executeSearch = () => {
    if (timer !== null) {
      timer.cancel()
    }

    timer = cleanup.addCancellableTimer(() => {
      const keyword = searchKeyword.value.trim()
      if (keyword.length >= minLength || keyword.length === 0) {
        void callback(keyword)
      }
      timer = null
    }, delay)
  }

  /**
   * 立即搜索（不防抖）
   */
  const searchImmediate = () => {
    if (timer !== null) {
      timer.cancel()
      timer = null
    }
    const keyword = searchKeyword.value.trim()
    if (keyword.length >= minLength || keyword.length === 0) {
      void callback(keyword)
    }
  }

  /**
   * 清空搜索
   */
  const clearSearch = () => {
    if (timer !== null) {
      timer.cancel()
      timer = null
    }
    searchKeyword.value = ''
  }

  // 监听搜索关键词变化
  watch(searchKeyword, () => {
    executeSearch()
  })

  return {
    searchKeyword,
    executeSearch,
    searchImmediate,
    clearSearch,
  }
}

export default useDebounceSearch
