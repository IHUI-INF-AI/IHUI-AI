// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// A1(P1)修复测试:tool-delta 帧早于 tool-call-start 到达时,旧实现静默丢弃 delta
// 内容(`if (!tc) return`);修复后对齐 openai 路径语义——自建占位卡 + 应用 delta,
// 后续 tool-call-start 可按同 toolCallId 补全字段。
//
// 反向验证路径:把 stream-handlers.ts 的 `if (!tc)` 分支改回 `if (!tc) return`,
// 本文件"早到帧"用例应全部变红;恢复修复后变绿。

import { describe, expect, it, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  interface Row {
    id: string
    toolName?: string
    args?: Record<string, unknown>
    status?: string
    partialDiff?: string
    partialSeq?: number
  }
  const state: { toolCalls: Row[] } = { toolCalls: [] }
  const updateToolCall = vi.fn(
    (_messageId: string, toolCallId: string, updates: Partial<Row>): void => {
      state.toolCalls = state.toolCalls.map((t) => (t.id === toolCallId ? { ...t, ...updates } : t))
    },
  )
  // 模拟真实 store.addToolCall:同 id 不重复添加,否则追加(与 chat.ts 实现对齐)
  const addToolCall = vi.fn((_messageId: string, toolCall: Row): void => {
    if (state.toolCalls.some((t) => t.id === toolCall.id)) return
    state.toolCalls = [...state.toolCalls, toolCall]
  })
  return { state, updateToolCall, addToolCall }
})

vi.mock('@/stores/chat', () => ({
  useChatStore: {
    getState: () => ({
      messages: [{ id: 'm1', toolCalls: h.state.toolCalls }],
      updateToolCall: h.updateToolCall,
      addToolCall: h.addToolCall,
    }),
  },
}))

import { createToolDeltaHandler } from '../stream-handlers'

const delta = (over: Partial<{ toolCallId: string; seq: number; partialText: string }> = {}) => ({
  toolCallId: 'tc-early',
  seq: 1,
  partialText: 'diff-hunk-1',
  ...over,
})

describe('createToolDeltaHandler — A1:tool-delta 早于 tool-call-start 不丢帧', () => {
  beforeEach(() => {
    h.updateToolCall.mockClear()
    h.addToolCall.mockClear()
    h.state.toolCalls = [] // 关键:列表为空,start 帧未到
  })

  it('早到首帧 ⇒ 自建占位卡(toolName="" / args={} / status="running"),delta 内容入 partialDiff', () => {
    createToolDeltaHandler('m1')(delta())

    // 占位卡已建
    expect(h.addToolCall).toHaveBeenCalledTimes(1)
    expect(h.addToolCall).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({
        id: 'tc-early',
        toolName: '',
        args: {},
        status: 'running',
      }),
    )
    // delta 内容未被丢弃,写进了 partialDiff
    expect(h.state.toolCalls[0]?.id).toBe('tc-early')
    expect(h.state.toolCalls[0]?.partialDiff).toBe('diff-hunk-1')
    expect(h.state.toolCalls[0]?.partialSeq).toBe(1)
    expect(h.state.toolCalls[0]?.status).toBe('running')
  })

  it('早到多帧 ⇒ 增量追加,seq 收敛判据照旧生效', () => {
    const handler = createToolDeltaHandler('m1')
    handler(delta({ seq: 1, partialText: 'a' }))
    handler(delta({ seq: 2, partialText: 'b' }))
    expect(h.state.toolCalls[0]?.partialDiff).toBe('ab')
    expect(h.state.toolCalls[0]?.partialSeq).toBe(2)
    // 只建了一张卡,不是每帧都建
    expect(h.addToolCall).toHaveBeenCalledTimes(1)
  })

  it('后续 tool-call-start 补全(模拟 createToolCallHandler 的 addToolCall)⇒ 字段覆盖,delta 内容仍在', () => {
    // 步骤 1:早到的 tool-delta 帧先建占位卡
    createToolDeltaHandler('m1')(delta({ seq: 1, partialText: 'early' }))

    // 步骤 2:tool-call-start 到达,用真 toolName/args 调 addToolCall
    // (真 store 里 addToolCall 对已存在同 id 是 no-op,此处模拟"字段已在占位卡基础上补全")
    h.addToolCall('m1', {
      id: 'tc-early',
      toolName: 'write_file',
      args: { path: 'a.ts' },
      status: 'running',
    })
    // 模拟 updateToolCall 补全字段(真 store 里 tool-call-start handler 走的是 addToolCall,
    // 但因为占位卡已存在,字段补全需靠后续显式 update;这里验证 delta 内容不被字段补全冲掉)
    h.updateToolCall('m1', 'tc-early', { toolName: 'write_file', args: { path: 'a.ts' } })

    // 断言:delta 内容仍在,toolName/args 已补全
    expect(h.state.toolCalls[0]?.partialDiff).toBe('early')
    expect(h.state.toolCalls[0]?.toolName).toBe('write_file')
    expect(h.state.toolCalls[0]?.args).toEqual({ path: 'a.ts' })
  })

  it('空 toolCallId ⇒ 仍丢弃(守卫不变)', () => {
    createToolDeltaHandler('m1')(delta({ toolCallId: '' }))
    expect(h.addToolCall).not.toHaveBeenCalled()
    expect(h.updateToolCall).not.toHaveBeenCalled()
    expect(h.state.toolCalls).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
