'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, RefreshCw, Smartphone, UserPlus, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { BackButton, Skeleton } from '@/components/common'
import { Container } from '@/components/layout'
import { LineChart } from '@/components/charts/LineChart'

/**
 * 移动端运营仪表盘(2026-08-06 起接入真实数据)。
 * 数据源:GET /api/admin/mobile-stats(apps/api/src/routes/admin/mobile-stats.ts),
 * 聚合 visit_logs / analytics_events / llm_call_logs / users 真实表。
 * 接口失败显示"加载失败"空态,不再使用示例数据冒充。
 */

/** 与后端 /api/admin/mobile-stats 返回结构对齐。 */
interface MobileStatsData {
  dau: number
  newUsers: number
  sessions: number
  /** 项目无崩溃上报表,后端恒返回 null */
  crashRate: number | null
  dauTrend: Array<{ date: string; dau: number }>
  deviceDistribution: Array<{ name: string; percent: number }>
  topPages: Array<{ path: string; visits: number }>
  /** 统计窗口内全部页面访问量,用于计算真实占比 */
  totalVisits: number
  generatedAt: string
}

const DEVICE_COLORS: Record<string, string> = {
  iOS: 'bg-primary',
  Android: 'bg-emerald-500',
  others: 'bg-amber-500',
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n)
}

export function MobileDashboardClient() {
  const t = useTranslations('mobileDashboardPage')

  const { data, isLoading, isError, refetch, isFetching } = useQuery<MobileStatsData, Error>({
    queryKey: ['admin', 'mobile-stats'],
    queryFn: async () => {
      const r = await fetchApi<MobileStatsData>('/admin/mobile-stats')
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  // DAU 相对昨日变化(基于近 7 日趋势的最近两个点,供卡片展示涨跌)
  const dauDelta = React.useMemo(() => {
    if (!data || data.dauTrend.length < 2) return null
    const yesterday = data.dauTrend[data.dauTrend.length - 2]?.dau ?? 0
    const today = data.dauTrend[data.dauTrend.length - 1]?.dau ?? 0
    if (yesterday === 0) return today === 0 ? null : 1
    return (today - yesterday) / yesterday
  }, [data])

  return (
    <Container maxWidth="xl" padding={false} className="space-y-6 py-6">
      <BackButton />
      <header className="space-y-1 px-1">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight min-[768px]:text-2xl">
          <Smartphone className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">
          监控移动端核心运营指标（真实数据，来源数据库聚合）
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton variant="card" count={4} />
          <Skeleton variant="list" count={6} />
        </div>
      ) : isError || !data ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-500">
            加载失败：无法获取移动端统计数据
          </div>
          <div>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" />
              重试
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Stat 卡片 */}
          <div className="grid grid-cols-2 gap-4 min-[768px]:grid-cols-4">
            <StatCard
              labelKey="stats.dau"
              value={formatNumber(data.dau)}
              sub={
                dauDelta === null
                  ? '—'
                  : `${dauDelta >= 0 ? '+' : ''}${(dauDelta * 100).toFixed(1)}% ${t('stats.trendSuffix')}`
              }
              trendUp={dauDelta === null ? false : dauDelta >= 0}
              Icon={Users}
            />
            <StatCard
              labelKey="stats.newUsers"
              value={formatNumber(data.newUsers)}
              sub="—"
              trendUp={false}
              Icon={UserPlus}
            />
            <StatCard
              labelKey="stats.sessions"
              value={formatNumber(data.sessions)}
              sub="—"
              trendUp={false}
              Icon={Activity}
            />
            <StatCard
              labelKey="stats.crashRate"
              value={data.crashRate === null ? '暂无数据' : `${data.crashRate.toFixed(2)}%`}
              sub="—"
              trendUp={false}
              Icon={AlertTriangle}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-3">
            {/* DAU 趋势 */}
            <Card className="min-[1024px]:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('dauTrend.title')}</CardTitle>
                <p className="text-xs text-muted-foreground">{t('dauTrend.subtitle')}</p>
              </CardHeader>
              <CardContent>
                {data.dauTrend.length > 0 ? (
                  <LineChart
                    data={data.dauTrend.map((d) => d.dau)}
                    xAxis={data.dauTrend.map((d) => d.date.slice(5))}
                    height={240}
                    color="var(--primary)"
                  />
                ) : (
                  <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                    暂无数据
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 设备分布 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('devices.title')}</CardTitle>
                <p className="text-xs text-muted-foreground">{t('devices.subtitle')}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.deviceDistribution.length > 0 ? (
                  <>
                    {data.deviceDistribution.map((d) => (
                      <div key={d.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {d.name === 'others' ? t('devices.others') : d.name}
                          </span>
                          <span className="text-muted-foreground">{d.percent}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-sm bg-muted">
                          <div
                            className={`h-full ${DEVICE_COLORS[d.name] ?? 'bg-muted-foreground/40'}`}
                            style={{ width: `${d.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                      {data.deviceDistribution.map((d) => (
                        <div key={d.name} className="flex items-center gap-1.5">
                          <span
                            className={`h-2.5 w-2.5 rounded-sm ${DEVICE_COLORS[d.name] ?? 'bg-muted-foreground/40'}`}
                          />
                          {d.name === 'others' ? t('devices.others') : d.name}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
                    暂无数据
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top 5 页面 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('topPages.title')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('topPages.subtitle')}</p>
            </CardHeader>
            <CardContent className="p-0">
              {data.topPages.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="w-12 px-5 py-2 font-medium">{t('topPages.rankHeader')}</th>
                        <th className="px-5 py-2 font-medium">{t('topPages.pathHeader')}</th>
                        <th className="px-5 py-2 text-right font-medium">
                          {t('topPages.visitsHeader')}
                        </th>
                        <th className="px-5 py-2 text-right font-medium">
                          {t('topPages.ratioHeader')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topPages.map((p, idx) => (
                        <tr key={`${p.path}-${idx}`} className="border-b ">
                          <td className="px-5 py-2.5">
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold ${
                                idx === 0
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 font-mono text-foreground">{p.path}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums">
                            {formatNumber(p.visits)}
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">
                            {data.totalVisits > 0
                              ? `${((p.visits / data.totalVisits) * 100).toFixed(1)}%`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
                  暂无数据
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {isFetching && !isLoading ? (
        <p className="px-1 text-xs text-muted-foreground">更新中…</p>
      ) : null}
    </Container>
  )
}

interface StatCardProps {
  labelKey: string
  value: string
  sub: string
  trendUp: boolean
  Icon: typeof Users
}

function StatCard({ labelKey, value, sub, trendUp, Icon }: StatCardProps) {
  const t = useTranslations('mobileDashboardPage')
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-0.5">
          <div className="text-sm text-muted-foreground">{t(labelKey)}</div>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          <div
            className={`text-xs ${sub === '—' || sub === '暂无数据' ? 'text-muted-foreground' : trendUp ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}
          >
            {sub}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
