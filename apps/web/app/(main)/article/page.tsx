'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Newspaper, Loader2, Search } from 'lucide-react'
import Link from 'next/link'

import { Card, CardContent, Input } from '@ihui/ui'
import { fetchApi } from '@/lib/api'

interface ArticleItem {
  id: string
  title: string
  summary?: string
  authorName?: string
  publishedAt: string
  viewCount: number
  categoryName?: string
}

interface ArticlesResponse {
  list: ArticleItem[]
  total: number
}

export default function ArticlePage() {
  const t = useTranslations('articles')
  const locale = useLocale()
  const [q, setQ] = React.useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['article-list-v1', q],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: '1', pageSize: '20' })
      if (q.trim()) qs.set('search', q.trim())
      const r = await fetchApi<ArticlesResponse>(`/api/v1/article/list?${qs.toString()}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const items = data?.list ?? []

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Newspaper className="h-6 w-6 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('search')}
          className="pl-9"
          aria-label={t('search')}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <Newspaper className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <Link key={a.id} href={`/article/${a.id}`} className="block">
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="space-y-1 p-4">
                  <div className="flex items-center gap-2">
                    {a.categoryName && (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {a.categoryName}
                      </span>
                    )}
                    <h2 className="line-clamp-1 text-sm font-semibold">{a.title}</h2>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {dateFmt.format(new Date(a.publishedAt))}
                    </span>
                  </div>
                  {a.summary && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{a.summary}</p>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {a.authorName && <span>{a.authorName} · </span>}
                    <span>{t('viewCount', { count: a.viewCount })}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
