'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { BookOpen, Search, FileText, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter, Input } from '@ihui/ui-react'

interface KBCategory {
  id: string
  name: string
  count?: number
}

interface KBArticle {
  id: string
  title: string
  summary?: string | null
  categoryName?: string | null
  authorName?: string | null
  viewCount: number
  updatedAt: string
}

interface KBListData {
  list: KBArticle[]
  total: number
}

const PAGE_SIZE = 10

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function KnowledgeBasePage() {
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
    queryKey: ['kb', 'categories'],
    queryFn: () =>
      api<{ list: KBCategory[] }>(`/api/knowledge-base/categories`).then((d) => d.list ?? []),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['kb', 'list', debounced, categoryId, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (categoryId !== 'all') qs.set('categoryId', categoryId)
      if (debounced) qs.set('search', debounced)
      return api<KBListData>(`/api/knowledge-base?${qs.toString()}`)
    },
  })

  const dateFmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
  const fmt = (v?: string) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items = data?.list ?? []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">知识库</h1>
        </div>
        <p className="text-sm text-muted-foreground">浏览、搜索与管理知识库文章</p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-52">
          <div className="space-y-1 rounded-lg border p-2">
            <button
              type="button"
              onClick={() => {
                setCategoryId('all')
                setPage(1)
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                categoryId === 'all'
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <span>全部分类</span>
              <span className="text-xs opacity-70">{total}</span>
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
                  'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                  categoryId === c.id
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <span className="truncate">{c.name}</span>
                {typeof c.count === 'number' && (
                  <span className="text-xs opacity-70">{c.count}</span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索知识库文章..."
              className="h-9 pl-8"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              加载中...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {(error as Error).message}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">暂无文章</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <Link key={item.id} href={`/knowledge-base/${item.id}`} className="block">
                  <Card className="transition-colors hover:bg-accent/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      {item.summary && (
                        <CardDescription className="line-clamp-2">{item.summary}</CardDescription>
                      )}
                    </CardHeader>
                    <CardFooter className="justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        {item.categoryName && (
                          <span className="rounded bg-muted px-1.5 py-0.5">
                            {item.categoryName}
                          </span>
                        )}
                        {item.authorName && <span>{item.authorName}</span>}
                      </div>
                      <span>{fmt(item.updatedAt)}</span>
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center rounded-md border px-2.5 py-1 text-sm transition-colors hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center rounded-md border px-2.5 py-1 text-sm transition-colors hover:bg-accent disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
