'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import {
  Clock,
  BookOpen,
  Award,
  BarChart3,
  Loader2,
  PlayCircle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Alert } from '@/components/feedback'

interface DashboardData {
  studyHours: number
  totalCourses: number
  completedCourses: number
  inProgressCourses: number
  avgProgress: number
  totalExams: number
  passedExams: number
  totalCerts: number
  recentCourses: RecentCourse[]
}
interface RecentCourse {
  id: string
  title: string
  cover?: string
  progress: number
  lastLearnAt?: string
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function EduDashboardPage() {
  const t = useTranslations('eduDashboardPage')
  const locale = useLocale()
  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'dashboard'],
    queryFn: () => api<DashboardData>('/api/edu/dashboard'),
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v?: string) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const stats = [
    { label: t('stats.studyHours'), value: `${data?.studyHours ?? 0}h`, icon: Clock },
    { label: t('stats.inProgressCourses'), value: data?.inProgressCourses ?? 0, icon: BookOpen },
    { label: t('stats.passedExams'), value: data?.passedExams ?? 0, icon: Award },
    { label: t('stats.avgProgress'), value: `${data?.avgProgress ?? 0}%`, icon: TrendingUp },
  ]

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <Alert variant="danger" description={tc('loadFailed')} />
      ) : (
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

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BookOpen className="h-4 w-4 text-primary" />
                  {t('coursesCard.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('coursesCard.total')}</span>
                  <span className="font-medium">{data?.totalCourses ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('coursesCard.completed')}</span>
                  <span className="font-medium text-emerald-600">
                    {data?.completedCourses ?? 0}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Award className="h-4 w-4 text-primary" />
                  {t('examsCard.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('examsCard.totalExams')}</span>
                  <span className="font-medium">{data?.totalExams ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('examsCard.totalCerts')}</span>
                  <span className="font-medium">{data?.totalCerts ?? 0}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  {t('progressCard.title')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.avgProgress ?? 0}%</div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded-md bg-primary transition-all"
                    style={{ width: `${data?.avgProgress ?? 0}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('recentSection.title')}</h2>
              <Link
                href="/edu/courses"
                className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t('recentSection.viewAll')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {(data?.recentCourses ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
                <PlayCircle className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t('recentSection.empty')}</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(data?.recentCourses ?? []).map((c) => (
                  <Link key={c.id} href={`/edu/courses/${c.id}`}>
                    <Card className="transition-colors hover:bg-accent">
                      <CardContent className="p-4">
                        <p className="line-clamp-1 font-medium">{c.title}</p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded bg-muted">
                          <div
                            className="h-full rounded-md bg-primary"
                            style={{ width: `${c.progress}%` }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{t('recentSection.progressLabel', { n: c.progress })}</span>
                          <span>{fmt(c.lastLearnAt)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
