'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2, Eye, Newspaper } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui'

interface NewsArticle {
  id: string
  title: string
  summary?: string | null
  content: string
  coverImage?: string | null
  authorName?: string | null
  categoryId?: string | null
  viewCount: number
  publishedAt?: string | null
  isPinned?: boolean
}

interface ArticleDetail {
  article: NewsArticle
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function NewsDetailPage() {
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('news')

  const { data, isLoading, error } = useQuery({
    queryKey: ['news', 'article', id],
    queryFn: () => api<ArticleDetail>(`/api/news/articles/${id}`),
  })

  const fmtDate = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('zh-CN')
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
        <Link
          href="/news"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('notFound')}
        </div>
      </div>
    )

  const article = data.article

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href="/news"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{article.title}</h1>
        {article.summary && <p className="text-sm text-muted-foreground">{article.summary}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {article.authorName && <span>{article.authorName}</span>}
          <span>{t('publishedAt', { date: fmtDate(article.publishedAt) })}</span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {t('viewCount', { count: article.viewCount })}
          </span>
        </div>
      </header>

      {article.coverImage && (
        <div className="overflow-hidden rounded-lg border">
          <img
            src={article.coverImage}
            alt={article.title}
            className="max-h-[420px] w-full object-cover"
          />
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <article
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-center pt-2 text-muted-foreground">
        <Newspaper className="mr-2 h-4 w-4" />
        <span className="text-sm">{article.authorName ?? ''}</span>
      </div>
    </div>
  )
}
