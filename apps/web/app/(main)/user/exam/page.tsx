'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, FileQuestion } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'

interface ExamItem {
  id: string
  title: string
  score?: number
  status?: string
  createdAt?: string
}

interface ExamListResponse {
  list?: ExamItem[]
  total?: number
}

const STATUS_LABEL: Record<string, string> = {
  draft: '未开始',
  published: '进行中',
  completed: '已完成',
  reviewing: '批改中',
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-green-500/10 text-green-600',
  completed: 'bg-blue-500/10 text-blue-600',
  reviewing: 'bg-orange-500/10 text-orange-600',
}

async function fetchExams(userId: string): Promise<ExamItem[]> {
  const r = await fetchApi<ExamListResponse>(`/api/exams?userId=${userId}`)
  if (!r.success) return []
  return r.data?.list ?? []
}

export default function UserExamPage() {
  const t = useTranslations('user.exam')
  const locale = useLocale()
  const user = useAuthStore((s) => s.user)

  const { data, isLoading } = useQuery({
    queryKey: ['user', 'exams', user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchExams(user!.id),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const items = data ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{t('title')}</h2>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {t('loading', { default: '加载中…' })}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <FileQuestion className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('empty')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((e) => {
            const inProgress = e.status === 'published' || e.status === 'draft'
            return (
              <li
                key={e.id}
                className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{e.title}</h3>
                      {e.status ? (
                        <span
                          className={cn(
                            'shrink-0 rounded-md px-2 py-0.5 text-xs',
                            STATUS_STYLE[e.status] ?? STATUS_STYLE.draft,
                          )}
                        >
                          {STATUS_LABEL[e.status] ?? e.status}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      {typeof e.score === 'number' ? <span>得分: {e.score}</span> : null}
                      {e.createdAt ? <span>{dateFmt.format(new Date(e.createdAt))}</span> : null}
                    </div>
                  </div>
                  {inProgress ? (
                    <Link
                      href={`/exam/${e.id}`}
                      className="shrink-0 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      {t('continue', { default: '继续考试' })}
                    </Link>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
