'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Bell, Megaphone, MessageCircle, UserCheck, Inbox } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface MessageAggregate {
  unreadCount: {
    total: number
    announcements: number
    private: number
    system: number
  }
}

interface MessageCategory {
  key: 'system' | 'interaction' | 'private' | 'announcement'
  href: string
  icon: React.ComponentType<{ className?: string }>
  countKey: keyof MessageAggregate['unreadCount']
}

const CATEGORIES: MessageCategory[] = [
  { key: 'system', href: '/message?tab=system', icon: Bell, countKey: 'system' },
  {
    key: 'interaction',
    href: '/message?tab=interaction',
    icon: UserCheck,
    countKey: 'system',
  },
  {
    key: 'private',
    href: '/message?tab=private',
    icon: MessageCircle,
    countKey: 'private',
  },
  {
    key: 'announcement',
    href: '/message?tab=announcement',
    icon: Megaphone,
    countKey: 'announcements',
  },
]

interface MessageSystemProps {
  className?: string
  /** 渲染紧凑模式(用于导航栏徽章 + 4 个分类入口);默认 false 渲染卡片样式 */
  compact?: boolean
}

async function fetchAggregate(): Promise<MessageAggregate> {
  const res = await fetchApi<MessageAggregate>('/api/messages/aggregate')
  if (res.success && res.data?.unreadCount) {
    return {
      unreadCount: {
        total: res.data.unreadCount.total ?? 0,
        announcements: res.data.unreadCount.announcements ?? 0,
        private: res.data.unreadCount.private ?? 0,
        system: res.data.unreadCount.system ?? 0,
      },
    }
  }
  return { unreadCount: { total: 0, announcements: 0, private: 0, system: 0 } }
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null
  const display = count > 99 ? '99+' : String(count)
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold leading-none text-white">
      {display}
    </span>
  )
}

export function MessageSystem({ className, compact = false }: MessageSystemProps) {
  const t = useTranslations('operation.messageSystem')
  const [data, setData] = React.useState<MessageAggregate>({
    unreadCount: { total: 0, announcements: 0, private: 0, system: 0 },
  })
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    fetchAggregate()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const total = data.unreadCount.total

  if (compact) {
    return (
      <Link
        href="/message"
        className={cn(
          'relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
          className,
        )}
        aria-label={
          total > 0
            ? `${t('messageCenterAria')},${t('unreadCount', { count: total })}`
            : t('messageCenterAria')
        }
      >
        <Inbox className="h-4 w-4" />
        {!loading && total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold leading-none text-white">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </Link>
    )
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Inbox className="h-4 w-4 text-primary" />
          {t('title')}
        </CardTitle>
        <Link
          href="/message"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {total > 0 ? t('unreadCount', { count: total }) : t('viewAll')}
        </Link>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        <div className="grid grid-cols-2 gap-1.5">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            const count = data.unreadCount[cat.countKey] ?? 0
            return (
              <Link
                key={cat.key}
                href={cat.href}
                className="group flex items-center gap-2.5 rounded-lg border border-transparent p-2.5 transition-colors hover:border-border hover:bg-muted/50"
              >
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Icon className="h-4 w-4" />
                  {!loading && count > 0 && <UnreadBadge count={count} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium leading-tight">
                    {t(`categories.${cat.key}`)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {!loading && count > 0 ? t('unreadCount', { count }) : t('noNewMessages')}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default MessageSystem
