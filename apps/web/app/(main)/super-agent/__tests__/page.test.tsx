// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// RP-43：web 工单面板的判据闸。
// 覆盖：列表渲染、空态、读失败态、权限不足态、停单动作、确认记账动作、详情内容。
import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

vi.mock('@ihui/api-client', () => ({
  getSuperAgentPanel: vi.fn(),
  stopSuperAgentTicket: vi.fn(),
  acceptSuperAgentRecorded: vi.fn(),
  getSuperAgentTicketAssignment: vi.fn(),
  getSuperAgentTicketLease: vi.fn(),
}))

import type { SuperAgentPanelTicket, SuperAgentPanelView } from '@ihui/api-client'
import {
  acceptSuperAgentRecorded,
  getSuperAgentPanel,
  getSuperAgentTicketAssignment,
  getSuperAgentTicketLease,
  stopSuperAgentTicket,
} from '@ihui/api-client'
import SuperAgentPanelPage from '../page'

const mockedPanel = vi.mocked(getSuperAgentPanel)
const mockedStop = vi.mocked(stopSuperAgentTicket)
const mockedAccept = vi.mocked(acceptSuperAgentRecorded)
const mockedAssignment = vi.mocked(getSuperAgentTicketAssignment)
const mockedLease = vi.mocked(getSuperAgentTicketLease)

function ticket(overrides: Partial<SuperAgentPanelTicket> = {}): SuperAgentPanelTicket {
  return {
    ticketId: 't-1',
    sourceId: 'web',
    scope: '给工单加面板',
    strength: 'explicit',
    createdAt: 1_700_000_000_000,
    ownerUserId: 'user-a',
    stage: { stage: 'person', action: 'review' },
    sessionId: 'session-1',
    directory: '/work/ticket-1',
    assignment: { id: 'assign-1', state: 'running' },
    report: { state: 'ready', text: '面板已可用' },
    attention: null,
    deliveryError: null,
    ended: null,
    inputs: [{ triggerId: 'tr-1', text: '给工单加面板', fromPerson: true }],
    leaseLostAt: null,
    lostLeaseCount: 0,
    ...overrides,
  }
}

function panel(overrides: Partial<SuperAgentPanelView> = {}): SuperAgentPanelView {
  return {
    needsPerson: [],
    tickets: [ticket()],
    quietDrops: 0,
    recorded: 0,
    pendingRecords: [],
    ...overrides,
  }
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <SuperAgentPanelPage />
    </QueryClientProvider>,
  )
}

function httpError(status: number, message = '请求失败'): Error {
  return Object.assign(new Error(message), { name: 'ApiError', status })
}

beforeEach(() => {
  mockedPanel.mockReset()
  mockedStop.mockReset()
  mockedAccept.mockReset()
  mockedAssignment.mockReset()
  mockedLease.mockReset()
  mockedAssignment.mockResolvedValue({
    sessionId: 'session-1',
    directory: '/work/ticket-1',
    goal: '把面板做出来',
    constraints: '不碰主工作区',
    deliverables: '页面上线',
    role: 'worker',
  })
  mockedLease.mockResolvedValue({ remainingMs: 5_000, lostLeaseCount: 0, leaseLostAt: null })
})

afterEach(() => {
  cleanup()
})

describe('超级智能体 web 工单面板', () => {
  it('列表渲染状态、领域、创建时间、所属主体与进度', async () => {
    mockedPanel.mockResolvedValue(panel())

    renderPage()

    expect(await screen.findByTestId('ticket-row')).toBeTruthy()
    expect(screen.getByText('给工单加面板')).toBeTruthy()
    expect(screen.getByText('web')).toBeTruthy()
    expect(screen.getByText('user-a')).toBeTruthy()
    expect(screen.getByText('stagePersonReview')).toBeTruthy()
    expect(screen.getByText('assignmentRunning · reportReady')).toBeTruthy()
    expect(screen.getByTestId('ticket-row').getAttribute('data-stage')).toBe('person')
    expect(screen.queryByTestId('panel-empty')).toBeNull()
    expect(screen.queryByTestId('panel-error')).toBeNull()
  })

  it('真没有工单时画空态，不画错误态', async () => {
    mockedPanel.mockResolvedValue(panel({ tickets: [] }))

    renderPage()

    expect(await screen.findByTestId('panel-empty')).toBeTruthy()
    expect(screen.queryByTestId('ticket-row')).toBeNull()
    expect(screen.queryByTestId('panel-error')).toBeNull()
    expect(screen.queryByTestId('panel-auth')).toBeNull()
  })

  it('读失败时画错误态而不是空态，重试会重新请求', async () => {
    mockedPanel
      .mockRejectedValueOnce(httpError(500, 'upstream down'))
      .mockResolvedValueOnce(panel({ tickets: [] }))

    renderPage()

    expect(await screen.findByTestId('panel-error')).toBeTruthy()
    expect(screen.queryByTestId('panel-empty')).toBeNull()
    expect(screen.queryByTestId('ticket-row')).toBeNull()

    fireEvent.click(screen.getByText('retry'))

    expect(await screen.findByTestId('panel-empty')).toBeTruthy()
    await waitFor(() => expect(mockedPanel).toHaveBeenCalledTimes(2))
  })

  it('权限不足（401/403）单独画登录/无权限态', async () => {
    mockedPanel.mockRejectedValue(httpError(403, 'forbidden'))

    renderPage()

    expect(await screen.findByTestId('panel-auth')).toBeTruthy()
    expect(screen.queryByTestId('panel-error')).toBeNull()
    expect(screen.queryByTestId('panel-empty')).toBeNull()
    expect(screen.getByText('forbidden')).toBeTruthy()
  })

  it('详情展示触发内容、执行工人、收报与失败原因；停止动作只调真实接口', async () => {
    mockedPanel.mockResolvedValue(
      panel({ tickets: [ticket({ deliveryError: '派送失败：worker 不在线' })] }),
    )
    mockedStop.mockResolvedValue({ disposition: 'ignored', ticketId: 't-1' })

    renderPage()

    fireEvent.click(await screen.findByTestId('open-ticket'))

    expect(await screen.findByTestId('ticket-detail')).toBeTruthy()
    expect((await screen.findByTestId('detail-assignment')).textContent).toContain('把面板做出来')
    expect(screen.getByTestId('detail-report').textContent).toContain('面板已可用')
    expect(screen.getByText('派送失败：worker 不在线')).toBeTruthy()
    expect(screen.getByText(/session-1/)).toBeTruthy()
    expect(screen.getByText(/\/work\/ticket-1/)).toBeTruthy()

    fireEvent.click(screen.getByTestId('stop-ticket'))

    await waitFor(() => expect(mockedStop).toHaveBeenCalledWith('t-1'))
    await waitFor(() => expect(mockedPanel).toHaveBeenCalledTimes(2))
  })

  it('停止失败时给出动作错误，不静默吞掉', async () => {
    mockedPanel.mockResolvedValue(panel())
    mockedStop.mockRejectedValue(httpError(403, 'forbidden'))

    renderPage()

    fireEvent.click(await screen.findByTestId('open-ticket'))
    fireEvent.click(await screen.findByTestId('stop-ticket'))

    expect(await screen.findByTestId('action-error')).toBeTruthy()
    expect(screen.getByTestId('action-error').textContent).toContain('actionAuthFailed')
  })

  it('已结束的工单不画停止按钮', async () => {
    mockedPanel.mockResolvedValue(
      panel({
        tickets: [
          ticket({ stage: { stage: 'ended' }, ended: { by: 'person', outcome: '人叫停' } }),
        ],
      }),
    )

    renderPage()

    fireEvent.click(await screen.findByTestId('open-ticket'))
    await screen.findByTestId('ticket-detail')

    expect(screen.queryByTestId('stop-ticket')).toBeNull()
  })

  it('接单提案展示慢路径判定摘要，并能一键接受', async () => {
    mockedPanel.mockResolvedValue(
      panel({
        tickets: [],
        pendingRecords: [
          {
            id: 'tr-ok',
            text: '把草稿发出去',
            reason: '推断强度不足',
            decision: { verdict: 'act', reason: '方向已指定，建议接单', at: 1_700_000_000_000 },
          },
          { id: 'tr-no-decision', text: '没有判定注记', reason: '缺判定' },
        ],
      }),
    )
    mockedAccept.mockResolvedValue({ disposition: 'accepted', ticketId: 't-2' })

    renderPage()

    const buttons = await screen.findAllByTestId('accept-record')
    expect(buttons).toHaveLength(2)
    expect(screen.getAllByTestId('record-decision')[0]?.textContent).toContain('verdictAct')
    expect(screen.getAllByTestId('record-decision')[0]?.textContent).toContain(
      '方向已指定，建议接单',
    )

    fireEvent.click(buttons[0]!)

    await waitFor(() => expect(mockedAccept).toHaveBeenCalledWith('tr-ok', 'manual-panel-accept'))
  })
})
