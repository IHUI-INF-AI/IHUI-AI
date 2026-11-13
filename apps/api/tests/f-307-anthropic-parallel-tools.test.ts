// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-307 回归锁(2026-11-13)。
 *
 * 病灶:OpenAI→Anthropic 流式适配器忽略 `choices[].delta.tool_calls[].index`,
 * 只有单个 toolUseStarted + 单个 blockIndex。并行工具调用(index 0/1)时第二个工具被吞,
 * 两段 arguments 拼进第一个 tool_use block ⇒ 非法 JSON。
 *
 * 判据(直接喂适配器纯函数,不连库/不打上游):
 *  ① index 0/1 各产生独立 content_block_start,block index 互不相同;
 *  ② 两个 block 的 partial_json 分别拼接后各自 JSON.parse 成功且内容正确;
 *  ③ 未带 index 的单工具老流仍按原行为工作(缺省视作 0)。
 */
import { describe, it, expect } from 'vitest'
import {
  createStreamState,
  openAIStreamChunkToAnthropicEvents,
  type AnthropicSSEEvent,
  type OpenAIChatChunk,
  type StreamState,
} from '../src/services/anthropic-adapter'

type Delta = OpenAIChatChunk['choices'][0]['delta']
type ToolCallDelta = NonNullable<Delta['tool_calls']>[number]
type BlockStartEvent = Extract<AnthropicSSEEvent, { type: 'content_block_start' }>
type ToolStartEvent = BlockStartEvent & { content_block: { type: 'tool_use' } }

function makeChunk(delta: Delta, finishReason: string | null = null): OpenAIChatChunk {
  return {
    id: 'chatcmpl-f307',
    model: 'claude-3-5-sonnet',
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  }
}

function runChunks(chunks: OpenAIChatChunk[]): {
  state: StreamState
  events: AnthropicSSEEvent[]
} {
  const state = createStreamState('claude-3-5-sonnet')
  const events: AnthropicSSEEvent[] = []
  for (const chunk of chunks) {
    events.push(...openAIStreamChunkToAnthropicEvents(chunk, state))
  }
  return { state, events }
}

function toolStarts(events: AnthropicSSEEvent[]): ToolStartEvent[] {
  return events.filter(
    (e): e is ToolStartEvent =>
      e.type === 'content_block_start' && e.content_block.type === 'tool_use',
  )
}

/** 按 content block index 聚合 input_json_delta,模拟客户端拼装参数 */
function jsonByBlockIndex(events: AnthropicSSEEvent[]): Map<number, string> {
  const acc = new Map<number, string>()
  for (const e of events) {
    if (e.type === 'content_block_delta' && e.delta.type === 'input_json_delta') {
      acc.set(e.index, (acc.get(e.index) ?? '') + e.delta.partial_json)
    }
  }
  return acc
}

describe('F-307:并行 tool_calls 各占独立 content block', () => {
  it('index 0/1 各产生独立 content_block_start,block index 互不相同', () => {
    const { events } = runChunks([
      makeChunk({
        role: 'assistant',
        tool_calls: [
          {
            index: 0,
            id: 'call_weather',
            type: 'function',
            function: { name: 'get_weather', arguments: '' },
          },
          {
            index: 1,
            id: 'call_time',
            type: 'function',
            function: { name: 'get_time', arguments: '' },
          },
        ],
      }),
      makeChunk({
        tool_calls: [
          { index: 0, function: { arguments: '{"city":' } },
          { index: 1, function: { arguments: '{"tz":' } },
        ],
      }),
      makeChunk({
        tool_calls: [
          { index: 0, function: { arguments: '"北京"}' } },
          { index: 1, function: { arguments: '"UTC"}' } },
        ],
      }),
      makeChunk({}, 'tool_calls'),
    ])

    const starts = toolStarts(events)
    expect(starts).toHaveLength(2)
    expect(starts.map((s) => s.content_block.id).sort()).toEqual(['call_time', 'call_weather'])
    expect(starts[0]!.index).not.toBe(starts[1]!.index)
    // 事件序列里每个 tool block 只 start 一次、stop 一次
    const stops = events.filter((e) => e.type === 'content_block_stop').map((e) => e.index)
    for (const s of starts) {
      expect(stops.filter((i) => i === s.index)).toHaveLength(1)
    }
    const msgDelta = events.find((e) => e.type === 'message_delta')
    expect(msgDelta?.type === 'message_delta' ? msgDelta.delta.stop_reason : null).toBe('tool_use')
  })

  it('两块 arguments 分别可 JSON.parse 且内容正确(不再拼接成非法 JSON)', () => {
    const { events } = runChunks([
      makeChunk({
        role: 'assistant',
        tool_calls: [
          {
            index: 0,
            id: 'call_weather',
            type: 'function',
            function: { name: 'get_weather', arguments: '' },
          },
          {
            index: 1,
            id: 'call_time',
            type: 'function',
            function: { name: 'get_time', arguments: '' },
          },
        ],
      }),
      makeChunk({
        tool_calls: [
          { index: 0, function: { arguments: '{"city":' } },
          { index: 1, function: { arguments: '{"tz":' } },
        ],
      }),
      makeChunk({
        tool_calls: [
          { index: 0, function: { arguments: '"北京"}' } },
          { index: 1, function: { arguments: '"UTC"}' } },
        ],
      }),
      makeChunk({}, 'tool_calls'),
    ])

    const starts = toolStarts(events)
    const startByToolId = new Map(starts.map((s) => [s.content_block.id, s]))
    const weatherStart = startByToolId.get('call_weather')
    const timeStart = startByToolId.get('call_time')
    expect(weatherStart).toBeDefined()
    expect(timeStart).toBeDefined()

    const args = jsonByBlockIndex(events)
    // 每个 index 只累积自己那一路参数
    expect(args.size).toBe(2)
    const weatherJson = args.get(weatherStart!.index) ?? ''
    const timeJson = args.get(timeStart!.index) ?? ''
    expect(weatherJson).toBe('{"city":"北京"}')
    expect(timeJson).toBe('{"tz":"UTC"}')
    expect(() => JSON.parse(weatherJson)).not.toThrow()
    expect(() => JSON.parse(timeJson)).not.toThrow()
    expect(JSON.parse(weatherJson)).toEqual({ city: '北京' })
    expect(JSON.parse(timeJson)).toEqual({ tz: 'UTC' })
  })

  it('未带 index 的单工具老流仍正常(缺省视作 0)', () => {
    const legacyStart = {
      id: 'call_legacy',
      type: 'function',
      function: { name: 'get_weather', arguments: '' },
    } as unknown as ToolCallDelta
    const legacyArgs = {
      function: { arguments: '{"city":"北京"}' },
    } as unknown as ToolCallDelta

    const { state, events } = runChunks([
      makeChunk({ content: 'thinking' }),
      makeChunk({ tool_calls: [legacyStart] }),
      makeChunk({ tool_calls: [legacyArgs] }),
      makeChunk({}, 'tool_calls'),
    ])

    const starts = toolStarts(events)
    expect(starts).toHaveLength(1)
    const toolStart = starts[0]!
    expect(toolStart.content_block.id).toBe('call_legacy')
    expect(toolStart.content_block.name).toBe('get_weather')

    // 文本块与工具块不能共用 index
    const textStart = events.find(
      (e) => e.type === 'content_block_start' && e.content_block.type === 'text',
    )
    expect(textStart).toBeDefined()
    expect(toolStart.index).not.toBe(textStart!.index)

    const args = jsonByBlockIndex(events)
    expect(args.get(toolStart.index)).toBe('{"city":"北京"}')
    expect(JSON.parse(args.get(toolStart.index) ?? '')).toEqual({ city: '北京' })

    const stops = events.filter((e) => e.type === 'content_block_stop').map((e) => e.index)
    expect(stops.filter((i) => i === toolStart.index)).toHaveLength(1)
    expect(stops.filter((i) => i === textStart!.index)).toHaveLength(1)
    expect(state.toolUseStarted).toBe(false)
    expect(state.contentBlockStarted).toBe(false)
  })
})
