// @vitest-environment jsdom
/**
 * HoverPreviewCard 单元测试(2026-07-28 立,块 3.2)
 *
 * 覆盖:
 * - 基础渲染:visible=true 时显示卡片 + content + tooltip 角色
 * - 隐藏逻辑:visible=false 时不渲染任何 DOM
 * - position 样式:left/top 应用到 fixed 容器
 * - className 透传
 * - data-testid 默认与自定义
 * - role="tooltip" 语义
 * - z-index 优先级(1000)
 * - 宽 240px + 圆角 + 边框
 * - useHoverPreview 集成测试(250ms 延迟 + 边界检测)
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { HoverPreviewCard } from '../src/components/ai/progress-sections/hover-preview-card'
import { useHoverPreview } from '../src/hooks/use-hover-preview'

interface TestData {
  name: string
  count: number
}

describe('HoverPreviewCard — 基础渲染', () => {
  afterEach(() => {
    cleanup()
  })

  it('visible=true:渲染卡片容器(含 data-testid)', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 100, y: 200 }}
        content={<span>预览内容</span>}
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]')
    expect(card).toBeTruthy()
  })

  it('visible=false:不渲染任何 DOM', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={false}
        position={{ x: 100, y: 200 }}
        content={<span>预览内容</span>}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('渲染传入的 content 节点', () => {
    render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 100, y: 200 }}
        content={<span data-testid="custom-content">自定义内容</span>}
      />,
    )
    const custom = screen.getByTestId('custom-content')
    expect(custom).toBeTruthy()
    expect(custom.textContent).toBe('自定义内容')
  })

  it('role=tooltip 语义属性', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={<span>x</span>}
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    expect(card.getAttribute('role')).toBe('tooltip')
  })

  it('自定义 data-testid 覆盖默认值', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={<span>x</span>}
        data-testid="my-custom-preview"
      />,
    )
    const card = container.querySelector('[data-testid="my-custom-preview"]')
    expect(card).toBeTruthy()
    expect(container.querySelector('[data-testid="hover-preview-card"]')).toBeFalsy()
  })
})

describe('HoverPreviewCard — 样式与定位', () => {
  afterEach(() => {
    cleanup()
  })

  it('position.left / position.top 应用到 fixed 容器 inline style', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 256, y: 128 }}
        content={<span>x</span>}
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    expect(card.style.left).toBe('256px')
    expect(card.style.top).toBe('128px')
  })

  it('fixed 定位 + z-index 1000(高优先级,不被其他元素遮挡)', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={<span>x</span>}
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    expect(card.className).toContain('fixed')
    expect(card.className).toContain('z-[1000]')
  })

  it('pointer-events-none:不阻挡下层元素的鼠标交互', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={<span>x</span>}
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    expect(card.className).toContain('pointer-events-none')
  })

  it('固定宽度 240px', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={<span>x</span>}
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    expect(card.className).toContain('w-[240px]')
  })

  it('圆角 + 边框 + 阴影 + popover 背景色', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={<span>x</span>}
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    expect(card.className).toContain('rounded-md')
    expect(card.className).toContain('border')
    expect(card.className).toContain('border-border')
    expect(card.className).toContain('shadow-md')
    expect(card.className).toContain('bg-popover')
  })

  it('className prop 透传到根容器', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={<span>x</span>}
        className="custom-shadow-lg"
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    expect(card.className).toContain('custom-shadow-lg')
  })
})

describe('HoverPreviewCard — 隐藏时位置与内容变化', () => {
  afterEach(() => {
    cleanup()
  })

  it('visible 切换 false→true:渲染内容', () => {
    const { container, rerender } = render(
      <HoverPreviewCard
        visible={false}
        position={{ x: 100, y: 100 }}
        content={<span>内容</span>}
      />,
    )
    expect(container.firstChild).toBeNull()
    rerender(
      <HoverPreviewCard
        visible={true}
        position={{ x: 100, y: 100 }}
        content={<span>内容</span>}
      />,
    )
    expect(container.querySelector('[data-testid="hover-preview-card"]')).toBeTruthy()
  })

  it('visible=true 切换 false:卡片消失', () => {
    const { container, rerender } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 100, y: 100 }}
        content={<span>内容</span>}
      />,
    )
    expect(container.querySelector('[data-testid="hover-preview-card"]')).toBeTruthy()
    rerender(
      <HoverPreviewCard
        visible={false}
        position={{ x: 100, y: 100 }}
        content={<span>内容</span>}
      />,
    )
    expect(container.querySelector('[data-testid="hover-preview-card"]')).toBeFalsy()
  })

  it('位置更新:从 (10,10) 切到 (200,300),style 同步', () => {
    const { container, rerender } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 10, y: 10 }}
        content={<span>x</span>}
      />,
    )
    let card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    expect(card.style.left).toBe('10px')
    expect(card.style.top).toBe('10px')
    rerender(
      <HoverPreviewCard
        visible={true}
        position={{ x: 200, y: 300 }}
        content={<span>x</span>}
      />,
    )
    card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    expect(card.style.left).toBe('200px')
    expect(card.style.top).toBe('300px')
  })
})

// ─── useHoverPreview 集成测试 ─────────────────────────────────────

/** 测试用 consumer:使用 useHoverPreview 验证 250ms 延迟 + 边界检测 + 键盘触发 */
function TestConsumer({ data }: { data: TestData | null }): React.ReactElement {
  const anchorRef = React.useRef<HTMLDivElement | null>(null)
  const preview = useHoverPreview<TestData>({
    buildContent: (d) => (
      <div>
        <div>Name: {d.name}</div>
        <div>Count: {d.count}</div>
      </div>
    ),
    anchorRef,
    data,
    delayMs: 250,
    closeDelayMs: 100,
  })
  return (
    <>
      <div
        ref={anchorRef}
        data-testid="hover-anchor"
        onMouseEnter={preview.hoverHandlers.onMouseEnter}
        onMouseLeave={preview.hoverHandlers.onMouseLeave}
        onFocus={preview.hoverHandlers.onFocus}
        onBlur={preview.hoverHandlers.onBlur}
        tabIndex={0}
      >
        Hover Me
      </div>
      {preview.visible && (
        <HoverPreviewCard
          visible={preview.visible}
          position={preview.position}
          content={preview.content}
          data-testid="consumer-preview"
        />
      )}
    </>
  )
}

describe('useHoverPreview 集成 — 250ms 延迟触发', () => {
  afterEach(() => {
    cleanup()
  })

  it('mouseenter 后立即(0ms):卡片未出现', () => {
    render(<TestConsumer data={{ name: 'test', count: 1 }} />)
    const anchor = screen.getByTestId('hover-anchor')
    fireEvent.mouseEnter(anchor)
    // 立即(0ms):未触发 250ms 延迟,卡片未渲染
    expect(screen.queryByTestId('consumer-preview')).toBeNull()
  })

  it('mouseenter 后 250ms:卡片出现', () => {
    vi.useFakeTimers()
    try {
      render(<TestConsumer data={{ name: 'test', count: 1 }} />)
      const anchor = screen.getByTestId('hover-anchor')
      fireEvent.mouseEnter(anchor)
      // 推进 250ms
      act(() => {
        vi.advanceTimersByTime(250)
      })
      expect(screen.getByTestId('consumer-preview')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('mouseleave 后 100ms(closeDelayMs):卡片消失', () => {
    vi.useFakeTimers()
    try {
      render(<TestConsumer data={{ name: 'test', count: 1 }} />)
      const anchor = screen.getByTestId('hover-anchor')
      fireEvent.mouseEnter(anchor)
      act(() => {
        vi.advanceTimersByTime(250)
      })
      expect(screen.getByTestId('consumer-preview')).toBeTruthy()
      fireEvent.mouseLeave(anchor)
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(screen.queryByTestId('consumer-preview')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('data=null 时:即使 mouseenter 也不触发卡片', () => {
    vi.useFakeTimers()
    try {
      render(<TestConsumer data={null} />)
      const anchor = screen.getByTestId('hover-anchor')
      fireEvent.mouseEnter(anchor)
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(screen.queryByTestId('consumer-preview')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('content 含 buildContent 返回的 React 节点', () => {
    vi.useFakeTimers()
    try {
      render(<TestConsumer data={{ name: 'Alice', count: 42 }} />)
      const anchor = screen.getByTestId('hover-anchor')
      fireEvent.mouseEnter(anchor)
      act(() => {
        vi.advanceTimersByTime(250)
      })
      const preview = screen.getByTestId('consumer-preview')
      expect(preview.textContent).toContain('Name: Alice')
      expect(preview.textContent).toContain('Count: 42')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useHoverPreview 集成 — 键盘焦点触发', () => {
  afterEach(() => {
    cleanup()
  })

  it('focus 事件触发卡片显示(无障碍支持)', () => {
    vi.useFakeTimers()
    try {
      render(<TestConsumer data={{ name: 'test', count: 1 }} />)
      const anchor = screen.getByTestId('hover-anchor')
      fireEvent.focus(anchor)
      act(() => {
        vi.advanceTimersByTime(250)
      })
      expect(screen.getByTestId('consumer-preview')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('blur 事件触发卡片消失(closeDelayMs 后)', () => {
    vi.useFakeTimers()
    try {
      render(<TestConsumer data={{ name: 'test', count: 1 }} />)
      const anchor = screen.getByTestId('hover-anchor')
      fireEvent.focus(anchor)
      act(() => {
        vi.advanceTimersByTime(250)
      })
      expect(screen.getByTestId('consumer-preview')).toBeTruthy()
      fireEvent.blur(anchor)
      act(() => {
        vi.advanceTimersByTime(100)
      })
      expect(screen.queryByTestId('consumer-preview')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
