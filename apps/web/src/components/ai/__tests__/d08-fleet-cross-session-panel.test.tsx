// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D08 ③(2026-10-27):跨会话 Fleet 视图 —— 全量派单(/api/subagents/all)按状态分桶渲染
// + 空态。行内八态徽章判据仍由 BackgroundAgentsPanel→element-pack 承担,本测试只锁
// 「分组 + 计数徽章 + 空态」三格;不引入任何推送通道(票面禁新 SSE 帧族)。
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))
// next/link 在 jsdom 无 AppRouterContext,平替为 <a>(与 phase4 面板测试同款隔离)
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
// 通知副作用与 Tooltip portal 与本票无关,按既有面板测试同款平替隔离
vi.mock('@/hooks/use-background-agent-notify', () => ({
  useBackgroundAgentNotify: () => {},
}))
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const getAllSubagentDispatches = vi.fn()
const getSubagentStats = vi.fn()
vi.mock('@ihui/api-client', () => ({
  getAllSubagentDispatches: () => getAllSubagentDispatches(),
  getSubagentStats: () => getSubagentStats(),
}))

import { FleetCrossSessionPanel } from '../fleet-cross-session-panel'

type FakeDispatch = {
  id: string
  goal: string
  status: string
  affectedFiles: string[]
  createdAt: string
  updatedAt: string
  result?: string
  errorMessage?: string
  conversationId?: string
  metrics?: {
    totalTokens: number
    elapsedMs: number
    steps: Array<{
      agent: string
      status: 'ok' | 'failed' | 'quota_exceeded'
      durationMs: number
      attempt: number
      tokenUsage: { prompt: number; completion: number; total: number }
    }>
    dagDone?: number
    dagTotal?: number
  }
}

function makeDispatch(
  partial: Partial<FakeDispatch> & { id: string; status: string },
): FakeDispatch {
  return {
    goal: '跑个跨会话的活',
    affectedFiles: [],
    createdAt: '2026-10-27T00:00:00Z',
    updatedAt: '2026-10-27T00:00:00Z',
    ...partial,
  } as FakeDispatch
}

describe('D08 ③ 跨会话 Fleet 面板', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('按状态分桶渲染:运行/完成/失败三组各自成组,计数徽章报数,行徽章来自判定层', async () => {
    getAllSubagentDispatches.mockResolvedValue({
      dispatches: [
        makeDispatch({ id: 'r1', status: 'running' }),
        makeDispatch({ id: 'p1', status: 'pending' }),
        makeDispatch({ id: 'pa1', status: 'paused' }),
        makeDispatch({ id: 'c1', status: 'completed' }),
        makeDispatch({ id: 'f1', status: 'failed' }),
        makeDispatch({ id: 'x1', status: 'cancelled' }),
      ],
    })
    getSubagentStats.mockResolvedValue({ active: 3, completed: 1, failed: 1, totalTokens: 1234 })

    const { container } = render(<FleetCrossSessionPanel />)
    await waitFor(() => expect(screen.getByTestId('fleet-group-running')).toBeTruthy())

    // 三桶齐现,桶内成员与计数徽章逐桶对账
    for (const key of ['running', 'completed', 'failed'] as const) {
      expect(container.querySelector(`[data-testid="fleet-group-${key}"]`)).toBeTruthy()
    }
    const badges = (groupKey: string) =>
      [
        ...container
          .querySelector(`[data-testid="fleet-group-${groupKey}"]`)!
          .querySelectorAll('.tabular-nums'),
      ].map((el) => el.textContent)
    // 计数徽章(桶头)先于行内 tool_calls 出现;pending+running+paused 归运行桶
    expect(badges('running')[0]).toBe('3')
    expect(badges('completed')[0]).toBe('1')
    expect(badges('failed')[0]).toBe('2')

    // 行级状态徽章:判定层八态经 fromAgentStatus 归并(paused 非判定层输入,已在适配层归入 running)
    const row = container.querySelector('[data-testid="bg-task-state-pa1"]')
    expect(row).toBeTruthy()
    expect(row!.getAttribute('data-task-state')).toBe('running')

    // token 总量来自 stats(票面「token」格)
    expect(screen.getByText(/tokens: 1234/i)).toBeTruthy()
  })

  it('空态:全量派单为空时只出空态文案,不渲染任何分组', async () => {
    getAllSubagentDispatches.mockResolvedValue({ dispatches: [] })
    getSubagentStats.mockResolvedValue(null)

    const { container } = render(<FleetCrossSessionPanel />)
    await waitFor(() => expect(screen.getByText('empty')).toBeTruthy())
    expect(container.querySelectorAll('[data-testid^="fleet-group-"]').length).toBe(0)
  })

  it('进度/token/一键接管:metrics 与 conversationId 有值才渲染,取值逐格对账', async () => {
    getAllSubagentDispatches.mockResolvedValue({
      dispatches: [
        makeDispatch({
          id: 'r1',
          status: 'running',
          conversationId: 'conv-abc',
          metrics: {
            totalTokens: 512,
            elapsedMs: 1200,
            steps: [
              {
                agent: 'coder',
                status: 'ok',
                durationMs: 600,
                attempt: 1,
                tokenUsage: { prompt: 200, completion: 100, total: 300 },
              },
              {
                agent: 'reviewer',
                status: 'ok',
                durationMs: 600,
                attempt: 1,
                tokenUsage: { prompt: 100, completion: 112, total: 212 },
              },
            ],
            dagDone: 1,
            dagTotal: 3,
          },
        }),
      ],
    })
    getSubagentStats.mockResolvedValue({ active: 1, completed: 0, failed: 0 })

    render(<FleetCrossSessionPanel />)
    await waitFor(() => expect(screen.getByTestId('fleet-group-running')).toBeTruthy())

    // 逐 agent token(metrics.totalTokens 原值,不做估算)
    expect(screen.getByTestId('bg-task-tokens-r1').textContent).toBe('tokens 512')
    // 进度:steps 计数走既有「calls」文案;DAG 进度 1/3
    expect(screen.getByText('calls:{"count":2}')).toBeTruthy()
    expect(screen.getByText('1/3')).toBeTruthy()
    // 一键接管 = 既有 /chat?conversationId= 深链,不乱拼别的前缀
    const takeover = screen.getByTestId('bg-task-takeover-r1')
    expect(takeover.getAttribute('href')).toBe('/chat?conversationId=conv-abc')
    expect(takeover.textContent).toBe('takeover')
  })

  it('未判定不伪造:无 metrics / 无 conversationId 时不出 token、进度、接管三格', async () => {
    getAllSubagentDispatches.mockResolvedValue({
      dispatches: [makeDispatch({ id: 'r2', status: 'running' })],
    })
    getSubagentStats.mockResolvedValue(null)

    render(<FleetCrossSessionPanel />)
    await waitFor(() => expect(screen.getByTestId('fleet-group-running')).toBeTruthy())

    expect(screen.queryByTestId('bg-task-tokens-r2')).toBeNull()
    expect(screen.queryByTestId('bg-task-takeover-r2')).toBeNull()
    expect(screen.queryByText(/calls:/)).toBeNull()
  })

  it('终态不给接管入口:已完成派单即便带会话归属也只走「查看结果」', async () => {
    getAllSubagentDispatches.mockResolvedValue({
      dispatches: [makeDispatch({ id: 'c2', status: 'completed', conversationId: 'conv-xyz' })],
    })
    getSubagentStats.mockResolvedValue(null)

    render(<FleetCrossSessionPanel />)
    await waitFor(() => expect(screen.getByTestId('fleet-group-completed')).toBeTruthy())
    expect(screen.queryByTestId('bg-task-takeover-c2')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
