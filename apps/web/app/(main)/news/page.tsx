'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Newspaper,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pin,
  FileText,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@ihui/ui'
import { cn } from '@/lib/utils'

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

export default function NewsPage() {
  const t = useTranslations('news')

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [categoryId, setCategoryId] = React.useState<string>('all')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])

  const { data: categories = [] } = useQuery({
    queryKey: ['news', 'categories'],
    queryFn: () => api<{ list: NewsCategory[] }>(`/api/news/categories`).then((d) => d.list ?? []),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['news', 'articles', debounced, categoryId, page],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (categoryId !== 'all') qs.set('categoryId', categoryId)
      if (debounced) qs.set('search', debounced)
      return api<ArticlesData>(`/api/news/articles?${qs.toString()}`)
    },
  })

  const { data: pinned = [] } = useQuery({
    queryKey: ['news', 'pinned'],
    queryFn: () =>
      api<{ list: NewsArticle[] }>(`/api/news/articles/pinned`).then((d) => d.list ?? []),
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items = data?.list ?? []

  const fmtDate = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('zh-CN')
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Newspaper className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          className="h-9 pl-8"
          aria-label={t('search')}
        />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
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
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <Link key={item.id} href={`/news/${item.id}`} className="block">
                  <Card className="overflow-hidden transition-colors hover:border-primary/40">
                    <CardContent className="flex gap-4 p-4">
                      <div className="h-24 w-40 shrink-0 overflow-hidden rounded-md bg-muted">
                        {item.coverImage ? (
                          <img
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
                          <h2 className="line-clamp-1 font-medium transition-colors group-hover:text-primary">
                            {item.title}
                          </h2>
                        </div>
                        {item.summary && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {item.summary}
                          </p>
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
        </div>

        <aside className="w-full shrink-0 space-y-4 lg:w-72">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">{t('categories')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-4 pt-0">
              <button
                type="button"
                onClick={() => {
                  setCategoryId('all')
                  setPage(1)
                }}
                className={cn(
                  'block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                  categoryId === 'all'
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {t('allCategories')}
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCategoryId(c.id)
                    setPage(1)
                  }}
                  className={cn(
                    'block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                    categoryId === c.id
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  {c.name}
                </button>
              ))}
            </CardContent>
          </Card>

          {pinned.length > 0 && (
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Pin className="h-4 w-4 text-primary" />
                  {t('pinned')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-0">
                {pinned.map((item) => (
                  <Link
                    key={item.id}
                    href={`/news/${item.id}`}
                    className="block rounded-md p-1.5 transition-colors hover:bg-accent"
                  >
                    <p className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('publishedAt', { date: fmtDate(item.publishedAt) })}
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
