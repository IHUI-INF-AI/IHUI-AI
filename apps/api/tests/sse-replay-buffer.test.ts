// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import {
  getReplayWindowStatus,
  hasReplayHole,
  registerStream,
  pushEvent,
  getEventsAfter,
  isStreamActive,
  releaseStream,
} from '../src/utils/sse-replay-buffer.js'

describe('sse-replay-buffer', () => {
  it('registerStream 创建空流且 isStreamActive 为 true', () => {
    const key = `c1:m1:${Math.random()}`
    registerStream(key)
    expect(isStreamActive(key)).toBe(true)
    expect(getEventsAfter(key, -1)).toEqual([])
  })

  it('pushEvent 按序追加事件,id 自增且 rawLine 原样留存', () => {
    const key = `c2:m2:${Math.random()}`
    registerStream(key)
    pushEvent(key, { id: 0, rawLine: 'data: a\n' })
    pushEvent(key, { id: 1, rawLine: 'data: b\n' })
    const evs = getEventsAfter(key, -1)
    expect(evs.map((e) => e.id)).toEqual([0, 1])
    expect(evs[0]?.rawLine).toBe('data: a\n')
    expect(evs[1]?.rawLine).toBe('data: b\n')
  })

  it('getEventsAfter 仅返回 id > seq 的事件', () => {
    const key = `c3:m3:${Math.random()}`
    registerStream(key)
    for (let i = 0; i < 5; i++) pushEvent(key, { id: i, rawLine: `data: ${i}\n` })
    const after = getEventsAfter(key, 2)
    expect(after.map((e) => e.id)).toEqual([3, 4])
  })

  it('getEventsAfter / isStreamActive 对未知 key 返回空/false', () => {
    const missing = `nope:${Math.random()}`
    expect(getEventsAfter(missing, 0)).toEqual([])
    expect(isStreamActive(missing)).toBe(false)
  })

  it('单流超过 2000 行时 FIFO 淘汰最旧事件', () => {
    const key = `c5:m5:${Math.random()}`
    registerStream(key)
    const N = 2050
    for (let i = 0; i < N; i++) pushEvent(key, { id: i, rawLine: `data: ${i}\n` })
    const evs = getEventsAfter(key, -1)
    expect(evs.length).toBe(2000)
    expect(evs[0]?.id).toBe(N - 2000) // 最旧(id 0..49)被淘汰,首条为 50
    expect(evs[evs.length - 1]?.id).toBe(N - 1)
  })

  it('裁头必须留痕:droppedCount 等于被淘汰条数,未裁时为 0', () => {
    const notTrimmed = `d1:${Math.random()}`
    registerStream(notTrimmed)
    for (let i = 0; i < 5; i++) pushEvent(notTrimmed, { id: i, rawLine: `data: ${i}\n` })
    expect(getReplayWindowStatus(notTrimmed, -1).droppedCount).toBe(0)

    const trimmed = `d2:${Math.random()}`
    registerStream(trimmed)
    const N = 2050
    for (let i = 0; i < N; i++) pushEvent(trimmed, { id: i, rawLine: `data: ${i}\n` })
    const st = getReplayWindowStatus(trimmed, -1)
    expect(st.droppedCount).toBe(50)
    expect(st.lowestId).toBe(50)
    // 重复注册重置计数(否则一次洞会被读成永久洞)
    registerStream(trimmed)
    expect(getReplayWindowStatus(trimmed, -1).droppedCount).toBe(0)
  })

  it('未满容量 ⇒ 无洞;lastSeq 落在被裁区间 ⇒ 有洞(同一 key 两次判定翻转)', () => {
    const key = `d3:${Math.random()}`
    registerStream(key)
    for (let i = 0; i < 5; i++) pushEvent(key, { id: i, rawLine: `data: ${i}\n` })
    expect(hasReplayHole(key, -1)).toBe(false)
    expect(hasReplayHole(key, 2)).toBe(false)

    const N = 2050
    for (let i = 5; i < N; i++) pushEvent(key, { id: i, rawLine: `data: ${i}\n` })
    // 缓冲现在持有 [50 .. 2049]
    expect(hasReplayHole(key, 10)).toBe(true) // 10 落在被裁掉的 [0..49]
    expect(hasReplayHole(key, 49)).toBe(false) // 边界:尾巴正好接上
    expect(hasReplayHole(key, 48)).toBe(true) // 差 1 即为洞
  })

  it('超过 200 个流时 FIFO 淘汰最旧流', () => {
    const keys: string[] = []
    for (let i = 0; i < 210; i++) {
      const k = `cs${i}:ms${i}:${Math.random()}`
      keys.push(k)
      registerStream(k)
    }
    // 最早注册的 key(创建时间最小)应被淘汰
    expect(isStreamActive(keys[0])).toBe(false)
    expect(isStreamActive(keys[209])).toBe(true)
  })

  it('releaseStream 在 60s 后才释放缓冲', () => {
    vi.useFakeTimers()
    try {
      const key = `c7:m7:${Math.random()}`
      registerStream(key)
      pushEvent(key, { id: 0, rawLine: 'data: x\n' })
      releaseStream(key)
      expect(isStreamActive(key)).toBe(true) // 立即仍活跃
      vi.advanceTimersByTime(60_000 + 1)
      expect(isStreamActive(key)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('registerStream 重注册取消既有待释放定时器', () => {
    vi.useFakeTimers()
    try {
      const key = `c8:m8:${Math.random()}`
      registerStream(key)
      releaseStream(key)
      vi.advanceTimersByTime(30_000)
      expect(isStreamActive(key)).toBe(true)
      registerStream(key) // 重注册应清除 pending 定时器
      vi.advanceTimersByTime(60_000 + 1)
      expect(isStreamActive(key)).toBe(true) // 未被释放
    } finally {
      vi.useRealTimers()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
