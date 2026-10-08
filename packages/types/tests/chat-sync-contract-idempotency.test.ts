// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票71(V2 #23)「同一消息 patch 幂等」判据的常驻回归(2026-10-08 契约先行切片)。
 *
 * 这一份为什么必须在仓库里:双通道(sse 单播流 / ws 房间广播)都按 at-least-once 投递,
 * 同一逻辑变更大概率到达两次。判据放松的表现不是报错,而是"看端文本翻倍 / 迟到 delta
 * 复活半截旧内容 / 断链静默错位"——每一跳自己看都是好的。所以每一条裁定(duplicate /
 * stale / gap / 应用)都有用例钉住,并有一条**收敛判据**:任一事件序列逐帧双投递,
 * 终态必须与单投递逐字一致(apply∘apply = apply)。裁定表与 docs/chat-sync-contract.md
 * §4 逐字同源,改必须两边一起改。
 */
import { describe, expect, it } from 'vitest'

import {
  applyChatSyncEvent,
  CHAT_SYNC_PROTOCOL_VERSION,
  chatPatchKey,
  chatSyncIdempotencyKey,
  EMPTY_CHAT_SYNC_STATE,
  type ChatMessageCreatedEvent,
  type ChatMessagePatchedEvent,
  type ChatSyncEvent,
  type ChatSyncMessageSurface,
  type ChatSyncState,
} from '../src/chat-sync-contract.js'

const ROOM = { kind: 'conversation' as const, conversationId: 'conv-1' }

function createdEvent(overrides: Partial<ChatMessageCreatedEvent> = {}): ChatMessageCreatedEvent {
  return {
    type: 'message:created',
    protocolVersion: CHAT_SYNC_PROTOCOL_VERSION,
    channel: 'sse',
    room: ROOM,
    messageId: 'm1',
    role: 'assistant',
    content: '',
    ...overrides,
  }
}

function deltaEvent(
  rev: number,
  textDelta: string,
  overrides: Partial<ChatMessagePatchedEvent> = {},
): ChatMessagePatchedEvent {
  return {
    type: 'message:patched',
    protocolVersion: CHAT_SYNC_PROTOCOL_VERSION,
    channel: 'sse',
    room: ROOM,
    messageId: 'm1',
    rev,
    kind: 'delta',
    textDelta,
    ...overrides,
  }
}

function snapshotEvent(
  rev: number,
  content: string,
  overrides: Partial<ChatMessagePatchedEvent> = {},
): ChatMessagePatchedEvent {
  return {
    type: 'message:patched',
    protocolVersion: CHAT_SYNC_PROTOCOL_VERSION,
    channel: 'sse',
    room: ROOM,
    messageId: 'm1',
    rev,
    kind: 'snapshot',
    content,
    ...overrides,
  }
}

function surfaceOf(state: ChatSyncState, messageId = 'm1'): ChatSyncMessageSurface {
  const surface = state.messages.get(messageId)
  expect(surface, '消息面应存在(created 先行)').toBeDefined()
  return surface as ChatSyncMessageSurface
}

describe('票71 同一消息 patch 幂等契约', () => {
  it('① created 落面;双投递判 duplicate 且不覆盖已收 patch 的面', () => {
    const s1 = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, createdEvent({ content: '' }))
    expect(s1.result).toEqual({ applied: true, messageId: 'm1', rev: 0 })
    expect(s1.state.messages.get('m1')?.role).toBe('assistant')

    // 流式增量已到 rev2,此时 created 重放(重连重放是常态)不得把面打回初稿
    const s2 = applyChatSyncEvent(s1.state, deltaEvent(1, '你'))
    const s3 = applyChatSyncEvent(s2.state, deltaEvent(2, '好'))
    const replay = applyChatSyncEvent(s3.state, createdEvent({ content: '' }))
    expect(replay.result).toEqual({
      applied: false,
      reason: 'duplicate',
      messageId: 'm1',
      rev: 0,
      lastAppliedRev: 2,
    })
    expect(replay.state).toBe(s3.state)
    expect(surfaceOf(replay.state).content).toBe('你好')
  })

  it('② delta 链逐 rev 追加:拼接判据', () => {
    let state = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, createdEvent()).state
    for (const [rev, text] of [
      [1, '你'],
      [2, '好'],
      [3, '!'],
    ] as const) {
      const step = applyChatSyncEvent(state, deltaEvent(rev, text))
      expect(step.result.applied).toBe(true)
      state = step.state
    }
    expect(surfaceOf(state).content).toBe('你好!')
    expect(state.appliedRevs.get('m1')).toBe(3)
  })

  it('③ 幂等主判据 apply∘apply = apply:同 envelope 二次应用零变化且引用不变', () => {
    for (const event of [deltaEvent(1, '增量'), snapshotEvent(1, '全量')]) {
      const first = applyChatSyncEvent(
        applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, createdEvent()).state,
        event,
      )
      expect(first.result.applied).toBe(true)
      const second = applyChatSyncEvent(first.state, event)
      expect(second.result).toMatchObject({
        applied: false,
        reason: 'duplicate',
        rev: 1,
        lastAppliedRev: 1,
      })
      expect(second.state).toBe(first.state)
      expect(surfaceOf(second.state).content).toBe(surfaceOf(first.state).content)
    }
  })

  it('④ stale:低 rev 迟到一律丢弃;WS 快照落地后 SSE 迟到 delta 不得回退', () => {
    // 跨通道竞速:WS 快照(rev5,含全部变更)先到,SSE 的 rev2~4 delta 迟到
    let state = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, createdEvent()).state
    const viaWs = applyChatSyncEvent(state, snapshotEvent(5, '完整回答', { channel: 'ws' }))
    expect(viaWs.result.applied).toBe(true)
    state = viaWs.state
    for (const late of [
      deltaEvent(2, '半截', { channel: 'sse' }),
      deltaEvent(4, '旧文本', { channel: 'sse' }),
    ]) {
      const step = applyChatSyncEvent(state, late)
      expect(step.result).toMatchObject({
        applied: false,
        reason: 'stale',
        rev: late.rev,
        lastAppliedRev: 5,
      })
      expect(step.state).toBe(state)
    }
    expect(surfaceOf(state).content).toBe('完整回答')
    expect(state.appliedRevs.get('m1')).toBe(5)
  })

  it('⑤ gap:delta 断链拒绝应用且不丢帧位;补齐缺失 rev 后原序收敛', () => {
    let state = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, createdEvent()).state
    state = applyChatSyncEvent(state, deltaEvent(1, 'A')).state
    // rev3 先到(rev2 还在链上):拒绝,状态引用不变
    const gap = applyChatSyncEvent(state, deltaEvent(3, 'C'))
    expect(gap.result).toEqual({
      applied: false,
      reason: 'gap',
      messageId: 'm1',
      rev: 3,
      lastAppliedRev: 1,
    })
    expect(gap.state).toBe(state)
    // rev2 补达后,缓存里的 rev3 原样重投即收敛(不丢帧、不要求重组载荷)
    state = applyChatSyncEvent(gap.state, deltaEvent(2, 'B')).state
    const fill = applyChatSyncEvent(state, deltaEvent(3, 'C'))
    expect(fill.result.applied).toBe(true)
    expect(surfaceOf(fill.state).content).toBe('ABC')
  })

  it('⑥ snapshot 自包含:跨 gap 直接落地(恢复路径)', () => {
    let state = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, createdEvent()).state
    state = applyChatSyncEvent(state, deltaEvent(1, '半截')).state
    const jump = applyChatSyncEvent(state, snapshotEvent(4, '服务端权威全量', { channel: 'ws' }))
    expect(jump.result).toEqual({ applied: true, messageId: 'm1', rev: 4 })
    expect(surfaceOf(jump.state).content).toBe('服务端权威全量')
    expect(jump.state.appliedRevs.get('m1')).toBe(4)
  })

  it('⑦ 双通道同源判等:同一逻辑变更经 sse 与 ws 各投一次,恰好生效一次', () => {
    const viaSse = deltaEvent(1, '同一段增量', { channel: 'sse' })
    const viaWs = deltaEvent(1, '同一段增量', { channel: 'ws' })
    // 契约要求:同一逻辑变更双通道的幂等键必须相等
    expect(chatSyncIdempotencyKey(viaSse)).toBe(chatSyncIdempotencyKey(viaWs))

    const state = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, createdEvent()).state
    const first = applyChatSyncEvent(state, viaSse)
    expect(first.result.applied).toBe(true)
    const second = applyChatSyncEvent(first.state, viaWs)
    expect(second.result).toMatchObject({ applied: false, reason: 'duplicate' })
    expect(second.state).toBe(first.state)
    expect(surfaceOf(second.state).content).toBe('同一段增量')
  })

  it('⑧ created 缺失时 patch 判 gap(含链头未知);created 补达后链可恢复', () => {
    const orphan = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, deltaEvent(1, 'X'))
    expect(orphan.result).toEqual({
      applied: false,
      reason: 'gap',
      messageId: 'm1',
      rev: 1,
      lastAppliedRev: 0,
    })
    expect(orphan.state).toBe(EMPTY_CHAT_SYNC_STATE)

    const seeded = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, createdEvent())
    const patched1 = applyChatSyncEvent(seeded.state, deltaEvent(1, 'X'))
    expect(patched1.result.applied).toBe(true)
    expect(surfaceOf(patched1.state).content).toBe('X')
  })

  it('⑨ 收敛判据:任一事件序列逐帧双投递(+乱序),终态与单投递逐字一致', () => {
    // 固定脚本:created → delta 链 → WS 快照(跨通道) → 继续 delta → 一次乱序迟到帧
    const script: ChatSyncEvent[] = [
      createdEvent({ content: '' }),
      deltaEvent(1, '你'),
      deltaEvent(2, '好'),
      snapshotEvent(3, '你好,服务端已确认', { channel: 'ws' }),
      deltaEvent(4, '继续'),
      deltaEvent(5, '!'),
      deltaEvent(4, '迟到的增量'), // 乱序迟到:应判 stale 丢弃
    ]
    let single = EMPTY_CHAT_SYNC_STATE
    for (const event of script) single = applyChatSyncEvent(single, event).state

    // at-least-once:每帧都双投递(第二份模拟另一通道/重放)
    let doubled = EMPTY_CHAT_SYNC_STATE
    for (const event of script) {
      doubled = applyChatSyncEvent(doubled, event).state
      doubled = applyChatSyncEvent(doubled, event).state
    }
    expect(surfaceOf(doubled).content).toBe(surfaceOf(single).content)
    expect(doubled.appliedRevs.get('m1')).toBe(single.appliedRevs.get('m1'))
    expect(surfaceOf(doubled)).toEqual(surfaceOf(single))
  })

  it('⑩ 幂等键形状逐字锁定(改形状 = 判重缓存互不相认)', () => {
    expect(chatPatchKey({ messageId: 'm1', rev: 3 })).toBe('m1#3')
    expect(chatSyncIdempotencyKey(deltaEvent(3, ''))).toBe('m1#3')
    expect(chatSyncIdempotencyKey(createdEvent())).toBe('m1#created')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
