// @ihui/i18n loader 工具 — 各端 I18nProvider 共享的翻译查找 + 占位符替换

import type { Locale, Messages } from './types'

export function getValueByPath(obj: unknown, path: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return typeof current === 'string' ? current : undefined
}

export interface TranslateOptions {
  fallback?: Messages
  params?: Record<string, string | number>
}

export function translate(messages: Messages, key: string, options?: TranslateOptions): string {
  let value = getValueByPath(messages, key)
  if (value === undefined && options?.fallback) {
    value = getValueByPath(options.fallback, key)
  }
  if (value === undefined) return key
  if (!options?.params) return value
  const params = options.params
  return value
    .replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
      const v = params[name]
      return v !== undefined ? String(v) : ''
    })
    .replace(/\{(\w+)\}/g, (_, name: string) => {
      const v = params[name]
      return v !== undefined ? String(v) : ''
    })
}

export function resolveList(messages: Messages, key: string): string[] {
  const value = getValueByPath(messages, key)
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export function mergeMessages(base: Messages, override: Messages): Messages {
  const result: Messages = { ...base }
  for (const key of Object.keys(override)) {
    const val = override[key]
    const baseVal = result[key]
    if (
      val &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      baseVal &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = mergeMessages(baseVal as Messages, val as Messages)
    } else if (val !== undefined) {
      result[key] = val
    }
  }
  return result
}

export function getMessagesForLocale(locale: Locale, messages: Record<Locale, Messages>): Messages {
  return messages[locale] ?? messages['zh-CN']
}
