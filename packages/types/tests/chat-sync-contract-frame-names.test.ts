// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 B02(V2 #23)余面①(2026-10-25):chat-sync 帧名的**单一真相源**回归锁。
 *
 * 立因:`packages/shared/src/sse/contract.ts` 对 `message:created` / `message:patched`
 * 现读 0 命中 —— 契约与送信契约两套词汇表只靠"值恰好相同"保持自洽。漂移的表现不是报错,
 * 而是"一端收不到另一端的帧"(契约 §0.6)。本锁判三格:
 *   A 线格式逐字锁定:改名 = 不兼容变更,必须同批升 `CHAT_SYNC_PROTOCOL_VERSION`、
 *     改 `docs/chat-sync-contract.md` 与全部消费点;
 *   B 生产侧唯一构造器(`messageCreatedEvent` / `messagePatchedEvent`)发射的就是本表的值
 *     —— 不是第二份字面量恰好同值;
 *   C 内核(判据唯一入口)按同一批值消费:用常量拼出的事件能正常应用/判重;
 *     既有 10 例幂等回归全程用**字面量**拼事件,它们在本改后仍必须绿(旧行为不被误伤,
 *     由 `chat-sync-contract-idempotency.test.ts` 原样看守,本文件不复制那批判据)。
 */
import { describe, expect, it } from 'vitest'

import {
  CHAT_SYNC_EVENT_NAMES,
  CHAT_SYNC_PROTOCOL_VERSION,
  EMPTY_CHAT_SYNC_STATE,
  applyChatSyncEvent,
} from '../src/chat-sync-contract.js'
import { messageCreatedEvent, messagePatchedEvent } from '../src/user-broadcast.js'

const ENVELOPE = {
  protocolVersion: CHAT_SYNC_PROTOCOL_VERSION,
  channel: 'ws' as const,
  room: { kind: 'conversation' as const, conversationId: 'conv-frame-names' },
}

describe('帧名单源 A:线格式逐字锁定', () => {
  it('两枚值就是线上锚点,且互不相同(防复制粘贴写重)', () => {
    expect(CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED).toBe('message:created')
    expect(CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED).toBe('message:patched')
    expect(CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED).not.toBe(CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED)
  })
})

describe('帧名单源 B:生产侧唯一构造器发射本表的值', () => {
  it('messageCreatedEvent:event 与 data.type 同为 MESSAGE_CREATED', () => {
    const evt = messageCreatedEvent({
      conversationId: 'conv-frame-names',
      messageId: 'm-created',
      role: 'assistant',
      content: '初面',
    })
    expect(evt.event).toBe(CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED)
    expect(evt.data.type).toBe(CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED)
  })

  it('messagePatchedEvent:event 与 data.type 同为 MESSAGE_PATCHED', () => {
    const evt = messagePatchedEvent({
      conversationId: 'conv-frame-names',
      messageId: 'm-patched',
      rev: 1,
      kind: 'delta',
      textDelta: '增量',
    })
    expect(evt.event).toBe(CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED)
    expect(evt.data.type).toBe(CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED)
  })
})

describe('帧名单源 C:内核按同一批值消费', () => {
  it('常量拼的 created 应用一次;换通道重投判 duplicate 且返回原 state 引用', () => {
    const created = {
      ...ENVELOPE,
      type: CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED,
      messageId: 'm-kernel-created',
      role: 'assistant' as const,
      content: '甲',
    }
    const first = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, created)
    expect(first.result).toMatchObject({ applied: true, rev: 0 })
    const replay = applyChatSyncEvent(first.state, { ...created, channel: 'sse' })
    expect(replay.result).toMatchObject({ applied: false, reason: 'duplicate' })
    expect(replay.state).toBe(first.state)
  })

  it('常量拼的 delta 逐 rev 追加;同 rev 重投判 duplicate(旧判序不变)', () => {
    const created = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, {
      ...ENVELOPE,
      type: CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED,
      messageId: 'm-kernel-delta',
      role: 'assistant' as const,
      content: '',
    })
    expect(created.result.applied).toBe(true)

    const delta = {
      ...ENVELOPE,
      type: CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED,
      messageId: 'm-kernel-delta',
      rev: 1,
      kind: 'delta' as const,
      textDelta: '你',
    }
    const applied = applyChatSyncEvent(created.state, delta)
    expect(applied.result).toMatchObject({ applied: true, rev: 1 })
    expect(applied.state.messages.get('m-kernel-delta')?.content).toBe('你')

    const again = applyChatSyncEvent(applied.state, delta)
    expect(again.result).toMatchObject({ applied: false, reason: 'duplicate' })
    expect(again.state).toBe(applied.state)
  })

  it('常量拼的 delta 断链仍判 gap(rev 链判据未被改名顺手放松)', () => {
    const created = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, {
      ...ENVELOPE,
      type: CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED,
      messageId: 'm-kernel-gap',
      role: 'assistant' as const,
      content: '',
    })
    const gap = applyChatSyncEvent(created.state, {
      ...ENVELOPE,
      type: CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED,
      messageId: 'm-kernel-gap',
      rev: 2,
      kind: 'delta' as const,
      textDelta: 'C',
    })
    expect(gap.result).toMatchObject({ applied: false, reason: 'gap', lastAppliedRev: 0 })
    expect(gap.state).toBe(created.state)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
