/**
 * Extension i18n key parity 守门测试(2026-07-22 立)。
 *
 * 5 语言(zh-CN / en / ja / ko / zh-TW)的 key 集合必须完全一致。
 * 基准语言为 zh-CN,其他 4 语言任何 key 缺失/多余都会导致测试失败。
 *
 * 运行: pnpm --filter @ihui/extension test
 */
import { describe, it, expect } from 'vitest'
import zhCN from '../src/i18n/messages/zh-CN.json'
import en from '../src/i18n/messages/en.json'
import ja from '../src/i18n/messages/ja.json'
import ko from '../src/i18n/messages/ko.json'
import zhTW from '../src/i18n/messages/zh-TW.json'

type MsgObj = Record<string, unknown>

/** 递归收集所有叶子节点的 dot path(与 check-i18n-keys.mjs collectLeafKeys 一致) */
function collectLeafKeys(obj: MsgObj, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectLeafKeys(v as MsgObj, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

const BASE_LANG = 'zh-CN'
const locales: Record<string, MsgObj> = {
  'zh-CN': zhCN as MsgObj,
  en: en as MsgObj,
  ja: ja as MsgObj,
  ko: ko as MsgObj,
  'zh-TW': zhTW as MsgObj,
}

const baseKeys = new Set(collectLeafKeys(locales[BASE_LANG]))
const baseKeyCount = baseKeys.size

describe('Extension i18n key parity', () => {
  it(`${BASE_LANG} 基准语言 key 数量应 > 0`, () => {
    expect(baseKeyCount).toBeGreaterThan(0)
  })

  for (const lang of Object.keys(locales)) {
    if (lang === BASE_LANG) continue

    it(`${lang} 与 ${BASE_LANG} key 集合完全一致`, () => {
      const langKeys = new Set(collectLeafKeys(locales[lang]))
      const missing = [...baseKeys].filter((k) => !langKeys.has(k))
      const extra = [...langKeys].filter((k) => !baseKeys.has(k))
      if (missing.length > 0) {
        expect.fail(
          `${lang} 缺失 ${missing.length} 个 key(基准 ${BASE_LANG} 有):\n  ${missing.join('\n  ')}`,
        )
      }
      if (extra.length > 0) {
        expect.fail(
          `${lang} 多出 ${extra.length} 个 key(基准 ${BASE_LANG} 无):\n  ${extra.join('\n  ')}`,
        )
      }
      expect(langKeys.size).toBe(baseKeyCount)
    })
  }

  it('所有语言 key 总数一致', () => {
    const counts = Object.entries(locales).map(([lang, obj]) => ({
      lang,
      count: collectLeafKeys(obj).length,
    }))
    const first = counts[0].count
    for (const { count } of counts) {
      expect.soft(count).toBe(first)
    }
    // 打印统计(调试用)
    console.log(
      '[i18n parity] key counts:',
      counts.map((c) => `${c.lang}=${c.count}`).join(', '),
    )
  })
})
