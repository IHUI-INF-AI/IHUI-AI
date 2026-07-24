'use client'

import * as React from 'react'
import {
  isTauri,
  getDesktopAppInfo,
  isWindowMaximized,
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  isAutostartEnabled,
  enableAutostart,
  disableAutostart,
  resetWindowState,
  sendDesktopNotification,
  type DesktopAppInfo,
} from '@/lib/tauri-bridge'

/**
 * useDesktop — 桌面端(Tauri WebView)能力统一 hook(2026-07-25 立)
 *
 * 封装:
 * - isDesktop:当前是否在 Tauri 桌面端运行(非浏览器)
 * - appInfo:桌面端应用信息(名称/版本/平台)
 * - isMaximized:主窗口是否最大化(实时同步)
 * - autostartEnabled:开机自启状态
 * - 操作:minimize / toggleMaximize / close / toggleAutostart / resetWindow / notify
 *
 * 浏览器环境下 isDesktop=false,所有操作为 no-op,appInfo=null。
 * 组件可根据 isDesktop 决定是否渲染桌面端独占 UI。
 */
export function useDesktop() {
  const [isDesktop] = React.useState(() => isTauri())
  const [appInfo, setAppInfo] = React.useState<DesktopAppInfo | null>(null)
  const [isMaximized, setIsMaximized] = React.useState(false)
  const [autostartEnabled, setAutostartEnabled] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  // 初始化:加载 appInfo + 窗口状态 + 自启状态
  React.useEffect(() => {
    if (!isDesktop) {
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      const [info, maximized, autostart] = await Promise.all([
        getDesktopAppInfo(),
        isWindowMaximized(),
        isAutostartEnabled(),
      ])
      if (cancelled) return
      setAppInfo(info)
      setIsMaximized(maximized)
      setAutostartEnabled(autostart)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [isDesktop])

  // 监听窗口最大化状态变化(Resize 事件)
  React.useEffect(() => {
    if (!isDesktop) return
    const onResize = () => {
      void isWindowMaximized().then(setIsMaximized)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [isDesktop])

  const minimize = React.useCallback(async () => {
    await minimizeWindow()
  }, [])

  const toggleMaximize = React.useCallback(async () => {
    const next = await toggleMaximizeWindow()
    setIsMaximized(next)
  }, [])

  const close = React.useCallback(async () => {
    await closeWindow()
  }, [])

  const toggleAutostart = React.useCallback(async () => {
    if (autostartEnabled) {
      await disableAutostart()
      setAutostartEnabled(false)
    } else {
      await enableAutostart()
      setAutostartEnabled(true)
    }
  }, [autostartEnabled])

  const resetWindow = React.useCallback(async () => {
    await resetWindowState()
  }, [])

  const notify = React.useCallback(
    async (title: string, body: string) => {
      await sendDesktopNotification(title, body)
    },
    [],
  )

  return {
    isDesktop,
    appInfo,
    isMaximized,
    autostartEnabled,
    loading,
    minimize,
    toggleMaximize,
    close,
    toggleAutostart,
    resetWindow,
    notify,
  }
}
