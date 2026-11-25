// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * useAutoAiPip 行为夹具(2026-11-25)。
 *
 * 钉死三条:
 * - 第一次列表是基线,旧会话不弹;
 * - 基线之后出现新 sessionId,且没有 ai-browser-pip 窗时才开;
 * - 已经有一扇监看窗时不抢会话(不能因为 B 新建就把用户正在看的 A 关掉)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

import type * as ApiClientModule from '@ihui/api-client'
import type * as TauriBridgeModule from '@/lib/tauri-bridge'

import { listBrowserSessions } from '@ihui/api-client'
import { openAiPipWindow } from '@/lib/tauri-bridge'
import { useAuthStore } from '@/stores/auth'
import { AI_PIP_AUTO_KEY, useAutoAiPip } from '../use-auto-ai-pip'

vi.mock('@ihui/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClientModule>()),
  listBrowserSessions: vi.fn(),
}))
vi.mock('@/lib/tauri-bridge', async (importOriginal) => ({
  ...(await importOriginal<typeof TauriBridgeModule>()),
  isTauri: () => true,
  openAiPipWindow: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@tauri-apps/api/window', () => ({
  getAllWindows: vi.fn().mockResolvedValue([]),
}))

const listMock = vi.mocked(listBrowserSessions)
const openMock = vi.mocked(openAiPipWindow)

function sessions(ids: string[]) {
  return { success: true as const, data: { session_ids: ids, count: ids.length } }
}

describe('useAutoAiPip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
    useAuthStore.setState({ token: 'test-token' })
    listMock.mockReset()
    openMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('首次列表只做基线，不为旧会话开窗', async () => {
    listMock.mockResolvedValueOnce(sessions(['old-a']))
    renderHook(() => useAutoAiPip())
    await vi.advanceTimersByTimeAsync(0)
    expect(openMock).not.toHaveBeenCalled()
  })

  it('基线之后出现新会话才开窗，并只开最新一个', async () => {
    listMock
      .mockResolvedValueOnce(sessions(['old-a']))
      .mockResolvedValueOnce(sessions(['old-a', 'new-b', 'new-c']))
    renderHook(() => useAutoAiPip())
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(4000)
    expect(openMock).toHaveBeenCalledTimes(1)
    expect(openMock).toHaveBeenCalledWith('new-c', 'test-token')
  })

  it('已有监看窗时不抢会话', async () => {
    listMock
      .mockResolvedValueOnce(sessions(['old-a']))
      .mockResolvedValueOnce(sessions(['old-a', 'new-b']))
    const { getAllWindows } = await import('@tauri-apps/api/window')
    vi.mocked(getAllWindows).mockResolvedValueOnce([
      { label: 'ai-browser-pip' },
    ] as unknown as Awaited<ReturnType<typeof getAllWindows>>)
    renderHook(() => useAutoAiPip())
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(4000)
    expect(openMock).not.toHaveBeenCalled()
  })

  it('用户关掉自动监看后只记基线，不开窗', async () => {
    window.localStorage.setItem(AI_PIP_AUTO_KEY, '0')
    listMock
      .mockResolvedValueOnce(sessions(['old-a']))
      .mockResolvedValueOnce(sessions(['old-a', 'new-b']))
    renderHook(() => useAutoAiPip())
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(4000)
    expect(openMock).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
