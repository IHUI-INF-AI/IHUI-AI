'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, BookOpen } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

interface LearnRecord {
  id: string
  title: string
  courseTitle?: string | null
  progress?: number | null
  lastStudyAt?: string | null
}

export default function LearnRecordPage() {
  const t = useTranslations('user.learn-record')
  const locale = useLocale()
  const user = useAuthStore((s) => s.user)

  const { data, isLoading, error } = useQuery({
    queryKey: ['user', 'learn-record', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<LearnRecord[]> => {
      const r = await fetchApi<{ list?: LearnRecord[] } | LearnRecord[]>(
        `/api/learn/records?userId=${user!.id}`,
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
          <BookOpen className="h-5 w-5 text-primary" />
          {t('title', { default: '学习记录' })}
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
          <BookOpen className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('empty', { default: '目前还没有数据' })}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const progress =
              typeof item.progress === 'number' ? Math.min(100, Math.max(0, item.progress)) : 0
            return (
              <li
                key={item.id}
                className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    {item.courseTitle ? (
                      <p className="truncate text-xs text-muted-foreground">{item.courseTitle}</p>
                    ) : null}
                    {item.lastStudyAt ? (
                      <p className="text-xs text-muted-foreground">
                        {dateFmt.format(new Date(item.lastStudyAt))}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex w-28 shrink-0 flex-col items-end gap-1">
                    <span className="text-xs font-medium text-muted-foreground">{progress}%</span>
                    <div className="h-1.5 w-full overflow-hidden rounded-md bg-muted">
                      <div
                        className="h-full rounded-md bg-primary transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
