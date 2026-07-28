import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { LOCALE_STORAGE_KEY } from '@ihui/shared/constants'
import { mergeMessages, translate, getValueByPath } from '@ihui/i18n/loader'
import type { Locale, Messages } from '@ihui/i18n/types'
import { createAsyncStorageTransport } from '../stores/storage-adapter'
// shared 通用 + mobile-rn 端 override,mergeMessages 深合并修复浅 spread bug
import sharedZhCN from '@ihui/i18n/messages/shared/zh-CN.json'
import sharedEn from '@ihui/i18n/messages/shared/en.json'
import sharedJa from '@ihui/i18n/messages/shared/ja.json'
import sharedKo from '@ihui/i18n/messages/shared/ko.json'
import sharedZhTW from '@ihui/i18n/messages/shared/zh-TW.json'
import zhCN from '@ihui/i18n/messages/mobile-rn/zh-CN.json'
import en from '@ihui/i18n/messages/mobile-rn/en.json'
import ja from '@ihui/i18n/messages/mobile-rn/ja.json'
import ko from '@ihui/i18n/messages/mobile-rn/ko.json'
import zhTW from '@ihui/i18n/messages/mobile-rn/zh-TW.json'

export type { Locale }

const STORAGE_KEY_LEGACY = 'ihui_locale'

// 单例 transport(零运行时开销,AsyncStorage 静态绑定)
const transport = createAsyncStorageTransport()

// ja/ko/zh-TW 保留 zhCN 兜底深合并(原浅 spread 升级为深合并,修复嵌套 namespace 翻译丢失)
const messages: Record<Locale, Messages> = {
  'zh-CN': mergeMessages(sharedZhCN as Messages, zhCN as Messages),
  en: mergeMessages(sharedEn as Messages, en as Messages),
  ja: mergeMessages(sharedJa as Messages, mergeMessages(zhCN as Messages, ja as Messages)),
  ko: mergeMessages(sharedKo as Messages, mergeMessages(zhCN as Messages, ko as Messages)),
  'zh-TW': mergeMessages(sharedZhTW as Messages, mergeMessages(zhCN as Messages, zhTW as Messages)),
}

export { messages, getValueByPath }

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => Promise<void>
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh-CN')

  useEffect(() => {
    void (async () => {
      // 迁移旧下划线 key 到新连字符 key
      const legacyValue = await transport.getItem(STORAGE_KEY_LEGACY)
      if (legacyValue !== null) {
        const newValue = await transport.getItem(LOCALE_STORAGE_KEY)
        if (newValue === null) {
          await transport.setItem(LOCALE_STORAGE_KEY, legacyValue)
        }
        await transport.removeItem(STORAGE_KEY_LEGACY)
      }
      const stored = await transport.getItem(LOCALE_STORAGE_KEY)
      if (stored && stored in messages) {
        setLocaleState(stored as Locale)
      }
    })()
  }, [])

  const setLocale = async (next: Locale) => {
    await transport.setItem(LOCALE_STORAGE_KEY, next)
    setLocaleState(next)
  }

  const t = (key: string, params?: Record<string, string | number>): string =>
    translate(messages[locale], key, { fallback: messages['zh-CN'], params })

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
