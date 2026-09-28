// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen } from '@testing-library/react'

/**
 * 看板卡片的"终态次级标记"渲染对账(2026-09-28 拍板:六档状态枚举不动,只加次级标记)。
 *
 * next-intl 的桩**故意回显键名** —— 于是断言到的字符串就是卡片实际取用的键末段:
 * 若端内自己再拼一份键表、或从 @ihui/types 取键时切错段,这里会看到完整点号键或 `undefined`,
 * 而不是恰好消失。三例分别钉"有终态必须出标""无终态不得凭空出标""三档各取到自己的键"。
 */
vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/feedback/Tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/common/CenteredText', () => ({
  CenteredText: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { KanbanTaskCard } from '../KanbanTaskCard'
import type { KanbanTask, AgentTaskTermination } from '@ihui/types'

function taskWith(over: Partial<KanbanTask>): KanbanTask {
  return {
    id: 'task-1',
    name: '跑一次数据校验',
    status: 'blocked',
    priority: 0,
    payload: {},
    createdAt: '2026-09-28T00:00:00.000Z',
    updatedAt: '2026-09-28T01:00:00.000Z',
    ...over,
  } as KanbanTask
}

afterEach(() => {
  cleanup()
})

describe('KanbanTaskCard / 终态次级标记', () => {
  const cases: Array<[AgentTaskTermination, string]> = [
    ['cancelled', 'terminatedCancelled'],
    ['quota_exceeded', 'terminatedQuotaExceeded'],
    ['preempted', 'terminatedPreempted'],
  ]

  it.each(cases)('%s ⇒ 卡片点名该终态(取到的是键末段,不是点号全键)', (termination, leaf) => {
    render(<KanbanTaskCard task={taskWith({ termination })} onSelect={() => {}} />)
    const badge = screen.queryByTestId(`kanban-termination-${termination}`)
    expect(badge, `${termination} 应当出标却没出`).not.toBeNull()
    expect(badge?.textContent).toBe(leaf)
  })

  it('真·阻塞(没有终态成因)不得凭空长出一枚标记', () => {
    render(<KanbanTaskCard task={taskWith({})} onSelect={() => {}} />)
    for (const [, leaf] of cases) {
      expect(screen.queryByText(leaf), `无终态却出现了 ${leaf}`).toBeNull()
    }
    expect(document.querySelector('[data-testid^="kanban-termination-"]')).toBeNull()
  })

  it('状态主徽章仍在(次级标记是补,不是替换)', () => {
    render(<KanbanTaskCard task={taskWith({ termination: 'cancelled' })} onSelect={() => {}} />)
    expect(screen.queryByText('blocked')).not.toBeNull()
    expect(screen.queryByText('terminatedCancelled')).not.toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
