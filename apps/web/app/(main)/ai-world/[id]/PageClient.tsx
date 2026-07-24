'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Loader2, ArrowLeft, Eye, Calendar, Tag, Sparkles } from 'lucide-react'
import Image from 'next/image'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui-react'

interface AiWorldItem {
  id: string
  categoryId: string | null
  title: string
  content: string | null
  coverImage: string | null
  authorId: string | null
  viewCount: number
  status: number
  createdAt: string
  updatedAt: string
}

interface AiWorldCategory {
  id: string
  name: string
  icon: string | null
}

interface AiWorldHotApp {
  id: string
  name: string
  href: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function AiWorldDetailPage() {
  const params = useParams<{ id: string }>()
  const locale = useLocale()

  const {
    data: world,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ai-world', 'detail', params.id],
    queryFn: () => api<{ world: AiWorldItem }>(`/api/ai-world/${params.id}`).then((d) => d.world),
    enabled: !!params.id,
  })

  const { data: catData } = useQuery({
    queryKey: ['ai-world', 'categories'],
    queryFn: () => api<{ list: AiWorldCategory[] }>('/api/ai-world/categories'),
  })

  const { data: worldListData } = useQuery({
    queryKey: ['ai-world'],
    queryFn: () =>
      api<{ hotApps: AiWorldHotApp[] } | unknown>('/api/ai-world').then(
        (d) => (d as { hotApps?: AiWorldHotApp[] }).hotApps ?? [],
      ),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const categoryName = world?.categoryId
    ? (catData?.list.find((c) => c.id === world.categoryId)?.name ?? '-')
    : '-'

  const relatedApps = (worldListData ?? []).filter((a) => a.id !== params.id).slice(0, 4)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    )
  }

  if (error || !world) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href="/ai-world"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? '条目不存在'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/ai-world"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </Link>

      <Card className="overflow-hidden">
        {world.coverImage ? (
          <div className="relative h-48 w-full">
            <Image src={world.coverImage} alt={world.title} fill className="object-cover" />
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center bg-muted">
            <Sparkles className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{world.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {world.categoryId && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                  <Tag className="h-3 w-3" />
                  {categoryName}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {world.viewCount} 次浏览
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {fmt(world.createdAt)}
              </span>
            </div>
          </div>

          {world.content ? (
            <article className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {world.content}
            </article>
          ) : (
            <p className="text-sm text-muted-foreground">暂无内容</p>
          )}

          <div className="border-t pt-3 text-xs text-muted-foreground">
            更新时间：{fmt(world.updatedAt)}
          </div>
        </CardContent>
      </Card>

      {relatedApps.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">相关推荐</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {relatedApps.map((app) => (
              <Link
                key={app.id}
                href={`/ai-world/${app.id}`}
                className="rounded-lg border p-3 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                  <span className="line-clamp-2 text-sm font-medium">{app.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
