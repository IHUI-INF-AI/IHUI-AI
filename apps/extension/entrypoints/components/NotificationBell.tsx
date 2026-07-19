/**
 * NotificationBell — 通知铃铛按钮 + 未读数 badge。
 * 通过 chrome.runtime.sendMessage 主动拉取未读数,WS 推送通过 onWsMessage 回调。
 */
import { type CSSProperties, useEffect, useState } from 'react'
import { sendMessage } from '../../lib/message-router'

export interface NotificationBellProps {
  initialCount?: number
  onOpen?: () => void
}

const btnStyle: CSSProperties = {
  position: 'relative',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 2,
  fontSize: 16,
  lineHeight: 1,
  color: 'inherit',
}

const badgeStyle: CSSProperties = {
  position: 'absolute',
  top: -2,
  right: -4,
  minWidth: 16,
  height: 16,
  padding: '0 4px',
  background: '#ef4444',
  color: '#fff',
  fontSize: 10,
  fontWeight: 600,
  borderRadius: 8,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
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
    chrome.runtime.onMessage.addListener(listener as Parameters<typeof chrome.runtime.onMessage.addListener>[0])
    return () => {
      cancelled = true
      chrome.runtime.onMessage.removeListener(listener as Parameters<typeof chrome.runtime.onMessage.removeListener>[0])
    }
  }, [])

  return (
    <button type="button" style={btnStyle} onClick={onOpen} aria-label="通知">
      <span aria-hidden>🔔</span>
      {count > 0 ? <span style={badgeStyle}>{count > 99 ? '99+' : count}</span> : null}
    </button>
  )
}

export default NotificationBell
