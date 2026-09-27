// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D113 tool-delta 流中 diff 预览(mobile-rn 承接,对齐 web use-chat/__tests__/tool-delta.test.ts 三条断言):
// ① 按 toolCallId 覆盖式写入 partialDiff;② 同 seq 重放幂等(seq 不参与判断);
// ③ 空 toolCallId 整帧丢弃零写入;另加 ④ tool-result 到达即清除预览(最终 diff 以 result 为准)。
import { describe, expect, it } from 'vitest'

import {
  applyToolCallEvent,
  applyToolDelta,
  type ToolCallItem,
} from '../src/utils/chat-render-model'

const runningItem = (over: Partial<ToolCallItem> = {}): ToolCallItem => ({
  id: 'tc-1',
  name: 'write_file',
  status: 'running',
  ...over,
})

const evt = (over: Partial<{ toolCallId: string; seq: number; partialText: string }> = {}) => ({
  toolCallId: 'tc-1',
  seq: 1,
  partialText: 'line1\nline2',
  ...over,
})

describe('applyToolDelta — D113 流中 diff 预览折叠', () => {
  it('写入:按 toolCallId 把累积文本覆盖进该条目的 partialDiff', () => {
    const out = applyToolDelta([runningItem()], evt())
    expect(out).toHaveLength(1)
    expect(out[0]?.partialDiff).toBe('line1\nline2')
    // 其余字段不动(状态/工具名/入参原样)
    expect(out[0]?.status).toBe('running')
    expect(out[0]?.name).toBe('write_file')
  })

  it('同 toolCallId 二次到达 → 覆盖式更新(重放/乱序安全,seq 不参与判断)', () => {
    const once = applyToolDelta([runningItem()], evt({ seq: 1, partialText: 'v1' }))
    const twice = applyToolDelta(once, evt({ seq: 2, partialText: 'v1\nv2' }))
    expect(twice).toHaveLength(1)
    expect(twice[0]?.partialDiff).toBe('v1\nv2')
    // 同 seq 重放:再喂一次 seq=2 的相同帧,结果逐字段不变(幂等)
    const replay = applyToolDelta(twice, evt({ seq: 2, partialText: 'v1\nv2' }))
    expect(replay[0]).toEqual(twice[0])
  })

  it('空 toolCallId → 整帧丢弃,零写入(原列表逐字段不变)', () => {
    const before = [runningItem()]
    const out = applyToolDelta(before, evt({ toolCallId: '', partialText: '不该落库' }))
    expect(out).toEqual(before)
    expect(out[0]?.partialDiff).toBeUndefined()
  })

  it('start 帧未到的 toolCallId 不凭空造条目', () => {
    const out = applyToolDelta([runningItem({ id: 'tc-other' })], evt())
    expect(out).toHaveLength(1)
    expect(out[0]?.id).toBe('tc-other')
    expect(out[0]?.partialDiff).toBeUndefined()
  })

  it('tool-result 到达即清除 partialDiff(最终 diff 以 result 为准)', () => {
    const withPreview = applyToolDelta([runningItem()], evt())
    expect(withPreview[0]?.partialDiff).toBe('line1\nline2')
    const done = applyToolCallEvent(withPreview, {
      type: 'tool-result',
      toolCallId: 'tc-1',
      toolName: 'write_file',
      result: { ok: true },
      isError: false,
    })
    expect(done).toHaveLength(1)
    expect(done[0]?.status).toBe('success')
    expect(done[0]?.partialDiff).toBeUndefined()
  })

  it('重复 tool-call-start 重放不抹掉已有流中预览', () => {
    const withPreview = applyToolDelta([runningItem()], evt({ partialText: 'v1' }))
    const restarted = applyToolCallEvent(withPreview, {
      type: 'tool-call-start',
      toolCallId: 'tc-1',
      toolName: 'write_file',
    })
    expect(restarted[0]?.partialDiff).toBe('v1')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
