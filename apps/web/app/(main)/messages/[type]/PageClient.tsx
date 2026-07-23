'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Bell, Heart, Star, MessageSquare, Users, Mail } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { Avatar } from '@/components/data'
import { cn } from '@/lib/utils'
import type { NotificationItem } from '@ihui/types'

type MessageType = 'notice' | 'like' | 'favorite' | 'comment' | 'fans' | 'private-letter'

const VALID_TYPES: MessageType[] = [
  'notice',
  'like',
  'favorite',
  'comment',
  'fans',
  'private-letter',
]

const NOTI_API_TYPE: Record<Exclude<MessageType, 'private-letter'>, string> = {
  notice: 'system',
  like: 'like',
  favorite: 'favorite',
  comment: 'comment',
  fans: 'follow',
}

const TYPE_ICON: Record<MessageType, React.ComponentType<{ className?: string }>> = {
  notice: Bell,
  like: Heart,
  favorite: Star,
  comment: MessageSquare,
  fans: Users,
  'private-letter': Mail,
}

interface Conversation {
  id: string
  peerName: string
  peerAvatar: string | null
  lastMessage: string
  lastTime: string
  unread: number
}

interface UnifiedItem {
  id: string
  title: string
  content: string
  avatar?: string | null
  isRead: boolean
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function MessageTypePage() {
  const params = useParams()
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type
  const type = rawType as MessageType
  const locale = useLocale()
  const qc = useQueryClient()
  const t = useTranslations('messages')
  const tp = useTranslations('privateMessages')

  const isValid = VALID_TYPES.includes(type)
  const isPrivateLetter = type === 'private-letter'

  const { data, isLoading, error } = useQuery({
    queryKey: ['messages-type', type],
    enabled: isValid,
    queryFn: async (): Promise<UnifiedItem[]> => {
      if (isPrivateLetter) {
        const res = await api<{ list: Conversation[] }>(`/api/messages/list?page=1&pageSize=50`)
        return (res.list ?? []).map((c): UnifiedItem => ({
          id: c.id,
          title: c.peerName,
          content: c.lastMessage,
          avatar: c.peerAvatar,
          isRead: c.unread === 0,
          createdAt: c.lastTime,
        }))
      }
      const apiType = NOTI_API_TYPE[type as Exclude<MessageType, 'private-letter'>]
      const res = await api<{ list: NotificationItem[] }>(
        `/api/notifications?type=${apiType}&page=1&pageSize=50`,
      )
      return (res.list ?? []).map((n): UnifiedItem => ({
        id: n.id,
        title: n.title,
        content: n.content ?? '',
        avatar: null,
        isRead: n.isRead,
        createdAt: n.createdAt,
      }))
    },
  })

  const readMut = useMutation({
    mutationFn: (id: string) => {
      if (isPrivateLetter) {
        return api(`/api/messages/${id}/read`, { method: 'POST' })
      }
      return api(`/api/notifications/${id}/read`, { method: 'PATCH' })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages-type', type] })
      qc.invalidateQueries({ queryKey: ['unread-count'] })
    },
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  if (!isValid) {
    return (
      <div className="mx-auto max-w-3xl py-10 text-center text-muted-foreground">{t('noData')}</div>
    )
  }

  const Icon = TYPE_ICON[type]
  const items = data ?? []
  const headerLabel = isPrivateLetter ? tp('title') : t(`tab.${type === 'fans' ? 'follow' : type}`)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Icon className="h-5 w-5 text-primary" />
          {headerLabel}
        </h2>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="py-10 text-center text-destructive">{(error as Error).message}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <Icon className="h-8 w-8 opacity-40" />
          <p className="text-sm">{isPrivateLetter ? tp('noConversations') : t('empty')}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  if (!item.isRead) readMut.mutate(item.id)
                }}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  !item.isRead && 'bg-primary/[0.03]',
                )}
              >
                <Avatar src={item.avatar ?? undefined} name={item.title} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="break-words text-sm font-medium">{item.title}</p>
                    {!item.isRead && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">
                    {item.content}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateFmt.format(new Date(item.createdAt))}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
