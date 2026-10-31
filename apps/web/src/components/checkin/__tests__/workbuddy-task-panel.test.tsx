// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WorkbuddyTaskPanel } from '../WorkbuddyTaskPanel'

/**
 * 「自动做任务」面板契约测试。
 *
 * 钉死三件事(都是踩过的真实风险):
 * 1. 无 WorkBuddy 账号 ⇒ 自判空,不发任何请求(不外泄空态、不打空 id);
 * 2. 「一键做任务」发的是 `kind='all'` + `dry_run=false`,预演发 `dry_run=true`
 *    —— 顺序由后端 SWEEP_ORDER 单一真源决定,面板不得自行拼六次请求;
 * 3. 结果原样呈现 accepted/claimed/unjudged,不把 unjudged 冒充成功。
 */

const fetchAiServiceJson = vi.fn()

vi.mock('@/lib/api', () => ({
  fetchAiServiceJson: (...args: unknown[]) => fetchAiServiceJson(...args),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// ui-react 的 log-viewer 也引 lucide 图标 ⇒ 必须 spread 实际模块,只覆盖本组件用到的几个。
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const Icon = () => <span data-testid="icon" />
  return {
    ...actual,
    ChevronDown: Icon,
    ListChecks: Icon,
    Loader2: Icon,
    PlayCircle: Icon,
    RefreshCw: Icon,
  }
})

const ACCOUNTS = [
  { id: 7, name: '192****0269', platform: 'workbuddy', enabled: true },
  { id: 9, name: 'trae-acc', platform: 'trae', enabled: true },
]

beforeEach(() => {
  fetchAiServiceJson.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('WorkbuddyTaskPanel', () => {
  it('无 WorkBuddy 账号时自判空且零请求', () => {
    render(<WorkbuddyTaskPanel accounts={[ACCOUNTS[1]!]} />)
    expect(screen.getByText('taskPanelNoAccount')).toBeTruthy()
    expect(fetchAiServiceJson).not.toHaveBeenCalled()
  })

  it('一键做任务发 kind=all + dry_run=false', async () => {
    fetchAiServiceJson.mockResolvedValue({
      success: true,
      data: {
        ok: true,
        kind: 'all',
        accepted: ['first_chat'],
        claimed: [],
        credit_delta: 0,
        reason: null,
        unjudged: false,
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)

    fireEvent.click(screen.getByText('taskPanelTitle'))
    fireEvent.click(screen.getByText('taskPanelRun'))

    await waitFor(() => expect(fetchAiServiceJson).toHaveBeenCalledTimes(1))
    const [path, init] = fetchAiServiceJson.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/api/checkin/accounts/7/task-run')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ kind: 'all', dry_run: false })
    await waitFor(() => expect(screen.getByText('taskPanelResult')).toBeTruthy())
  })

  it('预演发 dry_run=true,且不触发列表刷新', async () => {
    fetchAiServiceJson.mockResolvedValue({
      success: true,
      data: {
        ok: true,
        kind: 'all',
        accepted: [],
        claimed: [],
        credit_delta: null,
        reason: 'dry-run',
        unjudged: false,
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)

    fireEvent.click(screen.getByText('taskPanelTitle'))
    fireEvent.click(screen.getByText('taskPanelDryRun'))

    await waitFor(() => expect(fetchAiServiceJson).toHaveBeenCalledTimes(1))
    const [path, init] = fetchAiServiceJson.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/api/checkin/accounts/7/task-run')
    expect(JSON.parse(String(init.body))).toEqual({ kind: 'all', dry_run: true })
  })

  it('读取任务渲染真机行字段(任务码/状态),不伪造进度', async () => {
    fetchAiServiceJson.mockResolvedValue({
      success: true,
      data: {
        ok: true,
        kind: 'list',
        tasks: [
          {
            task_code: 'first_chat',
            title: '首次对话',
            status: 'available',
            progress: null,
            target: null,
            reward_credit: null,
          },
        ],
        reason: null,
        unjudged: false,
      },
    })
    render(<WorkbuddyTaskPanel accounts={ACCOUNTS} />)

    fireEvent.click(screen.getByText('taskPanelTitle'))
    fireEvent.click(screen.getByText('taskPanelList'))

    await waitFor(() => expect(screen.getByText('首次对话')).toBeTruthy())
    expect(screen.getByText('first_chat')).toBeTruthy()
    expect(screen.getByText('available')).toBeTruthy()
    expect(screen.queryByText('0/0')).toBeNull() // 上游不给 progress 就不显示
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
