import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react'
import zhCN from './messages/zh-CN'
import en from './messages/en'
import ja from './messages/ja'
import ko from './messages/ko'
import zhTW from './messages/zh-TW'

export type Locale = 'zh-CN' | 'en' | 'ja' | 'ko' | 'zh-TW'

const STORAGE_KEY = 'ihui_locale'
const DEFAULT_LOCALE: Locale = 'zh-CN'
export const LOCALES: Locale[] = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

type Messages = typeof zhCN

const messages: Record<Locale, Messages> = {
  'zh-CN': zhCN,
  en,
  ja,
  ko,
  'zh-TW': zhTW,
}

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function getValue(obj: unknown, path: string): string | undefined {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

function format(text: string, params?: Record<string, string | number>): string {
  if (!params) return text
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name] ?? ''))
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    return LOCALES.find((l) => l === saved) ?? DEFAULT_LOCALE
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale)
  }, [locale])

  const setLocale = (next: Locale) => {
    if (LOCALES.includes(next)) {
      setLocaleState(next)
    }
  }

  const t = useMemo(() => {
    return (key: string, params?: Record<string, string | number>) => {
      const current = messages[locale] ?? messages[DEFAULT_LOCALE]
      let text = getValue(current, key)
      if (text === undefined) {
        text = getValue(messages[DEFAULT_LOCALE], key)
      }
      if (text === undefined) return key
      return format(text, params)
    }
  }, [locale])

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t])

  return createElement(I18nContext.Provider, { value }, children)
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return ctx
}
