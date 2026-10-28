// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D64 ⑥(2026-09-26):goal 卡「编辑目标」(renameGoal 保状态保进度)与「折叠态持久化」
// (expanded 入 goal store persist,对标 Trae isGoalExpanded)两小件。
// 文案走键,不依赖措辞;编辑/保存/取消措辞对齐 E1 证据 composer.threadGoal.editDialog.*。
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
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

function makeGoal(partial: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-d64',
    text: '完成 D64',
    status: 'active',
    progress: 40,
    blockers: [],
    createdAt: 1_000_000,
    updatedAt: 1_000_000,
    ...partial,
  }
}

describe('D64 ⑥ goal 卡编辑/折叠', () => {
  afterEach(() => {
    cleanup()
    useGoalStore.setState({ goal: null, expanded: true })
  })

  it('编辑目标:保存走 renameGoal —— 只改文本,保留 status/progress/createdAt(不重置生命周期)', () => {
    useGoalStore.setState({
      goal: makeGoal({ status: 'paused', progress: 40, createdAt: 1_000_000 }),
    })
    render(<GoalCard />)
    fireEvent.click(screen.getByTestId('goal-edit'))
    const input = screen.getByTestId('goal-edit-input') as HTMLInputElement
    expect(input.value).toBe('完成 D64')
    fireEvent.change(input, { target: { value: '改后的目标' } })
    fireEvent.click(screen.getByTestId('goal-edit-save'))
    const goal = useGoalStore.getState().goal!
    expect(goal.text).toBe('改后的目标')
    expect(goal.status).toBe('paused')
    expect(goal.progress).toBe(40)
    expect(goal.createdAt).toBe(1_000_000)
    // 保存后退出编辑态
    expect(screen.queryByTestId('goal-edit-input')).toBeNull()
  })

  it('取消编辑:文本一字不动', () => {
    useGoalStore.setState({ goal: makeGoal() })
    render(<GoalCard />)
    fireEvent.click(screen.getByTestId('goal-edit'))
    fireEvent.change(screen.getByTestId('goal-edit-input'), { target: { value: '不该生效' } })
    fireEvent.click(screen.getByTestId('goal-edit-cancel'))
    expect(useGoalStore.getState().goal!.text).toBe('完成 D64')
    expect(screen.queryByTestId('goal-edit-input')).toBeNull()
  })

  it('空文本保存被拒(renameGoal 守卫),目标不落空', () => {
    useGoalStore.setState({ goal: makeGoal() })
    render(<GoalCard />)
    fireEvent.click(screen.getByTestId('goal-edit'))
    fireEvent.change(screen.getByTestId('goal-edit-input'), { target: { value: '   ' } })
    fireEvent.click(screen.getByTestId('goal-edit-save'))
    expect(useGoalStore.getState().goal!.text).toBe('完成 D64')
  })

  it('折叠:toggle 后只剩头部一行(store.expanded=false 持久化),再展开恢复全部内容', () => {
    useGoalStore.setState({ goal: makeGoal() })
    const view = render(<GoalCard />)
    expect(screen.getByTestId('goal-card-body')).toBeTruthy()
    fireEvent.click(screen.getByTestId('goal-collapse-toggle'))
    expect(useGoalStore.getState().expanded).toBe(false)
    // 折叠态:进度/阻塞/操作区都不在,头部(徽章 + 开关)仍在
    expect(screen.queryByTestId('goal-card-body')).toBeNull()
    expect(screen.getByTestId('goal-status-badge')).toBeTruthy()
    expect(screen.getByTestId('goal-collapse-toggle').getAttribute('aria-expanded')).toBe('false')
    // 重挂载后仍折叠(持久化态生效,而非组件内易失 state)
    view.rerender(<GoalCard />)
    expect(useGoalStore.getState().expanded).toBe(false)
    expect(screen.queryByTestId('goal-card-body')).toBeNull()
    // 再展开
    fireEvent.click(screen.getByTestId('goal-collapse-toggle'))
    expect(useGoalStore.getState().expanded).toBe(true)
    expect(screen.getByTestId('goal-card-body')).toBeTruthy()
  })

  it('与 D89 ③ 兼容:默认展开时 done 态成就耗时条照常渲染', () => {
    useGoalStore.setState({
      goal: makeGoal({ status: 'done', createdAt: 1_000_000, updatedAt: 1_095_000 }),
    })
    render(<GoalCard />)
    expect(screen.getByTestId('goal-achieved-time')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
