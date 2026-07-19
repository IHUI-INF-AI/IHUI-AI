import type { Metadata } from 'next'
import { Activity, AlertTriangle, Smartphone, UserPlus, Users } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Container } from '@/components/layout'
import { LineChart } from '@/components/charts/LineChart'

export const metadata: Metadata = {
  title: '移动端仪表盘',
  description: '移动端关键指标监控：DAU、新增用户、会话数、崩溃率、设备分布与 Top 页面。',
}

interface StatItem {
  label: string
  value: string
  trend: string
  trendUp: boolean
  Icon: typeof Users
}

const STATS: StatItem[] = [
  { label: 'DAU', value: '128,450', trend: '+5.2%', trendUp: true, Icon: Users },
  { label: '新增用户', value: '3,210', trend: '+12.4%', trendUp: true, Icon: UserPlus },
  { label: '会话数', value: '456,789', trend: '+3.1%', trendUp: true, Icon: Activity },
  { label: '崩溃率', value: '0.32%', trend: '-0.08%', trendUp: false, Icon: AlertTriangle },
]

const DAU_TREND_DATA: number[] = [110200, 115600, 118900, 122400, 119800, 126700, 128450]
const DAU_TREND_AXIS: string[] = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const DEVICE_DISTRIBUTION: { name: string; percent: number; color: string }[] = [
  { name: 'iOS', percent: 52, color: 'bg-primary' },
  { name: 'Android', percent: 41, color: 'bg-emerald-500' },
  { name: '其他', percent: 7, color: 'bg-amber-500' },
]

const TOP_PAGES: { rank: number; path: string; visits: string; ratio: string }[] = [
  { rank: 1, path: '/home', visits: '186,302', ratio: '40.8%' },
  { rank: 2, path: '/chat', visits: '92,104', ratio: '20.2%' },
  { rank: 3, path: '/agents', visits: '54,871', ratio: '12.0%' },
  { rank: 4, path: '/discover', visits: '38,210', ratio: '8.4%' },
  { rank: 5, path: '/user/center', visits: '21,654', ratio: '4.7%' },
]

export default function MobileDashboardPage() {
  return (
    <Container maxWidth="xl" padding={false} className="space-y-6 py-6">
      <header className="space-y-1 px-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Smartphone className="h-7 w-7 text-primary" />
          移动端仪表盘
        </h1>
        <p className="text-sm text-muted-foreground">
          监控移动端核心运营指标，数据为 Mock 演示数据。
        </p>
      </header>

      {/* Stat 卡片 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {STATS.map(({ label, value, trend, trendUp, Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-sm text-muted-foreground">{label}</div>
                <div className="text-2xl font-bold tracking-tight">{value}</div>
                <div
                  className={`text-xs ${trendUp ? 'text-emerald-600 dark:text-emerald-500' : 'text-muted-foreground'}`}
                >
                  {trend} 较昨日
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
            <CardTitle className="text-base">最近 7 天 DAU 趋势</CardTitle>
            <p className="text-xs text-muted-foreground">每日活跃用户数变化曲线</p>
          </CardHeader>
          <CardContent>
            <LineChart
              data={DAU_TREND_DATA}
              xAxis={DAU_TREND_AXIS}
              height={240}
              color="var(--primary)"
            />
          </CardContent>
        </Card>

        {/* 设备分布 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">设备分布</CardTitle>
            <p className="text-xs text-muted-foreground">iOS / Android / 其他占比</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {DEVICE_DISTRIBUTION.map((d) => (
              <div key={d.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{d.name}</span>
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
                  {d.name}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 页面 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top 5 页面</CardTitle>
          <p className="text-xs text-muted-foreground">访问量最高的 5 个移动端页面</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-12 px-5 py-2 font-medium">排名</th>
                  <th className="px-5 py-2 font-medium">页面路径</th>
                  <th className="px-5 py-2 text-right font-medium">访问数</th>
                  <th className="px-5 py-2 text-right font-medium">占比</th>
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
