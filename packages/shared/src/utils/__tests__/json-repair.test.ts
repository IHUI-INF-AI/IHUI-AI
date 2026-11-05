// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, it, expect } from 'vitest'
import { repairJson, createStreamingJsonRepair, StreamingJsonRepair } from '../json-repair'

describe('repairJson — 一次性修复', () => {
  it('原样合法 JSON 直接通过且 recovered=false', () => {
    const r = repairJson('{"a":1,"b":[true,null,"x"]}')
    expect(r.ok).toBe(true)
    expect(r.recovered).toBe(false)
    expect(r.value).toEqual({ a: 1, b: [true, null, 'x'] })
  })

  it('修复：被截断的尾随字符串', () => {
    const r = repairJson('{"name":"Jo')
    expect(r.ok).toBe(true)
    expect(r.recovered).toBe(true)
    expect(r.value).toEqual({ name: 'Jo' })
  })

  it('修复：被截断的尾随数字', () => {
    const r = repairJson('{"n":123')
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ n: 123 })
  })

  it('修复：对象在流中途截断（半个属性被丢弃）', () => {
    const r = repairJson('{"a":1,"b":')
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ a: 1 })
  })

  it('修复：缺失收尾括号自动闭合', () => {
    const r = repairJson('{"a":[1,2')
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ a: [1, 2] })
  })

  it('修复：尾随逗号', () => {
    const r = repairJson('{"a":1,}')
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ a: 1 })
  })

  it('修复：裸键名未加引号', () => {
    const r = repairJson('{name:"x", age:3}')
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ name: 'x', age: 3 })
  })

  it('修复：单引号字符串', () => {
    const r = repairJson("{'a':'it\\'s ok'}")
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ a: "it's ok" })
  })

  it('修复：JS 注释', () => {
    const r = repairJson('{"a":1, /* c */ "b":2} // tail')
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ a: 1, b: 2 })
  })

  it('修复：裸 NaN / Infinity → null', () => {
    const r = repairJson('{"x":NaN,"y":Infinity}')
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ x: null, y: null })
  })

  it('修复：数组尾随截断 + 尾逗号', () => {
    const r = repairJson('[1,2,')
    expect(r.ok).toBe(true)
    expect(r.value).toEqual([1, 2])
  })

  it('无法修复时 ok=false 且给错误', () => {
    const r = repairJson('{not even close')
    expect(r.ok).toBe(false)
    expect(r.value).toBeUndefined()
    expect(typeof r.error).toBe('string')
  })

  it('空输入 ok=false', () => {
    expect(repairJson('   ').ok).toBe(false)
  })
})

describe('StreamingJsonRepair — 流式感知（超越轴：jsonrepair 不支持）', () => {
  it('逐片喂入：先 partial 再 complete', () => {
    const s = createStreamingJsonRepair()
    const p1 = s.push('{"name":"Jo') // 半截字符串
    expect(p1.complete).toBe(false)
    expect(p1.partial).toBe(true)
    expect(p1.value).toEqual({ name: 'Jo' })

    const p2 = s.push('hn","age":30}') // 闭合为完整对象
    expect(p2.complete).toBe(true)
    expect(p2.partial).toBe(false)
    expect(p2.value).toEqual({ name: 'John', age: 30 })
    expect(s.isComplete).toBe(true)
  })

  it('逐片喂入：数字在中途可被部分读取', () => {
    const s = new StreamingJsonRepair()
    const p1 = s.push('{"n":12')
    expect(p1.partial).toBe(true)
    expect(p1.value).toEqual({ n: 12 })
    const p2 = s.push('3}')
    expect(p2.complete).toBe(true)
    expect(p2.value).toEqual({ n: 123 })
  })

  it('数组流：每片都给出当前最好前缀', () => {
    const s = createStreamingJsonRepair()
    expect(s.push('[1').value).toEqual([1])
    expect(s.push(',2').value).toEqual([1, 2])
    expect(s.push(',3').partial).toBe(true)
    expect(s.push(',4').value).toEqual([1, 2, 3, 4])
    const done = s.push(']')
    expect(done.complete).toBe(true)
    expect(done.value).toEqual([1, 2, 3, 4])
  })

  it('一旦 complete，后续分片不改变已确立的值', () => {
    const s = createStreamingJsonRepair()
    s.push('{"a":1}')
    const after = s.push(' trailing garbage that is not json')
    expect(after.complete).toBe(true)
    expect(after.value).toEqual({ a: 1 })
  })
})

describe('回归钉死：截断与闭合逻辑不可悄悄失效', () => {
  it('半截字符串必须回退到最后一个引号前，而非吞掉整个对象', () => {
    // 若 trimTrailingPartial 失效，会把 "b" 也当作字符串一部分而失败
    const r = repairJson('{"a":"hello","b":"wor')
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ a: 'hello', b: 'wor' })
  })

  it('嵌套对象尾随截断只丢最外层半截属性', () => {
    const r = repairJson('{"outer":{"inner":42},"tail":')
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ outer: { inner: 42 } })
  })
})
