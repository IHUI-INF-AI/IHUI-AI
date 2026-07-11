'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Flame, Loader2, Eye, ChevronLeft, ChevronRight, Newspaper, ArrowLeft } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'

interface HotArticle {
  id: string
  title: string
  summary?: string | null
  coverImage?: string | null
  authorName?: string | null
  viewCount: number
  publishedAt?: string | null
  hotScore?: number
}

interface ArticlesData {
  list: HotArticle[]
  total: number
  page: number
  pageSize: number
}

const PAGE_SIZE = 20

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function HotArticlesPage() {
  const t = useTranslations('articles')
  const locale = useLocale()
  const [page, setPage] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['articles', 'hot', page],
    queryFn: () =>
      api<ArticlesData>(`/api/content/articles/hot?page=${page}&pageSize=${PAGE_SIZE}`),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items = data?.list ?? []

  const fmtDate = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat(locale).format(d)
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Flame className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('hotTitle')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('hotSubtitle')}</p>
      </header>

      <Link
        href="/articles"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <Flame className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <Link key={item.id} href={`/articles/${item.id}`} className="block">
                <Card className="overflow-hidden transition-colors hover:bg-accent">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        idx < 3
                          ? 'bg-orange-500/10 text-orange-500'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h2 className="font-medium transition-colors group-hover:text-primary">
                        {item.title}
                      </h2>
                      {item.summary && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{item.summary}</p>
                      )}
                      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
                        {item.authorName && <span>{item.authorName}</span>}
                        <span>{t('publishedAt', { date: fmtDate(item.publishedAt) })}</span>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          {t('viewCount', { count: item.viewCount })}
                        </span>
                      </div>
                    </div>
                    {item.coverImage && (
                      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.coverImage}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
              <div className="flex items-center gap-2">
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
                  {page} / {totalPages}
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
            </div>
          )}
        </>
      )}

      <div className="flex items-center justify-center pt-2 text-muted-foreground">
        <Newspaper className="mr-2 h-4 w-4" />
        <span className="text-sm">{t('hotFooter')}</span>
      </div>
    </div>
  )
}
