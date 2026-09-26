// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 链名: chain: continuous —— 本文件是桌面端「实时链」的唯一桥接端
// (Rust `window.emit("desktop-*")` → listen → window.dispatchEvent(new CustomEvent(...)))。
// 这条链刻意不带任何 id 与队列:页面尚未挂载监听时事件即丢失,这是投递面的事实而非缺陷,
// 也因此"补发/去重"这类机制不得搬进来(搬进来只会把投递失败伪装成已处理)。
// 断线后可恢复的那条链是 chain: replayable(见 use-agent-control.ts 的 agent.action 指令面),
// 两条链分属不同通道、各由 scripts/check-desktop-event-wiring.mjs 的规则 A–D(接线)与规则 E(分层)看守。

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
  isTrayAlwaysVisible,
  setTrayAlwaysVisible,
  resetWindowState,
  sendDesktopNotification,
  getSystemTheme,
  onSystemThemeChange,
  setTrayStatus,
  type DesktopAppInfo,
} from '@/lib/tauri-bridge'
import { logger } from '@/lib/logger'

/**
 * useDesktop — 客户端(Tauri WebView)能力统一 hook(2026-07-25 立)
 *
 * 封装:
 * - isDesktop:当前是否在 Tauri 客户端运行(非浏览器)
 * - appInfo:客户端应用信息(名称/版本/平台)
 * - isMaximized:主窗口是否最大化(实时同步)
 * - autostartEnabled:开机自启状态
 * - trayAlwaysVisible:托盘图标是否常驻任务栏(2026-09-02 #2 立)
 * - 操作:minimize / toggleMaximize / close / toggleAutostart / toggleTrayAlwaysVisible / resetWindow / notify
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
  const [trayAlwaysVisible, setTrayAlwaysVisibleState] = React.useState(true)
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
      try {
        const [info, maximized, autostart, trayVisible] = await Promise.all([
          getDesktopAppInfo(),
          isWindowMaximized(),
          isAutostartEnabled(),
          isTrayAlwaysVisible().catch(() => true),
        ])
        if (cancelled) return
        setAppInfo(info)
        setIsMaximized(maximized)
        setAutostartEnabled(autostart)
        setTrayAlwaysVisibleState(trayVisible)
      } catch {
        // 忽略桌面 API 错误
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isDesktop])

  // 监听窗口最大化状态变化(Resize 事件)
  React.useEffect(() => {
    if (!isDesktop) return
    let cancelled = false
    const onResize = () => {
      void isWindowMaximized()
        .then((m) => {
          if (!cancelled) setIsMaximized(m)
        })
        .catch(() => {})
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
    }
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

  /**
   * 切换"托盘图标常驻任务栏"(2026-09-02 #2 立)。
   * 返回切换后的状态,供调用方 toast 提示;旧客户端(未含新命令)回退本地翻转。
   */
  const toggleTrayAlwaysVisible = React.useCallback(async () => {
    const current = await isTrayAlwaysVisible().catch(() => true)
    const next = !current
    try {
      await setTrayAlwaysVisible(next)
    } catch {
      // 旧版本后端无此命令时静默降级(仅本地状态翻转)
    }
    setTrayAlwaysVisibleState(next)
    return next
  }, [])

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
    trayAlwaysVisible,
    loading,
    minimize,
    toggleMaximize,
    close,
    toggleAutostart,
    toggleTrayAlwaysVisible,
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
    void getSystemTheme()
      .then((theme) => {
        if (cancelled) return
        if (theme) setSystemTheme(theme)
      })
      .catch(() => {})

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
 * 转发策略(括号内为**实际消费方**,2026-09-22 补全地图:改派发前务必确认对端真的在监听):
 * - new_chat → global-shortcut:new-chat(SHORTCUT_ROUTES,providers/global-hooks-provider.tsx)
 * - toggle_theme → 下一个主题(next-themes setTheme,通过 CustomEvent 触发)
 *   · desktop-theme-toggle → providers/global-hooks-provider.tsx
 * - open_settings → 路由跳转 /settings
 *   · desktop-open-settings → providers/global-hooks-provider.tsx
 * - check_update → 触发 updater 检查(hooks/use-updater.ts)
 * - quick_screenshot → 触发截图(hooks/use-updater.ts 无关,走 global-shortcut:screenshot
 *   → components/chat/message-input.tsx 的 handleScreenshot)
 * - quit → hooks/use-quit-update-guard.ts(桌面端退出自动更新守卫)
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
            // 2026-09-22 修复:原派发 'desktop-quick-screenshot',而全仓无任何
            // addEventListener 监听该事件(Rust Ctrl+Shift+S 因此完全无反应)。
            // 改派发既有的 'global-shortcut:screenshot' —— 与浏览器内 Ctrl+Shift+M
            // 共用同一消费者(message-input.tsx 的 handleScreenshot:文件选择 +
            // 「可直接 Ctrl+V 粘贴」提示),符合"Web 无系统级截图 API,退化为文件选择"
            // 的既定降级策略。注意该消费者随 message-input 生命周期存在,
            // AI 面板未挂载时该快捷键仍为 no-op(属既有设计,非本次回归)。
            window.dispatchEvent(new CustomEvent('global-shortcut:screenshot'))
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

/** Rust 侧深链积压的取回命令名 —— 与 lib.rs 的 `DEEP_LINK_TAKE_COMMAND`、
 *  `invoke_handler!` 注册项逐字同名(三方一致性由 scripts/check-desktop-event-wiring.mjs G 组对账)。 */
const DEEP_LINK_TAKE_COMMAND = 'take_pending_deep_links'

/**
 * useDesktopDeepLink — 监听 desktop deep-link 事件,自动完成 SSO 登录闭环(2026-08-01 立)。
 *
 * 流程:
 * - Rust on_deeplink 捕获 `ihui://sso?sso_code=xxx` → emit "desktop-deep-link" 事件
 * - 本 hook 监听事件 → 调 handleDesktopDeepLink 解析 code + 换 token + 持久化
 *
 * 2026-09-26 A10C-1「未就绪不丢,就绪后补投」(冷启动必丢登录码的根治):
 * Rust 派发深链的时刻**早于**本 hook 注册监听的时刻(页面加载 + hydration + 动态 chunk),
 * 旧写法把外部浏览器/IM 回跳的 sso_code 丢在窗口期里(用户表现:点链接回 App 后登录转圈/无反应)。
 * 现:① 三个动态 chunk 并行拉取(窗口期从两段串行压到一段);② **listen() 注册成功之后立刻**
 * invoke 取回 Rust 侧积压,喂进与实时事件**同一条**处理链 `deliverDeepLinkUrl`,不另开第二条路径;
 * ③ "同一 URL 不重复处理"由 Rust 侧「取即清」保证 —— 本 hook 刻意不建去重集,
 * 那等于把实时链改造成隐形重放链(守门 check-desktop-event-wiring 规则 E1 拦的正是一型)。
 * 处理链只在真成功后 dispatch `desktop-sso-success`;失败一律留一行 warn(不得静默)。
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
      // 并行 import 而非串行 await:少一段 chunk 往返就少一段"窗口在、监听未生效"的丢码窗口期
      const [{ listen }, { invoke }, { handleDesktopDeepLink }] = await Promise.all([
        import('@tauri-apps/api/event'),
        import('@tauri-apps/api/core'),
        // 动态 import 避免浏览器端加载 desktop bridge 模块
        import('@/lib/sso-desktop-bridge'),
      ])
      if (cancelled) return

      unlistenDeepLink = await listen<string>('desktop-deep-link', (event) => {
        void deliverDeepLinkUrl(event.payload)
      })

      // 注册成功之后才取积压:在此之前的抵达都被 Rust 侧暂存(不会投给不存在的监听)
      try {
        const backlog = await invoke<string[]>(DEEP_LINK_TAKE_COMMAND)
        for (const url of backlog) {
          await deliverDeepLinkUrl(url)
        }
      } catch (err) {
        // 取不回积压 = 这一次冷启动的登录码仍然会丢,必须喊出来而不是静默继续
        logger.warn('[desktop] 取回深链积压失败,本次冷启动的深链未被补投:', err)
      }

      // 函数声明(整体提升)而非 const:监听回调可能在下面语句执行前就被触发
      async function deliverDeepLinkUrl(raw: string | undefined): Promise<void> {
        const url = (raw ?? '').trim()
        if (!url) return
        const ok = await handleDesktopDeepLink(url)
        if (ok) {
          window.dispatchEvent(new CustomEvent('desktop-sso-success'))
        } else {
          // 不打 URL 本体:其中 sso_code 是一次性凭据,不该进控制台/日志(§5e 同源要求)
          logger.warn('[desktop] deep-link 未被处理(无 sso_code 或 exchange 失败),已跳过')
        }
      }
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
