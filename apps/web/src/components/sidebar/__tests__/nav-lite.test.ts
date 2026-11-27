// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { NAV_LITE_ALL_HREF, NAV_LITE_PRIMARY } from '../nav-lite'

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
const MESSAGES_DIR = path.resolve(process.cwd(), '../../packages/i18n/messages/web')

function navDict(locale: string): Record<string, unknown> {
  const raw = fs.readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8')
  return (JSON.parse(raw) as { nav?: Record<string, unknown> }).nav ?? {}
}

describe('NAV_LITE_PRIMARY', () => {
  it('严格五项,顺序固定', () => {
    expect(NAV_LITE_PRIMARY.map((i) => i.href)).toEqual([
      '/start',
      '/publish/history',
      '/assets',
      '/messages',
      '/user/profile',
    ])
    expect(NAV_LITE_PRIMARY).toHaveLength(5)
  })

  it('/all 是五项之外的唯一兜底目录', () => {
    expect(NAV_LITE_ALL_HREF).toBe('/all')
  })

  it('labelKey 不重复', () => {
    const keys = NAV_LITE_PRIMARY.map((i) => i.labelKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it.each(LOCALES)('%s 词库里五项标签都有译文(防空 key 裸奔)', (locale) => {
    const nav = navDict(locale)
    for (const item of NAV_LITE_PRIMARY) {
      expect(nav[item.labelKey], `${locale} nav.${item.labelKey}`).toBeTruthy()
      expect(String(nav[item.labelKey]).length).toBeGreaterThan(0)
    }
    expect(nav.allFeatures, `${locale} nav.allFeatures`).toBeTruthy()
  })
})
