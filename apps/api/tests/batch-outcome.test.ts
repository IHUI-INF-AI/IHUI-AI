// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// batchWriteOutcome / dedupeIds 纯函数回归(2026-09-26 静默失真批量写票)。
// 判据核心:affected 只能由"库确认集合 ∩ 去重后的 requested"推出;
// missedIds 逐条点名且顺序稳定;confirmed 里的额外 id 不得虚报 affected。
import { describe, it, expect } from 'vitest'
import { dedupeIds, batchWriteOutcome } from '../src/utils/batch-outcome.js'

describe('dedupeIds', () => {
  it('去重 + 去空白,保留输入顺序', () => {
    expect(dedupeIds(['a', 'b', 'a', '  ', 'c', 'b'])).toEqual(['a', 'b', 'c'])
  })
  it('数字 id 不受空白规则影响,只去重', () => {
    expect(dedupeIds([1, 2, 1, 3, 2])).toEqual([1, 2, 3])
  })
})

describe('batchWriteOutcome', () => {
  it('① 全命中 ⇒ missedIds 为空数组,affected = 去重后的 requested 数', () => {
    const r = batchWriteOutcome(['a', 'b', 'c'], ['a', 'b', 'c'])
    expect(r.affected).toBe(3)
    expect(r.missedIds).toEqual([])
    expect(r.requestedIds).toEqual(['a', 'b', 'c'])
  })

  it('② 部分命中 ⇒ missedIds 逐条点名未命中,顺序与 requested 一致', () => {
    const r = batchWriteOutcome(['c', 'a', 'b'], ['a'])
    expect(r.affected).toBe(1)
    expect(r.missedIds).toEqual(['c', 'b'])
  })

  it('③ requested 含重复/空白 ⇒ 去重后 affected 不重复计', () => {
    const r = batchWriteOutcome(['a', 'a', '', 'b', '  '], ['a', 'b'])
    expect(r.affected).toBe(2)
    expect(r.missedIds).toEqual([])
    expect(r.requestedIds).toEqual(['a', 'b'])
  })

  it('④ confirmed 含 requested 之外的 id ⇒ 不计入 affected(不得虚报)', () => {
    const r = batchWriteOutcome(['a'], ['a', 'x', 'y'])
    expect(r.affected).toBe(1)
    expect(r.missedIds).toEqual([])
  })

  it('一个都没命中 ⇒ affected=0 且点名全部(重复 id 只点名一次)', () => {
    const r = batchWriteOutcome(['a', 'b', 'a'], [])
    expect(r.affected).toBe(0)
    expect(r.missedIds).toEqual(['a', 'b'])
  })

  it('数字 id 泛型路径同样成立(T = number)', () => {
    const r = batchWriteOutcome([1, 2, 3], [1, 3])
    expect(r.affected).toBe(2)
    expect(r.missedIds).toEqual([2])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
