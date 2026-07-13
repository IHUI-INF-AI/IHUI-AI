'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Search, Newspaper } from 'lucide-react'
import { Input } from '@ihui/ui'

import { ArticlesList } from './ArticlesList'
import { ArticlesSidebar } from './ArticlesSidebar'
import { PAGE_SIZE, api } from './helpers'
import type { ArticleCategory, ArticlesData } from './types'

export default function ArticlesPage() {
  const t = useTranslations('articles')
  const locale = useLocale()

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
    queryKey: ['articles', 'categories'],
    queryFn: () =>
      api<{ list: ArticleCategory[] }>(`/api/article/categories`).then((d) => d.list ?? []),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['articles', debounced, categoryId, page],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (categoryId !== 'all') qs.set('categoryId', categoryId)
      if (debounced) qs.set('search', debounced)
      return api<ArticlesData>(`/api/article/list?${qs.toString()}`)
    },
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items = data?.list ?? []

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
        <ArticlesList
          items={items}
          isLoading={isLoading}
          error={error as Error | null}
          total={total}
          totalPages={totalPages}
          page={page}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
          locale={locale}
        />
        <ArticlesSidebar
          categories={categories}
          categoryId={categoryId}
          onSelectCategory={(id) => {
            setCategoryId(id)
            setPage(1)
          }}
        />
      </div>
    </div>
  )
}
