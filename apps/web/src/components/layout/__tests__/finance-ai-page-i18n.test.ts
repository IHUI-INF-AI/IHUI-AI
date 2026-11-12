// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 财务部板块页的 i18n 装配对账(admin-nav-label-keys.test.ts 同型哨兵,RP-46)。
 *
 * 判的不是"翻译好不好",是"页面拿的键在五语词包里到底存不存在":
 * 缺一枚 ⇒ 运行时 MISSING_MESSAGE,页面当场露白 —— 与导航键表曾经 10 枚悬空键同族。
 * 判据来源 = 页面源码现读的 t('...') 集合 ⊆ packages/i18n/messages/web/<locale>.json
 * 的 financeAi 命名空间;同时 nav.<条目 labelKey 映射> 对侧也必须解析。
 * 取不到输入(源码/词包读不到、JSON.parse 失败)一律抛错走红,绝不记绿(§0.3)。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../../../../..')
const PAGE = resolve(ROOT, 'apps/web/app/(main)/admin/finance-ai/page.tsx')
const ADMIN_NAV = resolve(ROOT, 'apps/web/src/components/layout/AdminNav.tsx')
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const

function pageKeys(): string[] {
  const files = [
    PAGE,
    resolve(ROOT, 'apps/web/app/(main)/admin/finance-ai/automation-card.tsx'),
  ]
  const set = new Set<string>()
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(/\bt\('([A-Za-z]+)'/g)) if (m[1]) set.add(m[1])
    // automation-card 的 TARGET_LABEL_KEY 值也是翻译键(动态 t(key))
    for (const m of src.matchAll(/: '(target[A-Za-z]+)'/g)) if (m[1]) set.add(m[1])
  }
  if (set.size === 0) throw new Error('页面里一枚 t() 键都找不到 — 取数面坏了,不记绿')
  return [...set]
}

function navFinanceLabelKey(): string {
  const src = readFileSync(ADMIN_NAV, 'utf8')
  // 侧边栏财务条目必须走 labelKey(禁 dynamicLabel 回潮:dynamicLabel=运行时硬编码中文,
  // 新加一枚就多吃一次门 70 差值,且五语用户看到的永远是简体字面)
  const items = src.match(/\{\s*href:\s*'\/admin\/finance-ai'[^\n]*\}/g) ?? []
  expect(items.length, '/admin/finance-ai 在 ADMIN_NAV 必须恰有一条').toBe(1)
  expect(items[0]).toContain("labelKey: 'financeAi'")
  expect(items[0]).not.toContain('dynamicLabel')
  const map = src.match(/financeAi:\s*'([^']+)'/)
  if (!map) throw new Error('NAV_LABEL_KEY 未登记 financeAi')
  if (!map[1]) throw new Error('NAV_LABEL_KEY.financeAi 值取不到')
  return map[1]
}

describe('财务部板块 i18n 装配对账', () => {
  const keys = pageKeys()

  it.each(LOCALES)('%s financeAi 命名空间每键存在且非空', (locale) => {
    const file = resolve(ROOT, 'packages/i18n/messages/web', `${locale}.json`)
    const messages = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    const ns = messages.financeAi as Record<string, unknown> | undefined
    if (!ns || typeof ns !== 'object') throw new Error(`${locale} 无 financeAi 命名空间`)
    for (const key of keys) {
      const value = ns[key]
      expect(typeof value, `${locale} 缺键 financeAi.${key}`).toBe('string')
      expect((value as string).trim(), `${locale} 空值 financeAi.${key}`).not.toBe('')
    }
  })

  it.each(LOCALES)('%s nav.financeAi 解析非空(侧边栏显示名)', (locale) => {
    const i18nKey = navFinanceLabelKey()
    expect(i18nKey).toBe('nav.financeAi')
    const messages = JSON.parse(
      readFileSync(resolve(ROOT, 'packages/i18n/messages/web', `${locale}.json`), 'utf8'),
    ) as { nav?: Record<string, unknown> }
    const value = messages.nav?.financeAi
    expect(typeof value, `${locale} 缺 nav.financeAi`).toBe('string')
    expect((value as string).trim()).not.toBe('')
  })

  it('五语键集对齐:页面键 ⊖ 任一语言 = 空(与 check-i18n-keys 同判据方向,页面侧再钉一刀)', () => {
    const perLocale = LOCALES.map((locale) => {
      const messages = JSON.parse(
        readFileSync(resolve(ROOT, 'packages/i18n/messages/web', `${locale}.json`), 'utf8'),
      ) as { financeAi?: Record<string, unknown> }
      return new Set(Object.keys(messages.financeAi ?? {}))
    })
    for (const key of keys) {
      expect(perLocale.every((s) => s.has(key)), `键 ${key} 未五语齐备`).toBe(true)
    }
  })

  it('带参模板的占位符跨语一致(参数少一枚 = 该语运行时露 {value})', () => {
    const zh = JSON.parse(
      readFileSync(resolve(ROOT, 'packages/i18n/messages/web/zh-CN.json'), 'utf8'),
    ) as { financeAi: Record<string, string> }
    for (const locale of LOCALES.filter((l) => l !== 'zh-CN')) {
      const other = JSON.parse(
        readFileSync(resolve(ROOT, 'packages/i18n/messages/web', `${locale}.json`), 'utf8'),
      ) as { financeAi: Record<string, string> }
      for (const key of keys) {
        const a = (zh.financeAi[key]?.match(/\{\w+\}/g) ?? []).sort().join(',')
        const b = (other.financeAi[key]?.match(/\{\w+\}/g) ?? []).sort().join(',')
        expect(b, `${locale}.${key} 占位符漂移 (${a})`).toBe(a)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
