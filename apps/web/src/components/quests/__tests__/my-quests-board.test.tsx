// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { fireEvent, render, cleanup, screen } from '@testing-library/react'

// 票77(2026-10-18):MyQuestsBoard 组件面单测。
// 覆盖:空态、汇总计数条、跨 workspace 分组、最近评估展示、手动自评估回路。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: { count?: number; [k: string]: unknown }) => {
    if (key === 'total') return `共 ${params?.count} 个任务`
    return key
  },
}))

import { useQuestsStore, type QuestEntry } from '@/stores/quests'
import { MyQuestsBoard } from '../my-quests-board'

function seedEntry(partial: Partial<QuestEntry>): QuestEntry {
  return {
    goalId: 'goal-1',
    text: '完成票77',
    status: 'active',
    progress: 40,
    workspaceId: '',
    createdAt: 1_000,
    updatedAt: 2_000,
    assessments: [
      { id: 'qa-1', at: 1_500, status: 'active', progress: 40, summary: '', source: 'auto' },
    ],
    ...partial,
  }
}

function board(): HTMLElement {
  return render(<MyQuestsBoard />).container
}
void board

describe('MyQuestsBoard', () => {
  beforeEach(() => {
    useQuestsStore.setState({ entries: {} })
  })

  afterEach(() => {
    cleanup()
    useQuestsStore.setState({ entries: {} })
  })

  it('无登记条目:渲染空态', () => {
    render(<MyQuestsBoard />)
    expect(screen.getByTestId('my-quests-empty')).toBeTruthy()
    expect(screen.getByTestId('my-quests-total').textContent).toContain('共 0 个任务')
  })

  it('有条目:汇总计数 + 分组 + 最近评估(auto 空结论念 noAssessment)', () => {
    useQuestsStore.setState({
      entries: {
        'goal-1': seedEntry({}),
        'goal-2': seedEntry({
          goalId: 'goal-2',
          text: '服务端聚合端点',
          status: 'blocked',
          progress: 10,
          workspaceId: 'ws-9',
          assessments: [
            { id: 'qa-2', at: 1_600, status: 'blocked', progress: 10, summary: '端点未接', source: 'manual' },
          ],
        }),
      },
    })
    render(<MyQuestsBoard />)
    expect(screen.getByTestId('my-quests-total').textContent).toContain('共 2 个任务')
    expect(screen.getByTestId('my-quests-count-active').textContent).toContain('× 1')
    expect(screen.getByTestId('my-quests-count-blocked').textContent).toContain('× 1')
    // 空 workspaceId 组排最前,标签走 currentWorkspace
    expect(screen.getByText('currentWorkspace')).toBeTruthy()
    expect(screen.getByText('ws-9')).toBeTruthy()
    expect(screen.getByTestId('my-quests-latest-goal-1').textContent).toContain('noAssessment')
    expect(screen.getByTestId('my-quests-latest-goal-2').textContent).toContain('端点未接')
    expect(screen.getByTestId('my-quests-progress-goal-2').textContent).toBe('10%')
  })

  it('手动自评估回路:输入 + 提交 → manual 条目成为最近评估,草稿清空', () => {
    useQuestsStore.setState({ entries: { 'goal-1': seedEntry({}) } })
    render(<MyQuestsBoard />)
    const input = screen.getByTestId('my-quests-assess-input-goal-1') as HTMLInputElement
    fireEvent.change(input, { target: { value: '自评估:数据模型与看板已装车' } })
    fireEvent.click(screen.getByTestId('my-quests-assess-add-goal-1'))
    const entry = useQuestsStore.getState().entries['goal-1']!
    expect(entry.assessments).toHaveLength(2)
    expect(entry.assessments[1]).toMatchObject({
      summary: '自评估:数据模型与看板已装车',
      source: 'manual',
      status: 'active',
      progress: 40,
    })
    expect(screen.getByTestId('my-quests-latest-goal-1').textContent).toContain(
      '自评估:数据模型与看板已装车',
    )
    expect((screen.getByTestId('my-quests-assess-input-goal-1') as HTMLInputElement).value).toBe('')
  })

  it('空草稿提交不产生条目', () => {
    useQuestsStore.setState({ entries: { 'goal-1': seedEntry({}) } })
    render(<MyQuestsBoard />)
    fireEvent.click(screen.getByTestId('my-quests-assess-add-goal-1'))
    expect(useQuestsStore.getState().entries['goal-1']!.assessments).toHaveLength(1)
  })
})
