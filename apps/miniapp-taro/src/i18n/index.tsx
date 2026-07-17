import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import Taro from '@tarojs/taro'
import zhCN from './zh-CN'
import en from './en'
import ja from './ja'
import ko from './ko'
import zhTW from './zh-TW'

export type Locale = 'zh-CN' | 'en' | 'ja' | 'ko' | 'zh-TW'

type Dict = typeof zhCN

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>> | T[P]
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P]
}

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

function mergeDict(base: Dict, override: DeepPartial<Dict>): Dict {
  const result = { ...base } as Record<string, unknown>
  ;(Object.keys(override) as Array<keyof Dict>).forEach((key) => {
    const val = override[key]
    const baseVal = result[key as string]
    if (
      val !== undefined &&
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key as string] = mergeDict(baseVal as Dict, val as DeepPartial<Dict>)
    } else if (val !== undefined) {
      result[key as string] = val
    }
  })
  return result as Dict
}

function getDict(locale: Locale): Dict {
  switch (locale) {
    case 'en':
      return en as Dict
    case 'ja':
      return mergeDict(zhCN, ja as DeepPartial<Dict>)
    case 'ko':
      return mergeDict(zhCN, ko as DeepPartial<Dict>)
    case 'zh-TW':
      return mergeDict(zhCN, zhTW as DeepPartial<Dict>)
    default:
      return zhCN
  }
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
