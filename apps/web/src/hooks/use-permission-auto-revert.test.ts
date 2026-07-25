import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  activeWorkspace: {
    value: { mode: 'default', path: '/test' } as { mode: string; path: string } | null,
  },
  setActiveWorkspace: vi.fn(),
  switchPermissionMode: vi.fn(),
  toast: vi.fn(),
  toastSuccess: vi.fn(),
  t: vi.fn(),
  updateLatestRecordSource: vi.fn(),
}))

vi.mock('@/stores/ai-panel', () => ({
  useAiPanelStore: Object.assign(
    vi.fn((selector: (s: { activeWorkspace: { mode: string; path: string } | null }) => unknown) =>
      selector({ activeWorkspace: mocks.activeWorkspace.value }),
    ),
    {
      getState: () => ({
        activeWorkspace: mocks.activeWorkspace.value,
        setActiveWorkspace: mocks.setActiveWorkspace,
      }),
    },
  ),
}))

vi.mock('@/components/ai/permission-mode-popover', () => ({
  switchPermissionMode: mocks.switchPermissionMode,
}))

vi.mock('sonner', () => ({
  toast: Object.assign(mocks.toast, { success: mocks.toastSuccess }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => mocks.t,
}))

vi.mock('@/lib/permission-mode-history', () => ({
  updateLatestRecordSource: mocks.updateLatestRecordSource,
}))

import {
  usePermissionAutoRevert,
  formatRemaining,
  __AUTO_REVERT_STORAGE_KEY__,
} from './use-permission-auto-revert'

const STORAGE_KEY = __AUTO_REVERT_STORAGE_KEY__
const ONE_HOUR = 60 * 60 * 1000

describe('usePermissionAutoRevert', () => {
  let unmountFn: (() => void) | null = null
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.activeWorkspace.value = { mode: 'default', path: '/test' }
    mocks.t.mockImplementation((key: string) => key)
    mocks.switchPermissionMode.mockResolvedValue({ ok: true })
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    if (unmountFn) {
      unmountFn()
      unmountFn = null
    }
    consoleLogSpy?.mockRestore()
    consoleWarnSpy?.mockRestore()
  })

  it('场景 1: bypass-permissions 模式 → 启动倒计时并写入 localStorage record', async () => {
    mocks.activeWorkspace.value = { mode: 'bypass-permissions', path: '/test' }

    const { result, unmount } = renderHook(() => usePermissionAutoRevert(ONE_HOUR))
    unmountFn = unmount

    await waitFor(() => {
      expect(result.current.isActive).toBe(true)
    })

    expect(result.current.remainingMs).toBeGreaterThan(0)
    expect(result.current.startedAt).not.toBeNull()

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const record = JSON.parse(raw!)
    expect(record.workspacePath).toBe('/test')
    expect(record.durationMs).toBe(ONE_HOUR)
    expect(typeof record.startedAt).toBe('number')
    expect(typeof record.version).toBe('number')
  })

  it('场景 2: default 模式 → 无倒计时,startedAt 为 null', async () => {
    mocks.activeWorkspace.value = { mode: 'default', path: '/test' }

    const { result, unmount } = renderHook(() => usePermissionAutoRevert(ONE_HOUR))
    unmountFn = unmount

    await waitFor(() => {
      expect(result.current.isActive).toBe(false)
    })

    expect(result.current.remainingMs).toBe(0)
    expect(result.current.startedAt).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('场景 3: expired record + 刷新场景 → 自动切回 default + toast + 清除 localStorage', async () => {
    const expiredRecord = {
      startedAt: Date.now() - 2 * ONE_HOUR,
      durationMs: ONE_HOUR,
      workspacePath: '/test',
      version: 1,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expiredRecord))

    mocks.activeWorkspace.value = { mode: 'bypass-permissions', path: '/test' }

    const { result, unmount } = renderHook(() => usePermissionAutoRevert(ONE_HOUR))
    unmountFn = unmount

    await waitFor(() => {
      expect(mocks.setActiveWorkspace).toHaveBeenCalled()
    })

    expect(mocks.setActiveWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'default' }),
    )
    expect(mocks.toast).toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    await waitFor(() => {
      expect(result.current.isActive).toBe(false)
    })
    expect(result.current.remainingMs).toBe(0)
  })

  it('场景 4: cross-workspace expired record → 不自动切回,record 被新工作区覆盖', async () => {
    const expiredRecord = {
      startedAt: Date.now() - 2 * ONE_HOUR,
      durationMs: ONE_HOUR,
      workspacePath: '/other',
      version: 1,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expiredRecord))

    mocks.activeWorkspace.value = { mode: 'bypass-permissions', path: '/test' }

    const { result, unmount } = renderHook(() => usePermissionAutoRevert(ONE_HOUR))
    unmountFn = unmount

    await waitFor(() => {
      expect(result.current.isActive).toBe(true)
    })

    expect(mocks.setActiveWorkspace).not.toHaveBeenCalled()

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const record = JSON.parse(raw!)
    expect(record.workspacePath).toBe('/test')
  })

  it('formatRemaining: 边界值与格式化', () => {
    expect(formatRemaining(0)).toBe('00:00')
    expect(formatRemaining(-100)).toBe('00:00')
    expect(formatRemaining(1000)).toBe('00:01')
    expect(formatRemaining(5 * 60 * 1000)).toBe('05:00')
    expect(formatRemaining(59 * 60 * 1000 + 59 * 1000)).toBe('59:59')
    expect(formatRemaining(ONE_HOUR)).toBe('1:00:00')
    expect(formatRemaining(90 * 60 * 1000)).toBe('1:30:00')
  })
})
