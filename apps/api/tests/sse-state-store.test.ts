// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSE 状态层单测(2026-09-19 立,registry 两层架构改造的守门测试)。
 *
 * 覆盖默认 memory 后端(测试环境 config.SSE_REGISTRY_BACKEND 未设置 → 默认):
 * - 工厂单例 + _resetSseStateStore 重建
 * - 回放帧三方法对 sse-replay-buffer 的委托等价性(绑定层行为零变化的基础)
 * - fetchReplayEvents 异步读与同步 getEventsAfter 结果一致
 * - 会话元数据 upsert/fetch/delete 生命周期
 * - publishAbort/onRemoteAbort 在 memory 下的 no-op 安全性
 * - SSE_REPLICA_ID 进程级标识存在
 *
 * Redis 后端依赖真实连接(旁路双写/Pub/Sub),属集成测试范畴,不在单测中触发。
 */

import { describe, it, expect, vi } from 'vitest'
import {
  getSseStateStore,
  _resetSseStateStore,
  SSE_REPLICA_ID,
} from '../src/utils/sse-state-store.js'
import { getEventsAfter } from '../src/utils/sse-replay-buffer.js'

function freshKey(): string {
  return `c${Math.random()}:m${Math.random()}`
}

describe('sse-state-store(memory 默认后端)', () => {
  it('工厂返回单例且 backend 为 memory(测试环境默认)', () => {
    const a = getSseStateStore()
    const b = getSseStateStore()
    expect(a).toBe(b)
    expect(a.backend).toBe('memory')
    _resetSseStateStore()
    const c = getSseStateStore()
    expect(c).not.toBe(a) // reset 后重建
    expect(c.backend).toBe('memory')
  })

  it('SSE_REPLICA_ID 为进程级非空标识', () => {
    expect(typeof SSE_REPLICA_ID).toBe('string')
    expect(SSE_REPLICA_ID.length).toBeGreaterThan(0)
  })

  it('appendReplayEvent 委托本地缓冲:与直接 getEventsAfter 结果一致(行为零变化)', async () => {
    const store = getSseStateStore()
    const key = freshKey()
    store.registerStream(key)
    store.appendReplayEvent(key, { id: 1, rawLine: 'data: {"n":1}' })
    store.appendReplayEvent(key, { id: 2, rawLine: 'data: {"n":2}' })
    expect(getEventsAfter(key, 0).map((e) => e.id)).toEqual([1, 2])
    // fetchReplayEvents 异步读(跨副本接口)与同步读一致
    await expect(store.fetchReplayEvents(key, 1)).resolves.toEqual([
      { id: 2, rawLine: 'data: {"n":2}' },
    ])
  })

  it('releaseStream 后 60s 缓冲释放语义保留(委托 releaseStream)', () => {
    vi.useFakeTimers()
    try {
      const store = getSseStateStore()
      const key = freshKey()
      store.registerStream(key)
      store.appendReplayEvent(key, { id: 1, rawLine: 'data: x' })
      store.releaseStream(key)
      vi.advanceTimersByTime(60_000 + 1)
      expect(getEventsAfter(key, 0)).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('会话元数据 upsert/fetch/delete 生命周期', async () => {
    const store = getSseStateStore()
    const key = freshKey()
    expect(await store.fetchSessionMeta(key)).toBeNull()
    store.upsertSessionMeta({
      replayKey: key,
      replicaId: SSE_REPLICA_ID,
      upstreamSessionId: 'us-1',
      createdAt: Date.now(),
    })
    const meta = await store.fetchSessionMeta(key)
    expect(meta?.replicaId).toBe(SSE_REPLICA_ID)
    expect(meta?.upstreamSessionId).toBe('us-1')
    store.deleteSessionMeta(key)
    expect(await store.fetchSessionMeta(key)).toBeNull()
  })

  it('memory 下 publishAbort/onRemoteAbort 为 no-op 不抛错', () => {
    const store = getSseStateStore()
    expect(() =>
      store.publishAbort({
        conversationId: 'c1',
        messageId: null,
        fromReplicaId: 'other',
      }),
    ).not.toThrow()
    expect(() =>
      store.onRemoteAbort(() => {
        /* 单副本无远端消息源,不会被调用 */
      }),
    ).not.toThrow()
  })

  it('dispose 清理不抛错且单例可重建', () => {
    const store = getSseStateStore()
    expect(() => store.dispose()).not.toThrow()
    _resetSseStateStore()
    expect(getSseStateStore().backend).toBe('memory')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
