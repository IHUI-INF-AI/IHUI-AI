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
  getSystemTheme,
  onSystemThemeChange,
  setTrayStatus,
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
  // 2026-07-29:withGlobalTauri 关闭后,__TAURI__ 不再注入,isTauri() 只检查
  //   __TAURI_INTERNALS__,轮询逻辑不变(本就依赖此标识的注入时机)。
  const [isDesktop, setIsDesktop] = React.useState(false)
  const [appInfo, setAppInfo] = React.useState<DesktopAppInfo | null>(null)
  const [isMaximized, setIsMaximized] = React.useState(false)
  const [autostartEnabled, setAutostartEnabled] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  // 初始化:挂载后探测 Tauri(避免 hydration mismatch)
  // 2026-07-28 优化:原 10 秒超时太长,首启桌面端 UI(窗口控制按钮/resize/拖拽)10 秒内不显示
  //   - Tauri 2.x 在 Windows 上注入 __TAURI_INTERNALS__ 通常 100-500ms 内完成
  //   - 缩短到 3 秒超时,50ms 间隔轮询,正常情况 100-500ms 内检测到
  //   - 浏览器端永远检测不到,稳定 false
  React.useEffect(() => {
    let cancelled = false
    const start = Date.now()
    const TIMEOUT_MS = 3000
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

/**
 * useSystemTheme — 监听系统主题(深色/浅色)实时变化(2026-07-27 立,P1-7)
 *
 * - 挂载时一次性获取当前系统主题
 * - 监听 OS 主题切换事件,实时同步
 * - 浏览器端返回 null(无系统主题能力)
 *
 * 用于:主题跟随、与 next-themes setTheme 联动
 *
 * 注意:onSystemThemeChange 返回同步清理函数 `() => void`,非 Promise。
 */
export function useSystemTheme(): 'light' | 'dark' | null {
  const [systemTheme, setSystemTheme] = React.useState<'light' | 'dark' | null>(null)

  React.useEffect(() => {
    if (!isTauri()) return
    let cancelled = false

    // 挂载时一次性获取当前系统主题
    void getSystemTheme().then((theme) => {
      if (cancelled) return
      if (theme) setSystemTheme(theme)
    })

    // 监听 OS 主题切换事件(onSystemThemeChange 返回同步清理函数)
    const unlisten = onSystemThemeChange((theme) => {
      setSystemTheme(theme)
    })

    return () => {
      cancelled = true
      unlisten()
    }
  }, [])

  return systemTheme
}

/**
 * useDesktopEvents — 监听 Rust 端 emit 的桌面事件(托盘菜单 + 系统级快捷键),
 * 转发为前端已有的 CustomEvent(global-shortcut:* / 主题切换 / 设置跳转等),
 * 复用 use-global-shortcuts.ts 和现有 UI 组件处理逻辑。
 *
 * 2026-07-29 立:配合 Rust 端托盘菜单 7 项 + 系统级快捷键 3 个。
 *
 * 事件来源:
 * - "desktop-tray-action":托盘菜单点击(new_chat/toggle_theme/open_settings/check_update)
 * - "desktop-shortcut":系统级快捷键(new_chat/quick_screenshot)
 *
 * 转发策略:
 * - new_chat → global-shortcut:new-chat(use-global-shortcuts.ts 已有监听)
 * - toggle_theme → 下一个主题(next-themes setTheme,通过 CustomEvent 触发)
 * - open_settings → 路由跳转 /settings
 * - check_update → 触发 updater 检查
 * - quick_screenshot → 触发截图(Computer Control)
 *
 * 浏览器端 isTauri()=false,此 hook 不注册监听,无副作用。
 */
export function useDesktopEvents(): void {
  React.useEffect(() => {
    if (!isTauri()) return
    // 动态 import 避免浏览器端加载 Tauri event API
    let unlistenTray: (() => void) | undefined
    let unlistenShortcut: (() => void) | undefined
    let unlistenBeforeClose: (() => void) | undefined
    let cancelled = false
    // 2026-08-02 修复: 异步监听器泄漏 - listen() 异步, cleanup 时可能未完成, unlisten 未赋值导致泄漏
    let pendingPromise: Promise<void> | null = null

    pendingPromise = (async () => {
      const { listen } = await import('@tauri-apps/api/event')
      if (cancelled) return

      // 托盘菜单事件
      unlistenTray = await listen<string>('desktop-tray-action', (event) => {
        const action = event.payload
        switch (action) {
          case 'new_chat':
            // 复用浏览器内 Ctrl+Shift+N 相同的 CustomEvent
            window.dispatchEvent(new CustomEvent('global-shortcut:new-chat'))
            break
          case 'toggle_theme':
            window.dispatchEvent(new CustomEvent('desktop-theme-toggle'))
            break
          case 'open_settings':
            window.dispatchEvent(new CustomEvent('desktop-open-settings'))
            break
          case 'check_update':
            window.dispatchEvent(new CustomEvent('desktop-check-update'))
            break
          case 'quit':
            // 2026-07-31:托盘退出 → 前端拦截,检查更新后退出或重启
            window.dispatchEvent(new CustomEvent('desktop-quit-request'))
            break
        }
      })

      // 系统级快捷键事件
      unlistenShortcut = await listen<string>('desktop-shortcut', (event) => {
        const action = event.payload
        switch (action) {
          case 'new_chat':
            // 窗口聚焦时浏览器内 keydown 也会触发,前端去重由 use-global-shortcuts 处理
            window.dispatchEvent(new CustomEvent('global-shortcut:new-chat'))
            break
          case 'quick_screenshot':
            window.dispatchEvent(new CustomEvent('desktop-quick-screenshot'))
            break
        }
      })

      // 2026-07-29 #12:窗口关闭前事件,前端保存正在编辑的消息
      unlistenBeforeClose = await listen('desktop-before-close', () => {
        window.dispatchEvent(new CustomEvent('desktop-before-close'))
      })
    })()

    return () => {
      cancelled = true
      unlistenTray?.()
      unlistenShortcut?.()
      unlistenBeforeClose?.()
      // listen 尚未完成时, 等待完成后立即清理
      pendingPromise?.then(() => {
        unlistenTray?.()
        unlistenShortcut?.()
        unlistenBeforeClose?.()
      })
    }
  }, [])
}

/**
 * useDesktopDeepLink — 监听 desktop deep-link 事件,自动完成 SSO 登录闭环(2026-08-01 立)。
 *
 * 流程:
 * - Rust on_deeplink 捕获 `ihui://sso?sso_code=xxx` → emit "desktop-deep-link" 事件
 * - 本 hook 监听事件 → 调 handleDesktopDeepLink 解析 code + 换 token + 持久化
 *
 * 浏览器端 isTauri()=false,本 hook 不注册监听,无副作用。
 */
export function useDesktopDeepLink(): void {
  React.useEffect(() => {
    if (!isTauri()) return
    let unlistenDeepLink: (() => void) | undefined
    let cancelled = false
    // 2026-08-02 修复: 异步监听器泄漏 - listen() 异步, cleanup 时可能未完成, unlisten 未赋值导致泄漏
    let pendingPromise: Promise<void> | null = null

    pendingPromise = (async () => {
      const { listen } = await import('@tauri-apps/api/event')
      if (cancelled) return

      // 动态 import 避免浏览器端加载 desktop bridge 模块
      const { handleDesktopDeepLink } = await import('@/lib/sso-desktop-bridge')
      if (cancelled) return

      unlistenDeepLink = await listen<string>('desktop-deep-link', async (event) => {
        const url = event.payload
        if (!url) return
        const ok = await handleDesktopDeepLink(url)
        if (ok) {
          window.dispatchEvent(new CustomEvent('desktop-sso-success'))
        }
      })
    })()

    return () => {
      cancelled = true
      unlistenDeepLink?.()
      // listen 尚未完成时, 等待完成后立即清理
      pendingPromise?.then(() => {
        unlistenDeepLink?.()
      })
    }
  }, [])
}

/**
 * useTrayStatus — 根据聊天状态自动切换托盘 tooltip(2026-07-29 #10 立)。
 *
 * 监听:
 * - chat.isStreaming → "thinking"(AI 正在生成回复)
 * - notification.unreadCount > 0 → "new_message"(有未读消息)
 * - 两者都无 → "idle"
 *
 * 优先级:thinking > new_message > idle
 * 浏览器端 isTauri()=false,setTrayStatus 为 no-op,无副作用。
 */
export function useTrayStatus(isStreaming: boolean, unreadCount: number): void {
  React.useEffect(() => {
    if (!isTauri()) return
    if (isStreaming) {
      void setTrayStatus('thinking')
    } else if (unreadCount > 0) {
      void setTrayStatus('new_message')
    } else {
      void setTrayStatus('idle')
    }
  }, [isStreaming, unreadCount])
}
