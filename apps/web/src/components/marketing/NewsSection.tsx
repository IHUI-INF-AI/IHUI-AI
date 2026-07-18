'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, FileText, Loader2 } from 'lucide-react'
import { Card } from '@ihui/ui'
import { fetchApi } from '@/lib/api'

interface NewsItem {
  id: string
  title: string
  coverImage?: string | null
  authorName?: string | null
  createdAt?: string
}

function unwrap<T>(r: { success: boolean; data?: T; error?: string }): T {
  if (!r.success) throw new Error(r.error)
  return r.data as T
}

export function NewsSection() {
  const t = useTranslations('marketing.news')
  const { data: items = [], isLoading } = useQuery<NewsItem[]>({
    queryKey: ['marketing', 'news'],
    queryFn: async () => {
      const d = unwrap<{ list: NewsItem[] }>(await fetchApi('/api/news?pageSize=6'))
      return d.list ?? []
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight">{t('title')}</h2>
        </div>
        <Link
          href="/news"
          className="flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          {t('viewMore')}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          {t('empty')}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((n) => (
            <Link
              key={n.id}
              href={`/news/${n.id}`}
              className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="relative aspect-video overflow-hidden bg-muted">
                {n.coverImage ? (
                  <Image
                    src={n.coverImage}
                    alt={n.title}
                    fill
                    unoptimized
                    className="object-cover transition-transform group-hover:scale-105"
                    sizes="320px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 to-muted text-muted-foreground/30">
                    <FileText className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <h3 className="line-clamp-2 text-sm font-medium leading-snug">{n.title}</h3>
                {(n.authorName || n.createdAt) && (
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {[n.authorName, n.createdAt].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
