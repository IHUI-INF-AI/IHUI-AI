// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 账号级外观云同步(2026-11-15 v3 立)。
 *
 * 协议:`GET/PUT /api/settings/appearance`,单行 JSON 快照
 *   { version:1, updatedAt, config, scope:{ workspaces, messages, ... } }
 *
 * 冲突策略:updatedAt 新者胜(最后写入时间比较,不做字段级 merge —— 外观配置是一个
 * 整体,字段级合并会出现"字号来自设备 A、字体来自设备 B"的混合态)。
 *
 * 防回环:应用远端快照时置 applying 标记,期间 store 订阅不触发回传;
 * 用户连续改设置时 1.5s 防抖成一次 PUT,避免拖动滑杆打出几十个请求。
 */

import * as React from 'react'

import { apiOrThrow } from '@/lib/api'
import {
  APPEARANCE_CONFIG_KEYS,
  getAppearanceConfig,
  useAppearanceStore,
  type AppearanceConfig,
} from '@/stores/appearance-settings'
import { useAppearanceScopeStore, type AppearanceScopeSnapshot } from '@/stores/appearance-scope'
import { useAppearancePresetsStore, type CustomAppearancePreset } from '@/stores/appearance-presets'
import { useAuthStore } from '@/stores/auth'

const SYNC_DEBOUNCE_MS = 1500

interface RemoteAppearancePayload {
  version: 2
  updatedAt: number
  config: AppearanceConfig
  scope: AppearanceScopeSnapshot
  presets: CustomAppearancePreset[]
}

function buildLocalPayload(): RemoteAppearancePayload {
  return {
    version: 2,
    updatedAt: Date.now(),
    config: getAppearanceConfig(),
    scope: useAppearanceScopeStore.getState().exportSnapshot(),
    presets: useAppearancePresetsStore.getState().exportPresets(),
  }
}

/**
 * 清除云端外观快照(账号级显式动作)。
 * 与自动同步解耦:云同步开关关闭时也允许调用 —— 用户可能要换账号或不再保留云端数据。
 * 成功后把 lastSyncedAt 归零,下次开启同步会以本地为准重新上行。
 */
export async function clearAppearanceCloudSnapshot(): Promise<boolean> {
  try {
    await apiOrThrow<{ success: boolean }>('/api/settings/appearance', { method: 'DELETE' })
    useAppearanceScopeStore.getState().setLastSyncedAt(0)
    useAppearanceScopeStore.getState().setSyncState('idle')
    return true
  } catch {
    useAppearanceScopeStore.getState().setSyncState('error')
    return false
  }
}

export function useAppearanceCloudSync(): void {
  const cloudSyncEnabled = useAppearanceScopeStore((state) => state.cloudSyncEnabled)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  React.useEffect(() => {
    if (!cloudSyncEnabled || !isAuthenticated) return
    if (typeof window === 'undefined') return

    let disposed = false
    let applying = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const scopeStore = useAppearanceScopeStore
    const setStatus = (state: 'idle' | 'syncing' | 'synced' | 'error') =>
      scopeStore.getState().setSyncState(state)

    const push = async () => {
      if (disposed) return
      setStatus('syncing')
      try {
        const payload = buildLocalPayload()
        await apiOrThrow<{ success: boolean }>('/api/settings/appearance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: JSON.stringify(payload) }),
        })
        if (disposed) return
        scopeStore.getState().setLastSyncedAt(payload.updatedAt)
        setStatus('synced')
      } catch {
        if (!disposed) setStatus('error')
      }
    }

    /** 返回 'remote' 表示已应用云端,'local' 表示应以本地为准,'error' 表示网络失败 */
    const pull = async (): Promise<'remote' | 'local' | 'error'> => {
      try {
        const data = await apiOrThrow<{ state: string | null; updatedAt: number | null }>(
          '/api/settings/appearance',
        )
        if (!data.state) return 'local'
        const parsed: unknown = JSON.parse(data.state)
        if (typeof parsed !== 'object' || parsed === null) return 'local'
        const input = parsed as Record<string, unknown>
        // v1 仍可读(升级前的云端快照);v2 额外带 presets
        if ((input.version !== 1 && input.version !== 2) || typeof input.updatedAt !== 'number') {
          return 'local'
        }
        if (input.updatedAt <= scopeStore.getState().lastSyncedAt) return 'local'

        applying = true
        try {
          useAppearanceStore.getState().importConfig(JSON.stringify(input.config ?? {}))
          scopeStore.getState().applySnapshot(input.scope)
          // 只有远端明确给了数组才覆盖本机预设,避免 v1 快照误清空
          if (input.version === 2 && Array.isArray(input.presets)) {
            useAppearancePresetsStore.getState().applyPresets(input.presets)
          }
          scopeStore.getState().setLastSyncedAt(input.updatedAt)
        } finally {
          applying = false
        }
        setStatus('synced')
        return 'remote'
      } catch {
        if (!disposed) setStatus('error')
        return 'error'
      }
    }

    void (async () => {
      setStatus('syncing')
      const outcome = await pull()
      if (disposed) return
      if (outcome === 'local') await push()
    })()

    const schedule = () => {
      if (disposed || applying) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void push()
      }, SYNC_DEBOUNCE_MS)
    }

    const unsubscribeAppearance = useAppearanceStore.subscribe((state, previous) => {
      if (APPEARANCE_CONFIG_KEYS.some((key) => state[key] !== previous[key])) schedule()
    })
    const unsubscribeScope = scopeStore.subscribe((state, previous) => {
      if (state.workspaces !== previous.workspaces || state.messages !== previous.messages) {
        schedule()
      }
    })
    const unsubscribePresets = useAppearancePresetsStore.subscribe((state, previous) => {
      if (state.presets !== previous.presets) schedule()
    })

    const onSyncNow = () => {
      if (timer) clearTimeout(timer)
      timer = null
      void push()
    }
    window.addEventListener('ihui-appearance-sync-now', onSyncNow)

    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
      unsubscribeAppearance()
      unsubscribeScope()
      unsubscribePresets()
      window.removeEventListener('ihui-appearance-sync-now', onSyncNow)
    }
  }, [cloudSyncEnabled, isAuthenticated])

  // 关闭开关时把状态归零,避免 UI 停在「同步中」
  React.useEffect(() => {
    if (!cloudSyncEnabled) useAppearanceScopeStore.getState().setSyncState('idle')
  }, [cloudSyncEnabled])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
