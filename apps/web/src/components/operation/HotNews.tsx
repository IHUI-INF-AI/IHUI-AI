'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Flame, Eye } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface HotNewsItem {
  id: string
  title: string
  viewCount: number
  publishedAt: string
}

interface HotNewsProps {
  limit?: number
  className?: string
}

const RANK_STYLES: Record<number, string> = {
  1: 'bg-amber-500 text-white',
  2: 'bg-muted-foreground text-background',
  3: 'bg-orange-700 text-white',
}

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function formatViews(count: number, tenK: string): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}${tenK}`
  return String(count)
}

async function fetchHotNews(limit: number): Promise<HotNewsItem[]> {
  const res = await fetchApi<HotNewsItem[]>(`/api/news/hot?limit=${limit}`)
  if (res.success && Array.isArray(res.data)) return res.data
  return []
}

export function HotNews({ limit = 10, className }: HotNewsProps) {
  const t = useTranslations('operation.hotNews')
  const [items, setItems] = React.useState<HotNewsItem[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    fetchHotNews(limit)
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [limit])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Flame className="h-4 w-4 text-orange-500" />
          {t('title')}
        </CardTitle>
        <Link
          href="/news"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('more')}
        </Link>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        {loading ? (
          <div className="space-y-1.5 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-1.5 py-1.5">
                <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-muted" />
                <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <ol className="space-y-0.5">
            {items.map((item, idx) => {
              const rank = idx + 1
              const topThree = rank <= 3
              return (
                <li key={item.id}>
                  <Link
                    href={`/news/${item.id}`}
                    className="group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-muted/60"
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-semibold',
                        topThree ? RANK_STYLES[rank] : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm leading-snug text-foreground/90 transition-colors group-hover:text-foreground">
                      {item.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      {formatViews(item.viewCount, t('tenK'))}
                    </span>
                    <time className="hidden shrink-0 text-xs text-muted-foreground/70 sm:block">
                      {dateFmt.format(new Date(item.publishedAt))}
                    </time>
                  </Link>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

export default HotNews
