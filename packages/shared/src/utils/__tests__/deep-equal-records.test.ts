// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-704(2026-09-29 立)等深比较器的行为锁。
//
// 本票要防的是"回声写"(高频 SSE 位每帧新造对象 ⇒ store 无条件产出新 state ⇒ 自环),
// 而修法的全部有效性系于"相等"这一判得准不准:
//  - **漏判**(实际不等却判成等)⇒ 该写的不写,数据永久停在旧值 —— 静默丢更新;
//  - **误判**(实际等却判成不等)⇒ 只是少省一次写,退化成改动前的行为。
// 所以每个能力都配**成对**用例(必须判等 / 必须判不等),并且"判不等"的那一半是主力:
// 只写正例的断言,对一台恒返回 true 的尺子完全无牙(本仓 §22c"镜像测试只复读实现就是复读机"同型)。

import { describe, expect, it } from 'vitest'
import { areRecordValuesEqual, MAX_RECORD_COMPARE_DEPTH } from '../deep-equal-records'

describe('areRecordValuesEqual(等深比较,G-704 唯一实现)', () => {
  it('键序无关:同内容换键序 ⇒ 等值', () => {
    expect(areRecordValuesEqual({ a: 1, b: 'x' }, { b: 'x', a: 1 })).toBe(true)
  })

  it('深度:嵌套 usage 对象逐字段等值 ⇒ 等值(只比顶层键的形状判不出这一型)', () => {
    expect(
      areRecordValuesEqual(
        { usage: { total: 12, prompt: 8 } },
        { usage: { prompt: 8, total: 12 } },
      ),
    ).toBe(true)
  })

  it('深度:嵌套里一个叶子不同 ⇒ 必须判不等(漏判这一型就等于把新值吞掉)', () => {
    expect(areRecordValuesEqual({ usage: { total: 12 } }, { usage: { total: 13 } })).toBe(false)
  })

  it('同层键数不同 ⇒ 不等(新增/删除一个键都算变更)', () => {
    expect(areRecordValuesEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(areRecordValuesEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false)
  })

  it('键存在但值为 undefined 与"没有这个键"⇒ 不等(不得把缺席与显式 undefined 混为一谈)', () => {
    expect(areRecordValuesEqual({ a: undefined }, {})).toBe(false)
    expect(areRecordValuesEqual({}, { a: undefined })).toBe(false)
  })

  it('数组:逐元素等值 ⇒ 等值', () => {
    expect(areRecordValuesEqual({ items: ['a', 'b'] }, { items: ['a', 'b'] })).toBe(true)
  })

  it('数组:顺序不同 ⇒ 不等(顺序敏感,绝不"排完序再说相等")', () => {
    expect(areRecordValuesEqual({ items: ['a', 'b'] }, { items: ['b', 'a'] })).toBe(false)
  })

  it('数组:长度不同 ⇒ 不等', () => {
    expect(areRecordValuesEqual({ items: ['a'] }, { items: ['a', 'b'] })).toBe(false)
  })

  it('原始值:NaN 与 NaN 算等值(否则每帧 NaN 都会重写,正是本票要消掉的那一型)', () => {
    expect(areRecordValuesEqual({ n: NaN }, { n: NaN })).toBe(true)
  })

  it('原始值:类型不同 ⇒ 不等(1 与 "1" 不同形,字符串比较会误判)', () => {
    expect(areRecordValuesEqual({ n: 1 }, { n: '1' })).toBe(false)
    expect(areRecordValuesEqual({ n: null }, { n: undefined })).toBe(false)
  })

  it('非纯对象(Date / Map / 类实例)只按引用比 ⇒ 内容相同也判不等(保守:照写)', () => {
    expect(areRecordValuesEqual({ at: new Date(0) }, { at: new Date(0) })).toBe(false)
    expect(areRecordValuesEqual({ set: new Set(['a']) }, { set: new Set(['a']) })).toBe(false)
    class Box {
      v = 1
    }
    expect(areRecordValuesEqual({ box: new Box() }, { box: new Box() })).toBe(false)
  })

  it('同一引用 ⇒ 等值(短路,不进递归)', () => {
    const shared = { deep: { x: [1, 2, 3] } }
    expect(areRecordValuesEqual({ a: shared }, { a: shared })).toBe(true)
  })

  it('超深(> MAX_RECORD_COMPARE_DEPTH)判不等并如实留痕(把没判写成判过了是本仓最高频失效型)', () => {
    const nest = (depth: number): Record<string, unknown> => {
      let node: Record<string, unknown> = { leaf: 1 }
      for (let i = 0; i < depth; i += 1) node = { next: node }
      return node
    }
    // 上限之内:仍然逐层判等
    expect(
      areRecordValuesEqual(nest(MAX_RECORD_COMPARE_DEPTH - 1), nest(MAX_RECORD_COMPARE_DEPTH - 1)),
    ).toBe(true)
    // 越过上限:判不等(退回"照写",不冒"等价"的结论)
    const deepA = nest(MAX_RECORD_COMPARE_DEPTH + 3)
    const deepB = nest(MAX_RECORD_COMPARE_DEPTH + 3)
    expect(areRecordValuesEqual(deepA, deepB)).toBe(false)
  })

  it('空对象之间 ⇒ 等值(合并后没带来任何新键时,调用方就该原样返回旧 state)', () => {
    expect(areRecordValuesEqual({}, {})).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
