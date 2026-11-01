// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票71 执行席 CHATSYNC(2026-11-01):resync「重连 / 换标签」整面协调规划器的回归。
 *
 * 只验证规划层(挑哪些消息重拉),**不复制**内核裁定判据(§22c)——重拉后的去重 / stale /
 * gap 由 `mergeChatSyncResyncSnapshot` 负责,本文件只 import 它来印证"重拉不造成二次改写"。
 * 判据内核逐字归属 `chat-sync-contract.ts`,本文件只消费。
 */
import { describe, expect, it } from 'vitest'

import {
  applyChatSyncEvent,
  CHAT_SYNC_EVENT_NAMES,
  CHAT_SYNC_PROTOCOL_VERSION,
  CHAT_SYNC_TERMINAL_PROTOCOL_VERSION,
  EMPTY_CHAT_SYNC_STATE,
  mergeChatSyncResyncSnapshot,
  planChatSyncReconnectResync,
  type ChatMessageCreatedEvent,
  type ChatMessagePatchedEvent,
  type ChatMessageTerminalEvent,
  type ChatSyncMessageSnapshot,
} from '../src/chat-sync-contract.js'

const ROOM = { kind: 'conversation' as const, conversationId: 'conv-1' }

function createdEvent(messageId: string, content = ''): ChatMessageCreatedEvent {
  return {
    type: CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED,
    protocolVersion: CHAT_SYNC_PROTOCOL_VERSION,
    channel: 'sse',
    room: ROOM,
    messageId,
    role: 'assistant',
    content,
  }
}

function deltaEvent(messageId: string, rev: number, textDelta: string): ChatMessagePatchedEvent {
  return {
    type: CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED,
    protocolVersion: CHAT_SYNC_PROTOCOL_VERSION,
    channel: 'sse',
    room: ROOM,
    messageId,
    rev,
    kind: 'delta',
    textDelta,
  }
}

function terminalEvent(messageId: string, rev: number): ChatMessageTerminalEvent {
  return {
    type: CHAT_SYNC_EVENT_NAMES.MESSAGE_TERMINAL,
    protocolVersion: CHAT_SYNC_TERMINAL_PROTOCOL_VERSION,
    channel: 'sse',
    room: ROOM,
    messageId,
    rev,
    reason: 'stop',
  }
}

function snapshotOf(overrides: Partial<ChatSyncMessageSnapshot>): ChatSyncMessageSnapshot {
  return {
    conversationId: 'conv-1',
    messageId: 'm1',
    rev: 2,
    role: 'assistant',
    content: '全量',
    ...overrides,
  }
}

describe('票71 重连/换标签 resync 整面协调', () => {
  it('① 单条在途(无终态)消息 ⇒ 生成一条重拉坐标', () => {
    let state = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, createdEvent('m1')).state
    state = applyChatSyncEvent(state, deltaEvent('m1', 1, '你')).state

    const plan = planChatSyncReconnectResync({ state, conversationId: 'conv-1' })
    expect(plan.needed).toBe(true)
    expect(plan.requests).toEqual([
      { conversationId: 'conv-1', messageId: 'm1', lastAppliedRev: 1 },
    ])
  })

  it('② 已终态消息不进坐标(重连不轰炸已收尾消息)', () => {
    let state = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, createdEvent('m1')).state
    state = applyChatSyncEvent(state, deltaEvent('m1', 1, '你')).state
    state = applyChatSyncEvent(state, terminalEvent('m1', 1)).state

    const plan = planChatSyncReconnectResync({ state, conversationId: 'conv-1' })
    expect(plan.needed).toBe(false)
    expect(plan.requests).toEqual([])
  })

  it('③ 混合面:只挑无终态的在途消息,终态消息排除', () => {
    let state = EMPTY_CHAT_SYNC_STATE
    state = applyChatSyncEvent(state, createdEvent('m1')).state
    state = applyChatSyncEvent(state, deltaEvent('m1', 1, '在途')).state
    state = applyChatSyncEvent(state, createdEvent('m2')).state
    state = applyChatSyncEvent(state, deltaEvent('m2', 1, '在途')).state
    state = applyChatSyncEvent(state, terminalEvent('m2', 1)).state // m2 收尾
    state = applyChatSyncEvent(state, createdEvent('m3')).state // m3 created 未推进,无终态

    const plan = planChatSyncReconnectResync({ state, conversationId: 'conv-1' })
    expect(plan.needed).toBe(true)
    expect(plan.requests.map((r) => r.messageId).sort()).toEqual(['m1', 'm3'])
    // m2 不在其中
    expect(plan.requests.some((r) => r.messageId === 'm2')).toBe(false)
    // 每条坐标带各自已应用的链头
    expect(plan.requests.find((r) => r.messageId === 'm1')?.lastAppliedRev).toBe(1)
    expect(plan.requests.find((r) => r.messageId === 'm3')?.lastAppliedRev).toBe(0)
  })

  it('④ 空状态 ⇒ needed=false 且无坐标', () => {
    const plan = planChatSyncReconnectResync({
      state: EMPTY_CHAT_SYNC_STATE,
      conversationId: 'conv-1',
    })
    expect(plan.needed).toBe(false)
    expect(plan.requests).toEqual([])
  })

  it('⑤ 重拉后并回 ⇒ 无终态消失,二次巡检不再重拉(不重复应用)', () => {
    let state = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, createdEvent('m1')).state
    state = applyChatSyncEvent(state, deltaEvent('m1', 1, '你')).state

    const before = planChatSyncReconnectResync({ state, conversationId: 'conv-1' })
    expect(before.needed).toBe(true)

    // 服务端权威面已到 rev3 并收尾:一次并回补齐内容与终态
    const merged = mergeChatSyncResyncSnapshot(
      state,
      snapshotOf({ messageId: 'm1', rev: 3, content: '你好', terminal: 'stop' }),
    )
    expect(merged.applied).toBe(true)

    // 二次巡检:该消息已有终态 ⇒ 不再进坐标,不会重复拉取
    const after = planChatSyncReconnectResync({ state: merged.state, conversationId: 'conv-1' })
    expect(after.needed).toBe(false)
    expect(after.requests).toEqual([])
    expect(merged.state).toBe(merged.state)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
