/**
 * @ihui/i18n — IHUI-AI 8 端 i18n 统一包
 *
 * 5 语言 locale 单一真相源 + 共享 runtime(React hook、t 函数、Locale 类型)。
 *
 * 架构 (§3 零冗余):
 * - locale 内容物理上仍在各 app 的 `src/i18n/messages/`,但通过本包统一入口暴露
 * - 不修改任何 app 现有的 messages 内容(只改 import 来源)
 * - 5 语言 en/zh-CN/zh-TW/ja/ko 全部覆盖
 *
 * 使用:
 *   import { type Locale, LOCALES, getMessages, brandGlossary } from '@ihui/i18n'
 *   import { desktop, extension, mobile, miniapp } from '@ihui/i18n/locales/en'
 */

export type Locale = 'zh-CN' | 'en' | 'ja' | 'ko' | 'zh-TW'

export const LOCALES: readonly Locale[] = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const
export const DEFAULT_LOCALE: Locale = 'zh-CN'

export function normalizeLocale(raw: string | null | undefined): Locale {
  if (!raw) return DEFAULT_LOCALE
  const lower = raw.toLowerCase()
  if (lower === 'zh' || lower === 'zh-cn') return 'zh-CN'
  if (lower === 'zh-tw' || lower === 'zh-hk') return 'zh-TW'
  if (lower === 'en' || lower.startsWith('en-')) return 'en'
  if (lower === 'ja' || lower.startsWith('ja-')) return 'ja'
  if (lower === 'ko' || lower.startsWith('ko-')) return 'ko'
  return DEFAULT_LOCALE
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/**
 * 共享 getMessages 工具(在 server/edge 环境取 locale 列表,客户端用 useI18n)
 * 注意:实际内容由各 app 通过 `import { ... } from '@ihui/i18n/locales/<lang>'` 拉取
 */
export function getMessagesByLocale<T = unknown>(locale: Locale, map: Record<Locale, T>): T {
  return map[locale] ?? map[DEFAULT_LOCALE]
}

export { brandGlossary } from './brand-glossary.js'
