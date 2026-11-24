// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D101 端中立措辞引擎单元测试:select/plural/selectordinal/number 四形子集 +
// 嵌套一层 + =0/=1/other + # 替换 + {v, number} 分组 + 降级不抛错。

import { describe, expect, it, vi } from 'vitest'

import { formatIcu, hasIcuSyntax } from '../src/icu'

function silentWarn(): () => void {
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  return () => spy.mockRestore()
}

describe('hasIcuSyntax', () => {
  it('识别四形', () => {
    expect(hasIcuSyntax('{s, select, a {A} other {B}}')).toBe(true)
    expect(hasIcuSyntax('{c, plural, other {#}}')).toBe(true)
    expect(hasIcuSyntax('{n, selectordinal, other {#}}')).toBe(true)
    expect(hasIcuSyntax('{v, number}')).toBe(true)
  })

  it('普通插值不走 ICU 路径', () => {
    expect(hasIcuSyntax('你好 {name}')).toBe(false)
    expect(hasIcuSyntax('你好 {{name}}')).toBe(false)
    expect(hasIcuSyntax('纯文本')).toBe(false)
  })
})

describe('select', () => {
  const pattern = '{state, select, running {RUN} completed {DONE} other {PEND}}'

  it('三态分支', () => {
    expect(formatIcu(pattern, { state: 'running' })).toBe('RUN')
    expect(formatIcu(pattern, { state: 'completed' })).toBe('DONE')
    expect(formatIcu(pattern, { state: 'archived' })).toBe('PEND')
  })

  it('未知态回 other;缺参回 other', () => {
    expect(formatIcu(pattern, { state: 'whatever' })).toBe('PEND')
    expect(formatIcu(pattern, {})).toBe('PEND')
  })

  it('分支内嵌套 {name} 与 {{name}}', () => {
    expect(
      formatIcu('{state, select, running {执行:{name}} other {待定}}', {
        state: 'running',
        name: '相册',
      }),
    ).toBe('执行:相册')
    expect(
      formatIcu('{state, select, running {执行:{{name}}} other {待定}}', {
        state: 'running',
        name: '相册',
      }),
    ).toBe('执行:相册')
  })

  it('缺 other 时降级原文 + 告警,不抛错', () => {
    const restore = silentWarn()
    const broken = '{state, select, running {RUN}}'
    expect(formatIcu(broken, { state: 'completed' })).toBe(broken)
    expect(console.warn).toHaveBeenCalledOnce()
    restore()
  })
})

describe('plural', () => {
  const pattern = '{count, plural, =0 {none} =1 {one} other {# items}}'

  it('=0/=1 精确匹配优先于类别(zh-CN 只有 other 类别,显式匹配仍命中)', () => {
    expect(formatIcu(pattern, { count: 0 }, { locale: 'zh-CN' })).toBe('none')
    expect(formatIcu(pattern, { count: 1 }, { locale: 'zh-CN' })).toBe('one')
    expect(formatIcu(pattern, { count: 5 }, { locale: 'zh-CN' })).toBe('5 items')
  })

  it('en 类别 one/other', () => {
    const p = '{count, plural, one {# message} other {# messages}}'
    expect(formatIcu(p, { count: 1 }, { locale: 'en' })).toBe('1 message')
    expect(formatIcu(p, { count: 2 }, { locale: 'en' })).toBe('2 messages')
    expect(formatIcu(p, { count: 0 }, { locale: 'en' })).toBe('0 messages')
  })

  it('# 按 locale 分组', () => {
    const p = '{count, plural, other {# 条}}'
    expect(formatIcu(p, { count: 1234567 }, { locale: 'en' })).toBe('1,234,567 条')
    expect(formatIcu(p, { count: 1234567 }, { locale: 'zh-CN' })).toBe('1,234,567 条')
  })

  it('嵌套一层 select;内层 # 与参考引擎一致保持字面量(见跨引擎夹具探针结论)', () => {
    const p =
      '{count, plural, =0 {none} other {{state, select, running {running #} other {idle #}}}}'
    expect(formatIcu(p, { count: 3, state: 'running' }, { locale: 'en' })).toBe('running #')
    expect(formatIcu(p, { count: 3, state: 'idle' }, { locale: 'en' })).toBe('idle #')
  })

  it('非数值回 other;offset 显式降级', () => {
    const restore = silentWarn()
    expect(formatIcu('{c, plural, other {共 # 件}}', { c: 'x' })).toBe('共 # 件')
    const offset = '{c, plural, offset:1 =0 {A} other {B}}'
    expect(formatIcu(offset, { c: 2 }, { locale: 'en' })).toBe(offset)
    expect(console.warn).toHaveBeenCalled()
    restore()
  })
})

describe('selectordinal 与 number', () => {
  it('en 序数类别', () => {
    const p = '{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}'
    expect(formatIcu(p, { n: 1 }, { locale: 'en' })).toBe('1st')
    expect(formatIcu(p, { n: 2 }, { locale: 'en' })).toBe('2nd')
    expect(formatIcu(p, { n: 3 }, { locale: 'en' })).toBe('3rd')
    expect(formatIcu(p, { n: 4 }, { locale: 'en' })).toBe('4th')
    expect(formatIcu(p, { n: 11 }, { locale: 'en' })).toBe('11th')
  })

  it('{v, number} 按 locale 分组', () => {
    expect(formatIcu('{v, number}', { v: 1234567.89 }, { locale: 'en' })).toBe('1,234,567.89')
    expect(formatIcu('{v, number}', { v: 1234567.89 }, { locale: 'zh-CN' })).toBe('1,234,567.89')
    expect(formatIcu('共{v, number}条', { v: 10000 }, { locale: 'zh-CN' })).toBe('共10,000条')
  })
})

describe('降级', () => {
  it('花括号未闭合/未知类型:原文 + 告警,不抛错', () => {
    const restore = silentWarn()
    const unclosed = '{count, plural, other {A}'
    expect(formatIcu(unclosed, { count: 1 })).toBe(unclosed)
    const unknown = '{x, bogus, a {A} other {B}}'
    expect(formatIcu(unknown, { x: 'a' })).toBe(unknown)
    expect(console.warn).toHaveBeenCalled()
    restore()
  })

  it('成功路径不告警', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    formatIcu('{s, select, a {A} other {B}}', { s: 'a' })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
