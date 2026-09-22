// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * use-full-page-scroll 键盘交互回归测试(2026-09-22 键位归属改版配套)
 *
 * 背景 bug:整屏翻页曾无条件拦截 ↑/↓/Home/End 并 preventDefault,而
 * use-message-list-scroll 用同一组键切换"聚焦消息";/chat 复用首页组件后
 * 两套 window keydown 同时生效(一次按键既翻页又跳焦点),输入框方向键被吞。
 * 修复后:翻页只吃 PageUp/PageDown,且带焦点(INPUT/TEXTAREA/contenteditable)
 * 与修饰键(meta/ctrl/alt)守卫。本文件用行为断言(section/focusedIndex 实际值)
 * 锁定该契约。
 *
 * 依赖策略说明:useMessageListScroll 仅从 @/stores/chat 取 userScrolledUp /
 * setUserScrolledUp,该 store 运行时依赖只有 zustand + persist-helpers,可直接
 * 使用真实 zustand store(happy-dom 自带 localStorage,tests/setup.ts 还有兜底),
 * 不再复制 tests/message-list.test.tsx 的手工假 store,避免两套 mock 漂移。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'

import { useFullPageScroll } from './use-full-page-scroll'
import { useMessageListScroll } from '../components/chat/message-list/use-message-list-scroll'
import type { ChatMessage } from '@/stores/chat'

const PAGE_LOCK_MS = 900

/** 记录手动挂到 document.body 的元素,afterEach 统一摘除 */
const mountedElements: HTMLElement[] = []

/** 派发 keydown(真实事件走 window/document.body 冒泡),包 act 保证 setState 刷出 */
function pressKey(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

/** 放开 triggerPage 的 900ms 节流锁(fake timers 推进) */
function releasePageLock(): void {
  act(() => {
    vi.advanceTimersByTime(PAGE_LOCK_MS)
  })
}

/** 挂载一个可聚焦元素(input/textarea/contenteditable div)并 focus */
function mountFocusable(kind: 'input' | 'textarea' | 'contenteditable'): HTMLElement {
  const el: HTMLElement =
    kind === 'contenteditable' ? document.createElement('div') : document.createElement(kind)
  if (kind === 'contenteditable') {
    el.setAttribute('contenteditable', 'true')
  }
  document.body.appendChild(el)
  mountedElements.push(el)
  el.focus()
  return el
}

function makeMessages(count: number): ChatMessage[] {
  const roles: Array<'user' | 'assistant'> = ['user', 'assistant']
  return Array.from({ length: count }, (_, i): ChatMessage => ({
    id: `msg-${i}`,
    role: roles[i % 2] ?? 'user',
    content: `content-${i}`,
    createdAt: i + 1,
  }))
}

describe('useFullPageScroll — 键盘翻页(PageUp/PageDown)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    for (const el of mountedElements) el.remove()
    mountedElements.length = 0
    vi.useRealTimers()
  })

  it('PageDown 使 section 前进一页,PageUp 使 section 后退一页', () => {
    const { result } = renderHook(() => useFullPageScroll(5))
    expect(result.current.section).toBe(0)

    pressKey(document.body, { key: 'PageDown' })
    expect(result.current.section).toBe(1)

    releasePageLock()
    pressKey(document.body, { key: 'PageUp' })
    expect(result.current.section).toBe(0)
  })

  // 回归 2026-09-22 bug:↑/↓/Home/End 已从翻页侧让位给对话流。
  // 先 PageDown 到 section=1(非边界值,若旧 bug 存在四个键都会改变 section),
  // 再按方向键/首尾键:section 必须保持 1,且事件不被 preventDefault(原生行为保留)。
  it.each(['ArrowDown', 'ArrowUp', 'Home', 'End'] as const)(
    '%s 不触发整屏翻页(section 不变且不拦截默认行为)',
    (key) => {
      const { result } = renderHook(() => useFullPageScroll(5))
      pressKey(document.body, { key: 'PageDown' })
      expect(result.current.section).toBe(1)
      releasePageLock()

      const event = pressKey(document.body, { key })
      expect(result.current.section).toBe(1)
      expect(event.defaultPrevented).toBe(false)
    },
  )

  it('焦点守卫:keydown 目标为 input/textarea/contenteditable 时 PageDown 不翻页', () => {
    const { result } = renderHook(() => useFullPageScroll(5))

    for (const kind of ['input', 'textarea', 'contenteditable'] as const) {
      const el = mountFocusable(kind)
      const event = pressKey(el, { key: 'PageDown' })
      expect(result.current.section, `target=<${kind}>`).toBe(0)
      expect(event.defaultPrevented, `target=<${kind}> 不应被拦截`).toBe(false)
      releasePageLock()
    }
  })

  it('修饰键守卫:ctrl/meta/alt + PageDown 不翻页且放行原生行为', () => {
    const { result } = renderHook(() => useFullPageScroll(5))

    for (const mod of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      const event = pressKey(document.body, { key: 'PageDown', [mod]: true })
      expect(result.current.section, `${mod}+PageDown`).toBe(0)
      expect(event.defaultPrevented, `${mod}+PageDown 不应被拦截`).toBe(false)
      releasePageLock()
    }

    // 对照:同场景下不带修饰键的 PageDown 是能翻页的(证明上面三例不是"监听器根本没挂上"假绿)
    pressKey(document.body, { key: 'PageDown' })
    expect(result.current.section).toBe(1)
  })

  it('一键一主(跨 hook 联证):ArrowDown 只动消息焦点,PageDown 只翻整屏', () => {
    const messages = makeMessages(3)
    const { result } = renderHook(() => {
      const page = useFullPageScroll(3)
      const list = useMessageListScroll({ messages, isStreaming: false })
      return { page, list }
    })
    expect(result.current.page.section).toBe(0)
    expect(result.current.list.focusedIndex).toBe(-1)

    pressKey(document.body, { key: 'ArrowDown' })
    expect(result.current.list.focusedIndex).toBe(0)
    expect(result.current.page.section).toBe(0)

    pressKey(document.body, { key: 'PageDown' })
    expect(result.current.page.section).toBe(1)
    expect(result.current.list.focusedIndex).toBe(0)
  })

  it('边界:连续 PageDown 到末页后停在 total-1 不越界', () => {
    const { result } = renderHook(() => useFullPageScroll(3))
    for (let i = 0; i < 3; i += 1) {
      pressKey(document.body, { key: 'PageDown' })
      releasePageLock()
    }
    expect(result.current.section).toBe(2)

    pressKey(document.body, { key: 'PageDown' })
    expect(result.current.section).toBe(2)
  })

  it('边界:total=0 时按键不炸且 section 恒为 0', () => {
    const { result } = renderHook(() => useFullPageScroll())
    expect(result.current.total).toBe(0)

    pressKey(document.body, { key: 'PageDown' })
    expect(result.current.section).toBe(0)
    releasePageLock()
    pressKey(document.body, { key: 'PageUp' })
    expect(result.current.section).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
