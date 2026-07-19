import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, Pin, FileText, Newspaper, FolderOpen } from 'lucide-react'

import { fetchApiServer } from '@/lib/api-server'
import { Card, CardContent } from '@ihui/ui'

export const revalidate = 60

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

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const r = await fetchApiServer<{ list: NewsCategory[] }>(`/api/news/categories`)
  if (!r.success) return { title: '分类 | IHUI AI' }
  const category = r.data.list?.find((c) => c.id === id)
  if (!category) return { title: '分类 | IHUI AI' }
  const title = `${category.name} - 分类 | IHUI AI`
  return {
    title,
    description: `${category.name} 分类下的所有新闻文章`,
    openGraph: { title, type: 'website' },
    twitter: { card: 'summary', title },
  }
}

export default async function NewsCategoryPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { page: pageStr } = await searchParams
  const page = Math.max(1, Number(pageStr) || 1)
  const locale = await getLocale()
  const t = await getTranslations({ locale, namespace: 'news' })

  const [categoriesResp, articlesResp] = await Promise.all([
    fetchApiServer<{ list: NewsCategory[] }>(`/api/news/categories`),
    fetchApiServer<ArticlesData>(
      `/api/news/articles?${new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        categoryId: id,
      }).toString()}`,
    ),
  ])

  if (!categoriesResp.success) notFound()
  const category = categoriesResp.data.list?.find((c) => c.id === id)
  if (!category) notFound()

  const data = articlesResp.success ? articlesResp.data : null
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
      <Link
        href="/news"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{category.name}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.id} href={`/news/${item.id}`} className="group block">
              <Card className="overflow-hidden transition-colors hover:bg-accent">
                <CardContent className="flex gap-4 p-4">
                  <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.coverImage ? (
                      <Image
                        fill
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
                      <h2 className="font-medium transition-colors group-hover:text-primary">
                        {item.title}
                      </h2>
                    </div>
                    {item.summary && (
                      <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
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
            {page <= 1 ? (
              <span className="inline-flex h-9 cursor-not-allowed items-center gap-1 rounded-md border border-input bg-background px-3 text-sm opacity-50">
                <ChevronLeft className="h-4 w-4" />
                {t('prev')}
              </span>
            ) : (
              <Link
                href={`/news/category/${id}?page=${page - 1}`}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent"
              >
                <ChevronLeft className="h-4 w-4" />
                {t('prev')}
              </Link>
            )}
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            {page >= totalPages ? (
              <span className="inline-flex h-9 cursor-not-allowed items-center gap-1 rounded-md border border-input bg-background px-3 text-sm opacity-50">
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </span>
            ) : (
              <Link
                href={`/news/category/${id}?page=${page + 1}`}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent"
              >
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
