// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, it, expect, vi } from 'vitest'
import type { FastifyReply } from 'fastify'
import {
  createSession,
  detachOnClose,
  emitEvent,
  emitUpstreamLine,
  findSession,
  finishSession,
  getReplayEvents,
  takeoverStream,
  SSE_GRACE_PERIOD_MS,
} from '../src/utils/sse-stream-registry.js'
import { isStreamActive } from '../src/utils/sse-replay-buffer.js'

/** 极简 ServerResponse 桩:write 收集到数组,end 标记结束。 */
function mockRaw(): { raw: FastifyReply['raw']; writes: string[]; end: () => void } {
  const writes: string[] = []
  let ended = false
  const raw = {
    write: (s: string) => {
      writes.push(s)
      return true
    },
    end: () => {
      ended = true
    },
    get ended() {
      return ended
    },
  } as unknown as FastifyReply['raw']
  return {
    raw,
    writes,
    end: () => {
      ended = true
    },
  }
}

function freshKey(): string {
  return `c${Math.random()}:m${Math.random()}`
}

describe('sse-stream-registry', () => {
  it('emitUpstreamLine 对 data 行注入 id 并缓冲,重放组帧完整', () => {
    const key = freshKey()
    const { raw, writes } = mockRaw()
    const session = createSession(raw, new AbortController(), key)
    emitUpstreamLine(session, 'data: {"type":"0","value":"hi"}')
    emitUpstreamLine(session, 'data: [DONE]')
    emitUpstreamLine(session, '')
    emitUpstreamLine(session, ': comment')
    // 实时写出:id 行 + data 行 + 空行闭合
    expect(writes[0]).toBe('id: 1\ndata: {"type":"0","value":"hi"}\n\n')
    expect(writes[1]).toBe('data: [DONE]\n\n')
    expect(writes[2]).toBe('\n')
    expect(writes[3]).toBe(': comment\n')
    // 缓冲:仅 data 行([DONE]/空行/注释不缓冲),重放组帧 id + data + 闭合
    const evs = getReplayEvents(key, 0)
    expect(evs.map((e) => e.id)).toEqual([1])
    expect(evs[0]?.rawLine).toBe('data: {"type":"0","value":"hi"}')
  })

  it('replayKey 为 null 时原样透传不编号不缓冲', () => {
    const { raw, writes } = mockRaw()
    const session = createSession(raw, new AbortController(), null)
    emitEvent(session, '{"a":1}')
    expect(writes).toEqual(['data: {"a":1}\n\n'])
    expect(findSession('any:key')).toBeUndefined()
  })

  it('detachOnClose 后进入宽限期,写入丢弃,超时才 abort + 释放缓冲', () => {
    vi.useFakeTimers()
    try {
      const key = freshKey()
      const { raw } = mockRaw()
      const controller = new AbortController()
      const session = createSession(raw, controller, key)
      emitEvent(session, '{"n":1}')
      detachOnClose(session)
      // 宽限期内:未 abort,缓冲仍在(写入丢弃但不丢缓冲)
      vi.advanceTimersByTime(SSE_GRACE_PERIOD_MS - 1)
      expect(controller.signal.aborted).toBe(false)
      expect(isStreamActive(key)).toBe(true)
      // 宽限期过:abort 上游 + 安排 60s 缓冲释放
      vi.advanceTimersByTime(1)
      expect(controller.signal.aborted).toBe(true)
      expect(isStreamActive(key)).toBe(true) // 缓冲 60s 保留窗口
      vi.advanceTimersByTime(60_000 + 1)
      expect(isStreamActive(key)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('takeoverStream 重放缺失段并换绑:原会话继续向新连接写', () => {
    const key = freshKey()
    const first = mockRaw()
    const controller = new AbortController()
    const session = createSession(first.raw, controller, key)
    emitEvent(session, '{"n":1}')
    emitEvent(session, '{"n":2}')
    emitEvent(session, '{"n":3}')
    detachOnClose(session) // 客户端断线,进宽限期
    // 客户端只收到前 2 条,重连接管
    const second = mockRaw()
    const missed = takeoverStream(session, 2, second.raw)
    expect(missed.map((e) => e.id)).toEqual([3])
    // 换绑后原会话继续写 → 落到新连接
    emitEvent(session, '{"n":4}')
    expect(second.writes).toEqual(['id: 4\ndata: {"n":4}\n\n'])
    expect(first.writes.length).toBe(3) // 旧连接不再收新事件
    expect(controller.signal.aborted).toBe(false) // 宽限定时器已被接管取消
  })

  it('finishSession 清理会话并保留缓冲 60s 供尾部重放', () => {
    vi.useFakeTimers()
    try {
      const key = freshKey()
      const { raw } = mockRaw()
      const session = createSession(raw, new AbortController(), key)
      emitEvent(session, '{"n":1}')
      finishSession(session)
      expect(findSession(key)).toBeUndefined()
      expect(isStreamActive(key)).toBe(true)
      const evs = getReplayEvents(key, 0)
      expect(evs.map((e) => e.id)).toEqual([1])
      vi.advanceTimersByTime(60_000 + 1)
      expect(isStreamActive(key)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('同 replayKey 重复 createSession 防御性 abort 旧上游', () => {
    const key = freshKey()
    const c1 = new AbortController()
    const c2 = new AbortController()
    createSession(mockRaw().raw, c1, key)
    createSession(mockRaw().raw, c2, key)
    expect(c1.signal.aborted).toBe(true)
    expect(c2.signal.aborted).toBe(false)
  })

  it('finishSession 后 detachOnClose 幂等不再触发宽限 abort', () => {
    vi.useFakeTimers()
    try {
      const key = freshKey()
      const controller = new AbortController()
      const { raw } = mockRaw()
      const session = createSession(raw, controller, key)
      finishSession(session)
      detachOnClose(session)
      vi.advanceTimersByTime(SSE_GRACE_PERIOD_MS + 1)
      expect(controller.signal.aborted).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
