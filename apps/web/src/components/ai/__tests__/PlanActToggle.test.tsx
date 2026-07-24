// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

// next-intl 在 vitest 下不接 NextIntlClientProvider 上下文,直接 mock 掉 useTranslations
// 用 key 直接当 label 返回(测试不依赖 i18n 文案正确性,只验证 fallback 逻辑)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import PlanActToggle from '../PlanActToggle'

describe('PlanActToggle', () => {
  afterEach(() => cleanup())

  it('test_renders_plan_mode: mode=plan 时 plan 选项高亮', () => {
    render(<PlanActToggle mode="plan" onModeChange={vi.fn()} />)
    // i18n key 不存在 → 降级到硬编码中文
    const planBtn = screen.getByText('规划').closest('button')!
    const actBtn = screen.getByText('执行').closest('button')!
    expect(planBtn.getAttribute('aria-pressed')).toBe('true')
    expect(actBtn.getAttribute('aria-pressed')).toBe('false')
  })

  it('test_renders_act_mode: mode=act 时 act 选项高亮', () => {
    render(<PlanActToggle mode="act" onModeChange={vi.fn()} />)
    const planBtn = screen.getByText('规划').closest('button')!
    const actBtn = screen.getByText('执行').closest('button')!
    expect(planBtn.getAttribute('aria-pressed')).toBe('false')
    expect(actBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('test_click_act_triggers_change: 点击 act → onModeChange("act")', () => {
    const onModeChange = vi.fn()
    render(<PlanActToggle mode="plan" onModeChange={onModeChange} />)
    fireEvent.click(screen.getByText('执行'))
    expect(onModeChange).toHaveBeenCalledWith('act')
    expect(onModeChange).toHaveBeenCalledTimes(1)
  })

  it('test_click_plan_triggers_change: 点击 plan → onModeChange("plan")', () => {
    const onModeChange = vi.fn()
    render(<PlanActToggle mode="act" onModeChange={onModeChange} />)
    fireEvent.click(screen.getByText('规划'))
    expect(onModeChange).toHaveBeenCalledWith('plan')
    expect(onModeChange).toHaveBeenCalledTimes(1)
  })

  it('test_applies_custom_classname: className prop 正确应用到容器', () => {
    render(<PlanActToggle mode="plan" onModeChange={vi.fn()} className="custom-cls-123" />)
    const group = screen.getByRole('group')
    expect(group.getAttribute('class')).toContain('custom-cls-123')
  })
})
