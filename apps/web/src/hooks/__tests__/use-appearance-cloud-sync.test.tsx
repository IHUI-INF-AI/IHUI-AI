// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 外观云同步协议(2026-11-15 v3)
 *
 * 只验证两端之间的契约,不碰真实网络:
 *   ① 云端无数据 → 以本地为准,PUT 整包(version/updatedAt/config/scope);
 *   ② 云端 updatedAt 更新 → 应用到本地,不再回传(避免 A→B→A 回环)。
 */

import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiOrThrow = vi.fn()

vi.mock('@/lib/api', () => ({
  apiOrThrow: (...args: unknown[]) => apiOrThrow(...args),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: <T,>(selector: (state: { isAuthenticated: boolean }) => T): T =>
    selector({ isAuthenticated: true }),
}))

import { clearAppearanceCloudSnapshot, useAppearanceCloudSync } from '../use-appearance-cloud-sync'
import { useAppearanceStore } from '@/stores/appearance-settings'
import { useAppearancePresetsStore } from '@/stores/appearance-presets'
import { useAppearanceScopeStore } from '@/stores/appearance-scope'

describe('useAppearanceCloudSync', () => {
  beforeEach(() => {
    apiOrThrow.mockReset()
    useAppearanceStore.setState({ chatFontScale: 1 })
    useAppearanceScopeStore.setState({
      workspaces: {},
      messages: {},
      cloudSyncEnabled: true,
      lastSyncedAt: 0,
      syncState: 'idle',
    })
    useAppearancePresetsStore.setState({
      presets: [{ id: 'p1', name: '我的预设', overrides: { lineHeight: 'relaxed' }, createdAt: 1 }],
    })
  })
  afterEach(() => {
    useAppearanceScopeStore.setState({ cloudSyncEnabled: false, syncState: 'idle' })
  })

  it('云端为空时把本地整包 PUT 上行', async () => {
    apiOrThrow
      .mockResolvedValueOnce({ state: null, updatedAt: null })
      .mockResolvedValueOnce({ success: true })

    const { unmount } = renderHook(() => useAppearanceCloudSync())

    await waitFor(() => expect(apiOrThrow).toHaveBeenCalledTimes(2))
    const [url, init] = apiOrThrow.mock.calls[1] as [string, { method: string; body: string }]
    expect(url).toBe('/api/settings/appearance')
    expect(init.method).toBe('PUT')

    const payload = JSON.parse(JSON.parse(init.body).state) as Record<string, unknown>
    expect(payload.version).toBe(2)
    expect(typeof payload.updatedAt).toBe('number')
    expect(payload.config).toBeTruthy()
    expect(payload.scope).toBeTruthy()
    expect(payload.presets).toEqual([
      { id: 'p1', name: '我的预设', overrides: { lineHeight: 'relaxed' }, createdAt: 1 },
    ])
    expect(useAppearanceScopeStore.getState().syncState).toBe('synced')

    unmount()
  })

  it('云端更新更晚时应用到本地且不回传', async () => {
    const remote = {
      version: 1,
      updatedAt: 999,
      config: { chatFontScale: 1.3 },
      scope: {
        version: 1,
        workspaces: {},
        messages: { 'm-remote': { fontFamily: 'serif' } },
        cloudSyncEnabled: true,
        lastSyncedAt: 0,
      },
    }
    apiOrThrow.mockResolvedValueOnce({
      state: JSON.stringify(remote),
      updatedAt: 1000,
    })

    const { unmount } = renderHook(() => useAppearanceCloudSync())

    await waitFor(() => expect(useAppearanceStore.getState().chatFontScale).toBe(1.3))
    expect(useAppearanceScopeStore.getState().messages['m-remote']).toEqual({
      fontFamily: 'serif',
    })
    expect(useAppearanceScopeStore.getState().lastSyncedAt).toBe(999)
    expect(apiOrThrow).toHaveBeenCalledTimes(1)

    unmount()
  })

  it('云端 v2 快照会同时应用预设;坏预设条目被逐条丢弃', async () => {
    const remote = {
      version: 2,
      updatedAt: 2000,
      config: { chatFontScale: 1.2 },
      scope: {
        version: 1,
        workspaces: {},
        messages: {},
        cloudSyncEnabled: true,
        lastSyncedAt: 0,
      },
      presets: [
        { id: 'r1', name: '远端预设', overrides: { uiScale: 1.15 }, createdAt: 10 },
        { id: '', name: '坏条目', overrides: { uiScale: 1.2 } },
        { id: 'r2', name: '空覆盖', overrides: {} },
      ],
    }
    apiOrThrow.mockResolvedValueOnce({ state: JSON.stringify(remote), updatedAt: 2000 })

    const { unmount } = renderHook(() => useAppearanceCloudSync())

    await waitFor(() => expect(useAppearancePresetsStore.getState().presets).toHaveLength(1))
    expect(useAppearancePresetsStore.getState().presets[0]).toMatchObject({
      id: 'r1',
      name: '远端预设',
      overrides: { uiScale: 1.15 },
    })
    expect(useAppearanceStore.getState().chatFontScale).toBe(1.2)
    expect(apiOrThrow).toHaveBeenCalledTimes(1)

    unmount()
  })

  it('云端 v1 旧快照不会清空本机预设', async () => {
    const remote = {
      version: 1,
      updatedAt: 3000,
      config: { chatFontScale: 1.25 },
      scope: {
        version: 1,
        workspaces: {},
        messages: {},
        cloudSyncEnabled: true,
        lastSyncedAt: 0,
      },
    }
    apiOrThrow.mockResolvedValueOnce({ state: JSON.stringify(remote), updatedAt: 3000 })

    const { unmount } = renderHook(() => useAppearanceCloudSync())

    await waitFor(() => expect(useAppearanceStore.getState().chatFontScale).toBe(1.25))
    expect(useAppearancePresetsStore.getState().presets).toHaveLength(1)
    expect(apiOrThrow).toHaveBeenCalledTimes(1)

    unmount()
  })

  it('新增自定义预设触发防抖同步,且上行包带上预设', async () => {
    apiOrThrow
      .mockResolvedValueOnce({ state: null, updatedAt: null })
      .mockResolvedValue({ success: true })

    const { unmount } = renderHook(() => useAppearanceCloudSync())
    await waitFor(() => expect(apiOrThrow).toHaveBeenCalledTimes(2))

    useAppearancePresetsStore.getState().addPreset('同步预设', { uiScale: 1.15 })
    await waitFor(() => expect(apiOrThrow).toHaveBeenCalledTimes(3), { timeout: 5000 })

    const [, init] = apiOrThrow.mock.calls[2] as [string, { method: string; body: string }]
    const payload = JSON.parse(JSON.parse(init.body).state) as { presets: unknown[] }
    expect(payload.presets).toHaveLength(2)
    expect(payload.presets[1]).toMatchObject({
      name: '同步预设',
      overrides: { uiScale: 1.15 },
    })

    unmount()
  })

  it('清除云端快照走 DELETE,成功后 lastSyncedAt 归零', async () => {
    useAppearanceScopeStore.setState({ lastSyncedAt: 123 })
    apiOrThrow.mockResolvedValueOnce({ success: true })

    await expect(clearAppearanceCloudSnapshot()).resolves.toBe(true)
    expect(apiOrThrow).toHaveBeenCalledWith('/api/settings/appearance', { method: 'DELETE' })
    expect(useAppearanceScopeStore.getState().lastSyncedAt).toBe(0)
  })

  it('清除失败时返回 false 并标记错误态', async () => {
    apiOrThrow.mockRejectedValueOnce(new Error('network'))

    await expect(clearAppearanceCloudSnapshot()).resolves.toBe(false)
    expect(useAppearanceScopeStore.getState().syncState).toBe('error')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
