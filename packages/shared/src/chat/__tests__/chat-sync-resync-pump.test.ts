// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * resync 泵(phase 2 调度层)的验收面。
 *
 * 判据全在共享内核与 store:本文件只验"什么时候拉、拉完还拉不拉、停了还拉不拉"。
 * 三端(Node/RN/扩展)接的是**同一个泵**,端内只注入 fetch —— 所以这里跑通
 * 就等于三端的调度语义同源;各端真实 HTTP 另由端内用例覆盖。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { messageCreatedEvent, messagePatchedEvent, type ChatSyncEvent } from '@ihui/types'
import { createChatSyncStore } from '../chat-sync-store'
import { CHAT_SYNC_RESYNC_MAX_ATTEMPTS, resetChatSyncResyncInflight } from '../chat-sync-resync'
import { startChatSyncResyncPump } from '../chat-sync-resync-pump'

const CONV = 'conv-pump'
const MSG = 'm-pump'

function snapshotOf(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    conversationId: CONV,
    messageId: MSG,
    rev: 4,
    role: 'assistant',
    content: '权威内容',
    ...overrides,
  }
}

const noDelay = async (): Promise<void> => {}

/** 让微任务队列 + 排空循环跑完(泵内部有 await 链,单靠一次 microtask 不够) */
async function flush(times = 20): Promise<void> {
  for (let i = 0; i < times; i += 1) await Promise.resolve()
}

function seedGap(store: ReturnType<typeof createChatSyncStore>, messageId = MSG): void {
  store.applyEvent(
    messageCreatedEvent({
      conversationId: CONV,
      messageId,
      role: 'assistant',
      content: 'A',
    }).data as unknown as ChatSyncEvent,
  )
  store.applyEvent(
    messagePatchedEvent({
      conversationId: CONV,
      messageId,
      rev: 3,
      kind: 'delta',
      textDelta: 'X',
    }).data as unknown as ChatSyncEvent,
  )
}

beforeEach(() => {
  resetChatSyncResyncInflight()
})

describe('startChatSyncResyncPump(store 驱动调度)', () => {
  it('① store 排了 gap ⇒ 自动拉快照并并回,pending 清空', async () => {
    const store = createChatSyncStore()
    const fetchSnapshot = vi.fn().mockResolvedValue(snapshotOf())
    const onOutcome = vi.fn()
    const pump = startChatSyncResyncPump({
      store,
      fetchSnapshot,
      onOutcome,
      delay: noDelay,
    })

    seedGap(store)
    await flush()

    expect(fetchSnapshot).toHaveBeenCalledWith(CONV, MSG)
    expect(store.pendingResyncs()).toEqual([])
    expect(store.messagesOf(CONV)[0]?.content).toBe('权威内容')
    expect(onOutcome).toHaveBeenCalledWith({
      conversationId: CONV,
      outcome: { attempted: 1, merged: 1, dropped: 0, failed: 0 },
    })
    pump.stop()
  })

  it('② 重试耗尽 ⇒ 不在同一泵生命周期内自动重跑(不炸重试风暴)', async () => {
    const store = createChatSyncStore()
    const fetchSnapshot = vi.fn().mockRejectedValue(new Error('network'))
    const pump = startChatSyncResyncPump({
      store,
      fetchSnapshot,
      delay: noDelay,
    })

    seedGap(store)
    await flush()

    expect(fetchSnapshot).toHaveBeenCalledTimes(CHAT_SYNC_RESYNC_MAX_ATTEMPTS)
    // 坐标保留(gap 没被洗成"已对齐"),但泵不再自动追问
    expect(store.pendingResyncs()).toHaveLength(1)
    await flush()
    expect(fetchSnapshot).toHaveBeenCalledTimes(CHAT_SYNC_RESYNC_MAX_ATTEMPTS)
    pump.stop()
  })

  it('③ retryFailed() ⇒ 显式再来一轮(失败坐标的正当重试入口)', async () => {
    const store = createChatSyncStore()
    let failing = true
    const fetchSnapshot = vi
      .fn()
      .mockImplementation(() =>
        failing ? Promise.reject(new Error('network')) : Promise.resolve(snapshotOf()),
      )
    const pump = startChatSyncResyncPump({
      store,
      fetchSnapshot,
      delay: noDelay,
    })

    seedGap(store)
    await flush()
    expect(fetchSnapshot).toHaveBeenCalledTimes(CHAT_SYNC_RESYNC_MAX_ATTEMPTS)
    expect(store.pendingResyncs()).toHaveLength(1)

    failing = false
    pump.retryFailed()
    await flush()
    expect(store.pendingResyncs()).toEqual([])
    pump.stop()
  })

  it('④ 404 ⇒ dropResyncRequest 摘坐标(不让泵追一条死消息)', async () => {
    const store = createChatSyncStore()
    const fetchSnapshot = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }))
    const pump = startChatSyncResyncPump({ store, fetchSnapshot, delay: noDelay })

    seedGap(store)
    await flush()

    expect(store.pendingResyncs()).toEqual([])
    expect(fetchSnapshot).toHaveBeenCalledTimes(1)
    pump.stop()
  })

  it('⑤ stop() 之后 publish 不再发起请求', async () => {
    const store = createChatSyncStore()
    const fetchSnapshot = vi.fn().mockResolvedValue(snapshotOf())
    const pump = startChatSyncResyncPump({ store, fetchSnapshot, delay: noDelay })

    pump.stop()
    seedGap(store)
    await flush()

    expect(fetchSnapshot).not.toHaveBeenCalled()
  })

  it('⑥ 排空期间新到的 gap 不被丢(末尾续跑一轮)', async () => {
    const store = createChatSyncStore()
    const OTHER = 'm-pump-2'
    let releaseFirst: ((snap: Record<string, unknown>) => void) | null = null
    const fetchSnapshot = vi.fn().mockImplementation((_c: string, messageId: string) => {
      if (messageId === MSG) {
        return new Promise<Record<string, unknown>>((resolve) => {
          releaseFirst = resolve
        })
      }
      return Promise.resolve(snapshotOf({ messageId: OTHER }))
    })
    const pump = startChatSyncResyncPump({ store, fetchSnapshot, delay: noDelay })

    seedGap(store)
    await flush()
    expect(fetchSnapshot).toHaveBeenCalledTimes(1)

    // 第一条还挂在网络上时,第二条 gap 到达
    seedGap(store, OTHER)
    await flush()
    expect(fetchSnapshot).toHaveBeenCalledTimes(1)

    releaseFirst!(snapshotOf())
    await flush(40)

    expect(fetchSnapshot).toHaveBeenCalledTimes(2)
    expect(store.pendingResyncs()).toEqual([])
    pump.stop()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
