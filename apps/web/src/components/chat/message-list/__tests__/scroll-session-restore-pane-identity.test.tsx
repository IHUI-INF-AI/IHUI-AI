// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话滚动位的**窗格身份**回归(票 G-934,2026-10-21 接回生产时补)。
 *
 * 立因:`use-conversation-pane-cache.ts` 刚收掉"两窗格承载同一会话 ⇒ 快照互相顶掉"那一格,
 * 而滚动位是同一枚二元身份(窗格 + 会话)的另一个消费面。落账键若只认 conversationId,
 * 刚修完的缺陷会在滚动位上原样重演 —— 所以这里既证"各回各位",也留一条**摘掉窗格维必互顶**
 * 的反证(反证不是修辞:它把"退化形态只剩一枚键"这件事量出来)。
 *
 * 几何桩化口径沿用 use-message-list-scroll.session-restore.test.tsx(happy-dom 不做布局)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'

import { useMessageListScroll } from '../use-message-list-scroll'
import type { MessageListScrollResult } from '../use-message-list-scroll'
import {
  RESTORE_GRACE_MS,
  buildScrollSessionKey,
  createRestoreGrace,
  resetSessionScrollStore,
  resolveRestoreGrace,
  sessionScrollStore,
  type ScrollSessionState,
} from '../scroll-session-restore'
import { ChatPaneProvider } from '@/stores/chat-pane-context'
import { getChatStoreForPane } from '@/stores/chat-panes'
import type { ChatMessage } from '@/stores/chat'

const VIEWPORT_HEIGHT = 200
const CONTENT_HEIGHT = 1000
/** 贴底节流窗 50ms;推进到 80ms 保证 trailing 一定落地。 */
const SETTLE_MS = 80

interface Geometry {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

interface HarnessProps {
  messages: ChatMessage[]
  onResult: (result: MessageListScrollResult) => void
}

interface PaneHarnessProps extends HarnessProps {
  paneId: string
}

function PaneHarness({ paneId, messages, onResult }: PaneHarnessProps) {
  return (
    <ChatPaneProvider paneId={paneId}>
      <Harness messages={messages} onResult={onResult} />
    </ChatPaneProvider>
  )
}

function Harness({ messages, onResult }: HarnessProps) {
  const result = useMessageListScroll({ messages, isStreaming: false })
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

function makeMessages(count: number, prefix: string): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}m${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `${prefix}content-${i}`,
    createdAt: i + 1,
  }))
}

interface PaneHandle {
  readonly geometry: Geometry
  readonly result: () => MessageListScrollResult
  /** 上翻到指定落点(滚动权交回用户),并断言这一格真的落成了"未跟随"。 */
  readonly scrollAwayTo: (offset: number) => void
  /** 切到另一条会话(窗格自己的 store 实例 ⇒ 另一窗格看不见这次切换)。 */
  readonly switchTo: (conversationId: string, messages: ChatMessage[]) => void
}

function mountPane(paneId: string, conversationId: string, messages: ChatMessage[]): PaneHandle {
  const store = getChatStoreForPane(paneId)
  store.setState({ conversationId, userScrolledUp: false })

  let latest: MessageListScrollResult | null = null
  const geometry: Geometry = {
    scrollTop: CONTENT_HEIGHT - VIEWPORT_HEIGHT,
    scrollHeight: CONTENT_HEIGHT,
    clientHeight: VIEWPORT_HEIGHT,
  }
  const view = render(
    <PaneHarness
      paneId={paneId}
      messages={messages}
      onResult={(r) => {
        latest = r
      }}
    />,
  )
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

  const rerender = (next: ChatMessage[]) => {
    act(() => {
      view.rerender(
        <PaneHarness
          paneId={paneId}
          messages={next}
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
    scrollAwayTo: (offset) => {
      const event = new Event('wheel', { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'deltaY', { value: -300 })
      act(() => {
        scroller.dispatchEvent(event)
      })
      geometry.scrollTop = offset
      act(() => {
        scroller.dispatchEvent(new Event('scroll'))
      })
      expect(latest?.userScrolledUp, '窗格滚动权必须已交回用户').toBe(true)
    },
    switchTo: (nextConversationId, nextMessages) => {
      act(() => {
        store.setState({ conversationId: nextConversationId })
      })
      rerender(nextMessages)
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  resetSessionScrollStore()
  // 落底动作按"量出来的高度"改写它所在窗格的 scrollTop(happy-dom 不做布局,只能自己接)
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (
    this: Element,
    arg?: ScrollIntoViewOptions | boolean,
  ) {
    if (typeof arg !== 'object' || arg === null || arg.block !== 'end') return
    const scroller = this.parentElement
    if (!scroller) return
    scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight
    scroller.dispatchEvent(new Event('scroll'))
  })
})

afterEach(() => {
  cleanup()
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function stateOf(offset: number, following: boolean): ScrollSessionState {
  return { offset, following, savedAt: 0 }
}

describe('落账键的窗格半边(身份来源只有 useOptionalPaneId 一个)', () => {
  it('根窗格(paneId=null)保持裸会话 id;非根窗格带窗格前缀', () => {
    expect(buildScrollSessionKey(null, 'conv-42')).toBe('conv-42')
    expect(buildScrollSessionKey('pane-left', 'conv-42')).toBe('pane-left::conv-42')
    expect(buildScrollSessionKey('pane-left', 'conv-42')).not.toBe(
      buildScrollSessionKey('pane-right', 'conv-42'),
    )
  })

  it('反证:摘掉窗格维 ⇒ 两窗格退化成同一枚键,后写把先写的落顶掉', () => {
    const paneless = buildScrollSessionKey(null, 'conv-42')
    sessionScrollStore.save(paneless, 300, false)
    sessionScrollStore.save(paneless, 600, false)
    expect(sessionScrollStore.lookup(paneless)?.offset).toBe(600)
    expect(sessionScrollStore.lookup(paneless)?.offset).not.toBe(300)
    // 带上窗格维就是两枚并存的账目,谁也不顶谁
    sessionScrollStore.save(buildScrollSessionKey('pane-left', 'conv-42'), 300, false)
    sessionScrollStore.save(buildScrollSessionKey('pane-right', 'conv-42'), 600, false)
    expect(sessionScrollStore.lookup(buildScrollSessionKey('pane-left', 'conv-42'))?.offset).toBe(
      300,
    )
    expect(sessionScrollStore.lookup(buildScrollSessionKey('pane-right', 'conv-42'))?.offset).toBe(
      600,
    )
  })
})

describe('两窗格承载同一会话:滚动位各回各位', () => {
  it('各自上翻到不同落点 ⇒ 切走再切回,各钉回自己那一位', () => {
    const left = mountPane('pane-left', 'conv-42', makeMessages(2, 'l'))
    const right = mountPane('pane-right', 'conv-42', makeMessages(2, 'r'))

    left.scrollAwayTo(300)
    right.scrollAwayTo(600)

    // 两条腿切到同一条目标会话(目标无账目 ⇒ 各自回落会话起始),再各自切回原会话
    left.switchTo('conv-77', makeMessages(3, 'l'))
    right.switchTo('conv-77', makeMessages(3, 'r'))
    left.switchTo('conv-42', makeMessages(2, 'l'))
    right.switchTo('conv-42', makeMessages(2, 'r'))

    expect(left.geometry.scrollTop, '左窗格必须回到它自己的 300').toBe(300)
    expect(right.geometry.scrollTop, '右窗格必须回到它自己的 600').toBe(600)
    expect(left.result().userScrolledUp).toBe(true)
    expect(right.result().userScrolledUp).toBe(true)
    expect(sessionScrollStore.lookup(buildScrollSessionKey('pane-left', 'conv-42'))?.offset).toBe(
      300,
    )
    expect(sessionScrollStore.lookup(buildScrollSessionKey('pane-right', 'conv-42'))?.offset).toBe(
      600,
    )
  })

  it('根窗格与非根窗格承载同一会话 ⇒ 两枚账目互不消费', () => {
    const rootHandle = mountPane('pane-root-only', 'conv-42', makeMessages(2, 'n'))
    rootHandle.scrollAwayTo(250)
    rootHandle.switchTo('conv-77', makeMessages(3, 'n'))
    // 单例面(无 Provider)的账目键就是裸会话 id —— 上面那一枚记在 'pane-root-only::conv-42' 上
    expect(sessionScrollStore.lookup('conv-42')).toBeUndefined()
    expect(
      sessionScrollStore.lookup(buildScrollSessionKey('pane-root-only', 'conv-42'))?.offset,
    ).toBe(250)
  })
})

describe('resolveRestoreGrace(宽限期修正判据,失效方向 = 少修正一次)', () => {
  it('无宽限期 / 已到期 / 已被用户夺权 ⇒ none', () => {
    expect(resolveRestoreGrace({ grace: null, now: 0, cancelled: false })).toEqual({ kind: 'none' })
    const grace = createRestoreGrace(stateOf(400, false), 1_000) as NonNullable<
      ReturnType<typeof createRestoreGrace>
    >
    expect(grace.until).toBe(1_000 + RESTORE_GRACE_MS)
    expect(resolveRestoreGrace({ grace, now: 1_000, cancelled: false })).toEqual({
      kind: 'pin',
      offset: 400,
    })
    expect(resolveRestoreGrace({ grace, now: grace.until, cancelled: false })).toEqual({
      kind: 'none',
    })
    expect(resolveRestoreGrace({ grace, now: 1_001, cancelled: true })).toEqual({ kind: 'none' })
  })

  it('跟随档 ⇒ stick;脏保存位的钉位档 ⇒ 根本不进宽限期(不得把读者拽回底部)', () => {
    expect(createRestoreGrace(stateOf(800, true), 1_000)).toEqual({
      until: 1_000 + RESTORE_GRACE_MS,
      target: null,
    })
    expect(
      resolveRestoreGrace({
        grace: createRestoreGrace(stateOf(800, true), 1_000),
        now: 1_000,
        cancelled: false,
      }),
    ).toEqual({ kind: 'stick' })
    expect(createRestoreGrace(stateOf(-1, false), 1_000)).toBeNull()
    expect(createRestoreGrace(stateOf(Number.NaN, false), 1_000)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
