// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scroll-session-restore 纯判据回归(P2,2026-10-13 立)。
 * 与 scroll-authority.test.ts 同一约定:判据全部纯函数、零 DOM,直接数值锁死。
 */
import { describe, it, expect } from 'vitest'

import {
  createScrollSessionStore,
  resolveRestoreConsume,
  phase1TargetOffset,
  needsPhase2Repin,
  RESTORE_PENDING_TTL_MS,
  type PendingScrollRestore,
  type ScrollSessionState,
} from './scroll-session-restore'

function stateOf(offset: number, following: boolean): ScrollSessionState {
  return { offset, following, savedAt: 1_000 }
}

function pendingOf(overrides?: Partial<PendingScrollRestore>): PendingScrollRestore {
  return {
    conversationId: 'a',
    state: stateOf(400, false),
    messagesAtSwitch: ['old'],
    createdAt: 5_000,
    ...overrides,
  }
}

describe('createScrollSessionStore(账目存储 + LRU 淘汰)', () => {
  it('save/lookup 原样往返;重复 save 刷新值', () => {
    const store = createScrollSessionStore()
    store.save('a', 100, true)
    expect(store.lookup('a')).toMatchObject({ offset: 100, following: true })
    store.save('a', 300, false)
    expect(store.lookup('a')).toMatchObject({ offset: 300, following: false })
  })

  it('超过上限按最久未保存淘汰;重新 save 的会话不淘汰', () => {
    const store = createScrollSessionStore(2)
    store.save('a', 1, true)
    store.save('b', 2, true)
    store.save('c', 3, true)
    expect(store.lookup('a')).toBeUndefined()
    expect(store.lookup('b')?.offset).toBe(2)
    // b 刚被重新保存 ⇒ 最新;c 成为最久 ⇒ 被顶掉
    store.save('b', 9, true)
    store.save('d', 4, true)
    expect(store.lookup('b')?.offset).toBe(9)
    expect(store.lookup('c')).toBeUndefined()
    expect(store.lookup('d')?.offset).toBe(4)
  })

  it('clear 清空全部账目', () => {
    const store = createScrollSessionStore()
    store.save('a', 1, true)
    store.clear()
    expect(store.lookup('a')).toBeUndefined()
  })
})

describe('resolveRestoreConsume(消费判据,失效方向 = 少恢复一次)', () => {
  const baseInput = {
    conversationId: 'a' as string | null,
    messages: ['new'] as unknown,
    now: 5_000 + RESTORE_PENDING_TTL_MS,
  }

  it('无挂起 ⇒ hold(not-pending)', () => {
    expect(
      resolveRestoreConsume({ ...baseInput, pending: null, now: baseInput.now }),
    ).toMatchObject({ kind: 'hold', reason: 'not-pending' })
  })

  it('会话 id 不一致 ⇒ hold(conversation-mismatch),不消费也不作废', () => {
    expect(
      resolveRestoreConsume({ ...baseInput, pending: pendingOf(), conversationId: 'b' }),
    ).toMatchObject({ kind: 'hold', reason: 'conversation-mismatch' })
  })

  it('messages 引用未变(缓存在途)⇒ hold(messages-not-ready)', () => {
    expect(
      resolveRestoreConsume({ ...baseInput, pending: pendingOf({ messagesAtSwitch: baseInput.messages }) }),
    ).toMatchObject({ kind: 'hold', reason: 'messages-not-ready' })
  })

  it('messages 为空数组 / 非数组 ⇒ hold(messages-not-ready)', () => {
    expect(
      resolveRestoreConsume({ ...baseInput, pending: pendingOf({ messagesAtSwitch: ['old'] }), messages: [] }),
    ).toMatchObject({ kind: 'hold', reason: 'messages-not-ready' })
    expect(
      resolveRestoreConsume({ ...baseInput, pending: pendingOf({ messagesAtSwitch: ['old'] }), messages: 'junk' }),
    ).toMatchObject({ kind: 'hold', reason: 'messages-not-ready' })
  })

  it('超过 TTL ⇒ discard(expired)—— 拉取失败/被覆盖的挂起不砸向后来的内容', () => {
    const pending = pendingOf({ createdAt: 1 })
    const outcome = resolveRestoreConsume({ ...baseInput, pending, now: 1 + RESTORE_PENDING_TTL_MS + 1 })
    expect(outcome).toMatchObject({ kind: 'discard', reason: 'expired' })
  })

  it('全部判据通过 ⇒ consume', () => {
    const pending = pendingOf()
    expect(resolveRestoreConsume({ ...baseInput, pending, now: pending.createdAt + 1 })).toEqual({
      kind: 'consume',
    })
  })
})

describe('二段恢复的钉位判据', () => {
  it('phase1TargetOffset:合法保存位原样返回;脏值(非有限/负数)保持现位', () => {
    expect(phase1TargetOffset(stateOf(400, false), 7)).toBe(400)
    expect(phase1TargetOffset(stateOf(Number.NaN, false), 7)).toBe(7)
    expect(phase1TargetOffset(stateOf(-1, false), 7)).toBe(7)
  })

  it('needsPhase2Repin:仅"未恢复滚动权"的分支需要第二段钉位', () => {
    expect(needsPhase2Repin(stateOf(400, false))).toBe(true)
    expect(needsPhase2Repin(stateOf(400, true))).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
