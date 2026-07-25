'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Eye, Users, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Heatmap } from '@/components/charts/Heatmap'

interface BehaviorStatistics {
  watchTotal: number
  userTotal: number
}
interface WatchRecord {
  id: string
  userId: string
  topicId: string
  topicType: string
  topicTitle: string | null
  watchDuration: number
  lastPosition: number
  createdAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const HEATMAP_X_LABELS = [
  '00-02',
  '02-04',
  '04-06',
  '06-08',
  '08-10',
  '10-12',
  '12-14',
  '14-16',
  '16-18',
  '18-20',
  '20-22',
  '22-24',
]
// 用户活跃度热力图空数据桩：工作日白天偏高，周末晚间偏高
const HEATMAP_DATA: number[][] = [
  [1, 0, 0, 1, 3, 6, 8, 9, 7, 5, 4, 2],
  [1, 0, 0, 1, 3, 7, 9, 10, 8, 5, 4, 2],
  [1, 0, 0, 1, 3, 7, 9, 10, 8, 5, 4, 2],
  [1, 0, 0, 1, 3, 7, 9, 10, 8, 5, 4, 2],
  [2, 1, 0, 1, 2, 5, 7, 8, 7, 6, 5, 3],
  [3, 1, 0, 0, 1, 2, 4, 5, 6, 7, 8, 6],
  [2, 1, 0, 0, 1, 2, 3, 4, 5, 6, 7, 5],
]

export default function BehaviorPage() {
  const t = useTranslations('behavior')
  const tb = useTranslations('admin.behavior')
  const locale = useLocale()
  const [page, setPage] = React.useState(1)
  const pageSize = 20

  const HEATMAP_Y_LABELS = [
    tb('weekday.mon'),
    tb('weekday.tue'),
    tb('weekday.wed'),
    tb('weekday.thu'),
    tb('weekday.fri'),
    tb('weekday.sat'),
    tb('weekday.sun'),
  ]

  const { data: statistics, isLoading: loadingStats } = useQuery({
    queryKey: ['behavior', 'statistics'],
    queryFn: () =>
      api<{ statistics: BehaviorStatistics }>(`/api/admin/behavior/statistics`).then(
        (d) => d.statistics,
      ),
  })
  const { data: watchData, isLoading: loadingList } = useQuery({
    queryKey: ['behavior', 'watch-list', page],
    queryFn: () =>
      api<{ list: WatchRecord[]; total: number }>(
        `/api/admin/behavior/watch/list?page=${page}&pageSize=${pageSize}`,
      ),
  })

  const cards = [
    {
      label: t('watchTotal'),
      value: statistics?.watchTotal ?? 0,
      icon: Eye,
      color: 'text-primary',
    },
    {
      label: t('userTotal'),
      value: statistics?.userTotal ?? 0,
      icon: Users,
      color: 'text-primary',
    },
  ]

  const total = watchData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Eye className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 统计卡片 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('overview')}</h2>
        {loadingStats ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
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

      {/* 用户行为热力图 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('heatmapTitle')}</h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('heatmapCardTitle')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('heatmapHint')}</p>
          </CardHeader>
          <CardContent>
            <Heatmap
              data={HEATMAP_DATA}
              xLabels={HEATMAP_X_LABELS}
              yLabels={HEATMAP_Y_LABELS}
              color="var(--primary)"
            />
          </CardContent>
        </Card>
      </section>

      {/* 浏览记录列表 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('watchList')}</h2>
        {loadingList ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : (watchData?.list ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
            <Eye className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('noRecords')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{t('topicType')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('topicTitle')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('watchDuration')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('createdAt')}</th>
                </tr>
              </thead>
              <tbody>
                {(watchData?.list ?? []).map((w) => (
                  <tr key={w.id} className="border-t">
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {w.topicType}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{w.topicTitle ?? w.topicId}</td>
                    <td className="px-4 py-2">{w.watchDuration}s</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Intl.DateTimeFormat(locale).format(new Date(w.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <button
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              {t('prev')}
            </button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <button
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              {t('next')}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
