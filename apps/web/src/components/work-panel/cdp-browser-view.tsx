'use client'

/**
 * CDP 浏览器视图(2026-07-31 立,P0 WorkPanel CDP 升级)
 *
 * 对标 Trae/Cursor 内置浏览器:canvas 渲染后端 Chromium 推送的画面帧,
 * 鼠标/键盘/滚轮事件回传 WebSocket → 后端转发到真实 Chromium。
 *
 * 数据流:
 * - 后端 CDP Page.startScreencast → WebSocket 推送 JPEG base64 帧
 * - 前端 Image 解码 → canvas drawImage
 * - 鼠标事件 → 坐标转换(显示→设备) → WebSocket → CDP Input.dispatchMouseEvent
 * - 键盘事件 → key 映射 → WebSocket → CDP Input.dispatchKeyEvent
 */

import * as React from 'react'
import { Loader2 } from 'lucide-react'

import { buildBrowserWsUrl } from '@ihui/api-client'

export interface CdpBrowserViewProps {
  /** Browser Hub 会话 ID(后端 createBrowserSession 返回) */
  sessionId: string
  /** 页面导航完成回调(传递最终 url + title) */
  onNavigation?: (url: string, title: string) => void
  /** 首帧渲染成功回调(等价于 iframe 的 onLoad) */
  onLoaded?: () => void
  /** 连接失败回调(等价于 iframe 的 onError) */
  onFailed?: (error: string) => void
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
}: CdpBrowserViewProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const wsRef = React.useRef<WebSocket | null>(null)
  const imgRef = React.useRef<HTMLImageElement | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const hasFirstFrame = React.useRef(false)

  // 回调 ref(避免 effect 依赖变化导致 WebSocket 重连)
  const cbRefs = React.useRef({ onNavigation, onLoaded, onFailed })
  React.useEffect(() => {
    cbRefs.current = { onNavigation, onLoaded, onFailed }
  })

  // 建立 WebSocket 连接 + 接收画面帧
  React.useEffect(() => {
    setLoading(true)
    setError(null)
    hasFirstFrame.current = false

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

    ws.onmessage = (event) => {
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
          cbRefs.current.onNavigation?.(msg.url, msg.title ?? '')
        }
      } catch {
        // 静默处理解析错误
      }
    }

    ws.onerror = () => {
      const msg = '浏览器连接失败'
      setError(msg)
      cbRefs.current.onFailed?.(msg)
    }

    ws.onclose = (e) => {
      if (e.code !== 1000 && !hasFirstFrame.current) {
        const msg = e.reason || '浏览器连接已关闭'
        setError(msg)
        cbRefs.current.onFailed?.(msg)
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [sessionId])

  // 坐标转换:canvas 显示坐标 → 设备坐标(后端 Chromium 视口)
  const toDeviceCoords = React.useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }, [])

  const sendMouse = React.useCallback(
    (
      e: React.MouseEvent<HTMLCanvasElement>,
      eventType: 'mousePressed' | 'mouseReleased' | 'mouseMoved',
      clickCount: number,
    ) => {
      e.preventDefault()
      const { x, y } = toDeviceCoords(e.clientX, e.clientY)
      const button =
        e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left'
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
      // 仅拖拽时发送 mouseMoved(降低频率,hover 场景暂不支持)
      if (e.buttons === 0) return
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

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      // 阻止浏览器快捷键(Ctrl+R/F5 等)干扰 CDP 浏览器
      const key = e.key.toLowerCase()
      if (
        e.ctrlKey &&
        ['r', 'w', 'n', 't', 'f'].includes(key)
      ) {
        e.preventDefault()
      } else if (['F5', 'F11', 'F12'].includes(e.key)) {
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
    },
    [],
  )

  const handleKeyUp = React.useCallback(
    (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      wsRef.current?.send(
        JSON.stringify({
          type: 'key',
          key: mapKey(e.key),
          event_type: 'keyUp',
          modifiers: getModifiers(e),
        }),
      )
    },
    [],
  )

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-default object-contain"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onContextMenu={(e) => e.preventDefault()}
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
    </div>
  )
}
