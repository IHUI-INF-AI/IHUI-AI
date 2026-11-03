// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { BookOpen, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { apiOrThrow } from '@/lib/api'
import { type DocDetail } from '@/lib/content'
import { MarkdownBody } from '@/components/docs/markdown-body'

export default function DocsDetailPageClient() {
  const { slug } = useParams<{ slug: string }>()
  const tc = useTranslations('common')
  const td = useTranslations('docs')
  const locale = useLocale()
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const { data: detail, isLoading } = useQuery({
    queryKey: ['doc-detail', slug],
    queryFn: () => apiOrThrow<DocDetail>(`/api/docs/${encodeURIComponent(slug)}`),
    retry: false,
  })
  const doc = detail?.doc

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
      <Link
        href="/docs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <BookOpen className="h-4 w-4" />
        {td('navOverview')}
      </Link>

      <header className="space-y-2">
        <h1 className="text-display font-bold tracking-tight">{doc?.title ?? slug}</h1>
        {doc && (
          <div className="flex items-center gap-2 text-label text-muted-foreground">
            <span className="inline-flex rounded-md bg-muted px-2 py-0.5 font-medium">
              {doc.category}
            </span>
            {doc.updatedAt && <span>{dateFmt.format(new Date(doc.updatedAt))}</span>}
          </div>
        )}
      </header>

      {isLoading ? (
        <p className="rounded-lg border border-border px-3 py-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {tc('loading')}
        </p>
      ) : doc ? (
        <article>
          <MarkdownBody content={doc.content} />
        </article>
      ) : (
        <p className="rounded-lg border border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {tc('noData')}
        </p>
      )}

      {(detail?.prev || detail?.next) && (
        <nav className="flex items-center justify-between gap-2 pt-2">
          {detail?.prev ? (
            <Link
              href={`/docs/${detail.prev.slug}`}
              className="group flex min-w-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
              <span className="truncate font-medium">{detail.prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {detail?.next ? (
            <Link
              href={`/docs/${detail.next.slug}`}
              className="group flex min-w-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
            >
              <span className="truncate font-medium">{detail.next.title}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
