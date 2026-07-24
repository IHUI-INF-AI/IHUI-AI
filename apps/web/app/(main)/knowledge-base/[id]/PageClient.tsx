'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { ArrowLeft, Loader2, Eye, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { extractToc } from '@/lib/content'
import { MarkdownViewer } from '@/components/media'
import { Card, CardContent } from '@ihui/ui-react'

interface KBArticle {
  id: string
  title: string
  summary?: string | null
  content: string
  categoryName?: string | null
  authorName?: string | null
  tags?: string[]
  viewCount: number
  updatedAt: string
}

interface KBDetailData {
  article: KBArticle
  prev?: { id: string; title: string }
  next?: { id: string; title: string }
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function KBDetailPage() {
  const { id } = useParams<{ id: string }>()
  const locale = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: ['kb', 'detail', id],
    queryFn: () => api<KBDetailData>(`/api/knowledge-base/${id}`),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const fmt = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )

  if (error || !data)
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Link
          href="/knowledge-base"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? '文章不存在'}
        </div>
      </div>
    )

  const article = data.article
  const toc = extractToc(article.content)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Link
        href="/knowledge-base"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{article.title}</h1>
        {article.summary && <p className="text-sm text-muted-foreground">{article.summary}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {article.authorName && <span>{article.authorName}</span>}
          {article.categoryName && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{article.categoryName}</span>
          )}
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {fmt(article.updatedAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {article.viewCount} 次浏览
          </span>
        </div>
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {article.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="flex flex-col gap-8 lg:flex-row">
        <article className="min-w-0 flex-1">
          <Card>
            <CardContent className="p-6">
              <MarkdownViewer content={article.content} />
            </CardContent>
          </Card>
        </article>

        {toc.length > 0 && (
          <aside className="w-full shrink-0 lg:w-56">
            <div className="lg:sticky lg:top-4">
              <Card>
                <CardContent className="p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    目录
                  </p>
                  <nav className="space-y-1">
                    {toc.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={cn(
                          'block rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                          item.level === 3 && 'pl-4',
                        )}
                      >
                        {item.text}
                      </a>
                    ))}
                  </nav>
                </CardContent>
              </Card>
            </div>
          </aside>
        )}
      </div>

      <nav className="flex items-center justify-between border-t pt-4">
        {data.prev ? (
          <Link
            href={`/knowledge-base/${data.prev.id}`}
            className="group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            <span>
              <span className="block text-xs text-muted-foreground">上一篇</span>
              <span className="font-medium">{data.prev.title}</span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {data.next ? (
          <Link
            href={`/knowledge-base/${data.next.id}`}
            className="group flex items-center gap-2 rounded-md px-3 py-2 text-right text-sm transition-colors hover:bg-accent"
          >
            <span>
              <span className="block text-xs text-muted-foreground">下一篇</span>
              <span className="font-medium">{data.next.title}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  )
}
