// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * useMessageListScroll 的滚动权行为回归(2026-09-27 立)。
 *
 * 这一组断言**先于实现**写下,用来做控制测量(证明判据不是空转):
 * - 改动前跑本文件:第 1/2/4/5/6/7 例按预期红 —— 旧实现把用户的上滚整体吞掉、
 *   把程序化滚动的中间帧读成"用户上翻"、卸载即弃测量、前插不足 50px 永不补偿。
 * - 改动后跑本文件:全绿。
 * 旧判据原文(`use-message-list-scroll.ts` 改动前的 `:280`)是
 * `const shouldForceScroll = isNewMessage || (!userScrolledUpRef.current && isStreaming)`,
 * 新消息那一支无条件强制滚底 —— 第 1 例喂的就是这条。
 *
 * 两条环境约定(都是踩过才知道的,写下来防下一个人重新猜):
 * 1. happy-dom 不做布局 ⇒ 容器/行的 scrollTop、clientHeight、scrollHeight、
 *    getBoundingClientRect 全部由本文件显式桩化。
 * 2. 贴底走 #9 的 leading+trailing 节流,一次内容变化可能落在 50ms 的 trailing
 *    定时器上 ⇒ 每次改动之后必须先 `settle()` 推进假定时器再断言,否则"有没有被拉回底部"
 *    这一维永远观察不到(本文件第一版就是这么假绿的:计数恒 0,连"不得拉回"两条白过)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup, type RenderResult } from '@testing-library/react'

import { useMessageListScroll } from './use-message-list-scroll'
import type { MessageListScrollResult } from './use-message-list-scroll'
import type { ChatMessage } from '@/stores/chat'

const VIEWPORT_HEIGHT = 200
const CONTENT_HEIGHT = 1000
/** 节流窗 50ms;推进到 80ms 保证 trailing 一定落地。 */
const SETTLE_MS = 80

interface Geometry {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

interface HarnessHandle {
  readonly view: RenderResult
  readonly geometry: Geometry
  readonly stickCalls: () => number
  readonly result: () => MessageListScrollResult
  readonly rerender: (messages: ChatMessage[], extra?: Partial<HarnessProps>) => void
  readonly rowTop: (messageId: string, top: number) => void
  readonly wheel: (deltaY: number) => void
  readonly dispatchScroll: () => void
  readonly settle: () => void
}

interface HarnessProps {
  messages: ChatMessage[]
  isStreaming?: boolean
  hasMoreHistory?: boolean
  loadingMoreHistory?: boolean
  onLoadMoreHistory?: () => void
  onResult: (result: MessageListScrollResult) => void
}

function Harness({
  messages,
  isStreaming = false,
  hasMoreHistory = false,
  loadingMoreHistory = false,
  onLoadMoreHistory,
  onResult,
}: HarnessProps) {
  const result = useMessageListScroll({
    messages,
    isStreaming,
    hasMoreHistory,
    loadingMoreHistory,
    onLoadMoreHistory,
  })
  onResult(result)
  // 刻意写零参箭头:改动前 handleScroll 是无参的,改动后 source 形参可选。
  // 同一份测试文件因此可以分别喂给改动前/改动后的实现,做真正的 A/B。
  return (
    <div ref={result.containerRef} data-testid="scroller" onScroll={() => result.handleScroll()}>
      {messages.map((m) => (
        <div key={m.id} data-message-id={m.id} />
      ))}
      <div ref={result.bottomRef} data-testid="bottom-anchor" />
    </div>
  )
}

function makeMessage(index: number): ChatMessage {
  return {
    id: `m${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `content-${index}`,
    createdAt: index + 1,
  }
}

function makeMessages(count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => makeMessage(i))
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

interface MountOptions {
  initialScrollTop?: number
  isStreaming?: boolean
  hasMoreHistory?: boolean
  onLoadMoreHistory?: () => void
  /** 程序化贴底是否先派一枚"还在半路"的 scroll 事件(浏览器里 smooth 确有中间帧)。 */
  midFlightScroll?: boolean
}

function mountHarness(initialMessages: ChatMessage[], options: MountOptions = {}): HarnessHandle {
  let latest: MessageListScrollResult | null = null
  let stickCalls = 0
  const geometry: Geometry = {
    scrollTop: options.initialScrollTop ?? CONTENT_HEIGHT - VIEWPORT_HEIGHT,
    scrollHeight: CONTENT_HEIGHT,
    clientHeight: VIEWPORT_HEIGHT,
  }

  const renderHarness = (messages: ChatMessage[], extra?: Partial<HarnessProps>) =>
    render(
      <Harness
        messages={messages}
        isStreaming={extra?.isStreaming ?? options.isStreaming}
        hasMoreHistory={extra?.hasMoreHistory ?? options.hasMoreHistory}
        onLoadMoreHistory={extra?.onLoadMoreHistory ?? options.onLoadMoreHistory}
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

  // scrollIntoView ⇒ 桩成浏览器语义:midFlight 时先停在半路派一枚 scroll 事件,再落到底派第二枚。
  // 不靠 `this` 认人(vitest 原型 spy 不保证绑定 receiver);本 harness 里以 block:'end'
  // 发起贴底的只有被测 hook 与"跳到最新"按钮,故按参数认调用即足够。
  const midFlightRequested = options.midFlightScroll === true
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation((arg?: unknown) => {
    const passed =
      typeof arg === 'object' && arg !== null
        ? (arg as { block?: string; behavior?: string })
        : undefined
    if (passed?.block !== 'end') return
    stickCalls += 1
    const target = geometry.scrollHeight - geometry.clientHeight
    if (midFlightRequested && geometry.scrollTop < target) {
      geometry.scrollTop += Math.ceil((target - geometry.scrollTop) / 2)
      scroller.dispatchEvent(new Event('scroll'))
    }
    geometry.scrollTop = target
    scroller.dispatchEvent(new Event('scroll'))
  })

  return {
    view,
    geometry,
    stickCalls: () => stickCalls,
    result: () => {
      if (!latest) throw new Error('harness 尚未拿到 hook 结果')
      return latest
    },
    rerender: (messages, extra) => {
      act(() => {
        view.rerender(
          <Harness
            messages={messages}
            isStreaming={extra?.isStreaming ?? options.isStreaming}
            hasMoreHistory={extra?.hasMoreHistory ?? options.hasMoreHistory}
            onLoadMoreHistory={extra?.onLoadMoreHistory ?? options.onLoadMoreHistory}
            onResult={(r) => {
              latest = r
            }}
          />,
        )
      })
      // 节流可能把这一次贴底排到 50ms 的 trailing 定时器上,不推进就观察不到
      act(() => {
        vi.advanceTimersByTime(SETTLE_MS)
      })
    },
    rowTop: (messageId, top) => {
      const row = view.container.querySelector(`[data-message-id="${messageId}"]`)
      if (!row) throw new Error(`harness 找不到行 ${messageId}`)
      Object.defineProperty(row, 'getBoundingClientRect', {
        configurable: true,
        value: () => rectOf(top, 40),
      })
    },
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
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('滚动权归用户意图(行为变更登记:已解除跟随时,新消息不再拉回底部)', () => {
  it('1. 用户上翻后新消息不得拉回底部;阅读位置原样保持', () => {
    const h = mountHarness(makeMessages(2))
    h.dispatchScroll() // 让几何账目与"在底部"这一事实先落一次
    expect(h.result().userScrolledUp).toBe(false)

    // 浏览器顺序:用户输入 → 位移 → scroll 事件(要到下一帧才派发)
    h.wheel(-300)
    h.geometry.scrollTop = 400
    h.dispatchScroll()
    expect(h.result().userScrolledUp).toBe(true)

    h.geometry.scrollHeight = CONTENT_HEIGHT + 200
    h.rerender(makeMessages(3))

    expect(h.stickCalls(), '新消息不得把上翻中的用户拽回底部').toBe(0)
    expect(h.geometry.scrollTop, '阅读位置必须保持').toBe(400)
    expect(h.result().userScrolledUp).toBe(true)
  })

  it('2. 只有 wheel 已发生、scroll 事件尚未派发时,内容变化也不得夺走滚动权', () => {
    const h = mountHarness(makeMessages(2))
    // 输入已发生、位移已生效,但 scroll 事件还没派发 —— 中间恰好插进一次内容 commit。
    h.wheel(-300)
    h.geometry.scrollTop = 400
    h.geometry.scrollHeight = CONTENT_HEIGHT + 200
    h.rerender(makeMessages(3))

    expect(h.stickCalls(), 'commit 时刻不得拿过期快照把用户拽回底部').toBe(0)
    expect(h.geometry.scrollTop).toBe(400)
    expect(h.result().userScrolledUp).toBe(true)
  })

  it('3. 用户本来就在底部时新消息照常跟随(主路径不受影响)', () => {
    const h = mountHarness(makeMessages(2))
    h.geometry.scrollHeight = CONTENT_HEIGHT + 200
    h.rerender(makeMessages(3))

    expect(h.stickCalls(), '在底部时新消息必须贴底').toBe(1)
    expect(h.geometry.scrollTop).toBe(CONTENT_HEIGHT + 200 - VIEWPORT_HEIGHT)
    expect(h.result().userScrolledUp).toBe(false)
  })

  it('4. 程序化贴底的中间帧不得被读成"用户上翻"(来源标记)', () => {
    const h = mountHarness(makeMessages(2), { midFlightScroll: true, isStreaming: true })
    h.geometry.scrollHeight = CONTENT_HEIGHT + 600
    h.rerender(makeMessages(3), { isStreaming: true })

    expect(h.stickCalls(), '跟随态下的流式增量应贴底').toBe(1)
    expect(h.result().userScrolledUp, '自己产生的位移不构成用户意图').toBe(false)
    expect(h.geometry.scrollTop).toBe(CONTENT_HEIGHT + 600 - VIEWPORT_HEIGHT)
  })

  it('4b. 上滚后立刻点「跳到最新」,其后的动画帧不得被上一条用户凭据反噬(G-252 验收抓到的真缺陷)', () => {
    // 真实 Chromium 里量出来的失败形态:流式中上滚 → 400ms 内点按钮 → 平滑动画派发的
    // scroll 事件撞上还没过期的 `awayFromBottom` 凭据,而判序是"用户凭据优先于程序化窗口"
    // (`scroll-authority.ts` 的 `resolveScrollEventSource`)⇒ 动画第一帧就把 following
    // 再解除一次,列表停在距底 244–366px 且**永不再跟随**(用户症状:「点了没反应、
    // 按钮又冒出来」)。间隔 >400ms 点则正常 —— 正是 TTL 的形状。
    const h = mountHarness(makeMessages(2), { isStreaming: true })
    // 换掉夹具默认桩:它把动画事件**同步**打在处理器内部,于是处理器末尾那次
    // `applyAuthority({ following: true })` 会把它们全部吞掉 —— 这一型在 jsdom 里"通过"
    // 而真浏览器里必挂,因为浏览器的平滑滚动事件是在点击处理器**返回之后**才派发。
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => undefined)
    h.dispatchScroll()
    h.wheel(-300)
    h.geometry.scrollTop = 400
    h.dispatchScroll()
    expect(h.result().userScrolledUp, '前置条件:用户上翻应已解除跟随').toBe(true)

    act(() => h.result().scrollToBottom())
    expect(h.result().userScrolledUp, '点完按钮当下应已把滚动权交回跟随').toBe(false)

    // 动画的第一帧:位移向下、还没到底。上一条凭据若没作废,这一帧就把滚动权夺回去。
    h.geometry.scrollTop = 500
    h.dispatchScroll()
    expect(h.result().userScrolledUp, '动画中间帧不得被上一条上翻凭据读成用户意图').toBe(false)
  })
})

describe('测量保留与前插锚点', () => {
  it('5. 行滚出窗口时保留测量值(重挂不得回落 160px 估计档)', () => {
    const h = mountHarness(makeMessages(2))
    const measured = { getBoundingClientRect: () => rectOf(0, 500) } as unknown as HTMLElement

    act(() => {
      h.result().measureItem('m0')(measured)
    })
    expect(h.result().computeCumulative().offsets[1]).toBe(500)

    act(() => {
      h.result().measureItem('m0')(null)
    })
    expect(
      h.result().computeCumulative().offsets[1],
      '卸载即弃测量会让滚动条在滚回来时逐帧跳动',
    ).toBe(500)
  })

  it('6. 前插 30px 也按确定性锚点补偿(旧实现的 >50px 阈值下这一档永不补偿)', () => {
    runPrependCase({ drift: 0 })
  })

  it('7. 触发到提交之间 scrollTop 被改写过,锚点目标不变(中间位移不得重复计入)', () => {
    runPrependCase({ drift: 15 })
  })

  it('8. 前插在途时用户又滚了一段,补偿必须保住他这段位移(不得弹回触发瞬间)', () => {
    // G-252 运行时验收的 M3-B:真实浏览器里量到"触发后继续滚到边界,落地把位置弹回触发
    // 瞬间"(逐帧最大 1340px)。锚点存的是**触发瞬间**的视口偏移,而那份账在用户又动了之后
    // 就是旧账 —— 补偿于是把用户的新落点当偏差修掉。
    const messages = makeMessages(2)
    let loadCalls = 0
    const h = mountHarness(messages, {
      initialScrollTop: 20,
      hasMoreHistory: true,
      onLoadMoreHistory: () => {
        loadCalls += 1
      },
    })
    h.rowTop('m0', 20)
    h.wheel(-300)
    h.geometry.scrollTop = 20
    h.dispatchScroll()
    expect(loadCalls).toBe(1)

    // 在途:用户继续往上翻了 15px(scrollTop 20 → 5,锚点在视口里被推到 35)
    h.wheel(-150)
    h.rowTop('m0', 35)
    h.geometry.scrollTop = 5
    h.dispatchScroll()

    // 提交:上方插入 30px,锚点在内容中的绝对偏移 = 视口 65 + scrollTop 5 = 70
    h.geometry.scrollHeight = CONTENT_HEIGHT + 30
    h.rowTop('m0', 65)
    h.rerender([makeMessage(-1), ...messages])

    // 按用户落点重定基 ⇒ 目标 scrollTop = 70 − 35 = 35(把他那一跳 15px 保住);
    // 钉死触发瞬间的 20 会算出 70 − 20 = 50,即把用户刚滚到的位置又弹回去。
    expect(h.geometry.scrollTop, '补偿必须落在用户自己的阅读位置上').toBe(35)
    expect(h.stickCalls(), '补偿是程序化位移,不得顺手把用户拽到底部').toBe(0)
  })
})

/** 前插骨架;`drift` 模拟"提交前 scrollTop 已被别人(或 virtualizer)改写"。 */
function runPrependCase(input: { drift: number }): void {
  const messages = makeMessages(2)
  let loadCalls = 0
  const h = mountHarness(messages, {
    initialScrollTop: 20,
    hasMoreHistory: true,
    onLoadMoreHistory: () => {
      loadCalls += 1
    },
  })
  h.rowTop('m0', 20)
  // 到窗口顶部的现实路径是"用户自己往上翻"(不是首屏挂载后就停在那儿),
  // 所以先记一次上翻:这一步同时把滚动权解除 —— 前插补偿正是在"用户已解除跟随"的前提下才成立。
  h.wheel(-300)
  h.geometry.scrollTop = 20
  h.dispatchScroll()
  expect(loadCalls).toBe(1)
  expect(h.result().userScrolledUp, '已到窗口顶部 ⇒ 滚动权归用户').toBe(true)

  // 提交前:上方插入 30px 内容(刻意小于旧的 50px 阈值),锚点被推下去
  const drift = input.drift
  h.geometry.scrollHeight = CONTENT_HEIGHT + 30
  h.rowTop('m0', 50 - drift)
  if (drift > 0) h.geometry.scrollTop = 20 + drift
  h.rerender([makeMessage(-1), ...messages])

  // 绝对目标 = 锚点在内容中的偏移 70 - 触发瞬间保存的视口偏移 20 ⇒ scrollTop 50
  expect(h.geometry.scrollTop, '锚点应被送回原阅读位置').toBe(50)
  expect(h.stickCalls(), '补偿是程序化位移,不得顺手把用户拽到底部').toBe(0)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
