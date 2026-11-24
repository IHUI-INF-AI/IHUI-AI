// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票 B02 测试面格(2026-10-26):共享层 chat-sync-store 的回归钉。
//
// 判据本体在 @ihui/types 内核(回归 19 例已钉死);本文件钉的是 **store 包装层的义务**:
//   ① 四道闸逐档点名(unknown-type / protocol-version-mismatch / missing-room /
//      missing-message-id),绝不静默丢弃、绝不放进内核;
//   ② 发布纪律 = 契约原文"拒绝不得触发状态发布/重渲染":duplicate/stale 只计数不 bump
//      version;applied/gap/未判定才发布;
//   ③ gap → 待 resync 表(同消息只一条、补齐即摘),store 自身不发请求;
//   ④ terminal 如实登记 unwired(不写状态、不排无人消费的队列);
//   ⑤ messagesOf 引用稳定(useSyncExternalStore 的比较基准)与插入顺序;
//   ⑥ mergeResyncSnapshot 复用契约并回:真应用才写 + 摘坐标,坏快照零写入。

import { describe, expect, it, vi } from 'vitest'

import {
  messageCreatedEvent,
  messagePatchedEvent,
  messageTerminalEvent,
  type ChatSyncEvent,
  type ChatSyncMessageSnapshot,
  type ChatSyncMessageSurface,
  type ChatSyncTerminalReason,
} from '@ihui/types'

import { createChatSyncStore, type ChatSyncStore } from '../chat-sync-store'

/** 取会话消息面首条(所有"应有该行"的用例共用;缺行直接判红,而不是静默 undefined)。 */
function firstMessage(store: ChatSyncStore, conversationId = 'c1'): ChatSyncMessageSurface {
  const surface = store.messagesOf(conversationId)[0]
  if (!surface) throw new Error(`消息面缺行:${conversationId}`)
  return surface
}

function createdEvent(conversationId = 'c1', messageId = 'm1', content = '初稿'): ChatSyncEvent {
  return messageCreatedEvent({ conversationId, messageId, role: 'assistant', content }).data
}

function deltaEvent(
  messageId: string,
  rev: number,
  textDelta: string,
  conversationId = 'c1',
): ChatSyncEvent {
  return messagePatchedEvent({ conversationId, messageId, rev, kind: 'delta', textDelta }).data
}

function terminalEvent(
  messageId = 'm1',
  rev = 0,
  reason: ChatSyncTerminalReason = 'stop',
  conversationId = 'c1',
): ChatSyncEvent {
  return messageTerminalEvent({ conversationId, messageId, rev, reason }).data
}

describe('chat-sync-store:applyEvent 四道闸(未判定/未接线,逐档点名)', () => {
  it('未知帧类型拦在闸外:不进内核、不写状态、undetermined=unknown-type 且点名', () => {
    const onUndetermined = vi.fn()
    const store = createChatSyncStore({ onUndetermined })
    const frame = { ...createdEvent(), type: 'message:deleted' } as unknown as ChatSyncEvent

    const outcome = store.applyEvent(frame)
    expect(outcome.undetermined).toBe('unknown-type')
    expect(outcome.result).toBeNull()
    expect(outcome.resync.needed).toBe(false)
    expect(store.messagesOf('c1')).toHaveLength(0)
    expect(store.pendingResyncs()).toHaveLength(0)
    expect(store.counters().undetermined).toBe(1)
    expect(onUndetermined).toHaveBeenCalledWith({
      event: 'message:deleted',
      reason: 'unknown-type',
      conversationId: 'c1',
      messageId: 'm1',
    })
  })

  it('协议版本与帧族不同域:undetermined + 排 resync(坐标逐字),绝不"照 v1 应用"', () => {
    const store = createChatSyncStore()
    store.applyEvent(createdEvent('c1', 'm1'))
    const frame = {
      ...createdEvent('c1', 'm1'),
      protocolVersion: 'chat-sync.v2',
    } as unknown as ChatSyncEvent

    const outcome = store.applyEvent(frame)
    expect(outcome.undetermined).toBe('protocol-version-mismatch')
    expect(outcome.result).toBeNull()
    expect(outcome.resync).toEqual({
      needed: true,
      request: { conversationId: 'c1', messageId: 'm1', lastAppliedRev: 0 },
    })
    expect(store.pendingResyncs()).toEqual([
      { conversationId: 'c1', messageId: 'm1', lastAppliedRev: 0 },
    ])
    expect(store.counters().undetermined).toBe(1)
  })

  it('缺房间键的三种坏法(room 缺失 / kind 非 conversation / conversationId 空串)一律 missing-room 且不排 resync', () => {
    const store = createChatSyncStore()
    const frames: ChatSyncEvent[] = [
      { ...createdEvent(), room: undefined } as unknown as ChatSyncEvent,
      {
        ...createdEvent(),
        room: { kind: 'workspace', conversationId: 'c1' },
      } as unknown as ChatSyncEvent,
      {
        ...createdEvent(),
        room: { kind: 'conversation', conversationId: '' },
      } as unknown as ChatSyncEvent,
    ]
    for (const frame of frames) {
      const outcome = store.applyEvent(frame)
      expect(outcome.undetermined).toBe('missing-room')
      expect(outcome.conversationId).toBeNull()
      expect(outcome.resync.needed).toBe(false)
    }
    expect(store.counters().undetermined).toBe(3)
    expect(store.pendingResyncs()).toHaveLength(0)
    expect(store.conversationIds()).toHaveLength(0)
  })

  it('缺 messageId:messageId 空串判 missing-message-id,不猜、不排 resync', () => {
    const store = createChatSyncStore()
    const frame = { ...createdEvent(), messageId: '' } as unknown as ChatSyncEvent

    const outcome = store.applyEvent(frame)
    expect(outcome.undetermined).toBe('missing-message-id')
    expect(outcome.conversationId).toBe('c1')
    expect(outcome.messageId).toBeNull()
    expect(outcome.resync.needed).toBe(false)
    expect(store.counters().undetermined).toBe(1)
  })

  it('terminal 帧登记 unwired:不写状态、不排 resync、只点名计数(把没做写成做了是失效型)', () => {
    const onUndetermined = vi.fn()
    const store = createChatSyncStore({ onUndetermined })
    store.applyEvent(createdEvent('c1', 'm1'))

    const outcome = store.applyEvent(terminalEvent('m1', 0, 'stop'))
    expect(outcome.unwired).toBe('terminal')
    expect(outcome.result).toBeNull()
    expect(outcome.resync.needed).toBe(false)
    expect(firstMessage(store).terminal).toBeUndefined()
    expect(store.pendingResyncs()).toHaveLength(0)
    expect(store.counters().unwired).toBe(1)
    expect(onUndetermined).toHaveBeenCalledWith({
      event: 'message:terminal',
      reason: 'terminal',
      conversationId: 'c1',
      messageId: 'm1',
    })
  })
})

describe('chat-sync-store:内核四态与发布纪律', () => {
  it('created 应用:写消息面、appliedRev=0、version 递增、监听者收到发布', () => {
    const store = createChatSyncStore()
    const listener = vi.fn()
    store.subscribe(listener)

    const outcome = store.applyEvent(createdEvent('c1', 'm1', '你好'))
    expect(outcome.result).toMatchObject({ applied: true, messageId: 'm1' })
    expect(store.messagesOf('c1')).toHaveLength(1)
    expect(firstMessage(store)).toMatchObject({ id: 'm1', role: 'assistant', content: '你好' })
    expect(store.appliedRevOf('c1', 'm1')).toBe(0)
    expect(store.counters().applied).toBe(1)
    expect(store.version()).toBe(1)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('created 重投判 duplicate:不得覆盖已收 patch 的面,且零发布', () => {
    const store = createChatSyncStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.applyEvent(createdEvent('c1', 'm1', '初稿'))
    store.applyEvent(deltaEvent('m1', 1, '续写'))
    const versionBefore = store.version()

    const outcome = store.applyEvent(createdEvent('c1', 'm1', '初稿'))
    expect(outcome.result).toMatchObject({ applied: false, reason: 'duplicate' })
    expect(firstMessage(store).content).toBe('初稿续写')
    expect(store.version()).toBe(versionBefore)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(store.counters().duplicate).toBe(1)
  })

  it('delta 逐 rev 应用:内容拼接、rev 前进', () => {
    const store = createChatSyncStore()
    store.applyEvent(createdEvent('c1', 'm1', 'A'))
    store.applyEvent(deltaEvent('m1', 1, 'B'))
    const outcome = store.applyEvent(deltaEvent('m1', 2, 'C'))

    expect(outcome.result).toMatchObject({ applied: true, rev: 2 })
    expect(firstMessage(store).content).toBe('ABC')
    expect(store.appliedRevOf('c1', 'm1')).toBe(2)
  })

  it('created 未达的 patch 判 gap:待 resync 表排入逐字坐标并发布', () => {
    const store = createChatSyncStore()
    const listener = vi.fn()
    store.subscribe(listener)

    const outcome = store.applyEvent(deltaEvent('m9', 1, '半截'))
    expect(outcome.result).toMatchObject({ applied: false, reason: 'gap' })
    expect(outcome.resync).toEqual({
      needed: true,
      request: { conversationId: 'c1', messageId: 'm9', lastAppliedRev: 0 },
    })
    expect(store.messagesOf('c1')).toHaveLength(0)
    expect(store.pendingResyncs()).toEqual([
      { conversationId: 'c1', messageId: 'm9', lastAppliedRev: 0 },
    ])
    expect(store.counters().gap).toBe(1)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('同 rev 重投判 duplicate:只计数、不发布、不排 resync(契约:拒绝不得触发状态发布)', () => {
    const store = createChatSyncStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.applyEvent(createdEvent('c1', 'm1'))
    store.applyEvent(deltaEvent('m1', 1, 'B'))
    const versionBefore = store.version()
    const countersBefore = store.counters()

    const outcome = store.applyEvent(deltaEvent('m1', 1, 'B'))
    expect(outcome.result).toMatchObject({ applied: false, reason: 'duplicate' })
    expect(outcome.resync.needed).toBe(false)
    expect(store.version()).toBe(versionBefore)
    expect(store.messagesOf('c1')).toHaveLength(1)
    expect(firstMessage(store).content).toBe('初稿B')
    expect(listener).toHaveBeenCalledTimes(2)
    expect(store.counters().duplicate).toBe(countersBefore.duplicate + 1)
  })

  it('低 rev 迟到判 stale:内容不回退、零发布', () => {
    const store = createChatSyncStore()
    store.applyEvent(createdEvent('c1', 'm1', 'A'))
    store.applyEvent(deltaEvent('m1', 1, 'B'))
    store.applyEvent(deltaEvent('m1', 2, 'C'))
    const viewBefore = store.messagesOf('c1')
    const versionBefore = store.version()

    const outcome = store.applyEvent(deltaEvent('m1', 1, '迟到'))
    expect(outcome.result).toMatchObject({ applied: false, reason: 'stale' })
    expect(store.messagesOf('c1')).toBe(viewBefore)
    expect(firstMessage(store).content).toBe('ABC')
    expect(store.version()).toBe(versionBefore)
    expect(store.counters().stale).toBe(1)
  })

  it('delta 断链(rev > last+1)判 gap:排待办,当前面不变', () => {
    const store = createChatSyncStore()
    store.applyEvent(createdEvent('c1', 'm1', 'A'))
    store.applyEvent(deltaEvent('m1', 1, 'B'))

    const outcome = store.applyEvent(deltaEvent('m1', 3, '跳号'))
    expect(outcome.result).toMatchObject({ applied: false, reason: 'gap' })
    expect(store.pendingResyncs()).toEqual([
      { conversationId: 'c1', messageId: 'm1', lastAppliedRev: 1 },
    ])
    expect(firstMessage(store).content).toBe('AB')
  })

  it('gap 后缺 rev 补达即收敛:待办摘除、内容逐字拼接、不再欠快照', () => {
    const store = createChatSyncStore()
    store.applyEvent(createdEvent('c1', 'm1', 'A'))
    store.applyEvent(deltaEvent('m1', 3, 'C'))
    expect(store.pendingResyncs()).toHaveLength(1)

    store.applyEvent(deltaEvent('m1', 1, 'B'))
    expect(store.pendingResyncs()).toHaveLength(0)
    store.applyEvent(deltaEvent('m1', 2, 'C'))
    expect(firstMessage(store).content).toBe('ABC')
    expect(store.appliedRevOf('c1', 'm1')).toBe(2)
    expect(store.pendingResyncs()).toHaveLength(0)
  })

  it('同一消息连续多帧 gap 只排一条待办(表按消息去重)', () => {
    const store = createChatSyncStore()
    store.applyEvent(deltaEvent('m1', 2, 'X'))
    store.applyEvent(deltaEvent('m1', 3, 'Y'))
    store.applyEvent(deltaEvent('m1', 4, 'Z'))

    expect(store.pendingResyncs()).toEqual([
      { conversationId: 'c1', messageId: 'm1', lastAppliedRev: 0 },
    ])
    expect(store.counters().gap).toBe(3)
  })
})

describe('chat-sync-store:视图引用稳定与顺序', () => {
  it('messagesOf 无变更时同一引用、变更后新引用(端侧重渲染的比较基准)', () => {
    const store = createChatSyncStore()
    store.applyEvent(createdEvent('c1', 'm1'))
    const v1 = store.messagesOf('c1')
    expect(store.messagesOf('c1')).toBe(v1)

    store.applyEvent(deltaEvent('m1', 9, '坏')) // gap:不改面
    expect(store.messagesOf('c1')).toBe(v1)

    store.applyEvent(deltaEvent('m1', 1, '好')) // applied:换引用
    const v2 = store.messagesOf('c1')
    expect(v2).not.toBe(v1)
    expect(store.messagesOf('c1')).toBe(v2)
  })

  it('未知会话共享同一冻结空数组;appliedRevOf 未知消息恒 0', () => {
    const store = createChatSyncStore()
    const a = store.messagesOf('nope')
    const b = store.messagesOf('other')
    expect(a).toBe(b)
    expect(a).toHaveLength(0)
    expect(Object.isFrozen(a)).toBe(true)
    expect(store.appliedRevOf('nope', 'm1')).toBe(0)
  })

  it('消息面与会话清单都保持首次到达顺序', () => {
    const store = createChatSyncStore()
    store.applyEvent(createdEvent('c2', 'x'))
    store.applyEvent(createdEvent('c1', 'm2'))
    store.applyEvent(createdEvent('c1', 'm1'))
    store.applyEvent(createdEvent('c1', 'm3'))

    expect(store.conversationIds()).toEqual(['c2', 'c1'])
    expect(store.messagesOf('c1').map((m) => m.id)).toEqual(['m2', 'm1', 'm3'])
  })
})

describe('chat-sync-store:mergeResyncSnapshot(复用契约并回)', () => {
  it('权威快照并回:写面、摘待办、计 applied 并发布', () => {
    const store = createChatSyncStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.applyEvent(deltaEvent('m1', 2, '半截')) // gap → 待办
    expect(store.pendingResyncs()).toHaveLength(1)

    const snapshot: ChatSyncMessageSnapshot = {
      conversationId: 'c1',
      messageId: 'm1',
      rev: 2,
      role: 'assistant',
      content: '全量面',
    }
    const outcome = store.mergeResyncSnapshot(snapshot)
    expect(outcome.applied).toBe(true)
    expect(firstMessage(store).content).toBe('全量面')
    expect(store.appliedRevOf('c1', 'm1')).toBe(2)
    expect(store.pendingResyncs()).toHaveLength(0)
    expect(store.counters().applied).toBe(1)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('带 terminal 的快照并回终态标记(resync 通道不受帧级 unwired 影响)', () => {
    const store = createChatSyncStore()
    const outcome = store.mergeResyncSnapshot({
      conversationId: 'c1',
      messageId: 'm1',
      rev: 2,
      role: 'assistant',
      content: '收尾全文',
      terminal: 'length',
    })

    expect(outcome.applied).toBe(true)
    expect(firstMessage(store)).toMatchObject({
      content: '收尾全文',
      terminal: { rev: 2, reason: 'length' },
    })
  })

  it('坏快照零写入:rev 非法与 terminal 出闭集都不改状态、不摘待办、不发布', () => {
    const store = createChatSyncStore()
    store.applyEvent(deltaEvent('m1', 2, 'X')) // gap → 待办
    const versionBefore = store.version()

    const badRev = store.mergeResyncSnapshot({
      conversationId: 'c1',
      messageId: 'm1',
      rev: -1,
      role: 'assistant',
      content: '坏',
    })
    const badTerminal = store.mergeResyncSnapshot({
      conversationId: 'c1',
      messageId: 'm1',
      rev: 2,
      role: 'assistant',
      content: '坏',
      terminal: 'exploded',
    } as unknown as ChatSyncMessageSnapshot)

    expect(badRev.applied).toBe(false)
    expect(badTerminal.applied).toBe(false)
    expect(badRev.content).toMatchObject({ applied: false, reason: 'gap' })
    expect(badTerminal.content).toMatchObject({ applied: false, reason: 'gap' })
    expect(store.messagesOf('c1')).toHaveLength(0)
    expect(store.version()).toBe(versionBefore)
    expect(store.pendingResyncs()).toHaveLength(1)
    expect(store.counters().applied).toBe(0)
  })

  it('重并已应用快照判 duplicate:零写入、零发布', () => {
    const store = createChatSyncStore()
    store.applyEvent(createdEvent('c1', 'm1', 'A'))
    store.applyEvent(deltaEvent('m1', 1, 'B'))
    const versionBefore = store.version()
    const viewBefore = store.messagesOf('c1')

    const outcome = store.mergeResyncSnapshot({
      conversationId: 'c1',
      messageId: 'm1',
      rev: 1,
      role: 'assistant',
      content: 'AB',
    })
    expect(outcome.applied).toBe(false)
    expect(store.messagesOf('c1')).toBe(viewBefore)
    expect(store.version()).toBe(versionBefore)
    expect(store.counters().applied).toBe(2) // created + delta,merge 没加
  })
})

describe('chat-sync-store:clear / subscribe / counters 诊断面', () => {
  it('空店 clear 早退:不发布、version 不动', () => {
    const store = createChatSyncStore()
    const listener = vi.fn()
    store.subscribe(listener)

    store.clear()
    expect(store.version()).toBe(0)
    expect(listener).not.toHaveBeenCalled()
  })

  it('有状态后 clear:消息面、待办、计数全清零并发布一次(设备级 store,身份不是)', () => {
    const store = createChatSyncStore()
    store.applyEvent(createdEvent('c1', 'm1'))
    store.applyEvent(deltaEvent('m2', 1, 'X')) // gap → 待办
    const versionBefore = store.version()

    store.clear()
    expect(store.version()).toBe(versionBefore + 1)
    expect(store.conversationIds()).toHaveLength(0)
    expect(store.messagesOf('c1')).toHaveLength(0)
    expect(store.pendingResyncs()).toHaveLength(0)
    expect(store.counters()).toEqual({
      applied: 0,
      duplicate: 0,
      stale: 0,
      gap: 0,
      undetermined: 0,
      unwired: 0,
    })
  })

  it('退订立即生效:off() 之后的发布不再回调', () => {
    const store = createChatSyncStore()
    const listener = vi.fn()
    const off = store.subscribe(listener)
    store.applyEvent(createdEvent('c1', 'm1'))
    expect(listener).toHaveBeenCalledTimes(1)

    off()
    store.applyEvent(deltaEvent('m1', 1, 'B'))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('counters 冻结且与 version 解耦:duplicate 只换计数引用、不动 version', () => {
    const store = createChatSyncStore()
    store.applyEvent(createdEvent('c1', 'm1'))
    const countersBefore = store.counters()
    const versionBefore = store.version()

    store.applyEvent(createdEvent('c1', 'm1')) // duplicate
    expect(Object.isFrozen(store.counters())).toBe(true)
    expect(store.counters()).not.toBe(countersBefore)
    expect(store.counters().duplicate).toBe(1)
    expect(store.version()).toBe(versionBefore)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
