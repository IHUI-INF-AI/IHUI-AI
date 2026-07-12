'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  BarChart3,
  Users,
  GraduationCap,
  FileText,
  BookOpen,
  Award,
  TrendingUp,
  Loader2,
  Save,
  Trash2,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@ihui/ui'
import { BarChart } from '@/components/charts/BarChart'

interface OverviewStatistics {
  memberTotal: number
  lessonTotal: number
  examTotal: number
  signupTotal: number
  examRecordTotal: number
  postTotal: number
  announcementTotal: number
  articleTotal: number
}
interface LearnStatistics {
  lessonTotal: number
  lessonPublished: number
  signupTotal: number
  viewSum: number
}
interface ExamStatistics {
  examTotal: number
  examPublished: number
  recordTotal: number
  passTotal: number
  passRate: number
}
interface ContentStatistics {
  memberTotal: number
  postTotal: number
  announcementTotal: number
  articleTotal: number
}
interface Snapshot {
  id: string
  type: string
  data: Record<string, unknown>
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function StatisticsPage() {
  const t = useTranslations('statistics')
  const queryClient = useQueryClient()

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['statistics', 'overview'],
    queryFn: () =>
      api<{ statistics: OverviewStatistics }>(`/api/statistics/overview`).then((d) => d.statistics),
  })
  const { data: learn } = useQuery({
    queryKey: ['statistics', 'learn'],
    queryFn: () =>
      api<{ statistics: LearnStatistics }>(`/api/statistics/learn`).then((d) => d.statistics),
  })
  const { data: exam } = useQuery({
    queryKey: ['statistics', 'exam'],
    queryFn: () =>
      api<{ statistics: ExamStatistics }>(`/api/statistics/exam`).then((d) => d.statistics),
  })
  const { data: content } = useQuery({
    queryKey: ['statistics', 'content'],
    queryFn: () =>
      api<{ statistics: ContentStatistics }>(`/api/statistics/content`).then((d) => d.statistics),
  })
  const { data: snapshotsData } = useQuery({
    queryKey: ['statistics', 'snapshots'],
    queryFn: () =>
      api<{ list: Snapshot[]; total: number }>(`/api/admin/statistics/snapshots?pageSize=10`),
  })

  const createSnapshot = useMutation({
    mutationFn: (type: 'overview' | 'learn' | 'exam' | 'content') =>
      api<{ snapshot: Snapshot }>(`/api/admin/statistics/snapshots`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['statistics', 'snapshots'] }),
  })

  const overviewCards = [
    { label: t('members'), value: overview?.memberTotal ?? 0, icon: Users, color: 'text-primary' },
    {
      label: t('lessons'),
      value: overview?.lessonTotal ?? 0,
      icon: GraduationCap,
      color: 'text-primary',
    },
    {
      label: t('exams'),
      value: overview?.examTotal ?? 0,
      icon: FileText,
      color: 'text-purple-600',
    },
    {
      label: t('signups'),
      value: overview?.signupTotal ?? 0,
      icon: BookOpen,
      color: 'text-emerald-600',
    },
    {
      label: t('examRecords'),
      value: overview?.examRecordTotal ?? 0,
      icon: Award,
      color: 'text-orange-600',
    },
    {
      label: t('posts'),
      value: overview?.postTotal ?? 0,
      icon: TrendingUp,
      color: 'text-pink-600',
    },
    {
      label: t('announcements'),
      value: overview?.announcementTotal ?? 0,
      icon: BarChart3,
      color: 'text-cyan-600',
    },
    {
      label: t('articles'),
      value: overview?.articleTotal ?? 0,
      icon: BookOpen,
      color: 'text-indigo-600',
    },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <BarChart3 className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 总览统计卡片 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('overview')}</h2>
          <Button
            variant="outline"
            size="sm"
            disabled={createSnapshot.isPending}
            onClick={() => createSnapshot.mutate('overview')}
          >
            <Save className="mr-1 h-4 w-4" />
            {t('saveSnapshot')}
          </Button>
        </div>
        {loadingOverview ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {overviewCards.map((c) => (
              <Card key={c.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {c.label}
                  </CardTitle>
                  <c.icon className={`h-4 w-4 ${c.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{c.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 总览数据对比柱状图 */}
      {!loadingOverview && overview && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">总览数据对比</CardTitle>
            <p className="text-xs text-muted-foreground">各维度核心指标横向对比</p>
          </CardHeader>
          <CardContent>
            <BarChart
              data={overviewCards.map((c) => c.value)}
              xAxis={overviewCards.map((c) => c.label)}
              horizontal
              color="var(--primary)"
            />
          </CardContent>
        </Card>
      )}

      {/* 分类统计 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* 学习统计 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-4 w-4 text-primary" />
              {t('learnStats')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label={t('lessonTotal')} value={learn?.lessonTotal ?? 0} />
            <Row label={t('lessonPublished')} value={learn?.lessonPublished ?? 0} />
            <Row label={t('signupTotal')} value={learn?.signupTotal ?? 0} />
            <Row label={t('viewSum')} value={learn?.viewSum ?? 0} />
          </CardContent>
        </Card>

        {/* 考试统计 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-purple-600" />
              {t('examStats')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label={t('examTotal')} value={exam?.examTotal ?? 0} />
            <Row label={t('examPublished')} value={exam?.examPublished ?? 0} />
            <Row label={t('recordTotal')} value={exam?.recordTotal ?? 0} />
            <Row label={t('passTotal')} value={exam?.passTotal ?? 0} />
            <Row label={t('passRate')} value={`${((exam?.passRate ?? 0) * 100).toFixed(2)}%`} />
          </CardContent>
        </Card>

        {/* 内容统计 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-indigo-600" />
              {t('contentStats')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label={t('members')} value={content?.memberTotal ?? 0} />
            <Row label={t('posts')} value={content?.postTotal ?? 0} />
            <Row label={t('announcements')} value={content?.announcementTotal ?? 0} />
            <Row label={t('articles')} value={content?.articleTotal ?? 0} />
          </CardContent>
        </Card>
      </div>

      {/* 快照列表 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('snapshots')}</h2>
        {(snapshotsData?.list ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
            <Save className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('noSnapshots')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{t('snapshotType')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('createdAt')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('data')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {(snapshotsData?.list ?? []).map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {s.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <pre className="max-w-xs overflow-x-auto text-xs text-muted-foreground">
                        {JSON.stringify(s.data).slice(0, 120)}
                      </pre>
                    </td>
                    <td className="px-4 py-2">
                      <DeleteSnapshotButton id={s.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function DeleteSnapshotButton({ id }: { id: string }) {
  const t = useTranslations('statistics')
  const queryClient = useQueryClient()
  const del = useMutation({
    mutationFn: () => api(`/api/admin/statistics/snapshots/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['statistics', 'snapshots'] }),
  })
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={del.isPending}
      onClick={() => del.mutate()}
      aria-label={t('delete')}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  )
}
