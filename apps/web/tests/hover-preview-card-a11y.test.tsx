// @vitest-environment jsdom
/**
 * HoverPreviewCard a11y 单元测试(Phase 22,2026-07-29 立)
 *
 * 覆盖:
 * - Esc 关闭(6 test):visible/false、preventDefault、stopPropagation、状态切换、防抖
 * - 焦点陷阱(6 test):Tab 循环、Shift+Tab 反向、无可聚焦元素、visible=false、role/aria
 * - 综合(6 test):Esc 后焦点回 body、自动聚焦、3+ 元素循环、tabIndex、aria-modal、tooltip 模式
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { HoverPreviewCard } from '../src/components/ai/progress-sections/hover-preview-card'

describe('HoverPreviewCard a11y — Esc 关闭', () => {
  afterEach(() => {
    cleanup()
  })

  // 1. visible=true + Esc → 调用 onClose
  it('visible=true + Esc → 调用 onClose 一次', () => {
    const onClose = vi.fn()
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={<span>preview</span>}
        role="dialog"
        onClose={onClose}
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    fireEvent.keyDown(card, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // 2. visible=false + Esc → 不调用 onClose
  it('visible=false + Esc → 不调用 onClose', () => {
    const onClose = vi.fn()
    render(
      <HoverPreviewCard
        visible={false}
        position={{ x: 0, y: 0 }}
        content={<span>preview</span>}
        role="dialog"
        onClose={onClose}
      />,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  // 3. Esc 事件 preventDefault 被调用
  it('Esc 事件 preventDefault 被调用', () => {
    const onClose = vi.fn()
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={<span>preview</span>}
        role="dialog"
        onClose={onClose}
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    card.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  // 4. Esc 事件 stopPropagation 被调用
  it('Esc 事件 stopPropagation 被调用', () => {
    const onClose = vi.fn()
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={<span>preview</span>}
        role="dialog"
        onClose={onClose}
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    const spy = vi.spyOn(event, 'stopPropagation')
    card.dispatchEvent(event)
    expect(spy).toHaveBeenCalled()
  })

  // 5. Esc 后 visible 变为 false(卡片从 DOM 消失)
  it('Esc 后 visible 变为 false(卡片从 DOM 消失)', () => {
    function Wrapper(): React.ReactElement {
      const [visible, setVisible] = React.useState(true)
      return (
        <HoverPreviewCard
          visible={visible}
          position={{ x: 0, y: 0 }}
          content={<span>preview</span>}
          role="dialog"
          onClose={() => setVisible(false)}
        />
      )
    }
    const { container } = render(<Wrapper />)
    expect(container.querySelector('[data-testid="hover-preview-card"]')).toBeTruthy()
    fireEvent.keyDown(
      container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement,
      { key: 'Escape' },
    )
    expect(container.querySelector('[data-testid="hover-preview-card"]')).toBeNull()
  })

  // 6. 多次按 Esc 只触发一次 onClose(关闭后 listener 清理)
  it('多次按 Esc 只触发一次 onClose(关闭后不再触发)', () => {
    const onClose = vi.fn()
    function Wrapper(): React.ReactElement {
      const [visible, setVisible] = React.useState(true)
      return (
        <HoverPreviewCard
          visible={visible}
          position={{ x: 0, y: 0 }}
          content={<span>preview</span>}
          role="dialog"
          onClose={() => {
            onClose()
            setVisible(false)
          }}
        />
      )
    }
    const { container } = render(<Wrapper />)
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    fireEvent.keyDown(card, { key: 'Escape' })
    // 卡片已卸载,后续 Esc 不再触发(无 document listener)
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('HoverPreviewCard a11y — 焦点陷阱', () => {
  afterEach(() => {
    cleanup()
  })

  // 7. Tab on last → 焦点循环到 first
  it('Tab on last → 焦点循环到 first', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        role="dialog"
        content={
          <>
            <button type="button" data-testid="btn-1">
              1
            </button>
            <button type="button" data-testid="btn-2">
              2
            </button>
          </>
        }
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    const btn1 = screen.getByTestId('btn-1')
    const btn2 = screen.getByTestId('btn-2')
    btn2.focus()
    expect(document.activeElement).toBe(btn2)
    fireEvent.keyDown(card, { key: 'Tab' })
    expect(document.activeElement).toBe(btn1)
  })

  // 8. Shift+Tab on first → 焦点反向循环到 last
  it('Shift+Tab on first → 焦点反向循环到 last', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        role="dialog"
        content={
          <>
            <button type="button" data-testid="btn-1">
              1
            </button>
            <button type="button" data-testid="btn-2">
              2
            </button>
          </>
        }
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    const btn1 = screen.getByTestId('btn-1')
    const btn2 = screen.getByTestId('btn-2')
    btn1.focus()
    expect(document.activeElement).toBe(btn1)
    fireEvent.keyDown(card, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(btn2)
  })

  // 9. 卡内无可聚焦元素 → Tab 不被拦截
  it('卡内无可聚焦元素 → Tab 不被拦截(defaultPrevented=false)', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        role="dialog"
        content={<span>just text, no focusable elements</span>}
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    })
    card.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  // 10. visible=false → 焦点陷阱不激活(卡片不在 DOM 中)
  it('visible=false → 焦点陷阱不激活(卡片不在 DOM 中,Tab 无副作用)', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={false}
        position={{ x: 0, y: 0 }}
        role="dialog"
        content={<button type="button">btn</button>}
      />,
    )
    expect(container.querySelector('[data-testid="hover-preview-card"]')).toBeNull()
    // Tab 不应引起任何副作用或异常
    expect(() => {
      fireEvent.keyDown(document, { key: 'Tab' })
    }).not.toThrow()
  })

  // 11. card 有 role="dialog"
  it('role="dialog" 时 card 有 role="dialog" 属性', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={<span>preview</span>}
        role="dialog"
        ariaLabel="预览"
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    expect(card.getAttribute('role')).toBe('dialog')
  })

  // 12. card 有 aria-label
  it('ariaLabel 传入时 card 有 aria-label 属性', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={<span>preview</span>}
        role="dialog"
        ariaLabel="步骤预览卡片"
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    expect(card.getAttribute('aria-label')).toBe('步骤预览卡片')
  })
})

describe('HoverPreviewCard a11y — 综合', () => {
  afterEach(() => {
    cleanup()
  })

  // 13. Esc 后卡片卸载,焦点回到 body
  it('Esc 后卡片卸载,焦点回到 body', () => {
    function Wrapper(): React.ReactElement {
      const [visible, setVisible] = React.useState(true)
      return (
        <HoverPreviewCard
          visible={visible}
          position={{ x: 0, y: 0 }}
          role="dialog"
          ariaLabel="预览"
          content={<span>preview</span>}
          onClose={() => setVisible(false)}
        />
      )
    }
    const { container } = render(<Wrapper />)
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    // role="dialog" + 无可聚焦元素 → 自动聚焦卡片本身(tabIndex=-1)
    expect(document.activeElement).toBe(card)
    fireEvent.keyDown(card, { key: 'Escape' })
    // 卡片卸载后焦点回到 body
    expect(container.querySelector('[data-testid="hover-preview-card"]')).toBeNull()
    expect(document.activeElement).toBe(document.body)
  })

  // 14. 卡首次显示时自动聚焦第一个可聚焦元素
  it('卡首次显示时自动聚焦第一个可聚焦元素', () => {
    render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        role="dialog"
        content={
          <>
            <button type="button" data-testid="btn-first">
              First
            </button>
            <button type="button" data-testid="btn-second">
              Second
            </button>
          </>
        }
      />,
    )
    const btnFirst = screen.getByTestId('btn-first')
    expect(document.activeElement).toBe(btnFirst)
  })

  // 15. Tab 在 3+ 个可聚焦元素间循环(last → first)
  it('Tab 在 3+ 个可聚焦元素间循环(last → first)', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        role="dialog"
        content={
          <>
            <button type="button" data-testid="btn-a">
              A
            </button>
            <button type="button" data-testid="btn-b">
              B
            </button>
            <button type="button" data-testid="btn-c">
              C
            </button>
          </>
        }
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    const btnA = screen.getByTestId('btn-a')
    const btnC = screen.getByTestId('btn-c')
    btnC.focus()
    expect(document.activeElement).toBe(btnC)
    fireEvent.keyDown(card, { key: 'Tab' })
    expect(document.activeElement).toBe(btnA)
  })

  // 16. role="dialog" 时 tabIndex=-1(可编程聚焦)
  it('role="dialog" 时 card 有 tabIndex=-1(可编程聚焦)', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={<span>preview</span>}
        role="dialog"
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    expect(card.tabIndex).toBe(-1)
  })

  // 17. role="dialog" 时 aria-modal=false(非模态,不阻挡屏幕阅读器)
  it('role="dialog" 时 card 有 aria-modal=false(非模态)', () => {
    const { container } = render(
      <HoverPreviewCard
        visible={true}
        position={{ x: 0, y: 0 }}
        content={<span>preview</span>}
        role="dialog"
      />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    expect(card.getAttribute('aria-modal')).toBe('false')
  })

  // 18. role="tooltip"(默认)+ 不传 onClose:Esc 不报错
  it('role="tooltip"(默认)+ 不传 onClose:Esc 不报错(向后兼容)', () => {
    const { container } = render(
      <HoverPreviewCard visible={true} position={{ x: 0, y: 0 }} content={<span>preview</span>} />,
    )
    const card = container.querySelector('[data-testid="hover-preview-card"]') as HTMLElement
    expect(() => {
      fireEvent.keyDown(card, { key: 'Escape' })
    }).not.toThrow()
  })
})
