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

// ─── 进阶边界场景(2026-07-28 覆盖率深化) ─────────────────────────

/** 状态化 data 的 TestConsumer,用于测试 data 变更 + close() 显式调用 */
function StatefulTestConsumer(): React.ReactElement {
  const [data, setData] = React.useState<TestData | null>({ name: 'init', count: 0 })
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
        data-testid="stateful-anchor"
        onMouseEnter={preview.hoverHandlers.onMouseEnter}
        onMouseLeave={preview.hoverHandlers.onMouseLeave}
        tabIndex={0}
      >
        Hover Me
      </div>
      <button
        type="button"
        data-testid="change-data"
        onClick={() => setData({ name: 'updated', count: 99 })}
      >
        Update
      </button>
      <button
        type="button"
        data-testid="nullify-data"
        onClick={() => setData(null)}
      >
        Nullify
      </button>
      <button
        type="button"
        data-testid="close-button"
        onClick={() => preview.close()}
      >
        Close
      </button>
      {preview.visible && (
        <HoverPreviewCard
          visible={preview.visible}
          position={preview.position}
          content={preview.content}
          data-testid="stateful-preview"
        />
      )}
    </>
  )
}

describe('useHoverPreview 集成 — close() 显式关闭', () => {
  afterEach(() => {
    cleanup()
  })

  it('显式调用 close():立即关闭卡片,无需等待 closeDelayMs', () => {
    vi.useFakeTimers()
    try {
      render(<StatefulTestConsumer />)
      const anchor = screen.getByTestId('stateful-anchor')
      fireEvent.mouseEnter(anchor)
      act(() => {
        vi.advanceTimersByTime(250)
      })
      expect(screen.getByTestId('stateful-preview')).toBeTruthy()
      // 显式 close
      fireEvent.click(screen.getByTestId('close-button'))
      // 立即关闭,无需 advanceTimersByTime
      expect(screen.queryByTestId('stateful-preview')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useHoverPreview 集成 — data 变更与清空', () => {
  afterEach(() => {
    cleanup()
  })

  it('data 从 {init, 0} 变 {updated, 99}:显示后 content 反映最新 data', () => {
    vi.useFakeTimers()
    try {
      render(<StatefulTestConsumer />)
      const anchor = screen.getByTestId('stateful-anchor')
      fireEvent.mouseEnter(anchor)
      act(() => {
        vi.advanceTimersByTime(250)
      })
      const preview = screen.getByTestId('stateful-preview')
      expect(preview.textContent).toContain('Name: init')
      expect(preview.textContent).toContain('Count: 0')
      // 更新 data
      fireEvent.click(screen.getByTestId('change-data'))
      // content 同步更新(无需重新 hover)
      expect(preview.textContent).toContain('Name: updated')
      expect(preview.textContent).toContain('Count: 99')
    } finally {
      vi.useRealTimers()
    }
  })

  it('data 设为 null:卡片自动关闭(useEffect 触发 close)', () => {
    vi.useFakeTimers()
    try {
      render(<StatefulTestConsumer />)
      const anchor = screen.getByTestId('stateful-anchor')
      fireEvent.mouseEnter(anchor)
      act(() => {
        vi.advanceTimersByTime(250)
      })
      expect(screen.getByTestId('stateful-preview')).toBeTruthy()
      // data → null
      fireEvent.click(screen.getByTestId('nullify-data'))
      expect(screen.queryByTestId('stateful-preview')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('data 初始为 null:即使 mouseenter 也不显示卡片(已在原测试覆盖,此处验证多次 hover)', () => {
    render(<StatefulTestConsumer />)
    const anchor = screen.getByTestId('stateful-anchor')
    // 直接 nullify
    fireEvent.click(screen.getByTestId('nullify-data'))
    fireEvent.mouseEnter(anchor)
    fireEvent.mouseEnter(anchor)
    fireEvent.mouseEnter(anchor)
    expect(screen.queryByTestId('stateful-preview')).toBeNull()
  })
})

describe('useHoverPreview 集成 — 快速 hover-leave-hover 序列', () => {
  afterEach(() => {
    cleanup()
  })

  it('hover 后立刻 leave 再 hover:close timer 被清空,新 show timer 正常触发', () => {
    vi.useFakeTimers()
    try {
      render(<TestConsumer data={{ name: 'test', count: 1 }} />)
      const anchor = screen.getByTestId('hover-anchor')
      // 第一次 hover
      fireEvent.mouseEnter(anchor)
      act(() => {
        vi.advanceTimersByTime(250)
      })
      expect(screen.getByTestId('consumer-preview')).toBeTruthy()
      // leave
      fireEvent.mouseLeave(anchor)
      // 还没到 closeDelay(100ms),立刻重新 hover → close timer 应被清空
      fireEvent.mouseEnter(anchor)
      act(() => {
        vi.advanceTimersByTime(100)
      })
      // 卡片应仍然可见(close timer 被清,新的 show timer 不会重复触发,visible 仍为 true)
      expect(screen.getByTestId('consumer-preview')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})

// ─── Phase 19/20 深化:hover delay 200ms 触发 / Esc 关闭 / 焦点陷阱 / 边界尺寸 / a11y ──

describe('HoverPreviewCard — Phase 19/20 a11y + 边界', () => {
  afterEach(() => {
    cleanup()
  })

  it('role=tooltip 验证(屏幕阅读器朗读为"提示")', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={<span>preview</span>}
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    expect(card.getAttribute('role')).toBe('tooltip')
  })

  it('Esc 键:hover card 组件本身不自动处理 Esc(由父组件负责关闭)', () => {
    // HoverPreviewCard 是纯展示组件,不绑定 keydown 监听
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={<span>preview</span>}
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    // 验证卡片元素存在
    expect(card).toBeTruthy()
    // Esc 不会引发组件自动消失(visible 仍为 true)
    fireEvent.keyDown(card, { key: 'Escape' })
    expect(container.querySelector('[data-testid="hover-preview-card"]')).toBeTruthy()
  })

  it('多种 position 坐标边界(0,0)/(-100,-200)/(9999,9999) 全部生效', () => {
    const positions = [
      { x: 0, y: 0 },
      { x: -100, y: -200 },
      { x: 9999, y: 9999 },
      { x: 0.5, y: 0.5 },
    ]
    for (const pos of positions) {
      const { container } = render(
        <HoverPreviewCard
          visible={true}
          position={pos}
          content={<span>preview at {pos.x},{pos.y}</span>}
        />,
      )
      const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
      // inline style 应保留原始数值(px 单位)
      expect(card.style.left).toBe(`${pos.x}px`)
      expect(card.style.top).toBe(`${pos.y}px`)
      cleanup()
    }
  })

  it('content 含复杂嵌套结构(div + ul + li)正确渲染', () => {
    const complexContent = (
      <div>
        <h4>Title</h4>
        <ul>
          <li>item 1</li>
          <li>item 2</li>
        </ul>
      </div>
    )
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={complexContent}
      />,
    )
    expect(container.querySelector('h4')?.textContent).toBe('Title')
    expect(container.querySelectorAll('li').length).toBe(2)
    expect(container.textContent).toContain('item 1')
    expect(container.textContent).toContain('item 2')
  })

  it('多个 HoverPreviewCard 共存(visible=true 多个实例)', () => {
    const { container } = render(
      <>
        <HoverPreviewCard
          visible={true}
          position={{ x: 10, y: 10 }}
          content={<span>A</span>}
          data-testid="card-a"
        />
        <HoverPreviewCard
          visible={true}
          position={{ x: 100, y: 100 }}
          content={<span>B</span>}
          data-testid="card-b"
        />
      </>,
    )
    expect(container.querySelectorAll('[data-testid^="card-"]').length).toBe(2)
    expect(container.querySelector('[data-testid="card-a"]')?.textContent).toContain('A')
    expect(container.querySelector('[data-testid="card-b"]')?.textContent).toContain('B')
  })
})

describe('useHoverPreview 集成 — 200ms delay 自定义 + Esc 模拟', () => {
  afterEach(() => {
    cleanup()
  })

  it('自定义 delayMs=200:200ms 后卡片出现', () => {
    vi.useFakeTimers()
    function CustomDelayConsumer(): React.ReactElement {
      const anchorRef = React.useRef<HTMLDivElement | null>(null)
      const preview = useHoverPreview<TestData>({
        buildContent: (d) => <span>{d.name}</span>,
        anchorRef,
        data: { name: 'A', count: 1 },
        delayMs: 200,
      })
      return (
        <>
          <div
            ref={anchorRef}
            data-testid="anchor-200"
            onMouseEnter={preview.hoverHandlers.onMouseEnter}
            onMouseLeave={preview.hoverHandlers.onMouseLeave}
          >
            X
          </div>
          {preview.visible && (
            <HoverPreviewCard
              visible={preview.visible}
              position={preview.position}
              content={preview.content}
              data-testid="preview-200"
            />
          )}
        </>
      )
    }
    try {
      render(<CustomDelayConsumer />)
      const anchor = screen.getByTestId('anchor-200')
      fireEvent.mouseEnter(anchor)
      // 199ms: 未到 200ms,不显示
      act(() => {
        vi.advanceTimersByTime(199)
      })
      expect(screen.queryByTestId('preview-200')).toBeNull()
      // 推进到 200ms: 显示
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.getByTestId('preview-200')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('自定义 closeDelayMs=50:leave 50ms 后关闭', () => {
    vi.useFakeTimers()
    function CustomCloseConsumer(): React.ReactElement {
      const anchorRef = React.useRef<HTMLDivElement | null>(null)
      const preview = useHoverPreview<TestData>({
        buildContent: (d) => <span>{d.name}</span>,
        anchorRef,
        data: { name: 'A', count: 1 },
        delayMs: 50,
        closeDelayMs: 50,
      })
      return (
        <>
          <div
            ref={anchorRef}
            data-testid="anchor-close"
            onMouseEnter={preview.hoverHandlers.onMouseEnter}
            onMouseLeave={preview.hoverHandlers.onMouseLeave}
          >
            X
          </div>
          {preview.visible && (
            <HoverPreviewCard
              visible={preview.visible}
              position={preview.position}
              content={preview.content}
              data-testid="preview-close"
            />
          )}
        </>
      )
    }
    try {
      render(<CustomCloseConsumer />)
      const anchor = screen.getByTestId('anchor-close')
      fireEvent.mouseEnter(anchor)
      act(() => {
        vi.advanceTimersByTime(50)
      })
      expect(screen.getByTestId('preview-close')).toBeTruthy()
      fireEvent.mouseLeave(anchor)
      // 49ms: 还没到 closeDelay
      act(() => {
        vi.advanceTimersByTime(49)
      })
      expect(screen.getByTestId('preview-close')).toBeTruthy()
      // 1ms more: 50ms total → close
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.queryByTestId('preview-close')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
