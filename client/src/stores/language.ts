import { defineStore } from 'pinia'
import { ref } from 'vue'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { setLanguage as applyI18nLanguage } from '@/locales'

export const useLanguageStore = defineStore('language', () => {
  const currentLanguage = ref('zh-CN')

  async function setLanguage(language: string) {
    currentLanguage.value = language
    StorageManager.setItem(STORAGE_KEYS.LANGUAGE, language)
    await applyI18nLanguage(language)
  }

  async function initLanguage() {
    // P21: 优先从 persist 插件恢复 (pinia-language key), fallback 到旧 STORAGE_KEYS.LANGUAGE
    const persisted = StorageManager.getItem<string>('pinia-language')
    let savedLanguage: string | undefined
    if (persisted) {
      try {
        const parsed = JSON.parse(persisted) as { currentLanguage?: string }
        savedLanguage = parsed.currentLanguage
      } catch {
        // 兼容旧版直接存储语言字符串的场景
        savedLanguage = persisted
      }
    } else {
      savedLanguage = StorageManager.getItem<string>(STORAGE_KEYS.LANGUAGE) ?? undefined
    }
    if (savedLanguage) {
      currentLanguage.value = savedLanguage
    } else {
      const browserLanguage = navigator.language
      if (browserLanguage.startsWith('zh')) {
        currentLanguage.value = 'zh-CN'
      } else {
        currentLanguage.value = 'en'
      }
    }
    await applyI18nLanguage(currentLanguage.value)
  }

  return {
    currentLanguage,
    setLanguage,
    initLanguage,
  }
}, {
  // P21: 启用 Pinia 持久化插件 (仅持久化 currentLanguage, 跨标签页同步)
  persist: {
    paths: ['currentLanguage'],
    key: 'pinia-language',
    crossTab: true,
    debounce: 200,
  },
})
