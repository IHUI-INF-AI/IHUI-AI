'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Map as MapIcon,
  Loader2,
  CheckCircle2,
  Lock,
  PlayCircle,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface MapNode {
  id: string
  title: string
  description?: string
  progress: number
  status: 'locked' | 'available' | 'completed'
  totalLessons: number
  completedLessons: number
}

interface MapData {
  title: string
  description: string
  totalProgress: number
  nodes: MapNode[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function LearnMapPage() {
  const t = useTranslations('learnMapPage')
  const { data, isLoading, error } = useQuery({
    queryKey: ['learn', 'map'],
    queryFn: () => api<MapData>('/api/learn/map'),
  })

  const nodes = data?.nodes ?? []
  const totalProgress = data?.totalProgress ?? 0

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <MapIcon className="h-7 w-7 text-primary" />
          {data?.title ?? t('defaultTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {data?.description ?? t('defaultDesc')}
        </p>
      </header>

      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">{t('totalProgress')}</div>
            <div className="mt-1 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className="h-full rounded-md bg-primary transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, totalProgress))}%` }}
                />
              </div>
              <span className="text-sm font-medium">{Math.round(totalProgress)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16">
          <MapIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {nodes.map((node, idx) => {
            const isLocked = node.status === 'locked'
            const isCompleted = node.status === 'completed'
            return (
              <Card
                key={node.id}
                className={cn('transition-colors', isLocked ? 'opacity-60' : 'hover:bg-accent')}
              >
                <CardHeader className="flex flex-row items-start gap-3 p-4 pb-2">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      isCompleted
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : isLocked
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary/10 text-primary',
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : isLocked ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <PlayCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t('stageN', { n: idx + 1 })}</span>
                      {isCompleted && (
                        <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">
                          {t('completed')}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-base">{node.title}</CardTitle>
                    {node.description && (
                      <p className="text-sm text-muted-foreground">{node.description}</p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
                      <div
                        className={cn(
                          'h-full rounded-md transition-all',
                          isCompleted ? 'bg-emerald-500' : 'bg-primary',
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, node.progress))}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t('lessonsProgress', { completed: node.completedLessons, total: node.totalLessons })}
                    </span>
                  </div>
                  {!isLocked && (
                    <Link
                      href={`/learn/${node.id}`}
                      className="inline-flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary/80"
                    >
                      {isCompleted ? t('review') : t('continueLearning')}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
