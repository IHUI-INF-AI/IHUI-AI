// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui/i18n loader 工具 — 各端 I18nProvider 共享的翻译查找 + 占位符替换

import type { Locale, Messages } from './types.js'
import { formatIcu, hasIcuSyntax } from './icu.js'

/** 按点分路径查找原始值(支持 string / 对象 / 数组等任意类型) */
export function getValueByPath(obj: unknown, path: string): unknown {
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
  return current
}

export interface TranslateOptions {
  fallback?: Messages
  params?: Record<string, string | number>
  /** ICU plural/number 所依 locale;缺省 zh-CN */
  locale?: string
}

function interpolate(
  text: string,
  params: Record<string, string | number>,
  locale?: string,
): string {
  if (hasIcuSyntax(text)) return formatIcu(text, params, { locale })
  return text
    .replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
      const v = params[name]
      return v !== undefined ? String(v) : ''
    })
    .replace(/\{(\w+)\}/g, (_, name: string) => {
      const v = params[name]
      return v !== undefined ? String(v) : ''
    })
}

export function translate(messages: Messages, key: string, options?: TranslateOptions): string {
  let value = getValueByPath(messages, key)
  if (value === undefined && options?.fallback) {
    value = getValueByPath(options.fallback, key)
  }
  if (typeof value !== 'string') {
    if (!options?.params) return key
    // 当 key 未找到且有 params 时,对 key 本身做插值(如 t('hello {{name}}', {name:'IHUI'}))
    return interpolate(key, options.params, options.locale)
  }
  if (!options?.params) {
    // 无 params 也走一次 ICU:否则 plural/select 键在非 web 端会把语法原样吐成文案
    return hasIcuSyntax(value) ? formatIcu(value, {}, { locale: options?.locale }) : value
  }
  return interpolate(value, options.params, options.locale)
}

export function resolveList(messages: Messages, key: string, fallback?: Messages): string[] {
  const value = getValueByPath(messages, key)
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string')
  }
  if (fallback) {
    const fb = getValueByPath(fallback, key)
    if (Array.isArray(fb)) {
      return fb.filter((v): v is string => typeof v === 'string')
    }
  }
  return []
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

const DYNAMIC_LOCALES: readonly Locale[] = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

export type DynamicCopyPlan = {
  disposition: 'shown' | 'unjudged'
  source: 'remote' | 'packaged' | 'none'
  text: string
  reason:
    | 'remote'
    | 'packaged'
    | 'remote-unread'
    | 'key-absent'
    | 'copy-unmeasured'
    | 'locale-unrecognized'
    | 'key-invalid'
    | 'catalog-shape'
}

function dynamicCopyText(table: unknown, key: string): string | null | 'shape' {
  if (table === null || table === undefined) return null
  if (typeof table !== 'object' || Array.isArray(table)) return 'shape'
  const value = (table as Record<string, unknown>)[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed === key) return null
  return value
}

/**
 * 远端文案优先,缺了用包内快照。
 * 两边都没有,或写回来的就是键名本身,不把键名显示出去。
 * 快照还没读到时,不把远端的缺口说成「包里也没有」。
 */
export function resolveDynamicCopy(input: {
  key: unknown
  locale: unknown
  remote: unknown
  packaged: unknown
}): DynamicCopyPlan {
  const none = (reason: DynamicCopyPlan['reason']): DynamicCopyPlan => ({
    disposition: 'unjudged',
    source: 'none',
    text: '',
    reason,
  })
  if (typeof input.key !== 'string' || input.key.length === 0 || /[\s\r\n]/.test(input.key))
    return none('key-invalid')
  if (typeof input.locale !== 'string' || !DYNAMIC_LOCALES.includes(input.locale as Locale))
    return none('locale-unrecognized')
  const remote = dynamicCopyText(input.remote, input.key)
  const packaged = dynamicCopyText(input.packaged, input.key)
  if (remote === 'shape' || packaged === 'shape') return none('catalog-shape')
  if (remote) return { disposition: 'shown', source: 'remote', text: remote, reason: 'remote' }
  if (input.remote === null || input.remote === undefined) {
    if (packaged)
      return { disposition: 'shown', source: 'packaged', text: packaged, reason: 'remote-unread' }
    if (input.packaged === null || input.packaged === undefined) return none('copy-unmeasured')
    return none('key-absent')
  }
  if (input.packaged === null || input.packaged === undefined) return none('copy-unmeasured')
  if (packaged)
    return { disposition: 'shown', source: 'packaged', text: packaged, reason: 'packaged' }
  return none('key-absent')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
