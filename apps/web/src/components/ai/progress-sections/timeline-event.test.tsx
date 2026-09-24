// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// D55(G-66):stepDecision.* 用**真实词包**取词(其余命名空间保持"返回键名"的既有形态),
// 这样"界面上不该再出现 security_blocked 这类英文码"才是可断言的事实而不是自证。
vi.mock('next-intl', async () => {
  const { formatIcu } = await import('@ihui/i18n')
  const mod = (await import('@ihui/i18n/messages/shared/zh-CN.json')) as unknown as {
    default: Record<string, unknown>
  }
  const root = (mod.default ?? (mod as unknown as Record<string, unknown>)).stepDecision
  const lookup = (key: string): string => {
    let cur: unknown = root
    for (const seg of key.split('.')) {
      if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[seg]
      } else {
        return key
      }
    }
    return typeof cur === 'string' ? cur : key
  }
  return {
    useTranslations: () => (key: string, values?: Record<string, string | number>) =>
      values ? formatIcu(lookup(key), values, { locale: 'zh-CN' }) : lookup(key),
  }
})
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
    // D55:决策必须显示本地化文案,英文码不得再喷给用户(态归 approved → 着色也钉住)
    const badge = screen.getByTestId('timeline-evidence-decision')
    expect(badge.textContent).toContain('已执行')
    expect(badge.textContent).not.toContain('execute_tool')
    expect(badge.querySelector('[data-decision-state="approved"]')).toBeTruthy()
  })

  it('未知决策取值:原样显示且不编造文案', async () => {
    render(<TimelineEventRow event={{ ...baseEvent, meta: { decision: 'brand_new_decision' } }} />)
    fireEvent.click(screen.getByTestId('timeline-event-toggle'))
    const badge = await waitFor(() => screen.getByTestId('timeline-evidence-decision'))
    expect(badge.textContent).toContain('brand_new_decision')
    expect(badge.querySelector('[data-decision-state="unknown"]')).toBeTruthy()
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

  // D55(G-66) 四态各一用例:approved / rejected / needsUser / unknown。
  // 徽章 = meta.decision 经 stepDecisionLabel 归并(state) + 真实词包取词(text);
  // unknown 态必须原样显示未知码,绝不编造文案。
  const d55Cases = [
    { code: 'auto_skip_approval', state: 'approved', label: '自动批准(免审批)' },
    { code: 'security_blocked', state: 'rejected', label: '被安全策略拦截' },
    { code: 'approval_policy_always', state: 'needsUser', label: '策略要求审批' },
    { code: 'mystery_decision_code', state: 'unknown', label: 'mystery_decision_code' },
  ] as const
  it.each(d55Cases)('D55 决策徽章 $state 态:$code → $label', ({ code, state, label }) => {
    render(
      <TimelineEventRow
        event={{
          ...baseEvent,
          meta: { decision: code, reason: '低风险只读操作' },
        }}
      />,
    )
    fireEvent.click(screen.getByTestId('timeline-event-toggle'))
    const badge = screen.getByTestId('timeline-evidence-decision')
    const span = badge.querySelector('[data-decision-state]') as HTMLElement | null
    expect(span).not.toBeNull()
    expect(span!.getAttribute('data-decision-state')).toBe(state)
    expect(span!.textContent).toBe(label)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
