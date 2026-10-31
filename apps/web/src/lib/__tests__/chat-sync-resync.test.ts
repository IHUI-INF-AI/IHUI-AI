// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票71 剩余缺口②(2026-10-31):web 端 gap → resync → 合并 的编排回归。
 *
 * 钉五件事:
 *  ① gap 坐标 → 拉一次权威快照 → 走 store 的 applyChatSyncSnapshot 合并(消息落渲染面、
 *     坐标摘除、旗复位);
 *  ② 服务端明确否定(404/409)⇒ 只问一次,摘坐标,不重试风暴;
 *  ③ 瞬时失败 ⇒ 退避重试,恢复后照常合并(`delay` 注入,不真等);
 *  ④ 重试耗尽 ⇒ 坐标保留 + outcome.failed 如实计数,绝不把"没拉到"洗成"已对齐",且不抛;
 *  ⑤ 取消(切会话/卸载)⇒ 一次请求都不发;无坐标时结构上不会发请求。
 *
 * 用真实 store(判据不复制):本文件只测"触发 + 失败分类",快照合并的正确性由
 * apps/web/src/stores/__tests__/chat.test.ts 的 applyChatSyncSnapshot 用例钉住。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { fetchSnapshotMock } = vi.hoisted(() => ({ fetchSnapshotMock: vi.fn() }))

vi.mock('@/api/chat-sync-api', () => ({
  fetchChatSyncSnapshot: fetchSnapshotMock,
}))

import { EMPTY_CHAT_SYNC_STATE, type ChatSyncMessageSnapshot } from '@ihui/types'
import { useChatStore } from '@/stores/chat'
import {
  CHAT_SYNC_RESYNC_MAX_ATTEMPTS,
  resyncChatSyncGaps,
  resetChatSyncResyncInflight,
} from '../chat-sync-resync'

const CONV = 'conv-resync'
const MSG = 'm-gap-1'

function snapshotOf(overrides: Partial<ChatSyncMessageSnapshot> = {}): ChatSyncMessageSnapshot {
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

beforeEach(() => {
  resetChatSyncResyncInflight()
  fetchSnapshotMock.mockReset()
  useChatStore.setState({
    messages: [],
    conversationId: CONV,
    chatSync: EMPTY_CHAT_SYNC_STATE,
    chatSyncResyncPending: true,
    chatSyncGapMessageIds: [MSG],
    isStreaming: false,
    streamingAssistantId: null,
  })
})

describe('resyncChatSyncGaps — gap → resync → 合并', () => {
  it('① 拉回快照 ⇒ 合并进 messages、gap 坐标清空、resync 旗复位', async () => {
    fetchSnapshotMock.mockResolvedValue(snapshotOf())
    const out = await resyncChatSyncGaps({
      conversationId: CONV,
      messageIds: [MSG],
      delay: noDelay,
    })
    expect(fetchSnapshotMock).toHaveBeenCalledTimes(1)
    expect(fetchSnapshotMock).toHaveBeenCalledWith(CONV, MSG)
    expect(out).toEqual({ attempted: 1, merged: 1, dropped: 0, failed: 0 })
    const s = useChatStore.getState()
    expect(s.messages.find((m) => m.id === MSG)?.content).toBe('权威内容')
    expect(s.chatSyncGapMessageIds).toEqual([])
    expect(s.chatSyncResyncPending).toBe(false)
  })

  it('② 404 ⇒ 只问一次并摘坐标(不重试风暴),不抛', async () => {
    fetchSnapshotMock.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }))
    const out = await resyncChatSyncGaps({
      conversationId: CONV,
      messageIds: [MSG],
      delay: noDelay,
    })
    expect(fetchSnapshotMock).toHaveBeenCalledTimes(1)
    expect(out).toEqual({ attempted: 1, merged: 0, dropped: 1, failed: 0 })
    expect(useChatStore.getState().chatSyncGapMessageIds).toEqual([])
  })

  it('②b 409(角色不在契约封闭集)同样不可重试', async () => {
    fetchSnapshotMock.mockRejectedValue(Object.assign(new Error('conflict'), { status: 409 }))
    const out = await resyncChatSyncGaps({
      conversationId: CONV,
      messageIds: [MSG],
      delay: noDelay,
    })
    expect(fetchSnapshotMock).toHaveBeenCalledTimes(1)
    expect(out.dropped).toBe(1)
  })

  it('③ 瞬时失败重试后恢复 ⇒ 照常合并', async () => {
    fetchSnapshotMock
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(snapshotOf())
    const out = await resyncChatSyncGaps({
      conversationId: CONV,
      messageIds: [MSG],
      delay: noDelay,
    })
    expect(fetchSnapshotMock).toHaveBeenCalledTimes(3)
    expect(out).toEqual({ attempted: 1, merged: 1, dropped: 0, failed: 0 })
    expect(useChatStore.getState().messages.find((m) => m.id === MSG)?.content).toBe('权威内容')
  })

  it('④ 重试耗尽 ⇒ 坐标保留 + failed 计数,不抛(不把没拉到洗成已对齐)', async () => {
    fetchSnapshotMock.mockRejectedValue(new Error('network'))
    const out = await resyncChatSyncGaps({
      conversationId: CONV,
      messageIds: [MSG],
      delay: noDelay,
    })
    expect(fetchSnapshotMock).toHaveBeenCalledTimes(CHAT_SYNC_RESYNC_MAX_ATTEMPTS)
    expect(out).toEqual({ attempted: 1, merged: 0, dropped: 0, failed: 1 })
    expect(useChatStore.getState().chatSyncGapMessageIds).toEqual([MSG])
    expect(useChatStore.getState().chatSyncResyncPending).toBe(true)
  })

  it('⑤ 已取消 ⇒ 零请求;无坐标 ⇒ 零请求', async () => {
    await resyncChatSyncGaps({
      conversationId: CONV,
      messageIds: [MSG],
      isCancelled: () => true,
      delay: noDelay,
    })
    expect(fetchSnapshotMock).not.toHaveBeenCalled()
    await resyncChatSyncGaps({ conversationId: CONV, messageIds: [], delay: noDelay })
    expect(fetchSnapshotMock).not.toHaveBeenCalled()
  })

  it('同坐标并发去重:在飞期间第二次调用跳过该坐标', async () => {
    let release: ((snap: ChatSyncMessageSnapshot) => void) | null = null
    fetchSnapshotMock.mockImplementation(
      () =>
        new Promise<ChatSyncMessageSnapshot>((resolve) => {
          release = resolve
        }),
    )
    const first = resyncChatSyncGaps({ conversationId: CONV, messageIds: [MSG], delay: noDelay })
    const second = resyncChatSyncGaps({ conversationId: CONV, messageIds: [MSG], delay: noDelay })
    expect(fetchSnapshotMock).toHaveBeenCalledTimes(1)
    release!(snapshotOf())
    const [a, b] = await Promise.all([first, second])
    expect(a.merged).toBe(1)
    expect(b.attempted).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
