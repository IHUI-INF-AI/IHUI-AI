'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2, ChevronDown, ChevronUp, Hash } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface DocSummary {
  id: number
  title: string
  sourceType: string
  chunkCount: number
  createdAt: string | null
}

interface ChunkItem {
  id: number
  chunkIndex: number
  content: string
}

const PREVIEW_LEN = 200
const PAGE_LIMIT = 20

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function KnowledgeRagChunksPage() {
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('knowledgeRag.chunks')
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set())

  const { data: doc, isLoading: docLoading, error: docError } = useQuery({
    queryKey: ['knowledgeRag', 'doc', id],
    queryFn: () => api<DocSummary>(`/api/knowledge/docs/${id}`),
    enabled: Boolean(id),
  })

  const { data: chunks, isLoading, error } = useQuery({
    queryKey: ['knowledgeRag', 'chunks', id],
    queryFn: () => api<ChunkItem[]>(`/api/knowledge/docs/${id}/chunks?limit=${PAGE_LIMIT}`),
    enabled: Boolean(id),
  })

  const toggle = React.useCallback((chunkId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(chunkId)) next.delete(chunkId)
      else next.add(chunkId)
      return next
    })
  }, [])

  if (isLoading || docLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (error || docError || !doc) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Link
          href={`/knowledge-rag/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToDetail')}
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error | null)?.message ?? (docError as Error | null)?.message ?? t('notFound')}
        </div>
      </div>
    )
  }

  const items = chunks ?? []

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href={`/knowledge-rag/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToDetail')}
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{doc.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t('totalCount', { count: doc.chunkCount })}
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => {
            const isExpanded = expanded.has(c.id)
            const tooLong = c.content.length > PREVIEW_LEN
            const display = tooLong && !isExpanded ? `${c.content.slice(0, PREVIEW_LEN)}…` : c.content
            return (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      {t('chunkIndex', { index: c.chunkIndex + 1 })}
                    </div>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {t('charCount', { count: c.content.length })}
                    </span>
                  </div>
                  <pre
                    className={cn(
                      'whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm leading-relaxed',
                      !isExpanded && 'max-h-40 overflow-hidden',
                    )}
                  >
                    {display}
                  </pre>
                  {tooLong && (
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary transition-colors hover:underline"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" />
                          {t('showLess')}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          {t('showMore')}
                        </>
                      )}
                    </button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
