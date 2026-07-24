'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import ReactMarkdown from 'react-markdown'
import { Loader2, ArrowLeft, BookOpen, Eye, ChevronLeft, ChevronRight } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import {

api,
  markdownComponents,
  extractToc,
  type HelpArticleDetail,
  type HelpArticleSummary,
} from '@/lib/content'

export default function HelpArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const t = useTranslations('help')
  const locale = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: ['help-article', slug],
    queryFn: () => api<HelpArticleDetail>(`/api/help/articles/${slug}`),
  })

  const category = data?.article.category
  const { data: related = [] } = useQuery({
    queryKey: ['help-articles-related', category],
    queryFn: () =>
      api<{ list: HelpArticleSummary[] }>(
        `/api/help/articles${category ? `?category=${category}` : ''}`,
      ).then((d) => d.list ?? []),
    enabled: !!category,
  })
  const relatedItems = related.filter((r) => r.slug !== slug).slice(0, 5)

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const fmt = (v?: string) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )

  if (error || !data)
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <button
          type="button"
          onClick={() => router.push('/help')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('notFound')}
        </div>
      </div>
    )

  const a = data.article
  const toc = extractToc(a.content)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Link
        href="/help"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{a.title}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <BookOpen className="h-4 w-4" />
            {data.categoryName ?? a.category}
          </span>
          <span>
            {t('updatedAt')}: {fmt(a.updatedAt)}
          </span>
          {typeof a.viewCount === 'number' && (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {t('viewCount', { count: a.viewCount })}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row">
        <article className="min-w-0 flex-1 prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown components={markdownComponents}>{a.content}</ReactMarkdown>
        </article>

        {(toc.length > 0 || relatedItems.length > 0) && (
          <aside className="w-full shrink-0 space-y-4 lg:w-56">
            <div className="space-y-4 lg:sticky lg:top-4">
              {toc.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('toc')}
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
              )}
              {relatedItems.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('related')}
                    </p>
                    <nav className="space-y-1">
                      {relatedItems.map((r) => (
                        <Link
                          key={r.slug}
                          href={`/help/${r.slug}`}
                          className="block rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          {r.title}
                        </Link>
                      ))}
                    </nav>
                  </CardContent>
                </Card>
              )}
            </div>
          </aside>
        )}
      </div>

      <nav className="flex items-center justify-between border-t pt-4">
        {data.prev ? (
          <Link
            href={`/help/${data.prev.slug}`}
            className="group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            <span>
              <span className="block text-xs text-muted-foreground">{t('prev')}</span>
              <span className="font-medium">{data.prev.title}</span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {data.next ? (
          <Link
            href={`/help/${data.next.slug}`}
            className="group flex items-center gap-2 rounded-md px-3 py-2 text-right text-sm transition-colors hover:bg-accent"
          >
            <span>
              <span className="block text-xs text-muted-foreground">{t('next')}</span>
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
