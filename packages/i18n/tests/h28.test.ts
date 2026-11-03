// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// H28 前置验证真链路:含 {state, select, …} 的键 → 过 key 规则 → 本解释器渲染 →
// 与 intl-messageformat(next-intl 底层)逐字符一致 → 断言中文态文本,五语言齐才算通。
// 验证键放在本测试夹具 tests/fixtures/h28/ 里,不碰 packages/i18n/messages/** 大词表。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { IntlMessageFormat } from 'intl-messageformat'
import { describe, expect, it } from 'vitest'

import { translate } from '../src/loader'
import type { Messages } from '../src/types'

const here = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(here, 'fixtures/h28')
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const
const KEY = 'taskStatus.syncState'

function loadFixture(locale: string): { raw: string; messages: Messages } {
  const raw = readFileSync(join(FIXTURES, `${locale}.json`), 'utf8')
  return { raw, messages: JSON.parse(raw) as Messages }
}

function leaves(obj: Messages, prefix = ''): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...leaves(v as Messages, path))
    } else {
      out.push(path)
    }
  }
  return out
}

describe('H28 key 规则(与 check-i18n-keys.mjs 同判据)', () => {
  it('五语言 parity:键集合完全一致', () => {
    const base = leaves(loadFixture('zh-CN').messages).sort()
    expect(base).toEqual([KEY])
    for (const locale of LOCALES) {
      expect(leaves(loadFixture(locale).messages).sort()).toEqual(base)
    }
  })

  it('无含点键、无同层重复 key', () => {
    for (const locale of LOCALES) {
      const { raw, messages } = loadFixture(locale)
      const walk = (node: Messages): void => {
        for (const [k, v] of Object.entries(node)) {
          expect(k).not.toContain('.')
          if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            walk(v as Messages)
          }
        }
      }
      walk(messages)
      // 同层重复 key:源码出现次数必须为 1(JSON.parse 会静默吞掉前值,数源码才看得见)
      expect(raw.split('"syncState"').length - 1).toBe(1)
    }
  })
})

describe('H28 真链路:select 渲染 + 中文态文本 + 跨引擎一致', () => {
  const expected: Record<string, Record<string, string>> = {
    'zh-CN': {
      running: '正在同步:相册',
      completed: '已同步完成:相册',
      archived: '尚未同步:相册',
    },
    en: {
      running: 'Syncing 相册',
      completed: 'Synced 相册',
      archived: 'Pending 相册',
    },
    ja: {
      running: '同期中:相册',
      completed: '同期完了:相册',
      archived: '同期待ち:相册',
    },
    ko: {
      running: '동기화 중: 相册',
      completed: '동기화 완료: 相册',
      archived: '동기화 대기: 相册',
    },
    'zh-TW': {
      running: '正在同步:相册',
      completed: '已同步完成:相册',
      archived: '尚未同步:相册',
    },
  }

  for (const locale of LOCALES) {
    it(`${locale} 三态渲染与期望一致`, () => {
      const { messages } = loadFixture(locale)
      for (const state of ['running', 'completed', 'archived'] as const) {
        expect(
          translate(messages, KEY, {
            params: { state, name: '相册' },
            locale,
          }),
        ).toBe(expected[locale][state])
      }
    })

    it(`${locale} 与 next-intl 底层逐字符一致`, () => {
      const { messages } = loadFixture(locale)
      const pattern = (messages.taskStatus as Messages).syncState as string
      for (const state of ['running', 'completed', 'archived']) {
        const params = { state, name: '相册' }
        expect(translate(messages, KEY, { params, locale })).toBe(
          new IntlMessageFormat(pattern, locale).format(params) as string,
        )
      }
    })
  }

  it('中文态文本断言(zh-CN)', () => {
    const { messages } = loadFixture('zh-CN')
    expect(translate(messages, KEY, { params: { state: 'running', name: '相册' } })).toContain(
      '正在同步',
    )
    expect(translate(messages, KEY, { params: { state: 'completed', name: '相册' } })).toContain(
      '已同步完成',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
