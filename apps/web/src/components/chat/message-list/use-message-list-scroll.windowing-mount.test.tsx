// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-828 代裁(2026-10-23)接线层回归:useMessageListScroll 必须消费 ../windowing 的
 * 纯判据(单一真相源),而不是留在 2026-10-04 只接 windowPaddings 的半条腿上。
 *
 * 两格断言都是"改动前红、改动后绿"的控制测量:
 * 1. 挂载上限:1000 行全部量到 1px(行高塌缩)时,窗口化不得退化成整表挂载 ——
 *    旧手写二分无 MAX_MOUNTED_ITEMS 兜底,测高-重算循环会把挂载行数逐帧推到全表。
 * 2. 补页锚点:窗口化下数组首行未挂载时,前插补偿仍必须发生 —— 旧锚点只认数组首行,
 *    querySelector 落空 ⇒ 整条补偿链断裂 ⇒ 前插历史时视口直接跳位。
 *
 * 环境约定沿用 use-message-list-scroll.authority.test.tsx:happy-dom 不做布局,
 * 几何量全部由本文件桩化(行 rect 走 Element.prototype 桩,按 data-row-index 现算)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup, type RenderResult } from '@testing-library/react'

import { useMessageListScroll } from './use-message-list-scroll'
import type { MessageListScrollResult } from './use-message-list-scroll'
import type { ChatMessage } from '@/stores/chat'
import { MAX_MOUNTED_ITEMS } from '../windowing'

const VIEWPORT_HEIGHT = 200

interface Geometry {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

interface HarnessProps {
  messages: ChatMessage[]
  hasMoreHistory?: boolean
  onLoadMoreHistory?: () => void
  onResult: (result: MessageListScrollResult) => void
}

function Harness({ messages, hasMoreHistory, onLoadMoreHistory, onResult }: HarnessProps) {
  const result = useMessageListScroll({
    messages,
    isStreaming: false,
    hasMoreHistory,
    onLoadMoreHistory,
  })
  onResult(result)
  const { start, end } = result.visibleRange
  // 与 MessageList 同构:只挂窗口内的行,行上带 measureItem ref 与 data-message-id。
  // data-row-index = 该行在**整表**里的下标,harness 的 rect 桩按它现算布局位置。
  const rows = messages.slice(start, end + 1)
  return (
    <div ref={result.containerRef} data-testid="scroller" onScroll={() => result.handleScroll()}>
      {rows.map((m, i) => (
        <div
          key={m.id}
          ref={result.measureItem(m.id)}
          data-message-id={m.id}
          data-row-index={start + i}
        />
      ))}
      <div ref={result.bottomRef} data-testid="bottom-anchor" />
    </div>
  )
}

function makeMessage(index: number, prefix = 'm'): ChatMessage {
  return {
    id: `${prefix}${index}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `content-${index}`,
    createdAt: index + 1,
  }
}

function makeMessages(count: number, prefix = 'm'): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => makeMessage(i, prefix))
}

let originalGetBoundingClientRect: typeof Element.prototype.getBoundingClientRect | null = null

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

function mountHarness(
  initialMessages: ChatMessage[],
  options: {
    rowHeight: number
    initialScrollTop: number
    hasMoreHistory?: boolean
    onLoadMoreHistory?: () => void
  },
): {
  view: RenderResult
  geometry: Geometry
  result: () => MessageListScrollResult
  rerender: (messages: ChatMessage[]) => void
  dispatchScroll: () => void
  mountedRowCount: () => number
} {
  let latest: MessageListScrollResult | null = null
  const geometry: Geometry = {
    scrollTop: options.initialScrollTop,
    scrollHeight: initialMessages.length * options.rowHeight,
    clientHeight: VIEWPORT_HEIGHT,
  }

  // 行 rect 桩:happy-dom 无布局,按 data-row-index 现算"这一行此刻在视口哪"。
  // 挂载时刻 measureItem 就能读到正确高度(而不是默认 0),与真机语义一致。
  if (!originalGetBoundingClientRect)
    originalGetBoundingClientRect = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
    const raw = this.getAttribute('data-row-index')
    if (raw === null) return rectOf(0, 0)
    const index = Number(raw)
    return rectOf(index * options.rowHeight - geometry.scrollTop, options.rowHeight)
  }

  const renderHarness = (messages: ChatMessage[]) =>
    render(
      <Harness
        messages={messages}
        hasMoreHistory={options.hasMoreHistory}
        onLoadMoreHistory={options.onLoadMoreHistory}
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
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})

  return {
    view,
    geometry,
    result: () => {
      if (!latest) throw new Error('harness 尚未拿到 hook 结果')
      return latest
    },
    rerender: (messages) => {
      geometry.scrollHeight = messages.length * options.rowHeight
      act(() => {
        view.rerender(
          <Harness
            messages={messages}
            hasMoreHistory={options.hasMoreHistory}
            onLoadMoreHistory={options.onLoadMoreHistory}
            onResult={(r) => {
              latest = r
            }}
          />,
        )
      })
    },
    dispatchScroll: () => {
      act(() => {
        scroller.dispatchEvent(new Event('scroll'))
      })
    },
    mountedRowCount: () => view.container.querySelectorAll('[data-message-id]').length,
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
  if (originalGetBoundingClientRect) {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect
    originalGetBoundingClientRect = null
  }
})

describe('G-828 代裁接线:窗口区间走 windowing.resolveVisibleWindow', () => {
  it('行高塌缩(全 1px)时挂载行数不得越过 MAX_MOUNTED_ITEMS,测高-重算循环不得把窗口推成全表', () => {
    const h = mountHarness(makeMessages(1000), { rowHeight: 1, initialScrollTop: 0 })
    // 显式喂 'layout' 来源(与 measureItem→scheduleScrollUpdate 同一入口),
    // 不依赖 rAF 是否被 fake timers 接管。
    for (let frame = 0; frame < 60; frame++) {
      act(() => {
        h.result().handleScroll('layout')
      })
    }
    const { start, end } = h.result().visibleRange
    const span = end - start + 1
    expect(span).toBeLessThanOrEqual(MAX_MOUNTED_ITEMS)
    expect(h.mountedRowCount()).toBeLessThanOrEqual(MAX_MOUNTED_ITEMS)
    // 窗口化确实在生效(而不是"未启用"蒙过断言):1000 条 > 阈值 60
    expect(h.result().visibleRange).not.toEqual({ start: 0, end: 999 })
  })
})

describe('G-828 代裁接线:补页锚点走 windowing.historyAnchorCandidates(窗口首行优先)', () => {
  it('数组首行未挂载时,前插历史仍必须按锚点补偿 scrollTop(旧锚点在此格断裂)', () => {
    const onLoadMoreHistory = vi.fn()
    const ROW_H = 40
    const h = mountHarness(makeMessages(100), {
      rowHeight: ROW_H,
      initialScrollTop: 3800,
      hasMoreHistory: true,
      onLoadMoreHistory,
    })
    // 先在底部落一次账(窗口滑到底部区,数组首行脱离 DOM)。
    h.dispatchScroll()

    // 用户逐段上翻(每步都重算窗口;窗口首行 > 0 ⇒ 数组首行始终没挂回来)。
    for (const top of [3000, 2200, 1500, 900, 500]) {
      h.geometry.scrollTop = top
      h.dispatchScroll()
    }
    expect(h.result().visibleRange.start, '窗口首行必须 > 0(数组首行未挂载)').toBeGreaterThan(0)

    // 越过补页阈值(2 视口 = 400px)⇒ 触发历史加载,锚点按候选序取"窗口首行"。
    h.geometry.scrollTop = 380
    h.dispatchScroll()
    expect(onLoadMoreHistory, '到阈值必须发起补页').toHaveBeenCalledTimes(1)

    // 网络回来:前插 10 条更早历史(h0..h9 在数组头部)。
    const prepended = [...makeMessages(10, 'h'), ...makeMessages(100)]
    h.rerender(prepended)

    // 补偿判据:锚点行(触发瞬间的窗口首行)必须回到触发瞬间的视口偏移 ——
    // 前插 10 行 × 40px ⇒ scrollTop 恰好 +400。旧实现锚点认数组首行(未挂载)
    // ⇒ 不落锚 ⇒ 这一格 scrollTop 停在 380,用户视口被前插内容整体推走。
    expect(h.geometry.scrollTop).toBe(380 + 10 * ROW_H)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
