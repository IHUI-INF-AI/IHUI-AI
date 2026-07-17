'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, MessageSquare } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

interface CommentItem {
  id: string
  content: string
  targetTitle?: string | null
  targetType?: string | null
  createdAt: string
}

const TYPE_BADGE: Record<string, string> = {
  article: 'bg-muted text-muted-foreground',
  course: 'bg-blue-500/10 text-blue-600',
  ask: 'bg-orange-500/10 text-orange-600',
}

export default function CommentPage() {
  const t = useTranslations('user.comment')
  const locale = useLocale()
  const user = useAuthStore((s) => s.user)

  const { data, isLoading, error } = useQuery({
    queryKey: ['user', 'comment', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<CommentItem[]> => {
      const r = await fetchApi<{ list?: CommentItem[] } | CommentItem[]>(
        `/api/comments?authorId=${user!.id}`,
      )
      if (!r.success) {
        if (r.status === 404) return []
        throw new Error(r.error)
      }
      const d = r.data
      return Array.isArray(d) ? d : (d.list ?? [])
    },
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const items = data ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <MessageSquare className="h-5 w-5 text-primary" />
          {t('title', { default: '我的评论' })}
        </h1>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading', { default: '加载中...' })}
        </div>
      ) : error ? (
        <div className="py-10 text-center text-destructive">{(error as Error).message}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('empty', { default: '目前还没有数据' })}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30"
            >
              <div className="space-y-1.5">
                <p className="break-words text-sm">{item.content}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {item.targetTitle ? (
                    <span className="truncate">on {item.targetTitle}</span>
                  ) : null}
                  {item.targetType ? (
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                        TYPE_BADGE[item.targetType] ?? 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {item.targetType}
                    </span>
                  ) : null}
                  {item.createdAt ? (
                    <span className="ml-auto">{dateFmt.format(new Date(item.createdAt))}</span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
