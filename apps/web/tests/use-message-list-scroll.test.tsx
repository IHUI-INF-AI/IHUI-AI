// @vitest-environment jsdom
/**
 * useMessageListScroll — pinned-to-bottom 贴底跟随状态机专属单测(2026-08-30 立)
 *
 * 背景:2026-08-29 修复自动滚底"差一脚"(最后一条消息停不到底,需手动再滑)后,
 * pinned 状态机此前仅由 message-list.test.tsx 经组件层间接覆盖,本文件直接对 hook
 * 精确验证四个协同部件:
 * 1. pinnedToBottomRef:距底 ≤120px 视为贴底(与 userScrolledUp 滞后阈值一致)
 * 2. programmaticScrollUntilRef:程序滚动动画 700ms 窗口内冻结 pinned 判定
 *    (动画中距离暂时变大属正常,不能误判为"用户离开底部")
 * 3. doScroll/scrollToBottom:置位 pinned + 开窗口 + 清除用户上翻标记
 * 4. ResizeObserver 自校正网:内容长高且处于贴底态 → 瞬时 scrollTop=scrollHeight
 *    (兜住流结束按钮行挂载 / Markdown 重排 / 图片解码等一切"事后长高")
 *
 * 测试环境要点:
 * - jsdom 无布局引擎,scrollHeight/clientHeight/scrollTop 用 defineProperty 模拟
 * - jsdom 无 ResizeObserver,用可手动触发回调的 Fake 类 stub
 * - Date.now() 驱动 700ms 程序窗口与 800ms 意图过期 → 全程 fake timers 精确控时
 * - @/stores/chat 用 zustand-like mock(与 message-list.test.tsx 同模式)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, act, cleanup } from '@testing-library/react'

// ─── Mocks(vi.hoisted 必须在 vi.mock 之前)────────────────────────────
const mockChatStore = vi.hoisted(() => {
  const state = {
    userScrolledUp: false,
    userScrolledToTop: false,
    setUserScrolledUp: undefined as unknown as (v: boolean) => void,
    setUserScrolledToTop: undefined as unknown as (v: boolean) => void,
  }
  const listeners = new Set<() => void>()
  return { state, listeners }
})

vi.mock('@/stores/chat', async () => {
  const ReactMod = await import('react')
  const { state, listeners } = mockChatStore
  const notify = () => {
    for (const l of listeners) l()
  }
  const subscribe = (l: () => void) => {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }
  state.setUserScrolledUp = (up: boolean) => {
    state.userScrolledUp = up
    notify()
  }
  state.setUserScrolledToTop = (top: boolean) => {
    state.userScrolledToTop = top
    notify()
  }
  const useChatStore = Object.assign(
    (selector: (s: typeof state) => unknown) => {
      const getSnapshot = () => selector(state)
      return ReactMod.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    },
    { getState: () => state, subscribe },
  )
  return { useChatStore }
})

import { useMessageListScroll } from '../src/components/chat/message-list/use-message-list-scroll'
import type { MessageListScrollResult } from '../src/components/chat/message-list/use-message-list-scroll'
import type { ChatMessage } from '../src/stores/chat'

// ─── Fake ResizeObserver(记录实例,允许测试手动触发回调)────────────────
interface FakeRO {
  callback: ResizeObserverCallback
  observed: Element[]
}
const roInstances: FakeRO[] = []
class FakeResizeObserver {
  callback: ResizeObserverCallback
  observed: Element[] = []
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb
    roInstances.push(this)
  }
  observe(el: Element) {
    this.observed.push(el)
  }
  unobserve(el: Element) {
    this.observed = this.observed.filter((e) => e !== el)
  }
  disconnect() {
    this.observed = []
  }
}

function triggerRO() {
  const ro = roInstances[roInstances.length - 1]
  if (!ro) throw new Error('no active ResizeObserver instance')
  act(() => {
    ro.callback([], ro as unknown as ResizeObserver)
  })
}

// ─── jsdom 滚动几何模拟(闭包 state,测试可直接改值模拟内容长高)──────────
function installScrollMetrics(
  el: HTMLElement,
  init: { scrollTop: number; scrollHeight: number; clientHeight: number },
) {
  const s = { ...init }
  Object.defineProperty(el, 'scrollHeight', { get: () => s.scrollHeight, configurable: true })
  Object.defineProperty(el, 'clientHeight', { get: () => s.clientHeight, configurable: true })
  Object.defineProperty(el, 'scrollTop', {
    get: () => s.scrollTop,
    set: (v: number) => {
      s.scrollTop = v
    },
    configurable: true,
  })
  return s
}

// ─── 测试宿主组件(结构与 MessageList 真实布局对齐:内容容器是滚动容器首个子元素)──
const lastResult: { current: MessageListScrollResult | null } = { current: null }
function Host({ messages, isStreaming = false }: { messages: ChatMessage[]; isStreaming?: boolean }) {
  const result = useMessageListScroll({ messages, isStreaming })
  lastResult.current = result
  return (
    <div data-testid="scroll-panel" ref={result.containerRef}>
      <div data-testid="content">
        {messages.map((m) => (
          <div key={m.id}>{m.content}</div>
        ))}
      </div>
      <div ref={result.bottomRef} data-testid="bottom-anchor" />
    </div>
  )
}

function makeMsg(id: string, content = 'hello'): ChatMessage {
  return {
    id,
    role: 'user',
    content,
    createdAt: Date.now(),
    model: 'test-model',
  } as ChatMessage
}

describe('useMessageListScroll — pinned-to-bottom 贴底跟随状态机', () => {
  let scrollIntoViewMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    roInstances.length = 0
    mockChatStore.state.userScrolledUp = false
    mockChatStore.state.userScrolledToTop = false
    // jsdom 不实现 scrollIntoView,hook 的 doScroll/scrollToBottom 依赖它
    scrollIntoViewMock = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoViewMock as unknown as () => void
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    lastResult.current = null
  })

  it('挂载即自动滚底:doScroll 置位 pinned 并调用 smooth scrollIntoView', () => {
    render(<Host messages={[makeMsg('m1')]} />)
    // 1 条消息(prevLen=0 → newLen=1,非批量加载)→ smooth 行为
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'end' })
    // RO 观察的是内容容器(滚动容器的 firstElementChild,与 MessageList 结构一致)
    expect(roInstances).toHaveLength(1)
    expect(roInstances[0]!.observed).toContain(screen.getByTestId('content'))
  })

  it('贴底态内容长高 → RO 瞬时校正到底(scrollTop = scrollHeight)', () => {
    render(<Host messages={[makeMsg('m1')]} />)
    // doScroll 已置 pinned=true;模拟当前处于贴底位置(距底 0)
    const panel = screen.getByTestId('scroll-panel')
    const s = installScrollMetrics(panel, { scrollTop: 800, scrollHeight: 1000, clientHeight: 200 })
    // 流结束瞬间按钮行挂载/图片解码 → 内容长高 200px
    s.scrollHeight = 1200
    triggerRO()
    // 自校正网瞬时贴底,不依赖任何时间窗
    expect(s.scrollTop).toBe(1200)
  })

  it('用户上翻 >120px(带 wheel 意图)→ pinned 清除,长高不校正', () => {
    render(<Host messages={[makeMsg('m1')]} />)
    const panel = screen.getByTestId('scroll-panel')
    const s = installScrollMetrics(panel, { scrollTop: 0, scrollHeight: 1000, clientHeight: 200 })
    // 出程序滚动窗口(t=800 > until=700)
    vi.advanceTimersByTime(800)
    // 真实用户 wheel 意图 + 滚动 → 上翻判定生效 + pinned 按距离更新(800 > 120 → false)
    act(() => {
      lastResult.current!.markUserIntent()
      lastResult.current!.handleScroll()
    })
    expect(mockChatStore.state.userScrolledUp).toBe(true)
    // 后台图片解码长高 → 贴底态已失效,不得打扰用户阅读
    s.scrollHeight = 1200
    triggerRO()
    expect(s.scrollTop).toBe(0)
  })

  it('程序滚动窗口内距离变大 → pinned 冻结不清除,长高仍校正', () => {
    render(<Host messages={[makeMsg('m1')]} />) // t=0 doScroll:until=700
    const panel = screen.getByTestId('scroll-panel')
    const s = installScrollMetrics(panel, { scrollTop: 0, scrollHeight: 1000, clientHeight: 200 })
    vi.advanceTimersByTime(100) // t=100,窗口内(smooth 动画进行中)
    // 动画中距离暂时变大(内容增长快于动画)→ 不误判,也不误标用户上翻
    act(() => {
      lastResult.current!.handleScroll()
    })
    expect(mockChatStore.state.userScrolledUp).toBe(false)
    // pinned 保持 true → 事后长高仍被自校正网接管
    s.scrollHeight = 1200
    triggerRO()
    expect(s.scrollTop).toBe(1200)
  })

  it('程序滚动窗口过期后距离仍大 → pinned 清除,长高不校正', () => {
    render(<Host messages={[makeMsg('m1')]} />)
    const panel = screen.getByTestId('scroll-panel')
    const s = installScrollMetrics(panel, { scrollTop: 0, scrollHeight: 1000, clientHeight: 200 })
    vi.advanceTimersByTime(800) // t=800 > until=700,窗口已过
    act(() => {
      lastResult.current!.handleScroll()
    })
    // 距离 800 > 120 → pinned=false(无 wheel 意图,上翻判定不跑,但贴底判定独立生效)
    s.scrollHeight = 1200
    triggerRO()
    expect(s.scrollTop).toBe(0)
  })

  it('wheel 意图 800ms 内长高 → 不校正;意图过期后恢复校正', () => {
    render(<Host messages={[makeMsg('m1')]} />)
    const panel = screen.getByTestId('scroll-panel')
    const s = installScrollMetrics(panel, { scrollTop: 800, scrollHeight: 1000, clientHeight: 200 })
    // 手势进行中(意图标记)→ RO 校正让位
    act(() => {
      lastResult.current!.markUserIntent()
    })
    s.scrollHeight = 1200
    triggerRO()
    expect(s.scrollTop).toBe(800)
    // 800ms 意图自动过期 → 贴底跟随恢复(pinned 未被清除)
    vi.advanceTimersByTime(800)
    triggerRO()
    expect(s.scrollTop).toBe(1200)
  })

  it('scrollToBottom():清上翻 + 重置 pinned,长高恢复校正', () => {
    render(<Host messages={[makeMsg('m1')]} />)
    const panel = screen.getByTestId('scroll-panel')
    const s = installScrollMetrics(panel, { scrollTop: 0, scrollHeight: 1000, clientHeight: 200 })
    vi.advanceTimersByTime(800)
    // 构造上翻态
    act(() => {
      lastResult.current!.markUserIntent()
      lastResult.current!.handleScroll()
    })
    expect(mockChatStore.state.userScrolledUp).toBe(true)
    // 用户点击 jump-to-latest → scrollToBottom 三重置位
    act(() => {
      lastResult.current!.scrollToBottom()
    })
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'end' })
    expect(mockChatStore.state.userScrolledUp).toBe(false)
    // 内容长高:越过意图过期 timer(t=800+800=1600)后 RO 校正恢复
    s.scrollHeight = 1200
    vi.advanceTimersByTime(900)
    triggerRO()
    expect(s.scrollTop).toBe(1200)
  })
})
