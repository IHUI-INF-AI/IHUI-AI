'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
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
    { label: '学习时长', value: `${data?.studyHours ?? 0}h`, icon: Clock },
    { label: '进行中课程', value: data?.inProgressCourses ?? 0, icon: BookOpen },
    { label: '已通过考试', value: data?.passedExams ?? 0, icon: Award },
    { label: '平均进度', value: `${data?.avgProgress ?? 0}%`, icon: TrendingUp },
  ]

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">学习概览</h1>
        <p className="text-sm text-muted-foreground">查看你的学习数据与最近进度</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <Alert variant="danger" description={(error as Error).message} />
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
                  课程
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">已报名</span>
                  <span className="font-medium">{data?.totalCourses ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">已完成</span>
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
                  考试与证书
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">考试总数</span>
                  <span className="font-medium">{data?.totalExams ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">证书数量</span>
                  <span className="font-medium">{data?.totalCerts ?? 0}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  完成率
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
              <h2 className="text-lg font-semibold">最近学习</h2>
              <Link
                href="/edu/courses"
                className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                查看全部
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {(data?.recentCourses ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
                <PlayCircle className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">暂无学习记录</p>
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
                          <span>进度 {c.progress}%</span>
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
