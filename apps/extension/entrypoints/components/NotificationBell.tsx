// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * NotificationBell — 通知铃铛按钮 + 未读数 badge。
 * 通过 chrome.runtime.sendMessage 主动拉取未读数,WS 推送通过 onWsMessage 回调。
 */
import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { sendMessage } from '../../lib/message-router'

export interface NotificationBellProps {
  initialCount?: number
  onOpen?: () => void
}

export function NotificationBell({ initialCount = 0, onOpen }: NotificationBellProps) {
  const [count, setCount] = useState(initialCount)

  // 未读数取服务端真相(与 web 同纪律)。此前 WS 帧裸 +1 只增不减:他端已读/删除后
  // 角标永久偏高,重连重放又会重复 +1。改为每次都重拉 getUnreadCount(API 代理)。
  const refreshCount = useCallback(() => {
    void sendMessage<{ count: number }>({
      type: 'api.proxy',
      payload: { method: 'GET', path: '/api/notifications/unread-count' },
      requestId: `unread-${Date.now()}`,
    })
      .then((res) => {
        const c = (res as { count?: number })?.count
        if (typeof c === 'number') setCount(c)
      })
      .catch(() => {
        // API 不可用时保留上次值,不冒充 0
      })
  }, [])

  useEffect(() => {
    // 挂载拉一次权威未读数
    refreshCount()

    // WS 通知帧到达后重拉服务端真相(不再裸 +1)
    const listener = (msg: { type?: string; payload?: unknown }) => {
      if (msg?.type !== 'ws.notification') return
      // 过滤 agent.action 控制指令(由 background agent-control bridge 处理,
      // 不是用户通知)。兼容直接 / {notification: ...} 包装两种 payload 格式。
      const payload = msg.payload as
        { data?: { type?: string }; notification?: { data?: { type?: string } } } | undefined
      const inner = payload?.notification
      const dataType =
        payload?.data?.type ?? (inner && typeof inner === 'object' ? inner.data?.type : undefined)
      if (dataType === 'agent.action') return
      refreshCount()
    }
    chrome.runtime.onMessage.addListener(
      listener as Parameters<typeof chrome.runtime.onMessage.addListener>[0],
    )
    return () => {
      chrome.runtime.onMessage.removeListener(
        listener as Parameters<typeof chrome.runtime.onMessage.removeListener>[0],
      )
    }
  }, [refreshCount])

  return (
    <button
      type="button"
      className="relative bg-transparent border-none cursor-pointer p-0.5 text-base leading-none text-inherit"
      onClick={onOpen}
      aria-label="通知"
    >
      <Bell size={16} className="shrink-0" aria-hidden />
      {count > 0 ? (
        <span className="absolute -top-0.5 -right-1 min-w-4 h-4 px-1 bg-destructive text-white text-xs font-semibold rounded-md inline-flex items-center justify-center leading-none">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </button>
  )
}

export default NotificationBell
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
