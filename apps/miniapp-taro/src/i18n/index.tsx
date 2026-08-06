import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { mergeMessages, translate, resolveList } from '@ihui/i18n/loader'
import type { Locale, Messages } from '@ihui/i18n/types'
import { LOCALE_KEY } from '@/constants/storage'
// 2026-07-25 i18n 单一来源:翻译文件迁移到 @ihui/i18n/messages/{shared,miniapp-taro}/
// 2026-07-26 loader.getValueByPath 扩展为返回 unknown,resolveList 支持 fallback,
// 删除本地 mergeDict/resolveRaw,完全复用 @ihui/i18n/loader
import sharedZhCN from '@ihui/i18n/messages/shared/zh-CN.json'
import sharedEn from '@ihui/i18n/messages/shared/en.json'
import sharedJa from '@ihui/i18n/messages/shared/ja.json'
import sharedKo from '@ihui/i18n/messages/shared/ko.json'
import sharedZhTW from '@ihui/i18n/messages/shared/zh-TW.json'
import miniappZhCN from '@ihui/i18n/messages/miniapp-taro/zh-CN.json'
import miniappEn from '@ihui/i18n/messages/miniapp-taro/en.json'
import miniappJa from '@ihui/i18n/messages/miniapp-taro/ja.json'
import miniappKo from '@ihui/i18n/messages/miniapp-taro/ko.json'
import miniappZhTW from '@ihui/i18n/messages/miniapp-taro/zh-TW.json'

export type { Locale }

interface I18nContextValue {
  locale: Locale
  t: (key: string, params?: Record<string, string | number>) => string
  tList: (key: string) => string[]
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh-CN',
  t: (key) => key,
  tList: () => [],
  setLocale: () => {},
})

// 各 locale 的合并 messages:shared 作 base,miniapp-taro 覆盖(端 key 优先)
const messages: Record<Locale, Messages> = {
  'zh-CN': mergeMessages(sharedZhCN as Messages, miniappZhCN as Messages),
  en: mergeMessages(sharedEn as Messages, miniappEn as Messages),
  ja: mergeMessages(sharedJa as Messages, miniappJa as Messages),
  ko: mergeMessages(sharedKo as Messages, miniappKo as Messages),
  'zh-TW': mergeMessages(sharedZhTW as Messages, miniappZhTW as Messages),
}

const LOCALES: Locale[] = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

// 模块级当前 locale(供非组件代码使用,如 utils/platform 中的 Taro.showToast 提示文案)
// I18nProvider 挂载时从 storage 同步,setLocale 时同步更新
let currentLocale: Locale = 'zh-CN'

/**
 * 全局 t 函数(供非组件代码使用,如 utils/pay.ts、platform/pay.ts 等)
 * - 组件内优先用 useI18n() 获取响应式 t
 * - utils/platform 等非组件代码用本函数
 * - locale 切换由 I18nProvider 同步到 currentLocale
 */
export function t(key: string, params?: Record<string, string | number>): string {
  return translate(messages[currentLocale], key, { fallback: messages['zh-CN'], params })
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = Taro.getStorageSync(LOCALE_KEY)
    currentLocale = LOCALES.includes(stored) ? (stored as Locale) : 'zh-CN'
    return currentLocale
  })

  const setLocale = useCallback((l: Locale) => {
    currentLocale = l
    setLocaleState(l)
    Taro.setStorageSync(LOCALE_KEY, l)
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return translate(messages[locale], key, { fallback: messages['zh-CN'], params })
    },
    [locale],
  )

  const tList = useCallback(
    (key: string) => resolveList(messages[locale], key, messages['zh-CN']),
    [locale],
  )

  return (
    <I18nContext.Provider value={{ locale, t, tList, setLocale }}>{children}</I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

/**
 * 带回退的翻译 hook(替代各页面/组件内联的 tt 函数)
 *
 * - 若 key 存在翻译,返回翻译值(支持 {placeholder} 参数替换)
 * - 若 key 不存在,返回 fb 回退文案(支持 {placeholder} 参数替换)
 *
 * 用 useCallback 包装避免每次渲染重建,消除 react-hooks/exhaustive-deps 警告
 */
export function useTt() {
  const { t } = useI18n()
  return useCallback(
    (k: string, fb: string, params?: Record<string, string | number>) => {
      const v = params ? t(k, params) : t(k)
      if (v !== k) return v
      if (!params) return fb
      return fb.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
    },
    [t],
  )
}
