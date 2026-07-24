import { useEffect, useState } from 'react'
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

export default function NotificationsPage() {
  const { t } = useI18n()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [listRes, countRes] = await Promise.all([
        getNotifications({ page: 1, pageSize: 30 }),
        getUnreadCount(),
      ])
      if (listRes.success) setItems(listRes.data.list)
      else setError(listRes.error || t('common.failed'))
      if (countRes.success) setUnread(countRes.data.notification ?? 0)
    } catch {
      setError(t('common.failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onMarkAll = async () => {
    const res = await markAllNotificationsRead()
    if (res.success) {
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnread(0)
    }
  }

  const onMarkOne = async (id: string) => {
    const res = await markNotificationRead(id)
    if (res.success) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
      setUnread((u) => Math.max(0, u - 1))
    }
  }

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8 px-4 text-sm">
        {t('common.loading')}
      </div>
    )
  }
  if (error) {
    return (
      <div className="m-2 bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive text-xs">
        <div className="mb-2">{error}</div>
        <button
          type="button"
          onClick={load}
          className="px-2 py-1 rounded-md border border-destructive bg-transparent text-destructive text-xs cursor-pointer hover:bg-destructive/10"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('apps.notifications')}</h3>
        {unread > 0 ? (
          <button
            type="button"
            onClick={onMarkAll}
            className="text-xs text-primary bg-transparent border-none cursor-pointer hover:underline py-1 px-1"
          >
            {t('notification.markAllRead')}({unread})
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        items.map((n) => (
          <Card
            key={n.id}
            className={`cursor-pointer hover:bg-muted/50 transition-colors ${n.isRead ? '' : 'border-primary/40'}`}
            onClick={() => !n.isRead && onMarkOne(n.id)}
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm flex-1 min-w-0">{n.title}</div>
                {!n.isRead ? (
                  <span
                    className="w-1.5 h-1.5 rounded-md bg-destructive shrink-0 mt-1.5"
                    aria-label="unread"
                  />
                ) : null}
              </div>
              {n.content ? (
                <div className="text-xs text-muted-foreground mt-1 break-words">{n.content}</div>
              ) : null}
              <div className="text-[11px] text-muted-foreground mt-1.5">
                {new Intl.DateTimeFormat('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(n.createdAt))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
