'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Globe, Loader2, RotateCw, Users } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button } from '@ihui/ui-react'
import { BackButton } from '@/components/common'

interface PlanetInfo {
  name: string
  memberCount: number
  description: string
}
interface PlanetNews {
  id: string
  title: string
  summary: string | null
  coverImage: string | null
  publishedAt: string | null
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function KnowledgePlanetPage() {
  const t = useTranslations('knowledgePlanet')

  const infoQ = useQuery({
    queryKey: ['knowledge-planet', 'info'],
    queryFn: () => api<PlanetInfo>('/knowledge-planet/info'),
  })
  const newsQ = useQuery({
    queryKey: ['knowledge-planet', 'news'],
    queryFn: () =>
      api<{ list: PlanetNews[]; total: number }>('/knowledge-planet/news?page=1&pageSize=20'),
  })

  const info = infoQ.data
  const list = newsQ.data?.list ?? []

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <BackButton fallbackHref="/" />
        <h1 className="text-lg font-medium">{t('title')}</h1>
        <div className="w-10" />
      </div>

      {info ? (
        <Card className="mb-4">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-medium">{info.name}</h2>
              <p className="truncate text-sm text-muted-foreground">{info.description}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {t('memberCount', { count: info.memberCount })}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <h3 className="mb-3 text-sm font-medium">{t('latestNews')}</h3>

      {newsQ.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      ) : newsQ.isError ? (
        <div className="rounded-md border border-border bg-card p-6 text-center">
          <p className="mb-3 text-sm text-muted-foreground">{t('loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={() => void newsQ.refetch()}>
            <RotateCw className="mr-2 h-4 w-4" />
            {t('retry')}
          </Button>
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            {t('empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((item) => (
            <Link key={item.id} href={`/news/${item.id}`} className="block">
              <Card className="transition-colors hover:bg-secondary/40">
                <CardContent className="flex gap-3 p-3 min-[640px]:p-3">
                  {item.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.coverImage}
                      alt=""
                      className="h-16 w-24 shrink-0 rounded-md object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <h4 className="line-clamp-2 text-sm font-medium">{item.title}</h4>
                    {item.summary ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {item.summary}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
