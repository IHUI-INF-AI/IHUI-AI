 
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getI18nGlobal } from '@/locales'

/**
 * 加载状态管理Store
 * 用于统一管理全局和局部的加载状态
 */
export const useLoadingStore = defineStore('loading', () => {
  // 全局加载状态 - 初始化为false，确保不会默认显示加载
  const globalLoading = ref(false)
  interface _I18nGlobal {
    t: (key: string) => string
  }
  const i18nInstance = getI18nGlobal()
  const globalLoadingText = ref(i18nInstance?.t('common.loading') || '加载中...')
  
  // 初始化时确保加载状态为false
  if (typeof window !== 'undefined') {
    // 在浏览器环境下，确保初始状态为false
    globalLoading.value = false
  }

  // 局部加载状态（按key管理）
  const localLoadings = ref<Record<string, boolean>>({})
  const localLoadingTexts = ref<Record<string, string>>({})

  // 计算属性：是否有任何加载状态
  const isLoading = computed(() => {
    return globalLoading.value || Object.values(localLoadings.value).some(loading => loading)
  })

  // 全局加载控制
  const setGlobalLoading = (loading: boolean, text?: string) => {
    globalLoading.value = loading
    if (text !== undefined) {
      globalLoadingText.value = text
    }
  }

  const startGlobalLoading = (text?: string) => {
    setGlobalLoading(true, text)
  }

  const stopGlobalLoading = () => {
    setGlobalLoading(false)
  }

  // 局部加载控制
  const setLocalLoading = (key: string, loading: boolean, text?: string) => {
    if (loading) {
      localLoadings.value[key] = true
      if (text !== undefined) {
        localLoadingTexts.value[key] = text
      }
    } else {
      delete localLoadings.value[key]
      if (text !== undefined) {
        delete localLoadingTexts.value[key]
      }
    }
  }

  const startLocalLoading = (key: string, text?: string) => {
    setLocalLoading(key, true, text)
  }

  const stopLocalLoading = (key: string) => {
    setLocalLoading(key, false)
  }

  // 检查局部加载状态
  const isLocalLoading = (key: string) => {
    return localLoadings.value[key] || false
  }

  const getLocalLoadingText = (key: string) => {
    const i18nInstance = getI18nGlobal()
    return localLoadingTexts.value[key] || i18nInstance?.t('common.loading') || '加载中...'
  }

  // 清除所有加载状态
  const clearAllLoading = () => {
    globalLoading.value = false
    localLoadings.value = {}
    localLoadingTexts.value = {}
  }

  // 批量设置局部加载状态
  const setBatchLocalLoading = (keys: string[], loading: boolean, text?: string) => {
    keys.forEach(key => {
      setLocalLoading(key, loading, text)
    })
  }

  return {
    // 状态
    globalLoading,
    globalLoadingText,
    localLoadings,
    localLoadingTexts,
    isLoading,

    // 全局加载方法
    setGlobalLoading,
    startGlobalLoading,
    stopGlobalLoading,

    // 局部加载方法
    setLocalLoading,
    startLocalLoading,
    stopLocalLoading,
    isLocalLoading,
    getLocalLoadingText,

    // 工具方法
    clearAllLoading,
    setBatchLocalLoading,
  }
})
