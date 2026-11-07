// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { normalizeToolCallArgs, createToolCallArgsStreamer } from '../tool-call-args'

describe('normalizeToolCallArgs — 入参归一化单一出口', () => {
  it('已是对象：原样返回（引用不变）', () => {
    const obj = { path: 'a.txt', lines: 3 }
    expect(normalizeToolCallArgs(obj)).toBe(obj)
  })

  it('字符串（合法 JSON）：解析为对象', () => {
    expect(normalizeToolCallArgs('{"path":"a.txt"}')).toEqual({ path: 'a.txt' })
  })

  it('字符串（残缺 JSON）：repairJson 兜底修复', () => {
    // 流截断的尾随字符串
    expect(normalizeToolCallArgs('{"path":"a.t')).toEqual({ path: 'a.t' })
    // 裸键名
    expect(normalizeToolCallArgs('{name:"x", age:3}')).toEqual({ name: 'x', age: 3 })
  })

  it('null / undefined / 空串：返回 undefined', () => {
    expect(normalizeToolCallArgs(null)).toBeUndefined()
    expect(normalizeToolCallArgs(undefined)).toBeUndefined()
    expect(normalizeToolCallArgs('   ')).toBeUndefined()
  })

  it('数组 / 原始类型：返回 undefined（入参必须是对象）', () => {
    expect(normalizeToolCallArgs([1, 2])).toBeUndefined()
    expect(normalizeToolCallArgs(42)).toBeUndefined()
    expect(normalizeToolCallArgs('not json at all')).toBeUndefined()
  })
})

describe('ToolCallArgsStreamer — 增量 function.arguments 流式解析（超越轴）', () => {
  it('逐片喂入：先 partial 后 complete', () => {
    const s = createToolCallArgsStreamer()
    const p1 = s.push('{"path":"a.')
    expect(p1.complete).toBe(false)
    expect(p1.partial).toBe(true)
    expect(p1.args).toEqual({ path: 'a.' })

    const p2 = s.push('txt","lines":3}')
    expect(p2.complete).toBe(true)
    expect(p2.partial).toBe(false)
    expect(p2.args).toEqual({ path: 'a.txt', lines: 3 })
    expect(s.isComplete).toBe(true)
  })

  it('逐片喂入：数字中途可被部分读取', () => {
    const s = createToolCallArgsStreamer()
    const p1 = s.push('{"n":12')
    expect(p1.partial).toBe(true)
    expect(p1.args).toEqual({ n: 12 })
    const p2 = s.push('3}')
    expect(p2.complete).toBe(true)
    expect(p2.args).toEqual({ n: 123 })
  })

  it('对象流：每片都给出当前最好前缀', () => {
    const s = createToolCallArgsStreamer()
    expect(s.push('{"a":1').args).toEqual({ a: 1 })
    expect(s.push(',"b":2').args).toEqual({ a: 1, b: 2 })
    const done = s.push('}')
    expect(done.complete).toBe(true)
    expect(done.args).toEqual({ a: 1, b: 2 })
  })

  it('一旦 complete，后续分片不改变已确立的值', () => {
    const s = createToolCallArgsStreamer()
    s.push('{"a":1}')
    const after = s.push(' trailing prose that is not json')
    expect(after.complete).toBe(true)
    expect(after.args).toEqual({ a: 1 })
  })
})

describe('回归钉死：normalize 不能把字符串漏成字符串', () => {
  it('上游把 args 当 JSON 字符串下发时，必须收敛为对象而非字符串', () => {
    // 这是接入前的历史 bug 形态：parsed.args 是字符串，消费者拿到的是 string 而非 object
    const upstreamStringArgs = '{"command":"ls","cwd":"/tmp"}'
    const normalized = normalizeToolCallArgs(upstreamStringArgs)
    expect(typeof normalized).toBe('object')
    expect(normalized).toEqual({ command: 'ls', cwd: '/tmp' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
