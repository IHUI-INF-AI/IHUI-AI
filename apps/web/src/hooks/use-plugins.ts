'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'
import type { PluginInstallState } from '@ihui/types'

/**
 * 插件市场前端状态管理 Hook(2026-07-22 立,2026-07-22 增 click 埋点)
 *
 * 设计:
 *  - 本地 state + fetchApi(与 use-distribution.ts 风格一致,401 自动弹登录弹窗)
 *  - 乐观更新:操作前先更新本地 state,失败回滚
 *  - 未登录时 isAuthenticated=false,前端隐藏操作按钮
 *  - click 埋点:用户点击市场卡片外链时调用,fire-and-forget(不阻塞跳转)
 *
 * 数据流:
 *  - GET /api/plugins/installed → states (Record<pluginId, PluginInstallState>)
 *  - POST /api/plugins/:id/install → 安装/启用(可选 pinned)
 *  - DELETE /api/plugins/:id/install → 卸载/禁用
 *  - PATCH /api/plugins/:id/preferences → 切换 pinned
 *  - POST /api/plugins/:id/click → 埋点(游客可触发)
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
  /** 埋点:用户点击市场卡片外链(fire-and-forget,不阻塞跳转) */
  recordClick: (pluginId: string) => void
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
  // 2026-08-02 修复: 乐观更新回滚 race condition - 用 ref 跟踪最新 states, 回滚时用函数式更新按 id 精确修改
  const statesRef = React.useRef(states)
  statesRef.current = states

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApi<{
        states: Record<string, PluginInstallState>
        authenticated: boolean
      }>('/api/plugins/installed')
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

  const install = React.useCallback(async (pluginId: string, pinned = false): Promise<boolean> => {
    // 2026-08-02 修复: 乐观更新回滚 race condition - 用 ref 读取当前 state, 回滚时用函数式更新按 id 精确修改
    const prevPluginState = statesRef.current[pluginId]
    // 乐观更新:先写入本地 state
    const optimisticState: PluginInstallState = {
      installedAt: prevPluginState?.installedAt ?? new Date().toISOString(),
      pinned,
    }
    setStates((s) => ({ ...s, [pluginId]: optimisticState }))

    const res = await fetchApi<{ pluginId: string; state: PluginInstallState }>(
      `/api/plugins/${encodeURIComponent(pluginId)}/install`,
      { method: 'POST', body: JSON.stringify({ pinned }) },
    )
    if (!res.success) {
      // 函数式回滚: 只恢复对应 id, 保留中间其他更新
      setStates((s) => {
        if (prevPluginState) {
          return { ...s, [pluginId]: prevPluginState }
        }
        const next = { ...s }
        delete next[pluginId]
        return next
      })
      return false
    }
    // 用服务端返回的真实 state 校正
    setStates((s) => ({ ...s, [pluginId]: res.data.state }))
    return true
  }, [])

  const uninstall = React.useCallback(async (pluginId: string): Promise<boolean> => {
    // 2026-08-02 修复: 乐观更新回滚 race condition - 用 ref 读取当前 state, 回滚时用函数式更新按 id 精确修改
    const prevPluginState = statesRef.current[pluginId]
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
      // 函数式回滚: 只恢复对应 id, 保留中间其他更新
      setStates((s) => {
        if (prevPluginState) {
          return { ...s, [pluginId]: prevPluginState }
        }
        return s
      })
      return false
    }
    return true
  }, [])

  const togglePinned = React.useCallback(async (pluginId: string): Promise<boolean> => {
    // 2026-08-02 修复: 乐观更新回滚 race condition - 用 ref 读取当前 state, 回滚时用函数式更新按 id 精确修改
    const currentState = statesRef.current[pluginId]
    if (!currentState) return false // 未安装,不能切换 pinned

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
      // 函数式回滚: 只恢复对应 id 的 pinned, 保留中间其他更新
      setStates((s) => ({
        ...s,
        [pluginId]: { ...currentState, pinned: !nextPinned },
      }))
      return false
    }
    setStates((s) => ({ ...s, [pluginId]: res.data.state }))
    return true
  }, [])

  const toggleInstall = React.useCallback(
    async (pluginId: string): Promise<boolean> => {
      if (statesRef.current[pluginId]) {
        return uninstall(pluginId)
      }
      return install(pluginId, false)
    },
    [install, uninstall],
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

  // 埋点:用户点击市场卡片外链。fire-and-forget,不阻塞跳转,失败静默。
  const recordClick = React.useCallback((pluginId: string) => {
    void fetchApi<{ recorded: true }>(`/api/plugins/${encodeURIComponent(pluginId)}/click`, {
      method: 'POST',
    }).catch(() => {
      // 静默失败:埋点不能阻塞用户跳转
    })
  }, [])

  return {
    states,
    isAuthenticated,
    isLoading,
    install,
    uninstall,
    togglePinned,
    toggleInstall,
    recordClick,
    getState,
    isInstalled,
    isPinned,
    refresh,
  }
}
