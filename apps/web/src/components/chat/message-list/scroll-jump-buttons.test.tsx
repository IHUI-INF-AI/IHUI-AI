// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ScrollJumpButtons 契约测试(2026-09-22 归一配套)
 *
 * 背景:此前对话列底部同时存在两枚语义重复的「跳到最新」——
 * MessageList 内联的居中按钮(data-testid="message-list-jump-latest")与右下角
 * affordance 列里的「跳底」按钮(aria-label 同样是 jumpToLatest)。现已合并进本组件,
 * 本文件锁死合并后的契约:同屏仅一枚、显隐条件为「距底>800px 或用户主动上滚」、
 * 无消息时不显、隐藏态退出 Tab 序与无障碍树、旧居中按钮不得复活。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

const mockT = vi.hoisted(() => {
  const map: Record<string, string> = {
    jumpToTop: '跳到顶部',
    jumpToLatest: '跳到最新',
  }
  return (key: string) => map[key] ?? key
})

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

import { ScrollJumpButtons } from './scroll-jump-buttons'

interface Props {
  isFarFromTop: boolean
  isFarFromBottom: boolean
  userScrolledUp: boolean
  hasMessages: boolean
  isStreaming: boolean
  onJumpTop: () => void
  onJumpLatest: () => void
}

const defaultProps = {
  isFarFromTop: false,
  isFarFromBottom: false,
  userScrolledUp: false,
  hasMessages: true,
  isStreaming: false,
  onJumpTop: vi.fn(),
  onJumpLatest: vi.fn(),
}

function renderButtons(overrides: Partial<Props> = {}) {
  const props = { ...defaultProps, ...overrides }
  return render(
    <div className="relative h-96 w-72">
      <ScrollJumpButtons {...props} />
    </div>,
  )
}

/**
 * 隐藏态带 aria-hidden,而 RTL 的 getBy* 默认过滤掉无障碍树外的元素,
 * 故显隐断言一律走容器 querySelector 直取真实 DOM 节点。
 */
function affordance(container: HTMLElement, testid: string): HTMLElement {
  const el = container.querySelector(`[data-testid="${testid}"]`)
  if (!el) throw new Error(`未找到 ${testid}`)
  return el as HTMLElement
}
const latest = (container: HTMLElement) => affordance(container, 'scroll-jump-bottom')
const top = (container: HTMLElement) => affordance(container, 'scroll-jump-top')

function isRevealed(el: HTMLElement): boolean {
  return el.className.includes('opacity-100') && el.className.includes('pointer-events-auto')
}

describe('ScrollJumpButtons — 跳到最新(归一后)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('整棵树只有一枚「跳到最新」,且旧的底部居中按钮不再存在', () => {
    const { container } = renderButtons({ userScrolledUp: true, isFarFromBottom: true })
    expect(screen.getAllByLabelText('跳到最新')).toHaveLength(1)
    expect(container.querySelector('[data-testid="message-list-jump-latest"]')).toBeNull()
  })

  it('显隐矩阵:距底>800px 或用户主动上滚,任一成立即显示', () => {
    const cases: Array<[Partial<Props>, boolean]> = [
      [{ isFarFromBottom: false, userScrolledUp: false }, false],
      [{ isFarFromBottom: true, userScrolledUp: false }, true],
      [{ isFarFromBottom: false, userScrolledUp: true }, true],
      [{ isFarFromBottom: true, userScrolledUp: true }, true],
    ]
    for (const [patch, expected] of cases) {
      const { container } = renderButtons(patch)
      expect(isRevealed(latest(container)), JSON.stringify(patch)).toBe(expected)
      cleanup()
    }
  })

  it('无消息时即使已上滚也不显示(hasMessages 门控)', () => {
    const { container } = renderButtons({ userScrolledUp: true, hasMessages: false })
    expect(isRevealed(latest(container))).toBe(false)
  })

  it('跳顶按钮仍只由 isFarFromTop 控制,与「跳到最新」互不影响', () => {
    const { container } = renderButtons({
      isFarFromTop: true,
      userScrolledUp: false,
      isFarFromBottom: false,
    })
    expect(isRevealed(top(container))).toBe(true)
    expect(isRevealed(latest(container))).toBe(false)
  })

  it('隐藏态退出 Tab 序与无障碍树,显示态回归可聚焦(防右下角偷走 Tab)', () => {
    const hidden = renderButtons({ userScrolledUp: false, isFarFromBottom: false })
    const hiddenBtn = latest(hidden.container)
    expect(hiddenBtn.getAttribute('tabindex')).toBe('-1')
    expect(hiddenBtn.getAttribute('aria-hidden')).toBe('true')
    hidden.unmount()

    const shown = renderButtons({ userScrolledUp: true })
    const shownBtn = latest(shown.container)
    expect(shownBtn.getAttribute('tabindex')).toBe('0')
    expect(shownBtn.hasAttribute('aria-hidden')).toBe(false)
  })

  it('点击「跳到最新」只回调 onJumpLatest 一次(调用方接 hook 的 scrollToBottom)', () => {
    const onJumpLatest = vi.fn()
    const { container } = renderButtons({ userScrolledUp: true, isStreaming: true, onJumpLatest })
    fireEvent.click(latest(container))
    expect(onJumpLatest).toHaveBeenCalledTimes(1)
  })

  it('流式期间红点随该按钮出现并挂在其内,非流式时无红点', () => {
    const streaming = renderButtons({ userScrolledUp: true, isStreaming: true })
    const dot = streaming.container.querySelector('[data-testid="message-list-jump-latest-dot"]')
    expect(dot).not.toBeNull()
    expect(latest(streaming.container).contains(dot as Node)).toBe(true)
    streaming.unmount()

    const idle = renderButtons({ userScrolledUp: true, isStreaming: false })
    expect(idle.container.querySelector('[data-testid="message-list-jump-latest-dot"]')).toBeNull()
  })

  it('整列定位仍锚在消息区右下角(bottom-4 right-4 z-20),不随归一改变', () => {
    const { container } = renderButtons({ userScrolledUp: true })
    const rail = container.querySelector('[data-testid="scroll-jump-buttons"]')
    expect(rail).not.toBeNull()
    const cls = (rail as HTMLElement).className
    for (const token of ['absolute', 'bottom-4', 'right-4', 'z-20', 'flex-col']) {
      expect(cls, `缺少 ${token}`).toContain(token)
    }
    expect(cls).not.toContain('left-1/2')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
