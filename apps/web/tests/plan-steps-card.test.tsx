// @vitest-environment happy-dom
/**
 * PlanStepsCard 单元测试(对标 OpenAI Codex /plan 内联展示)
 *
 * 覆盖:
 * - 空 steps 不渲染
 * - 有 steps 时渲染 FoldableSection + 完成度 "doneCount/count"
 * - 展开/折叠交互(aria-expanded 切换)
 * - 每步标题渲染
 * - 状态图标映射(pending→Clock / in_progress→Loader2 / completed→Check)
 * - 状态颜色 + animate-spin(in_progress)
 * - 耗时显示(有 durationMs 时)
 * - explanation 渲染
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PlanStepsCard } from '../src/components/ai/progress-sections/plan-steps-card'
import type { PlanStep } from '../src/hooks/use-agent-progress'

// ─── lucide-react mock:每个图标用独立 testid(便于断言"正确图标渲染") ──
vi.mock('lucide-react', () => {
  const make =
    (name: string) =>
    ({ className }: { className?: string }) => (
      <span data-testid={`icon-${name}`} className={className} aria-hidden />
    )
  return {
    __esModule: true,
    ListTodo: make('ListTodo'),
    Check: make('Check'),
    Clock: make('Clock'),
    Loader2: make('Loader2'),
    ChevronRight: make('ChevronRight'),
    ChevronDown: make('ChevronDown'),
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ─── 工厂函数 ──────────────────────────────────────────────────────
function makeStep(overrides: Partial<PlanStep> = {}): PlanStep {
  return {
    id: overrides.id ?? 'step-1',
    step: overrides.step ?? '分析需求',
    status: overrides.status ?? 'pending',
    explanation: overrides.explanation,
    durationMs: overrides.durationMs,
  }
}

describe('PlanStepsCard', () => {
  it('空 steps 不渲染(返回 null)', () => {
    const { container } = render(<PlanStepsCard steps={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('有 steps 时渲染卡片 + 标题图标 ListTodo', () => {
    const steps = [
      makeStep({ id: 's1', step: '步骤一', status: 'completed' }),
      makeStep({ id: 's2', step: '步骤二', status: 'in_progress' }),
      makeStep({ id: 's3', step: '步骤三', status: 'pending' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    expect(screen.getByTestId('plan-steps-card')).toBeTruthy()
    // FoldableSection header 图标
    expect(screen.getAllByTestId('icon-ListTodo')).toHaveLength(1)
  })

  it('折叠态显示完成度 "doneCount/count"', () => {
    const steps = [
      makeStep({ id: 's1', status: 'completed' }),
      makeStep({ id: 's2', status: 'in_progress' }),
      makeStep({ id: 's3', status: 'pending' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    // doneCount=1, count=3 → "1/3"
    const progressText = screen.getByTestId('plan-steps-card-progress-text')
    expect(progressText.textContent).toBe('1/3')
  })

  it('渲染所有步骤标题', () => {
    const steps = [
      makeStep({ id: 's1', step: '分析需求' }),
      makeStep({ id: 's2', step: '编写代码' }),
      makeStep({ id: 's3', step: '运行测试' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    expect(screen.getByText('分析需求')).toBeTruthy()
    expect(screen.getByText('编写代码')).toBeTruthy()
    expect(screen.getByText('运行测试')).toBeTruthy()
  })

  it('点击 header 切换展开/折叠(aria-expanded)', () => {
    const steps = [makeStep({ id: 's1' })]
    render(<PlanStepsCard steps={steps} />)
    const header = screen.getByRole('button', { name: '执行计划' })
    expect(header.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(header)
    expect(header.getAttribute('aria-expanded')).toBe('true')
  })

  it('状态图标映射正确(pending→Clock / in_progress→Loader2 / completed→Check)', () => {
    const steps = [
      makeStep({ id: 's1', step: '已完成', status: 'completed' }),
      makeStep({ id: 's2', step: '进行中', status: 'in_progress' }),
      makeStep({ id: 's3', step: '待开始', status: 'pending' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    expect(screen.getAllByTestId('icon-Check')).toHaveLength(1)
    expect(screen.getAllByTestId('icon-Loader2')).toHaveLength(1)
    expect(screen.getAllByTestId('icon-Clock')).toHaveLength(1)
  })

  it('in_progress 步骤图标带 animate-spin 类', () => {
    const { container } = render(
      <PlanStepsCard
        steps={[makeStep({ id: 's1', status: 'in_progress' })]}
      />,
    )
    const li = container.querySelector('[data-status="in_progress"]')
    expect(li).toBeTruthy()
    const icon = li?.querySelector('[data-testid="icon-Loader2"]')
    expect(icon).toBeTruthy()
    expect(icon?.className).toContain('animate-spin')
    expect(icon?.className).toContain('text-primary')
  })

  it('completed 步骤图标为 emerald 色', () => {
    const { container } = render(
      <PlanStepsCard
        steps={[makeStep({ id: 's1', status: 'completed' })]}
      />,
    )
    const icon = container.querySelector(
      '[data-status="completed"] [data-testid="icon-Check"]',
    )
    expect(icon).toBeTruthy()
    expect(icon?.className).toContain('text-emerald-500')
  })

  it('有 durationMs 时显示耗时(formatDuration)', () => {
    const steps = [
      makeStep({ id: 's1', status: 'completed', durationMs: 1500 }),
      makeStep({ id: 's2', status: 'completed', durationMs: 65000 }),
      makeStep({ id: 's3', status: 'completed', durationMs: 800 }),
    ]
    const { container } = render(<PlanStepsCard steps={steps} />)
    // 1500ms → "1.5s" / 65000ms → "1m5s" / 800ms → "800ms"
    expect(container.textContent).toContain('1.5s')
    expect(container.textContent).toContain('1m5s')
    expect(container.textContent).toContain('800ms')
  })

  it('无 durationMs 时不渲染耗时', () => {
    const steps = [makeStep({ id: 's1', status: 'pending' })]
    const { container } = render(<PlanStepsCard steps={steps} />)
    // pending 步骤无 durationMs,不应出现 ms/s 单位耗时
    expect(container.textContent).not.toMatch(/\d+ms/)
    expect(container.textContent).not.toMatch(/\d+\.\d+s/)
  })

  it('有 explanation 时渲染说明文本', () => {
    const steps = [
      makeStep({ id: 's1', step: '分析需求', explanation: '这是详细说明' }),
    ]
    render(<PlanStepsCard steps={steps} />)
    expect(screen.getByText('这是详细说明')).toBeTruthy()
  })

  it('自定义 data-testid 透传到根节点 + 子 testid 派生', () => {
    const steps = [makeStep({ id: 's1' })]
    render(<PlanStepsCard steps={steps} data-testid="msg-plan" />)
    expect(screen.getByTestId('msg-plan')).toBeTruthy()
    expect(screen.getByTestId('msg-plan-progress-text')).toBeTruthy()
    expect(screen.getByTestId('msg-plan-list')).toBeTruthy()
  })
})
