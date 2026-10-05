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
    // G-1018245(2026-10-05,用户拍板路 B):`failed` 由不在册改为在册。
    // 它进表时是四档里的第一档,顺序与 COLLAPSED_TERMINATIONS 逐字一致。
    ['failed', 'terminatedFailed'],
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

  /**
   * G-1018245 的靶心用例:`failed` 必须取到**自己**的键。
   *
   * 09-28 当年把 `failed` 排除出册的理由是「把真失败说成被取消,比不标更糟」——
   * 拍板路 B 让它入册,但这条理由仍然成立,所以实现上唯一可接受的形态是
   * `failed ⇒ terminatedFailed`。若有人图省事把 `TERMINATION_LABEL_KEYS.failed`
   * 指到 `terminatedCancelled`(两个键都在表里,不报错、测试也只查"出标了"),
   * 只有本例能抓到 —— 这正是"入册"与"入册且没说错话"的差别。
   */
  it('failed 取自己的键,不得复用 cancelled 的键(否则等于把真失败说成被取消)', () => {
    render(<KanbanTaskCard task={taskWith({ termination: 'failed' })} onSelect={() => {}} />)
    const badge = screen.queryByTestId('kanban-termination-failed')
    expect(badge?.textContent).toBe('terminatedFailed')
    expect(
      screen.queryByTestId('kanban-termination-cancelled'),
      'failed 不得长出 cancelled 的标记',
    ).toBeNull()
    expect(screen.queryByText('terminatedCancelled')).toBeNull()
  })

  /**
   * `failed` 与 `cancelled` 在库里都是"折叠进 blocked"的终态,但它们的下一步动作相反:
   * 前者要去读 errorMessage 查因、后者重跑大概率就好。两者同形就把用户指错了方向 ——
   * 这正是本票存在的理由,所以必须钉住"两张脸不重合"。
   */
  it('failed 与 cancelled 各自出标,互不串味(四档的键逐字不同)', () => {
    const { unmount } = render(
      <KanbanTaskCard task={taskWith({ termination: 'failed' })} onSelect={() => {}} />,
    )
    expect(screen.queryByText('terminatedFailed')).not.toBeNull()
    expect(screen.queryByText('terminatedCancelled')).toBeNull()
    unmount()

    render(<KanbanTaskCard task={taskWith({ termination: 'cancelled' })} onSelect={() => {}} />)
    expect(screen.queryByText('terminatedCancelled')).not.toBeNull()
    expect(screen.queryByText('terminatedFailed')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
