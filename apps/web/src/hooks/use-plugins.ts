'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'
import type { PluginInstallState } from '@ihui/types'

/**
 * 插件市场前端状态管理 Hook(2026-07-22 立)
 *
 * 设计:
 *  - 本地 state + fetchApi(与 use-distribution.ts 风格一致,401 自动弹登录弹窗)
 *  - 乐观更新:操作前先更新本地 state,失败回滚
 *  - 未登录时 isAuthenticated=false,前端隐藏操作按钮
 *
 * 数据流:
 *  - GET /api/plugins/installed → states (Record<pluginId, PluginInstallState>)
 *  - POST /api/plugins/:id/install → 安装/启用(可选 pinned)
 *  - DELETE /api/plugins/:id/install → 卸载/禁用
 *  - PATCH /api/plugins/:id/preferences → 切换 pinned
 */

export interface UsePluginsReturn {
  states: Record<string, PluginInstallState>
  isAuthenticated: boolean
  isLoading: boolean
  /** 安装/启用插件(若已安装则更新 pinned) */
  install: (pluginId: string, pinned?: boolean) => Promise<boolean>
  /** 卸载/禁用插件 */
  uninstall: (pluginId: string) => Promise<boolean>
  /** 切换收藏/置顶(已安装才有效) */
  togglePinned: (pluginId: string) => Promise<boolean>
  /** 切换安装态(已安装→卸载,未安装→安装) */
  toggleInstall: (pluginId: string) => Promise<boolean>
  /** 获取单个插件状态(未安装返回 null) */
  getState: (pluginId: string) => PluginInstallState | null
  /** 是否已安装 */
  isInstalled: (pluginId: string) => boolean
  /** 是否已收藏 */
  isPinned: (pluginId: string) => boolean
  /** 重新加载 */
  refresh: () => Promise<void>
}

export function usePlugins(): UsePluginsReturn {
  const [states, setStates] = React.useState<Record<string, PluginInstallState>>({})
  const [isAuthenticated, setAuthenticated] = React.useState(false)
  const [isLoading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApi<{ states: Record<string, PluginInstallState>; authenticated: boolean }>(
        '/api/plugins/installed',
      )
      if (res.success) {
        setStates(res.data.states)
        setAuthenticated(res.data.authenticated)
      } else {
        // 未登录或网络异常:重置为未认证态
        setStates({})
        setAuthenticated(false)
      }
    } catch {
      setStates({})
      setAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // 首次挂载自动加载
  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const install = React.useCallback(
    async (pluginId: string, pinned = false): Promise<boolean> => {
      // 乐观更新:先写入本地 state
      const prev = states
      const optimisticState: PluginInstallState = {
        installedAt: prev[pluginId]?.installedAt ?? new Date().toISOString(),
        pinned,
      }
      setStates((s) => ({ ...s, [pluginId]: optimisticState }))

      const res = await fetchApi<{ pluginId: string; state: PluginInstallState }>(
        `/api/plugins/${encodeURIComponent(pluginId)}/install`,
        { method: 'POST', body: JSON.stringify({ pinned }) },
      )
      if (!res.success) {
        // 失败回滚
        setStates(prev)
        return false
      }
      // 用服务端返回的真实 state 校正
      setStates((s) => ({ ...s, [pluginId]: res.data.state }))
      return true
    },
    [states],
  )

  const uninstall = React.useCallback(
    async (pluginId: string): Promise<boolean> => {
      const prev = states
      // 乐观更新:先移除本地 state
      setStates((s) => {
        const next = { ...s }
        delete next[pluginId]
        return next
      })

      const res = await fetchApi<{ pluginId: string; removed: true }>(
        `/api/plugins/${encodeURIComponent(pluginId)}/install`,
        { method: 'DELETE' },
      )
      if (!res.success) {
        setStates(prev)
        return false
      }
      return true
    },
    [states],
  )

  const togglePinned = React.useCallback(
    async (pluginId: string): Promise<boolean> => {
      const currentState = states[pluginId]
      if (!currentState) return false // 未安装,不能切换 pinned

      const prev = states
      const nextPinned = !currentState.pinned
      // 乐观更新
      setStates((s) => ({
        ...s,
        [pluginId]: { ...currentState, pinned: nextPinned },
      }))

      const res = await fetchApi<{ pluginId: string; state: PluginInstallState }>(
        `/api/plugins/${encodeURIComponent(pluginId)}/preferences`,
        { method: 'PATCH', body: JSON.stringify({ pinned: nextPinned }) },
      )
      if (!res.success) {
        setStates(prev)
        return false
      }
      setStates((s) => ({ ...s, [pluginId]: res.data.state }))
      return true
    },
    [states],
  )

  const toggleInstall = React.useCallback(
    async (pluginId: string): Promise<boolean> => {
      if (states[pluginId]) {
        return uninstall(pluginId)
      }
      return install(pluginId, false)
    },
    [states, install, uninstall],
  )

  const getState = React.useCallback(
    (pluginId: string): PluginInstallState | null => states[pluginId] ?? null,
    [states],
  )

  const isInstalled = React.useCallback((pluginId: string) => Boolean(states[pluginId]), [states])

  const isPinned = React.useCallback(
    (pluginId: string) => Boolean(states[pluginId]?.pinned),
    [states],
  )

  return {
    states,
    isAuthenticated,
    isLoading,
    install,
    uninstall,
    togglePinned,
    toggleInstall,
    getState,
    isInstalled,
    isPinned,
    refresh,
  }
}
