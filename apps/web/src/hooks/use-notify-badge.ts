'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'
import { useWebSocket, type WSNotification } from '@/hooks/use-websocket'

export interface NotifyBadgeItem {
  id: string
  type: string
  title: string
  read: boolean
  createdAt: string
}

export interface UseNotifyBadgeReturn {
  count: number
  unread: number
  items: NotifyBadgeItem[]
  loading: boolean
  markAllRead: () => Promise<void>
  refresh: () => Promise<void>
}

/** 通知徽章 Hook，初始拉取 + WebSocket 实时增量 */
export function useNotifyBadge(): UseNotifyBadgeReturn {
  const [items, setItems] = React.useState<NotifyBadgeItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const { lastMessage } = useWebSocket()

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApi<NotifyBadgeItem[]>('/api/notifications/badge')
      if (res.success) setItems(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  // WebSocket 推送新增通知
  React.useEffect(() => {
    if (!lastMessage) return
    const data: WSNotification['data'] = lastMessage.data
    if (data.type === 'notification') {
      setItems((prev) => [
        {
          id: String(data.id ?? Date.now()),
          type: data.type,
          title: String(data.title ?? '新通知'),
          read: false,
          createdAt: String(data.createdAt ?? new Date().toISOString()),
        },
        ...prev,
      ])
    }
  }, [lastMessage])

  const markAllRead = React.useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    await fetchApi('/api/notifications/badge/read-all', { method: 'POST' })
  }, [])

  const unread = React.useMemo(() => items.filter((n) => !n.read).length, [items])

  return { count: items.length, unread, items, loading, markAllRead, refresh }
}
