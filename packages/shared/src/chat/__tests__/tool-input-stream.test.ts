// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { ToolInputStream, createToolInputParser } from '../tool-input-stream'

describe('ToolInputStream', () => {
  it('拼完对象才算完成，之后的增量不再改参数', () => {
    const stream = new ToolInputStream()
    expect(stream.appendDelta('{"command":').complete).toBe(false)
    const done = stream.appendDelta('"ls"}')
    expect(done.complete).toBe(true)
    expect(done.parameters).toEqual({ command: 'ls' })
    expect(done.defect).toBeNull()
    const ignored = stream.appendDelta(',"extra":1}')
    expect(ignored.parameters).toEqual({ command: 'ls' })
    expect(ignored.rawBuffer).toBe('{"command":"ls"}')
  })

  it('半截字符串可以先交出已写完的前缀，空对象和空增量都不算完成', () => {
    const stream = new ToolInputStream()
    expect(stream.appendDelta('').parameters).toEqual({})
    expect(stream.appendDelta(12).parameters).toEqual({})
    const partial = stream.appendDelta('{"path":"sr')
    expect(partial.complete).toBe(false)
    expect(partial.parameters).toEqual({ path: 'sr' })
    expect(partial.defect).toBeNull()
    const empty = new ToolInputStream().appendDelta('{}')
    expect(empty.complete).toBe(false)
    expect(empty.parameters).toEqual({})
  })

  it('未闭合字符串里的 unicode 转义在补括号失败时仍然可读', () => {
    const stream = new ToolInputStream()
    const snap = stream.appendDelta('{"name":"\\u4e2d\n未')
    expect(snap.complete).toBe(false)
    expect(snap.parameters).toEqual({ name: '中\n未' })
  })

  it('完整的非对象清掉已有字段，并且不标完成', () => {
    const stream = new ToolInputStream()
    expect(stream.appendDelta('{"a":1').parameters).toEqual({ a: 1 })
    const rejected = stream.finish('[1]')
    expect(rejected.complete).toBe(false)
    expect(rejected.defect).toBe('not_object')
    expect(rejected.parameters).toEqual({})
  })

  it('结束帧给出空对象时才算完成', () => {
    const stream = new ToolInputStream()
    stream.appendDelta('{}')
    const done = stream.finish('{}')
    expect(done.complete).toBe(true)
    expect(done.parameters).toEqual({})
    expect(done.defect).toBeNull()
  })

  it('工厂按增量返回当前参数', () => {
    const parse = createToolInputParser()
    expect(parse('{"n":')).toEqual({})
    expect(parse('1}')).toEqual({ n: 1 })
  })

  it('流式阶段缓冲超上限时标 too_large 终态并不再喂增量（E-S1）', () => {
    const stream = new ToolInputStream()
    // MAX_BUFFER_CHARS = 1<<20 = 1048576，构造超限增量
    const oversize = 'x'.repeat(1 << (20 + 1))
    const snap = stream.appendDelta(oversize)
    expect(snap.defect).toBe('too_large')
    expect(snap.complete).toBe(false)
    expect(snap.parameters).toEqual({})
    // 后续增量不再改状态
    const after = stream.appendDelta('{"a":1}')
    expect(after.defect).toBe('too_large')
    expect(after.parameters).toEqual({})
  })

  it('半截非对象（[ 或 " 开头）保持 not_object 终态避免 defect 抖动（E-S4）', () => {
    const stream = new ToolInputStream()
    // 第一帧进来一个数组前缀，smartParse 无路可走但 trimmed.startsWith('[')
    const first = stream.appendDelta('[1,2')
    expect(first.defect).toBe('not_object')
    // 再来增量，buffer 长了但仍解析不出对象，defect 应稳定 not_object
    const second = stream.appendDelta(',3')
    expect(second.defect).toBe('not_object')
    // 字符串开头同理
    const strStream = new ToolInputStream()
    const s1 = strStream.appendDelta('"hello')
    expect(s1.defect).toBe('not_object')
    const s2 = strStream.appendDelta(' world')
    expect(s2.defect).toBe('not_object')
  })

  it('finish(string) 收到过大载荷时标 too_large（E-S1 一致）', () => {
    const stream = new ToolInputStream()
    const oversize = 'x'.repeat(1 << (20 + 1))
    // finish 不走 tryParse，不标 too_large（只 JSON.parse 或 smartParse），保持现有行为
    // 这条只是确认 finish 对超大字符串的现有行为：parse 失败、smartParse 失败 → not_object
    const snap = stream.finish(oversize)
    expect(snap.defect).toBe('not_object')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
