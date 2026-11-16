// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-723 合帧器回归锁(2026-11-15)。
 *
 * 为什么单独为「写次数」写一把尺:合帧器的全部意义就是**减少 store 写次数**——
 * 工具 args/partialDiff 分片逐帧到达,而 store.updateToolCall 每次用
 * `s.messages.slice()` 替换整个 messages 数组引用,订阅 messages 的十余个组件
 * 跟着重渲整列表。合帧器把它们归并到 microtask 边界,同 tick 内任意多帧只写一次。
 *
 * 这把尺钉死两件事,缺一不可:
 *   ① 同步段**一帧都不写**(全部归并,而非"首帧同步 flush");
 *   ② 边界后整批只写 1 次,且内容是全部帧按序拼接(数据零丢失)。
 *
 * 历史教训:最初实现用"首个分片同步 flush"——它让每一帧都因 `had=false` 立即
 * flush 并清空 pending,下一帧又成了"首个分片",于是 10 帧触发 10 次写,
 * **合帧完全失效**。若将来有人把同步 flush 改回来,本文件的 `toBe(0)` 会当场变红。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  interface Row {
    id: string
    partialDiff?: string
    partialSeq?: number
  }
  const state = { toolCalls: [] as Row[] }
  const updateToolCall = vi.fn((_m: string, _id: string, u: Partial<Row>): void => {
    state.toolCalls = state.toolCalls.map((t) => (t.id === _id ? { ...t, ...u } : t))
  })
  const addToolCall = vi.fn((_m: string, c: { id: string } & Partial<Row>): void => {
    state.toolCalls = [...state.toolCalls, { ...c } as Row]
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

import { createToolDeltaHandler } from '@/hooks/use-chat/stream-handlers'

describe('F-723 工具帧合帧器 — 真正合并 store 写次数', () => {
  beforeEach(() => {
    h.updateToolCall.mockClear()
    h.addToolCall.mockClear()
    h.state.toolCalls = [{ id: 'tc-1' }]
  })

  it('同 tick 连续 10 帧 ⇒ 同步段 0 写,microtask 边界整批只写 1 次', async () => {
    const handler = createToolDeltaHandler('m1')
    for (let i = 1; i <= 10; i++) {
      handler({ toolCallId: 'tc-1', seq: i, partialText: `v${i}` })
    }
    // 同步段:一帧都没写(全部归并到边界)
    expect(h.updateToolCall.mock.calls.length).toBe(0)
    // microtask 边界 flush 后:整批只写 1 次,内容为全部 10 段按序拼接(零丢失)
    await Promise.resolve()
    await Promise.resolve()
    expect(h.updateToolCall.mock.calls.length).toBe(1)
    expect(h.state.toolCalls[0]?.partialDiff).toBe('v1v2v3v4v5v6v7v8v9v10')
    expect(h.state.toolCalls[0]?.partialSeq).toBe(10)
  })

  it('乱序/重传帧在归并缓冲里同样被 seq 判据丢弃,不进累积', async () => {
    const handler = createToolDeltaHandler('m1')
    handler({ toolCallId: 'tc-1', seq: 1, partialText: 'v1' })
    // seq<=1 的重放帧应被丢弃;只有真正递增的帧才累积
    handler({ toolCallId: 'tc-1', seq: 1, partialText: 'dup' })
    handler({ toolCallId: 'tc-1', seq: 2, partialText: 'v2' })
    await Promise.resolve()
    await Promise.resolve()
    expect(h.updateToolCall.mock.calls.length).toBe(1)
    expect(h.state.toolCalls[0]?.partialDiff).toBe('v1v2')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
