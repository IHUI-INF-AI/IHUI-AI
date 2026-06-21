/**
 * 搜索历史 Composable
 * 使用 StorageManager 存储和管理搜索历史
 */

import { ref, computed, watch } from 'vue'
import { StorageManager } from '@/utils/storage'
import { logger } from '@/utils/logger'

export interface UseSearchHistoryOptions {
  /** 存储键名（用于区分不同页面的搜索历史） */
  storageKey?: string
  /** 最大历史记录数 */
  maxItems?: number
  /** 是否自动保存 */
  autoSave?: boolean
}

/**
 * 搜索历史 Composable
 */
export function useSearchHistory(options: UseSearchHistoryOptions = {}) {
  const { storageKey = 'search-history', maxItems = 10, autoSave = true } = options

  // 从 StorageManager 加载历史记录
  const loadHistory = (): string[] => {
    try {
      const stored = StorageManager.getItem<string>(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        return Array.isArray(parsed) ? parsed : []
      }
      return []
    } catch (error) {
      logger.error('Failed to load search history:', error)
      return []
    }
  }

  // 保存历史记录到 localStorage
  const saveHistory = (history: string[]): void => {
    try {
      StorageManager.setItem(storageKey, JSON.stringify(history))
    } catch (error) {
      logger.error('Failed to save search history:', error)
    }
  }

  // 历史记录列表
  const history = ref<string[]>(loadHistory())

  // 过滤后的历史记录（去重、限制数量）
  const filteredHistory = computed(() => {
    const unique = Array.from(new Set(history.value))
    return unique.slice(0, maxItems)
  })

  // 是否有历史记录
  const hasHistory = computed(() => filteredHistory.value.length > 0)

  /**
   * 添加到历史记录
   */
  const addToHistory = (keyword: string): void => {
    if (!keyword || !keyword.trim()) return

    const trimmed = keyword.trim()

    // 移除重复项
    const newHistory = history.value.filter(item => item !== trimmed)

    // 添加到开头
    newHistory.unshift(trimmed)

    // 限制数量
    const limited = newHistory.slice(0, maxItems)

    history.value = limited

    if (autoSave) {
      saveHistory(limited)
    }
  }

  /**
   * 从历史记录中移除
   */
  const removeFromHistory = (keyword: string): void => {
    const newHistory = history.value.filter(item => item !== keyword)
    history.value = newHistory

    if (autoSave) {
      saveHistory(newHistory)
    }
  }

  /**
   * 清除所有历史记录
   */
  const clearHistory = (): void => {
    history.value = []

    if (autoSave) {
      saveHistory([])
    }
  }

  /**
   * 获取热门搜索（可以根据需要扩展）
   */
  const getHotSearches = (): string[] => {
    // 这里可以返回预设的热门搜索
    // 或者根据历史记录统计热门关键词
    return []
  }

  // 监听历史记录变化，自动保存
  watch(
    () => history.value,
    newHistory => {
      if (autoSave) {
        saveHistory(newHistory)
      }
    },
    { deep: true }
  )

  return {
    history: filteredHistory,
    hasHistory,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getHotSearches,
  }
}
