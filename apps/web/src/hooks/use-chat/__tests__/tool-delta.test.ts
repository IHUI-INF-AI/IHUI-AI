// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D113 onToolDelta 工厂行为测试:按 seq 收敛追加 partialDiff(重传/乱序幂等)+ 空 toolCallId 丢弃
import { describe, expect, it, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  interface Row {
    id: string
    partialDiff?: string
    partialSeq?: number
  }
  const state: { toolCalls: Row[] } = { toolCalls: [] }
  const updateToolCall = vi.fn(
    (_messageId: string, toolCallId: string, updates: Partial<Row>): void => {
      state.toolCalls = state.toolCalls.map((t) => (t.id === toolCallId ? { ...t, ...updates } : t))
    },
  )
  return { state, updateToolCall }
})

vi.mock('@/stores/chat', () => ({
  useChatStore: {
    getState: () => ({
      messages: [{ id: 'm1', toolCalls: h.state.toolCalls }],
      updateToolCall: h.updateToolCall,
    }),
  },
}))

import { createToolDeltaHandler } from '../stream-handlers'

const evt = (over: Partial<{ toolCallId: string; seq: number; partialText: string }> = {}) => ({
  toolCallId: 'tc-1',
  seq: 1,
  partialText: 'line1\nline2',
  ...over,
})

describe('createToolDeltaHandler — D113 流中 diff 预览', () => {
  beforeEach(() => {
    h.updateToolCall.mockClear()
    h.state.toolCalls = [{ id: 'tc-1' }]
  })

  it('首帧:按 seq 追加写入 (messageId, toolCallId, { partialDiff, partialSeq })', () => {
    createToolDeltaHandler('m1')(evt())
    expect(h.updateToolCall).toHaveBeenCalledWith('m1', 'tc-1', {
      partialDiff: 'line1\nline2',
      partialSeq: 1,
    })
  })

  it('递增 seq → 增量追加到已有 partialDiff(不是整帧覆盖)', () => {
    const handler = createToolDeltaHandler('m1')
    handler(evt({ seq: 1, partialText: 'v1' }))
    handler(evt({ seq: 2, partialText: 'v2' }))
    expect(h.state.toolCalls[0]?.partialDiff).toBe('v1v2')
    expect(h.state.toolCalls[0]?.partialSeq).toBe(2)
  })

  it('重传/乱序(evt.seq<=已存 partialSeq)→ 丢弃,零写入', () => {
    h.state.toolCalls = [{ id: 'tc-1', partialDiff: 'v1v2', partialSeq: 2 }]
    const handler = createToolDeltaHandler('m1')
    handler(evt({ seq: 2, partialText: '重放' }))
    handler(evt({ seq: 1, partialText: '更旧' }))
    expect(h.updateToolCall).not.toHaveBeenCalled()
    expect(h.state.toolCalls[0]?.partialDiff).toBe('v1v2')
  })

  it('缺口(seq>partialSeq+1)照追加,不因缺口丢帧', () => {
    h.state.toolCalls = [{ id: 'tc-1', partialDiff: 'v1', partialSeq: 1 }]
    createToolDeltaHandler('m1')(evt({ seq: 4, partialText: 'v4' }))
    expect(h.state.toolCalls[0]?.partialDiff).toBe('v1v4')
    expect(h.state.toolCalls[0]?.partialSeq).toBe(4)
  })

  it('空 toolCallId → 丢弃,零写入', () => {
    createToolDeltaHandler('m1')(evt({ toolCallId: '' }))
    expect(h.updateToolCall).not.toHaveBeenCalled()
  })

  it('列表里无该 toolCallId(start 帧未到)→ 不凭空造条目,零写入', () => {
    createToolDeltaHandler('m1')(evt({ toolCallId: 'ghost' }))
    expect(h.updateToolCall).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
