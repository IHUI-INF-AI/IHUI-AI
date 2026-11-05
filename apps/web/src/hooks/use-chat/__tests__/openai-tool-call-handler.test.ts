// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-11-05 立:createOpenAiToolCallHandler 行为锁 —— 工具入参逐分片渐进渲染。
// 断言面:首片建 running 卡 / 按 index 归位不重复建卡 / complete 收口 /
// 无法修复片不清空已有预览 / 不同 index 隔离 / 空 id 合成稳定映射。
import { describe, expect, it, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  interface Row {
    id: string
    toolName: string
    args: Record<string, unknown>
    status: string
    partialArgs?: Record<string, unknown>
    argsStreaming?: boolean
  }
  const state: { toolCalls: Row[] } = { toolCalls: [] }
  const addToolCall = vi.fn((_messageId: string, row: Row): void => {
    state.toolCalls.push(row)
  })
  const updateToolCall = vi.fn(
    (_messageId: string, toolCallId: string, updates: Partial<Row>): void => {
      state.toolCalls = state.toolCalls.map((t) =>
        t.id === toolCallId ? { ...t, ...updates } : t,
      )
    },
  )
  return { state, addToolCall, updateToolCall }
})

vi.mock('@/stores/chat', () => ({
  useChatStore: {
    getState: () => ({
      messages: [{ id: 'm1', toolCalls: h.state.toolCalls }],
      addToolCall: h.addToolCall,
      updateToolCall: h.updateToolCall,
    }),
  },
}))

import { createOpenAiToolCallHandler } from '../stream-handlers'

type Delta = Parameters<ReturnType<typeof createOpenAiToolCallHandler>>[0]

const delta = (over: Partial<Delta> = {}): Delta => ({
  index: 0,
  id: 'call_a',
  name: 'web_search',
  args: { q: 'te' },
  argsComplete: false,
  argsPartial: true,
  ...over,
})

describe('createOpenAiToolCallHandler — 工具入参逐分片渐进渲染', () => {
  beforeEach(() => {
    h.addToolCall.mockClear()
    h.updateToolCall.mockClear()
    h.state.toolCalls = []
  })

  it('首片 partial:建 running 卡,args 留空,只写 partialArgs + argsStreaming', () => {
    createOpenAiToolCallHandler('m1')(delta())
    expect(h.addToolCall).toHaveBeenCalledTimes(1)
    expect(h.state.toolCalls[0]).toMatchObject({
      id: 'call_a',
      toolName: 'web_search',
      args: {},
      status: 'running',
      partialArgs: { q: 'te' },
      argsStreaming: true,
    })
  })

  it('后续片不带 id/name:按 index 归位到同一张卡,不重复建卡', () => {
    const handler = createOpenAiToolCallHandler('m1')
    handler(delta())
    handler(delta({ id: undefined, name: undefined, args: { q: 'tes' } }))
    expect(h.addToolCall).toHaveBeenCalledTimes(1)
    expect(h.state.toolCalls).toHaveLength(1)
    expect(h.state.toolCalls[0]?.partialArgs).toEqual({ q: 'tes' })
    expect(h.state.toolCalls[0]?.args).toEqual({})
  })

  it('complete 到达:写正式 args 并清预览(正式渲染不被流式态污染)', () => {
    const handler = createOpenAiToolCallHandler('m1')
    handler(delta())
    handler(delta({
      id: undefined,
      name: undefined,
      args: { q: 'test' },
      argsComplete: true,
      argsPartial: false,
    }))
    expect(h.state.toolCalls[0]?.args).toEqual({ q: 'test' })
    expect(h.state.toolCalls[0]?.partialArgs).toBeUndefined()
    expect(h.state.toolCalls[0]?.argsStreaming).toBeUndefined()
  })

  it('无法修复的片(args=undefined):保留上一次部分对象,不把预览清成空白', () => {
    const handler = createOpenAiToolCallHandler('m1')
    handler(delta())
    handler(delta({ id: undefined, name: undefined, args: undefined, argsPartial: false }))
    expect(h.state.toolCalls[0]?.partialArgs).toEqual({ q: 'te' })
    expect(h.state.toolCalls[0]?.argsStreaming).toBe(true)
  })

  it('不同 index 各自建卡,互不污染', () => {
    const handler = createOpenAiToolCallHandler('m1')
    handler(delta())
    handler(delta({
      index: 1,
      id: 'call_b',
      name: 'read_file',
      args: { path: '/a' },
      argsComplete: true,
      argsPartial: false,
    }))
    expect(h.addToolCall).toHaveBeenCalledTimes(2)
    expect(h.state.toolCalls[0]?.partialArgs).toEqual({ q: 'te' })
    expect(h.state.toolCalls[1]).toMatchObject({ id: 'call_b', args: { path: '/a' } })
  })

  it('后端 id 为空:合成稳定 id,同 index 多片仍落同一张卡', () => {
    const handler = createOpenAiToolCallHandler('m1')
    handler(delta({ id: undefined }))
    handler(delta({ id: undefined, name: undefined, args: { q: 'tes' } }))
    expect(h.addToolCall).toHaveBeenCalledTimes(1)
    expect(h.state.toolCalls[0]?.id).toBe('openai-0')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
