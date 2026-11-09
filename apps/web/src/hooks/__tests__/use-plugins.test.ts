// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ─────────────────────────────────────────────────────────────
// 2026-11-05:use-plugins 改走 @ihui/api-client 的端点函数(门 300 B 类:语义已在共享
// client,web 不再直拼 URL/body)。旧夹具 mock 的是 '@/lib/api' 的 fetchApi,改造后该导出
// 不再被消费 → fetchApiMock 恒 0 次,整份用例只剩"空断言"。这里改为 mock 五个端点函数,
// 断言语义从"URL + 手拼 body"上移到"端点 + 结构化入参"。
// ─────────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  getInstalledPlugins: vi.fn(),
  installPlugin: vi.fn(),
  uninstallPlugin: vi.fn(),
  updatePluginPreferences: vi.fn(),
  recordPluginClick: vi.fn(),
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, ...mocks }
})

import { usePlugins } from '../use-plugins'

describe('usePlugins hook (插件市场前端状态管理 + 乐观更新 + 失败回滚)', () => {
  beforeEach(() => {
    for (const fn of Object.values(mocks)) fn.mockReset()
    mocks.getInstalledPlugins.mockResolvedValue({ states: {}, authenticated: false })
    mocks.installPlugin.mockResolvedValue({ pluginId: 'x', state: { installedAt: '', pinned: false } })
    mocks.uninstallPlugin.mockResolvedValue({ pluginId: 'x', removed: true })
    mocks.updatePluginPreferences.mockResolvedValue({ pluginId: 'x', state: { installedAt: '', pinned: false } })
    mocks.recordPluginClick.mockResolvedValue({})
  })

  // ─────────────────────────────────────────────────────────
  // 初始化 + refresh
  // ─────────────────────────────────────────────────────────
  it('首次挂载自动调用 GET 已装插件端点', async () => {
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(mocks.getInstalledPlugins).toHaveBeenCalledTimes(1)
    expect(mocks.getInstalledPlugins).toHaveBeenCalledWith()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.states).toEqual({})
  })

  it('GET 成功 + 已登录 + 有数据 → states 更新 + isAuthenticated=true', async () => {
    mocks.getInstalledPlugins.mockResolvedValueOnce({
      states: {
        'playwright-mcp': { installedAt: '2026-07-22T10:00:00.000Z', pinned: true },
        remotion: { installedAt: '2026-07-22T11:00:00.000Z', pinned: false },
      },
      authenticated: true,
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
    mocks.getInstalledPlugins.mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.states).toEqual({})
  })

  it('GET 未认证(端点解包后仍是未认证态)→ 重置为未认证态', async () => {
    mocks.getInstalledPlugins.mockResolvedValueOnce({ states: {}, authenticated: false })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.states).toEqual({})
  })

  it('refresh 手动触发再次 GET', async () => {
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mocks.getInstalledPlugins.mockResolvedValueOnce({
      states: { x: { installedAt: '2026-07-22T00:00:00.000Z', pinned: false } },
      authenticated: true,
    })
    await act(async () => {
      await result.current.refresh()
    })
    expect(mocks.getInstalledPlugins).toHaveBeenCalledTimes(2)
    expect(result.current.isInstalled('x')).toBe(true)
  })

  // ─────────────────────────────────────────────────────────
  // install
  // ─────────────────────────────────────────────────────────
  it('install 乐观更新 + 成功后用服务端数据校正', async () => {
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const serverState = { installedAt: '2026-07-22T10:00:00.000Z', pinned: false }
    mocks.installPlugin.mockResolvedValueOnce({ pluginId: 'playwright-mcp', state: serverState })

    let ok = false
    await act(async () => {
      ok = await result.current.install('playwright-mcp', false)
    })
    expect(ok).toBe(true)
    expect(mocks.installPlugin).toHaveBeenLastCalledWith('playwright-mcp', { pinned: false })
    expect(result.current.states['playwright-mcp']).toEqual(serverState)
  })

  it('install 失败 → 回滚到 prev state', async () => {
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mocks.installPlugin.mockRejectedValueOnce(new Error('500'))

    let ok = true
    await act(async () => {
      ok = await result.current.install('playwright-mcp', false)
    })
    expect(ok).toBe(false)
    expect(result.current.isInstalled('playwright-mcp')).toBe(false) // 回滚
  })

  it('install 保留已安装插件的 installedAt(再次 install 切换 pinned)', async () => {
    const originalTime = '2026-01-01T00:00:00.000Z'
    mocks.getInstalledPlugins.mockResolvedValueOnce({
      states: { x: { installedAt: originalTime, pinned: false } },
      authenticated: true,
    })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mocks.installPlugin.mockResolvedValueOnce({
      pluginId: 'x',
      state: { installedAt: originalTime, pinned: true },
    })
    await act(async () => {
      await result.current.install('x', true)
    })
    expect(result.current.states['x']).toEqual({ installedAt: originalTime, pinned: true })
  })

  // ─────────────────────────────────────────────────────────
  // uninstall
  // ─────────────────────────────────────────────────────────
  it('uninstall 乐观移除 + 成功后保持移除', async () => {
    mocks.getInstalledPlugins.mockResolvedValueOnce({
      states: { x: { installedAt: '2026-07-22T00:00:00.000Z', pinned: false } },
      authenticated: true,
    })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isInstalled('x')).toBe(true)

    let ok = false
    await act(async () => {
      ok = await result.current.uninstall('x')
    })
    expect(ok).toBe(true)
    expect(mocks.uninstallPlugin).toHaveBeenLastCalledWith('x')
    expect(result.current.isInstalled('x')).toBe(false)
  })

  it('uninstall 失败 → 回滚(插件恢复为已安装)', async () => {
    const prevState = { installedAt: '2026-07-22T00:00:00.000Z', pinned: true }
    mocks.getInstalledPlugins.mockResolvedValueOnce({
      states: { x: prevState },
      authenticated: true,
    })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mocks.uninstallPlugin.mockRejectedValueOnce(new Error('500'))
    let ok = true
    await act(async () => {
      ok = await result.current.uninstall('x')
    })
    expect(ok).toBe(false)
    expect(result.current.isInstalled('x')).toBe(true) // 回滚
    expect(result.current.states['x']).toEqual(prevState) // 完整恢复(含 pinned)
  })

  // ─────────────────────────────────────────────────────────
  // togglePinned
  // ─────────────────────────────────────────────────────────
  it('togglePinned 未安装 → 返回 false,不调用偏好端点', async () => {
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let ok = true
    await act(async () => {
      ok = await result.current.togglePinned('not-installed')
    })
    expect(ok).toBe(false)
    expect(mocks.updatePluginPreferences).not.toHaveBeenCalled()
  })

  it('togglePinned 已安装 pinned=false → 切换为 true,乐观更新 + 服务端校正', async () => {
    mocks.getInstalledPlugins.mockResolvedValueOnce({
      states: { x: { installedAt: '2026-07-22T00:00:00.000Z', pinned: false } },
      authenticated: true,
    })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mocks.updatePluginPreferences.mockResolvedValueOnce({
      pluginId: 'x',
      state: { installedAt: '2026-07-22T00:00:00.000Z', pinned: true },
    })
    let ok = false
    await act(async () => {
      ok = await result.current.togglePinned('x')
    })
    expect(ok).toBe(true)
    expect(mocks.updatePluginPreferences).toHaveBeenLastCalledWith('x', { pinned: true })
    expect(result.current.isPinned('x')).toBe(true)
  })

  it('togglePinned 失败 → 回滚', async () => {
    mocks.getInstalledPlugins.mockResolvedValueOnce({
      states: { x: { installedAt: '2026-07-22T00:00:00.000Z', pinned: false } },
      authenticated: true,
    })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mocks.updatePluginPreferences.mockRejectedValueOnce(new Error('500'))
    let ok = true
    await act(async () => {
      ok = await result.current.togglePinned('x')
    })
    expect(ok).toBe(false)
    expect(result.current.isPinned('x')).toBe(false) // 回滚
  })

  // ─────────────────────────────────────────────────────────
  // toggleInstall(派生)
  // ─────────────────────────────────────────────────────────
  it('toggleInstall 未安装 → 调用 install', async () => {
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    mocks.installPlugin.mockResolvedValueOnce({
      pluginId: 'x',
      state: { installedAt: '2026-07-22T00:00:00.000Z', pinned: false },
    })
    await act(async () => {
      await result.current.toggleInstall('x')
    })
    expect(mocks.installPlugin).toHaveBeenLastCalledWith('x', { pinned: false })
    expect(result.current.isInstalled('x')).toBe(true)
  })

  it('toggleInstall 已安装 → 调用 uninstall', async () => {
    mocks.getInstalledPlugins.mockResolvedValueOnce({
      states: { x: { installedAt: '2026-07-22T00:00:00.000Z', pinned: false } },
      authenticated: true,
    })
    const { result } = renderHook(() => usePlugins())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.toggleInstall('x')
    })
    expect(mocks.uninstallPlugin).toHaveBeenLastCalledWith('x')
    expect(result.current.isInstalled('x')).toBe(false)
  })

  // ─────────────────────────────────────────────────────────
  // 派生选择器
  // ─────────────────────────────────────────────────────────
  it('isInstalled / isPinned / getState 派生正确', async () => {
    mocks.getInstalledPlugins.mockResolvedValueOnce({
      states: {
        a: { installedAt: '2026-07-22T00:00:00.000Z', pinned: true },
        b: { installedAt: '2026-07-22T00:00:00.000Z', pinned: false },
      },
      authenticated: true,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
