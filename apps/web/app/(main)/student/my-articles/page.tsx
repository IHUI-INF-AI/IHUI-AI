'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Newspaper, Loader2, Trash2, ChevronLeft, ChevronRight, Eye, Edit } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'

interface MyArticle {
  id: string
  title: string
  summary?: string | null
  coverImage?: string | null
  viewCount: number
  status: number
  publishedAt?: string | null
  createdAt: string
}

interface ArticlesData {
  list: MyArticle[]
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

const STATUS_STYLE: Record<number, string> = {
  0: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  1: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  2: 'bg-muted text-muted-foreground',
  3: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

export default function MyArticlesPage() {
  const t = useTranslations('student')
  const ta = useTranslations('myArticles')
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['student', 'my-articles', page],
    queryFn: () => api<ArticlesData>(`/api/article/my?page=${page}&pageSize=${PAGE_SIZE}`),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/article/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student', 'my-articles'] }),
  })

  function handleDelete(article: MyArticle) {
    if (!window.confirm(ta('deleteConfirm'))) return
    delMut.mutate(article.id)
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fmtDate = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('zh-CN')
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Newspaper className="h-7 w-7 text-primary" />
            {ta('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{ta('subtitle')}</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/articles/edit">
            <Edit className="h-4 w-4" />
            {ta('create')}
          </Link>
        </Button>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <Newspaper className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {list.map((article) => {
              const statusKey =
                article.status === 1
                  ? 'statusPublished'
                  : article.status === 2
                    ? 'statusOffline'
                    : article.status === 3
                      ? 'statusRejected'
                      : 'statusDraft'
              return (
                <Card key={article.id} className="transition-colors hover:bg-accent">
                  <CardContent className="flex gap-4 p-4">
                    <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-md bg-muted">
                      {article.coverImage ? (
                        <Image
                          fill
                          src={article.coverImage}
                          alt={article.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Newspaper className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/articles/${article.id}`} className="min-w-0 flex-1">
                          <h3 className="font-medium hover:text-primary">{article.title}</h3>
                        </Link>
                        <div className="flex shrink-0 gap-1">
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/articles/edit?id=${article.id}`}>
                              <Edit className="h-4 w-4" />
                              {ta('edit')}
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={delMut.isPending}
                            onClick={() => handleDelete(article)}
                          >
                            <Trash2 className="h-4 w-4" />
                            {ta('delete')}
                          </Button>
                        </div>
                      </div>
                      {article.summary && (
                        <p className="mt-1 text-sm text-muted-foreground">{article.summary}</p>
                      )}
                      <div className="mt-auto flex flex-wrap items-center gap-3 pt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          {article.viewCount}
                        </span>
                        <span>{fmtDate(article.publishedAt ?? article.createdAt)}</span>
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                            STATUS_STYLE[article.status] ?? STATUS_STYLE[0]
                          }`}
                        >
                          {ta(statusKey)}
                        </span>
                      </div>
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
                {t('prev')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('page', { page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
