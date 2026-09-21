// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/stores/ide-workspace', () => ({
  useIDEWorkspace: (selector: (state: { workspacePath: string }) => string) =>
    selector({ workspacePath: 'G:/repo' }),
}))
vi.mock('@ihui/api-client', () => ({
  rollbackCheckpoint: vi.fn(async () => ({ success: true, data: { rolled: true } })),
}))

import { useTimelineStore } from '@/stores/timeline-store'
import { TimelineEventRow } from './timeline-event'
import { rollbackCheckpoint } from '@ihui/api-client'

const baseEvent = {
  id: 'event-1',
  type: 'tool' as const,
  timestamp: new Date().toISOString(),
  title: 'edit_file',
  status: 'done' as const,
}

describe('TimelineEventRow evidence details', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
    useTimelineStore.getState().reset()
  })

  it('renders decision, reason, diff, test, and rollback control after expanding', async () => {
    render(
      <TimelineEventRow
        event={{
          ...baseEvent,
          meta: {
            decision: 'execute_tool',
            reason: '修复空指针',
            diff: { path: 'src/app.py', before: 'old', after: 'new' },
            test: { command: 'pytest', exit_code: 0, passed: 10, failed: 0 },
            rollback: { checkpoint_id: 'cp-1', available: true },
          },
        }}
      />,
    )
    await waitFor(() => expect(screen.getByTestId('timeline-event-row')).toBeTruthy())
    fireEvent.click(screen.getByTestId('timeline-event-toggle'))
    await waitFor(() => expect(screen.getByTestId('timeline-evidence-details')).toBeTruthy())
    expect(screen.getByTestId('timeline-evidence-diff')).toBeTruthy()
    expect(screen.getByTestId('timeline-evidence-test')).toBeTruthy()
    expect(screen.getByTestId('timeline-evidence-rollback')).toBeTruthy()
  })

  it('invokes rollback checkpoint API', async () => {
    render(
      <TimelineEventRow
        event={{
          ...baseEvent,
          meta: { rollback: { checkpoint_id: 'cp-2', available: true } },
        }}
      />,
    )
    fireEvent.click(screen.getByTestId('timeline-event-toggle'))
    await waitFor(() => expect(screen.getByTestId('timeline-evidence-rollback')).toBeTruthy())
    fireEvent.click(screen.getByTestId('timeline-evidence-rollback'))
    await waitFor(() =>
      expect(rollbackCheckpoint).toHaveBeenCalledWith({
        workspacePath: 'G:/repo',
        checkpointId: 'cp-2',
      }),
    )
    await waitFor(() => expect(screen.getByText('已回滚')).toBeTruthy())
  })

  it('renders patch baseline conflict previews after expanding', async () => {
    render(
      <TimelineEventRow
        event={{
          ...baseEvent,
          status: 'failed' as const,
          meta: {
            conflict: {
              code: 'PATCH_BASELINE_CONFLICT',
              path: 'src/app.py',
              current_preview: 'external change',
              expected_preview: 'agent baseline',
              rejected: true,
            },
          },
        }}
      />,
    )
    fireEvent.click(screen.getByTestId('timeline-event-toggle'))
    await waitFor(() => expect(screen.getByTestId('timeline-evidence-conflict')).toBeTruthy())
    expect(screen.getByText(/PATCH_BASELINE_CONFLICT/)).toBeTruthy()
    expect(screen.getByText(/已拒绝覆盖/)).toBeTruthy()
    expect(screen.getByText(/external change/)).toBeTruthy()
    expect(screen.getByText(/agent baseline/)).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
