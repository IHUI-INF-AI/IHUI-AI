// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { mergeMessages, translate } from '@ihui/i18n/loader'
import type { Locale, Messages } from '@ihui/i18n/types'
// 2026-07-25 i18n 单一来源:翻译文件迁移到 @ihui/i18n/messages/extension/
// 2026-07-26 改用 @ihui/i18n/loader 的 mergeMessages + translate,加载 shared + extension 合并集
import sharedZhCN from '@ihui/i18n/messages/shared/zh-CN.json'
import sharedEn from '@ihui/i18n/messages/shared/en.json'
import sharedJa from '@ihui/i18n/messages/shared/ja.json'
import sharedKo from '@ihui/i18n/messages/shared/ko.json'
import sharedZhTW from '@ihui/i18n/messages/shared/zh-TW.json'
import extZhCN from '@ihui/i18n/messages/extension/zh-CN.json'
import extEn from '@ihui/i18n/messages/extension/en.json'
import extJa from '@ihui/i18n/messages/extension/ja.json'
import extKo from '@ihui/i18n/messages/extension/ko.json'
import extZhTW from '@ihui/i18n/messages/extension/zh-TW.json'

export type { Locale }

const LOCALE_STORAGE_KEY = 'ihui_locale'
const DEFAULT_LOCALE: Locale = 'zh-CN'
const SUPPORTED_LOCALES: Locale[] = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

const messages: Record<Locale, Messages> = {
  'zh-CN': mergeMessages(sharedZhCN, extZhCN),
  en: mergeMessages(sharedEn, extEn),
  ja: mergeMessages(sharedJa, extJa),
  ko: mergeMessages(sharedKo, extKo),
  'zh-TW': mergeMessages(sharedZhTW, extZhTW),
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

async function readLocale(): Promise<Locale> {
  try {
    // WXT 0.21 无 browser 全局,统一用 chrome.storage.local
    // (与 background.ts 读同一键的存储区域一致)。
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(LOCALE_STORAGE_KEY)
      const value: unknown = result[LOCALE_STORAGE_KEY]
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
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [LOCALE_STORAGE_KEY]: locale })
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
      return translate(messages[locale], key, {
        fallback: messages[DEFAULT_LOCALE],
        params,
      })
    },
    [locale],
  )

  // 2026-10-25 定身:context value 只在「真正会变的东西」变化时才换新身份。
  // 母型缺陷原形(与 mobile-rn 同一具):value 是渲染期新建的字面量 ⇒ Provider 每渲染一次
  // 整个 context 就换一次身份 ⇒ 任何把 `t` 写进 effect 依赖的真实页面都会跟着重跑
  // (mobile-rn 实测形状 = 钱包页 [load] 重跑、getBalance 被真调第二次)。
  // 依赖数组里只放会改变行为的量:setLocale / t 自身已是 useCallback,只有 locale 变了 t 才换。
  // 回归锁见 tests/i18n-provider-value-identity.test.tsx(改前后红绿成对钉死)。
  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  // 2026-07-23 修复:原代码 !ready 时 return null → popup 整个空白(用户反馈"啥也没出来")
  // 改为渲染 children + 默认 locale 的 t,确保 popup/sidepanel 始终有内容
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
