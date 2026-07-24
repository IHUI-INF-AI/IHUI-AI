'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Search, Loader2, FileText, ArrowLeft } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter, Input } from '@ihui/ui-react'

interface KBArticle {
  id: string
  title: string
  summary?: string | null
  categoryName?: string | null
  updatedAt: string
}

interface KBSearchData {
  list: KBArticle[]
  total: number
}

function Highlight({ text, kw }: { text: string; kw: string }) {
  if (!kw.trim()) return <>{text}</>
  const parts = text.split(new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === kw.toLowerCase() ? (
          <mark key={i} className="rounded bg-yellow-200/70 px-0.5 dark:bg-yellow-500/30">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  )
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function SearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const q = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? 'all'
  const [input, setInput] = React.useState(q)

  React.useEffect(() => setInput(q), [q])

  const { data, isLoading, error } = useQuery({
    queryKey: ['kb', 'search', q, category],
    queryFn: () => {
      const qs = new URLSearchParams({ search: q, pageSize: '50' })
      if (category !== 'all') qs.set('categoryId', category)
      return api<KBSearchData>(`/api/knowledge-base?${qs.toString()}`)
    },
    enabled: q.trim().length > 0,
  })

  const dateFmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
  const fmt = (v?: string) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const items = data?.list ?? []
  const total = data?.total ?? 0

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const kw = input.trim()
    if (kw) router.push(`/knowledge-base/search?q=${encodeURIComponent(kw)}`)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <Link
        href="/knowledge-base"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回知识库
      </Link>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Search className="h-6 w-6 text-primary" />
          搜索结果
        </h1>
        {q && (
          <p className="text-sm text-muted-foreground">
            关键词「{q}」共找到 {total} 条结果
          </p>
        )}
      </header>

      <form onSubmit={handleSearch} className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="搜索知识库文章..."
          className="h-9 pl-8"
        />
      </form>

      {!q ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <Search className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">请输入搜索关键词</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          搜索中...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">未找到相关文章</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.id} href={`/knowledge-base/${item.id}`} className="block">
              <Card className={cn('transition-colors hover:bg-accent/50')}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    <Highlight text={item.title} kw={q} />
                  </CardTitle>
                  {item.summary && (
                    <CardDescription className="line-clamp-2">
                      <Highlight text={item.summary} kw={q} />
                    </CardDescription>
                  )}
                </CardHeader>
                <CardFooter className="justify-between text-xs text-muted-foreground">
                  {item.categoryName && (
                    <span className="rounded bg-muted px-1.5 py-0.5">{item.categoryName}</span>
                  )}
                  <span>{fmt(item.updatedAt)}</span>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function KBSearchPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" />
        </div>
      }
    >
      <SearchContent />
    </React.Suspense>
  )
}
