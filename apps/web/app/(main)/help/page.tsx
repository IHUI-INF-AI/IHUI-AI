'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, HelpCircle, Search, BookOpen, Mail } from 'lucide-react'

import { Card, CardContent, Button, Input } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { api, excerptFromContent, type HelpCategory, type HelpArticleSummary } from '@/lib/content'

export default function HelpPage() {
  const t = useTranslations('help')
  const locale = useLocale()
  const [active, setActive] = useState<string>('all')
  const [q, setQ] = useState('')

  const { data: cats = [] } = useQuery({
    queryKey: ['help-categories'],
    queryFn: () => api<{ list: HelpCategory[] }>('/api/help/categories').then((d) => d.list ?? []),
  })

  const {
    data: articles = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['help-articles'],
    queryFn: () =>
      api<{ list: HelpArticleSummary[] }>('/api/help/articles').then((d) => d.list ?? []),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const fmt = (v?: string) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const kw = q.trim().toLowerCase()
  const filtered = articles.filter((a) => {
    if (active !== 'all' && a.category !== active) return false
    if (!kw) return true
    const excerpt = a.summary ?? excerptFromContent(a.content)
    return a.title.toLowerCase().includes(kw) || excerpt.toLowerCase().includes(kw)
  })

  const catCls = (on: boolean) =>
    cn(
      'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
      on ? 'border-primary/40 bg-primary/5 text-primary' : 'bg-card hover:bg-accent',
    )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="pl-9"
          aria-label={t('searchPlaceholder')}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="space-y-1">
          <button
            type="button"
            onClick={() => setActive('all')}
            className={catCls(active === 'all')}
          >
            <BookOpen className="h-4 w-4" />
            {t('allArticles')}
            <span className="ml-auto text-xs text-muted-foreground">{articles.length}</span>
          </button>
          {cats.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setActive(c.slug)}
              className={catCls(active === c.slug)}
            >
              <HelpCircle className="h-4 w-4" />
              {c.name}
              {typeof c.articleCount === 'number' && (
                <span className="ml-auto text-xs text-muted-foreground">{c.articleCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {(error as Error).message}
            </div>
          ) : filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map((a) => (
                <Link key={a.slug} href={`/help/${a.slug}`} className="block">
                  <Card className="transition-colors hover:bg-accent">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-sm font-semibold">{a.title}</h2>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {fmt(a.updatedAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {a.summary || excerptFromContent(a.content)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
              <HelpCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <Button asChild>
          <Link href="mailto:support@ihui.ai">
            <Mail className="h-4 w-4" />
            {t('contactSupport')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
