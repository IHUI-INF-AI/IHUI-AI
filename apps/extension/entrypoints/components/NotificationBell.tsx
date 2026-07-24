/**
 * NotificationBell — 通知铃铛按钮 + 未读数 badge。
 * 通过 chrome.runtime.sendMessage 主动拉取未读数,WS 推送通过 onWsMessage 回调。
 */
import { useEffect, useState } from 'react'
import { sendMessage } from '../../lib/message-router'

export interface NotificationBellProps {
  initialCount?: number
  onOpen?: () => void
}

export function NotificationBell({ initialCount = 0, onOpen }: NotificationBellProps) {
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    // 拉取未读数(getUnreadCount API 代理)
    let cancelled = false
    void sendMessage<{ count: number }>({
      type: 'api.proxy',
      payload: { method: 'GET', path: '/api/notifications/unread-count' },
      requestId: `unread-${Date.now()}`,
    })
      .then((res) => {
        if (cancelled) return
        const c = (res as { count?: number })?.count
        if (typeof c === 'number') setCount(c)
      })
      .catch(() => {
        // API 不可用时保留 initialCount
      })

    // 监听 WS 推送增加
    const listener = (msg: { type?: string; payload?: { notification?: { type?: string } } }) => {
      if (msg?.type === 'ws.notification') {
        setCount((c) => c + 1)
      }
    }
    chrome.runtime.onMessage.addListener(
      listener as Parameters<typeof chrome.runtime.onMessage.addListener>[0],
    )
    return () => {
      cancelled = true
      chrome.runtime.onMessage.removeListener(
        listener as Parameters<typeof chrome.runtime.onMessage.removeListener>[0],
      )
    }
  }, [])

  return (
    <button
      type="button"
      className="relative bg-transparent border-none cursor-pointer p-0.5 text-base leading-none text-inherit"
      onClick={onOpen}
      aria-label="通知"
    >
      <span aria-hidden>🔔</span>
      {count > 0 ? (
        <span className="absolute -top-0.5 -right-1 min-w-4 h-4 px-1 bg-destructive text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center leading-none">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </button>
  )
}

export default NotificationBell
