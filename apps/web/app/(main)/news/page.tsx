'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'

import { NewsHeader } from './NewsHeader'
import { NewsList } from './NewsList'
import { NewsSidebar } from './NewsSidebar'
import { PAGE_SIZE, api } from './helpers'
import type { NewsArticle, NewsCategory, ArticlesData } from './types'

export default function NewsPage() {
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <NewsHeader search={search} onSearchChange={setSearch} />

      <div className="flex flex-col gap-6 lg:flex-row">
        <NewsList
          items={items}
          isLoading={isLoading}
          error={error}
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
        />
        <NewsSidebar
          categories={categories}
          categoryId={categoryId}
          onCategoryChange={(id) => {
            setCategoryId(id)
            setPage(1)
          }}
          pinned={pinned}
        />
      </div>
    </div>
  )
}
