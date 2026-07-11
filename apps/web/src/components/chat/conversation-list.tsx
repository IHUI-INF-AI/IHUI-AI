'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Clock, MessageSquare, Star, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'

export interface Conversation {
  id: string
  title: string
  model: string
  lastMessageAt: string
  messageCount: number
  favorite: boolean
}

/** history 与 favorites 页共用的对话行列表，含删除 / 收藏切换 */
export function ConversationList({ items }: { items: Conversation[] }) {
  const t = useTranslations('chatHistory')
  const locale = useLocale()
  const router = useRouter()
  const queryClient = useQueryClient()

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const invalidateAll = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] }),
      queryClient.invalidateQueries({ queryKey: ['chat', 'favorites'] }),
    ])

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/api/chat/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAll(),
  })

  const favMutation = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/api/chat/conversations/${encodeURIComponent(id)}/favorite`, { method: 'POST' }),
    onSuccess: () => invalidateAll(),
  })

  return (
    <ul className="divide-y rounded-lg border">
      {items.map((item) => (
        <li
          key={item.id}
          className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
        >
          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
          <button
            type="button"
            onClick={() => router.push(`/chat?conversationId=${encodeURIComponent(item.id)}`)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="break-words text-sm font-medium">{item.title}</p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="break-words">{item.model}</span>
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {dateFmt.format(new Date(item.lastMessageAt))}
              </span>
              <span>{t('messageCount', { count: item.messageCount })}</span>
            </p>
          </button>
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => favMutation.mutate(item.id)}
              disabled={favMutation.isPending}
              title={item.favorite ? t('unfavorite') : t('favorite')}
            >
              <Star
                className={cn('h-3.5 w-3.5', item.favorite && 'fill-amber-400 text-amber-400')}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => deleteMutation.mutate(item.id)}
              disabled={deleteMutation.isPending}
              title={t('delete')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default ConversationList
