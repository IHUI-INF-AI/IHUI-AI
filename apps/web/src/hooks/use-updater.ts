'use client'

import * as React from 'react'
import {
  isTauri,
  checkForUpdates,
  restartApp,
  type UpdateSession,
  type UpdateProgress,
} from '@/lib/tauri-bridge'

/** 更新状态机:idle → checking → available → downloading → installing → done / error */
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'done'
  | 'error'

export interface UpdaterState {
  status: UpdateStatus
  /** 可用更新信息(available/downloading/installing 时有值)。 */
  session: UpdateSession | null
  /** 下载进度(0-1,downloading/installing 时更新)。 */
  progress: number
  /** 下载字节数(用于显示 MB)。 */
  downloaded: number
  /** 总字节数。 */
  total: number
  /** 错误信息(error 时有值)。 */
  error: string | null
}

/** 初始状态。 */
const INITIAL_STATE: UpdaterState = {
  status: 'idle',
  session: null,
  progress: 0,
  downloaded: 0,
  total: 0,
  error: null,
}

/** 静默检查延迟(启动后 5 秒,避免与初始化竞争资源)。 */
const SILENT_CHECK_DELAY_MS = 5000

/**
 * useUpdater — 桌面端应用更新状态机(2026-07-31 立,平台独占:仅桌面端)。
 *
 * 状态流转:
 *   idle → checking → (available | idle) → downloading → installing → done → (restart)
 *   任意阶段失败 → error → idle
 *
 * 触发来源:
 * - 启动静默检查(挂载后 5s 自动 check)
 * - 托盘菜单 "检查更新"(desktop-check-update 事件)
 * - 组件手动触发 checkForUpdate()
 *
 * 浏览器端 isTauri()=false,此 hook 不执行任何副作用,返回 idle 状态。
 */
export function useUpdater() {
  const [state, setState] = React.useState<UpdaterState>(INITIAL_STATE)
  const mountedRef = React.useRef(true)

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  /** 检查更新。silent=true 时不显示 error(静默启动检查)。 */
  const checkForUpdate = React.useCallback(async (silent = false) => {
    if (!isTauri()) return
    setState({ ...INITIAL_STATE, status: 'checking' })
    const session = await checkForUpdates()
    if (!mountedRef.current) return
    if (!session) {
      // 已是最新或检查失败
      setState({ ...INITIAL_STATE, status: 'idle', error: silent ? null : 'check_failed' })
      return
    }
    setState({
      ...INITIAL_STATE,
      status: 'available',
      session,
    })
  }, [])

  /** 下载并安装更新。 */
  const downloadAndInstall = React.useCallback(async () => {
    if (!state.session) return
    setState((prev) => ({ ...prev, status: 'downloading', progress: 0 }))
    try {
      await state.session.downloadAndInstall((p: UpdateProgress) => {
        if (!mountedRef.current) return
        const ratio = p.total > 0 ? p.downloaded / p.total : 0
        setState((prev) => ({
          ...prev,
          status: 'downloading',
          progress: ratio,
          downloaded: p.downloaded,
          total: p.total,
        }))
      })
      if (!mountedRef.current) return
      setState((prev) => ({ ...prev, status: 'installing', progress: 1 }))
      // 安装完成,等待用户点击重启或自动重启
      setState((prev) => ({ ...prev, status: 'done' }))
    } catch (e) {
      if (!mountedRef.current) return
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      }))
    }
  }, [state.session])

  /** 重启应用(安装完成后调用)。 */
  const restart = React.useCallback(async () => {
    await restartApp()
  }, [])

  /** 关闭提示(回到 idle)。 */
  const dismiss = React.useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  // 启动静默检查(5 秒后)
  React.useEffect(() => {
    if (!isTauri()) return
    const timer = setTimeout(() => {
      void checkForUpdate(true)
    }, SILENT_CHECK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [checkForUpdate])

  // 监听托盘菜单 "检查更新" 事件(由 useDesktopEvents 转发的 CustomEvent)
  React.useEffect(() => {
    if (!isTauri()) return
    const handler = () => void checkForUpdate(false)
    window.addEventListener('desktop-check-update', handler)
    return () => window.removeEventListener('desktop-check-update', handler)
  }, [checkForUpdate])

  return {
    ...state,
    checkForUpdate,
    downloadAndInstall,
    restart,
    dismiss,
  }
}
