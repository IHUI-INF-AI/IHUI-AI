// vitest.config.ts sets environment jsdom globally for *.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

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

describe('PlanActToggle', () => {
  afterEach(() => cleanup())

  it('mode=plan 时 规划 按钮选中(aria-checked=true)', () => {
    render(<PlanActToggle mode="plan" onChange={() => {}} />)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(2)
    expect(radios[0]!.getAttribute('aria-checked')).toBe('true')
    expect(radios[1]!.getAttribute('aria-checked')).toBe('false')
  })

  it('点击 执行 触发 onChange("act")', () => {
    const onChange = vi.fn()
    render(<PlanActToggle mode="plan" onChange={onChange} />)
    fireEvent.click(screen.getByText('执行'))
    expect(onChange).toHaveBeenCalledWith('act')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('点击 规划 触发 onChange("plan")', () => {
    const onChange = vi.fn()
    render(<PlanActToggle mode="act" onChange={onChange} />)
    fireEvent.click(screen.getByText('规划'))
    expect(onChange).toHaveBeenCalledWith('plan')
  })

  it('选中态含 primary 背景类,未选中不含', () => {
    render(<PlanActToggle mode="plan" onChange={() => {}} />)
    const radios = screen.getAllByRole('radio')
    // 选中(规划)
    expect(radios[0]!.getAttribute('class')).toContain('bg-primary')
    expect(radios[0]!.getAttribute('class')).toContain('text-primary-foreground')
    // 未选中(执行)用 muted 背景,不含 primary
    expect(radios[1]!.getAttribute('class')).toContain('bg-muted')
    expect(radios[1]!.getAttribute('class')).not.toContain('bg-primary')
  })

  it('radiogroup 容器用 rounded-md(非 rounded-full)', () => {
    render(<PlanActToggle mode="plan" onChange={() => {}} />)
    const group = screen.getByRole('radiogroup')
    expect(group.getAttribute('class')).toContain('rounded-md')
    expect(group.getAttribute('class')).not.toContain('rounded-full')
  })
})
