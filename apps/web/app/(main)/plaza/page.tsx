'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Users,
  MessageSquare,
  HelpCircle,
  Circle,
  Loader2,
  Eye,
  CheckCircle2,
  LayoutGrid,
  ArrowRight,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface CircleItem {
  id: string
  name: string
  description?: string
  memberCount: number
  postCount: number
}
interface CirclesData {
  list: CircleItem[]
  total: number
}

interface AskItem {
  id: string
  title: string
  tags?: string[]
  answerCount: number
  viewCount: number
  isResolved: boolean
  createdAt: string
}
interface AsksData {
  list: AskItem[]
  total: number
}

const PREVIEW_SIZE = 6

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

type Tab = 'circles' | 'asks'

export default function PlazaPage() {
  const t = useTranslations('plaza')
  const tc = useTranslations('circles')
  const ta = useTranslations('asks')
  const [tab, setTab] = React.useState<Tab>('circles')

  const circlesQuery = useQuery({
    queryKey: ['plaza-circles'],
    queryFn: () => api<CirclesData>(`/api/circles?page=1&pageSize=${PREVIEW_SIZE}`),
  })

  const asksQuery = useQuery({
    queryKey: ['plaza-asks'],
    queryFn: () => api<AsksData>(`/api/asks?page=1&pageSize=${PREVIEW_SIZE}`),
  })

  const circles = circlesQuery.data?.list ?? []
  const asks = asksQuery.data?.list ?? []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <LayoutGrid className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 标签切换 */}
      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
        <button
          onClick={() => setTab('circles')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            tab === 'circles'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Circle className="h-4 w-4" />
          {t('circlesTab')}
          {circlesQuery.data && (
            <span className="text-xs text-muted-foreground">{circlesQuery.data.total}</span>
          )}
        </button>
        <button
          onClick={() => setTab('asks')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            tab === 'asks'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <HelpCircle className="h-4 w-4" />
          {t('asksTab')}
          {asksQuery.data && (
            <span className="text-xs text-muted-foreground">{asksQuery.data.total}</span>
          )}
        </button>
      </div>

      <div key={tab} className="animate-in fade-in-0 duration-200">
        {/* 圈子面板 */}
        {tab === 'circles' && (
          <section className="space-y-4">
            {circlesQuery.isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {tc('loading')}
              </div>
            ) : circlesQuery.error ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {(circlesQuery.error as Error).message}
              </div>
            ) : circles.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
                <Circle className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{tc('empty')}</p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {circles.map((c) => (
                    <Link key={c.id} href={`/circles/${c.id}`}>
                      <Card className="h-full transition-colors hover:bg-accent">
                        <CardHeader className="p-4 pb-2">
                          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Circle className="h-5 w-5" />
                          </div>
                          <CardTitle className="text-base">{c.name}</CardTitle>
                          {c.description && (
                            <CardDescription className="text-xs">{c.description}</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {tc('memberCount', { count: c.memberCount })}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3.5 w-3.5" />
                              {tc('postCount', { count: c.postCount })}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Link
                    href="/circles"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    {t('viewAllCircles')}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </>
            )}
          </section>
        )}

        {/* 问答面板 */}
        {tab === 'asks' && (
          <section className="space-y-4">
            {asksQuery.isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {ta('loading')}
              </div>
            ) : asksQuery.error ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {(asksQuery.error as Error).message}
              </div>
            ) : asks.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
                <HelpCircle className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{ta('empty')}</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {asks.map((a) => (
                    <Link key={a.id} href={`/asks/${a.id}`}>
                      <Card className="transition-colors hover:bg-accent">
                        <CardHeader className="p-4 pb-2">
                          <div className="flex items-start justify-between gap-3">
                            <CardTitle className="text-base">{a.title}</CardTitle>
                            <span
                              className={cn(
                                'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                                a.isResolved
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : 'bg-amber-500/10 text-amber-600',
                              )}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {a.isResolved ? ta('resolved') : ta('unresolved')}
                            </span>
                          </div>
                          {a.tags && a.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {a.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </CardHeader>
                        <CardContent className="flex items-center gap-4 p-4 pt-0 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5" />
                            {ta('answerCount', { count: a.answerCount })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            {ta('viewCount', { count: a.viewCount })}
                          </span>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Link
                    href="/asks"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    {t('viewAllAsks')}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
