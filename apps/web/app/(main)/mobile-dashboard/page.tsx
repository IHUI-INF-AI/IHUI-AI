'use client'

import { Activity, AlertTriangle, Smartphone, UserPlus, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Container } from '@/components/layout'
import { LineChart } from '@/components/charts/LineChart'

interface StatItem {
  labelKey: string
  value: string
  trend: string
  trendUp: boolean
  Icon: typeof Users
}

const STATS: StatItem[] = [
  { labelKey: 'stats.dau', value: '128,450', trend: '+5.2%', trendUp: true, Icon: Users },
  { labelKey: 'stats.newUsers', value: '3,210', trend: '+12.4%', trendUp: true, Icon: UserPlus },
  { labelKey: 'stats.sessions', value: '456,789', trend: '+3.1%', trendUp: true, Icon: Activity },
  { labelKey: 'stats.crashRate', value: '0.32%', trend: '-0.08%', trendUp: false, Icon: AlertTriangle },
]

const DAU_TREND_DATA: number[] = [110200, 115600, 118900, 122400, 119800, 126700, 128450]

const DEVICE_DISTRIBUTION: { name: 'iOS' | 'Android' | 'others'; percent: number; color: string }[] = [
  { name: 'iOS', percent: 52, color: 'bg-primary' },
  { name: 'Android', percent: 41, color: 'bg-emerald-500' },
  { name: 'others', percent: 7, color: 'bg-amber-500' },
]

const TOP_PAGES: { rank: number; path: string; visits: string; ratio: string }[] = [
  { rank: 1, path: '/', visits: '186,302', ratio: '40.8%' },
  { rank: 2, path: '/chat', visits: '92,104', ratio: '20.2%' },
  { rank: 3, path: '/agents', visits: '54,871', ratio: '12.0%' },
  { rank: 4, path: '/discover', visits: '38,210', ratio: '8.4%' },
  { rank: 5, path: '/user/center', visits: '21,654', ratio: '4.7%' },
]

export default function MobileDashboardPage() {
  const t = useTranslations('mobileDashboardPage')

  return (
    <Container maxWidth="xl" padding={false} className="space-y-6 py-6">
      <header className="space-y-1 px-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Smartphone className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* Stat 卡片 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {STATS.map(({ labelKey, value, trend, trendUp, Icon }) => (
          <Card key={labelKey}>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-sm text-muted-foreground">{t(labelKey)}</div>
                <div className="text-2xl font-bold tracking-tight">{value}</div>
                <div
                  className={`text-xs ${trendUp ? 'text-emerald-600 dark:text-emerald-500' : 'text-muted-foreground'}`}
                >
                  {trend} {t('stats.trendSuffix')}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* DAU 趋势 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dauTrend.title')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('dauTrend.subtitle')}</p>
          </CardHeader>
          <CardContent>
            <LineChart
              data={DAU_TREND_DATA}
              xAxis={t.raw('weekdays') as string[]}
              height={240}
              color="var(--primary)"
            />
          </CardContent>
        </Card>

        {/* 设备分布 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('devices.title')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('devices.subtitle')}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {DEVICE_DISTRIBUTION.map((d) => (
              <div key={d.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {d.name === 'others' ? t('devices.others') : d.name}
                  </span>
                  <span className="text-muted-foreground">{d.percent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-sm bg-muted">
                  <div className={`h-full ${d.color}`} style={{ width: `${d.percent}%` }} />
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
              {DEVICE_DISTRIBUTION.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-sm ${d.color}`} />
                  {d.name === 'others' ? t('devices.others') : d.name}
                </div>
              ))}
            </div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-12 px-5 py-2 font-medium">{t('topPages.rankHeader')}</th>
                  <th className="px-5 py-2 font-medium">{t('topPages.pathHeader')}</th>
                  <th className="px-5 py-2 text-right font-medium">{t('topPages.visitsHeader')}</th>
                  <th className="px-5 py-2 text-right font-medium">{t('topPages.ratioHeader')}</th>
                </tr>
              </thead>
              <tbody>
                {TOP_PAGES.map((p) => (
                  <tr key={p.rank} className="border-b last:border-0">
                    <td className="px-5 py-2.5">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold ${
                          p.rank === 1
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {p.rank}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 font-mono text-foreground">{p.path}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{p.visits}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">
                      {p.ratio}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </Container>
  )
}
