import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
// 2026-07-25 i18n 单一来源:翻译文件迁移到 @ihui/i18n/messages/mobile-rn/
import zhCN from '@ihui/i18n/messages/mobile-rn/zh-CN.json'
import en from '@ihui/i18n/messages/mobile-rn/en.json'
import ja from '@ihui/i18n/messages/mobile-rn/ja.json'
import ko from '@ihui/i18n/messages/mobile-rn/ko.json'
import zhTW from '@ihui/i18n/messages/mobile-rn/zh-TW.json'

export type Locale = 'zh-CN' | 'en' | 'ja' | 'ko' | 'zh-TW'

type Messages = Record<string, unknown>

const STORAGE_KEY = 'ihui_locale'

function isMessagesObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const messages: Record<Locale, Messages> = {
  'zh-CN': zhCN as Messages,
  en: en as Messages,
  ja: { ...zhCN, ...ja } as Messages,
  ko: { ...zhCN, ...ko } as Messages,
  'zh-TW': { ...zhCN, ...zhTW } as Messages,
}

export { messages }

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => Promise<void>
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function getValueByPath(obj: unknown, path: string): string | undefined {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (!isMessagesObject(current)) return undefined
    current = current[part]
  }
  return typeof current === 'string' ? current : undefined
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh-CN')

  useEffect(() => {
    void (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY)
      if (stored && stored in messages) {
        setLocaleState(stored as Locale)
      }
    })()
  }, [])

  const setLocale = async (next: Locale) => {
    await AsyncStorage.setItem(STORAGE_KEY, next)
    setLocaleState(next)
  }

  const t = (key: string, params?: Record<string, string | number>): string => {
    const active = messages[locale] ?? zhCN
    let value = getValueByPath(active, key) ?? getValueByPath(zhCN, key) ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
      }
    }
    return value
  }

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
