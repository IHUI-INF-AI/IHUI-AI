// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-11-05 立:OpenAI 兼容流式工具调用解析(逆向-复现-超越 Qoder/Trae 的 tool-call args 流式修复)。
// 断言面:parseOpenAiStreamLine 抽出 content/tool_calls(含 index/id/name/argsFragment)/finish_reason/
// [DONE]/非 JSON 拒收;OpenAiToolCallAccumulator 按 index 增量累积 function.arguments,
// 每片即出 partial/complete 态(complete 仅当原始缓冲无需修复即 JSON.parse 通过),
// 残缺片(截断/单引号)经 json-repair 修复后给出 partial,finish+snapshot 锁定终态。
import { describe, expect, it } from 'vitest'
import {
  parseOpenAiStreamLine,
  createOpenAiToolCallAccumulator,
  parseToolCallArgsDeltaFrame,
  type OpenAiToolCallFragment,
} from './openai-tool-stream'

describe('parseOpenAiStreamLine — 行解析', () => {
  it('抽出 tool_calls 增量片段(index/id/name/argsFragment)', () => {
    const line = `data: ${JSON.stringify({
      choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'search', arguments: '{"q":' } }] } }],
    })}`
    const frame = parseOpenAiStreamLine(line)
    expect(frame).not.toBeNull()
    expect(frame!.toolCalls).toHaveLength(1)
    expect(frame!.toolCalls![0]).toEqual({ index: 0, id: 'call_1', name: 'search', argsFragment: '{"q":' })
  })

  it('抽出正文增量 content', () => {
    const line = `data: ${JSON.stringify({ choices: [{ delta: { content: '你好' } }] })}`
    const frame = parseOpenAiStreamLine(line)
    expect(frame!.content).toBe('你好')
    expect(frame!.toolCalls).toBeUndefined()
  })

  it('抽出 finish_reason(含显式 null)', () => {
    const stop = parseOpenAiStreamLine(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}`)
    expect(stop!.finishReason).toBe('stop')
    const nil = parseOpenAiStreamLine(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: null }] })}`)
    expect(nil!.finishReason).toBeNull()
  })

  it('[DONE] 与 非 JSON / 非 chat-completion 形态返回 null(不抛)', () => {
    expect(parseOpenAiStreamLine('[DONE]')).toBeNull()
    expect(parseOpenAiStreamLine('not json at all')).toBeNull()
    expect(parseOpenAiStreamLine('data: {"foo":"bar"}')).toBeNull()
    expect(parseOpenAiStreamLine('')).toBeNull()
    expect(parseOpenAiStreamLine('   ')).toBeNull()
  })
})

describe('OpenAiToolCallAccumulator — 按 index 增量累积 function.arguments', () => {
  it('逐片分片累积到完整对象:中间态 partial、末尾 complete(渐进渲染)', () => {
    const acc = createOpenAiToolCallAccumulator()
    const frags: OpenAiToolCallFragment[] = [
      { index: 0, id: 'call_1', name: 'search', argsFragment: '{"a":1' },
      { index: 0, argsFragment: ',"b":2' },
      { index: 0, argsFragment: '}' },
    ]
    const d1 = acc.pushToolCalls([frags[0]!])[0]!
    expect(d1.argsComplete).toBe(false)
    expect(d1.argsPartial).toBe(true)
    expect(d1.args).toEqual({ a: 1 })

    const d2 = acc.pushToolCalls([frags[1]!])[0]!
    expect(d2.argsComplete).toBe(false)
    expect(d2.argsPartial).toBe(true)
    expect(d2.args).toEqual({ a: 1, b: 2 })

    const d3 = acc.pushToolCalls([frags[2]!])[0]!
    expect(d3.argsComplete).toBe(true)
    expect(d3.argsPartial).toBe(false)
    expect(d3.args).toEqual({ a: 1, b: 2 })
  })

  it('单引号残缺片经 json-repair 修复后给出 partial(args 可用,但 raw 未通过故非 complete)', () => {
    const acc = createOpenAiToolCallAccumulator()
    const d = acc.pushToolCalls([{ index: 0, name: 'f', argsFragment: "{'q': 'hi'}" }])[0]!
    expect(d.argsComplete).toBe(false)
    expect(d.argsPartial).toBe(true)
    expect(d.args).toEqual({ q: 'hi' })
  })

  it('并行多 call index 互不污染(snapshot 取当前态)', () => {
    const acc = createOpenAiToolCallAccumulator()
    acc.pushToolCalls([{ index: 0, name: 'a', argsFragment: '{"x":1}' }])
    acc.pushToolCalls([{ index: 1, name: 'b', argsFragment: '{"y":2}' }])
    const snap = acc.snapshot()
    expect(snap).toHaveLength(2)
    const byIndex = Object.fromEntries(snap.map((s) => [s.index, s.args]))
    expect(byIndex[0]).toEqual({ x: 1 })
    expect(byIndex[1]).toEqual({ y: 2 })
  })

  it('finish + snapshot 锁定 complete 态(确保消费端收到完整)', () => {
    const acc = createOpenAiToolCallAccumulator()
    acc.pushToolCalls([{ index: 0, name: 'f', argsFragment: '{"done":' }])
    acc.pushToolCalls([{ index: 0, argsFragment: 'true}' }])
    acc.finish()
    const snap = acc.snapshot()
    expect(snap).toHaveLength(1)
    expect(snap[0]!.argsComplete).toBe(true)
    expect(snap[0]!.args).toEqual({ done: true })
    expect(acc.isFinished).toBe(true)
  })

  it('reset 清空累积态,可复用', () => {
    const acc = createOpenAiToolCallAccumulator()
    acc.pushToolCalls([{ index: 0, name: 'f', argsFragment: '{"a":1}' }])
    acc.reset()
    expect(acc.snapshot()).toHaveLength(0)
    expect(acc.isFinished).toBe(false)
  })

  it('残缺且无法修复的片段:partial=false、args=undefined(不抛、不误报 complete)', () => {
    const acc = createOpenAiToolCallAccumulator()
    const d = acc.pushToolCalls([{ index: 0, name: 'f', argsFragment: '{{{not json' }])[0]!
    expect(d.argsComplete).toBe(false)
    expect(d.argsPartial).toBe(false)
    expect(d.args).toBeUndefined()
  })
})

// 2026-11-05 立:ai-service 逐分片直推帧归一。两条来源(OpenAI 原生行 / 本仓自定义帧)
// 必须产出同一形状,前端才只需一份 onOpenAiToolCall handler。
describe('parseToolCallArgsDeltaFrame — ai-service 逐分片帧', () => {
  const frame = (over: Record<string, unknown> = {}) =>
    `data: ${JSON.stringify({
      type: 'tool-call-args-delta',
      index: 2,
      id: 'call_abc',
      name: 'web_search',
      args: { q: 'par' },
      argsComplete: false,
      argsPartial: true,
      ...over,
    })}`

  it('部分态帧归一为 OpenAiToolCallDelta(可直喂同一 handler)', () => {
    const d = parseToolCallArgsDeltaFrame(frame())
    expect(d).toEqual({
      index: 2,
      id: 'call_abc',
      name: 'web_search',
      args: { q: 'par' },
      argsComplete: false,
      argsPartial: true,
    })
  })

  it('完成态帧 + 裸 JSON 行同样解析', () => {
    const raw = frame({ argsComplete: true, argsPartial: false, args: { q: 'partial' } })
    const d = parseToolCallArgsDeltaFrame(raw.replace(/^data: /, ''))
    expect(d?.argsComplete).toBe(true)
    expect(d?.args).toEqual({ q: 'partial' })
  })

  it('非本帧 / event: 行 / 非法 JSON / 空行一律返回 null(不抛、不吞正文)', () => {
    expect(parseToolCallArgsDeltaFrame('event: tool-call-args-delta')).toBeNull()
    expect(parseToolCallArgsDeltaFrame('data: {"type":"chunk","content":"hi"}')).toBeNull()
    expect(parseToolCallArgsDeltaFrame('not json')).toBeNull()
    expect(parseToolCallArgsDeltaFrame('')).toBeNull()
    expect(parseToolCallArgsDeltaFrame('   ')).toBeNull()
    expect(parseToolCallArgsDeltaFrame('data: [1,2]')).toBeNull()
  })

  it('args 为 null / 数组 ⇒ undefined;缺 index ⇒ 0;空串 id/name ⇒ undefined', () => {
    expect(parseToolCallArgsDeltaFrame(frame({ args: null }))?.args).toBeUndefined()
    expect(parseToolCallArgsDeltaFrame(frame({ args: [1, 2] }))?.args).toBeUndefined()
    const d = parseToolCallArgsDeltaFrame(
      frame({ index: undefined, id: '', name: '' }),
    )
    expect(d?.index).toBe(0)
    expect(d?.id).toBeUndefined()
    expect(d?.name).toBeUndefined()
  })
})
