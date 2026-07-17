'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  Bell,
  ShoppingCart,
  FolderGit,
  MessageSquare,
  Loader2,
  CheckCheck,
  Check,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'

type NotificationType = 'system' | 'order' | 'project' | 'comment'

interface Notification {
  id: string
  type: NotificationType
  title: string
  content: string
  read: boolean
  createdAt: string
}

interface NotificationsData {
  list: Notification[]
  total: number
  unread: number
}

async function fetchNotifications(type: string): Promise<NotificationsData> {
  const qs = new URLSearchParams()
  if (type !== 'all') qs.set('type', type)
  const res = await fetchApi<NotificationsData>(`/api/notifications?${qs.toString()}`)
  if (!res.success) throw new Error(res.error)
  return res.data
}

const TYPE_ICON: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  system: Bell,
  order: ShoppingCart,
  project: FolderGit,
  comment: MessageSquare,
}

const TYPE_CLS: Record<NotificationType, string> = {
  system: 'bg-primary/10 text-primary',
  order: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  project: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  comment: 'bg-primary/10 text-primary',
}

const TABS: {
  value: 'all' | NotificationType
  labelKey: 'all' | 'system' | 'order' | 'project' | 'comment'
}[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'system', labelKey: 'system' },
  { value: 'order', labelKey: 'order' },
  { value: 'project', labelKey: 'project' },
  { value: 'comment', labelKey: 'comment' },
]

export default function NotificationsPage() {
  const t = useTranslations('user.notifications')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [tab, setTab] = React.useState<'all' | NotificationType>('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', tab],
    queryFn: () => fetchNotifications(tab),
  })

  const notifications = data?.list ?? []
  const unread = data?.unread ?? 0
  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const markRead = async (id: string) => {
    const res = await fetchApi(`/api/notifications/${id}/read`, { method: 'PATCH' })
    if (res.success) queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const markAllRead = async () => {
    const res = await fetchApi('/api/notifications/read-all', { method: 'POST' })
    if (res.success) queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unread > 0 ? t('unreadCount', { count: unread }) : t('allRead')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead} disabled={unread === 0}>
          <CheckCheck className="mr-1.5 h-4 w-4" />
          {t('markAllRead')}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.value}
            onClick={() => setTab(tabItem.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === tabItem.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tab.${tabItem.labelKey}`)}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="py-10 text-center text-destructive">{(error as Error).message}</div>
      ) : notifications.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">
          <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
          {t('noData')}
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {notifications.map((n) => {
            const Icon = TYPE_ICON[n.type]
            return (
              <li
                key={n.id}
                className={cn(
                  'flex gap-3 px-4 py-3 transition-colors hover:bg-muted/30',
                  !n.read && 'bg-primary/[0.03]',
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    TYPE_CLS[n.type],
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="break-words text-sm font-medium">{n.title}</p>
                    {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateFmt.format(new Date(n.createdAt))}
                  </p>
                </div>
                {!n.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 self-center"
                    onClick={() => markRead(n.id)}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    {t('markRead')}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
