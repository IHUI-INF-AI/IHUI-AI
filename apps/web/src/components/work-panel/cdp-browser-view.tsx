'use client'

/**
 * CDP 浏览器视图(2026-07-31 立,P0 WorkPanel CDP 升级)
 *
 * 对标 Trae/Cursor 内置浏览器:canvas 渲染后端 Chromium 推送的画面帧,
 * 鼠标/键盘/滚轮事件回传 WebSocket → 后端转发到真实 Chromium。
 *
 * 数据流:
 * - 后端定时截图轮询 → WebSocket 推送 JPEG base64 帧
 * - 前端 Image 解码 → canvas drawImage
 * - 鼠标事件 → 坐标转换(显示→设备) → WebSocket → CDP Input.dispatchMouseEvent
 * - 键盘事件 → key 映射 → WebSocket → CDP Input.dispatchKeyEvent
 *
 * 2026-07-31 完美化:
 * - hover 支持:mouseMoved 不再限于拖拽,节流 60ms 推送(覆盖 CSS hover/dropdown)
 * - 右键菜单:Back/Forward/Reload/Copy URL/Open External(对标 Chrome 右键菜单)
 */

import * as React from 'react'
import { createPortal } from 'react-dom'
import { Loader2, ArrowLeft, ArrowRight, RotateCw, Copy, ExternalLink } from 'lucide-react'

import { buildBrowserWsUrl, setBrowserWsToken } from '@ihui/api-client'
import { useAuthStore } from '@/stores/auth'

export interface CdpBrowserViewProps {
  /** Browser Hub 会话 ID(后端 createBrowserSession 返回) */
  sessionId: string
  /** 页面导航完成回调(传递最终 url + title) */
  onNavigation?: (url: string, title: string) => void
  /** 首帧渲染成功回调(等价于 iframe 的 onLoad) */
  onLoaded?: () => void
  /** 连接失败回调(等价于 iframe 的 onError) */
  onFailed?: (error: string) => void
  /** 右键菜单 - 后退(不传则隐藏该项) */
  onBack?: () => void
  /** 右键菜单 - 前进(不传则隐藏该项) */
  onForward?: () => void
  /** 右键菜单 - 刷新(不传则隐藏该项) */
  onReload?: () => void
  /** 右键菜单 - 在外部浏览器打开(不传则隐藏该项) */
  onOpenExternal?: () => void
  /** 当前 URL(用于右键菜单"复制链接") */
  currentUrl?: string
}

/** 计算修饰键 bitmask(CDP 协议:Alt=1, Ctrl=2, Meta=4, Shift=8) */
function getModifiers(e: React.MouseEvent | React.KeyboardEvent): number {
  let mods = 0
  if (e.altKey) mods |= 1
  if (e.ctrlKey) mods |= 2
  if (e.metaKey) mods |= 4
  if (e.shiftKey) mods |= 8
  return mods
}

/** 浏览器 key → CDP key 映射(大部分 key 直接可用,少数需转换) */
const KEY_MAP: Record<string, string> = {
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Delete: 'Delete',
  Escape: 'Escape',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Control: 'Control',
  Shift: 'Shift',
  Alt: 'Alt',
  Meta: 'Meta',
}

function mapKey(key: string): string {
  return KEY_MAP[key] ?? key
}

export function CdpBrowserView({
  sessionId,
  onNavigation,
  onLoaded,
  onFailed,
  onBack,
  onForward,
  onReload,
  onOpenExternal,
  currentUrl,
}: CdpBrowserViewProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const wsRef = React.useRef<WebSocket | null>(null)
  const imgRef = React.useRef<HTMLImageElement | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const hasFirstFrame = React.useRef(false)
  // 视口容器 ref(2026-08-17):ResizeObserver 将容器尺寸同步给后端 → 1:1 无缩放
  const containerRef = React.useRef<HTMLDivElement>(null)

  // hover 节流:last mouseMoved 发送时间(ms),60ms 节流覆盖 CSS hover/dropdown
  const lastMoveRef = React.useRef(0)
  const MOUSE_MOVE_THROTTLE_MS = 60

  // 右键菜单状态
  const [ctxMenu, setCtxMenu] = React.useState<{ x: number; y: number } | null>(null)
  const [copied, setCopied] = React.useState(false)
  // 2026-08-17:交互受限提示条(扫码登录只需展示二维码,用户用手机扫;避免误以为可随意点击)
  const [hintDismissed, setHintDismissed] = React.useState(false)

  // 开发者工具(2026-08-17):控制台日志 + JS 执行(类似 F12)
  const [devToolsOpen, setDevToolsOpen] = React.useState(false)
  const [jsCode, setJsCode] = React.useState('')
  const [jsResult, setJsResult] = React.useState('')
  const [consoleLogs, setConsoleLogs] = React.useState<string[]>([])
  const runJs = React.useCallback(() => {
    const ws = wsRef.current
    if (!ws || !jsCode.trim()) return
    const script = jsCode.trim()
    const onResult = (e: MessageEvent) => {
      try {
        const m = JSON.parse(e.data as string)
        if (m.type === 'execute_result') {
          setJsResult(typeof m.data === 'string' ? m.data : JSON.stringify(m.data, null, 2))
          ws.removeEventListener('message', onResult)
        } else if (m.type === 'error' && m.event === 'execute') {
          setJsResult(`执行出错: ${m.message ?? '未知错误'}`)
          ws.removeEventListener('message', onResult)
        }
      } catch {
        /* ignore */
      }
    }
    ws.addEventListener('message', onResult)
    ws.send(JSON.stringify({ type: 'execute', script }))
  }, [jsCode])

  // 回调 ref(避免 effect 依赖变化导致 WebSocket 重连)
  const cbRefs = React.useRef({ onNavigation, onLoaded, onFailed })
  React.useEffect(() => {
    cbRefs.current = { onNavigation, onLoaded, onFailed }
  })

  // 视口同步(2026-08-17 1:1 无缩放):前端容器尺寸 → 后端 Playwright 视口。
  // 关键:仅当 WS 处于 OPEN **且实际发送**后才记录 key —— 否则 mount 时 WS 未连接
  // 首帧 set_viewport 静默丢失(若提前记录 key,连接后不再补发 → 缩放/letterbox 复现)。
  // WS onopen 时由连接 effect 调用补发,容器 resize 时由 ResizeObserver 调用。
  const viewportSentRef = React.useRef('')
  const syncViewport = React.useCallback(() => {
    const container = containerRef.current
    const ws = wsRef.current
    if (!container || !ws || ws.readyState !== WebSocket.OPEN) return
    const w = container.clientWidth
    const h = container.clientHeight
    if (w <= 0 || h <= 0) return
    const key = `${w}x${h}`
    if (viewportSentRef.current === key) return
    viewportSentRef.current = key
    ws.send(JSON.stringify({ type: 'set_viewport', width: w, height: h }))
  }, [])

  // 建立 WebSocket 连接 + 接收画面帧
  // disposed flag:防止 React StrictMode 双渲染(dev 模式 mount→unmount→mount)
  // 导致第一个 WebSocket 被 cleanup 关闭后,onerror/onclose 仍触发 store.onFailed
  // → onFailed 又创建新 CDP 会话 → 竞态条件 → 显示"浏览器连接失败"
  React.useEffect(() => {
    setLoading(true)
    setError(null)
    hasFirstFrame.current = false
    // 新会话 → 重置已同步视口标记(后端新会话默认视口可能 ≠ 容器尺寸)
    viewportSentRef.current = ''

    // P0-4(2026-08-05):ai-service WS 握手要求 access token,连接前注入当前 token
    setBrowserWsToken(useAuthStore.getState().token ?? '')
    const wsUrl = buildBrowserWsUrl(sessionId)
    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'WebSocket 创建失败'
      setError(msg)
      cbRefs.current.onFailed?.(msg)
      return
    }
    wsRef.current = ws

    // disposed=true 后所有 ws 回调静默 return,不触发 setState / onFailed
    let disposed = false

    // 2026-08-17:连接建立后再同步视口(mount 时 WS 未 OPEN,syncViewport 跳过且不记录 key)
    ws.onopen = () => {
      if (disposed) return
      syncViewport()
    }

    ws.onmessage = (event) => {
      if (disposed) return
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string
          data?: string
          metadata?: { device_width?: number; device_height?: number }
          url?: string
          title?: string
          message?: string
        }
        if (msg.type === 'frame' && msg.data) {
          // 复用 Image 对象(设置新 src 会取消旧加载,自动节流到最新帧)
          const img = imgRef.current ?? new Image()
          img.onload = () => {
            if (disposed) return
            const canvas = canvasRef.current
            if (!canvas) return
            const ctx = canvas.getContext('2d')
            if (!ctx) return
            const dw = msg.metadata?.device_width ?? 1280
            const dh = msg.metadata?.device_height ?? 720
            if (canvas.width !== dw) canvas.width = dw
            if (canvas.height !== dh) canvas.height = dh
            ctx.drawImage(img, 0, 0, dw, dh)
            if (!hasFirstFrame.current) {
              hasFirstFrame.current = true
              setLoading(false)
              cbRefs.current.onLoaded?.()
            }
          }
          img.src = `data:image/jpeg;base64,${msg.data}`
          imgRef.current = img
        } else if (msg.type === 'navigation' && msg.url) {
          if (disposed) return
          cbRefs.current.onNavigation?.(msg.url, msg.title ?? '')
        }
      } catch {
        // 静默处理解析错误
      }
    }

    ws.onerror = () => {
      if (disposed) return
      // 检查 ai-service 是否在线(给用户更有用的错误提示)
      const msg = '浏览器连接失败,请确认 AI 服务(8803)正在运行'
      setError(msg)
      cbRefs.current.onFailed?.(msg)
    }

    ws.onclose = (e) => {
      if (disposed) return
      if (e.code !== 1000 && !hasFirstFrame.current) {
        const msg = e.reason || '浏览器连接已关闭'
        setError(msg)
        cbRefs.current.onFailed?.(msg)
      }
    }

    return () => {
      disposed = true
      ws.close()
      wsRef.current = null
    }
  }, [sessionId, syncViewport])

  // 坐标转换:canvas 显示坐标 → 设备坐标(后端 Chromium 视口)
  // 2026-08-17 重构:视口实时同步为前端容器尺寸(WS set_viewport) → 截图 = 容器 = canvas,
  // **1:1 无缩放、无 letterbox** —— 像正常浏览器一样,点哪打哪(device = clientX)。
  // 容器 resize 时通过 WS 通知后端调整 Playwright 视口,截图帧按新尺寸推送。
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(syncViewport)
    ro.observe(container)
    return () => ro.disconnect()
  }, [syncViewport])

  const toDeviceCoords = React.useCallback((clientX: number, clientY: number) => {
    // 视口 = 容器(canvas 1:1),CSS 坐标 = 设备坐标
    return { x: clientX, y: clientY }
  }, [])

  const sendMouse = React.useCallback(
    (
      e: React.MouseEvent<HTMLCanvasElement>,
      eventType: 'mousePressed' | 'mouseReleased' | 'mouseMoved',
      clickCount: number,
    ) => {
      e.preventDefault()
      const { x, y } = toDeviceCoords(e.clientX, e.clientY)
      const button = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left'
      // 2026-08-17 调试:扫码登录"点不了按钮"排查 — 记录点击坐标与 WS 状态(控制台可见)
      const log = `[cdp-browser-view] ${eventType} client=(${Math.round(e.clientX)},${Math.round(e.clientY)}) device=(${Math.round(x)},${Math.round(y)}) ws=${wsRef.current ? 'connected' : 'NULL'}`
      console.info(log)
      setConsoleLogs((prev) => [...prev, log].slice(-60))
      wsRef.current?.send(
        JSON.stringify({
          type: 'mouse',
          x,
          y,
          button: eventType === 'mouseMoved' ? 'none' : button,
          event_type: eventType,
          click_count: clickCount,
          modifiers: getModifiers(e),
        }),
      )
    },
    [toDeviceCoords],
  )

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // 点击 canvas 获取焦点(键盘事件需要)
      e.currentTarget.focus()
      sendMouse(e, 'mousePressed', 1)
    },
    [sendMouse],
  )

  const handleMouseUp = React.useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => sendMouse(e, 'mouseReleased', 1),
    [sendMouse],
  )

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // 2026-07-31 完美化:hover 支持
      // 原实现仅拖拽时发送 mouseMoved(buttons===0 跳过),导致 CSS hover/dropdown 无法触发
      // 现改为:始终发送,但节流 60ms(~16fps),避免高频 mouseMoved 淹没 WebSocket
      // 拖拽时(buttons>0)不节流,保证拖拽轨迹流畅
      const now = Date.now()
      if (e.buttons === 0) {
        // 纯 hover:节流
        if (now - lastMoveRef.current < MOUSE_MOVE_THROTTLE_MS) return
        lastMoveRef.current = now
      }
      sendMouse(e, 'mouseMoved', 0)
    },
    [sendMouse],
  )

  const handleWheel = React.useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const { x, y } = toDeviceCoords(e.clientX, e.clientY)
      wsRef.current?.send(
        JSON.stringify({
          type: 'wheel',
          x,
          y,
          delta_x: e.deltaX,
          delta_y: e.deltaY,
        }),
      )
    },
    [toDeviceCoords],
  )

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
    // 阻止浏览器快捷键(Ctrl+R/F5 等)干扰 CDP 浏览器
    const key = e.key.toLowerCase()
    if (e.ctrlKey && ['r', 'w', 'n', 't', 'f'].includes(key)) {
      e.preventDefault()
    } else if (e.key === 'F12') {
      // 2026-08-17:F12 切换开发者工具(代替原生 DevTools,与浮动 </> 按钮等价)
      e.preventDefault()
      setDevToolsOpen((o) => !o)
    } else if (['F5', 'F11'].includes(e.key)) {
      e.preventDefault()
    } else {
      e.preventDefault()
    }
    wsRef.current?.send(
      JSON.stringify({
        type: 'key',
        key: mapKey(e.key),
        event_type: 'keyDown',
        modifiers: getModifiers(e),
        text: e.key.length === 1 ? e.key : undefined,
      }),
    )
  }, [])

  const handleKeyUp = React.useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    wsRef.current?.send(
      JSON.stringify({
        type: 'key',
        key: mapKey(e.key),
        event_type: 'keyUp',
        modifiers: getModifiers(e),
      }),
    )
  }, [])

  // 右键菜单:阻止默认 + 弹出自定义菜单
  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      // 先发送右键点击到 CDP(让页面触发 contextmenu 事件)
      sendMouse(e, 'mousePressed', 1)
      // 弹出菜单(fixed 定位,避免 overflow 裁剪)
      setCtxMenu({ x: e.clientX, y: e.clientY })
    },
    [sendMouse],
  )

  // 右键菜单:点击外部/ESC 关闭
  React.useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [ctxMenu])

  // 右键菜单:复制链接
  const handleCopyUrl = React.useCallback(async () => {
    if (!currentUrl) return
    try {
      await navigator.clipboard.writeText(currentUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard 不可用时静默
    }
    setCtxMenu(null)
  }, [currentUrl])

  // 右键菜单项
  const menuItems = React.useMemo(() => {
    const items: Array<{
      key: string
      label: string
      icon: typeof ArrowLeft
      onClick: () => void
      disabled?: boolean
    }> = []
    if (onBack) {
      items.push({
        key: 'back',
        label: '后退',
        icon: ArrowLeft,
        onClick: () => {
          onBack()
          setCtxMenu(null)
        },
      })
    }
    if (onForward) {
      items.push({
        key: 'forward',
        label: '前进',
        icon: ArrowRight,
        onClick: () => {
          onForward()
          setCtxMenu(null)
        },
      })
    }
    if (onReload) {
      items.push({
        key: 'reload',
        label: '刷新',
        icon: RotateCw,
        onClick: () => {
          onReload()
          setCtxMenu(null)
        },
      })
    }
    if (currentUrl) {
      items.push({
        key: 'copy',
        label: copied ? '已复制' : '复制链接地址',
        icon: Copy,
        onClick: handleCopyUrl,
      })
    }
    if (onOpenExternal) {
      items.push({
        key: 'external',
        label: '在外部浏览器打开',
        icon: ExternalLink,
        onClick: () => {
          onOpenExternal()
          setCtxMenu(null)
        },
      })
    }
    return items
  }, [onBack, onForward, onReload, onOpenExternal, currentUrl, copied, handleCopyUrl])

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-background">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-default object-cover"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onContextMenu={handleContextMenu}
        tabIndex={0}
      />
      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 p-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      {/* 2026-08-17:交互受限提示条 —— 诚实告知这是自动化截图视图,扫码用手机、完整操作走外部浏览器 */}
      {!hintDismissed && !error && (
        <div className="absolute inset-x-2 bottom-2 z-10 flex items-center gap-2 rounded-md border border-border bg-background/95 px-2.5 py-1.5 shadow-sm">
          <span className="flex-1 text-[10px] leading-relaxed text-muted-foreground">
            此视图为自动化截图,交互受限 — 扫码请用手机扫;完整操作请在外部浏览器打开
          </span>
          <button
            type="button"
            onClick={() => setHintDismissed(true)}
            className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
            aria-label="关闭提示"
          >
            知道了
          </button>
        </div>
      )}
      {/* 开发者工具(F12):浮动按钮 + 控制台日志 + JS 执行(2026-08-17) */}
      <button
        type="button"
        onClick={() => setDevToolsOpen((o) => !o)}
        className="absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-md border border-border bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
        aria-label="开发者工具"
      >
        <span className="font-mono font-semibold">{'</>'}</span>
        开发者工具
      </button>
      {devToolsOpen && (
        <div className="absolute inset-x-2 bottom-2 top-10 z-20 flex flex-col overflow-hidden rounded-md border border-border bg-background/95 shadow-lg">
          <div className="flex items-center justify-between border-b border-border/60 px-2 py-1">
            <span className="text-[10px] font-semibold">开发者工具</span>
            <button type="button" onClick={() => setDevToolsOpen(false)} className="text-[10px] text-muted-foreground hover:text-foreground">
              关闭
            </button>
          </div>
          <div className="flex-1 overflow-auto p-1.5">
            <div className="mb-1.5 text-[10px] font-medium text-muted-foreground">控制台日志</div>
            <pre className="thin-scroll max-h-32 overflow-auto rounded bg-muted/40 p-1.5 font-mono text-[9px] leading-relaxed text-muted-foreground">
              {consoleLogs.length === 0 ? '(暂无日志 — 在页面上点击操作后会显示坐标信息)' : consoleLogs.join('\n')}
            </pre>
            <div className="mb-1 mt-2 text-[10px] font-medium text-muted-foreground">执行 JavaScript</div>
            <textarea
              value={jsCode}
              onChange={(e) => setJsCode(e.target.value)}
              placeholder={'document.title  —  输入 JS 后点执行(如: document.querySelector("button").click())'}
              className="h-14 w-full resize-none rounded border border-input bg-background p-1.5 font-mono text-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={runJs}
              disabled={!jsCode.trim()}
              className="mt-1 rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground disabled:opacity-50"
            >
              执行
            </button>
            {jsResult && (
              <pre className="thin-scroll mt-1.5 max-h-24 overflow-auto rounded bg-muted/40 p-1.5 font-mono text-[9px] leading-relaxed text-foreground">
                {jsResult}
              </pre>
            )}
          </div>
        </div>
      )}
      {/* 右键菜单(portal 到 body,避免 overflow 裁剪) */}
      {ctxMenu &&
        menuItems.length > 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="menu"
            tabIndex={-1}
            className="fixed z-popover min-w-[180px] rounded-md border border-border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95 duration-100 focus:outline-none"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={item.onClick}
                  className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}
