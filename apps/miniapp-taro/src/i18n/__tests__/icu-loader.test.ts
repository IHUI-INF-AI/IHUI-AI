// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

import { translate } from '@ihui/i18n/loader'
import { formatIcu, hasIcuSyntax } from '@ihui/i18n'

const msg = (value: string) => ({ demo: { label: value } })
const t = (value: string, params?: Record<string, string | number>, locale?: string) =>
  translate(msg(value), 'demo.label', { params, locale })

describe('ICU 子集解释器 — 四形 + 既有插值不回归', () => {
  it('现存 web 真实键 itemCount 四档取值语义正确', () => {
    const pattern = '{count, plural, =0 {无文件夹} =1 {1 个文件夹} other {{count} 个文件夹}}'
    expect(t(pattern, { count: 0 })).toBe('无文件夹')
    expect(t(pattern, { count: 1 })).toBe('1 个文件夹')
    expect(t(pattern, { count: 2 })).toBe('2 个文件夹')
    expect(t(pattern, { count: 15 })).toBe('15 个文件夹')
  })

  it('select 命中分支与 other 兜底', () => {
    const pattern = '{state, select, running {正在读取} completed {已读取} other {读取}}'
    expect(t(pattern, { state: 'running' })).toBe('正在读取')
    expect(t(pattern, { state: 'completed' })).toBe('已读取')
    expect(t(pattern, { state: 'whatever' })).toBe('读取')
  })

  it('plural 的 # 走 number 格式化,且 case 体内可再嵌简单占位', () => {
    // CLDR:zh-CN 只有 other 一类,one 永不命中(与 next-intl 同语义,不是按 count===1 判)
    expect(t('{n, plural, one {# 个文件} other {{name} 有 # 个文件}}', { n: 1, name: 'A' })).toBe(
      'A 有 1 个文件',
    )
    expect(
      t('{n, plural, one {# 个文件} other {{name} 有 # 个文件}}', { n: 1, name: 'A' }, 'en'),
    ).toBe('1 个文件')
    expect(
      t('{n, plural, one {# 个文件} other {{name} 有 # 个文件}}', { n: 12345, name: 'A' }),
    ).toBe('A 有 12,345 个文件')
  })

  it('selectordinal 走序数类别(en 1/2/3 与 4)', () => {
    const pattern = '{index, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}'
    expect(t(pattern, { index: 1 }, 'en')).toBe('1st')
    expect(t(pattern, { index: 2 }, 'en')).toBe('2nd')
    expect(t(pattern, { index: 3 }, 'en')).toBe('3rd')
    expect(t(pattern, { index: 4 }, 'en')).toBe('4th')
  })

  it('number 按 locale 分组', () => {
    expect(t('余额 {amount, number}', { amount: 1234.5 }, 'zh-CN')).toBe('余额 1,234.5')
    expect(t('余额 {amount, number}', { amount: 1234.5 }, 'de-DE')).toBe('余额 1.234,5')
  })

  it('legacy {{name}} 与 {name} 行为不变', () => {
    expect(t('你好 {{name}}', { name: 'IHUI' })).toBe('你好 IHUI')
    expect(t('你好 {name}', { name: 'IHUI' })).toBe('你好 IHUI')
    expect(t('你好 {name}', {})).toBe('你好 ')
    expect(hasIcuSyntax('你好 {name}')).toBe(false)
  })

  it('缺 params 也不把语法吐成界面文案(走 other 分支)', () => {
    expect(t('{state, select, running {正在读取} other {读取}}')).toBe('读取')
  })

  it('无法解析的语法原样降级,不吞文案不抛错', () => {
    expect(t('前缀 {x, foo, a{b}} 后缀')).toBe('前缀 {x, foo, a{b}} 后缀')
    expect(t('坏花括号 {a, plural, one {x}')).toBe('坏花括号 {a, plural, one {x}')
    expect(formatIcu('{a, select, x {1} other {2}}', { a: 'x' }, { locale: 'zh-CN' })).toBe('1')
    // select 无 other 且值不命中:intl-messageformat 会抛错,我方选择降级为原文(不得白屏)
    expect(formatIcu('{a, select, x {1}}', {}, { locale: 'zh-CN' })).toBe('{a, select, x {1}}')
  })
})

describe('跨引擎一致性夹具 — 与 intl-messageformat(next-intl 底层)逐字符对齐', () => {
  const patterns: Array<[string, Record<string, string | number>, string]> = [
    [
      '{count, plural, =0 {无文件夹} =1 {1 个文件夹} other {{count} 个文件夹}}',
      { count: 0 },
      'zh-CN',
    ],
    [
      '{count, plural, =0 {无文件夹} =1 {1 个文件夹} other {{count} 个文件夹}}',
      { count: 7 },
      'zh-CN',
    ],
    ['{count, plural, one {# file} other {# files}}', { count: 3 }, 'en'],
    ['{state, select, running {正在读取} other {已读取}}', { state: 'running' }, 'zh-CN'],
    ['{index, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}', { index: 22 }, 'en'],
    ['余额 {amount, number}', { amount: 1234.5 }, 'zh-CN'],
    ['{n, plural, one {# 个} other {{name} 有 # 个}}', { n: 12345, name: 'A' }, 'zh-CN'],
  ]

  const require_ = createRequire(import.meta.url)
  let enginePath: string | null = null
  try {
    enginePath = require_.resolve('intl-messageformat')
  } catch {
    enginePath = null
  }

  patterns.forEach(([pattern, params, locale], idx) => {
    const body = async () => {
      const ours = formatIcu(pattern, params, { locale })
      const mod = (await import(enginePath as string)) as {
        IntlMessageFormat: new (msg: string, loc?: string) => { format: (v: unknown) => string }
      }
      expect(ours).toBe(new mod.IntlMessageFormat(pattern, locale).format(params))
    }
    // 解析不到引擎时显式 skip,不得让它落进"断言 ours 非空"的假绿分支
    if (enginePath) it(`fixture #${idx} 与 intl-messageformat 输出一致`, body)
    else it.skip(`fixture #${idx}(intl-messageformat 不可解析)`, body)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
