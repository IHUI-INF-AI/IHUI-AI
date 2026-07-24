'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { FileText, Loader2, ChevronLeft, ChevronRight, Eye, Pin, Newspaper } from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { fmtDate, PAGE_SIZE } from './helpers'
import type { ArticleItem } from './types'

interface Props {
  items: ArticleItem[]
  isLoading: boolean
  error: Error | null
  total: number
  totalPages: number
  page: number
  onPrev: () => void
  onNext: () => void
  locale: string
}

export function ArticlesList({
  items,
  isLoading,
  error,
  total,
  totalPages,
  page,
  onPrev,
  onNext,
  locale,
}: Props) {
  const t = useTranslations('articles')
  return (
    <div className="min-w-0 flex-1 space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error.message}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.id} href={`/articles/${item.id}`} className="block">
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
                      <span>{t('publishedAt', { date: fmtDate(item.publishedAt, locale) })}</span>
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
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}>
              <ChevronLeft className="h-4 w-4" />
              {t('prev')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={onNext}>
              {t('next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
