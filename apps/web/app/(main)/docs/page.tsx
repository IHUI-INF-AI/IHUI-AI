'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { FileText, BookOpen, Code, HelpCircle, Loader2 } from 'lucide-react'
import type { ComponentType } from 'react'

import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { api, excerptFromContent, type DocSummary, type DocCategory } from '@/lib/content'

const CATS: { key: 'all' | DocCategory; icon: ComponentType<{ className?: string }> }[] = [
  { key: 'all', icon: BookOpen },
  { key: 'api', icon: Code },
  { key: 'guide', icon: BookOpen },
  { key: 'development', icon: FileText },
  { key: 'faq', icon: HelpCircle },
]

export default function DocsPage() {
  const t = useTranslations('docs')
  const locale = useLocale()
  const [cat, setCat] = useState<'all' | DocCategory>('all')

  const { data: docs = [], isLoading, error } = useQuery({
    queryKey: ['docs', cat],
    queryFn: () =>
      api<{ list: DocSummary[] }>(
        `/api/docs${cat === 'all' ? '' : `?category=${cat}`}`,
      ).then((d) => d.list ?? []),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const fmt = (v?: string) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="flex flex-wrap gap-1">
        {CATS.map((c) => {
          const Icon = c.icon
          const active = cat === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(`categories.${c.key}`)}
            </button>
          )
        })}
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
      ) : docs.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => {
            const CatIcon = CATS.find((c) => c.key === d.category)?.icon ?? FileText
            return (
              <Link key={d.slug} href={`/docs/${d.slug}`} className="block">
                <Card className="h-full transition-colors hover:border-primary/40 hover:shadow-md">
                  <CardHeader>
                    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <CatIcon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-base">{d.title}</CardTitle>
                    <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                      {d.summary || excerptFromContent(d.content)}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="justify-between">
                    <span className="text-xs text-muted-foreground">
                      {t('updatedAt')} {fmt(d.updatedAt)}
                    </span>
                    <span className="text-xs font-medium text-primary">{t('readMore')}</span>
                  </CardFooter>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      )}
    </div>
  )
}
