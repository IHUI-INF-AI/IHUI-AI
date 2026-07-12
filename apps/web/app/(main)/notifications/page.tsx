'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Bell,
  User,
  ShoppingCart,
  FolderGit,
  MessageSquare,
  AtSign,
  AlertCircle,
  CheckCheck,
  Loader2,
} from 'lucide-react'
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/notification-api'
import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { NotificationItem } from '@/components/business'
import { Timeline } from '@/components/data/Timeline'

type NotificationType = 'system' | 'order' | 'project' | 'comment' | 'mention' | 'follow'

interface Notification {
  id: string
  type: NotificationType
  title: string
  content: string | null
  isRead: boolean
  createdAt: string
}

const TYPE_ICON: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  system: Bell,
  order: ShoppingCart,
  project: FolderGit,
  comment: MessageSquare,
  mention: AtSign,
  follow: User,
}

const TABS: {
  value: 'all' | NotificationType
  labelKey: 'all' | 'system' | 'order' | 'project' | 'comment' | 'follow'
}[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'follow', labelKey: 'follow' },
  { value: 'system', labelKey: 'system' },
  { value: 'order', labelKey: 'order' },
  { value: 'project', labelKey: 'project' },
  { value: 'comment', labelKey: 'comment' },
]

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} 天前`
  return new Date(iso).toLocaleDateString()
}

async function unwrap<T>(p: Promise<{ success: boolean; data?: T; error?: string }>): Promise<T> {
  const r = await p
  if (!r.success) throw new Error(r.error)
  return r.data as T
}

export default function NotificationsPage() {
  const t = useTranslations('user.notifications')
  const qc = useQueryClient()
  const [tab, setTab] = React.useState<'all' | NotificationType>('all')
  const [view, setView] = React.useState<'list' | 'timeline'>('list')

  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', tab],
    queryFn: () => {
      const query: Record<string, string | number> = { page: 1, pageSize: 50 }
      if (tab !== 'all') query.type = tab
      return unwrap(getNotifications(query))
    },
  })

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => unwrap(getUnreadCount()),
  })

  const readMut = useMutation({
    mutationFn: (id: string) => unwrap(markNotificationRead(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const readAllMut = useMutation({
    mutationFn: () => unwrap(markAllNotificationsRead()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const notifications = (data?.list ?? []) as unknown as Notification[]
  const unread = unreadData?.count ?? 0

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Bell className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unread > 0 ? t('unreadCount', { count: unread }) : t('allRead')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => readAllMut.mutate()}
          disabled={unread === 0 || readAllMut.isPending}
        >
          <CheckCheck className="mr-1.5 h-4 w-4" />
          {t('markAllRead')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
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
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          <button
            onClick={() => setView('list')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'list'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('viewList')}
          </button>
          <button
            onClick={() => setView('timeline')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              view === 'timeline'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('viewTimeline')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="py-10 text-center text-destructive">{(error as Error).message}</div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <Bell className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('noData')}</p>
        </div>
      ) : view === 'timeline' ? (
        <div className="rounded-lg border p-4">
          <Timeline
            items={notifications.map((n) => {
              const Icon = TYPE_ICON[n.type] ?? AlertCircle
              return {
                title: n.title,
                description: n.content ?? undefined,
                time: relativeTime(n.createdAt),
                icon: Icon,
                color: n.isRead ? 'var(--muted-foreground)' : 'var(--primary)',
              }
            })}
          />
        </div>
      ) : (
        <div className="space-y-1 rounded-lg border">
          {notifications.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? AlertCircle
            return (
              <NotificationItem
                key={n.id}
                icon={Icon}
                title={n.title}
                content={n.content ?? undefined}
                time={relativeTime(n.createdAt)}
                read={n.isRead}
                onClick={() => !n.isRead && readMut.mutate(n.id)}
                className="rounded-none first:rounded-t-lg last:rounded-b-lg"
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
