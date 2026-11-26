// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌‌‌​‌‍‍​‌​​​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‍‍​‌​‌‌​‌‌‍‍​‌​​​​​‌‍‍​‌​​‌‌‌‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​​‌‌​‌​‍⁠

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@ihui/api-client', () => ({
  listBrowserCheckpointAttention: vi.fn(),
}))

import { listBrowserCheckpointAttention } from '@ihui/api-client'

import { BrowserCheckpointNotice } from '../browser-checkpoint-notice'

const waiting = {
  session_id: 'sess-1',
  task_id: 'task-1',
  goal: '提交报销单',
  url: 'https://example.com/confirm',
  title: '确认页',
  timed_out: false,
  phase: { phase: 'waiting', reason: 'checkpoint:确认提交' },
  checkpoint: {
    id: 'confirm',
    label: '确认提交',
    label_key: null,
    match: '/confirm',
    status: 'active' as const,
    entered_at: '2026-11-26T07:00:00Z',
    done_at: null,
    timed_out: false,
  },
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BrowserCheckpointNotice', () => {
  it('没有等待检查点时完全不占位', async () => {
    vi.mocked(listBrowserCheckpointAttention).mockResolvedValue({
      success: true,
      data: { sessions: [], count: 0 },
    })
    render(<BrowserCheckpointNotice />)
    await Promise.resolve()
    expect(screen.queryByTestId('browser-checkpoint-notice')).toBeNull()
  })

  it('有等待检查点时在对话区给出可点提示', async () => {
    vi.mocked(listBrowserCheckpointAttention).mockResolvedValue({
      success: true,
      data: { sessions: [waiting], count: 1 },
    })
    render(<BrowserCheckpointNotice />)
    expect(await screen.findByTestId('browser-checkpoint-notice')).toBeTruthy()
    expect(screen.getByText('checkpointChatTitle')).toBeTruthy()
    expect(screen.getByText('checkpointChatAction')).toBeTruthy()
  })

  it('超时与多会话时把补充状态一起展示', async () => {
    vi.mocked(listBrowserCheckpointAttention).mockResolvedValue({
      success: true,
      data: {
        sessions: [{ ...waiting, timed_out: true }, { ...waiting, session_id: 'sess-2' }],
        count: 2,
      },
    })
    render(<BrowserCheckpointNotice />)
    expect(await screen.findByTestId('browser-checkpoint-notice')).toBeTruthy()
    expect(screen.getByText('checkpointChatTimeout')).toBeTruthy()
    expect(screen.getByText('checkpointChatMore')).toBeTruthy()
  })

  it('画中画恢复该会话后对话提示立即撤掉', async () => {
    vi.mocked(listBrowserCheckpointAttention).mockResolvedValue({
      success: true,
      data: { sessions: [waiting], count: 1 },
    })
    render(<BrowserCheckpointNotice />)
    expect(await screen.findByTestId('browser-checkpoint-notice')).toBeTruthy()
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('ihui:browser-checkpoint-resumed', {
          detail: { sessionId: waiting.session_id },
        }),
      )
    })
    expect(screen.queryByTestId('browser-checkpoint-notice')).toBeNull()
  })
})
