// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

import { computeOverflowEdges, overflowEdgeState, OverflowShadow } from '../overflow-shadow'

/**
 * G-827 —— 横向溢出的方向阴影线索。
 *
 * 两层判据:
 * ① 纯函数四态(none/left/right/both):把"什么算溢出、什么时候出哪一侧"钉死,
 *    不依赖真实布局(与上游 markdown-table.tsx:705-733 同判据);
 * ② 组件行为:未溢出时**一条阴影都不渲染**、横向可滚时渲染右向线索、
 *    滚到最右后右向消失而左向出现 —— 票面验收原文的两条。
 *
 * jsdom 不做布局 ⇒ scrollWidth/clientWidth 恒 0,必须显式注入尺寸(本仓
 * context-source-jump.test.tsx 对 scrollIntoView 用同一手法)。
 */

const setMetrics = (
  el: HTMLElement,
  m: { scrollLeft?: number; scrollWidth: number; clientWidth: number },
) => {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: m.scrollWidth })
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: m.clientWidth })
  if (m.scrollLeft !== undefined) {
    Object.defineProperty(el, 'scrollLeft', {
      configurable: true,
      writable: true,
      value: m.scrollLeft,
    })
  }
}

/** render + 注入尺寸 + 触发一次 scroll 同步(jsdom 无布局,尺寸必须显式给)。 */
const renderWithMetrics = (m: {
  scrollLeft?: number
  scrollWidth: number
  clientWidth: number
}) => {
  const view = render(
    <OverflowShadow>
      <span data-testid="inner">内容</span>
    </OverflowShadow>,
  )
  const scroller = view.container.querySelector('.overflow-x-auto') as HTMLElement
  setMetrics(scroller, m)
  act(() => {
    scroller.dispatchEvent(new Event('scroll'))
  })
  return view
}

afterEach(() => {
  cleanup()
})

describe('computeOverflowEdges(判据表,对齐上游四态)', () => {
  it('未溢出(内容不宽于视口)⇒ 两侧都不亮', () => {
    expect(computeOverflowEdges({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 })).toEqual({
      left: false,
      right: false,
    })
    // 亚像素差(≤1px)不算可滚,防缩放/舍入制造假提示
    expect(computeOverflowEdges({ scrollLeft: 0, scrollWidth: 300.6, clientWidth: 300 })).toEqual({
      left: false,
      right: false,
    })
  })

  it('溢出且在最左 ⇒ 只有右向', () => {
    expect(computeOverflowEdges({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 })).toEqual({
      left: false,
      right: true,
    })
    expect(overflowEdgeState({ left: false, right: true })).toBe('right')
  })

  it('溢出且在最右 ⇒ 只有左向', () => {
    expect(computeOverflowEdges({ scrollLeft: 300, scrollWidth: 600, clientWidth: 300 })).toEqual({
      left: true,
      right: false,
    })
    expect(overflowEdgeState({ left: true, right: false })).toBe('left')
  })

  it('溢出且在中间 ⇒ 两向都有', () => {
    expect(computeOverflowEdges({ scrollLeft: 150, scrollWidth: 600, clientWidth: 300 })).toEqual({
      left: true,
      right: true,
    })
    expect(overflowEdgeState({ left: true, right: true })).toBe('both')
  })

  it('边界容差:滚到 1px 内视为到边,不亮对应侧', () => {
    // 距最右 1px ⇒ 右向不亮(阈值 EDGE_EPSILON)
    expect(
      computeOverflowEdges({ scrollLeft: 299, scrollWidth: 600, clientWidth: 300 }).right,
    ).toBe(false)
    // 滚过 1px ⇒ 左向亮
    expect(computeOverflowEdges({ scrollLeft: 2, scrollWidth: 600, clientWidth: 300 }).left).toBe(
      true,
    )
  })
})

describe('OverflowShadow 组件行为(票面验收两条)', () => {
  it('未溢出时无阴影节点(容器仍渲染 children)', () => {
    const { container } = renderWithMetrics({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 })

    expect(screen.getByTestId('inner')).toBeTruthy()
    expect(screen.queryByTestId('overflow-shadow-left')).toBeNull()
    expect(screen.queryByTestId('overflow-shadow-right')).toBeNull()
    expect(container.firstElementChild?.getAttribute('data-overflow-shadow')).toBe('none')
  })

  it('横向可滚时出现右向线索,且阴影层不吞事件/不进无障碍树', () => {
    const { container } = renderWithMetrics({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 })

    const right = screen.getByTestId('overflow-shadow-right')
    expect(right).toBeTruthy()
    // 禁 mask/渐变(AGENTS §4):线索是 inset 实体阴影
    expect(right.className).toContain('pointer-events-none')
    expect(right.getAttribute('aria-hidden')).toBe('true')
    expect(right.getAttribute('style') ?? '').toContain('inset')
    expect(right.getAttribute('style') ?? '').not.toContain('linear-gradient')
    expect(right.getAttribute('style') ?? '').not.toContain('mask')
    // 最左 ⇒ 左向不渲染
    expect(screen.queryByTestId('overflow-shadow-left')).toBeNull()
    expect(container.firstElementChild?.getAttribute('data-overflow-shadow')).toBe('right')
  })

  it('滚到最右后右向消失、左向出现(真实 scrollLeft 驱动,验 scroll 监听同步)', () => {
    const { container } = renderWithMetrics({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 })
    expect(screen.getByTestId('overflow-shadow-right')).toBeTruthy()

    const scroller = container.querySelector('.overflow-x-auto') as HTMLElement
    // 模拟用户把内容拖到最右:改 scrollLeft 后派发 scroll,组件须同步四态
    setMetrics(scroller, { scrollLeft: 300, scrollWidth: 600, clientWidth: 300 })
    act(() => {
      scroller.dispatchEvent(new Event('scroll'))
    })

    expect(screen.queryByTestId('overflow-shadow-right')).toBeNull()
    expect(screen.getByTestId('overflow-shadow-left')).toBeTruthy()
    expect(container.firstElementChild?.getAttribute('data-overflow-shadow')).toBe('left')
  })

  it('滚到中间 ⇒ 两向线索同时存在(四态 both)', () => {
    renderWithMetrics({ scrollLeft: 150, scrollWidth: 600, clientWidth: 300 })

    expect(screen.getByTestId('overflow-shadow-left')).toBeTruthy()
    expect(screen.getByTestId('overflow-shadow-right')).toBeTruthy()
  })
})
