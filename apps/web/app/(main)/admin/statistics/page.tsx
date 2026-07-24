'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Save, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@ihui/ui-react'
import type { EChartsOption } from 'echarts'
import { fetchApi } from '@/lib/api'
import { EChart } from '@/components/charts/EChart'

import { StatisticsFilter } from './StatisticsFilter'
import { StatisticsTable } from './StatisticsTable'
import { api, buildOverviewCards } from './helpers'
import type { OverviewStatistics, SnapshotListData, SnapshotType } from './types'
import { formatNumber } from '@/lib/date-utils'

interface UserGrowthPoint {
  date: string
  total: number
  newCount: number
}
interface SourceItem {
  name: string
  value: number
}
interface StatisticsData {
  overview: OverviewStatistics
  userGrowth: UserGrowthPoint[]
  sources: SourceItem[]
}

const MOCK: StatisticsData = {
  overview: {
    memberTotal: 1280,
    lessonTotal: 156,
    examTotal: 48,
    signupTotal: 320,
    examRecordTotal: 1840,
    postTotal: 92,
    announcementTotal: 18,
    articleTotal: 245,
  },
  userGrowth: [
    { date: '07-08', total: 1200, newCount: 45 },
    { date: '07-09', total: 1280, newCount: 80 },
    { date: '07-10', total: 1320, newCount: 40 },
    { date: '07-11', total: 1410, newCount: 90 },
    { date: '07-12', total: 1485, newCount: 75 },
    { date: '07-13', total: 1620, newCount: 135 },
    { date: '07-14', total: 1780, newCount: 160 },
  ],
  sources: [
    { name: '搜索', value: 4200 },
    { name: '推荐', value: 3100 },
    { name: '广告', value: 2200 },
    { name: '社交', value: 1500 },
    { name: '其他', value: 820 },
  ],
}

export default function StatisticsPage() {
  const t = useTranslations('statistics')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<StatisticsData>({
    queryKey: ['statistics', 'admin'],
    queryFn: async () => {
      const r = await fetchApi<StatisticsData>('/api/admin/statistics')
      return r.success && r.data ? r.data : MOCK
    },
    staleTime: 60_000,
  })
  const d = data ?? MOCK

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

  const overviewCards = buildOverviewCards(t, d.overview)

  const growthOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['累计用户', '新增用户'], top: 0 },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: d.userGrowth.map((g) => g.date) },
    yAxis: { type: 'value' },
    series: [
      {
        name: '累计用户',
        type: 'line',
        smooth: true,
        data: d.userGrowth.map((g) => g.total),
        itemStyle: { color: '#3b82f6' },
        areaStyle: { opacity: 0.1 },
      },
      {
        name: '新增用户',
        type: 'line',
        smooth: true,
        data: d.userGrowth.map((g) => g.newCount),
        itemStyle: { color: '#10b981' },
      },
    ],
  }

  const moduleOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: overviewCards.map((c) => c.label),
      axisLabel: { interval: 0, rotate: 30 },
    },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: overviewCards.map((c) => c.value),
        itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] },
        barWidth: '50%',
      },
    ],
  }

  const sourceOption: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        label: { show: false },
        data: d.sources.map((s) => ({ name: s.name, value: s.value })),
        color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#94a3b8'],
      },
    ],
  }

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
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {overviewCards.map((c) => {
              const Icon = c.icon
              return (
                <Card key={c.label}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {c.label}
                    </CardTitle>
                    <Icon className={`h-4 w-4 ${c.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(c.value)}</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">用户增长趋势</CardTitle>
          <p className="text-xs text-muted-foreground">近 7 天累计与新增用户</p>
        </CardHeader>
        <CardContent>
          <EChart option={growthOption} loading={isLoading} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">各业务模块数据</CardTitle>
            <p className="text-xs text-muted-foreground">核心指标横向对比</p>
          </CardHeader>
          <CardContent>
            <EChart option={moduleOption} loading={isLoading} height={280} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">用户来源分布</CardTitle>
            <p className="text-xs text-muted-foreground">访问渠道占比</p>
          </CardHeader>
          <CardContent>
            <EChart option={sourceOption} loading={isLoading} height={280} />
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('snapshots')}</h2>
        <StatisticsTable list={snapshotsData?.list ?? []} />
      </section>
    </div>
  )
}
