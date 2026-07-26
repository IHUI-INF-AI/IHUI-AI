import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { mergeMessages, translate, resolveList } from '@ihui/i18n/loader'
import type { Locale, Messages } from '@ihui/i18n/types'
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

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = Taro.getStorageSync('lang')
    return LOCALES.includes(stored) ? (stored as Locale) : 'zh-CN'
  })

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    Taro.setStorageSync('lang', l)
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
