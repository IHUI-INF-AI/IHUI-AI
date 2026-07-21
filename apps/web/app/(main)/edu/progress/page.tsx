'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { BarChart3, Loader2, Clock, BookOpen, Award, TrendingUp } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Alert, Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'

interface ProgressData {
  totalStudyHours: number
  totalCourses: number
  completedCourses: number
  avgProgress: number
  weeklyHours: { date: string; hours: number }[]
  categoryProgress: { name: string; total: number; completed: number; progress: number }[]
  recentMilestones: { id: string; title: string; type: string; achievedAt: string }[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function EduProgressPage() {
  const locale = useLocale()
  const t = useTranslations('eduProgressPage')
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'progress'],
    queryFn: () => api<ProgressData>('/api/edu/progress'),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit' })
  const fmt = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const maxHours = Math.max(1, ...(data?.weeklyHours ?? []).map((w) => w.hours))

  const stats = [
    { label: t('stats.totalStudy'), value: `${data?.totalStudyHours ?? 0}h`, icon: Clock },
    { label: t('stats.enrolled'), value: data?.totalCourses ?? 0, icon: BookOpen },
    { label: t('stats.completed'), value: data?.completedCourses ?? 0, icon: Award },
    { label: t('stats.avgProgress'), value: `${data?.avgProgress ?? 0}%`, icon: TrendingUp },
  ]

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BarChart3 className="h-7 w-7 text-primary" />
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
        <Alert variant="danger" description={(error as Error).message} />
      ) : !data ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('weeklyHours')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-40 items-end justify-between gap-2">
                {(data.weeklyHours ?? []).map((w) => (
                  <div key={w.date} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                    <Tooltip content={`${w.hours}h`}>
                      <div
                        className="w-full rounded-t bg-primary/80 transition-all hover:bg-primary"
                        style={{ height: `${(w.hours / maxHours) * 100}%`, minHeight: '2px' }}
                      />
                    </Tooltip>
                  </div>
                    <span className="text-xs text-muted-foreground">{fmt(w.date)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('categoryProgress')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data.categoryProgress ?? []).length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{t('noData')}</p>
                ) : (
                  (data.categoryProgress ?? []).map((cat) => (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{cat.name}</span>
                        <span className="text-muted-foreground">
                          {cat.completed}/{cat.total}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded bg-muted">
                        <div
                          className="h-full rounded-md bg-primary transition-all"
                          style={{ width: `${cat.progress}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t('recentMilestones')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data.recentMilestones ?? []).length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{t('noMilestones')}</p>
                ) : (
                  (data.recentMilestones ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        'flex items-center gap-3 rounded-md border p-2 text-sm transition-colors hover:bg-accent',
                      )}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Award className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{fmt(m.achievedAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
