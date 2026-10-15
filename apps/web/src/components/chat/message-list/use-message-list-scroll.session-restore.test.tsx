// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话级滚动状态恢复(P2,2026-10-13 立)行为回归。
 *
 * 断言**先于实现**写下的控制测量(与 use-message-list-scroll.authority.test.tsx 同一手法):
 * 改动前跑本文件,第 1/2/3/5 例红 —— 切走不存现场、切回一律滚底、diff 流式撑高不追底。
 * 环境约定沿用 authority 测试:happy-dom 不做布局,scrollTop/scrollHeight/clientHeight
 * 由本文件显式桩化;贴底走 50ms leading+trailing 节流 ⇒ 每次改动后先 settle() 再断言。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'

import { useMessageListScroll } from './use-message-list-scroll'
import type { MessageListScrollResult } from './use-message-list-scroll'
import {
  sessionScrollStore,
  resetSessionScrollStore,
  RESTORE_PHASE2_DELAY_MS,
  RESTORE_GRACE_MS,
} from './scroll-session-restore'
import { useChatStore } from '@/stores/chat'
import type { ChatMessage, ToolCall } from '@/stores/chat'

const VIEWPORT_HEIGHT = 200
const CONTENT_HEIGHT = 1000
/** 节流窗 50ms;推进到 80ms 保证 trailing 一定落地。 */
const SETTLE_MS = 80

interface Geometry {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

interface HarnessProps {
  messages: ChatMessage[]
  isStreaming?: boolean
  onResult: (result: MessageListScrollResult) => void
}

function Harness({ messages, isStreaming = false, onResult }: HarnessProps) {
  const result = useMessageListScroll({ messages, isStreaming })
  onResult(result)
  return (
    <div ref={result.containerRef} data-testid="scroller" onScroll={() => result.handleScroll()}>
      {messages.map((m) => (
        <div key={m.id} data-message-id={m.id} />
      ))}
      <div ref={result.bottomRef} data-testid="bottom-anchor" />
    </div>
  )
}

function makeMessage(index: number, prefix = ''): ChatMessage {
  return {
    id: `${prefix}m${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `${prefix}content-${index}`,
    createdAt: index + 1,
  }
}

function makeMessages(count: number, prefix = ''): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => makeMessage(i, prefix))
}

function rectOf(top: number, height: number): DOMRect {
  return {
    top,
    left: 0,
    right: 0,
    bottom: top + height,
    x: 0,
    y: top,
    width: 0,
    height,
    toJSON: () => ({}),
  } as DOMRect
}

interface HarnessHandle {
  readonly geometry: Geometry
  readonly result: () => MessageListScrollResult
  readonly stickCalls: () => number
  readonly switchTo: (conversationId: string, messages: ChatMessage[], extra?: { isStreaming?: boolean }) => void
  readonly rerender: (messages: ChatMessage[], extra?: { isStreaming?: boolean }) => void
  readonly wheel: (deltaY: number) => void
  readonly dispatchScroll: () => void
  readonly settle: () => void
  readonly advance: (ms: number) => void
}

function mountHarness(
  initialMessages: ChatMessage[],
  options: { isStreaming?: boolean; scrollTop?: number } = {},
): HarnessHandle {
  let latest: MessageListScrollResult | null = null
  let stickCalls = 0
  const geometry: Geometry = {
    scrollTop: options.scrollTop ?? CONTENT_HEIGHT - VIEWPORT_HEIGHT,
    scrollHeight: CONTENT_HEIGHT,
    clientHeight: VIEWPORT_HEIGHT,
  }

  const renderHarness = (messages: ChatMessage[], isStreaming?: boolean) =>
    render(
      <Harness
        messages={messages}
        isStreaming={isStreaming ?? options.isStreaming}
        onResult={(r) => {
          latest = r
        }}
      />,
    )

  const view = renderHarness(initialMessages)
  const scroller = view.container.querySelector('[data-testid="scroller"]') as HTMLElement

  Object.defineProperty(scroller, 'scrollTop', {
    configurable: true,
    get: () => geometry.scrollTop,
    set: (value: number) => {
      geometry.scrollTop = value
    },
  })
  Object.defineProperty(scroller, 'scrollHeight', {
    configurable: true,
    get: () => geometry.scrollHeight,
  })
  Object.defineProperty(scroller, 'clientHeight', {
    configurable: true,
    get: () => geometry.clientHeight,
  })
  Object.defineProperty(scroller, 'getBoundingClientRect', {
    configurable: true,
    value: () => rectOf(0, geometry.clientHeight),
  })

  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation((arg?: unknown) => {
    const passed =
      typeof arg === 'object' && arg !== null
        ? (arg as { block?: string; behavior?: string })
        : undefined
    if (passed?.block !== 'end') return
    stickCalls += 1
    geometry.scrollTop = geometry.scrollHeight - geometry.clientHeight
    scroller.dispatchEvent(new Event('scroll'))
  })

  const rerender = (messages: ChatMessage[], extra?: { isStreaming?: boolean }) => {
    act(() => {
      view.rerender(
        <Harness
          messages={messages}
          isStreaming={extra?.isStreaming ?? options.isStreaming}
          onResult={(r) => {
            latest = r
          }}
        />,
      )
    })
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS)
    })
  }

  return {
    geometry,
    result: () => {
      if (!latest) throw new Error('harness 尚未拿到 hook 结果')
      return latest
    },
    stickCalls: () => stickCalls,
    switchTo: (conversationId, messages, extra) => {
      act(() => {
        useChatStore.setState({ conversationId })
      })
      rerender(messages, extra)
    },
    rerender,
    wheel: (deltaY) => {
      const event = new Event('wheel', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'deltaY', { value: deltaY })
      act(() => {
        scroller.dispatchEvent(event)
      })
    },
    dispatchScroll: () => {
      act(() => {
        scroller.dispatchEvent(new Event('scroll'))
      })
    },
    settle: () => {
      act(() => {
        vi.advanceTimersByTime(SETTLE_MS)
      })
    },
    advance: (ms) => {
      act(() => {
        vi.advanceTimersByTime(ms)
      })
    },
  }
}

/** 会话 A:用户上翻到 scrollTop=400 且滚动权在用户手里(未跟随)。 */
function scrollAwayFromBottom(h: HarnessHandle): void {
  h.wheel(-300)
  h.geometry.scrollTop = 400
  h.dispatchScroll()
  expect(h.result().userScrolledUp).toBe(true)
}

beforeEach(() => {
  vi.useFakeTimers()
  resetSessionScrollStore()
  useChatStore.setState({ conversationId: null, messages: [], userScrolledUp: false })
})

afterEach(() => {
  cleanup()
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  useChatStore.setState({ conversationId: null, messages: [], userScrolledUp: false })
})

describe('切走:每会话保存 {offset, following}(对标 Trae 的 {offset, stickToBottom})', () => {
  it('1. 未跟随切走:现场(offset=400, following=false)入账;新会话无账目回落跟随滚底', () => {
    useChatStore.setState({ conversationId: 'a' })
    const h = mountHarness(makeMessages(2))
    h.dispatchScroll()
    scrollAwayFromBottom(h)

    h.switchTo('b', makeMessages(3, 'b'))

    expect(sessionScrollStore.lookup('a')).toMatchObject({ offset: 400, following: false })
    // B 无账目 ⇒ 回落"会话起始"(跟随滚底):修正滚动权从旧会话漂移的现状缺陷
    expect(h.result().userScrolledUp).toBe(false)
    expect(h.geometry.scrollTop).toBe(CONTENT_HEIGHT - VIEWPORT_HEIGHT)
  })

  it('2. 跟随中切走:following=true 入账', () => {
    useChatStore.setState({ conversationId: 'a' })
    const h = mountHarness(makeMessages(2))
    h.dispatchScroll()
    expect(h.result().userScrolledUp).toBe(false)

    h.switchTo('b', makeMessages(3, 'b'))

    expect(sessionScrollStore.lookup('a')).toMatchObject({ following: true })
  })
})

describe('切回:二段恢复(先钉保存位,100ms 后按测量修正;跟随档交给贴底)', () => {
  it('3. 切回未跟随的会话:位置原样回去,不被拉回底部', () => {
    useChatStore.setState({ conversationId: 'a' })
    const h = mountHarness(makeMessages(2))
    h.dispatchScroll()
    scrollAwayFromBottom(h)
    h.switchTo('b', makeMessages(3, 'b'))

    const sticksBefore = h.stickCalls()
    h.switchTo('a', makeMessages(2))

    expect(h.geometry.scrollTop, '第一段必须钉回保存位').toBe(400)
    expect(h.result().userScrolledUp, '滚动权按快照恢复(仍在用户手里)').toBe(true)
    expect(h.stickCalls(), '不得被拉回底部').toBe(sticksBefore)
    // 第二段(100ms 后)按补齐后的测量再钉一次,位置不变
    h.advance(RESTORE_PHASE2_DELAY_MS)
    expect(h.geometry.scrollTop).toBe(400)
  })

  it('4. 切回跟随中的会话:照常滚到最新', () => {
    useChatStore.setState({ conversationId: 'a' })
    const h = mountHarness(makeMessages(2))
    h.dispatchScroll()
    expect(sessionScrollStore.lookup('a')).toBeUndefined() // 未切走,账目还没落
    h.switchTo('b', makeMessages(3, 'b'))
    expect(sessionScrollStore.lookup('a')?.following).toBe(true)

    const sticksBefore = h.stickCalls()
    h.switchTo('a', makeMessages(2))

    expect(h.geometry.scrollTop).toBe(CONTENT_HEIGHT - VIEWPORT_HEIGHT)
    expect(h.result().userScrolledUp).toBe(false)
    expect(h.stickCalls()).toBeGreaterThan(sticksBefore)
  })

  it('5. 异步到达(缓存未命中):切换瞬间不消费,内容就位那帧才恢复', () => {
    useChatStore.setState({ conversationId: 'a' })
    const h = mountHarness(makeMessages(2))
    h.dispatchScroll()
    scrollAwayFromBottom(h)

    // 只切 id,messages 引用不变(历史还在异步拉取)⇒ 不消费
    act(() => {
      useChatStore.setState({ conversationId: 'b' })
    })
    expect(h.geometry.scrollTop, '内容未就位不得动位置').toBe(400)

    // 内容就位(B 无账目 ⇒ 回落跟随滚底)
    h.rerender(makeMessages(3, 'b'))
    expect(h.result().userScrolledUp).toBe(false)
    expect(h.geometry.scrollTop).toBe(CONTENT_HEIGHT - VIEWPORT_HEIGHT)
  })

  it('6. 挂起过期(TTL 外内容才到)⇒ 作废并回落会话起始(跟随滚底)', () => {
    useChatStore.setState({ conversationId: 'a' })
    const h = mountHarness(makeMessages(2))
    h.dispatchScroll()
    h.switchTo('b', makeMessages(3, 'b'))
    scrollAwayFromBottom(h)

    // 切回 A 但内容迟迟不到,超过 TTL 才就位 ⇒ 挂起作废,回落跟随滚底
    act(() => {
      useChatStore.setState({ conversationId: 'a' })
    })
    h.advance(5100)
    h.rerender(makeMessages(4))

    expect(h.result().userScrolledUp).toBe(false)
    expect(h.geometry.scrollTop).toBe(CONTENT_HEIGHT - VIEWPORT_HEIGHT)
  })
})

describe('文件 diff 流式变更触发追底(P2b,对标 Trae"文件 diff 变更也触发追底")', () => {
  const editToolCall = (partialDiffLen: number): ToolCall[] => [
    {
      id: 't1',
      toolName: 'edit_file',
      args: {},
      status: 'running',
      partialDiff: 'x'.repeat(partialDiffLen),
    },
  ]
  const withDiff = (partialDiffLen: number): ChatMessage[] =>
    makeMessages(2).map((m) =>
      m.role === 'assistant' ? { ...m, toolCalls: editToolCall(partialDiffLen) } : m,
    )

  it('7. 跟随中 partialDiff 增长 ⇒ 追底(partialDiff 不改 content,原判据对它全盲)', () => {
    useChatStore.setState({ conversationId: 'a' })
    const h = mountHarness(withDiff(50), { isStreaming: true })
    h.dispatchScroll()
    const before = h.stickCalls()

    h.rerender(withDiff(120), { isStreaming: true })

    expect(h.stickCalls()).toBeGreaterThan(before)
  })

  it('8. 已解除跟随时 partialDiff 增长 ⇒ hold,不夺用户位置', () => {
    useChatStore.setState({ conversationId: 'a' })
    const h = mountHarness(withDiff(50), { isStreaming: true })
    h.dispatchScroll()
    scrollAwayFromBottom(h)
    const before = h.stickCalls()

    h.rerender(withDiff(300), { isStreaming: true })

    expect(h.stickCalls()).toBe(before)
    expect(h.geometry.scrollTop).toBe(400)
  })
})

describe('恢复的主动贴底与宽限期修正(2026-10-13 真机实测立:deps 盲区停顶 + clamp 砸 0)', () => {
  /** 一次真实高度测量(harness 桩元素),触发 scheduleScrollUpdate 的 rAF 批处理。 */
  const measure = (h: HarnessHandle, id: string, height: number) => {
    h.result().measureItem(id)({ getBoundingClientRect: () => rectOf(0, height) } as HTMLElement)
    act(() => {
      vi.advanceTimersByTime(16) // 推进一帧 rAF
    })
  }

  it('9. 跟随档恢复必须主动贴底:两会话同长同内容(贴底 effect 的 deps 盲区)也要落底', () => {
    useChatStore.setState({ conversationId: 'a' })
    const h = mountHarness(makeMessages(3))
    h.dispatchScroll()
    const before = h.stickCalls()

    // B 与 A 同长、末条 content 同值 ⇒ messages.length / lastContent 全不变,
    // 既有贴底 effect 不会跑 —— following 档若只交权不滚,列表停顶(真机:sh-ch=1905 停 0)。
    h.switchTo('b', makeMessages(3))

    expect(h.stickCalls(), '恢复跟随必须主动落底').toBeGreaterThan(before)
    expect(h.geometry.scrollTop).toBe(CONTENT_HEIGHT - VIEWPORT_HEIGHT)
    expect(h.result().userScrolledUp).toBe(false)
  })

  it('10. 宽限期:首帧内容矮于保存位被浏览器 clamp 后,测量撑高时重钉保存位', () => {
    useChatStore.setState({ conversationId: 'a' })
    const h = mountHarness(makeMessages(2))
    h.dispatchScroll()
    sessionScrollStore.save('b', 400, false)

    h.switchTo('b', makeMessages(3, 'b'))
    expect(h.geometry.scrollTop, '第一段钉位').toBe(400)

    // 物理事实:内容矮于保存位时浏览器把 scrollTop clamp 到 0(harness 手动模拟;
    // clamp 引发的回退 scroll 事件无用户凭据,不得撤 grace)
    h.geometry.scrollTop = 0
    measure(h, 'bm0', 800)

    expect(h.geometry.scrollTop, '宽限期内测量必须重钉保存位').toBe(400)
  })

  it('11. 宽限期过期后不再修正(位置还给用户)', () => {
    useChatStore.setState({ conversationId: 'a' })
    const h = mountHarness(makeMessages(2))
    h.dispatchScroll()
    sessionScrollStore.save('b', 400, false)

    h.switchTo('b', makeMessages(3, 'b'))
    expect(h.geometry.scrollTop).toBe(400)

    h.advance(RESTORE_GRACE_MS + 100)
    h.geometry.scrollTop = 0
    measure(h, 'bm0', 800)

    expect(h.geometry.scrollTop, '宽限期外不得再动位置').toBe(0)
  })

  it('12. 宽限期内用户输入(wheel)夺权:修正让位,不再拽回', () => {
    useChatStore.setState({ conversationId: 'a' })
    const h = mountHarness(makeMessages(2))
    h.dispatchScroll()
    sessionScrollStore.save('b', 400, false)

    h.switchTo('b', makeMessages(3, 'b'))
    expect(h.geometry.scrollTop).toBe(400)

    h.wheel(-300)
    h.geometry.scrollTop = 100
    h.dispatchScroll()
    expect(h.result().userScrolledUp).toBe(true)

    measure(h, 'bm0', 800)

    expect(h.geometry.scrollTop, '用户已夺权,不得拽回保存位').toBe(100)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
