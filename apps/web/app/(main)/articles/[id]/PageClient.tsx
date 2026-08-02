'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { ArrowLeft, Loader2, Eye, Newspaper } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui-react'
import { SafeHtml } from '@/components/common'
import { generateArticleSchema } from '@/lib/seo/schema-article'

interface ArticleDetail {
  id: string
  title: string
  summary?: string | null
  content: string
  coverImage?: string | null
  authorName?: string | null
  categoryId?: string | null
  categoryName?: string | null
  viewCount: number
  publishedAt?: string | null
  isPinned?: boolean
}

interface DetailResponse {
  article: ArticleDetail
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('articles')
  const locale = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: ['articles', 'detail', id],
    queryFn: () => api<DetailResponse>(`/api/article/detail/${id}`),
  })

  const fmtDate = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat(locale).format(d)
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )

  if (error || !data)
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Link
          href="/articles"
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

  // 2026-08-02 P0-5 GEO 强化:Article JSON-LD 注入(客户端渲染,Googlebot 2024+ 可解析)
  const articleJsonLd = generateArticleSchema({
    headline: article.title,
    description: article.summary || article.title,
    url: `https://aizhs.top/articles/${article.id}`,
    datePublished: article.publishedAt || new Date().toISOString(),
    authorName: article.authorName || '智汇 AI',
    keywords: article.categoryName ? [article.categoryName] : ['IHUI AI'],
    articleBody: article.content.replace(/<[^>]*>/g, '').slice(0, 5000),
    articleSection: article.categoryName || '文章',
    imageUrl: article.coverImage || undefined,
    inLanguage: locale === 'zh-TW' ? 'zh-TW' : 'zh-CN',
  })

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <Link
        href="/articles"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <header className="space-y-3">
        <h1 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">{article.title}</h1>
        {article.summary && <p className="text-xs text-muted-foreground">{article.summary}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {article.authorName && <span>{article.authorName}</span>}
          {article.categoryName && <span>{article.categoryName}</span>}
          <span>{t('publishedAt', { date: fmtDate(article.publishedAt) })}</span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {t('viewCount', { count: article.viewCount })}
          </span>
        </div>
      </header>

      {article.coverImage && (
        <div className="overflow-hidden rounded-lg border">
          <Image
            src={article.coverImage}
            alt={article.title}
            width={1200}
            height={630}
            className="max-h-[420px] w-full object-cover"
            style={{ width: '100%', height: 'auto' }}
          />
        </div>
      )}

      <Card>
        <CardContent className="p-4 min-[768px]:p-6">
          <SafeHtml
            html={article.content}
            className="prose prose-sm max-w-none dark:prose-invert"
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
