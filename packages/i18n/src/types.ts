// @ihui/i18n 类型定义 — 4 端(web/extension/miniapp-taro/mobile-rn)共享

export type Locale = 'zh-CN' | 'en' | 'ja' | 'ko' | 'zh-TW'

export const SUPPORTED_LOCALES: Locale[] = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

export const DEFAULT_LOCALE: Locale = 'zh-CN'

export type Messages = Record<string, unknown>

export type LocaleMessages = Record<Locale, Messages>

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}
