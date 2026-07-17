'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, HelpCircle, MessageCircle } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

interface AskItem {
  id: string
  title: string
  content?: string | null
  answersCount?: number | null
  status?: string | null
  createdAt: string
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-green-500/10 text-green-600',
  resolved: 'bg-green-500/10 text-green-600',
  open: 'bg-blue-500/10 text-blue-600',
  closed: 'bg-muted text-muted-foreground',
}

export default function AskPage() {
  const t = useTranslations('user.ask')
  const locale = useLocale()
  const user = useAuthStore((s) => s.user)

  const { data, isLoading, error } = useQuery({
    queryKey: ['user', 'ask', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<AskItem[]> => {
      const r = await fetchApi<{ list?: AskItem[] } | AskItem[]>(`/api/asks?authorId=${user!.id}`)
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
          <HelpCircle className="h-5 w-5 text-primary" />
          {t('title', { default: '我的问答' })}
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
          <HelpCircle className="h-8 w-8 opacity-40" />
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
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  {item.status ? (
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                        STATUS_STYLE[item.status] ?? STATUS_STYLE.draft
                      }`}
                    >
                      {item.status}
                    </span>
                  ) : null}
                </div>
                {item.content ? (
                  <p className="line-clamp-2 break-words text-xs text-muted-foreground">
                    {item.content}
                  </p>
                ) : null}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {item.answersCount ?? 0}
                  </span>
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
