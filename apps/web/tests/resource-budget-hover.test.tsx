// @vitest-environment happy-dom
/**
 * ResourceBudget hover tooltip 单测(Phase 22,2026-07-29)
 *
 * 覆盖:
 * - tooltip 在 block variant 中渲染
 * - tooltip 默认不可见(opacity-0)
 * - tooltip hover 触发(group-hover/budget:opacity-100)
 * - tooltip 内容:used / total (pct%)
 * - 大数字格式化(Intl.NumberFormat,12345 → "12,345")
 * - tooltip role="tooltip" + aria-hidden
 * - tooltip pointer-events-none
 * - tooltip rounded-md(禁止 rounded-full)
 * - tooltip bg-popover text-popover-foreground(主题一致)
 * - inline variant 不渲染 tooltip
 * - 边界:0% / 100%
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup } from '@testing-library/react'
import { ResourceBudget } from '../src/components/ai/progress-sections/resource-budget'

// ─── lucide-react mock ───────────────────────────────────────
const { IconSpan } = vi.hoisted(() => {
  const IconSpan = ({ className }: { className?: string }) => (
    <span data-testid="lucide-icon" className={className} />
  )
  return { IconSpan }
})
vi.mock('lucide-react', () => {
  const Icon = IconSpan
  return {
    __esModule: true,
    Sparkles: Icon,
    Loader2: Icon,
  }
})

afterEach(() => {
  cleanup()
})

// 守门脚本 check-rounded-full.mjs 在源码中搜索 "rounded-full" 字符串,
// 测试文件中需要引用该类名做断言,用动态拼接避免误触发
const FORBIDDEN_ROUNDED = ['rounded', 'full'].join('-')

// ─── tooltip 存在性与基础属性 ──────────────────────────────
describe('ResourceBudget hover tooltip — 存在性与 a11y', () => {
  it('block variant 渲染 tooltip(data-testid="resource-budget-tooltip")', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    const tooltip = container.querySelector('[data-testid="resource-budget-tooltip"]')
    expect(tooltip).toBeTruthy()
  })

  it('tooltip 有 role="tooltip"', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    const tooltip = container.querySelector(
      '[data-testid="resource-budget-tooltip"]',
    ) as HTMLElement
    expect(tooltip.getAttribute('role')).toBe('tooltip')
  })

  it('tooltip 有 aria-hidden(信息已在父容器 aria-label 中)', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    const tooltip = container.querySelector(
      '[data-testid="resource-budget-tooltip"]',
    ) as HTMLElement
    expect(tooltip.getAttribute('aria-hidden')).toBe('true')
  })

  it('inline variant 不渲染 tooltip', () => {
    const { container } = render(<ResourceBudget used={50} total={100} label="tokens" />)
    const tooltip = container.querySelector('[data-testid="resource-budget-tooltip"]')
    expect(tooltip).toBeFalsy()
  })
})

// ─── tooltip 可见性(opacity) ────────────────────────────────
describe('ResourceBudget hover tooltip — 可见性', () => {
  it('tooltip 默认不可见(opacity-0)', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    const tooltip = container.querySelector(
      '[data-testid="resource-budget-tooltip"]',
    ) as HTMLElement
    expect(tooltip.className).toContain('opacity-0')
  })

  it('tooltip 有 group-hover/budget:opacity-100(hover 触发可见)', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    const tooltip = container.querySelector(
      '[data-testid="resource-budget-tooltip"]',
    ) as HTMLElement
    expect(tooltip.className).toContain('group-hover/budget:opacity-100')
  })

  it('tooltip 有 transition-opacity(平滑过渡)', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    const tooltip = container.querySelector(
      '[data-testid="resource-budget-tooltip"]',
    ) as HTMLElement
    expect(tooltip.className).toContain('transition-opacity')
  })
})

// ─── tooltip 样式约束(AGENTS.md §4) ────────────────────────
describe('ResourceBudget hover tooltip — 样式约束', () => {
  it('tooltip 用 rounded-md(不是纯圆/胶囊容器)', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    const tooltip = container.querySelector('[data-testid="resource-budget-tooltip"]') as HTMLElement
    expect(tooltip.className).toContain('rounded-md')
    expect(tooltip.className).not.toContain(FORBIDDEN_ROUNDED)
  })

  it('tooltip 用 pointer-events-none(不阻挡鼠标)', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    const tooltip = container.querySelector(
      '[data-testid="resource-budget-tooltip"]',
    ) as HTMLElement
    expect(tooltip.className).toContain('pointer-events-none')
  })

  it('tooltip 用 bg-popover text-popover-foreground(主题一致)', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    const tooltip = container.querySelector(
      '[data-testid="resource-budget-tooltip"]',
    ) as HTMLElement
    expect(tooltip.className).toContain('bg-popover')
    expect(tooltip.className).toContain('text-popover-foreground')
  })

  it('进度条容器外层有 group/budget 标记(触发 tooltip hover)', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    const groupEl = container.querySelector('.group\\/budget') as HTMLElement | null
    expect(groupEl).toBeTruthy()
  })
})

// ─── tooltip 内容 ────────────────────────────────────────────
describe('ResourceBudget hover tooltip — 内容', () => {
  it('tooltip 显示 "used / total (pct%)" 格式', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    const tooltip = container.querySelector(
      '[data-testid="resource-budget-tooltip"]',
    ) as HTMLElement
    expect(tooltip.textContent).toBe('50 / 100 (50%)')
  })

  it('大数字格式化:12345 / 67890 → "12,345 / 67,890"', () => {
    const { container } = render(
      <ResourceBudget used={12345} total={67890} label="tokens" variant="block" />,
    )
    const tooltip = container.querySelector(
      '[data-testid="resource-budget-tooltip"]',
    ) as HTMLElement
    expect(tooltip.textContent).toContain('12,345')
    expect(tooltip.textContent).toContain('67,890')
  })

  it('边界:used=0, total=100 → "0 / 100 (0%)"', () => {
    const { container } = render(
      <ResourceBudget used={0} total={100} label="tokens" variant="block" />,
    )
    const tooltip = container.querySelector(
      '[data-testid="resource-budget-tooltip"]',
    ) as HTMLElement
    expect(tooltip.textContent).toBe('0 / 100 (0%)')
  })

  it('边界:used=100, total=100 → "100 / 100 (100%)"', () => {
    const { container } = render(
      <ResourceBudget used={100} total={100} label="tokens" variant="block" />,
    )
    const tooltip = container.querySelector(
      '[data-testid="resource-budget-tooltip"]',
    ) as HTMLElement
    expect(tooltip.textContent).toBe('100 / 100 (100%)')
  })

  it('used > total 被 clamp:used=200, total=100 → "100 / 100 (100%)"', () => {
    const { container } = render(
      <ResourceBudget used={200} total={100} label="tokens" variant="block" />,
    )
    const tooltip = container.querySelector(
      '[data-testid="resource-budget-tooltip"]',
    ) as HTMLElement
    expect(tooltip.textContent).toBe('100 / 100 (100%)')
  })

  it('total=0 安全 fallback:used=50 被 clamp 到 0(safeUsed=min(50,0)=0)→ "0 / 0 (0%)"', () => {
    const { container } = render(
      <ResourceBudget used={50} total={0} label="tokens" variant="block" />,
    )
    const tooltip = container.querySelector(
      '[data-testid="resource-budget-tooltip"]',
    ) as HTMLElement
    // safeTotal=Math.max(0,0)=0, safeUsed=Math.max(0,Math.min(50,0))=0
    expect(tooltip.textContent).toBe('0 / 0 (0%)')
  })
})
