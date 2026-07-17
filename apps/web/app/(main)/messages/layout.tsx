'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Bell, Heart, Star, MessageSquare, Users, Mail } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

type MessageType = 'notice' | 'like' | 'favorite' | 'comment' | 'fans' | 'private-letter'

interface UnreadCount {
  message: number
  notification: number
  total: number
  [key: string]: number
}

const TABS: { type: MessageType; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'notice', icon: Bell },
  { type: 'like', icon: Heart },
  { type: 'favorite', icon: Star },
  { type: 'comment', icon: MessageSquare },
  { type: 'fans', icon: Users },
  { type: 'private-letter', icon: Mail },
]

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const t = useTranslations('messages')
  const tp = useTranslations('privateMessages')

  const { data: unread } = useQuery({
    queryKey: ['unread-count'],
    queryFn: async () => {
      const r = await fetchApi<UnreadCount>('/api/notifications/unread-count')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    refetchInterval: 30000,
  })

  const getUnread = (type: MessageType): number => {
    if (!unread) return 0
    if (type === 'notice') return unread.notification ?? 0
    if (type === 'private-letter') return unread.message ?? 0
    return 0
  }

  const getLabel = (type: MessageType): string => {
    switch (type) {
      case 'notice':
        return t('tab.notice')
      case 'like':
        return t('tab.like')
      case 'favorite':
        return t('tab.favorite')
      case 'comment':
        return t('tab.comment')
      case 'fans':
        return t('tab.follow')
      case 'private-letter':
        return tp('title')
    }
  }

  const isActive = (type: MessageType) => pathname === `/messages/${type}`

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6">
      <aside className="hidden w-52 shrink-0 lg:block">
        <div className="sticky top-4 space-y-1">
          <h1 className="mb-3 px-3 text-lg font-semibold">{t('title')}</h1>
          <nav className="space-y-0.5">
            {TABS.map(({ type, icon: Icon }) => {
              const active = isActive(type)
              const count = getUnread(type)
              return (
                <Link
                  key={type}
                  href={`/messages/${type}`}
                  className={cn(
                    'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4" />
                    {getLabel(type)}
                  </span>
                  {count > 0 && (
                    <span className="rounded-md bg-red-500 px-1.5 text-xs text-white">{count}</span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center gap-1 overflow-x-auto lg:hidden">
          {TABS.map(({ type, icon: Icon }) => {
            const active = isActive(type)
            const count = getUnread(type)
            return (
              <Link
                key={type}
                href={`/messages/${type}`}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {getLabel(type)}
                {count > 0 && (
                  <span className="rounded-md bg-red-500 px-1 text-xs text-white">{count}</span>
                )}
              </Link>
            )
          })}
        </div>
        {children}
      </div>
    </div>
  )
}
