'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Users, MessageSquare, Loader2, Circle } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@ihui/ui'

interface CircleItem {
  id: string
  name: string
  description?: string
  memberCount: number
  postCount: number
}
interface CirclesData { list: CircleItem[]; total: number; page: number; pageSize: number }

const PAGE_SIZE = 20

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function CirclesPage() {
  const t = useTranslations('circles')
  const [page] = React.useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['circles', page],
    queryFn: () => api<CirclesData>(`/api/circles?page=${page}&pageSize=${PAGE_SIZE}`),
  })

  const circles = data?.list ?? []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Circle className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
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
      ) : circles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <Circle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {circles.map((c) => (
            <Link key={c.id} href={`/circles/${c.id}`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader className="p-4 pb-2">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Circle className="h-5 w-5" />
                  </div>
                  <CardTitle className="line-clamp-1 text-base">{c.name}</CardTitle>
                  {c.description && (
                    <CardDescription className="line-clamp-2 text-xs">{c.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {t('memberCount', { count: c.memberCount })}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {t('postCount', { count: c.postCount })}
                    </span>
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
