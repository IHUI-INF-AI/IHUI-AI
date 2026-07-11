'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  MessageSquare,
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Newspaper,
  BookOpen,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'

interface MyComment {
  id: string
  content: string
  targetId: string
  targetType: string
  targetTitle?: string | null
  createdAt: string
}

interface CommentsData {
  list: MyComment[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const TARGET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  article: Newspaper,
  news: Newspaper,
  resource: BookOpen,
  lesson: BookOpen,
  ask: FileText,
}

function targetHref(comment: MyComment): string {
  switch (comment.targetType) {
    case 'article':
      return `/articles/${comment.targetId}`
    case 'news':
      return `/news/${comment.targetId}`
    case 'resource':
      return `/resources/${comment.targetId}`
    case 'lesson':
      return `/learn/${comment.targetId}`
    case 'ask':
      return `/asks/${comment.targetId}`
    default:
      return '#'
  }
}

export default function MyCommentsPage() {
  const t = useTranslations('comments')
  const tc = useTranslations('student')
  const locale = useLocale()
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['comments', 'mine', page],
    queryFn: () => api<CommentsData>(`/api/comments/mine?page=${page}&pageSize=${PAGE_SIZE}`),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/comments/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments'] }),
  })

  function handleDelete(comment: MyComment) {
    if (!window.confirm(t('deleteConfirm'))) return
    delMut.mutate(comment.id)
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fmtDate = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat(locale).format(d)
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <MessageSquare className="h-7 w-7 text-primary" />
          {t('myCommentsTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('myCommentsSubtitle')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {list.map((comment) => {
              const Icon = TARGET_ICONS[comment.targetType] ?? FileText
              return (
                <Card key={comment.id} className="transition-colors hover:bg-accent">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={targetHref(comment)}
                        className="flex min-w-0 flex-1 items-center gap-2"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium hover:text-primary">
                          {comment.targetTitle ?? comment.targetType}
                        </span>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-destructive hover:text-destructive"
                        disabled={delMut.isPending}
                        onClick={() => handleDelete(comment)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t('delete')}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{comment.content}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {t('targetType')}: {comment.targetType}
                      </span>
                      <span>{fmtDate(comment.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                {tc('prev')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {tc('page', { page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {tc('next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
