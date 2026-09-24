// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D89 ③ goal 成就耗时条(2026-09-24)
// 数据面:useGoalStore 的 createdAt(setGoal 落定)/ updatedAt(setStatus('done') 刷新),
// 无需新契约字段;断言 done 态渲染「已在 {totalTime} 内达成目标」、非 done 不渲染。
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: { totalTime?: string; [k: string]: unknown }) => {
    if (key === 'achievedInTime') return `已在 ${params?.totalTime} 内达成目标`
    if (key === 'statusDone') return '已完成'
    return key
  },
}))

vi.mock('@/components/common', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

// GoalCard 仅在 handleContinue 里 setState,隔离重依赖的 chat store
vi.mock('@/stores/chat', () => ({
  useChatStore: { setState: vi.fn(), getState: vi.fn() },
}))

import { GoalCard } from '../goal-card'
import { useGoalStore, type Goal } from '@/stores/goal'

function makeGoal(partial: Partial<Goal>): Goal {
  return {
    id: 'goal-test',
    text: '完成 D89',
    status: 'active',
    progress: 0,
    blockers: [],
    createdAt: 1_000_000,
    updatedAt: 1_000_000,
    ...partial,
  }
}

describe('GoalCard 成就耗时条(D89 ③)', () => {
  afterEach(() => {
    cleanup()
    useGoalStore.setState({ goal: null })
  })

  it('done 态渲染「已在 {totalTime} 内达成目标」,95s 格式化为 1m 35s', () => {
    useGoalStore.setState({
      goal: makeGoal({ status: 'done', createdAt: 1_000_000, updatedAt: 1_095_000 }),
    })
    render(<GoalCard />)
    const bar = screen.getByTestId('goal-achieved-time')
    expect(bar).toBeTruthy()
    expect(bar.textContent).toContain('已在 1m 35s 内达成目标')
  })

  it('active 态不渲染耗时条(仅 done 有成就语义)', () => {
    useGoalStore.setState({
      goal: makeGoal({ status: 'active', createdAt: 1_000_000, updatedAt: 1_095_000 }),
    })
    render(<GoalCard />)
    expect(screen.queryByTestId('goal-achieved-time')).toBeNull()
  })

  it('边界:createdAt === updatedAt(done 立即达成)格式化为 0s,不为负', () => {
    useGoalStore.setState({
      goal: makeGoal({ status: 'done', createdAt: 2_000_000, updatedAt: 2_000_000 }),
    })
    render(<GoalCard />)
    expect(screen.getByTestId('goal-achieved-time').textContent).toContain('已在 0s 内达成目标')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
