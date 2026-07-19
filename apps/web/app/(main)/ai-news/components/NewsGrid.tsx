'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Eye, Pin, ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '@ihui/ui'
import { Badge } from '@/components/data'
import { getFormatters } from '@/lib/date-utils'
import type { AiNewsArticle } from '@/lib/ai-news-api'

interface Props {
  articles: AiNewsArticle[]
}

export function NewsGrid({ articles }: Props) {
  const t = useTranslations('aiNews')
  const locale = React.useMemo(() => {
    if (typeof document === 'undefined') return 'zh-CN'
    return document.documentElement.lang || 'zh-CN'
  }, [])
  const fmt = React.useMemo(() => getFormatters(locale), [locale])

  if (articles.length === 0) {
    return (
      <section
        aria-label={t('articles.label')}
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        <div className="p-8 text-center text-sm text-muted-foreground">{t('articles.empty')}</div>
      </section>
    )
  }

  return (
    <section
      aria-label={t('articles.label')}
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <div className="flex flex-row items-center justify-between gap-3 p-6 pb-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">{t('articles.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('articles.subtitle')}</p>
        </div>
        <Link
          href="/news"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t('articles.viewMore')}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid gap-4 p-6 pt-3 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <Link key={a.id} href={a.source === 'mock' ? '/news' : `/news/${a.id}`} className="block">
            <Card className="h-full overflow-hidden transition-colors hover:bg-accent">
              <div className="relative aspect-video overflow-hidden bg-muted">
                {a.coverImage ? (
                  <Image
                    fill
                    src={a.coverImage}
                    alt={a.title}
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 360px"
                  />
                ) : null}
                {a.isPinned ? (
                  <div className="absolute left-2 top-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/95 px-2 py-0.5 text-xs font-medium text-white">
                      <Pin className="h-3 w-3" />
                      {t('articles.pinned')}
                    </span>
                  </div>
                ) : null}
                <div className="absolute right-2 top-2">
                  <Badge variant="primary">{a.categoryName}</Badge>
                </div>
              </div>
              <CardContent className="space-y-2 p-4">
                <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{a.title}</h3>
                <p className="line-clamp-2 text-xs text-muted-foreground">{a.summary}</p>
                <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                  <span className="truncate">{a.authorName}</span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {fmt.numberFormatter.format(a.viewCount)}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground/80">
                  {fmt.dateOnlyFormatter.format(new Date(a.publishedAt))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
