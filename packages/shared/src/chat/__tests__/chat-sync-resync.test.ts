// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 B02 / 票71 跨端 resync 编排内核 + 共享 store dropResyncRequest 的验收面。
 *
 * 测的是**纯逻辑**:失败分类(404/409 摘坐标、瞬时退避重试、取消让路)、同坐标在飞去重、
 * 以及共享 store 的 `dropResyncRequest` 摘除已排 gap 待办。fetch / merge / drop 全部注入,
 * 不依赖任何一端的 HTTP / 状态库(各端只负责把真实的 fetch + 各自 store 动作接进来)。
 *
 * 判据不在这里重写:快照合并的正确性由 @ihui/types 契约内核与 store 的 applyChatSyncEvent /
 * mergeChatSyncResyncSnapshot 用例钉住;本文件只验证"触发 + 失败分类 + 去重"这一层。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  messageCreatedEvent,
  messagePatchedEvent,
  type ChatSyncEvent,
  type ChatSyncMessageSnapshot,
} from '@ihui/types'
import { createChatSyncStore } from '../chat-sync-store'
import {
  CHAT_SYNC_RESYNC_MAX_ATTEMPTS,
  resyncChatSyncGaps as sharedResync,
  resetChatSyncResyncInflight,
} from '../chat-sync-resync'

const CONV = 'conv-shared'
const MSG = 'm-gap-shared'

function snapshotOf(
  overrides: Partial<ChatSyncMessageSnapshot> = {},
): ChatSyncMessageSnapshot {
  return {
    conversationId: CONV,
    messageId: MSG,
    rev: 2,
    role: 'assistant',
    content: '权威内容',
    ...overrides,
  }
}

const noDelay = async (): Promise<void> => {}

/** 造一条真 gap:先建链头(rev 1),再来一条 rev=3 的 delta ⇒ 跳号,内核排 resync 待办 */
function seedGap(store: ReturnType<typeof createChatSyncStore>): void {
  store.applyEvent(
    messageCreatedEvent({
      conversationId: CONV,
      messageId: MSG,
      role: 'assistant',
      content: 'A',
    }).data as unknown as ChatSyncEvent,
  )
  store.applyEvent(
    messagePatchedEvent({
      conversationId: CONV,
      messageId: MSG,
      rev: 3,
      kind: 'delta',
      textDelta: 'X',
    }).data as unknown as ChatSyncEvent,
  )
}

beforeEach(() => {
  resetChatSyncResyncInflight()
})

describe('resyncChatSyncGaps(共享内核,注入式)', () => {
  it('① 拉回快照 ⇒ merged=1,merge 被调一次', async () => {
    const fetchSnapshot = vi.fn().mockResolvedValue(snapshotOf())
    const mergeSnapshot = vi.fn().mockResolvedValue({ merged: true })
    const dropRequest = vi.fn()
    const out = await sharedResync({
      conversationId: CONV,
      messageIds: [MSG],
      fetchSnapshot,
      mergeSnapshot,
      dropRequest,
    })
    expect(fetchSnapshot).toHaveBeenCalledTimes(1)
    expect(fetchSnapshot).toHaveBeenCalledWith(CONV, MSG)
    expect(mergeSnapshot).toHaveBeenCalledTimes(1)
    expect(out).toEqual({ attempted: 1, merged: 1, dropped: 0, failed: 0 })
  })

  it('② 404/409 ⇒ 只问一次并摘坐标(dropRequest 调用一次),不重试风暴', async () => {
    const fetchSnapshot = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }))
    const mergeSnapshot = vi.fn()
    const dropRequest = vi.fn()
    const out = await sharedResync({
      conversationId: CONV,
      messageIds: [MSG],
      fetchSnapshot,
      mergeSnapshot,
      dropRequest,
    })
    expect(fetchSnapshot).toHaveBeenCalledTimes(1)
    expect(dropRequest).toHaveBeenCalledWith(CONV, MSG)
    expect(out).toEqual({ attempted: 1, merged: 0, dropped: 1, failed: 0 })
  })

  it('②b 409(角色不在契约封闭集)同样不可重试', async () => {
    const fetchSnapshot = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('conflict'), { status: 409 }))
    const mergeSnapshot = vi.fn()
    const dropRequest = vi.fn()
    const out = await sharedResync({
      conversationId: CONV,
      messageIds: [MSG],
      fetchSnapshot,
      mergeSnapshot,
      dropRequest,
      delay: noDelay,
    })
    expect(fetchSnapshot).toHaveBeenCalledTimes(1)
    expect(out.dropped).toBe(1)
  })

  it('③ 瞬时失败重试后恢复 ⇒ merged=1', async () => {
    const fetchSnapshot = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(snapshotOf())
    const mergeSnapshot = vi.fn().mockResolvedValue({ merged: true })
    const dropRequest = vi.fn()
    const out = await sharedResync({
      conversationId: CONV,
      messageIds: [MSG],
      fetchSnapshot,
      mergeSnapshot,
      dropRequest,
      delay: noDelay,
    })
    expect(fetchSnapshot).toHaveBeenCalledTimes(3)
    expect(out).toEqual({ attempted: 1, merged: 1, dropped: 0, failed: 0 })
  })

  it('④ 重试耗尽 ⇒ failed=1 且坐标保留(dropRequest 不调),不抛', async () => {
    const fetchSnapshot = vi.fn().mockRejectedValue(new Error('network'))
    const mergeSnapshot = vi.fn()
    const dropRequest = vi.fn()
    const out = await sharedResync({
      conversationId: CONV,
      messageIds: [MSG],
      fetchSnapshot,
      mergeSnapshot,
      dropRequest,
      delay: noDelay,
    })
    expect(fetchSnapshot).toHaveBeenCalledTimes(CHAT_SYNC_RESYNC_MAX_ATTEMPTS)
    expect(dropRequest).not.toHaveBeenCalled()
    expect(out).toEqual({ attempted: 1, merged: 0, dropped: 0, failed: 1 })
  })

  it('⑤ 已取消 ⇒ 零请求;空坐标 ⇒ 零请求', async () => {
    const fetchSnapshot = vi.fn()
    const mergeSnapshot = vi.fn()
    const dropRequest = vi.fn()
    await sharedResync({
      conversationId: CONV,
      messageIds: [MSG],
      fetchSnapshot,
      mergeSnapshot,
      dropRequest,
      isCancelled: () => true,
      delay: noDelay,
    })
    expect(fetchSnapshot).not.toHaveBeenCalled()
    await sharedResync({
      conversationId: CONV,
      messageIds: [],
      fetchSnapshot,
      mergeSnapshot,
      dropRequest,
      delay: noDelay,
    })
    expect(fetchSnapshot).not.toHaveBeenCalled()
  })

  it('merge 返回 merged:false(房间不匹配)⇒ failed 且坐标不摘', async () => {
    const fetchSnapshot = vi.fn().mockResolvedValue(snapshotOf())
    const mergeSnapshot = vi.fn().mockResolvedValue({ merged: false })
    const dropRequest = vi.fn()
    const out = await sharedResync({
      conversationId: CONV,
      messageIds: [MSG],
      fetchSnapshot,
      mergeSnapshot,
      dropRequest,
      delay: noDelay,
    })
    expect(out.failed).toBe(1)
    expect(dropRequest).not.toHaveBeenCalled()
  })

  it('同坐标并发去重:在飞期间第二次调用跳过该坐标', async () => {
    let release: ((snap: ChatSyncMessageSnapshot) => void) | null = null
    const fetchSnapshot = vi.fn(
      () =>
        new Promise<ChatSyncMessageSnapshot>((resolve) => {
          release = resolve
        }),
    )
    const mergeSnapshot = vi.fn().mockResolvedValue({ merged: true })
    const dropRequest = vi.fn()
    const first = sharedResync({
      conversationId: CONV,
      messageIds: [MSG],
      fetchSnapshot,
      mergeSnapshot,
      dropRequest,
      delay: noDelay,
    })
    const second = sharedResync({
      conversationId: CONV,
      messageIds: [MSG],
      fetchSnapshot,
      mergeSnapshot,
      dropRequest,
      delay: noDelay,
    })
    expect(fetchSnapshot).toHaveBeenCalledTimes(1)
    release!(snapshotOf())
    const [a, b] = await Promise.all([first, second])
    expect(a.merged).toBe(1)
    expect(b.attempted).toBe(0)
  })
})

describe('chatSyncStore.dropResyncRequest(共享 store)', () => {
  it('摘除已排的 gap 待办(404/409 由发起器调)', () => {
    const store = createChatSyncStore()
    seedGap(store)
    expect(store.pendingResyncs()).toHaveLength(1)
    store.dropResyncRequest(CONV, MSG)
    expect(store.pendingResyncs()).toEqual([])
  })

  it('摘不存在的坐标 ⇒ 零变化、不抛(幂等安全)', () => {
    const store = createChatSyncStore()
    expect(() => store.dropResyncRequest(CONV, 'nope')).not.toThrow()
    expect(store.pendingResyncs()).toEqual([])
  })

  it('mergeResyncSnapshot 已应用 ⇒ 同样摘除待办(与 dropResyncRequest 双出口一致)', () => {
    const store = createChatSyncStore()
    seedGap(store)
    const outcome = store.mergeResyncSnapshot(snapshotOf() as never)
    expect(outcome.applied).toBe(true)
    expect(store.pendingResyncs()).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
