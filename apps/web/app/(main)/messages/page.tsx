'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  MessageSquare,
  Megaphone,
  Check,
  Loader2,
  Pin,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Announcement {
  id: string
  title: string
  content: string | null
  isTop: boolean
  publishTime: string | null
  createdAt: string
}
interface EduMessage {
  id: string
  title: string | null
  content: string | null
  msgType: string
  isRead: boolean
  createdAt: string
}
interface ListData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

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

export default function MessagesPage() {
  const t = useTranslations('messages')
  const qc = useQueryClient()
  const [tab, setTab] = React.useState<'announcements' | 'messages'>('messages')

  const { data: annData, isLoading: annLoading, error: annError } = useQuery({
    queryKey: ['messages', 'announcements'],
    queryFn: () =>
      api<ListData<Announcement>>(
        `/api/messages/announcements?page=1&pageSize=20`,
      ),
    enabled: tab === 'announcements',
  })

  const { data: msgData, isLoading: msgLoading, error: msgError } = useQuery({
    queryKey: ['messages', 'list'],
    queryFn: () => api<ListData<EduMessage>>(`/api/messages?page=1&pageSize=50`),
    enabled: tab === 'messages',
  })

  const { data: unreadData } = useQuery({
    queryKey: ['messages', 'unread-count'],
    queryFn: () => api<{ count: number }>(`/api/messages/unread-count`),
  })

  const readMut = useMutation({
    mutationFn: (id: string) =>
      api(`/api/messages/${id}/read`, { method: 'PUT' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  })

  const announcements = annData?.list ?? []
  const messages = msgData?.list ?? []
  const unread = unreadData?.count ?? 0
  const loading = tab === 'announcements' ? annLoading : msgLoading
  const error = tab === 'announcements' ? annError : msgError

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MessageSquare className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {unread > 0 ? t('unreadCount', { count: unread }) : t('allRead')}
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        <button
          onClick={() => setTab('messages')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            tab === 'messages'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {t('tab.messages')}
          {unread > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 text-xs text-white">
              {unread}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('announcements')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            tab === 'announcements'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Megaphone className="h-3.5 w-3.5" />
          {t('tab.announcements')}
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="py-10 text-center text-destructive">{(error as Error).message}</div>
      ) : tab === 'announcements' ? (
        announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <Megaphone className="h-8 w-8 opacity-40" />
            <p className="text-sm">{t('noAnnouncements')}</p>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {announcements.map((a) => (
              <li key={a.id} className="px-4 py-3 transition-colors hover:bg-muted/30">
                <div className="flex items-center gap-2">
                  {a.isTop && <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                  <p className="truncate text-sm font-medium">{a.title}</p>
                </div>
                {a.content && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.content}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {relativeTime(a.publishTime ?? a.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('noData')}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                'flex gap-3 px-4 py-3 transition-colors hover:bg-muted/30',
                !m.isRead && 'bg-primary/[0.03]',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{m.title ?? m.msgType}</p>
                  {!m.isRead && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-label="unread" />
                  )}
                </div>
                {m.content && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{m.content}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{relativeTime(m.createdAt)}</p>
              </div>
              {!m.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 self-center"
                  onClick={() => readMut.mutate(m.id)}
                  disabled={readMut.isPending}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  {t('markRead')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
