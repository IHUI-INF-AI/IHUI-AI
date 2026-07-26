import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { mergeMessages, translate } from '@ihui/i18n/loader'
import type { Locale, Messages } from '@ihui/i18n/types'
// 2026-07-25 i18n 单一来源:翻译文件迁移到 @ihui/i18n/messages/{shared,miniapp-taro}/
// 阶段 2:用 mergeMessages 合并 shared + miniapp-taro(端 key 覆盖 shared,功能无变化)
// 删除本地 mergeDict/resolve,改用 @ihui/i18n/loader 的 mergeMessages + translate
// 注:loader.getValueByPath 仅返回 string,无法解析数组型文案,
// tList 保留本地数组解析以保持对外 API 行为不变(loader API 后续扩展后可切换)
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

/** 按点分路径查找原始值(数组型文案用;loader.getValueByPath 仅返回 string 无法处理数组) */
function resolveRaw(obj: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object' && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k]
    }
    return undefined
  }, obj)
}

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
    (key: string) => {
      const value = resolveRaw(messages[locale], key)
      if (Array.isArray(value)) {
        return value.filter((v): v is string => typeof v === 'string')
      }
      // fallback 到 zh-CN(保留原 mergeDict(zhCN, partial) 行为)
      const fallback = resolveRaw(messages['zh-CN'], key)
      return Array.isArray(fallback)
        ? fallback.filter((v): v is string => typeof v === 'string')
        : []
    },
    [locale],
  )

  return (
    <I18nContext.Provider value={{ locale, t, tList, setLocale }}>{children}</I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
