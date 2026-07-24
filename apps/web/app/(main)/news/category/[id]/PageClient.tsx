'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, Pin, FileText, Newspaper, FolderOpen, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui-react'

interface NewsCategory {
  id: string
  name: string
  sort: number
  status: number
}

interface NewsArticle {
  id: string
  title: string
  summary?: string | null
  coverImage?: string | null
  authorName?: string | null
  categoryId?: string | null
  viewCount: number
  publishedAt?: string | null
  isPinned?: boolean
}

interface ArticlesData {
  list: NewsArticle[]
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

export default function NewsCategoryPageClient() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const t = useTranslations('news')

  const categoriesQuery = useQuery({
    queryKey: ['news', 'categories'],
    queryFn: () => api<{ list: NewsCategory[] }>(`/api/news/categories`),
  })

  const category = React.useMemo(
    () => categoriesQuery.data?.list?.find((c) => c.id === id) ?? null,
    [categoriesQuery.data, id],
  )

  const articlesQuery = useQuery({
    queryKey: ['news', 'articles', 'category', id, page],
    queryFn: () =>
      api<ArticlesData>(
        `/api/news/articles?${new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          categoryId: id,
        }).toString()}`,
      ),
  })

  const data = articlesQuery.data ?? null
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items = data?.list ?? []

  const fmtDate = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('zh-CN')
  }

  if (categoriesQuery.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!category) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 py-20 text-center">
        <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('notFound')}</p>
        <Link
          href="/news"
          className="inline-flex items-center gap-1 text-sm text-primary transition-colors hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Link
        href="/news"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{category.name}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {articlesQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.id} href={`/news/${item.id}`} className="group block">
              <Card className="overflow-hidden transition-colors hover:bg-accent">
                <CardContent className="flex gap-4 p-4">
                  <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.coverImage ? (
                      <Image
                        fill
                        src={item.coverImage}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Newspaper className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      {item.isPinned && (
                        <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                          <Pin className="h-3 w-3" />
                          {t('pinned')}
                        </span>
                      )}
                      <h2 className="font-medium transition-colors group-hover:text-primary">
                        {item.title}
                      </h2>
                    </div>
                    {item.summary && (
                      <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
                    )}
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted-foreground">
                      {item.authorName && <span>{item.authorName}</span>}
                      <span>{t('publishedAt', { date: fmtDate(item.publishedAt) })}</span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {t('viewCount', { count: item.viewCount })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
          <div className="flex items-center gap-2">
            {page <= 1 ? (
              <span className="inline-flex h-9 cursor-not-allowed items-center gap-1 rounded-md border border-input bg-background px-3 text-sm opacity-50">
                <ChevronLeft className="h-4 w-4" />
                {t('prev')}
              </span>
            ) : (
              <Link
                href={`/news/category/${id}?page=${page - 1}`}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent"
              >
                <ChevronLeft className="h-4 w-4" />
                {t('prev')}
              </Link>
            )}
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            {page >= totalPages ? (
              <span className="inline-flex h-9 cursor-not-allowed items-center gap-1 rounded-md border border-input bg-background px-3 text-sm opacity-50">
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </span>
            ) : (
              <Link
                href={`/news/category/${id}?page=${page + 1}`}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent"
              >
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
