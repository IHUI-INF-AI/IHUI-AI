// vitest.config.ts sets environment jsdom globally for *.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup } from '@testing-library/react'

// next-intl:messages/chat 未含 modePlan/modeAct key,这里 mock 返回中文兜底
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = { modePlan: '规划', modeAct: '执行' }
    return map[key] ?? key
  },
}))

// 隔离 zustand store(受控模式下不实际使用 store 值,提供空实现即可)
vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (s: { planMode: 'plan' | 'act'; setPlanMode: () => void }) => unknown) =>
    selector({ planMode: 'act', setPlanMode: () => {} }),
}))

import { PlanActToggle } from '../plan-act-toggle'

/** 2026-07-25 重写:避免 @testing-library/react 16.x types 解析在 apps/web tsc 下
 * 报 TS2305(screen/fireEvent no exported)。改用 render 返回的 container + DOM API,
 * 不依赖 screen/fireEvent 的 types。语义与原测试一致。 */
function getButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button[role="radio"]'))
}

function getGroup(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[role="radiogroup"]')
}

function clickByText(container: HTMLElement, text: string) {
  const btn = Array.from(getButtons(container)).find((b) => b.textContent === text)
  if (!btn) throw new Error(`button with text "${text}" not found`)
  btn.click()
}

describe('PlanActToggle', () => {
  afterEach(() => cleanup())

  it('mode=plan 时 规划 按钮选中(aria-checked=true)', () => {
    const { container } = render(<PlanActToggle mode="plan" onChange={() => {}} />)
    const radios = getButtons(container)
    expect(radios).toHaveLength(2)
    expect(radios[0]!.getAttribute('aria-checked')).toBe('true')
    expect(radios[1]!.getAttribute('aria-checked')).toBe('false')
  })

  it('点击 执行 触发 onChange("act")', () => {
    const onChange = vi.fn()
    const { container } = render(<PlanActToggle mode="plan" onChange={onChange} />)
    clickByText(container, '执行')
    expect(onChange).toHaveBeenCalledWith('act')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('点击 规划 触发 onChange("plan")', () => {
    const onChange = vi.fn()
    const { container } = render(<PlanActToggle mode="act" onChange={onChange} />)
    clickByText(container, '规划')
    expect(onChange).toHaveBeenCalledWith('plan')
  })

  it('选中态含 primary 背景类,未选中不含', () => {
    const { container } = render(<PlanActToggle mode="plan" onChange={() => {}} />)
    const radios = getButtons(container)
    expect(radios[0]!.getAttribute('class')).toContain('bg-primary')
    expect(radios[0]!.getAttribute('class')).toContain('text-primary-foreground')
    expect(radios[1]!.getAttribute('class')).toContain('bg-muted')
    expect(radios[1]!.getAttribute('class')).not.toContain('bg-primary')
  })

  it('radiogroup 容器用 rounded-md(非 rounded-full)', () => {
    const { container } = render(<PlanActToggle mode="plan" onChange={() => {}} />)
    const group = getGroup(container)
    expect(group).not.toBeNull()
    expect(group!.getAttribute('class')).toContain('rounded-md')
    expect(group!.getAttribute('class')).not.toContain('rounded-full')
  })

  // 2026-07-25 v3 新增:icon variant 强制单图标按钮(AI 面板 header 用)
  it('variant="icon" 始终渲染 1 个图标按钮(role=radio),不渲染 2 文字按钮', () => {
    const { container } = render(
      <PlanActToggle mode="act" onChange={() => {}} variant="icon" />,
    )
    const radios = getButtons(container)
    expect(radios).toHaveLength(1)
    // 文字按钮(规划/执行)不应出现在 DOM 中
    expect(container.textContent).not.toContain('规划')
    expect(container.textContent).not.toContain('执行')
  })

  it('variant="icon" 容器是 32x32 方形 h-8 w-8,跟 header 其他按钮统一', () => {
    const { container } = render(
      <PlanActToggle mode="act" onChange={() => {}} variant="icon" />,
    )
    const group = getGroup(container)
    expect(group).not.toBeNull()
    const cls = group!.getAttribute('class') ?? ''
    expect(cls).toContain('h-8')
    expect(cls).toContain('w-8')
  })

  it('variant="icon" 当前 mode=plan 时含 primary 实色,mode=act 时含 muted', () => {
    const { container: c1 } = render(
      <PlanActToggle mode="plan" onChange={() => {}} variant="icon" />,
    )
    const planBtn = getButtons(c1)[0]!
    expect(planBtn.getAttribute('class')).toContain('bg-primary')

    const { container: c2 } = render(
      <PlanActToggle mode="act" onChange={() => {}} variant="icon" />,
    )
    const actBtn = getButtons(c2)[0]!
    expect(actBtn.getAttribute('class')).toContain('bg-muted')
  })

  it('variant="icon" 点击触发 onChange(plan→act 或 act→plan)', () => {
    const onChange = vi.fn()
    const { container } = render(
      <PlanActToggle mode="act" onChange={onChange} variant="icon" />,
    )
    getButtons(container)[0]!.click()
    expect(onChange).toHaveBeenCalledWith('plan')
  })

  // 2026-07-25 v3 新增:text variant 强制 2 文字按钮(独立模式栏用)
  it('variant="text" 渲染 2 文字按钮,不受容器宽度影响', () => {
    const { container } = render(
      <PlanActToggle mode="plan" onChange={() => {}} variant="text" />,
    )
    const radios = getButtons(container)
    expect(radios).toHaveLength(2)
    expect(radios[0]!.textContent).toBe('规划')
    expect(radios[1]!.textContent).toBe('执行')
  })
})
