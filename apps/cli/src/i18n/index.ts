import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type Locale = 'zh-CN' | 'en' | 'ja' | 'ko' | 'zh-TW'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MESSAGES_DIR = join(__dirname, '../../../../packages/i18n/messages/cli')

type Messages = Record<string, unknown>

function loadMessages(locale: string): Messages {
  try {
    return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8'))
  } catch {
    return {}
  }
}

const baseMessages: Record<Locale, Messages> = {
  'zh-CN': loadMessages('zh-CN'),
  en: loadMessages('en'),
  ja: loadMessages('ja'),
  ko: loadMessages('ko'),
  'zh-TW': loadMessages('zh-TW'),
}

let activeLocale: Locale = getLocale()
function normalizeLocale(raw: string): Locale {
  const lower = raw.toLowerCase()
  if (lower === 'zh' || lower === 'zh-cn') return 'zh-CN'
  if (lower === 'zh-tw' || lower === 'zh-hk') return 'zh-TW'
  if (lower === 'en' || lower.startsWith('en-')) return 'en'
  if (lower === 'ja' || lower.startsWith('ja-')) return 'ja'
  if (lower === 'ko' || lower.startsWith('ko-')) return 'ko'
  return 'zh-CN'
}

export function getLocale(): Locale {
  if (process.env.IHUI_LOCALE) {
    return normalizeLocale(process.env.IHUI_LOCALE)
  }
  return normalizeLocale(Intl.DateTimeFormat().resolvedOptions().locale)
}

export function setLocale(locale: Locale): void {
  activeLocale = locale
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>,
): T {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(base)) {
    const baseValue = base[key]
    const overrideValue = override[key]
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMerge(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>,
      )
    } else {
      result[key] = overrideValue !== undefined ? overrideValue : baseValue
    }
  }
  return result as T
}
function getNestedValue(obj: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (!isPlainObject(current)) return undefined
    current = current[part]
  }
  return typeof current === 'string' ? current : undefined
}

export function t(key: string, params?: Record<string, string | number>): string {
  const active = deepMerge(
    baseMessages['zh-CN'] as unknown as Record<string, unknown>,
    baseMessages[activeLocale] as unknown as Record<string, unknown>,
  )
  const text = getNestedValue(active, key)
  if (text === undefined) {
    return key
  }
  if (!params) return text
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) =>
    String(params[name] ?? `{{${name}}}`),
  )
}

export const i18n = {
  getLocale,
  setLocale,
  t,
}