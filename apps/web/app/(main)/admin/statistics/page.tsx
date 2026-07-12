'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Save, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@ihui/ui'
import { BarChart } from '@/components/charts/BarChart'

import { StatisticsFilter } from './StatisticsFilter'
import { StatisticsTable } from './StatisticsTable'
import { StatisticsDialog } from './StatisticsDialog'
import { api, buildOverviewCards } from './helpers'
import type {
  OverviewStatistics,
  LearnStatistics,
  ExamStatistics,
  ContentStatistics,
  SnapshotListData,
  SnapshotType,
} from './types'

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
    queryFn: () => api<SnapshotListData>(`/api/admin/statistics/snapshots?pageSize=10`),
  })

  const createSnapshot = useMutation({
    mutationFn: (type: SnapshotType) =>
      api(`/api/admin/statistics/snapshots`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['statistics', 'snapshots'] }),
  })

  const overviewCards = buildOverviewCards(t, overview)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <StatisticsFilter />

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

      <StatisticsDialog learn={learn} exam={exam} content={content} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('snapshots')}</h2>
        <StatisticsTable list={snapshotsData?.list ?? []} />
      </section>
    </div>
  )
}
