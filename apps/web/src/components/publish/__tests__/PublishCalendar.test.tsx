// @vitest-environment jsdom
/**
 * PublishCalendar 键盘交互守门测试(2026-08-06)
 *
 * 覆盖 2026-08-06 修复:a11y(jsx-a11y/click-events-have-key-events)——
 * 日期格 div 增加 role="gridcell" + tabIndex + onKeyDown(Enter/Space 选择日期)。
 * 该修复此前无任何测试覆盖,此文件验证键盘行为与点击行为等价。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PublishCalendar } from '../PublishCalendar'
import type { ScheduledTask } from '../PublishCalendar'

// next-intl mock(组件调用 useTranslations)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// @ihui/ui-react mock(Button/Card/CardContent/Badge 渲染为简单元素)
vi.mock('@ihui/ui-react', () => ({
  Button: ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...rest}>{children}</button>
  ),
  Card: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => <div>{children}</div>,
  CardContent: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div>{children}</div>
  ),
  Badge: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <span>{children}</span>
  ),
}))

// lucide-react mock
vi.mock('lucide-react', () => ({
  ChevronLeft: () => <span data-testid="icon-prev" />,
  ChevronRight: () => <span data-testid="icon-next" />,
  Plus: () => <span data-testid="icon-plus" />,
}))

const TASKS: ScheduledTask[] = [
  { id: 't1', title: '发布文章A', scheduledAt: '2026-08-10T10:00:00+08:00', status: 'scheduled' },
  { id: 't2', title: '发布视频B', scheduledAt: '2026-08-15T14:00:00+08:00', status: 'published' },
]

function renderCalendar() {
  const onCreateTask = vi.fn()
  const onReschedule = vi.fn()
  render(<PublishCalendar tasks={TASKS} onReschedule={onReschedule} onCreateTask={onCreateTask} />)
  return { onCreateTask, onReschedule }
}

describe('PublishCalendar — 键盘交互(2026-08-06 a11y 修复)', () => {
  afterEach(() => cleanup())

  it('日期格渲染为 role=gridcell,选中后 tabIndex 变 0(roving tabindex)', () => {
    renderCalendar()
    const cells = screen.getAllByRole('gridcell')
    expect(cells.length).toBeGreaterThan(0)
    // 初始无选中 → 无格子聚焦(tabIndex 全 -1,避免干扰页面 Tab 序)
    const focusable = cells.filter((c) => (c.getAttribute('tabindex') ?? '-1') !== '-1')
    expect(focusable.length).toBe(0)
    // 点击选中 → 该格 tabIndex=0(可聚焦)
    const target = cells.find((c) => c.textContent?.trim().match(/^\d+$/)) as HTMLElement
    fireEvent.click(target)
    expect(target.getAttribute('tabindex')).toBe('0')
  })

  it('Enter 键选中日期(与点击等价:aria-selected=true)', () => {
    renderCalendar()
    const cells = screen.getAllByRole('gridcell')
    const target = cells.find((c) => c.textContent?.trim().match(/^\d+$/)) as HTMLElement
    expect(target).toBeTruthy()
    expect(target.getAttribute('aria-selected')).not.toBe('true')
    target.focus()
    fireEvent.keyDown(target, { key: 'Enter' })
    // Enter 触发 setSelectedDate → 该格 aria-selected=true(与点击等价)
    expect(target.getAttribute('aria-selected')).toBe('true')
  })

  it('空格键(SPACE)选中日期(preventDefault 由组件内部调用)', () => {
    renderCalendar()
    const cells = screen.getAllByRole('gridcell')
    const target = cells.find((c) => c.textContent?.trim().match(/^\d+$/)) as HTMLElement
    target.focus()
    // 用真实事件对象(组件内部调 e.preventDefault,不注入 mock)
    fireEvent.keyDown(target, { key: ' ' })
    expect(target.getAttribute('aria-selected')).toBe('true')
  })

  it('非 Enter/Space 按键不选中(如 ArrowRight 无副作用)', () => {
    renderCalendar()
    const cells = screen.getAllByRole('gridcell')
    const target = cells.find((c) => c.textContent?.trim().match(/^\d+$/)) as HTMLElement
    fireEvent.keyDown(target, { key: 'ArrowRight' })
    expect(target.getAttribute('aria-selected')).not.toBe('true')
  })

  it('点击日期格选中(回归:onClick 未破坏)', () => {
    renderCalendar()
    const cells = screen.getAllByRole('gridcell')
    const target = cells.find((c) => c.textContent?.trim().match(/^\d+$/)) as HTMLElement
    fireEvent.click(target)
    expect(target.getAttribute('aria-selected')).toBe('true')
  })
})
