import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import Taro from '@tarojs/taro'
import zhCN from './zh-CN'
import en from './en'

export type Locale = 'zh-CN' | 'en'

type Dict = typeof zhCN

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

function resolve(obj: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object' && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k]
    }
    return undefined
  }, obj)
}

function getDict(locale: Locale): Dict {
  return locale === 'en' ? (en as Dict) : zhCN
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = Taro.getStorageSync('lang')
    return stored === 'en' ? 'en' : 'zh-CN'
  })

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    Taro.setStorageSync('lang', l)
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const value = resolve(getDict(locale), key)
      let str = typeof value === 'string' ? value : key
      if (params) {
        str = str.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''))
      }
      return str
    },
    [locale],
  )

  const tList = useCallback(
    (key: string) => {
      const value = resolve(getDict(locale), key)
      return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
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
