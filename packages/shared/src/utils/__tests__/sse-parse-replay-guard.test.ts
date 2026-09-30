// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-640(2026-09-29 立):重放单调性守卫 —— SSE 重连按 Last-Event-ID 起播时,
// 服务端重放窗口与客户端已消费区间可能重叠(ai-service sse_buffer.replay_outcome
// 在未带游标时重放全部现存缓冲;chat 流重连服务端不支持续传时从头重发)。
// 守卫住在共享消费出口 parseSSEChunk,已消费 id 的事件在出口即被拦下,
// 不得二次进状态机;守卫可注入(SSEReplayGuard),缺省不注入时解析行为逐字不变。
import { describe, expect, it } from 'vitest'

import {
  parseSSEChunk,
  SseMonotonicReplayGuard,
  type SSEReplayGuard,
} from '../sse-parse'

/** 构造一条带 id: 游标的 chunk 事件帧(agents 任务流同形:id 行 + data 行 + 空行)。 */
function frame(id: string, content: string): string {
  return `id: ${id}\ndata: {"type":"chunk","content":"${content}"}\n\n`
}

/** 极简"状态机":只做 chunk 计数与正文拼接,重放污染会立刻表现在计数/文本上。 */
function makeStateMachine() {
  let chunkCount = 0
  let text = ''
  return {
    feed(raw: string, guard?: SSEReplayGuard) {
      const { events } = parseSSEChunk(raw, guard ? { replayGuard: guard } : undefined)
      for (const evt of events) {
        if (evt.type === 'chunk') {
          chunkCount += 1
          text += evt.content ?? ''
        }
      }
    },
    get count() {
      return chunkCount
    },
    get text() {
      return text
    },
  }
}

describe('G-640 重放单调性守卫', () => {
  it('构造面:重放窗口重叠 ⇒ 状态计数不变(已消费 id 的事件不二次进状态机)', () => {
    const guard = new SseMonotonicReplayGuard()
    const sm = makeStateMachine()

    // 第一次连接:消费 task-1..task-3
    sm.feed(frame('task-1', 'a') + frame('task-2', 'b') + frame('task-3', 'c'), guard)
    expect(sm.count).toBe(3)
    expect(sm.text).toBe('abc')

    // 断线重连:重放窗口与已消费区间重叠(task-2、task-3 重放)+ 新事件 task-4。
    // 无守卫时这里会变成 6 条 / "abcabcd";守卫拦截后计数与文本都保持单调。
    sm.feed(frame('task-2', 'b') + frame('task-3', 'c') + frame('task-4', 'd'), guard)
    expect(sm.count).toBe(4)
    expect(sm.text).toBe('abcd')
  })

  it('正向对照:游标之后的新事件照常消费', () => {
    const guard = new SseMonotonicReplayGuard()
    const first = parseSSEChunk(frame('task-1', 'a'), { replayGuard: guard })
    expect(first.events).toHaveLength(1)
    expect(first.events[0]?.type).toBe('chunk')
    expect(first.lastId).toBe('task-1')
    expect(first.replayedDropped).toBeUndefined()

    const second = parseSSEChunk(frame('task-2', 'b'), { replayGuard: guard })
    expect(second.events).toHaveLength(1)
    expect(second.lastId).toBe('task-2')
  })

  it('重放批整体被拦时 lastId 不回退(游标只随已消费事件推进)', () => {
    const guard = new SseMonotonicReplayGuard()
    parseSSEChunk(frame('task-5', 'x'), { replayGuard: guard })
    const replay = parseSSEChunk(
      frame('task-4', 'y') + frame('task-5', 'x'),
      { replayGuard: guard },
    )
    expect(replay.events).toHaveLength(0)
    expect(replay.lastId).toBeUndefined()
    expect(replay.replayedDropped).toBe(2)
  })

  it('守卫可注入:自定义 SSEReplayGuard 同样生效(精确去重语义)', () => {
    const seen = new Set<string>()
    const guard: SSEReplayGuard = {
      admit(id) {
        if (seen.has(id)) return false
        seen.add(id)
        return true
      },
    }
    const first = parseSSEChunk(frame('evt-uuid-a', 'a'), { replayGuard: guard })
    expect(first.events).toHaveLength(1)
    const second = parseSSEChunk(frame('evt-uuid-a', 'a'), { replayGuard: guard })
    expect(second.events).toHaveLength(0)
    expect(second.replayedDropped).toBe(1)
  })

  it('默认实现:非 {prefix}-{seq} 形态的 id 走精确去重,数字尾段走单调游标', () => {
    const guard = new SseMonotonicReplayGuard()
    // UUID 形态:同 id 二次 admit 被拦
    expect(guard.admit('550e8400-e29b-41d4')).toBe(true)
    expect(guard.admit('550e8400-e29b-41d4')).toBe(false)
    // task_id 自身可含 -(与后端 sse_buffer._parse_seq 同判据),尾段纯数字才单调
    expect(guard.admit('abc-def-3')).toBe(true)
    expect(guard.admit('abc-def-3')).toBe(false)
    expect(guard.admit('abc-def-2')).toBe(false)
    expect(guard.admit('abc-def-4')).toBe(true)
    // 尾段非纯数字不算 seq,退化为精确去重
    expect(guard.admit('abc-x')).toBe(true)
    expect(guard.admit('abc-x')).toBe(false)
  })

  it('流不带 id: 行(如对话流)时守卫不介入,行为与既有语义逐字一致', () => {
    const guard = new SseMonotonicReplayGuard()
    const { events, lastId, replayedDropped } = parseSSEChunk(
      'data: {"type":"chunk","content":"hi"}\n\ndata: {"type":"chunk","content":"!"}\n',
      { replayGuard: guard },
    )
    expect(events).toHaveLength(2)
    expect(lastId).toBeUndefined()
    expect(replayedDropped).toBeUndefined()
  })

  it('守卫缺省时不传 options:解析行为与既有语义逐字一致(lastId 照常提取)', () => {
    const { events, lastId, replayedDropped } = parseSSEChunk(
      frame('task-9', 'a') + frame('task-9', 'a'),
    )
    expect(events).toHaveLength(2)
    expect(lastId).toBe('task-9')
    expect(replayedDropped).toBeUndefined()
  })
})
