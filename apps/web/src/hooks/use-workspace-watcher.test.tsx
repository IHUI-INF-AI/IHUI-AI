// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作区变更订阅判据(2026-11-23):
 * 首次事件必须经去抖后回调;`.git/` 噪声必须被过滤;卸载必须 remove 监听器。
 */

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceWatcher } from './use-workspace-watcher'
import * as api from '@ihui/api-client'

vi.mock('@ihui/api-client', () => ({
  createWorkspaceWatcher: vi.fn(),
  getWorkspaceWatcherEvents: vi.fn(),
  removeWorkspaceWatcher: vi.fn(),
}))

const create = vi.mocked(api.createWorkspaceWatcher)
const events = vi.mocked(api.getWorkspaceWatcherEvents)
const remove = vi.mocked(api.removeWorkspaceWatcher)

beforeEach(() => {
  vi.clearAllMocks()
  create.mockResolvedValue({
    success: true,
    data: { watcherId: 'w1', root: 'G:/repo', recursive: true },
  } as never)
  events.mockResolvedValueOnce({
    success: true,
    data: {
      events: [
        { seq: 1, type: 'change', path: '.git/index', at: 1 },
        { seq: 2, type: 'change', path: 'src/a.ts', at: 2 },
      ],
      nextCursor: 2,
      dropped: 0,
    },
  } as never)
  // 第二轮挂起:模拟长轮询等待,避免测试里出现忙循环
  events.mockImplementation(() => new Promise(() => {}) as never)
  remove.mockResolvedValue({ success: true, data: { removed: true } } as never)
})

describe('useWorkspaceWatcher', () => {
  it('过滤 .git 事件后回调真实变更,卸载时撤销监听', async () => {
    const onChange = vi.fn()
    const { unmount } = renderHook(() =>
      useWorkspaceWatcher({ workspacePath: 'G:/repo', onChange, debounceMs: 20 }),
    )

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1), { timeout: 2_000 })
    const batch = onChange.mock.calls[0]?.[0] as Array<{ path: string }>
    expect(batch.map((e) => e.path)).toEqual(['src/a.ts'])

    unmount()
    await waitFor(() => expect(remove).toHaveBeenCalledWith({ watcherId: 'w1' }))
  })

  it('未启用(面板不可见)时不创建监听器', async () => {
    renderHook(() =>
      useWorkspaceWatcher({ workspacePath: 'G:/repo', enabled: false, onChange: vi.fn() }),
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(create).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
