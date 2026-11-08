// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * buildQs 夹具(2026-11-08,同型根因自查 api-client 形状类)。
 *
 * 缺陷形态:`String(v)` 对数组产出 `a,b`、对对象产出 `[object Object]`,所有端同形中招。
 * 红证(legacy):数组断言得到 `types=a%2Cb`,对象断言不抛 —— 见提交前读数。
 */
import { describe, expect, it } from 'vitest'
import { buildQs } from './utils'

describe('buildQs — 数组展开成重复 key(服务端可还原为数组)', () => {
  it('多值参数逐项 append', () => {
    expect(buildQs({ types: ['a', 'b'], page: 1 })).toBe('?types=a&types=b&page=1')
  })

  it('空值与空数组不占位', () => {
    expect(buildQs({ types: ['a', '', undefined, null, 'b'] })).toBe('?types=a&types=b')
    expect(buildQs({ types: [] })).toBe('')
  })

  it('数字/布尔数组保持字符串形态', () => {
    expect(buildQs({ ids: [1, 2], flags: [true, false] })).toBe('?ids=1&ids=2&flags=true&flags=false')
  })
})

describe('buildQs — 形状不可表达时显式失败', () => {
  it('对象参数抛 TypeError,不发 [object Object]', () => {
    expect(() => buildQs({ filter: { a: 1 } })).toThrow(TypeError)
  })

  it('数组里夹对象同样抛 TypeError', () => {
    expect(() => buildQs({ types: ['a', { b: 1 }] as unknown[] })).toThrow(TypeError)
  })

  it('函数参数抛 TypeError', () => {
    expect(() => buildQs({ cb: () => 1 })).toThrow(TypeError)
  })
})

describe('buildQs — 既有标量行为不回退', () => {
  it('数字/布尔/中文按原口径编码', () => {
    expect(buildQs({ page: 1, unread: false, q: '中文 空格' })).toBe(
      '?page=1&unread=false&q=%E4%B8%AD%E6%96%87+%E7%A9%BA%E6%A0%BC',
    )
  })

  it('空参数返回空串', () => {
    expect(buildQs({})).toBe('')
    expect(buildQs({ a: undefined, b: null, c: '' })).toBe('')
  })
})
