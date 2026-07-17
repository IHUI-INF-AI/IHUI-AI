'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Megaphone, Pin } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { api, type Announcement, ANN_TYPE_ICON, ANN_TYPE_BADGE } from '@/lib/content'

export default function AnnouncementsPage() {
  const t = useTranslations('announcements')
  const locale = useLocale()

  const { data, isLoading, error } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => api<{ list: Announcement[] }>('/api/announcements').then((d) => d.list ?? []),
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

  // Pinned first, then by publishedAt desc (defensive sort)
  const list = (data ?? []).slice().sort((a, b) => {
    if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  })

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : list.length > 0 ? (
        <div className="space-y-3">
          {list.map((a) => {
            const Icon = ANN_TYPE_ICON[a.type] ?? Megaphone
            return (
              <Link key={a.id} href={`/announcements/${a.id}`} className="block">
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-xs font-medium',
                            ANN_TYPE_BADGE[a.type],
                          )}
                        >
                          {t(`types.${a.type}`)}
                        </span>
                        {a.isPinned && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-primary">
                            <Pin className="h-3 w-3" />
                            {t('pinned')}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {fmt(a.publishedAt)}
                        </span>
                      </div>
                      <h2 className="text-sm font-semibold">{a.title}</h2>
                      <p className="text-sm text-muted-foreground">{a.summary}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <Megaphone className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      )}
    </div>
  )
}
