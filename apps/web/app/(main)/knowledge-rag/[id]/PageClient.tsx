'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, Loader2, ListTree, Search, Calendar, FileText, ChevronRight, Hash } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button } from '@ihui/ui'

interface DocDetail {
  id: number
  title: string
  sourceType: string
  sourcePath: string | null
  contentHash: string | null
  chunkCount: number
  createdAt: string | null
}

interface SearchHit {
  id: number
  docId: number
  content: string
  score: number
  chunkIndex: number
}

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function KnowledgeRagDetailPage() {
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('knowledgeRag.detail')
  const tSource = useTranslations('knowledgeRag.list.sourceType')
  const tList = useTranslations('knowledgeRag.list')
  const locale = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: ['knowledgeRag', 'doc', id],
    queryFn: () => api<DocDetail>(`/api/knowledge/docs/${id}`),
    enabled: Boolean(id),
  })

  const { data: hits } = useQuery({
    queryKey: ['knowledgeRag', 'related', id, data?.title],
    queryFn: () =>
      api<SearchHit[]>('/api/knowledge/search', {
        method: 'POST',
        body: JSON.stringify({ query: data?.title ?? '', topK: 6 }),
      }),
    enabled: Boolean(data?.title),
    select: (list) => list.filter((h) => String(h.docId) !== String(id)).slice(0, 5),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const fmtDate = (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const labels: Record<string, string> = {
    text: tSource('text'),
    file: tSource('file'),
    url: tSource('url'),
  }
  const sourceLabel = (s: string) => labels[s] ?? s

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Link
          href="/knowledge-rag"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ? (error as Error).message : t('notFound')}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link
        href="/knowledge-rag"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{data.title}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <FileText className="h-4 w-4" />
            {t('sourceType')}: {sourceLabel(data.sourceType)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Hash className="h-4 w-4" />
            {t('chunkCount')}: {data.chunkCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {t('createdAt')}: {fmtDate(data.createdAt)}
          </span>
        </div>
        <div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/knowledge-rag/${data.id}/chunks`}>
              <ListTree className="mr-1.5 h-4 w-4" />
              {t('viewChunks')}
            </Link>
          </Button>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Search className="h-4 w-4" />
          {t('related')}
        </h2>
        {hits && hits.length > 0 ? (
          <div className="space-y-2">
            {hits.map((h) => (
              <Link
                key={h.id}
                href={`/knowledge-rag/${h.docId}`}
                className="block rounded-md border bg-card p-3 text-sm transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {tList('chunkCount', { count: h.chunkIndex + 1 })}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {(h.score * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-muted-foreground">
                  {h.content}
                </p>
                <div className="mt-1 inline-flex items-center text-xs text-primary">
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t('relatedEmpty')}
          </div>
        )}
      </section>
    </div>
  )
}
