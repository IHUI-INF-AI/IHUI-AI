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
 * useDesktop — 客户端(Tauri WebView)能力统一 hook(2026-07-25 立)
 *
 * 封装:
 * - isDesktop:当前是否在 Tauri 客户端运行(非浏览器)
 * - appInfo:客户端应用信息(名称/版本/平台)
 * - isMaximized:主窗口是否最大化(实时同步)
 * - autostartEnabled:开机自启状态
 * - 操作:minimize / toggleMaximize / close / toggleAutostart / resetWindow / notify
 *
 * 浏览器环境下 isDesktop=false,所有操作为 no-op,appInfo=null。
 * 组件可根据 isDesktop 决定是否渲染客户端独占 UI。
 */
export function useDesktop() {
  // 2026-07-26 用户反馈(第六次):useState(() => isTauri()) 在静态导出 + Tauri 2.x 异步注入时机下
  //   第一次 render 时 window.__TAURI_INTERNALS__ 尚未注入,isDesktop 始终为 false,
  //   MainShell 标题栏 `isDesktop && (...)` 永不渲染。
  // 修复:用 useState(false) 初始值 + useEffect 异步检测,避免 hydration mismatch。
  // 浏览器端 useEffect 永远检测不到,稳定返回 false,不影响 SSR/CSR 一致性。
  const [isDesktop, setIsDesktop] = React.useState(false)
  const [appInfo, setAppInfo] = React.useState<DesktopAppInfo | null>(null)
  const [isMaximized, setIsMaximized] = React.useState(false)
  const [autostartEnabled, setAutostartEnabled] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  // 初始化:挂载后探测 Tauri(避免 hydration mismatch)
  // 2026-07-26 用户反馈(第八次):useEffect 一次检查仍可能为 false,因为 Tauri 2.x
  //   在 WebView 创建后会异步注入 __TAURI_INTERNALS__,首次 useEffect 执行时
  //   window.__TAURI_INTERNALS__ 可能尚未存在。
  // 解决方案:轮询直到检测到 Tauri 或超时(10 秒,2026-07-26 从 2 秒增加,解决注入时机问题)。
  // 浏览器端永远检测不到,稳定 false。
  React.useEffect(() => {
    let cancelled = false
    const start = Date.now()
    const TIMEOUT_MS = 10000
    const INTERVAL_MS = 50
    const check = () => {
      if (cancelled) return
      if (isTauri()) {
        setIsDesktop(true)
        return
      }
      if (Date.now() - start > TIMEOUT_MS) {
        // 浏览器端或 Tauri 注入失败,保持 false
        return
      }
      setTimeout(check, INTERVAL_MS)
    }
    check()
    return () => {
      cancelled = true
    }
  }, [])

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

  const notify = React.useCallback(async (title: string, body: string) => {
    await sendDesktopNotification(title, body)
  }, [])

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
