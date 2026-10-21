// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票60 残余(2026-10-21):ProgressJumpStore 按窗格寻址。
// 成对:① 正向 = 跳转/高亮/联动映射都只在发起它的那个窗格生效,别窗格消费后不再把这次跳转抢掉;
//      ② 反证 = Provider 外(单窗格调用面)读的仍是根单例,缺省形态逐字不变;空 paneId 当场抛错不静默回落。

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { ChatPaneProvider } from '@/stores/chat-pane-context'
import {
  getProgressJumpStoreForPane,
  resetProgressJumpPaneStores,
  useProgressJumpStore,
  useProgressJumpStoreForPane,
  type ProgressJumpState,
} from '@/stores/progress-jump-store'

type JumpStore = ReturnType<typeof getProgressJumpStoreForPane>
const pick = <K extends keyof ProgressJumpState>(store: JumpStore, key: K) => store.getState()[key]

beforeEach(() => {
  resetProgressJumpPaneStores()
  useProgressJumpStore.setState({
    pendingJumpToMessage: null,
    highlightedMessageId: null,
    hoveredPlanStepId: null,
    hoveredMessageId: null,
    planStepToMessageId: {},
    messageToPlanStepIds: {},
  })
})

afterEach(() => {
  vi.useRealTimers()
  resetProgressJumpPaneStores()
})

describe('ProgressJumpStore 窗格寻址(票60 残余)', () => {
  it('① 正向:跳转请求只落在发起它的那个窗格', () => {
    const a = getProgressJumpStoreForPane('pane-jump-a')
    const b = getProgressJumpStoreForPane('pane-jump-b')
    expect(a).not.toBe(b)

    a.getState().requestJumpToMessage('msg-a')
    expect(pick(a, 'pendingJumpToMessage')?.messageId).toBe('msg-a')
    expect(pick(b, 'pendingJumpToMessage')).toBeNull()
    expect(pick(useProgressJumpStore, 'pendingJumpToMessage')).toBeNull()
  })

  it('① 反证(抢跳造型):A 消费后 clearPendingJump,不得抹掉 B 那一次还没消费的跳转', () => {
    const a = getProgressJumpStoreForPane('pane-jump-a')
    const b = getProgressJumpStoreForPane('pane-jump-b')
    a.getState().requestJumpToMessage('msg-a')
    b.getState().requestJumpToMessage('msg-b')

    a.getState().clearPendingJump()
    expect(pick(a, 'pendingJumpToMessage')).toBeNull()
    expect(pick(b, 'pendingJumpToMessage')?.messageId).toBe('msg-b')

    b.getState().clearPendingJump()
    expect(pick(b, 'pendingJumpToMessage')).toBeNull()
  })

  it('① 正向:高亮与它的到期定时器各随实例,一窗格到期不洗另一窗格', () => {
    vi.useFakeTimers()
    const a = getProgressJumpStoreForPane('pane-flash-a')
    const b = getProgressJumpStoreForPane('pane-flash-b')

    a.getState().flashHighlight('msg-a')
    b.getState().flashHighlight('msg-b')
    expect(pick(a, 'highlightedMessageId')).toBe('msg-a')
    expect(pick(b, 'highlightedMessageId')).toBe('msg-b')

    // 时间轴:T0 两窗格各闪一次(两支定时器都在 T1500 到期);T700 A 再闪一次
    // ⇒ A 撤掉自己那支旧定时器并重装到 T2200,而 B 的那支仍在 T1500 到期 —— 两实例互不牵连
    vi.advanceTimersByTime(700)
    a.getState().flashHighlight('msg-a2')
    expect(pick(a, 'highlightedMessageId')).toBe('msg-a2')

    vi.advanceTimersByTime(800) // T1500:只有 B 的定时器到期
    expect(pick(a, 'highlightedMessageId')).toBe('msg-a2')
    expect(pick(b, 'highlightedMessageId')).toBeNull()

    vi.advanceTimersByTime(700) // T2200:A 的定时器到期,只清 A
    expect(pick(a, 'highlightedMessageId')).toBeNull()
    expect(pick(b, 'highlightedMessageId')).toBeNull()
  })

  it('① 正向:PlanStep↔Message 联动映射按实例写,clearAllLinks 只清本窗格', () => {
    const a = getProgressJumpStoreForPane('pane-link-a')
    const b = getProgressJumpStoreForPane('pane-link-b')
    a.getState().linkPlanStepToMessage('s1', 'msg-1')
    b.getState().linkPlanStepToMessage('s1', 'msg-other')

    expect(pick(a, 'planStepToMessageId')).toEqual({ s1: 'msg-1' })
    expect(pick(b, 'planStepToMessageId')).toEqual({ s1: 'msg-other' })

    a.getState().clearAllLinks()
    expect(pick(a, 'planStepToMessageId')).toEqual({})
    expect(pick(b, 'planStepToMessageId')).toEqual({ s1: 'msg-other' })
  })

  it('② 反证:空 paneId 当场抛错(静默回落单例 = 两窗格共用一份跳转态)', () => {
    expect(() => getProgressJumpStoreForPane('')).toThrow(/paneId 不能为空/)
    expect(() => getProgressJumpStoreForPane('   ')).toThrow(/paneId 不能为空/)
  })

  it('② 正向:Provider 内解析到该窗格实例,Provider 外恒回落根单例(同一引用)', () => {
    const inPane = renderHook(() => useProgressJumpStoreForPane(), {
      wrapper: ({ children }) => (
        <ChatPaneProvider paneId="pane-hook-a">{children}</ChatPaneProvider>
      ),
    })
    expect(inPane.result.current).toBe(getProgressJumpStoreForPane('pane-hook-a'))

    const twice = renderHook(() => useProgressJumpStoreForPane(), {
      wrapper: ({ children }) => (
        <ChatPaneProvider paneId="pane-hook-a">{children}</ChatPaneProvider>
      ),
    })
    expect(twice.result.current).toBe(inPane.result.current)

    const outside = renderHook(() => useProgressJumpStoreForPane())
    expect(outside.result.current).toBe(useProgressJumpStore)
  })

  it('② 反证:nonce 随实例递增,不共享全局计数器(摘掉窗格维时这一条会红)', () => {
    const a = getProgressJumpStoreForPane('pane-nonce-a')
    const b = getProgressJumpStoreForPane('pane-nonce-b')
    a.getState().requestJumpToMessage('a1')
    const first = pick(a, 'pendingJumpToMessage')?.nonce
    b.getState().requestJumpToMessage('b1')
    const otherPane = pick(b, 'pendingJumpToMessage')?.nonce
    a.getState().requestJumpToMessage('a2')
    const second = pick(a, 'pendingJumpToMessage')?.nonce

    expect(typeof first).toBe('number')
    expect(typeof second).toBe('number')
    expect(second).toBeGreaterThan(first as number)
    // 各实例独立计数:B 的第一次不应当把 A 的序列顶高一格(共享模块级计数器才会这样)
    expect(otherPane).toBe(first)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
