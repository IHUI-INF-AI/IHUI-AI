import { logger } from '../utils/logger'
import { ref, watch, computed } from 'vue'
import i18n, { setLanguage } from '../locales/index'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
// 支持的语言类型：中文、英文、日文、韩文
export type Language =
  | 'zh-CN' // 简体中文
  | 'zh-TW' // 繁体中文
  | 'en' // 英语
  | 'ja' // 日语
  | 'ko' // 韩语

// 当前语言状态
const currentLang = ref<Language>('zh-CN')

// 支持的语言列表及其显示名称
export const supportedLanguages: Record<Language, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
}

// 语言代码映射（浏览器语言到系统语言）
const languageMap: Record<string, Language> = {
  zh: 'zh-CN',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'zh-HK': 'zh-TW',
  'zh-MO': 'zh-TW',
  en: 'en',
  'en-US': 'en',
  'en-GB': 'en',
  ja: 'ja',
  'ja-JP': 'ja',
  ko: 'ko',
  'ko-KR': 'ko',
}

// 检查本地存储或浏览器语言设置
const initializeLanguage = () => {
  try {
    // 检查 localStorage 中是否有保存的语言设置 - 使用统一的存储工具
    const savedLanguage = StorageManager.getItem<Language>(STORAGE_KEYS.LANGUAGE)
    if (savedLanguage && savedLanguage in supportedLanguages) {
      currentLang.value = savedLanguage
      return
    }

    // 获取浏览器默认语言
    const browserLang = navigator.language
    const langCode = browserLang.split('-')[0]
    const mappedLang = languageMap[browserLang] || languageMap[langCode] || 'zh-CN'
    currentLang.value = mappedLang
  } catch (error) {
    logger.error('Language initialization failed:', error)
    currentLang.value = 'zh-CN'
  }
}

// 初始化语言
initializeLanguage()

// 同步Vue I18n的locale与currentLang
if (i18n.global) {
  const i18nGlobal = i18n.global as { locale: { value: string } | string }
  if (typeof i18nGlobal.locale === 'object' && 'value' in i18nGlobal.locale) {
    i18nGlobal.locale.value = currentLang.value
  } else {
    ;(i18nGlobal as { locale: string }).locale = currentLang.value
  }

  watch(
    () => currentLang.value,
    (newLang: Language) => {
      if (i18n.global) {
        const i18nGlobal = i18n.global as { locale: { value: string } | string }
        if (typeof i18nGlobal.locale === 'object' && 'value' in i18nGlobal.locale) {
          i18nGlobal.locale.value = newLang
        } else {
          ;(i18nGlobal as { locale: string }).locale = newLang
        }
      }
    }
  )

  // 监听Vue I18n的locale变化，同步到currentLang
  watch(
    () => {
      // 获取当前locale，处理不同版本的API
      const locale = i18n.global.locale
      if (typeof locale === 'object' && locale !== null && 'value' in locale) {
        return locale.value
      } else {
        return locale as string
      }
    },
    (newLocale: string) => {
      if (newLocale && newLocale in supportedLanguages) {
        currentLang.value = newLocale as Language
      }
    }
  )
}

// 翻译函数 - 委托给 vue-i18n, 避免静态 import 完整语言包
export const t = (key: string, params?: Record<string, string | number>): string => {
  if (typeof key !== 'string') return String(key)
  try {
    const globalT = (i18n.global as { t: (k: string, p?: Record<string, unknown>) => string }).t
    return params ? globalT(key, params) : globalT(key)
  } catch {
    return key
  }
}

// 切换语言函数
export const switchLanguage = (lang: Language): void => {
  try {
    currentLang.value = lang
    // 调用统一的语言设置，确保 i18n、localStorage 与文档属性同步更新
    void setLanguage(lang)
    // 使用统一的存储工具（仍保留，保证旧路径兼容）
    StorageManager.setItem(STORAGE_KEYS.LANGUAGE, lang)
  } catch (error) {
    logger.error('Language switch failed:', error)
  }
}

// 获取当前语言
export const getCurrentLanguage = computed(() => currentLang.value)

// 默认导出，方便在组件中使用
const langPlugin = {
  t,
  switchLanguage,
  currentLang: getCurrentLanguage,
}

// 提供一个useLang函数，符合Vue 3 composition API的使用风格
export function useLang() {
  return {
    t,
    switchLanguage,
    currentLang: getCurrentLanguage,
  }
}

export default langPlugin
