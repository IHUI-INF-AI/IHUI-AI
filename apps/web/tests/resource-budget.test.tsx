// @vitest-environment happy-dom
/**
 * ResourceBudget 单元测试(2026-07-28 立,块 3.4)
 *
 * 覆盖:
 * - inline variant:渲染 span + icon + 数字 + 进度条百分比
 * - block variant:渲染 div + 标题行 + 进度条
 * - 进度条 fill 颜色:90%+ destructive / 70%+ amber / <70% primary
 * - icon 颜色:pct >= 70 → amber,否则 primary
 * - active=true:icon 切换为 Loader2 + animate-spin
 * - 边界:used=0 / total=0 / used > total(被 clamp)
 * - pct 计算:Math.round
 * - aria-label:含 used/total/label
 * - className 透传
 * - data-testid 自定义/默认
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
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

// ─── inline variant 基础渲染 ──────────────────────────────
describe('ResourceBudget — inline variant 基础渲染', () => {
  it('渲染 span 容器 + 默认 data-testid', () => {
    const { container } = render(<ResourceBudget used={50} total={100} label="tokens" />)
    const el = container.querySelector('[data-testid="resource-budget-inline"]')
    expect(el).toBeTruthy()
    expect(el?.tagName.toLowerCase()).toBe('span')
  })

  it('渲染 used / total / label 数字与文本', () => {
    render(<ResourceBudget used={30} total={100} label="tokens" />)
    expect(screen.getByText(/30/)).toBeTruthy()
    expect(screen.getByText(/100/)).toBeTruthy()
    expect(screen.getByText(/tokens/)).toBeTruthy()
  })

  it('inline 模式渲染当前 usage 文案', () => {
    const { container } = render(<ResourceBudget used={30} total={100} label="requests" />)
    expect(container.textContent).toContain('Current usage:')
  })

  it('aria-label 含 used / total / label', () => {
    const { container } = render(<ResourceBudget used={30} total={100} label="tokens" />)
    const el = container.querySelector('[data-testid="resource-budget-inline"]') as HTMLElement
    expect(el.getAttribute('aria-label')).toBe('Current usage: 30 / 100 tokens')
  })
})

// ─── block variant ────────────────────────────────────────
describe('ResourceBudget — block variant', () => {
  it('block 模式渲染 div 容器', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    const el = container.querySelector('[data-testid="resource-budget-block"]')
    expect(el).toBeTruthy()
    expect(el?.tagName.toLowerCase()).toBe('div')
  })

  it('block 模式渲染 pct% 徽章', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    expect(container.textContent).toContain('50%')
  })

  it('block 模式渲染 progress bar 容器(bg-muted/40)', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    // 进度条外层 h-1 overflow-hidden
    const barContainer = container.querySelector('.h-1.overflow-hidden')
    expect(barContainer).toBeTruthy()
    // 进度条内层 h-full + transition-all
    const fillBar = barContainer?.querySelector('.h-full') as HTMLElement
    expect(fillBar).toBeTruthy()
    expect(fillBar.style.width).toBe('50%')
  })

  it('block 模式 aria-label', () => {
    const { container } = render(
      <ResourceBudget used={30} total={100} label="tokens" variant="block" />,
    )
    const el = container.querySelector('[data-testid="resource-budget-block"]') as HTMLElement
    expect(el.getAttribute('aria-label')).toBe('Current usage: 30 / 100 tokens')
  })
})

// ─── 进度条 fill 颜色映射 ────────────────────────────────
describe('ResourceBudget — 进度条 fill 颜色阈值', () => {
  it('pct < 70% → fill bg-primary/60', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.className).toContain('bg-primary/60')
  })

  it('pct = 70% → fill bg-amber-500/60', () => {
    const { container } = render(
      <ResourceBudget used={70} total={100} label="tokens" variant="block" />,
    )
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.className).toContain('bg-amber-500/60')
    expect(fill.className).not.toContain('bg-primary/60')
  })

  it('pct = 90% → fill bg-destructive/60', () => {
    const { container } = render(
      <ResourceBudget used={90} total={100} label="tokens" variant="block" />,
    )
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.className).toContain('bg-destructive/60')
  })

  it('pct = 100% → fill bg-destructive/60', () => {
    const { container } = render(
      <ResourceBudget used={100} total={100} label="tokens" variant="block" />,
    )
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.className).toContain('bg-destructive/60')
  })

  it('pct = 69% → fill bg-primary/60(< 70 阈值)', () => {
    const { container } = render(
      <ResourceBudget used={69} total={100} label="tokens" variant="block" />,
    )
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.className).toContain('bg-primary/60')
  })

  it('pct = 89% → fill bg-amber-500/60(70 ≤ pct < 90)', () => {
    const { container } = render(
      <ResourceBudget used={89} total={100} label="tokens" variant="block" />,
    )
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.className).toContain('bg-amber-500/60')
  })
})

// ─── icon 颜色映射 ──────────────────────────────────────────
describe('ResourceBudget — icon 颜色阈值', () => {
  it('pct < 70% → icon text-primary', () => {
    const { container } = render(<ResourceBudget used={50} total={100} label="tokens" />)
    const icon = container.querySelector('[data-testid="lucide-icon"]') as HTMLElement
    expect(icon.className).toContain('text-primary')
    expect(icon.className).not.toContain('text-amber-500')
  })

  it('pct = 70% → icon text-amber-500', () => {
    const { container } = render(<ResourceBudget used={70} total={100} label="tokens" />)
    const icon = container.querySelector('[data-testid="lucide-icon"]') as HTMLElement
    expect(icon.className).toContain('text-amber-500')
  })

  it('pct = 95% → icon text-amber-500(block 中也应用此颜色映射)', () => {
    // 注意:block variant 的 icon 颜色逻辑也是 pct >= 70 → text-amber-500
    const { container } = render(
      <ResourceBudget used={95} total={100} label="tokens" variant="block" />,
    )
    const icon = container.querySelector('[data-testid="lucide-icon"]') as HTMLElement
    expect(icon.className).toContain('text-amber-500')
  })
})

// ─── active 状态 ──────────────────────────────────────────
describe('ResourceBudget — active prop', () => {
  it('active=true → icon 切换为 Loader2 样式 + animate-spin', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" active={true} />,
    )
    // icon 含 animate-spin
    const icon = container.querySelector('[data-testid="lucide-icon"]') as HTMLElement
    expect(icon.className).toContain('animate-spin')
  })

  it('active=false → icon 不含 animate-spin', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" active={false} />,
    )
    const icon = container.querySelector('[data-testid="lucide-icon"]') as HTMLElement
    expect(icon.className).not.toContain('animate-spin')
  })

  it('active 默认为 false(inline 模式)', () => {
    const { container } = render(<ResourceBudget used={50} total={100} label="tokens" />)
    const icon = container.querySelector('[data-testid="lucide-icon"]') as HTMLElement
    expect(icon.className).not.toContain('animate-spin')
  })

  it('active=true + block variant:icon 含 animate-spin', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" active={true} />,
    )
    const icon = container.querySelector('[data-testid="lucide-icon"]') as HTMLElement
    expect(icon.className).toContain('animate-spin')
  })
})

// ─── 边界场景 ───────────────────────────────────────────
describe('ResourceBudget — 边界场景', () => {
  it('used=0 → 0% + 进度条 width=0%', () => {
    const { container } = render(
      <ResourceBudget used={0} total={100} label="tokens" variant="block" />,
    )
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.style.width).toBe('0%')
    expect(container.textContent).toContain('0%')
  })

  it('used=total → 100%', () => {
    const { container } = render(
      <ResourceBudget used={100} total={100} label="tokens" variant="block" />,
    )
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.style.width).toBe('100%')
    expect(container.textContent).toContain('100%')
  })

  it('used > total → 被 clamp 到 total(100%)(逻辑:Math.min(used, safeTotal))', () => {
    const { container } = render(
      <ResourceBudget used={200} total={100} label="tokens" variant="block" />,
    )
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.style.width).toBe('100%')
    // aria-label 中 safeUsed = min(200, 100) = 100
    const el = container.querySelector('[data-testid="resource-budget-block"]') as HTMLElement
    expect(el.getAttribute('aria-label')).toBe('Current usage: 100 / 100 tokens')
  })

  it('used < 0 → 被 Math.max(0, used) 钳位到 0', () => {
    const { container } = render(
      <ResourceBudget used={-50} total={100} label="tokens" variant="block" />,
    )
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.style.width).toBe('0%')
  })

  it('total = 0 → pct=0 + 不除零(安全 fallback)', () => {
    const { container } = render(
      <ResourceBudget used={50} total={0} label="tokens" variant="block" />,
    )
    // pct = safeTotal > 0 ? ... : 0
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.style.width).toBe('0%')
    expect(container.textContent).toContain('0%')
  })

  it('total < 0 → safeTotal = Math.max(0, -5) = 0 → pct=0', () => {
    const { container } = render(
      <ResourceBudget used={50} total={-5} label="tokens" variant="block" />,
    )
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.style.width).toBe('0%')
  })

  it('inline 模式边界:used=0 显示 0%', () => {
    const { container } = render(<ResourceBudget used={0} total={100} label="tokens" />)
    expect(container.textContent).toContain('0 / 100')
  })
})

// ─── pct 舍入 ────────────────────────────────────────────
describe('ResourceBudget — pct 舍入行为', () => {
  it('used=33, total=100 → 33%', () => {
    const { container } = render(
      <ResourceBudget used={33} total={100} label="tokens" variant="block" />,
    )
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.style.width).toBe('33%')
  })

  it('used=1, total=3 → 33%(Math.round 1/3 = 33.33 → 33)', () => {
    const { container } = render(
      <ResourceBudget used={1} total={3} label="tokens" variant="block" />,
    )
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.style.width).toBe('33%')
  })

  it('used=2, total=3 → 67%', () => {
    const { container } = render(
      <ResourceBudget used={2} total={3} label="tokens" variant="block" />,
    )
    const fill = container.querySelector('.h-full') as HTMLElement
    expect(fill.style.width).toBe('67%')
  })
})

// ─── className + data-testid 透传 ─────────────────────────
describe('ResourceBudget — className + data-testid 透传', () => {
  it('className 透传到 inline 容器', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" className="my-cls" />,
    )
    const el = container.querySelector('[data-testid="resource-budget-inline"]') as HTMLElement
    expect(el.className).toContain('my-cls')
  })

  it('className 透传到 block 容器', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" className="block-cls" />,
    )
    const el = container.querySelector('[data-testid="resource-budget-block"]') as HTMLElement
    expect(el.className).toContain('block-cls')
  })

  it('data-testid 覆盖默认(inline)', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" data-testid="custom-inline" />,
    )
    expect(container.querySelector('[data-testid="custom-inline"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="resource-budget-inline"]')).toBeFalsy()
  })

  it('data-testid 覆盖默认(block)', () => {
    const { container } = render(
      <ResourceBudget
        used={50}
        total={100}
        label="tokens"
        variant="block"
        data-testid="custom-block"
      />,
    )
    expect(container.querySelector('[data-testid="custom-block"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="resource-budget-block"]')).toBeFalsy()
  })
})

// ─── variant 切换 ────────────────────────────────────────
describe('ResourceBudget — variant 行为差异', () => {
  it('variant=block 时不渲染 inline span', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    expect(container.querySelector('[data-testid="resource-budget-inline"]')).toBeFalsy()
    expect(container.querySelector('[data-testid="resource-budget-block"]')).toBeTruthy()
  })

  it('variant=inline(default)时不渲染 block div', () => {
    const { container } = render(<ResourceBudget used={50} total={100} label="tokens" />)
    expect(container.querySelector('[data-testid="resource-budget-block"]')).toBeFalsy()
    expect(container.querySelector('[data-testid="resource-budget-inline"]')).toBeTruthy()
  })

  it('block variant 渲染 tabular-nums 百分比(防布局抖动)', () => {
    const { container } = render(
      <ResourceBudget used={50} total={100} label="tokens" variant="block" />,
    )
    const tabularNums = container.querySelector('.tabular-nums') as HTMLElement
    expect(tabularNums).toBeTruthy()
    expect(tabularNums.textContent).toContain('50%')
  })
})
