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
  CHAT_SYNC_EVENT_NAMES,
  CHAT_SYNC_PROTOCOL_VERSION,
  CHAT_SYNC_TERMINAL_PROTOCOL_VERSION,
  CHAT_SYNC_TERMINAL_REASONS,
  chatPatchKey,
  chatSyncIdempotencyKey,
  EMPTY_CHAT_SYNC_STATE,
  isChatSyncTerminalReason,
  mergeChatSyncResyncSnapshot,
  planChatSyncResync,
  type ChatMessageCreatedEvent,
  type ChatMessagePatchedEvent,
  type ChatMessageTerminalEvent,
  type ChatSyncEvent,
  type ChatSyncMessageSnapshot,
  type ChatSyncMessageSurface,
  type ChatSyncState,
  type ChatSyncTerminalReason,
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

function terminalEvent(
  rev: number,
  reason: ChatSyncTerminalReason = 'stop',
  overrides: Partial<ChatMessageTerminalEvent> = {},
): ChatMessageTerminalEvent {
  return {
    type: 'message:terminal',
    protocolVersion: CHAT_SYNC_TERMINAL_PROTOCOL_VERSION,
    channel: 'sse',
    room: ROOM,
    messageId: 'm1',
    rev,
    reason,
    ...overrides,
  }
}

function snapshotOf(overrides: Partial<ChatSyncMessageSnapshot> = {}): ChatSyncMessageSnapshot {
  return {
    conversationId: 'conv-1',
    messageId: 'm1',
    rev: 2,
    role: 'assistant',
    content: '全量',
    ...overrides,
  }
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

  it('⑪ terminal 帧形态逐字锁定:独立帧 type、v2 信封、原因封闭集、幂等键仍为 (messageId, rev)', () => {
    const event = terminalEvent(3)
    expect(event.type).toBe('message:terminal')
    expect(CHAT_SYNC_EVENT_NAMES.MESSAGE_TERMINAL).toBe('message:terminal')
    expect(event.protocolVersion).toBe('chat-sync.v2')
    expect(CHAT_SYNC_TERMINAL_PROTOCOL_VERSION).toBe('chat-sync.v2')
    expect(CHAT_SYNC_PROTOCOL_VERSION).toBe('chat-sync.v1')
    // 只把 terminal 升 v2,既有两枚线格式不动(在飞的他席代码仍按 v1 消费)
    expect(createdEvent().protocolVersion).toBe(CHAT_SYNC_PROTOCOL_VERSION)
    expect(deltaEvent(1, '').protocolVersion).toBe(CHAT_SYNC_PROTOCOL_VERSION)
    expect(snapshotEvent(1, '').protocolVersion).toBe(CHAT_SYNC_PROTOCOL_VERSION)
    expect(CHAT_SYNC_TERMINAL_REASONS).toEqual([
      'stop',
      'length',
      'content_filter',
      'error',
      'aborted',
    ])
    expect(isChatSyncTerminalReason('stop')).toBe(true)
    expect(isChatSyncTerminalReason('done')).toBe(false)
    expect(isChatSyncTerminalReason(42)).toBe(false)
    expect(isChatSyncTerminalReason(undefined)).toBe(false)
    expect(chatSyncIdempotencyKey(event)).toBe('m1#3')
  })

  it('⑫ terminal 复用四态裁定:落在链头应用(不推进 rev)、重投 duplicate、低 rev stale、超前 gap', () => {
    let state = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, createdEvent()).state
    state = applyChatSyncEvent(state, deltaEvent(1, '你')).state
    state = applyChatSyncEvent(state, deltaEvent(2, '好')).state

    const applied = applyChatSyncEvent(state, terminalEvent(2, 'stop'))
    expect(applied.result).toEqual({ applied: true, messageId: 'm1', rev: 2 })
    // 终态是状态位,不新增修订号
    expect(applied.state.appliedRevs.get('m1')).toBe(2)
    expect(surfaceOf(applied.state).terminal).toEqual({ rev: 2, reason: 'stop' })
    // 终态不携带内容
    expect(surfaceOf(applied.state).content).toBe('你好')

    const replay = applyChatSyncEvent(applied.state, terminalEvent(2, 'stop', { channel: 'ws' }))
    expect(replay.result).toMatchObject({ applied: false, reason: 'duplicate', rev: 2 })
    expect(replay.state).toBe(applied.state)

    const late = applyChatSyncEvent(applied.state, terminalEvent(1, 'stop'))
    expect(late.result).toMatchObject({
      applied: false,
      reason: 'stale',
      rev: 1,
      lastAppliedRev: 2,
    })
    expect(late.state).toBe(applied.state)

    const early = applyChatSyncEvent(applied.state, terminalEvent(3, 'stop'))
    expect(early.result).toMatchObject({ applied: false, reason: 'gap', rev: 3, lastAppliedRev: 2 })
    expect(early.state).toBe(applied.state)
  })

  it('⑬ terminal 只落在已应用链头:缺行/内容未补齐判 gap,补齐后原帧重投收敛', () => {
    const orphan = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, terminalEvent(0))
    expect(orphan.result).toEqual({
      applied: false,
      reason: 'gap',
      messageId: 'm1',
      rev: 0,
      lastAppliedRev: 0,
    })
    expect(orphan.state).toBe(EMPTY_CHAT_SYNC_STATE)

    let state = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, createdEvent()).state
    state = applyChatSyncEvent(state, deltaEvent(1, '半截')).state
    const ahead = applyChatSyncEvent(state, terminalEvent(2, 'error'))
    expect(ahead.result).toMatchObject({ applied: false, reason: 'gap', rev: 2, lastAppliedRev: 1 })
    // 缺的内容 rev 补达后,同一 terminal 帧原样重投即收敛(不需重组载荷)
    state = applyChatSyncEvent(ahead.state, deltaEvent(2, '完')).state
    const retry = applyChatSyncEvent(state, terminalEvent(2, 'error'))
    expect(retry.result).toEqual({ applied: true, messageId: 'm1', rev: 2 })
    expect(surfaceOf(retry.state).terminal).toEqual({ rev: 2, reason: 'error' })
    expect(surfaceOf(retry.state).content).toBe('半截完')
  })

  it('⑭ 终态粘性:收尾后 delta 判 gap;snapshot 可推进内容但不清终态;更高链头 terminal 可替换宣告', () => {
    let state = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, createdEvent()).state
    state = applyChatSyncEvent(state, deltaEvent(1, '首段')).state
    state = applyChatSyncEvent(state, terminalEvent(1, 'stop')).state

    // rev 恰好 = last+1 也不接:流已收尾,续写应是一条新消息
    const resumed = applyChatSyncEvent(state, deltaEvent(2, '续写'))
    expect(resumed.result).toMatchObject({
      applied: false,
      reason: 'gap',
      rev: 2,
      lastAppliedRev: 1,
    })
    expect(resumed.state).toBe(state)

    // snapshot 是服务端权威修正:内容可推进,终态标记保留(不打回「进行中」)
    const repaired = applyChatSyncEvent(state, snapshotEvent(5, '修正后的全量'))
    expect(repaired.result).toEqual({ applied: true, messageId: 'm1', rev: 5 })
    expect(surfaceOf(repaired.state).content).toBe('修正后的全量')
    expect(surfaceOf(repaired.state).terminal).toEqual({ rev: 1, reason: 'stop' })

    // 更高链头上重新宣告终态:同 rev 未终态 ⇒ 应用,终态标记随链头推进
    const redeclared = applyChatSyncEvent(repaired.state, terminalEvent(5, 'length'))
    expect(redeclared.result).toEqual({ applied: true, messageId: 'm1', rev: 5 })
    expect(surfaceOf(redeclared.state).terminal).toEqual({ rev: 5, reason: 'length' })
  })

  it('⑮ planChatSyncResync 只对 gap 发起:applied/duplicate/stale 一律不发', () => {
    let state = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, createdEvent()).state
    const first = applyChatSyncEvent(state, deltaEvent(1, 'A'))
    state = first.state
    expect(planChatSyncResync({ conversationId: 'conv-1', result: first.result })).toEqual({
      needed: false,
    })

    const dup = applyChatSyncEvent(state, deltaEvent(1, 'A'))
    expect(dup.result).toMatchObject({ applied: false, reason: 'duplicate' })
    expect(planChatSyncResync({ conversationId: 'conv-1', result: dup.result })).toEqual({
      needed: false,
    })

    state = applyChatSyncEvent(state, deltaEvent(2, 'B')).state
    const stale = applyChatSyncEvent(state, deltaEvent(1, 'A'))
    expect(stale.result).toMatchObject({ applied: false, reason: 'stale' })
    expect(planChatSyncResync({ conversationId: 'conv-1', result: stale.result })).toEqual({
      needed: false,
    })

    const gap = applyChatSyncEvent(state, deltaEvent(4, 'D'))
    expect(gap.result).toMatchObject({ applied: false, reason: 'gap' })
    expect(planChatSyncResync({ conversationId: 'conv-1', result: gap.result })).toEqual({
      needed: true,
      request: { conversationId: 'conv-1', messageId: 'm1', lastAppliedRev: 2 },
    })
  })

  it('⑯ resync 并回 duplicate 路径:同快照二次合并零变化;带 terminal 快照先补终态、再并全 duplicate', () => {
    const first = mergeChatSyncResyncSnapshot(
      EMPTY_CHAT_SYNC_STATE,
      snapshotOf({ rev: 2, content: '全量' }),
    )
    expect(first.created?.applied).toBe(true)
    expect(first.content).toEqual({ applied: true, messageId: 'm1', rev: 2 })
    expect(first.terminal).toBeNull()
    expect(first.applied).toBe(true)
    expect(surfaceOf(first.state).content).toBe('全量')

    const again = mergeChatSyncResyncSnapshot(first.state, snapshotOf({ rev: 2, content: '全量' }))
    expect(again.created).toBeNull()
    expect(again.content).toMatchObject({ applied: false, reason: 'duplicate', rev: 2 })
    expect(again.terminal).toBeNull()
    expect(again.applied).toBe(false)
    expect(again.state).toBe(first.state)

    // 内容已到位但终态缺失:只补终态一步(同 rev,不新增修订号)
    const withTerminal = mergeChatSyncResyncSnapshot(
      first.state,
      snapshotOf({ rev: 2, content: '全量', terminal: 'stop' }),
    )
    expect(withTerminal.content).toMatchObject({ applied: false, reason: 'duplicate', rev: 2 })
    expect(withTerminal.terminal).toEqual({ applied: true, messageId: 'm1', rev: 2 })
    expect(withTerminal.applied).toBe(true)
    expect(surfaceOf(withTerminal.state).terminal).toEqual({ rev: 2, reason: 'stop' })

    const replay = mergeChatSyncResyncSnapshot(
      withTerminal.state,
      snapshotOf({ rev: 2, content: '全量', terminal: 'stop' }),
    )
    expect(replay.content).toMatchObject({ applied: false, reason: 'duplicate' })
    expect(replay.terminal).toMatchObject({ applied: false, reason: 'duplicate', rev: 2 })
    expect(replay.applied).toBe(false)
    expect(replay.state).toBe(withTerminal.state)
  })

  it('⑰ resync 并回 stale 路径:低 rev 快照的内容与终态都判 stale,零回退', () => {
    const head = mergeChatSyncResyncSnapshot(
      EMPTY_CHAT_SYNC_STATE,
      snapshotOf({ rev: 5, content: '权威全量', terminal: 'stop' }),
    )
    expect(head.applied).toBe(true)

    const stale = mergeChatSyncResyncSnapshot(
      head.state,
      snapshotOf({ rev: 3, content: '旧全量', terminal: 'error' }),
    )
    expect(stale.created).toBeNull()
    expect(stale.content).toMatchObject({
      applied: false,
      reason: 'stale',
      rev: 3,
      lastAppliedRev: 5,
    })
    expect(stale.terminal).toMatchObject({
      applied: false,
      reason: 'stale',
      rev: 3,
      lastAppliedRev: 5,
    })
    expect(stale.applied).toBe(false)
    expect(stale.state).toBe(head.state)
    expect(surfaceOf(stale.state).content).toBe('权威全量')
    expect(surfaceOf(stale.state).terminal).toEqual({ rev: 5, reason: 'stop' })
  })

  it('⑱ gap → resync → 收敛:断链帧给出坐标,权威快照(含终态)一次补齐,重并不再发请求', () => {
    let state = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, createdEvent()).state
    state = applyChatSyncEvent(state, deltaEvent(1, 'A')).state
    const gap = applyChatSyncEvent(state, deltaEvent(3, 'C'))
    expect(gap.result).toMatchObject({ applied: false, reason: 'gap', rev: 3, lastAppliedRev: 1 })

    const plan = planChatSyncResync({ conversationId: 'conv-1', result: gap.result })
    expect(plan).toEqual({
      needed: true,
      request: { conversationId: 'conv-1', messageId: 'm1', lastAppliedRev: 1 },
    })

    // 服务端权威面已到 rev6 且已收尾:内容与终态一次补齐(snapshot 自包含,跨 gap 安全)
    const merged = mergeChatSyncResyncSnapshot(
      gap.state,
      snapshotOf({ rev: 6, content: 'ABC服务端权威', terminal: 'length' }),
    )
    expect(merged.content).toEqual({ applied: true, messageId: 'm1', rev: 6 })
    expect(merged.terminal).toEqual({ applied: true, messageId: 'm1', rev: 6 })
    expect(merged.applied).toBe(true)
    expect(surfaceOf(merged.state).content).toBe('ABC服务端权威')
    expect(merged.state.appliedRevs.get('m1')).toBe(6)
    expect(surfaceOf(merged.state).terminal).toEqual({ rev: 6, reason: 'length' })

    // 重并同一快照:全 duplicate,且该结果不再触发 resync
    const replay = mergeChatSyncResyncSnapshot(
      merged.state,
      snapshotOf({ rev: 6, content: 'ABC服务端权威', terminal: 'length' }),
    )
    expect(replay.applied).toBe(false)
    expect(replay.state).toBe(merged.state)
    expect(planChatSyncResync({ conversationId: 'conv-1', result: replay.content })).toEqual({
      needed: false,
    })
  })

  it('⑲ resync 并回边界:缺行由 created 先补达;rev=0 = created 即权威;坏快照判 gap 零写入', () => {
    // 缺行 + rev=0:created 先落面,snapshot 与链头同 rev ⇒ duplicate(不伪造修订号)
    const seed = mergeChatSyncResyncSnapshot(
      EMPTY_CHAT_SYNC_STATE,
      snapshotOf({ rev: 0, content: '初面' }),
    )
    expect(seed.created?.applied).toBe(true)
    expect(seed.content).toMatchObject({ applied: false, reason: 'duplicate', rev: 0 })
    expect(seed.terminal).toBeNull()
    expect(seed.applied).toBe(true)
    expect(surfaceOf(seed.state).content).toBe('初面')
    expect(seed.state.appliedRevs.get('m1')).toBeUndefined()

    // 缺行 + rev>0 + 终态:created → snapshot → terminal 三步一次补达
    const full = mergeChatSyncResyncSnapshot(
      EMPTY_CHAT_SYNC_STATE,
      snapshotOf({ rev: 4, content: '全量', terminal: 'aborted' }),
    )
    expect(full.created?.applied).toBe(true)
    expect(full.content).toEqual({ applied: true, messageId: 'm1', rev: 4 })
    expect(full.terminal).toEqual({ applied: true, messageId: 'm1', rev: 4 })
    expect(full.applied).toBe(true)
    expect(surfaceOf(full.state).terminal).toEqual({ rev: 4, reason: 'aborted' })

    // 坏 rev:非非负整数 ⇒ gap 零写入(拿坏快照写状态 = 新的分叉源)
    const badRev = mergeChatSyncResyncSnapshot(EMPTY_CHAT_SYNC_STATE, snapshotOf({ rev: -1 }))
    expect(badRev.created).toBeNull()
    expect(badRev.content).toMatchObject({ applied: false, reason: 'gap', lastAppliedRev: 0 })
    expect(badRev.terminal).toBeNull()
    expect(badRev.applied).toBe(false)
    expect(badRev.state).toBe(EMPTY_CHAT_SYNC_STATE)

    // 坏终态:不在封闭集 ⇒ gap 零写入(不能把未知档静默渲染成空白)
    const badTerminal = mergeChatSyncResyncSnapshot(
      EMPTY_CHAT_SYNC_STATE,
      snapshotOf({ terminal: 'done' as unknown as ChatSyncTerminalReason }),
    )
    expect(badTerminal.content).toMatchObject({ applied: false, reason: 'gap' })
    expect(badTerminal.terminal).toBeNull()
    expect(badTerminal.applied).toBe(false)
    expect(badTerminal.state).toBe(EMPTY_CHAT_SYNC_STATE)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
