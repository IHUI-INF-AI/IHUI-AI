// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Bell, Heart, Star, MessageSquare, Users, Mail } from 'lucide-react'
import { apiOrThrow } from '@/lib/api'
import { Avatar } from '@/components/data'
import { cn } from '@/lib/utils'
import type { NotificationItem } from '@ihui/types'
import { BackButton } from '@/components/common'
import { Button } from '@ihui/ui-react'
import { AuthGatePrompt } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'

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

/**
 * i18n 静态映射表 — 用于消除 `t(`tab.${type === 'fans' ? 'follow' : type}`)` 动态拼接
 * 'fans' 在 UI tab 中映射为 'follow',其余原样;'private-letter' 不会到达(isPrivateLetter 时走 tp('title')),兜底 'tab.unknown'
 */
const TAB_LABEL_KEY: Record<MessageType, string> = {
  notice: 'tab.notice',
  like: 'tab.like',
  favorite: 'tab.favorite',
  comment: 'tab.comment',
  fans: 'tab.follow',
  'private-letter': 'tab.unknown',
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

export default function MessageTypePage() {
  const params = useParams()
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type
  const type = rawType as MessageType
  const locale = useLocale()
  const qc = useQueryClient()
  const t = useTranslations('messages')
  const tp = useTranslations('privateMessages')
  const tGate = useTranslations('chatHistory')
  const tc = useTranslations('common')
  const { allow } = useAuthGate()

  const isValid = VALID_TYPES.includes(type)
  const isPrivateLetter = type === 'private-letter'

  const PAGE_SIZE = 10
  // 分页:原实现固定 page=1&pageSize=10 且页面上没有任何"加载更多" ⇒ 第 11 条起永远看不到,
  // 用户会以为更早的消息不存在了。改 useInfiniteQuery,按后端 total 判是否还有下一页。
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['messages-type', type],
      enabled: allow && isValid,
      initialPageParam: 1,
      queryFn: async ({ pageParam }): Promise<{ items: UnifiedItem[]; hasMore: boolean }> => {
        const page = pageParam
        if (isPrivateLetter) {
          const res = await apiOrThrow<{ list: Conversation[] }>(
            `/api/messages/list?page=${page}&pageSize=${PAGE_SIZE}`,
          )
          const items = (res.list ?? []).map((c): UnifiedItem => ({
            id: c.id,
            title: c.peerName,
            content: c.lastMessage,
            avatar: c.peerAvatar,
            isRead: c.unread === 0,
            createdAt: c.lastTime,
          }))
          // 私信接口不回 total ⇒ 以"这一页是否满"作为可能还有下一页的判据
          return { items, hasMore: items.length === PAGE_SIZE }
        }
        const apiType = NOTI_API_TYPE[type as Exclude<MessageType, 'private-letter'>]
        // 「赞」「收藏」两类的 apiType 是 like / favorite,而后端通知类型 enum 只有
        // system / order / project / comment / mention / follow ⇒ querystring schema 直接判 400,
        // 页面只剩一段技术错误文案,永远看不到内容。这两类目前没有数据来源,按空态处理,
        // 不发一条注定失败的请求(将来有真数据源再回来接线,不要靠改映射蒙一个相近类型)。
        if (apiType === 'like' || apiType === 'favorite') return { items: [], hasMore: false }
        const res = await apiOrThrow<{ list: NotificationItem[]; total?: number }>(
          `/api/notifications?type=${apiType}&page=${page}&pageSize=${PAGE_SIZE}`,
        )
        const items = (res.list ?? []).map((n): UnifiedItem => ({
          id: n.id,
          title: n.title,
          content: n.content ?? '',
          avatar: null,
          isRead: n.isRead,
          createdAt: n.createdAt,
        }))
        const total = res.total ?? items.length
        return { items, hasMore: page * PAGE_SIZE < total }
      },
      getNextPageParam: (last, all) => (last.hasMore ? all.length + 1 : undefined),
    })
  const items = data?.pages.flatMap((p) => p.items) ?? []

  const readMut = useMutation({
    mutationFn: (id: string) => {
      if (isPrivateLetter) {
        return apiOrThrow(`/api/messages/${id}/read`, { method: 'POST' })
      }
      return apiOrThrow(`/api/notifications/${id}/read`, { method: 'PATCH' })
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
  const headerLabel = isPrivateLetter ? tp('title') : t(TAB_LABEL_KEY[type] ?? 'tab.unknown')

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BackButton />
      <div>
        <h2 className="flex min-w-0 items-center gap-2 text-heading font-bold tracking-tight">
          <Icon className="h-5 w-5 shrink-0 text-primary" />
          <span className="whitespace-nowrap">{headerLabel}</span>
        </h2>
      </div>

      {!allow ? (
        <AuthGatePrompt message={tGate('loginRequired')} />
      ) : isLoading ? (
        <div className="whitespace-nowrap py-8 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="py-8 text-center text-destructive">{(error as Error).message}</div>
      ) : items.length === 0 ? (
        <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
          <Icon className="h-8 w-8 opacity-40" />
          <p className="text-sm">{isPrivateLetter ? tp('noConversations') : t('empty')}</p>
        </div>
      ) : (
        <ul className="max-h-[calc(100vh-22rem)] space-y-2 overflow-auto">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border bg-card">
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
                    <p className="truncate text-body font-medium">{item.title}</p>
                    {!item.isRead && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">
                    {item.content}
                  </p>
                  <p className="mt-1 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {dateFmt.format(new Date(item.createdAt))}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? tc('loading') : tc('viewMore')}
          </Button>
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
