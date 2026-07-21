// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ─────────────────────────────────────────────────────────────
// Mock fetchApi:通过 fetchApiMock 控制返回值
// ─────────────────────────────────────────────────────────────
const fetchApiMock = vi.fn()
vi.mock('@/lib/api', () => ({
  fetchApi: (...args: unknown[]) => fetchApiMock(...args),
}))

import { usePlugins } from '../use-plugins'

describe('usePlugins hook (插件市场前端状态管理 + 乐观更新 + 失败回滚)', () => {
  beforeEach(() => {
    fetchApiMock.mockReset()
    fetchApiMock.mockResolvedValue({ success: false, error: 'not mocked' })
  })

  // ─────────────────────────────────────────────────────────
  // 初始化 + refresh
  // ─────────────────────────────────────────────────────────
  it('首次挂载自动调用 GET /api/plugins/installed', async () => {
    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: { states: {}, authenticated: false },
    })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchApiMock).toHaveBeenCalledTimes(1)
    expect(fetchApiMock).toHaveBeenCalledWith('/api/plugins/installed')
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.states).toEqual({})
  })

  it('GET 成功 + 已登录 + 有数据 → states 更新 + isAuthenticated=true', async () => {
    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        states: {
          'playwright-mcp': { installedAt: '2026-07-22T10:00:00.000Z', pinned: true },
          'remotion': { installedAt: '2026-07-22T11:00:00.000Z', pinned: false },
        },
        authenticated: true,
      },
    })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isAuthenticated).toBe(true)
    expect(Object.keys(result.current.states)).toHaveLength(2)
    expect(result.current.isInstalled('playwright-mcp')).toBe(true)
    expect(result.current.isPinned('playwright-mcp')).toBe(true)
    expect(result.current.isPinned('remotion')).toBe(false)
    expect(result.current.getState('remotion')?.installedAt).toBe('2026-07-22T11:00:00.000Z')
    expect(result.current.getState('not-exist')).toBeNull()
  })

  it('GET 失败(网络异常) → states={} + isAuthenticated=false + isLoading=false', async () => {
    fetchApiMock.mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.states).toEqual({})
  })

  it('GET 返回 success=false → 重置为未认证态', async () => {
    fetchApiMock.mockResolvedValueOnce({ success: false, error: '401' })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.states).toEqual({})
  })

  it('refresh 手动触发再次 GET', async () => {
    fetchApiMock.mockResolvedValueOnce({ success: true, data: { states: {}, authenticated: false } })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        states: { x: { installedAt: '2026-07-22T00:00:00.000Z', pinned: false } },
        authenticated: true,
      },
    })
    await act(async () => {
      await result.current.refresh()
    })
    expect(fetchApiMock).toHaveBeenCalledTimes(2)
    expect(result.current.isInstalled('x')).toBe(true)
  })

  // ─────────────────────────────────────────────────────────
  // install (POST)
  // ─────────────────────────────────────────────────────────
  it('install 乐观更新 + POST 成功后用服务端数据校正', async () => {
    fetchApiMock.mockResolvedValueOnce({ success: true, data: { states: {}, authenticated: true } })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const serverState = { installedAt: '2026-07-22T10:00:00.000Z', pinned: false }
    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: { pluginId: 'playwright-mcp', state: serverState },
    })

    let ok = false
    await act(async () => {
      ok = await result.current.install('playwright-mcp', false)
    })
    expect(ok).toBe(true)
    expect(fetchApiMock).toHaveBeenLastCalledWith(
      '/api/plugins/playwright-mcp/install',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ pinned: false }),
      }),
    )
    expect(result.current.states['playwright-mcp']).toEqual(serverState)
  })

  it('install POST 失败 → 回滚到 prev state', async () => {
    fetchApiMock.mockResolvedValueOnce({ success: true, data: { states: {}, authenticated: true } })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchApiMock.mockResolvedValueOnce({ success: false, error: '500' })

    let ok = true
    await act(async () => {
      ok = await result.current.install('playwright-mcp', false)
    })
    expect(ok).toBe(false)
    expect(result.current.isInstalled('playwright-mcp')).toBe(false) // 回滚
  })

  it('install 保留已安装插件的 installedAt(再次 install 切换 pinned)', async () => {
    const originalTime = '2026-01-01T00:00:00.000Z'
    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        states: { x: { installedAt: originalTime, pinned: false } },
        authenticated: true,
      },
    })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        pluginId: 'x',
        state: { installedAt: originalTime, pinned: true },
      },
    })
    await act(async () => {
      await result.current.install('x', true)
    })
    expect(result.current.states['x']).toEqual({ installedAt: originalTime, pinned: true })
  })

  // ─────────────────────────────────────────────────────────
  // uninstall (DELETE)
  // ─────────────────────────────────────────────────────────
  it('uninstall 乐观移除 + DELETE 成功保持移除', async () => {
    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        states: { x: { installedAt: '2026-07-22T00:00:00.000Z', pinned: false } },
        authenticated: true,
      },
    })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isInstalled('x')).toBe(true)

    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: { pluginId: 'x', removed: true as const },
    })
    let ok = false
    await act(async () => {
      ok = await result.current.uninstall('x')
    })
    expect(ok).toBe(true)
    expect(fetchApiMock).toHaveBeenLastCalledWith('/api/plugins/x/install', {
      method: 'DELETE',
    })
    expect(result.current.isInstalled('x')).toBe(false)
  })

  it('uninstall DELETE 失败 → 回滚(插件恢复为已安装)', async () => {
    const prevState = { installedAt: '2026-07-22T00:00:00.000Z', pinned: true }
    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: { states: { x: prevState }, authenticated: true },
    })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchApiMock.mockResolvedValueOnce({ success: false, error: '500' })
    let ok = true
    await act(async () => {
      ok = await result.current.uninstall('x')
    })
    expect(ok).toBe(false)
    expect(result.current.isInstalled('x')).toBe(true) // 回滚
    expect(result.current.states['x']).toEqual(prevState) // 完整恢复(含 pinned)
  })

  // ─────────────────────────────────────────────────────────
  // togglePinned (PATCH)
  // ─────────────────────────────────────────────────────────
  it('togglePinned 未安装 → 返回 false,不调用 PATCH', async () => {
    fetchApiMock.mockResolvedValueOnce({ success: true, data: { states: {}, authenticated: true } })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let ok = true
    await act(async () => {
      ok = await result.current.togglePinned('not-installed')
    })
    expect(ok).toBe(false)
    expect(fetchApiMock).toHaveBeenCalledTimes(1) // 只有初始 GET
  })

  it('togglePinned 已安装 pinned=false → 切换为 true,乐观更新 + 服务端校正', async () => {
    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        states: { x: { installedAt: '2026-07-22T00:00:00.000Z', pinned: false } },
        authenticated: true,
      },
    })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        pluginId: 'x',
        state: { installedAt: '2026-07-22T00:00:00.000Z', pinned: true },
      },
    })
    let ok = false
    await act(async () => {
      ok = await result.current.togglePinned('x')
    })
    expect(ok).toBe(true)
    expect(fetchApiMock).toHaveBeenLastCalledWith('/api/plugins/x/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ pinned: true }),
    })
    expect(result.current.isPinned('x')).toBe(true)
  })

  it('togglePinned PATCH 失败 → 回滚', async () => {
    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        states: { x: { installedAt: '2026-07-22T00:00:00.000Z', pinned: false } },
        authenticated: true,
      },
    })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchApiMock.mockResolvedValueOnce({ success: false, error: '500' })
    let ok = true
    await act(async () => {
      ok = await result.current.togglePinned('x')
    })
    expect(ok).toBe(false)
    expect(result.current.isPinned('x')).toBe(false) // 回滚
  })

  // ─────────────────────────────────────────────────────────
  // toggleInstall (派生)
  // ─────────────────────────────────────────────────────────
  it('toggleInstall 未安装 → 调用 install', async () => {
    fetchApiMock.mockResolvedValueOnce({ success: true, data: { states: {}, authenticated: true } })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        pluginId: 'x',
        state: { installedAt: '2026-07-22T00:00:00.000Z', pinned: false },
      },
    })
    await act(async () => {
      await result.current.toggleInstall('x')
    })
    expect(fetchApiMock).toHaveBeenLastCalledWith(
      '/api/plugins/x/install',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.current.isInstalled('x')).toBe(true)
  })

  it('toggleInstall 已安装 → 调用 uninstall', async () => {
    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        states: { x: { installedAt: '2026-07-22T00:00:00.000Z', pinned: false } },
        authenticated: true,
      },
    })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: { pluginId: 'x', removed: true as const },
    })
    await act(async () => {
      await result.current.toggleInstall('x')
    })
    expect(fetchApiMock).toHaveBeenLastCalledWith('/api/plugins/x/install', {
      method: 'DELETE',
    })
    expect(result.current.isInstalled('x')).toBe(false)
  })

  // ─────────────────────────────────────────────────────────
  // 派生选择器
  // ─────────────────────────────────────────────────────────
  it('isInstalled / isPinned / getState 派生正确', async () => {
    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        states: {
          a: { installedAt: '2026-07-22T00:00:00.000Z', pinned: true },
          b: { installedAt: '2026-07-22T00:00:00.000Z', pinned: false },
        },
        authenticated: true,
      },
    })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.isInstalled('a')).toBe(true)
    expect(result.current.isInstalled('b')).toBe(true)
    expect(result.current.isInstalled('c')).toBe(false)
    expect(result.current.isPinned('a')).toBe(true)
    expect(result.current.isPinned('b')).toBe(false)
    expect(result.current.isPinned('c')).toBe(false)
    expect(result.current.getState('a')?.pinned).toBe(true)
    expect(result.current.getState('c')).toBeNull()
  })
})
