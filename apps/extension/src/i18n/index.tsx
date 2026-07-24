import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import zhCN from './messages/zh-CN.json'
import en from './messages/en.json'
import ja from './messages/ja.json'
import ko from './messages/ko.json'
import zhTW from './messages/zh-TW.json'

export type Locale = 'zh-CN' | 'en' | 'ja' | 'ko' | 'zh-TW'

const LOCALE_STORAGE_KEY = 'ihui_locale'
const DEFAULT_LOCALE: Locale = 'zh-CN'
const SUPPORTED_LOCALES: Locale[] = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

type Messages = Record<Locale, Record<string, Record<string, string>>>

const messages: Messages = {
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

function isLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale)
}

function getFallbackValue(obj: unknown, key: string): string | undefined {
  const parts = key.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return typeof current === 'string' ? current : undefined
}

async function readLocale(): Promise<Locale> {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      const result = await browser.storage.local.get(LOCALE_STORAGE_KEY)
      const value = result[LOCALE_STORAGE_KEY]
      if (typeof value === 'string' && isLocale(value)) return value
    }
  } catch {
    // ignore and fall through
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const value = localStorage.getItem(LOCALE_STORAGE_KEY)
      if (value && isLocale(value)) return value
    }
  } catch {
    // ignore
  }
  return DEFAULT_LOCALE
}

async function writeLocale(locale: Locale): Promise<void> {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      await browser.storage.local.set({ [LOCALE_STORAGE_KEY]: locale })
      return
    }
  } catch {
    // ignore and fall through
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    }
  } catch {
    // ignore
  }
}

interface I18nProviderProps {
  children: ReactNode
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const stored = await readLocale()
      if (!cancelled) {
        setLocaleState(stored)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    void writeLocale(next)
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let text = getFallbackValue(messages[locale], key)
      if (text === undefined && locale !== DEFAULT_LOCALE) {
        text = getFallbackValue(messages[DEFAULT_LOCALE], key)
      }
      if (text === undefined) return key
      if (!params) return text
      return text.replace(/\{\{(\w+)\}\}/g, (_, name) => {
        const value = params[name]
        return value !== undefined ? String(value) : ''
      })
    },
    [locale],
  )

  const value: I18nContextValue = {
    locale,
    setLocale,
    t,
  }

  // 2026-07-23 修复:原代码 !ready 时 return null → popup 整个空白(用户反馈"啥也没出来")
  // 改为渲染 children + 默认 locale 的 t,确保 popup/sidepanel 始终有内容
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
