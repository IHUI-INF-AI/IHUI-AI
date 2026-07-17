import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import zhCN from './messages/zh-CN'
import en from './messages/en'
import ja from './messages/ja'
import ko from './messages/ko'
import zhTW from './messages/zh-TW'

export type Locale = 'zh-CN' | 'en' | 'ja' | 'ko' | 'zh-TW'

type Messages = Record<string, Record<string, string>>

const STORAGE_KEY = 'ihui_locale'

const messages: Record<Locale, Messages> = {
  'zh-CN': zhCN as Messages,
  en: en as Messages,
  ja: { ...zhCN, ...ja } as Messages,
  ko: { ...zhCN, ...ko } as Messages,
  'zh-TW': { ...zhCN, ...zhTW } as Messages,
}

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => Promise<void>
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function getValueByPath(obj: unknown, path: string): string | undefined {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
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
