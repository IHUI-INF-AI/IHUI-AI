// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// budget 额度交代在 RN 端的**词包对账**:键表与 `common.budget*` 必须成对存在。
// 为什么单测这个 —— 该端取词缺键时不抛错,而是把键名原样回显到界面上
// (守门 56 / D111 同一失效类),typecheck 与渲染用例都看不见。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { RN_BUDGET_NOTE_KEYS, budgetNoteText } from '../src/utils/budget-note'

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

function readPack(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        'packages',
        'i18n',
        'messages',
        'mobile-rn',
        `${locale}.json`,
      ),
      'utf8',
    ),
  ) as Record<string, unknown>
}

function resolve(root: Record<string, unknown>, path: string): string | undefined {
  let cur: unknown = root
  for (const seg of path.split('.')) {
    if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg]
    } else {
      return undefined
    }
  }
  return typeof cur === 'string' ? cur : undefined
}

/** 真机同语义取词函数:解析点号路径 + 按 {name} 插值(参数名写错在这里就暴露) */
function translator(locale: string) {
  const root = readPack(locale)
  return (key: string, params?: Record<string, string | number>): string => {
    const tmpl = resolve(root, key)
    if (tmpl === undefined) return key // 缺键回显键名 —— 下面的断言正是为了抓这一步
    return tmpl.replace(/\{(\w+)\}/gu, (_m, name: string) => String(params?.[name] ?? `{${name}}`))
  }
}

const SLOTS = Object.keys(RN_BUDGET_NOTE_KEYS) as (keyof typeof RN_BUDGET_NOTE_KEYS)[]

describe('RN budget 词包(common.budget* ×5 语言)', () => {
  it('键表里每个键在 5 语言里都存在且非空(缺键即红,不靠运行时回显键名)', () => {
    for (const locale of LOCALES) {
      const root = readPack(locale)
      for (const slot of SLOTS) {
        const key = RN_BUDGET_NOTE_KEYS[slot]
        expect(resolve(root, key), `${locale} 缺键 ${key}`).toBeTruthy()
      }
    }
  })

  it('五语言真跑一行:产物是本地化文案 —— 不回显键名、不留 {占位符}、不含 undefined', () => {
    const event = {
      level: 'critical' as const,
      percent: 97.5,
      usedTokens: 97500,
      limitTokens: 100000,
      tier: 'VIP',
      resetAt: '2026-09-25T16:00:00.000Z',
    }
    for (const locale of LOCALES) {
      const line = budgetNoteText(event, translator(locale))
      expect(line).not.toContain('common.budget')
      expect(line).not.toMatch(/\{\w+\}/u)
      expect(line).not.toContain('undefined')
      expect(line.length).toBeGreaterThan(8)
      // critical 档必须落到本语言的"即将耗尽"那条值上
      expect(line).toContain(resolve(readPack(locale), RN_BUDGET_NOTE_KEYS.criticalTitle))
    }
  })

  it('载荷缺 resetAt 时,五语言都不得出现本语言的"重置"文案(没给字段就不说)', () => {
    for (const locale of LOCALES) {
      const resetText = resolve(readPack(locale), RN_BUDGET_NOTE_KEYS.resetTomorrow)
      expect(resetText).toBeTruthy()
      const line = budgetNoteText(
        { level: 'warning', usedTokens: 1000, limitTokens: 2000 },
        translator(locale),
      )
      expect(line).not.toContain(resetText as string)
    }
  })

  it('载荷只有 level 时整行退化为裸标题,不带本语言的连接冒号', () => {
    for (const locale of LOCALES) {
      const title = resolve(readPack(locale), RN_BUDGET_NOTE_KEYS.warningTitle)
      expect(budgetNoteText({ level: 'warning' }, translator(locale))).toBe(title)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
