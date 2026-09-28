// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { render, cleanup, screen } from '@testing-library/react'
import React from 'react'

/**
 * 看板"未识别"档的呈现对账(2026-09-28 立)。
 *
 * 口径:库里被写进六档之外的状态值 ⇒ 一律落"未识别"这一档并只报数 ——
 * 不得静默当成某个已知档(含"完成/失败"),也不得把原始值当可信文案渲染(文案位即注入面)。
 * 依据:AGENTS §30「钩子无终态不得渲染成"完成"」。
 *
 * next-intl 的桩**故意回显键名**,于是断言到的字符串就是卡片实际取用的键末段:
 * 卡片若退回 `t(task.status)`(未识别时等于把原值当文案)或自拼第二份键表,
 * 这里看到的就不是 'unrecognizedStatus' 而是那个外部写入的原值。
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
import type { KanbanTask } from '@ihui/types'

const UNKNOWN_RAW = 'zombie_state'

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

describe('KanbanTaskCard / 未识别档', () => {
  it('rawStatus 在位 ⇒ 独立徽章"未识别",且原值不进可见文案', () => {
    render(
      <KanbanTaskCard
        task={taskWith({ status: UNKNOWN_RAW as KanbanTask['status'], rawStatus: UNKNOWN_RAW })}
        onSelect={() => {}}
      />,
    )
    const badge = screen.queryByTestId('kanban-status-unrecognized')
    expect(badge, '未识别状态却没有任何呈现').not.toBeNull()
    // 文案位取的是键末段,不是数据库里那个外部可写的值
    expect(badge?.textContent).toBe('unrecognizedStatus')
    expect(badge?.textContent).not.toContain(UNKNOWN_RAW)
    expect(badge?.getAttribute('data-unrecognized-status')).toBe(UNKNOWN_RAW)
    // 原值只在无障碍名称里给出(可读、可问责,但不进界面文案位)
    expect(badge?.getAttribute('aria-label')).toContain(UNKNOWN_RAW)
  })

  it('未识别档不得被读成终态,也不得借用任何已知档文案', () => {
    render(
      <KanbanTaskCard
        task={taskWith({ status: UNKNOWN_RAW as KanbanTask['status'], rawStatus: UNKNOWN_RAW })}
        onSelect={() => {}}
      />,
    )
    // COLLAPSED_TERMINATIONS 之外的值不得凭空长出一枚终态标记(那等于猜一个结论)
    expect(document.querySelector('[data-testid^="kanban-termination-"]')).toBeNull()
    for (const known of ['done', 'blocked', 'triage', 'todo', 'ready', 'in_progress']) {
      expect(screen.queryByText(known), `未识别项被显示成已知档 ${known}`).toBeNull()
    }
  })

  it('已知状态一律不受影响(没有 rawStatus 就没有未识别呈现)', () => {
    render(<KanbanTaskCard task={taskWith({ status: 'done' })} onSelect={() => {}} />)
    expect(screen.queryByTestId('kanban-status-unrecognized')).toBeNull()
    expect(screen.queryByText('done')).not.toBeNull()
    expect(screen.queryByText('unrecognizedStatus')).toBeNull()
  })

  it('legacy 归一后的已知档同样不带未识别呈现', () => {
    // cancelled 经 mapStatus 归一为 blocked 并带终态标记 —— 它不是未识别档
    render(
      <KanbanTaskCard
        task={taskWith({ status: 'blocked', termination: 'cancelled' })}
        onSelect={() => {}}
      />,
    )
    expect(screen.queryByTestId('kanban-status-unrecognized')).toBeNull()
    expect(screen.queryByTestId('kanban-termination-cancelled')).not.toBeNull()
  })
})

describe('KanbanBoard / 未识别计数接线(造好必须装车)', () => {
  const boardSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/agents/KanbanBoard.tsx'),
    'utf-8',
  )

  it('看板确实消费共享计数出口与共享键,而不是在端内另写一份', () => {
    expect(boardSrc).toContain('countUnrecognizedTasks')
    expect(boardSrc).toContain('UNRECOGNIZED_STATUS_LABEL_KEY')
    expect(boardSrc).toContain('i18nLeafKey')
    // 端内不得再抄一份键名字面量(第二份真相过期时界面只显示键名)
    expect(boardSrc).not.toContain("'unrecognizedStatus'")
  })

  it('计数条有可问责的 testid,且只在计数 >0 时呈现(0 不得伪装成"已核过")', () => {
    expect(boardSrc).toContain('kanban-unrecognized-count')
    expect(boardSrc).toContain('kanban-unrecognized-summary')
    expect(boardSrc).toContain('unrecognizedCount > 0')
  })

  it('未识别项不得被塞进任何已知列:看板仍只按 AGENT_TASK_STATUSES 组列', () => {
    expect(boardSrc).toContain('const COLUMN_STATUSES = AGENT_TASK_STATUSES')
    // 计数与列分家:未识别走 unrecognizedCount,不进 COLUMN_STATUSES 的某一列
    expect(boardSrc).not.toMatch(/COLUMN_STATUSES\s*=\s*\[[^\]]*unrecognized/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
