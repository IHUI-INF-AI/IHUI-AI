// @vitest-environment happy-dom
/**
 * CompressionDivider 单元测试(2026-07-28 立,块 3.4)
 *
 * 覆盖:
 * - count=0:不渲染任何 DOM
 * - count>0 + 默认 expandable:渲染 button + 点击触发 onExpand
 * - count>0 + expandable=false:渲染 div (role=separator) 不可点击
 * - count>0 + onExpand 缺失 + expandable=true:降级为 div(安全 fallback)
 * - 默认 label:`${count} 条已折叠`
 * - 自定义 label:覆盖默认
 * - aria-label:含 label
 * - ▼ 三角箭头 + group hover 动画
 * - 左右两边的 1px 横线(背景色 bg-border/50)
 * - className 透传
 * - data-testid 自定义
 * - 多次点击触发多次回调
 * - hover 颜色变化样式
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CompressionDivider } from '../src/components/ai/progress-sections/compression-divider'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ─── count=0 边界 ─────────────────────────────────────────
describe('CompressionDivider — count=0 边界', () => {
  it('count=0:不渲染任何 DOM', () => {
    const { container } = render(<CompressionDivider count={0} onExpand={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('count=-5(负数):视为无效,不渲染', () => {
    const { container } = render(<CompressionDivider count={-5} onExpand={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })
})

// ─── 默认 expandable=true 行为 ──────────────────────────
describe('CompressionDivider — 默认 expandable=true 行为', () => {
  it('count>0:渲染 button 元素(可点击)', () => {
    const { container } = render(<CompressionDivider count={3} onExpand={vi.fn()} />)
    const btn = container.querySelector('button')
    expect(btn).toBeTruthy()
    expect(btn?.getAttribute('data-testid')).toBe('compression-divider')
  })

  it('点击 button 触发 onExpand 回调', () => {
    const onExpand = vi.fn()
    render(<CompressionDivider count={3} onExpand={onExpand} />)
    fireEvent.click(screen.getByTestId('compression-divider'))
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it('多次点击触发多次 onExpand 回调', () => {
    const onExpand = vi.fn()
    render(<CompressionDivider count={3} onExpand={onExpand} />)
    const btn = screen.getByTestId('compression-divider')
    fireEvent.click(btn)
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(onExpand).toHaveBeenCalledTimes(3)
  })

  it('默认 label:"${count} 条已折叠" 格式', () => {
    const { container } = render(<CompressionDivider count={5} onExpand={vi.fn()} />)
    expect(container.textContent).toContain('5 条已折叠')
  })

  it('count=1:显示"1 条已折叠"', () => {
    const { container } = render(<CompressionDivider count={1} onExpand={vi.fn()} />)
    expect(container.textContent).toContain('1 条已折叠')
  })

  it('count=100:显示"100 条已折叠"', () => {
    const { container } = render(<CompressionDivider count={100} onExpand={vi.fn()} />)
    expect(container.textContent).toContain('100 条已折叠')
  })

  it('自定义 label 覆盖默认', () => {
    const { container } = render(
      <CompressionDivider count={3} onExpand={vi.fn()} label="已折叠 3 条早期消息" />,
    )
    expect(container.textContent).toContain('已折叠 3 条早期消息')
    expect(container.textContent).not.toContain('3 条已折叠')
  })

  it('aria-label 含 label + ",点击展开" 提示', () => {
    render(<CompressionDivider count={3} onExpand={vi.fn()} label="3 条历史消息" />)
    const btn = screen.getByTestId('compression-divider') as HTMLElement
    expect(btn.getAttribute('aria-label')).toBe('3 条历史消息,点击展开')
  })
})

// ─── expandable=false ─────────────────────────────────────
describe('CompressionDivider — expandable=false 静态态', () => {
  it('expandable=false:渲染 div 而非 button(role=separator)', () => {
    const { container } = render(<CompressionDivider count={3} expandable={false} />)
    const div = container.querySelector('[data-testid="compression-divider"]') as HTMLElement
    expect(div).toBeTruthy()
    expect(div.tagName.toLowerCase()).toBe('div')
    expect(div.getAttribute('role')).toBe('separator')
  })

  it('expandable=false:无 button 子元素(不可点击)', () => {
    const { container } = render(<CompressionDivider count={3} expandable={false} />)
    expect(container.querySelector('button')).toBeFalsy()
  })

  it('expandable=false:显示 label', () => {
    const { container } = render(<CompressionDivider count={5} expandable={false} />)
    expect(container.textContent).toContain('5 条已折叠')
  })

  it('expandable=false:aria-label 含 label(无 "点击展开" 后缀)', () => {
    render(<CompressionDivider count={3} expandable={false} label="3 条已折叠" />)
    const div = screen.getByTestId('compression-divider') as HTMLElement
    expect(div.getAttribute('aria-label')).toBe('3 条已折叠')
    expect(div.getAttribute('aria-label')).not.toContain('点击展开')
  })
})

// ─── onExpand 缺失 + expandable=true 的降级 ──────────────
describe('CompressionDivider — onExpand 缺失的降级行为', () => {
  it('onExpand=undefined + expandable=true:降级为 div(安全 fallback)', () => {
    const { container } = render(<CompressionDivider count={3} />)
    const el = container.querySelector('[data-testid="compression-divider"]') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.tagName.toLowerCase()).toBe('div')
    expect(el.getAttribute('role')).toBe('separator')
    // 无 button
    expect(container.querySelector('button')).toBeFalsy()
  })

  it('onExpand=undefined + expandable=true:aria-label 仅为 label(无 "点击展开" 后缀)', () => {
    render(<CompressionDivider count={3} />)
    const el = screen.getByTestId('compression-divider') as HTMLElement
    expect(el.getAttribute('aria-label')).toBe('3 条已折叠')
  })
})

// ─── 视觉细节 ───────────────────────────────────────────
describe('CompressionDivider — 视觉细节', () => {
  it('默认 expandable 模式:渲染 ▼ 三角箭头', () => {
    const { container } = render(<CompressionDivider count={3} onExpand={vi.fn()} />)
    expect(container.textContent).toContain('▼')
  })

  it('默认 expandable 模式:左右两侧 1px 横线(bg-border/50)', () => {
    const { container } = render(<CompressionDivider count={3} onExpand={vi.fn()} />)
    const lines = container.querySelectorAll('.h-px.flex-1.bg-border\\/50')
    expect(lines.length).toBe(2) // 左 + 右
  })

  it('默认 expandable 模式:button 含 group className(支持 group-hover)', () => {
    const { container } = render(<CompressionDivider count={3} onExpand={vi.fn()} />)
    const btn = container.querySelector('button')
    expect(btn?.className).toContain('group')
  })

  it('默认 expandable 模式:hover 时颜色变化样式(hover:text-foreground)', () => {
    const { container } = render(<CompressionDivider count={3} onExpand={vi.fn()} />)
    const btn = container.querySelector('button') as HTMLElement
    expect(btn.className).toContain('hover:text-foreground')
  })

  it('默认 expandable 模式:三角箭头含 group-hover 动画', () => {
    const { container } = render(<CompressionDivider count={3} onExpand={vi.fn()} />)
    // 找含 group-hover:translate-y-0.5 的 span
    const arrow = container.querySelector('[class*="group-hover:translate-y-0.5"]')
    expect(arrow).toBeTruthy()
  })

  it('静态 div 模式:无 ▼ 三角箭头(仅纯文本 + 横线)', () => {
    const { container } = render(<CompressionDivider count={3} expandable={false} />)
    expect(container.textContent).not.toContain('▼')
  })
})

// ─── className + data-testid 透传 ───────────────────────
describe('CompressionDivider — className + data-testid 透传', () => {
  it('className 透传到默认(button)模式', () => {
    const { container } = render(
      <CompressionDivider count={3} onExpand={vi.fn()} className="my-cls" />,
    )
    const btn = container.querySelector('button') as HTMLElement
    expect(btn.className).toContain('my-cls')
  })

  it('className 透传到 expandable=false(div)模式', () => {
    const { container } = render(
      <CompressionDivider count={3} expandable={false} className="static-cls" />,
    )
    const div = container.querySelector('[data-testid="compression-divider"]') as HTMLElement
    expect(div.className).toContain('static-cls')
  })

  it('data-testid 覆盖默认', () => {
    const { container } = render(
      <CompressionDivider count={3} onExpand={vi.fn()} data-testid="custom-divider" />,
    )
    expect(container.querySelector('[data-testid="custom-divider"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="compression-divider"]')).toBeFalsy()
  })
})

// ─── 集成场景 ─────────────────────────────────────────
describe('CompressionDivider — 集成场景', () => {
  it('滚动到底部:点击 divider 展开历史消息后,onExpand 触发,组件继续渲染', () => {
    const onExpand = vi.fn()
    const { container, rerender } = render(<CompressionDivider count={5} onExpand={onExpand} />)
    expect(container.querySelector('[data-testid="compression-divider"]')).toBeTruthy()
    fireEvent.click(screen.getByTestId('compression-divider'))
    expect(onExpand).toHaveBeenCalled()
    // 模拟父组件收到 onExpand 后,count 减少或重渲染
    rerender(<CompressionDivider count={2} onExpand={onExpand} />)
    expect(container.textContent).toContain('2 条已折叠')
  })

  it('边界 count=1:仍可点击触发 onExpand', () => {
    const onExpand = vi.fn()
    render(<CompressionDivider count={1} onExpand={onExpand} />)
    fireEvent.click(screen.getByTestId('compression-divider'))
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it('大 count=9999:label 正确显示', () => {
    const { container } = render(<CompressionDivider count={9999} onExpand={vi.fn()} />)
    expect(container.textContent).toContain('9999 条已折叠')
  })

  it('button type="button"(防止表单内误提交)', () => {
    render(
      <form>
        <CompressionDivider count={3} onExpand={vi.fn()} />
      </form>,
    )
    const btn = screen.getByTestId('compression-divider') as HTMLButtonElement
    expect(btn.type).toBe('button')
  })
})
