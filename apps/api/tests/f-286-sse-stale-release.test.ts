// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-286 回归锁(2026-11-13)。
 *
 * 病灶:同 `conversationId:messageId` 重复提交 ⇒ 新 session 覆盖 Map 并 abort 旧 controller;
 * 旧请求 finally 的 finishSession / 旧会话 graceTimer 仍按 replayKey 无条件
 * releaseStream/deleteSessionMeta,把新会话的缓冲与元数据一起清掉(60s 后重连 known:false,
 * 触发全量重新生成 = 重复计费/重复内容)。
 *
 * 本文件锁三条判据:
 * ① 旧会话 finishSession 之后,同 replayKey 新会话的缓冲仍可读、元数据仍在;
 * ② 旧会话 graceTimer 到期不删新会话的缓冲与元数据;
 * ③ 归属正确的会话收尾(finally 与 graceTimer 两条路径)仍能正常释放 —— 防"一律不释放"的假修复。
 */

import { describe, it, expect, vi } from 'vitest'
import type { FastifyReply } from 'fastify'
import {
  createSession,
  detachOnClose,
  emitEvent,
  finishSession,
  getReplayEvents,
  SSE_GRACE_PERIOD_MS,
} from '../src/utils/sse-stream-registry.js'
import { isStreamActive } from '../src/utils/sse-replay-buffer.js'
import { getSseStateStore, _resetSseStateStore } from '../src/utils/sse-state-store.js'

/** 极简 ServerResponse 桩:write 收集到数组(与既有 registry 测试同形)。 */
function mockRaw(): { raw: FastifyReply['raw']; writes: string[] } {
  const writes: string[] = []
  const raw = {
    write: (s: string) => {
      writes.push(s)
      return true
    },
    end: () => {
      /* no-op */
    },
  } as unknown as FastifyReply['raw']
  return { raw, writes }
}

function freshKey(): string {
  return `c${Math.random()}:m${Math.random()}`
}

describe('F-286 旧会话收尾不得释放同 replayKey 的新会话', () => {
  it('① 旧会话 finishSession 后,新会话缓冲仍可读、元数据仍在,且 60s 后也不被迟到清理删掉', async () => {
    vi.useFakeTimers()
    try {
      _resetSseStateStore()
      const store = getSseStateStore()
      const key = freshKey()
      const oldSession = createSession(mockRaw().raw, new AbortController(), key, 'up-old')
      emitEvent(oldSession, '{"n":1}')
      const newSession = createSession(mockRaw().raw, new AbortController(), key, 'up-new')
      emitEvent(newSession, '{"n":2}')
      expect(oldSession.owner).not.toBe(newSession.owner)

      // 旧请求 finally 收尾(Map 删除有身份复核,清理也必须复核)
      finishSession(oldSession)

      expect(getReplayEvents(key, 0).map((e) => e.rawLine)).toEqual(['data: {"n":2}'])
      expect(isStreamActive(key)).toBe(true)
      const meta = await store.fetchSessionMeta(key)
      expect(meta?.upstreamSessionId).toBe('up-new')

      // 旧会话的迟到释放若生效,会在 60s 后删掉新会话表项 —— 这里必须仍存活
      vi.advanceTimersByTime(60_000 + 1)
      expect(isStreamActive(key)).toBe(true)
      expect(getReplayEvents(key, 0)).toHaveLength(1)
      expect((await store.fetchSessionMeta(key))?.upstreamSessionId).toBe('up-new')
    } finally {
      vi.useRealTimers()
    }
  })

  it('② 旧会话 graceTimer 到期只 abort 自己的上游,不删新会话缓冲与元数据', async () => {
    vi.useFakeTimers()
    try {
      _resetSseStateStore()
      const store = getSseStateStore()
      const key = freshKey()
      const oldController = new AbortController()
      const oldSession = createSession(mockRaw().raw, oldController, key, 'up-old')
      emitEvent(oldSession, '{"n":1}')
      detachOnClose(oldSession) // 断线,宽限定时器闭包捕获旧 owner

      const newSession = createSession(mockRaw().raw, new AbortController(), key, 'up-new')
      emitEvent(newSession, '{"n":2}')

      vi.advanceTimersByTime(SSE_GRACE_PERIOD_MS + 1)
      expect(oldController.signal.aborted).toBe(true) // 旧上游仍被正常 abort
      expect(isStreamActive(key)).toBe(true)
      expect(getReplayEvents(key, 0).map((e) => e.rawLine)).toEqual(['data: {"n":2}'])
      expect((await store.fetchSessionMeta(key))?.upstreamSessionId).toBe('up-new')

      vi.advanceTimersByTime(60_000 + 1)
      expect(isStreamActive(key)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('③ finishSession 归属正确时仍正常释放缓冲并删元数据(防一律不释放)', async () => {
    vi.useFakeTimers()
    try {
      _resetSseStateStore()
      const store = getSseStateStore()
      const key = freshKey()
      const session = createSession(mockRaw().raw, new AbortController(), key, 'up-1')
      emitEvent(session, '{"n":1}')

      finishSession(session)
      expect(isStreamActive(key)).toBe(true) // 60s 重放保留窗口
      expect(await store.fetchSessionMeta(key)).toBeNull() // 归属正确 ⇒ 元数据立即删
      vi.advanceTimersByTime(60_000 + 1)
      expect(isStreamActive(key)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('③ graceTimer 归属正确时仍按 15s + 60s 正常释放缓冲', () => {
    vi.useFakeTimers()
    try {
      _resetSseStateStore()
      const key = freshKey()
      const controller = new AbortController()
      const session = createSession(mockRaw().raw, controller, key, 'up-1')
      emitEvent(session, '{"n":1}')

      detachOnClose(session)
      vi.advanceTimersByTime(SSE_GRACE_PERIOD_MS + 1)
      expect(controller.signal.aborted).toBe(true)
      expect(isStreamActive(key)).toBe(true) // 进入 60s 保留窗口
      vi.advanceTimersByTime(60_000 + 1)
      expect(isStreamActive(key)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('存储层 expectedOwner 不匹配时 releaseStream/deleteSessionMeta 静默跳过', async () => {
    vi.useFakeTimers()
    try {
      _resetSseStateStore()
      const store = getSseStateStore()
      const key = freshKey()
      store.registerStream(key, 'owner-a')
      store.appendReplayEvent(key, { id: 1, rawLine: 'data: x' })
      store.upsertSessionMeta({
        replayKey: key,
        replicaId: 'r1',
        upstreamSessionId: 'us-a',
        createdAt: Date.now(),
        owner: 'owner-a',
      })

      store.releaseStream(key, 'owner-b')
      store.deleteSessionMeta(key, 'owner-b')
      vi.advanceTimersByTime(60_000 + 1)
      expect(isStreamActive(key)).toBe(true)
      expect((await store.fetchSessionMeta(key))?.upstreamSessionId).toBe('us-a')

      store.releaseStream(key, 'owner-a')
      store.deleteSessionMeta(key, 'owner-a')
      expect(await store.fetchSessionMeta(key)).toBeNull()
      vi.advanceTimersByTime(60_000 + 1)
      expect(isStreamActive(key)).toBe(false)

      // 不传 owner 时保持旧行为(向后兼容)
      const legacyKey = freshKey()
      store.registerStream(legacyKey)
      store.releaseStream(legacyKey)
      vi.advanceTimersByTime(60_000 + 1)
      expect(isStreamActive(legacyKey)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
