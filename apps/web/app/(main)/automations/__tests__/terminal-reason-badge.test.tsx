// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-241 终态徽章 —— web 端(/automations)渲染测试。
 *
 * 覆盖:
 *  1. 有 terminalReason ⇒ 渲染终态徽章(四档成因各自出文案);
 *  2. 无 terminalReason(null)⇒ 不渲染终态徽章,列表保持原状(只有状态徽章);
 *  3. 取值不在封闭集内 ⇒ 不渲染终态徽章(未知不折成默认成因)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import type { UserAutomation } from '@ihui/api-client'

const { listAutomations } = vi.hoisted(() => ({
  listAutomations: vi.fn(),
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ihui/api-client')>()
  return {
    ...actual,
    listAutomations,
    updateAutomation: vi.fn(),
    deleteAutomation: vi.fn(),
    runAutomation: vi.fn(),
  }
})

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      'status.active': '启用中',
      'status.paused': '已暂停',
      'terminalReason.manualPause': '手动暂停',
      'terminalReason.failedPermanent': '永久失败',
      'terminalReason.failedRetriesExhausted': '重试次数已用尽',
      'terminalReason.completed': '已完成',
      loading: '加载中…',
      empty: '暂无自动化',
    }
    return map[key] ?? key
  },
}))

// 新建弹窗在本用例无关(只读渲染),替身避免拉起整条编辑链路
vi.mock('@/components/automations/automation-form-dialog', () => ({
  AutomationFormDialog: () => null,
}))

import { TooltipProvider } from '@/components/feedback'
import AutomationsPage from '../page'

function makeAutomation(overrides: Partial<UserAutomation>): UserAutomation {
  return {
    id: 'auto-1',
    userId: 'u-1',
    name: '每日简报',
    prompt: '总结今日新闻',
    scheduleType: 'recurring',
    rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
    scheduledAt: null,
    timezone: 'Asia/Shanghai',
    status: 'paused',
    terminalReason: null,
    claimToken: null,
    claimedAt: null,
    lastRunAt: null,
    nextRunAt: null,
    lastResult: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('G-241 终态徽章(web /automations)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    cleanup()
  })

  it('有 terminalReason ⇒ 渲染终态徽章(文案取 automations.terminalReason.* )', async () => {
    listAutomations.mockResolvedValue({
      total: 1,
      items: [makeAutomation({ terminalReason: 'failed_permanent' })],
    })

    render(
      <TooltipProvider>
        <AutomationsPage />
      </TooltipProvider>,
    )

    await waitFor(() => expect(screen.getByText('每日简报')).toBeTruthy())
    expect(screen.getByText('永久失败')).toBeTruthy()
    // 状态徽章仍在(不因为终态徽章而顶掉)
    expect(screen.getByText('已暂停')).toBeTruthy()
  })

  it('四档成因各自出对应文案', async () => {
    listAutomations.mockResolvedValue({
      total: 4,
      items: [
        makeAutomation({ id: 'a1', name: '任务一', terminalReason: 'manual_pause' }),
        makeAutomation({ id: 'a2', name: '任务二', terminalReason: 'failed_permanent' }),
        makeAutomation({
          id: 'a3',
          name: '任务三',
          terminalReason: 'failed_retries_exhausted',
        }),
        makeAutomation({ id: 'a4', name: '任务四', terminalReason: 'completed' }),
      ],
    })

    render(
      <TooltipProvider>
        <AutomationsPage />
      </TooltipProvider>,
    )

    await waitFor(() => expect(screen.getByText('任务四')).toBeTruthy())
    expect(screen.getByText('手动暂停')).toBeTruthy()
    expect(screen.getByText('永久失败')).toBeTruthy()
    expect(screen.getByText('重试次数已用尽')).toBeTruthy()
    expect(screen.getByText('已完成')).toBeTruthy()
  })

  it('无 terminalReason(null)⇒ 不渲染终态徽章,列表保持原状', async () => {
    listAutomations.mockResolvedValue({
      total: 1,
      items: [makeAutomation({ terminalReason: null })],
    })

    render(
      <TooltipProvider>
        <AutomationsPage />
      </TooltipProvider>,
    )

    await waitFor(() => expect(screen.getByText('每日简报')).toBeTruthy())
    expect(screen.queryByText('永久失败')).toBeNull()
    expect(screen.queryByText('手动暂停')).toBeNull()
    expect(screen.queryByText('已完成')).toBeNull()
    expect(screen.getByText('已暂停')).toBeTruthy()
  })

  it('取值不在封闭集内 ⇒ 不渲染终态徽章(未知不折成默认成因)', async () => {
    listAutomations.mockResolvedValue({
      total: 1,
      items: [
        makeAutomation({
          terminalReason: 'cancelled' as unknown as UserAutomation['terminalReason'],
        }),
      ],
    })

    render(
      <TooltipProvider>
        <AutomationsPage />
      </TooltipProvider>,
    )

    await waitFor(() => expect(screen.getByText('每日简报')).toBeTruthy())
    expect(screen.queryByText('永久失败')).toBeNull()
    expect(screen.queryByText('已完成')).toBeNull()
    expect(screen.getByText('已暂停')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
