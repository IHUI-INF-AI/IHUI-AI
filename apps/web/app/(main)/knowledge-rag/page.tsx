'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { BookMarked, Search, FileText, Loader2, Settings, Upload } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Input, Button } from '@ihui/ui-react'
import { UploadDialog } from './UploadDialog'

interface DocSummary {
  id: number
  title: string
  sourceType: string
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

export default function KnowledgeRagPage() {
  const t = useTranslations('knowledgeRag.list')
  const tSource = useTranslations('knowledgeRag.list.sourceType')
  const tSearch = useTranslations('knowledgeRag.list.search')
  const tChunks = useTranslations('knowledgeRag.chunks')
  const locale = useLocale()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [uploadOpen, setUploadOpen] = React.useState(false)

  React.useEffect(() => {
    const tm = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(tm)
  }, [search])

  const isSearchMode = debounced.trim().length > 0

  const listQuery = useQuery({
    queryKey: ['knowledgeRag', 'docs'],
    queryFn: () => api<DocSummary[]>('/api/knowledge/docs'),
    enabled: !isSearchMode,
  })

  const searchQuery = useQuery({
    queryKey: ['knowledgeRag', 'search', debounced],
    queryFn: () =>
      api<SearchHit[]>('/api/knowledge/search', {
        method: 'POST',
        body: JSON.stringify({ query: debounced, topK: 20 }),
      }),
    enabled: isSearchMode,
  })

  const docs = listQuery.data ?? []
  const hits = searchQuery.data ?? []
  const isLoading = isSearchMode ? searchQuery.isLoading : listQuery.isLoading
  const error = isSearchMode ? searchQuery.error : listQuery.error

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookMarked className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" />
            <span>{t('upload')}</span>
          </Button>
          <Link
            href="/knowledge-rag/manage"
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
          >
            <Settings className="h-4 w-4" />
            <span>{t('manage')}</span>
          </Link>
        </div>
      </header>

      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 pl-8"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : isSearchMode ? (
        hits.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
            <Search className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{tSearch('empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {hits.map((h) => (
              <Link
                key={h.id}
                href={`/knowledge-rag/${h.docId}`}
                className="block transition-colors"
              >
                <Card className="hover:bg-accent/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">
                        {tChunks('chunkIndex', { index: h.chunkIndex + 1 })}
                      </CardTitle>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {(h.score * 100).toFixed(1)}%
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p className="line-clamp-3 whitespace-pre-wrap">{h.content}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {docs.map((d) => (
            <Link key={d.id} href={`/knowledge-rag/${d.id}`} className="block">
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardHeader className="pb-2">
                  <CardTitle className="line-clamp-2 text-base">{d.title}</CardTitle>
                </CardHeader>
                <CardFooter className="justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5">{sourceLabel(d.sourceType)}</span>
                    <span>
                      {t('chunkCount', { count: d.chunkCount })}
                    </span>
                  </div>
                  <span>{fmtDate(d.createdAt)}</span>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  )
}
